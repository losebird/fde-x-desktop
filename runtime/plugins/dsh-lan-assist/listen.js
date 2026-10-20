/**
 * Boot-time listen mouth when DSH is closed. Same mailbox, no UI, no followup.
 * Cannot occupy the LAN port at the same time as the plugin.
 * @module dsh-lan-assist/listen
 */

import { spawn } from 'node:child_process'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { assistHome, BODY_MAX_BYTES, dshHome } from './home.js'
import { keyFromHex, verifyFrame } from './crypto.js'
import { stopPid } from './disk.js'

export const LISTEN_MAX_BYTES = BODY_MAX_BYTES

export function safeInboxId(raw) {
  return String(raw || '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80)
}

/**
 * Decide whether a listen-mouth frame may touch disk.
 * Hello is LAN pairing and needs a live secretary; do not drop it while DSH is closed.
 * pair.* is the relay handshake: store for DSH to finish after it wakes.
 */
export function acceptListenFrame(state, frame, bytes = 0) {
  if (bytes > LISTEN_MAX_BYTES) return { ok: false, error: 'TOO_BIG' }
  if (!frame || typeof frame !== 'object') return { ok: false, error: 'BAD_FRAME' }
  const type = String(frame.type || '')
  if (type === 'hello') return { ok: true, store: false, challenge: !frame.confirm }
  if (type.startsWith('pair.')) {
    const id = safeInboxId('pair-' + (frame.session || frame.nonce || ''))
    if (!id) return { ok: false, error: 'BAD_ID' }
    return { ok: true, store: true, id }
  }
  const from = String(frame.from || '')
  const peer = state && state.peers && state.peers[from]
  if (!peer || peer.unpaired || !peer.keyHex) return { ok: false, error: 'KEY_REJECT' }
  try {
    if (!verifyFrame(keyFromHex(peer.keyHex), frame)) return { ok: false, error: 'BAD_MAC' }
  } catch {
    return { ok: false, error: 'BAD_MAC' }
  }
  const id = safeInboxId(frame.requestId || frame.nonce)
  if (!id) return { ok: false, error: 'BAD_ID' }
  return { ok: true, store: true, id }
}

function pidPath() {
  return join(assistHome(), 'listen.pid')
}

export async function writeDaemonScript() {
  const root = assistHome()
  await mkdir(root, { recursive: true })
  const dest = join(root, 'listen-daemon.mjs')
  await writeFile(dest, daemonSource(), 'utf8')
  return dest
}

export function daemonSource() {
  return `#!/usr/bin/env node
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

const home = process.env.DSH_HOME || join(homedir(), '.dsh')
const root = join(home, 'lan-assist')
const port = Number(process.env.DSH_LAN_ASSIST_PORT || 9527)

async function load() {
  try { return JSON.parse(await readFile(join(root, 'state.json'), 'utf8')) }
  catch { return { version: 1, peers: {}, requests: {}, ledger: [], seen: {} } }
}

async function save(state) {
  await mkdir(root, { recursive: true })
  const dest = join(root, 'state.json')
  const tmp = dest + '.tmp'
  const text = JSON.stringify(state, null, 2)
  await writeFile(tmp, text, 'utf8')
  try {
    await rename(tmp, dest)
  } catch (err) {
    const code = err && err.code
    if (code !== 'EPERM' && code !== 'EEXIST' && code !== 'EACCES') throw err
    await writeFile(dest, text, 'utf8')
    try { await unlink(tmp) } catch { /* leftover tmp is harmless */ }
  }
}

function json(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(text)
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET') { json(res, 200, { ok: true, listen: true, port }); return }
  if (req.method !== 'POST' || req.url !== '/frame') { json(res, 404, { ok: false }); return }
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > ${LISTEN_MAX_BYTES}) { json(res, 413, { ok: false, error: 'TOO_BIG' }); return }
    chunks.push(c)
  }
  let frame
  try { frame = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { json(res, 400, { ok: false, error: 'BAD_JSON' }); return }
  const state = await load()
  const id = String(frame && (frame.requestId || frame.nonce) || '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80)
  const from = String((frame && frame.from) || '')
  const peer = state.peers && state.peers[from]
  const type = frame && frame.type
  if (type === 'hello') { json(res, 200, { ok: true, listen: true, stored: false }); return }
  if (String(type || '').startsWith('pair.') && id) {
    const inbox = join(root, 'inbox')
    await mkdir(inbox, { recursive: true })
    await writeFile(join(inbox, 'pair-' + id + '.json'), JSON.stringify({ frame, at: Date.now() }), { encoding: 'utf8', mode: 0o600 })
    json(res, 200, { ok: true, listen: true, stored: true }); return
  }
  if (!peer || peer.unpaired || !peer.keyHex || !id) { json(res, 403, { ok: false, error: 'KEY_REJECT' }); return }
  const key = Buffer.from(String(peer.keyHex), 'hex')
  if (key.length !== 32 || !frame.mac) { json(res, 403, { ok: false, error: 'BAD_MAC' }); return }
  function stable(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value)
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']'
    const keys = Object.keys(value).sort()
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}'
  }
  const copy = { ...frame }
  const mac = copy.mac
  delete copy.mac
  const { createHmac } = await import('node:crypto')
  const expect = createHmac('sha256', key).update(stable(copy)).digest('hex')
  const left = Buffer.from(String(mac), 'hex')
  const right = Buffer.from(expect, 'hex')
  if (left.length !== right.length || !left.equals(right)) { json(res, 403, { ok: false, error: 'BAD_MAC' }); return }
  const inbox = join(root, 'inbox')
  await mkdir(inbox, { recursive: true })
  await writeFile(join(inbox, id + '.json'), JSON.stringify({ frame, at: Date.now() }), { encoding: 'utf8', mode: 0o600 })
  json(res, 200, { ok: true, listen: true, stored: true })
})

server.listen(port, '0.0.0.0')

void (async () => {
  const url = String(process.env.DSH_LAN_ASSIST_NATS || '').trim()
  if (!url) return
  const state = await load()
  const selfId = String((state.self && state.self.id) || '').replace(/[^A-Za-z0-9._-]/g, '')
  if (!selfId) return
  let nats
  try { nats = await import('nats') } catch {
    process.stdout.write(JSON.stringify({ error: 'NATS_DEPENDENCY_MISSING' }))
    process.exit(1)
  }
  const conf = { servers: url }
  const creds = String(process.env.DSH_LAN_ASSIST_NATS_CREDS || '').trim()
  if (creds && typeof nats.credsAuthenticator === 'function') {
    conf.authenticator = nats.credsAuthenticator(await readFile(creds))
  }
  const nc = await nats.connect(conf)
  const sub = nc.subscribe('dsh.v1.inbox.' + selfId)
  for await (const m of sub) {
    let frame
    try {
      const raw = m && m.data
      frame = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw || new Uint8Array()))
    } catch { continue }
    const id = String(frame && (frame.requestId || frame.session || frame.nonce) || '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80)
    if (!id) continue
    const inbox = join(root, 'inbox')
    await mkdir(inbox, { recursive: true })
    await writeFile(join(inbox, id + '.json'), JSON.stringify({ frame, at: Date.now() }), { encoding: 'utf8', mode: 0o600 })
    if (m && typeof m.ack === 'function') { try { await m.ack() } catch {} }
  }
})().catch(() => undefined)
`
}

/**
 * Spawn a detached listen mouth. Caller must stop the plugin LAN first.
 */
function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
}

