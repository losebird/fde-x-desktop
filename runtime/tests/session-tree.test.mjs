import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { constants as zlibConstants, zstdCompress, zstdDecompress } from 'node:zlib'
import {
  increasingEventFrames,
  readLogHeader,
  readSessionTree,
  scanZstdFrames,
  writeSessionTree,
} from '../session-tree.mjs'

const compress = promisify(zstdCompress)
const decompress = promisify(zstdDecompress)
const ZSTD_CHECKSUM = { params: { [zlibConstants.ZSTD_c_checksumFlag]: 1 } }

async function frameOf(text) {
  return compress(Buffer.from(text), ZSTD_CHECKSUM)
}

async function sessionLog(header, batches) {
  const frames = [await frameOf(`${JSON.stringify(header)}\n`)]
  for (const batch of batches) {
    const body = `${batch.map((event) => JSON.stringify(event)).join('\n')}\n`
    frames.push(await frameOf(body))
  }
  return Buffer.concat(frames)
}

async function decodeLog(buf) {
  const frames = scanZstdFrames(buf)
  const header = JSON.parse((await decompress(buf.subarray(frames[0].start, frames[0].end))).toString('utf8').split('\n')[0])
  const events = []
  for (let i = 1; i < frames.length; i += 1) {
    const text = (await decompress(buf.subarray(frames[i].start, frames[i].end))).toString('utf8')
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      events.push(JSON.parse(line))
    }
  }
  return { frames: frames.length, header, events }
}

async function putLog(dir, header, batches) {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'session.lock'), '')
  await writeFile(join(dir, 'session.v3.jsonl.zstd'), await sessionLog(header, batches))
}

