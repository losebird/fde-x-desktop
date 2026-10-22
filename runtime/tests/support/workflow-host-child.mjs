import { writeSync } from 'node:fs'
import { createInterface } from 'node:readline'

function send(message) {
  writeSync(3, `${JSON.stringify(message)}\n`)
}

const options = JSON.parse(process.env.FDE_WORKFLOW_HOST_OPTIONS || '{}')
if (!options.callTool) delete options.callTool

let host
try {
  const { bootWorkflowHost } = await import('./workflow-host.mjs')
  host = await bootWorkflowHost(options)
} catch (error) {
  send({ type: 'fatal', message: error instanceof Error ? error.stack || error.message : String(error) })
  process.exit(1)
}

send({
  type: 'ready',
  cwd: host.cwd,
  probeDir: host.probeDir,
  home: host.home,
  version: host.version,
  origin: host.core.origin,
  cookie: host.core.cookie,
})

const lines = createInterface({ input: process.stdin })
for await (const line of lines) {
  if (!line.trim()) continue
  const message = JSON.parse(line)
  if (message.type === 'stop') {
    await host.stop()
    send({ type: 'result', id: message.id, value: true })
    process.exit(0)
  }
  if (message.type === 'call') {
    try {
      const value = await host.core.call(message.endpoint, message.args)
      send({ type: 'result', id: message.id, value })
    } catch (error) {
      send({ type: 'result', id: message.id, error: error instanceof Error ? error.message : String(error) })
    }
  }
  if (message.type === 'stream') {
    try {
      const frames = []
      for await (const frame of host.core.stream(message.endpoint, message.args)) frames.push(frame)
      send({ type: 'result', id: message.id, value: frames })
    } catch (error) {
      send({ type: 'result', id: message.id, error: error instanceof Error ? error.message : String(error) })
    }
  }
}
