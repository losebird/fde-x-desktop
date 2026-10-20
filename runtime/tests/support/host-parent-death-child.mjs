import { writeSync } from 'node:fs'
import { bootWorkflowHost } from './workflow-host.mjs'

function send(message) {
  writeSync(3, `${JSON.stringify(message)}\n`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function webProbe(core) {
  const logs = (core.logs || []).map((line) => String(line))
  const webLine = logs.find((line) => /^dsh web:\s+\S+/u.test(line)) || ''
  const epipe = logs.some((line) => line.includes('EPIPE'))
  let status = 0
  let error = ''
  if (core.origin) {
    try {
      const response = await fetch(core.origin, {
        headers: core.cookie ? { cookie: core.cookie } : {},
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
      })
      status = response.status
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught)
    }
  }
  return {
    webLine: Boolean(webLine),
    webText: webLine,
    epipe,
    status,
    error,
    logTail: logs.slice(-8),
  }
}

const host = await bootWorkflowHost({ withPlugins: true })
let stopping = false

async function shutdown(code) {
  if (stopping) return
  stopping = true
  await host.stop().catch(() => {})
  process.exit(code)
}

process.on('SIGTERM', () => {
  void shutdown(0)
})
process.on('SIGINT', () => {
  void shutdown(0)
})

const readyProbe = await webProbe(host.core)
send({
  type: 'ready',
  home: host.home,
  hostPid: host.core.child?.pid ?? null,
  parentPid: process.pid,
  version: host.version,
  origin: host.core.origin,
  ...readyProbe,
})

const hold = Number(process.env.FDE_PARENT_DEATH_HOLD_MS || 0)
if (hold > 0) {
  await sleep(hold)
  const again = await webProbe(host.core)
  send({
    type: 'stable',
    hostPid: host.core.child?.pid ?? null,
    parentPid: process.pid,
    ...again,
  })
}

await new Promise(() => {})