export async function startListenDaemon(port, extraEnv = {}) {
  await stopListenDaemon()
  const script = await writeDaemonScript()
  const env = {
    ...process.env,
    DSH_HOME: dshHome(),
    DSH_LAN_ASSIST_PORT: String(port),
  }
  const nats = String((extraEnv && extraEnv.DSH_LAN_ASSIST_NATS) || '').trim()
  const creds = String((extraEnv && extraEnv.DSH_LAN_ASSIST_NATS_CREDS) || '').trim()
  if (nats) env.DSH_LAN_ASSIST_NATS = nats
  if (creds) env.DSH_LAN_ASSIST_NATS_CREDS = creds
  const child = spawn(process.execPath, [script], {
    detached: true,
    stdio: 'ignore',
    env,
    windowsHide: true,
  })
  child.unref()
  await mkdir(assistHome(), { recursive: true })
  await writeFile(pidPath(), String(child.pid), 'utf8')
  return child.pid
}

export async function stopListenDaemon() {
  let pid = 0
  try { pid = Number(await readFile(pidPath(), 'utf8')) } catch { return }
  if (!pid) return
  await stopPid(pid)
  try { await unlink(pidPath()) } catch { /* ignore */ }
}

export function launchdHint() {
  const home = process.env.HOME || homedir()
  return join(home, 'Library', 'LaunchAgents', 'ai.dsh.lan-assist.listen.plist')
}

