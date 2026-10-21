import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export function mcpPublicName(server, tool) {
  const name = String(tool || '').trim()
  const serverName = String(server || '').trim()
  if (!name) return { error: '缺少 tool' }
  if (name.startsWith('mcp__')) {
    if (serverName && !name.startsWith(`mcp__${serverName}__`)) {
      return { error: `工具 ${name} 不属于 server ${serverName}` }
    }
    return { name }
  }
  if (!serverName) return { error: '缺少 server' }
  return { name: `mcp__${serverName}__${name}` }
}

function failureText(payload) {
  if (payload && typeof payload.error === 'string' && payload.error) return payload.error
  if (payload && typeof payload.message === 'string' && payload.message) return payload.message
  return JSON.stringify(payload ?? null)
}

export async function callHostMcp({ origin, cookie, dshHome, name, args }) {
  const home = dshHome || process.env.FDE_DSH_HOME || process.env.DSH_HOME
  const token = String(await readFile(join(home, 'run', 'bridge.token'), 'utf8')).trim()
  const response = await fetch(new URL('/fde-session/mcp/call', origin), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      'x-fde-bridge-token': token,
    },
    body: JSON.stringify({
      name,
      args: args && typeof args === 'object' && !Array.isArray(args) ? args : {},
    }),
  })
  const payload = await response.json()
  if (!response.ok || payload.ok === false) {
    return { ok: false, text: '', error: failureText(payload) }
  }
  return { ok: true, text: typeof payload.text === 'string' ? payload.text : '', error: '' }
}
