import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openUniverFile } from '../univer-open.js'

test('Univer open needs a workspace copy and refuses the original path shape', async () => {
  const miss = await openUniverFile(null, { workspace: '/tmp', path: 'a.xlsx' })
  assert.equal(miss.error, 'NO_UNIVER')
  const noCwd = await openUniverFile({ fileState: async () => ({}) }, { path: 'a.xlsx' })
  assert.equal(noCwd.error, 'NO_CWD')
})

test('Univer imports office into a sidecar .univer then returns a viewer url', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'dla-univer-'))
  const src = join(cwd, 'sheet.xlsx')
  await writeFile(src, 'xlsx')
  const calls = []
  const univer = {
    async ensureGateway() { return { ok: true } },
    async newFile(spec) { calls.push(['new', spec.file]); return { ok: true } },
    async worktree(spec) { calls.push(['tree', spec.action]); return { ok: true, result: { worktreeId: 'wt-1' } } },
    async importUnitContent(spec) { calls.push(['import', spec.source, spec.worktreeId]); return { ok: true } },
    async fileState() { return { viewerUrl: 'http://127.0.0.1:8000/?file=sheet' } },
  }
  const got = await openUniverFile(univer, { workspace: cwd, path: 'sheet.xlsx' })
  assert.equal(got.ok, true)
  assert.equal(got.url, 'http://127.0.0.1:8000/?file=sheet')
  assert.equal(calls[0][0], 'new')
  assert.equal(calls[2][0], 'import')
  await mkdir(join(cwd, 'keep'))
  await writeFile(join(cwd, 'keep.univer'), 'u')
  const again = await openUniverFile({
    async fileState() { return { viewerUrl: 'http://127.0.0.1:8000/?file=keep' } },
  }, { workspace: cwd, path: 'keep.univer' })
  assert.equal(again.ok, true)
})
