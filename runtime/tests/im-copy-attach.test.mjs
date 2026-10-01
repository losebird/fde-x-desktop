import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { attachCopyJobs, copyLetterAttach, destRel } from '../vendor-overlays/dsh-lan-assist/copy-attach.js'

describe('copy letter attach dest', () => {
  test('destRel keeps a workspace-relative file identity', () => {
    assert.equal(destRel('research/FDE-cross-media-summary.md'), 'research/FDE-cross-media-summary.md')
    assert.equal(destRel('./research/a.md'), 'research/a.md')
    assert.equal(destRel(''), '')
    assert.equal(destRel('/etc/passwd'), '')
    assert.equal(destRel('../escape.md'), '')
    assert.equal(destRel('research/../x.md'), '')
  })

  test('path writes under cwd; missing path keeps the fallback', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fde-copy-attach-'))
    const fallback = async () => ({ ok: true, path: 'inbox', via: 'fallback' })
    const getAttachment = async () => ({ ok: true, name: 'a.md', mime: 'text/markdown', data: '# hi\n' })
    try {
      const skipped = await copyLetterAttach(fallback, getAttachment, {
        requestId: 'req_1',
        index: 0,
        workspace: cwd,
      })
      assert.equal(skipped.via, 'fallback')
      const written = await copyLetterAttach(fallback, getAttachment, {
        requestId: 'req_1',
        index: 0,
        workspace: cwd,
        path: 'research/a.md',
      })
      assert.equal(written.ok, true)
      assert.equal(written.path, 'research/a.md')
      assert.equal(await readFile(join(cwd, 'research/a.md'), 'utf8'), '# hi\n')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('base64 workspace files decode when size matches', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fde-copy-attach-b64-'))
    const text = '# 终稿结论\n'
    const data = Buffer.from(text, 'utf8').toString('base64')
    const fallback = async () => ({ ok: false, error: 'FALLBACK' })
    const getAttachment = async () => ({
      ok: true,
      name: 'FDE-cross-media-summary.md',
      mime: 'text/markdown',
      size: Buffer.byteLength(text),
      data,
    })
    try {
      const written = await copyLetterAttach(fallback, getAttachment, {
        requestId: 'req_1',
        index: 1,
        workspace: cwd,
        path: 'research/FDE-cross-media-summary.md',
      })
      assert.equal(written.ok, true)
      assert.equal(await readFile(join(cwd, 'research/FDE-cross-media-summary.md'), 'utf8'), text)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('attachCopyJobs keeps dest identity when hall only has basename', () => {
    const jobs = attachCopyJobs(
      [
        { index: 0, name: 'dsh-handoff.json', mime: 'application/vnd.dsh.handoff+json' },
        { index: 1, name: 'FDE-cross-media-summary.md', fileId: 'FDE-cross-media-summary.md' },
        { index: 2, name: 'FDE-and-FDE-X-tech-media-scan.md' },
      ],
      [
        'research/FDE-cross-media-summary.md',
        'research/FDE-and-FDE-X-tech-media-scan.md',
      ],
    )
    assert.deepEqual(jobs, [
      { index: 1, dest: 'research/FDE-cross-media-summary.md' },
      { index: 2, dest: 'research/FDE-and-FDE-X-tech-media-scan.md' },
    ])
  })

  test('attachCopyJobs ignores attachments that do not share dest identity', () => {
    const jobs = attachCopyJobs(
      [
        { index: 1, name: 'other.md' },
        { index: 2, name: 'a.md' },
      ],
      ['research/a.md'],
    )
    assert.deepEqual(jobs, [{ index: 2, dest: 'research/a.md' }])
  })

  test('dests batch zips basename onto workspace path and skips the pack', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fde-copy-attach-dests-'))
    const files = {
      0: { ok: true, name: 'dsh-handoff.json', mime: 'application/vnd.dsh.handoff+json', data: '{}' },
      1: { ok: true, name: 'a.md', mime: 'text/markdown', size: 4, data: '# a\n' },
      2: { ok: true, name: 'b.md', mime: 'text/markdown', size: 4, data: '# b\n' },
    }
    const getAttachment = async (_id, index) => files[index] || { ok: false, error: 'NO_FILE' }
    const fallback = async () => ({ ok: true, path: 'inbox', via: 'fallback' })
    try {
      const written = await copyLetterAttach(fallback, getAttachment, {
        requestId: 'req_1',
        workspace: cwd,
        dests: ['research/a.md', 'research/b.md'],
      })
      assert.equal(written.ok, true)
      assert.equal(written.copied, 2)
      assert.deepEqual(written.warnings, [])
      assert.equal(await readFile(join(cwd, 'research/a.md'), 'utf8'), '# a\n')
      assert.equal(await readFile(join(cwd, 'research/b.md'), 'utf8'), '# b\n')
      assert.equal(await readFile(join(cwd, 'dsh-handoff.json'), 'utf8').catch(() => 'missing'), 'missing')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