export function linuxUnitPath() {
  const home = process.env.HOME || homedir()
  return join(home, '.config', 'systemd', 'user', 'dsh-lan-assist-listen.service')
}

export function windowsStartupPath() {
  const roaming = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
  return join(roaming, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'dsh-lan-assist-listen.vbs')
}

/**
 * Hidden user-level start. No admin. Startup folder only.
 */
export function windowsStartupSource({ node, script, home, port, nats, creds }) {
  let cmd = `set "DSH_HOME=${home}"& set "DSH_LAN_ASSIST_PORT=${port}"&`
  if (nats) cmd += ` set "DSH_LAN_ASSIST_NATS=${nats}"&`
  if (creds) cmd += ` set "DSH_LAN_ASSIST_NATS_CREDS=${creds}"&`
  cmd += ` "${node}" "${script}"`
  const escaped = cmd.replace(/"/g, '""')
  return [
    'Set sh = CreateObject("WScript.Shell")',
    `sh.Run "cmd /c ${escaped}", 0, False`,
    '',
  ].join('\r\n')
}

/**
 * User-level autostart. No admin.
 * macOS LaunchAgent / Linux systemd --user / Windows Startup folder.
 * Does not start the mouth while the plugin holds the port.
 */
export async function installUserAutostart(port, extraEnv = {}) {
  const script = await writeDaemonScript()
  const node = process.execPath
  const home = process.env.HOME || homedir()
  const nats = String((extraEnv && extraEnv.DSH_LAN_ASSIST_NATS) || '').trim()
  const creds = String((extraEnv && extraEnv.DSH_LAN_ASSIST_NATS_CREDS) || '').trim()
  if (process.platform === 'win32') {
    const dest = windowsStartupPath()
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, windowsStartupSource({
      node,
      script,
      home: dshHome(),
      port,
      nats,
      creds,
    }), 'utf8')
    return { ok: true, path: dest }
  }
  if (process.platform === 'darwin') {
    const plist = launchdHint()
    await mkdir(join(home, 'Library', 'LaunchAgents'), { recursive: true })
    await writeFile(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>ai.dsh.lan-assist.listen</string>
  <key>ProgramArguments</key>
  <array>
    <string>${node}</string>
    <string>${script}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>DSH_HOME</key><string>${xmlEscape(dshHome())}</string>
    <key>DSH_LAN_ASSIST_PORT</key><string>${xmlEscape(port)}</string>
    ${nats ? `<key>DSH_LAN_ASSIST_NATS</key><string>${xmlEscape(nats)}</string>` : ''}
    ${creds ? `<key>DSH_LAN_ASSIST_NATS_CREDS</key><string>${xmlEscape(creds)}</string>` : ''}
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
</dict>
</plist>
`, 'utf8')
    return { ok: true, path: plist }
  }
  if (process.platform === 'linux') {
    const unit = linuxUnitPath()
    await mkdir(join(home, '.config', 'systemd', 'user'), { recursive: true })
    await writeFile(unit, `[Unit]
Description=dsh-lan-assist listen mouth
[Service]
Type=simple
ExecStart=${node} ${script}
Environment=DSH_HOME=${dshHome()}
Environment=DSH_LAN_ASSIST_PORT=${port}
${nats ? `Environment=DSH_LAN_ASSIST_NATS=${nats}` : ''}
${creds ? `Environment=DSH_LAN_ASSIST_NATS_CREDS=${creds}` : ''}
[Install]
WantedBy=default.target
`, 'utf8')
    return { ok: true, path: unit }
  }
  return { ok: false, error: 'NO_AUTOSTART' }
}

export async function removeUserAutostart() {
  try { await unlink(launchdHint()) } catch { /* ignore */ }
  try { await unlink(linuxUnitPath()) } catch { /* ignore */ }
  try { await unlink(windowsStartupPath()) } catch { /* ignore */ }
}
