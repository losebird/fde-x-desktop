/**
 * Cross-machine DSH session handoff pack.
 * Transcript of human and assistant text plus files the human picked.
 * Never tool cards, never the sender disk, never a live fork.
 * @module dsh-lan-assist/handoff
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { replaceFile } from './disk.js'
import { basename, extname, join, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ATTACH_MAX_BYTES } from './home.js'
import { takeAssistantText } from './draft.js'
import { folderName } from './dock.js'
import { messageIdOf, requestIdOf } from './conversation.js'

export const HANDOFF_MIME = 'application/vnd.dsh.handoff+json'
export const HANDOFF_NAME = 'dsh-handoff.json'
export const HANDOFF_VERSION = 1
export const HANDOFF_MAX_TURNS = 400
export const HANDOFF_TURN_CHARS = 8000
export const HANDOFF_PACK_CHARS = 400000
export const HANDOFF_EXCERPT = 240
export const HANDOFF_MAX_PICKS = 80
export const HANDOFF_WALK_MAX = 400
export const HANDOFF_WALK_DEPTH = 4

const SKIP_DIR = new Set([
  'node_modules', '.git', '.dsh', 'dist', 'coverage', 'output',
  '.tmp-npm', '.playwright-cli', 'vendor', '.next', 'tmp',
])

const SKIP = /Current runtime context|system-reminder|available_skills|<goal_round>|<skill_content>|Compactions remaining/

export function isHandoffItem(item) {
  if (!item || typeof item !== 'object') return false
  if (String(item.mime || '') === HANDOFF_MIME) return true
  return String(item.name || '') === HANDOFF_NAME
}

export function clipText(text, n) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  const cap = Number(n) > 0 ? Number(n) : HANDOFF_EXCERPT
  return s.length <= cap ? s : `${s.slice(0, cap)}…`
}

export function decodeAttachData(data) {
  const raw = String(data || '')
  if (!raw) return ''
  const trimmed = raw.trim()
  if (trimmed[0] === '{' || trimmed[0] === '[') return trimmed
  try {
    return Buffer.from(trimmed, 'base64').toString('utf8')
  } catch {
    return raw
  }
}

function userText(event) {
  if (!event || event.type !== 'user/message') return ''
  const data = event.data || {}
  const source = data.source || {}
  if (source.kind && source.kind !== 'user') return ''
  if (source.plugin) return ''
  const blocks = Array.isArray(data.content) ? data.content : []
  const parts = []
  for (const block of blocks) {
    if (block && block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  const text = parts.join('\n').trim()
  if (!text || SKIP.test(text) || text.startsWith('/')) return ''
  return text
}

function clipTurn(text) {
  const s = String(text || '').trim()
  if (s.length <= HANDOFF_TURN_CHARS) return s
  return `${s.slice(0, HANDOFF_TURN_CHARS)}…`
}

export function packFromEvents(events, meta) {
  const rows = Array.isArray(events) ? events : []
  const turns = []
  for (const event of rows) {
    const user = userText(event)
    if (user) {
      turns.push({ role: 'user', text: clipTurn(user) })
      continue
    }
    const assistant = takeAssistantText(event)
    if (assistant) turns.push({ role: 'assistant', text: clipTurn(assistant) })
  }
  let truncated = turns.length > HANDOFF_MAX_TURNS
  const kept = truncated ? turns.slice(-HANDOFF_MAX_TURNS) : turns
  const title = clipText((meta && meta.title) || firstUser(kept), 80) || '交接包'
  const workspace = folderName((meta && meta.workspace) || '')
  const pack = {
    v: HANDOFF_VERSION,
    kind: 'handoff',
    title,
    workspace,
    at: Number((meta && meta.at) || Date.now()) || Date.now(),
    turns: kept,
    excerpt: excerptOfTurns(kept),
    truncated,
  }
  const json = JSON.stringify(pack)
  if (json.length > HANDOFF_PACK_CHARS) {
    const slim = kept.slice(-Math.max(8, Math.floor(kept.length / 2)))
    pack.turns = slim
    pack.excerpt = excerptOfTurns(slim)
    pack.truncated = true
  }
  return pack
}

function firstUser(turns) {
  const hit = (turns || []).find((row) => row && row.role === 'user' && row.text)
  return hit ? hit.text : ''
}

function excerptOfTurns(turns) {
  const rows = (turns || []).slice(-2)
  return clipText(rows.map((row) => row && row.text).filter(Boolean).join(' / '), HANDOFF_EXCERPT)
}

function lastOf(turns, role) {
  const rows = Array.isArray(turns) ? turns : []
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i]
    if (row && row.role === role && row.text) return row.text
  }
  return ''
}

export function digestOf(pack, files) {
  const turns = (pack && pack.turns) || []
  const title = clipText((pack && pack.title) || firstUser(turns), 80) || '交接包'
  const asked = clipText(lastOf(turns, 'user'), 160)
  const done = clipText(lastOf(turns, 'assistant'), 160)
  const n = turns.length
  const ws = String((pack && pack.workspace) || '').trim()
  const names = fileNamesOf(files)
  const lines = [`交接 · ${title}`]
  const meta = [ws ? `工作区 ${ws}` : '', n ? `${n} 轮` : ''].filter(Boolean).join(' · ')
  if (meta) lines.push(meta)
  if (asked) lines.push(`在问：${asked}`)
  if (done) lines.push(`做到哪了：${done}`)
  if (names.length) lines.push(`文件：${names.join('、')}`)
  if (pack && pack.truncated) lines.push('全文有截断，以附件为准。')
  return lines.join('\n')
}

export function toAttach(pack) {
  const json = JSON.stringify(pack && typeof pack === 'object' ? pack : {})
  const data = Buffer.from(json, 'utf8').toString('base64')
  return {
    name: HANDOFF_NAME,
    mime: HANDOFF_MIME,
    size: Buffer.byteLength(json, 'utf8'),
    data,
  }
}

export function parsePack(raw) {
  const text = decodeAttachData(raw)
  if (!text) return null
  let row
  try {
    row = JSON.parse(text)
  } catch {
    return null
  }
  if (!row || typeof row !== 'object') return null
  if (Number(row.v) !== HANDOFF_VERSION) return null
  if (row.kind !== 'handoff') return null
  const turns = Array.isArray(row.turns)
    ? row.turns.map((item) => {
      const role = item && item.role === 'assistant' ? 'assistant' : 'user'
      const text = clipTurn(item && item.text)
      return text ? { role, text } : null
    }).filter(Boolean)
    : []
  if (!turns.length) return null
  return {
    v: HANDOFF_VERSION,
    kind: 'handoff',
    title: clipText(row.title, 80) || '交接包',
    workspace: folderName(row.workspace || ''),
    at: Number(row.at) || 0,
    turns,
    excerpt: clipText(row.excerpt, HANDOFF_EXCERPT) || excerptOfTurns(turns),
    truncated: !!row.truncated,
  }
}

export function publicPack(pack) {
  if (!pack) return null
  return {
    title: pack.title || '交接包',
    excerpt: pack.excerpt || '',
    workspace: pack.workspace || '',
    turns: Number((pack.turns && pack.turns.length) || pack.turnCount || 0),
    truncated: !!pack.truncated,
  }
}

export function fileNamesOf(list) {
  return (Array.isArray(list) ? list : [])
    .filter((item) => item && !isHandoffItem(item))
    .map((item) => String(item.name || '').trim())
    .filter(Boolean)
}

export function absCwd(cwd) {
  const s = String(cwd || '').trim()
  if (!s) return ''
  if (s.startsWith('/')) return s
  if (/^[A-Za-z]:[\\/]/.test(s)) return s
  return ''
}

export function routeOf(agent) {
  const options = agent && agent.options
  const provider = String((options && options.provider) || '').trim()
  const model = String((options && options.model) || '').trim()
  if (!provider || !model) return null
  const header = agent.session && agent.session.header
  return {
    provider,
    model,
    agentPreset: header && header.agentPreset ? String(header.agentPreset) : '',
  }
}

export function seedEventsOf(pack, route) {
  const provider = String((route && route.provider) || '').trim()
  const model = String((route && route.model) || '').trim()
  const rows = (pack && pack.turns) || []
  const time = Math.floor(Number((pack && pack.at) || Date.now()) || Date.now())
  const events = []
  let seq = 0
  let turn = 0
  let open = false
  function push(type, data, extra) {
    const row = { type, seq, time, data }
    seq += 1
    if (extra) Object.assign(row, extra)
    events.push(row)
  }
  function closeTurn() {
    if (!open) return
    push('turn/end', { turn, reason: { kind: 'completed' } })
    open = false
  }
  for (const item of rows) {
    const text = item && item.text ? String(item.text) : ''
    if (!text) continue
    if (item.role === 'assistant') {
      if (!provider || !model) continue
      if (!open) {
        turn += 1
        push('turn/start', { turn })
        open = true
      }
      const step = 1
      push('step/start', { turn, step })
      push('assistant/message', {
        turn,
        step,
        message: {
          id: randomUUID(),
          role: 'assistant',
          content: [{ type: 'text', text }],
          source: { kind: 'model', provider, model },
        },
      }, { surfaceOp: 'append' })
      push('step/end', { turn, step })
      closeTurn()
      continue
    }
    closeTurn()
    turn += 1
    push('turn/start', { turn })
    open = true
    push('user/message', {
      id: randomUUID(),
      role: 'user',
      content: [{ type: 'text', text }],
      source: { kind: 'user' },
    }, { surfaceOp: 'append' })
  }
  closeTurn()
  return events
}

export function speakPackMiss() {
  return '这次会话还没有可交接的人话。工具卡不会带上。'
}

export function speakNoSession() {
  return '这条对话还没绑上，不能交接。'
}

export function speakNoHandoff() {
  return '这封不是交接包。'
}

export function speakPacked() {
  return '已附上全文。勾下面项目里的文件，点发送才寄。工具卡和磁盘不会带上。'
}

export function mentionedPaths(turns) {
  const text = (Array.isArray(turns) ? turns : []).map((row) => row && row.text).filter(Boolean).join('\n')
  const out = []
  const seen = new Set()
  const re = /(?:^|[\s`'"(=[])((?:[\w.-]+\/)*[\w.-]+\.[A-Za-z][A-Za-z0-9]{0,7})/g
  let hit
  while ((hit = re.exec(text))) {
    const path = String(hit[1] || '').replace(/^\.\//, '')
    if (!path || path.includes('..') || path.startsWith('/') || seen.has(path)) continue
    seen.add(path)
    out.push(path)
  }
  return out
}

export function resolveUnder(cwd, rel) {
  const root = resolve(String(cwd || ''))
  const name = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '')
  if (!root || !name || name.includes('\0')) return ''
  const parts = name.split('/').filter(Boolean)
  if (!parts.length || parts.some((part) => part === '..' || part === '.')) return ''
  const full = resolve(root, parts.join('/'))
  const prefix = root.endsWith(sep) ? root : root + sep
  if (full !== root && !full.startsWith(prefix)) return ''
  return full
}

function mimeOf(path) {
  const ext = extname(String(path || '')).toLowerCase()
  if (ext === '.md' || ext === '.markdown') return 'text/markdown'
  if (ext === '.json') return 'application/json'
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return 'text/javascript'
  if (ext === '.ts' || ext === '.tsx') return 'text/plain'
  if (ext === '.css') return 'text/css'
  if (ext === '.html' || ext === '.htm') return 'text/html'
  if (ext === '.txt' || ext === '.log' || ext === '.yml' || ext === '.yaml') return 'text/plain'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.svg') return 'image/svg+xml'
  return 'application/octet-stream'
}

export async function listPicks(cwd, mentioned) {
  const root = resolve(String(cwd || ''))
  if (!root) return []
  const hits = []
  const seen = new Set()
  async function add(rel) {
    if (hits.length >= HANDOFF_MAX_PICKS) return
    const key = String(rel || '').replace(/\\/g, '/')
    if (!key || seen.has(key)) return
    const full = resolveUnder(root, key)
    if (!full) return
    let info
    try { info = await stat(full) } catch { return }
    if (!info.isFile() || info.size <= 0 || info.size > ATTACH_MAX_BYTES) return
    seen.add(key)
    hits.push({ path: key, name: basename(key), size: info.size })
  }
  for (const rel of mentioned || []) await add(rel)
  let walked = 0
  async function walk(dir, prefix, depth) {
    if (hits.length >= HANDOFF_MAX_PICKS || walked > HANDOFF_WALK_MAX || depth > HANDOFF_WALK_DEPTH) return
    let names
    try { names = await readdir(dir) } catch { return }
    names.sort()
    for (const name of names) {
      if (hits.length >= HANDOFF_MAX_PICKS) return
      if (!name || name.startsWith('.') || SKIP_DIR.has(name)) continue
      walked += 1
      const full = join(dir, name)
      let info
      try { info = await stat(full) } catch { continue }
      const rel = prefix ? `${prefix}/${name}` : name
      if (info.isDirectory()) {
        await walk(full, rel, depth + 1)
        continue
      }
      if (info.isFile()) await add(rel)
    }
  }
  await walk(root, '', 0)
  return hits
}

export function groupPicks(picks) {
  const bags = new Map()
  for (const row of Array.isArray(picks) ? picks : []) {
    const path = String((row && row.path) || '').replace(/\\/g, '/')
    if (!path) continue
    const cut = path.lastIndexOf('/')
    const dir = cut < 0 ? '' : path.slice(0, cut)
    const name = String((row && row.name) || (cut < 0 ? path : path.slice(cut + 1)))
    const list = bags.get(dir) || []
    list.push({
      path,
      name,
      size: Number((row && row.size) || 0),
    })
    bags.set(dir, list)
  }
  return [...bags.keys()].sort((a, b) => {
    if (!a) return -1
    if (!b) return 1
    return a < b ? -1 : a > b ? 1 : 0
  }).map((dir) => ({
    dir,
    rows: bags.get(dir).slice().sort((a, b) => String(a.name).localeCompare(String(b.name))),
  }))
}

export async function readPick(cwd, rel) {
  const full = resolveUnder(cwd, rel)
  if (!full) return { ok: false, error: 'BAD_PATH', hint: '只能勾这个工作区里的文件。' }
  let info
  try { info = await stat(full) } catch { return { ok: false, error: 'NO_FILE', hint: '没有这个文件。' } }
  if (!info.isFile()) return { ok: false, error: 'NO_FILE', hint: '没有这个文件。' }
  if (info.size > ATTACH_MAX_BYTES) {
    return { ok: false, error: 'ATTACH_OVER', hint: '有附件超过单件 200MB，不能发出。禁止截断当成功。' }
  }
  const buf = await readFile(full)
  const path = String(rel || '').replace(/\\/g, '/')
  return {
    ok: true,
    attach: {
      name: basename(full),
      path,
      mime: mimeOf(full),
      size: buf.length,
      data: buf.toString('base64'),
    },
  }
}

function isAssistPrivate(rel) {
  const path = String(rel || '').replace(/\\/g, '/')
  if (basename(path) === 'secrets.json') return true
  const parts = path.split('/').filter(Boolean)
  if (!parts.includes('.dsh')) return false
  return !path.includes('.dsh/lan-assist/inbox-copies/')
}

export async function writePick(cwd, rel, text) {
  const full = resolveUnder(cwd, rel)
  if (!full) return { ok: false, error: 'BAD_PATH', hint: '只能改这个工作区里的文件。' }
  if (isAssistPrivate(rel) || basename(full) === 'secrets.json') {
    return { ok: false, error: 'PATH', hint: '不能改协助内部文件。' }
  }
  const body = String(text ?? '')
  if (Buffer.byteLength(body, 'utf8') > ATTACH_MAX_BYTES) {
    return { ok: false, error: 'TOO_BIG', hint: '超过单件上限，不能截断当成功。' }
  }
  let info
  try { info = await stat(full) } catch {
    return { ok: false, error: 'NO_FILE', hint: '工作区没有这个文件。' }
  }
  if (!info.isFile()) return { ok: false, error: 'NO_FILE', hint: '工作区没有这个文件。' }
  await replaceFile(full, body)
  return { ok: true, path: String(rel || '').replace(/\\/g, '/') }
}

/**
 * @param {object} bag
 */
