/**
 * Unit: slip parser + forced-cwd contract. Missing slips dir must not throw.
 * Usage: node smoke-slips.js
 */
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  actorLooksUnstable,
  createSlipIngest,
  ingestParsedSlip,
  parseSlip,
  resolveSessionCwd,
} from './slips.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function main() {
  const home = join(tmpdir(), `dsh-slips-${Date.now()}`)
  process.env.DSH_HOME = home

  assert(actorLooksUnstable('127.0.0.1'), 'ip should be unstable')
  assert(actorLooksUnstable('::1'), 'ipv6 should be unstable')
  assert(actorLooksUnstable('anonymous-user-id'), 'anon should be unstable')
  assert(actorLooksUnstable('box.local'), 'hostname should be unstable')
  assert(actorLooksUnstable(''), 'empty actor')
  assert(!actorLooksUnstable('peer-stable-kitchen'), 'stable id rejected')

  const badIp = parseSlip({
    schemaVersion: 1,
    requestId: 'r1',
    sessionId: 'session-x',
    actor: '10.0.0.8',
    quote: 'hello',
  })
  assert(!badIp.ok && badIp.reason === 'BAD_ACTOR', `ip slip: ${JSON.stringify(badIp)}`)

  const parsed = parseSlip({
    schemaVersion: 1,
    requestId: 'req-kitchen-1',
    sessionId: 'session-abc',
    actor: 'peer-stable-kitchen',
    body: '先切 10%。',
    toIds: ['peer-stable-kitchen'],
    adoptedAt: '2026-08-20T00:00:00Z',
  })
  assert(parsed.ok, `parse failed ${JSON.stringify(parsed)}`)
  assert(parsed.slip.quote === '先切 10%。', 'quote dropped')
  assert(parsed.slip.kind === 'adopt', 'default kind should stay adopt')

  const mail = parseSlip({
    schemaVersion: 1,
    kind: 'mail',
    id: 'req-kitchen-1.send',
    requestId: 'req-kitchen-1',
    turn: 'send',
    sessionId: 'session-abc',
    workspace: '/tmp/forced-cwd',
    actor: 'peer-stable-kitchen',
    fromName: 'Ace',
    quote: '【Ace】先切 10%。',
    at: '2026-08-29T00:00:00.000Z',
  })
  assert(mail.ok, `mail parse failed ${JSON.stringify(mail)}`)
  assert(mail.slip.kind === 'mail', 'mail kind dropped')
  assert(mail.slip.workspace === '/tmp/forced-cwd', 'workspace dropped')
  assert(mail.slip.id === 'req-kitchen-1.send', 'mail id dropped')

  const ingest = createSlipIngest({
    sidecar: { snapshot: () => ({ ready: false, port: 0 }), getApiKey: () => '' },
    home,
    pollMs: 60_000,
  })
  const missing = await ingest.tick()
  assert(missing.ok === true, `missing dir should succeed: ${JSON.stringify(missing)}`)
  ingest.stop()

  await mkdir(join(home, 'lan-assist', 'slips'), { recursive: true })
  const empty = createSlipIngest({
    sidecar: { snapshot: () => ({ ready: true, port: 9 }), getApiKey: () => '' },
    home,
    pollMs: 60_000,
  })
  const emptyTick = await empty.tick()
  assert(emptyTick.ok === true && emptyTick.ingested === 0, `empty dir ${JSON.stringify(emptyTick)}`)
  empty.stop()

  const unresolved = await resolveSessionCwd('session-does-not-exist', () => null, home)
  assert(unresolved === '', `must not invent cwd: ${unresolved}`)

  let forced
  try {
    forced = await ingestParsedSlip(
      { snapshot: () => ({ ready: true, port: 9 }), getApiKey: () => '' },
      parsed.slip,
      '/tmp/forced-cwd',
    )
  } catch (err) {
    forced = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  assert(forced && typeof forced.ok === 'boolean', `forced cwd threw uncaught: ${JSON.stringify(forced)}`)

  console.log('ok slips parser', {
    missing,
    emptyTick,
    parsed: parsed.slip.requestId,
    forcedCwd: '/tmp/forced-cwd',
    forcedOk: forced.ok,
  })
  await rm(home, { recursive: true, force: true })
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err)
  process.exit(1)
})
