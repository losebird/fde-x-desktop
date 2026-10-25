import './support/no-stray-processes.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { applyCancelProvenance, CANCEL_PROVENANCE_PATCHES } from '../host-pin/cancel-provenance.mjs'

function patchesFor(file) {
  return CANCEL_PROVENANCE_PATCHES.filter((patch) => patch.file === file)
}

function prev(file, index = 0) {
  return patchesFor(file)[index].prev
}

async function writeModule(root, file, source) {
  const abs = join(root, 'node_modules', file)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, source)
  return abs
}

async function load(abs, stamp) {
  return import(`${pathToFileURL(abs).href}?stamp=${stamp}`)
}

test('archive-stop and goal-pause stay kind user and record different sources', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cancel-prov-'))
  try {
    const agentFile = '@deepseek-ai/dsh-agent/lib/index.js'
    const goalFile = '@deepseek-ai/dsh-goal-round-driver/lib/index.js'
    const sessionFile = '@deepseek-ai/dsh-api-session-controller/lib/index.js'
    const acpFile = '@deepseek-ai/dsh-acp/lib/index.js'
    const loopFile = '@deepseek-ai/dsh-agent-loop/lib/index.js'
    const agentAbs = await writeModule(root, agentFile, `export function archiveStop(agent) {\n${prev(agentFile)}\n}\n`)
    const goalAbs = await writeModule(root, goalFile, `export function goalPause(ctx, agent, change) {\n${prev(goalFile)}\n}\n`)
    const sessionAbs = await writeModule(root, sessionFile, `export function sessionCancel(agent) {\n${prev(sessionFile)}\n}\n`)
    const acp = patchesFor(acpFile)
    const acpAbs = await writeModule(root, acpFile, `
export const sessions = {
  cancel() {
    const inflight = this.inflight
    this.cancelPrompt('ACP prompt cancelled')
${acp[0].prev}
  },
  close() {
    const inflight = this.inflight
    this.cancelPrompt('close')
${acp[1].prev}
  },
  cancelPrompt() {
    const inflight = this.inflight
${acp[2].prev}
  },
}
`)
    const loopAbs = await writeModule(root, loopFile, `
function assertNever(value) { throw new Error('never ' + (value && value.kind)) }
export function abortedCancelCause(signal) {
	if (!signal.aborted) return void 0;
	const cause = signal.reason;
	switch (cause.kind) {
${prev(loopFile)}
		case "hook": return { kind: "hook", reason: cause.reason };
		default: return assertNever(cause);
	}
}
`)
    const beforeArchive = await load(agentAbs, 'before')
    const seen = []
    beforeArchive.archiveStop({
      status: 'running',
      cancel(cause, options) { seen.push({ cause, options }) },
    })
    assert.deepEqual(seen[0].cause, { kind: 'user' })
    assert.equal(seen[0].cause.source, undefined)
    assert.equal(seen[0].options, undefined)

    const first = applyCancelProvenance(root)
    assert.equal(first.filter((row) => row.status === 'patched').length, CANCEL_PROVENANCE_PATCHES.length - 2)
    const second = applyCancelProvenance(root)
    assert.equal(second.every((row) => row.status === 'already' || row.status === 'absent'), true)
    assert.equal(second.filter((row) => row.status === 'absent').length, 2)

    const afterArchive = await load(agentAbs, 'after')
    const archived = []
    afterArchive.archiveStop({
      status: 'running',
      cancel(cause, options) { archived.push({ cause, options }) },
    })
    afterArchive.archiveStop({
      status: 'idle',
      cancel() { throw new Error('idle archive must not cancel') },
    })
    assert.equal(archived.length, 1)
    assert.equal(archived[0].cause.kind, 'user')
    assert.equal(archived[0].cause.source, 'archive-stop')
    assert.equal(archived[0].cause.keepInbox, false)
    assert.equal(archived[0].options.keepInbox, false)

    const afterGoal = await load(goalAbs, 'after')
    const paused = []
    afterGoal.goalPause(
      { agents: { currentInitiator: () => ({ id: 'other' }) } },
      {
        status: 'running',
        cancel(cause, options) { paused.push({ cause, options }) },
      },
      { operation: 'pause' },
    )
    assert.equal(paused[0].cause.kind, 'user')
    assert.equal(paused[0].cause.source, 'goal-pause')
    assert.equal(paused[0].cause.keepInbox, true)
    assert.equal(paused[0].options.keepInbox, true)

    const afterSession = await load(sessionAbs, 'after')
    const stopped = []
    afterSession.sessionCancel({
      cancel(cause, options) { stopped.push({ cause, options }) },
    })
    assert.equal(stopped[0].cause.kind, 'user')
    assert.equal(stopped[0].cause.source, 'session/cancel')
    assert.equal(stopped[0].cause.keepInbox, true)
    assert.equal(stopped[0].options.keepInbox, true)

    const afterAcp = await load(acpAbs, 'after')
    const acpCalls = []
    const agent = { cancel(cause, options) { acpCalls.push({ cause, options }) } }
    afterAcp.sessions.cancel.call({ inflight: undefined, agent, cancelPrompt() {} })
    afterAcp.sessions.close.call({ inflight: undefined, agent, cancelPrompt() {} })
    afterAcp.sessions.cancelPrompt.call({ inflight: { messageQueued: true }, agent })
    assert.equal(acpCalls.length, 3)
    for (const call of acpCalls) {
      assert.equal(call.cause.kind, 'user')
      assert.equal(call.cause.source, 'acp')
      assert.equal(call.cause.keepInbox, false)
      assert.equal(call.options.keepInbox, false)
    }

    const afterLoop = await load(loopAbs, 'after')
    assert.deepEqual(
      afterLoop.abortedCancelCause({
        aborted: true,
        reason: { kind: 'user', source: 'goal-pause', keepInbox: true },
      }),
      { kind: 'user', source: 'goal-pause', keepInbox: true },
    )
    assert.deepEqual(
      afterLoop.abortedCancelCause({
        aborted: true,
        reason: { kind: 'user', source: 'archive-stop', keepInbox: false },
      }),
      { kind: 'user', source: 'archive-stop', keepInbox: false },
    )
    assert.deepEqual(
      afterLoop.abortedCancelCause({ aborted: true, reason: { kind: 'user' } }),
      { kind: 'user' },
    )
    assert.deepEqual(
      afterLoop.abortedCancelCause({ aborted: true, reason: { kind: 'parent' } }),
      { kind: 'parent' },
    )
    const stamped = await readFile(loopAbs, 'utf8')
    assert.match(stamped, /copied\.source = cause\.source/)
    assert.equal(stamped.includes('case "user":\n\t\tcase "parent"'), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a drifted cancel call fails closed instead of booting half-patched', () => {
  const root = join(tmpdir(), `cancel-prov-drift-${Date.now()}`)
  return (async () => {
    await writeModule(root, '@deepseek-ai/dsh-agent/lib/index.js', 'agent.cancel({ kind: "user" })\n')
    assert.throws(() => applyCancelProvenance(root), /matched 0/)
  })().finally(() => rm(root, { recursive: true, force: true }))
})
