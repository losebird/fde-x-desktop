/**
 * One workspace search sheet. Browser reads GET /api/v1/search only.
 * Hosts stay behind this overlay. Hits share { kind, id, title, hint, href }.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { letterHome, localCwdSet, normalizeCwd } from '../vendor-overlays/dsh-lan-assist/letter-home.js'
import { listWorkspaces } from '../db.mjs'
import { collectBag } from '../catalog-collect.mjs'
import { classifyHitId, hitId, instanceOriginOf, originOfCard, sessionIdOf } from '../memory/identity.mjs'
import { imHrefFromRequest, originHref } from '../memory/origin-href.mjs'
import { KIND_CAP, KIND_ORDER, PAGE_CATALOG } from '../host-catalog.mjs'

export { KIND_CAP, KIND_ORDER, PAGE_CATALOG }

const SKIP_DIR_NAMES = new Set(['.git', 'node_modules'])
const FILE_WALK_MS = 1500
const FILE_WALK_MAX = 4000
const FILE_CONTENT_MAX = 256 * 1024
const EMPTY_KINDS = new Set(['page', 'contact', 'group', 'agent', 'session'])

export function hay(value) {
  return String(value || '').toLowerCase()
}

export function matches(text, query) {
  const q = hay(query).trim()
  if (!q) return true
  return hay(text).includes(q)
}

export function scoreText(text, query, base = 0) {
  const q = hay(query).trim()
  if (!q) return base
  const h = hay(text)
  if (h === q) return 100 + base
  if (h.startsWith(q)) return 80 + base
  if (h.includes(q)) return 60 + base
  return base
}

function sameCwd(left, right) {
  return normalizeCwd(left) === normalizeCwd(right)
}

function isPrimarySession(row) {
  return row && row.origin !== 'subagent' && !row.parentSessionId
}

function hitKey(hit) {
  return `${hit.kind}:${hit.id}`
}

function put(bag, hit) {
  if (!hit || !hit.kind || !hit.id) return
  const key = hitKey(hit)
  const prev = bag.get(key)
  if (!prev || Number(hit.score || 0) > Number(prev.score || 0)) bag.set(key, hit)
}

function sessionIdFromFind(row) {
  return sessionIdOf(hitId(row))
}

function cardOriginIndex(cards) {
  const map = new Map()
  for (const card of Array.isArray(cards) ? cards : []) {
    const id = String(card?.id || '')
    const origin = originOfCard(card)
    if (id && origin) map.set(origin, id)
  }
  return map
}

function findRows(data) {
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.excerpts)) return data.excerpts
  if (Array.isArray(data.hits)) return data.hits
  if (Array.isArray(data.results)) return data.results
  return []
}

function asText(value) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    if (typeof value.label === 'string') return value.label
    if (typeof value.content === 'string') return value.content
  }
  return ''
}

function findSnippet(row) {
  const node = row && row.node && typeof row.node === 'object' ? row.node : {}
  return asText(row && (row.snippet || row.excerpt || row.text || row.content))
    || asText(node.content)
    || asText(row && row.then)
    || ''
}

function letterText(req) {
  if (!req || typeof req !== 'object') return ''
  const parts = [req.body, req.excerpt, req.last, req.fromName]
  for (const row of Array.isArray(req.versions) ? req.versions : []) parts.push(row && row.body)
  for (const row of Array.isArray(req.replies) ? req.replies : []) parts.push(row && row.body)
  for (const row of Array.isArray(req.messages) ? req.messages : []) parts.push(row && (row.body || row.text))
  return parts.filter(Boolean).join('\n')
}

function workspaceCwdOf(row) {
  const meta = row && row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const raw = typeof meta.cwd === 'string' ? meta.cwd : typeof meta.path === 'string' ? meta.path : ''
  return normalizeCwd(raw)
}

function workspaceRowForCwd(db, cwd) {
  const want = normalizeCwd(cwd)
  if (!want || !db) return null
  for (const row of listWorkspaces(db)) {
    if (workspaceCwdOf(row) === want || String(row.id) === want) return row
  }
  return null
}

function localCwdsFromDb(db) {
  if (!db) return []
  return listWorkspaces(db).map(workspaceCwdOf).filter(Boolean)
}

function loadIgnoreNames(cwd) {
  const names = new Set(SKIP_DIR_NAMES)
  return readFile(join(cwd, '.gitignore'), 'utf8').then((text) => {
    for (const line of String(text || '').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue
      if (trimmed.includes('*')) continue
      const name = trimmed.replace(/\/$/u, '')
      if (name && !name.includes('/')) names.add(name)
    }
    return names
  }).catch(() => names)
}

function looksBinary(buffer) {
  const slice = buffer.subarray(0, Math.min(buffer.length, 800))
  return slice.includes(0)
}

export async function collectFileHits(cwd, query, opts = {}) {
  const q = String(query || '').trim()
  const root = normalizeCwd(cwd)
  if (!q || !root) return []
  const started = Date.now()
  const budget = Number(opts.budgetMs) > 0 ? Number(opts.budgetMs) : FILE_WALK_MS
  const ignore = opts.ignoreNames || await loadIgnoreNames(root)
  const paths = []

  async function walk(dir, rel) {
    if (Date.now() - started > budget || paths.length >= FILE_WALK_MAX) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (Date.now() - started > budget || paths.length >= FILE_WALK_MAX) return
      const name = entry.name
      if (ignore.has(name)) continue
      const childRel = rel ? `${rel}/${name}` : name
      const full = join(dir, name)
      if (entry.isDirectory()) {
        await walk(full, childRel)
        continue
      }
      if (entry.isFile()) paths.push(childRel)
    }
  }

  await walk(root, '')
  const hits = []
  const named = new Set()
  for (const path of paths) {
    const base = path.split('/').pop() || path
    if (!matches(path, q) && !matches(base, q)) continue
    named.add(path)
    hits.push({
      kind: 'file',
      id: path,
      title: base,
      hint: path === base ? 'file' : path,
      href: { panel: 'files', path, ...(opts.sessionId ? { sessionId: opts.sessionId } : {}) },
      score: Math.max(scoreText(base, q, 20), scoreText(path, q)),
    })
  }
  if (q.length < 2) return hits
  for (const path of paths) {
    if (named.has(path)) continue
    if (Date.now() - started > budget) break
    const full = join(root, path)
    let info
    try {
      info = await stat(full)
    } catch {
      continue
    }
    if (!info.isFile() || info.size <= 0 || info.size > FILE_CONTENT_MAX) continue
    let buf
    try {
      buf = await readFile(full)
    } catch {
      continue
    }
    if (looksBinary(buf)) continue
    const text = buf.toString('utf8')
    if (!matches(text, q)) continue
    const base = path.split('/').pop() || path
    hits.push({
      kind: 'file',
      id: path,
      title: base,
      hint: path,
      href: { panel: 'files', path, ...(opts.sessionId ? { sessionId: opts.sessionId } : {}) },
      score: 40,
    })
  }
  return hits
}

export function searchSheet(bags = {}) {
  const query = String(bags.query || '')
  const cwd = normalizeCwd(bags.cwd)
  const q = query.trim()
  const empty = !q
  const bag = new Map()
  const allow = (kind) => !empty || EMPTY_KINDS.has(kind)

  if (allow('page')) {
    for (const page of PAGE_CATALOG) {
      if (!matches(page.title, q)) continue
      put(bag, {
        kind: 'page',
        id: page.id,
        title: page.title,
        href: { ...page.href },
        score: empty ? 10 : scoreText(page.title, q),
      })
    }
  }

  if (allow('session')) {
    const sessions = Array.isArray(bags.sessions) ? bags.sessions : []
    const mine = sessions.filter((row) => isPrimarySession(row) && sameCwd(row.cwd, cwd))
    const byId = new Map(mine.map((row) => [String(row.sessionId), row]))
    for (const row of mine) {
      const title = String(row.title || row.sessionId || '未命名会话')
      if (empty || matches(title, q) || matches(row.sessionId, q)) {
        put(bag, {
          kind: 'session',
          id: String(row.sessionId),
          title,
          hint: empty ? undefined : title,
          href: { panel: 'ai', sessionId: String(row.sessionId) },
          score: empty ? Number(row.updatedAt || 0) : scoreText(title, q, 10),
        })
      }
    }
    if (!empty) {
      for (const row of findRows(bags.find)) {
        const sid = sessionIdFromFind(row)
        if (!sid) continue
        const session = byId.get(sid)
        const snippet = findSnippet(row).replace(/\s+/gu, ' ').trim()
        const title = String((session && session.title) || snippet.slice(0, 40) || sid)
        put(bag, {
          kind: 'session',
          id: sid,
          title,
          hint: snippet.slice(0, 80) || title,
          href: { panel: 'ai', sessionId: sid },
          score: scoreText(`${title}\n${snippet}`, q, 8),
        })
      }
    }
  }

  if (!empty) {
    for (const row of Array.isArray(bags.files) ? bags.files : []) put(bag, row)
  }

  const mailbox = bags.mailbox && typeof bags.mailbox === 'object' ? bags.mailbox : {}
  const selfId = mailbox.self && mailbox.self.id ? String(mailbox.self.id) : ''
  const peers = Array.isArray(mailbox.peers) ? mailbox.peers : []
  const groups = Array.isArray(mailbox.groups) ? mailbox.groups : []
  const requests = Array.isArray(mailbox.requests)
    ? mailbox.requests
    : Object.values(mailbox.requests || {})
  const locals = bags.localCwds || []

  if (allow('contact')) {
    for (const peer of peers) {
      const id = String(peer.id || '')
      if (!id) continue
      const name = String(peer.displayName || peer.name || id)
      const handle = String(peer.door || peer.handle || '')
      if (!matches(name, q) && !matches(handle, q)) continue
      put(bag, {
        kind: 'contact',
        id,
        title: name,
        hint: handle || undefined,
        href: { panel: 'im', peerId: id },
        score: Math.max(scoreText(name, q, 10), scoreText(handle, q)),
      })
    }
  }

  if (allow('group')) {
    for (const group of groups) {
      const id = String(group.id || '')
      if (!id) continue
      const name = String(group.name || id)
      if (!matches(name, q)) continue
      put(bag, {
        kind: 'group',
        id,
        title: name,
        href: { panel: 'im', groupId: id },
        score: scoreText(name, q, 10),
      })
    }
  }

  if (!empty) {
    for (const req of requests) {
      if (!req || req.roster) continue
      const id = String(req.id || '')
      if (!id) continue
      const home = letterHome(req, requests, locals)
      if (home && home !== cwd) continue
      const text = letterText(req)
      if (!matches(text, q) && !matches(req.fromName, q)) continue
      const snippet = String(req.excerpt || req.last || req.body || text).replace(/\s+/gu, ' ').trim()
      put(bag, {
        kind: 'letter',
        id,
        title: snippet.slice(0, 40) || String(req.fromName || id),
        hint: String(req.fromName || ''),
        href: imHrefFromRequest(req, selfId) || { panel: 'im', requestId: id },
        score: scoreText(text, q),
      })
    }
  }

  if (allow('agent')) {
    for (const preset of Array.isArray(bags.presets) ? bags.presets : []) {
      const id = String(preset.id || '')
      if (!id) continue
      const name = String(preset.name || id)
      const desc = String(preset.description || preset.desc || '')
      if (!matches(name, q) && !matches(desc, q)) continue
      put(bag, {
        kind: 'agent',
        id,
        title: name,
        hint: desc || undefined,
        href: { panel: 'ai', agentId: id },
        score: scoreText(`${name}\n${desc}`, q, 10),
      })
    }
  }

  if (!empty) {
    for (const task of Array.isArray(bags.tasks) ? bags.tasks : []) {
      const id = String(task.id || '')
      if (!id) continue
      const title = String(task.title || id)
      if (!matches(title, q) && !matches(task.notes, q)) continue
      put(bag, {
        kind: 'task',
        id,
        title,
        hint: [task.status, task.priority].filter(Boolean).join(' · ') || undefined,
        href: { panel: 'plan', tab: 'todo', taskId: id },
        score: scoreText(title, q),
      })
    }
    for (const wf of Array.isArray(bags.workflows) ? bags.workflows : []) {
      const id = String(wf.id || '')
      if (!id) continue
      const name = String(wf.name || id)
      const desc = String(wf.description || '')
      if (!matches(name, q) && !matches(desc, q)) continue
      put(bag, {
        kind: 'workflow',
        id,
        title: name,
        hint: desc.slice(0, 30) || undefined,
        href: { panel: 'plan', tab: 'workflow' },
        score: scoreText(`${name}\n${desc}`, q),
      })
    }
    const originToCard = cardOriginIndex(bags.cards)
    for (const row of findRows(bags.find)) {
      if (sessionIdFromFind(row)) continue
      const id = hitId(row)
      if (!id) continue
      const snippet = findSnippet(row).replace(/\s+/gu, ' ').trim()
      if (instanceOriginOf(id)) {
        const href = originHref(id, { db: bags.db, mailbox: bags.mailbox }) || classifyHitId(id).href
        const title = snippet.slice(0, 40) || String(row.title || row.then || id)
        put(bag, {
          kind: 'memory',
          id,
          title,
          hint: String(row.title || row.then || ''),
          href: { ...href },
          score: scoreText(`${title}\n${snippet}`, q),
        })
        continue
      }
      const cardId = originToCard.get(id)
      const classified = classifyHitId(cardId || id)
      const landId = classified.cardId || classified.originId || classified.id
      const title = snippet.slice(0, 40) || String(row.title || row.then || landId)
      put(bag, {
        kind: 'memory',
        id: landId,
        title,
        hint: String(row.title || row.then || ''),
        href: { ...classified.href },
        score: scoreText(`${title}\n${snippet}`, q) + (classified.class === 'card' ? 20 : 0),
      })
    }
    for (const skill of Array.isArray(bags.skills) ? bags.skills : []) {
      const id = String(skill.id || skill.name || '')
      if (!id) continue
      const name = String(skill.name || id)
      const desc = String(skill.description || skill.desc || '')
      if (!matches(name, q) && !matches(desc, q)) continue
      put(bag, {
        kind: 'skill',
        id,
        title: name,
        hint: desc || undefined,
        href: { panel: 'skills' },
        score: scoreText(`${name}\n${desc}`, q),
      })
    }
    for (const server of Array.isArray(bags.mcp) ? bags.mcp : []) {
      const id = String(server.serverName || server.id || server.name || '')
      if (!id) continue
      const tools = Array.isArray(server.tools) ? server.tools.join('\n') : ''
      if (!matches(id, q) && !matches(server.command, q) && !matches(server.url, q) && !matches(tools, q)) continue
      put(bag, {
        kind: 'mcp',
        id,
        title: id,
        href: { panel: 'mcp' },
        score: scoreText(`${id}\n${server.command || ''}\n${tools}`, q),
      })
    }
  }

  const ranked = [...bag.values()].sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
  const counts = {}
  const capped = []
  for (const hit of ranked) {
    const n = counts[hit.kind] || 0
    if (n >= KIND_CAP) continue
    counts[hit.kind] = n + 1
    const { score, ...rest } = hit
    capped.push(rest)
  }
  const order = new Map(KIND_ORDER.map((kind, index) => [kind, index]))
  capped.sort((a, b) => (order.get(a.kind) ?? 99) - (order.get(b.kind) ?? 99))
  return { cwd, query, hits: capped }
}

function asSession(item) {
  const values = item?.projections?.values && typeof item.projections.values === 'object'
    ? item.projections.values
    : {}
  const title = typeof values.title === 'string' && values.title.trim() ? values.title : '未命名会话'
  return {
    sessionId: item.sessionId,
    title,
    updatedAt: item.updatedAt,
    cwd: item.cwd,
    origin: item.origin,
    parentSessionId: item.parentSessionId,
    blank: item.blank,
  }
}

async function archivedSessionIds(aiRuntime) {
  if (!aiRuntime || typeof aiRuntime.stream !== 'function') return new Set()
  const abort = new AbortController()
  try {
    for await (const frame of aiRuntime.stream('workspace/follow', {}, abort.signal)) {
      if (frame?.type === 'baseline') {
        abort.abort()
        const ids = Array.isArray(frame.value?.archivedSessionIds) ? frame.value.archivedSessionIds : []
        return new Set(ids)
      }
    }
  } catch {
    /* aborted after baseline */
  }
  return new Set()
}