describe('session tree pack and restore', () => {
  test('increasing event frames keep original batches when seq is dense', async () => {
    const buf = await sessionLog(
      { type: 'session', version: 3, id: 'session-root', cwd: '/tmp/a' },
      [
        [{ seq: 0, type: 'permission/preset' }],
        [{ seq: 1, type: 'turn/start' }, { seq: 2, type: 'user/message' }],
        [{ seq: 3, type: 'turn/end' }],
      ],
    )
    const frames = await increasingEventFrames(buf)
    assert.equal(frames.length, 3)
    assert.deepEqual(scanZstdFrames(buf).slice(1).map((frame) => buf.subarray(frame.start, frame.end).equals(frames.shift() || Buffer.alloc(0))), [true, true, true])
  })

  test('seq rewind drops later events and keeps earlier frames', async () => {
    const buf = await sessionLog(
      { type: 'session', version: 3, id: 'session-root', cwd: '/tmp/a' },
      [
        [{ seq: 0, type: 'permission/preset' }],
        [{ seq: 1, type: 'turn/start' }],
        [{ seq: 2, type: 'session/title' }],
        [{ seq: 1, type: 'session/title' }],
      ],
    )
    const frames = await increasingEventFrames(buf)
    assert.equal(frames.length, 3)
    const rest = Buffer.concat(frames)
    const events = []
    for (const frame of scanZstdFrames(rest)) {
      const text = (await decompress(rest.subarray(frame.start, frame.end))).toString('utf8')
      for (const line of text.split('\n')) {
        if (line.trim()) events.push(JSON.parse(line))
      }
    }
    assert.deepEqual(events.map((event) => event.seq), [0, 1, 2])
  })

  test('readSessionTree packs the parent log and descendants by parentSession', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-session-tree-'))
    const project = join(root, 'proj')
    const parentId = 'session-parent'
    const childId = 'aa111111-1111-4111-8111-111111111111'
    const grandId = 'bb222222-2222-4222-8222-222222222222'
    const stranger = 'session-other'
    try {
      await putLog(join(project, parentId), { type: 'session', version: 3, id: parentId, cwd: '/tmp/a' }, [
        [{ seq: 0, type: 'turn/start' }],
        [{ seq: 1, type: 'turn/end' }],
      ])
      await putLog(join(project, childId), {
        type: 'session',
        version: 3,
        id: childId,
        cwd: '/tmp/a',
        parentSession: parentId,
        origin: 'subagent',
      }, [[{ seq: 0, type: 'turn/start' }]])
      await putLog(join(project, grandId), {
        type: 'session',
        version: 3,
        id: grandId,
        cwd: '/tmp/a',
        parentSession: childId,
        origin: 'subagent',
      }, [[{ seq: 0, type: 'turn/start' }]])
      await putLog(join(project, stranger), { type: 'session', version: 3, id: stranger, cwd: '/tmp/a' }, [
        [{ seq: 0, type: 'turn/start' }],
      ])
      const tree = await readSessionTree(root, parentId)
      assert.equal(tree.sessionId, parentId)
      assert.equal(tree.files.some((file) => file.name === 'session.v3.jsonl.zstd'), true)
      assert.equal(tree.files.some((file) => file.name === 'session.lock'), false)
      assert.deepEqual(tree.members.map((row) => row.sessionId), [childId, grandId])
      assert.deepEqual(tree.members.map((row) => row.dir), [childId, grandId])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('writeSessionTree keeps created header, original event frames, and remaps member parentSession', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-session-write-'))
    const srcProject = join(root, 'src')
    const destProject = join(root, 'dest')
    const parentId = 'session-parent'
    const childId = 'cc333333-3333-4333-8333-333333333333'
    const grandId = 'dd444444-4444-4444-8444-444444444444'
    const createdId = 'session-created'
    try {
      await putLog(join(srcProject, parentId), { type: 'session', version: 3, id: parentId, cwd: '/tmp/from' }, [
        [{ seq: 0, type: 'permission/preset' }],
        [{ seq: 1, type: 'turn/start' }],
        [{ seq: 2, type: 'turn/end' }],
      ])
      await putLog(join(srcProject, childId), {
        type: 'session',
        version: 3,
        id: childId,
        cwd: '/tmp/from',
        parentSession: parentId,
        origin: 'subagent',
        delegationDepth: 1,
      }, [[{ seq: 0, type: 'turn/start' }], [{ seq: 1, type: 'turn/end' }]])
      await putLog(join(srcProject, grandId), {
        type: 'session',
        version: 3,
        id: grandId,
        cwd: '/tmp/from',
        parentSession: childId,
        origin: 'subagent',
        delegationDepth: 2,
      }, [[{ seq: 0, type: 'turn/start' }]])
      const tree = await readSessionTree(root, parentId)
      const createdHeader = {
        type: 'session',
        version: 3,
        id: createdId,
        createdAt: 9,
        cwd: '/tmp/to',
        isSeeded: false,
      }
      const createdDir = join(destProject, createdId)
      await mkdir(createdDir, { recursive: true })
      await writeFile(join(createdDir, 'session.v3.jsonl.zstd'), await sessionLog(createdHeader, [[{ seq: 0, type: 'session/end-seed' }]]))
      const result = await writeSessionTree({
        parentDir: createdDir,
        files: tree.files,
        members: tree.members,
        cwd: '/tmp/to',
        createdId,
        sourceId: parentId,
      })
      assert.deepEqual(result.warnings, [])
      const destBuf = await readFile(join(createdDir, 'session.v3.jsonl.zstd'))
      const parent = await decodeLog(destBuf)
      assert.equal(parent.header.id, createdId)
      assert.equal(parent.header.cwd, '/tmp/to')
      assert.equal(parent.header.createdAt, 9)
      assert.equal(parent.frames, 4)
      assert.deepEqual(parent.events.map((event) => event.seq), [0, 1, 2])
      const srcEventFrames = await increasingEventFrames(await readFile(join(srcProject, parentId, 'session.v3.jsonl.zstd')))
      const destFrames = scanZstdFrames(destBuf)
      assert.equal(destFrames.length - 1, srcEventFrames.length)
      srcEventFrames.forEach((frame, index) => {
        assert.equal(destBuf.subarray(destFrames[index + 1].start, destFrames[index + 1].end).equals(frame), true)
      })
      const child = await decodeLog(await readFile(join(destProject, childId, 'session.v3.jsonl.zstd')))
      assert.equal(child.header.id, childId)
      assert.equal(child.header.cwd, '/tmp/to')
      assert.equal(child.header.parentSession, createdId)
      assert.equal(child.header.origin, 'subagent')
      assert.equal(child.frames, 3)
      assert.equal(await readLogHeader(join(destProject, childId)).then((header) => header.parentSession), createdId)
      const grand = await decodeLog(await readFile(join(destProject, grandId, 'session.v3.jsonl.zstd')))
      assert.equal(grand.header.id, grandId)
      assert.equal(grand.header.cwd, '/tmp/to')
      assert.equal(grand.header.parentSession, childId)
      assert.equal(grand.frames, 2)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('writeSessionTree still restores a parent when members are absent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-session-oldpack-'))
    try {
      const createdId = 'session-new'
      const createdDir = join(root, createdId)
      await mkdir(createdDir, { recursive: true })
      await writeFile(
        join(createdDir, 'session.v3.jsonl.zstd'),
        await sessionLog({ type: 'session', version: 3, id: createdId, cwd: '/tmp/to' }, []),
      )
      const incoming = await sessionLog(
        { type: 'session', version: 3, id: 'session-old', cwd: '/tmp/from' },
        [[{ seq: 0, type: 'turn/start' }], [{ seq: 1, type: 'turn/end' }]],
      )
      await writeSessionTree({
        parentDir: createdDir,
        files: [{ name: 'session.v3.jsonl.zstd', data: incoming.toString('base64') }],
        cwd: '/tmp/to',
        createdId,
        sourceId: 'session-old',
      })
      const parent = await decodeLog(await readFile(join(createdDir, 'session.v3.jsonl.zstd')))
      assert.equal(parent.header.id, createdId)
      assert.equal(parent.frames, 3)
      assert.equal(parent.events.length, 2)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('member dir cannot leave the project folder', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-session-escape-'))
    try {
      const createdDir = join(root, 'session-new')
      await mkdir(createdDir, { recursive: true })
      await writeFile(
        join(createdDir, 'session.v3.jsonl.zstd'),
        await sessionLog({ type: 'session', version: 3, id: 'session-new', cwd: '/tmp/to' }, []),
      )
      const incoming = await sessionLog(
        { type: 'session', version: 3, id: 'session-old', cwd: '/tmp/from' },
        [[{ seq: 0, type: 'turn/start' }]],
      )
      const result = await writeSessionTree({
        parentDir: createdDir,
        files: [{ name: 'session.v3.jsonl.zstd', data: incoming.toString('base64') }],
        members: [{
          sessionId: 'evil',
          dir: '../outside',
          files: [{ name: 'session.v3.jsonl.zstd', data: incoming.toString('base64') }],
        }],
        cwd: '/tmp/to',
        createdId: 'session-new',
        sourceId: 'session-old',
      })
      assert.equal(result.warnings.length, 1)
      await rm(join(dirname(root), 'outside'), { recursive: true, force: true }).catch(() => {})
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