export function createHandoff(bag) {
  const {
    readSession, store, now, snapshot, note, attach,
  } = bag

  async function packSession(sessionId) {
    const sid = String(sessionId || '').trim()
    if (!sid) return { ok: false, error: 'NO_SESSION', hint: speakNoSession() }
    if (typeof readSession !== 'function') {
      return { ok: false, error: 'NO_SESSION', hint: speakNoSession() }
    }
    let live
    try {
      live = await readSession(sid)
    } catch (error) {
      return { ok: false, error: 'NO_SESSION', hint: error instanceof Error ? error.message : speakNoSession() }
    }
    if (!live || !Array.isArray(live.events)) {
      return { ok: false, error: 'NO_SESSION', hint: speakNoSession() }
    }
    const pack = packFromEvents(live.events, {
      title: live.title,
      workspace: live.cwd || '',
      at: typeof now === 'function' ? now() : Date.now(),
    })
    if (!pack.turns.length) {
      return { ok: false, error: 'EMPTY_HANDOFF', hint: speakPackMiss() }
    }
    const picks = live.cwd ? await listPicks(live.cwd, mentionedPaths(pack.turns)) : []
    return {
      ok: true,
      pack: publicPack(pack),
      attach: toAttach(pack),
      title: pack.title,
      excerpt: pack.excerpt,
      letter: digestOf(pack),
      picks,
      hint: speakPacked(),
    }
  }

  async function pickFile(sessionId, path) {
    const sid = String(sessionId || '').trim()
    if (!sid) return { ok: false, error: 'NO_SESSION', hint: speakNoSession() }
    if (typeof readSession !== 'function') {
      return { ok: false, error: 'NO_SESSION', hint: speakNoSession() }
    }
    let live
    try {
      live = await readSession(sid)
    } catch (error) {
      return { ok: false, error: 'NO_SESSION', hint: error instanceof Error ? error.message : speakNoSession() }
    }
    if (!live || !live.cwd) return { ok: false, error: 'NO_SESSION', hint: speakNoSession() }
    return readPick(live.cwd, path)
  }

  async function loadPack(requestId) {
    requestId = requestIdOf(requestId)
    const state = await store.get()
    const req = state.requests[requestId]
    if (!req) return { ok: false, error: 'NO_REQUEST' }
    const list = req.attachments || []
    const index = list.findIndex(isHandoffItem)
    if (index < 0) return { ok: false, error: 'NO_HANDOFF', hint: speakNoHandoff(), req }
    const data = attach && typeof attach.bytesOf === 'function'
      ? await attach.bytesOf(list[index])
      : String((list[index] && (list[index].data || list[index].bytes)) || '')
    const pack = parsePack(data)
    if (!pack) return { ok: false, error: 'NO_HANDOFF', hint: speakNoHandoff(), req }
    return { ok: true, pack, req, files: list }
  }

  async function readPack(requestId) {
    const got = await loadPack(requestId)
    if (!got.ok) return { ok: false, error: got.error, hint: got.hint }
    return {
      ok: true,
      pack: got.pack,
      files: fileNamesOf(got.files),
      adopted: !!got.req.adopted,
      requestId: got.req.id,
      messageId: messageIdOf(got.req.id, 'v1'),
    }
  }

  async function continueHandoff({ requestId, sessionId, workspace, messageId }) {
    requestId = requestIdOf(messageId || requestId)
    const sid = String(sessionId || '').trim()
    if (!sid) return { ok: false, error: 'NO_SESSION', hint: speakNoSession() }
    const got = await loadPack(requestId)
    if (!got.ok) return { ok: false, error: got.error, hint: got.hint, ...(await snapshot()) }
    const req = got.req
    if (req.adopted) {
      return {
        ok: false,
        error: 'ALREADY_ADOPTED',
        hint: '已经调度进会话。点过头不是过账。',
        ...(await snapshot()),
      }
    }
    const cwd = String(workspace || req.workspace || '').trim()
    await store.update((s) => {
      const row = s.requests[requestId]
      if (!row) return
      row.adopted = true
      row.held = false
      row.sessionId = sid
      cwd && (row.workspace = cwd)
      row.updatedAt = typeof now === 'function' ? now() : Date.now()
      s.liveOpening = { id: `handoff:${requestId}`, sessionId: sid, at: row.updatedAt }
      note(s, `交接领进会话 · ${requestId}`)
    })
    return {
      ok: true,
      sessionId: sid,
      ...(await snapshot()),
    }
  }

  return { packSession, pickFile, readPack, continueHandoff }
}