function swallow(promise) {
  return promise.then((value) => value, () => null)
}

function skillItems(catalog) {
  if (Array.isArray(catalog)) return catalog
  if (catalog && typeof catalog === 'object' && Array.isArray(catalog.items)) return catalog.items
  return []
}

export async function loadSearchSheet(deps, input) {
  const cwd = normalizeCwd(input && input.cwd)
  const query = String((input && input.query) || '')
  const aiRuntime = deps && deps.aiRuntime
  const db = deps && deps.db
  const connected = Boolean(aiRuntime && typeof aiRuntime.status === 'function' && aiRuntime.status().connected)
  const localCwds = localCwdSet(localCwdsFromDb(db))
  const workspace = workspaceRowForCwd(db, cwd)
  const workspaceId = workspace ? String(workspace.id) : ''

  const sessionsP = connected
    ? swallow(Promise.all([
      aiRuntime.call('session/list', { _request: { includeBlank: true } }),
      archivedSessionIds(aiRuntime),
    ]).then(([listed, archived]) => {
      const items = Array.isArray(listed?.items) ? listed.items : []
      return items.map(asSession).filter((row) => row.sessionId && !archived.has(row.sessionId))
    }))
    : Promise.resolve([])

  const mailboxP = connected
    ? swallow(aiRuntime.lanAssist('/state', { search: { sessionId: '' } }))
    : Promise.resolve({})

  const presetsP = connected
    ? swallow(collectBag(aiRuntime, 'agent').then((bag) => bag.items.map((row) => row.fields)))
    : Promise.resolve([])

  const findP = connected && query.trim()
    ? swallow(aiRuntime.semanticOs('/find', { query: query.trim(), cwd }))
    : Promise.resolve(null)

  const cardsP = connected && query.trim()
    ? swallow(aiRuntime.semanticOs('/python', {
      op: 'list_memory_cards',
      args: { include_filed: true, limit: 80 },
      ...(cwd ? { cwd } : {}),
    }).then((payload) => (Array.isArray(payload?.cards) ? payload.cards : [])))
    : Promise.resolve([])

  const preferredSessionId = String((input && input.sessionId) || '').trim()
  const filesP = typeof deps.collectFileHits === 'function'
    ? deps.collectFileHits(cwd, query, { sessionId: preferredSessionId })
    : collectFileHits(cwd, query, { sessionId: preferredSessionId })

  const typed = Boolean(query.trim())
  let tasks = []
  let workflows = []
  if (typed && db && workspaceId) {
    try {
      tasks = db.prepare('SELECT id, title, notes, status, priority FROM tasks WHERE workspace_id = ?').all(workspaceId)
      const rows = db.prepare('SELECT id, name, definition_json FROM workflows WHERE workspace_id = ?').all(workspaceId)
      workflows = rows.map((row) => {
        let description = ''
        try {
          const definition = JSON.parse(row.definition_json || '{}')
          description = String(definition.description || '')
        } catch { /* keep empty */ }
        return { id: row.id, name: row.name, description }
      })
    } catch { /* plan tables optional */ }
  }

  const [sessions, mailbox, presets, find, files, cards] = await Promise.all([
    sessionsP, mailboxP, presetsP, findP, filesP, cardsP,
  ])

  let skills = []
  let mcp = []
  if (typed && connected) {
    const mine = (Array.isArray(sessions) ? sessions : [])
      .filter((row) => isPrimarySession(row) && sameCwd(row.cwd, cwd))
    const preferred = mine.find((row) => row.sessionId === preferredSessionId)
    const sid = preferred?.sessionId
      || [...mine].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0]?.sessionId
    if (sid) {
      const bag = await swallow(collectBag(aiRuntime, 'skill', { sessionId: sid }))
      skills = skillItems(bag?.raw || { items: bag?.items || [] })
    }
    const mcpBag = await swallow(collectBag(aiRuntime, 'mcp', sid
      ? { project: true, sessionId: sid, cwd }
      : { cwd }))
    mcp = Array.isArray(mcpBag?.raw?.mcp) ? mcpBag.raw.mcp : []
  }

  return searchSheet({
    cwd,
    query,
    sessions: Array.isArray(sessions) ? sessions : [],
    mailbox: mailbox && typeof mailbox === 'object' ? mailbox : {},
    presets: Array.isArray(presets) ? presets : [],
    find,
    cards: Array.isArray(cards) ? cards : [],
    files: Array.isArray(files) ? files : [],
    tasks,
    workflows,
    skills,
    mcp,
    localCwds,
    db,
  })
}
