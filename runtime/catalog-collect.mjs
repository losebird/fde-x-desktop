/**
 * One Host catalog bag per kind. Pages filter this bag.
 */
import { surfaceOfKind, SEAM_CATALOG, collectGoals, mutateHostGoal, ORIGIN_DSH_GOAL, ORIGIN_DSH_SCHEDULE, ORIGIN_DSH_JOB, ORIGIN_FDE_TASK } from './host-catalog.mjs'
import { listTypertVerbs, verbsForKind, listMcpResourceToolNames, ensureTypertVerbs } from './catalog-typert.mjs'

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function localizedText(value) {
  if (typeof value === 'string' && value.trim()) return value
  if (!value || typeof value !== 'object') return ''
  if (typeof value.en === 'string' && value.en.trim()) return value.en
  const first = Object.values(value).find((item) => typeof item === 'string' && item.trim())
  return typeof first === 'string' ? first : ''
}

function pluginRows(raw) {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.entries)) return raw.entries
    if (Array.isArray(raw.plugins)) return raw.plugins
    if (Array.isArray(raw.items)) return raw.items
  }
  return []
}

function bundleRows(raw) {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.bundles)) return raw.bundles
    if (Array.isArray(raw.items)) return raw.items
  }
  return []
}

export function rowsFromFaceValue(raw, verb) {
  if (Array.isArray(raw)) return raw
  if (!raw || typeof raw !== 'object') return []
  for (const field of Array.isArray(verb?.resultFields) ? verb.resultFields : []) {
    if (Array.isArray(raw[field])) return raw[field]
  }
  if (Array.isArray(raw.items)) return raw.items
  return []
}

function catalogResultItems(kind, href, raw) {
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.providers)
      ? raw.providers
      : Array.isArray(raw?.presets)
        ? raw.presets
        : Array.isArray(raw?.items)
          ? raw.items
          : []
  return rows.map((row) => {
    const id = String(row?.id || row?.name || row?.ns || '')
    const title = localizedText(row?.name) || localizedText(row?.title) || localizedText(row?.meta?.title) || id
    return {
      kind,
      id,
      title,
      href,
      fields: row && typeof row === 'object' ? row : {},
    }
  }).filter((row) => row.id)
}

async function takeRemoteValue(value) {
  if (!value || typeof value !== 'object') return value
  if (typeof value[Symbol.asyncIterator] !== 'function') return value
  const iter = value[Symbol.asyncIterator]()
  try {
    const first = await iter.next()
    return first.value
  } finally {
    try {
      if (typeof iter.return === 'function') await iter.return()
    } catch {
      /* closed */
    }
  }
}

async function primarySessionIds(aiRuntime, input) {
  const hinted = String(input.sessionId || '')
  if (hinted) return [hinted]
  const cwd = String(input.cwd || '')
  if (!cwd || !aiRuntime || typeof aiRuntime.call !== 'function') return []
  try {
    const listed = await aiRuntime.call('session/list', { _request: { includeBlank: true } })
    const items = Array.isArray(listed) ? listed : (listed && Array.isArray(listed.items) ? listed.items : [])
    const rows = items.filter((row) => row && row.origin !== 'subagent' && !row.parentSessionId && String(row.cwd || '') === cwd)
    rows.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    const bound = rows[0] ? String(rows[0].sessionId || rows[0].id || '') : ''
    return bound ? [bound] : []
  } catch {
    return []
  }
}

function scheduleItems(raw, workspaceId, sessionId) {
  const rows = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : [])
  return rows.map((row) => {
    const bare = String(row?.id || '')
    if (!bare) return null
    const id = `${ORIGIN_DSH_SCHEDULE}${bare}`
    const start = String(row.scheduledAt || '')
    const createdAt = start || new Date().toISOString()
    return {
      kind: 'schedule',
      id,
      title: String(row.title || bare),
      href: { panel: 'plan', tab: 'schedule' },
      fields: {
        id,
        workspaceId,
        sessionId,
        title: String(row.title || bare),
        startAt: createdAt,
        endAt: createdAt,
        timezone: String(row.timeZone || 'Asia/Shanghai'),
        location: null,
        kind: 'reminder',
        sourceRef: id,
        createdAt,
        updatedAt: createdAt,
      },
    }
  }).filter(Boolean)
}

function jobItems(raw, workspaceId, sessionId) {
  const frame = raw && typeof raw === 'object' ? raw : {}
  const rows = Array.isArray(frame.jobs) ? frame.jobs : (Array.isArray(raw) ? raw : [])
  return rows.map((row) => {
    const bare = String(row?.id || '')
    if (!bare) return null
    const id = `${ORIGIN_DSH_JOB}${bare}`
    const running = row.status === 'running' || row.status === 'stopping'
    const createdAt = row.startedAt ? new Date(Number(row.startedAt)).toISOString() : new Date().toISOString()
    return {
      kind: 'job',
      id,
      title: String(row.label || row.kind || bare),
      href: { panel: 'plan', tab: 'workflow' },
      fields: {
        id,
        workspaceId,
        sessionId,
        name: String(row.label || row.kind || bare),
        description: String(row.detail || row.progress || row.kind || ''),
        status: running ? 'active' : 'paused',
        trigger: { kind: 'manual' },
        steps: [],
        category: 'system',
        emoji: '🤖',
        sourceRef: id,
        createdAt,
        updatedAt: row.finishedAt ? new Date(Number(row.finishedAt)).toISOString() : createdAt,
      },
    }
  }).filter(Boolean)
}

function listingEntries(raw) {
  if (!raw || typeof raw !== 'object') return []
  if (Array.isArray(raw.entries)) return raw.entries
  if (Array.isArray(raw.children)) return raw.children
  if (Array.isArray(raw.items)) return raw.items
  if (raw.value && typeof raw.value === 'object') return listingEntries(raw.value)
  return []
}

function fileItems(raw, path) {
  const rel = String(path || '.')
  const entries = listingEntries(raw)
  return entries.map((entry) => {
    const name = String(entry?.name || '')
    const id = rel === '.' ? name : `${rel.replace(/\/$/, '')}/${name}`
    return {
      kind: 'file',
      id,
      title: name,
      href: { panel: 'files', path: id },
      fields: { type: entry?.type, size: entry?.size },
    }
  })
}

export function hostBareId(id) {
  const text = String(id || '')
  const prefixes = [ORIGIN_DSH_GOAL, ORIGIN_DSH_SCHEDULE, ORIGIN_DSH_JOB, ORIGIN_FDE_TASK]
  for (const prefix of prefixes) {
    if (text.startsWith(prefix)) return text.slice(prefix.length)
  }
  return text
}

function bindValue(input, wire) {
  const extras = input.params && typeof input.params === 'object' ? input.params : {}
  if (Object.hasOwn(extras, wire)) return extras[wire]
  if (Object.hasOwn(input, wire)) return input[wire]
  if (wire === 'id' || wire === 'jobId') return input.id ? hostBareId(input.id) : undefined
  return undefined
}

function boundSessionId(input, verb) {
  if (input.sessionId) return String(input.sessionId)
  const wants = (Array.isArray(verb?.requestFields) && verb.requestFields.includes('sessionId'))
    || (Array.isArray(verb?.parameters) && verb.parameters.some((row) => row.wire === 'sessionId'))
  if (wants && input.id) return String(input.id)
  return ''
}

export function argsFromFace(verb, input) {
  const params = Array.isArray(verb?.parameters) ? verb.parameters : []
  const extras = input.params && typeof input.params === 'object' ? { ...input.params } : {}
  const sessionId = boundSessionId(input, verb)
  input = sessionId && !input.sessionId ? { ...input, sessionId } : input
  if (!params.length) return extras
  const args = {}
  for (const row of params) {
    if (row.source === 'lookup') {
      const bound = String(input.sessionId || '')
      if (bound) args[row.wire] = bound
      continue
    }
    if (row.wire === 'request' && extras.request === undefined) {
      const sessionId = String(input.sessionId || '')
      const bare = input.id ? hostBareId(input.id) : ''
      const candidates = {
        ...extras,
        ...(sessionId ? { sessionId } : {}),
        ...(input.path != null ? { path: input.path } : {}),
        ...(bare ? { id: bare, jobId: bare } : {}),
      }
      const allowed = Array.isArray(verb.requestFields) ? verb.requestFields : []
      const request = {}
      if (allowed.length) {
        for (const key of allowed) {
          if (candidates[key] !== undefined && candidates[key] !== '') request[key] = candidates[key]
        }
      } else {
        Object.assign(request, candidates)
      }
      args.request = request
      continue
    }
    const value = bindValue(input, row.wire)
    if (value !== undefined && value !== null && value !== '') args[row.wire] = value
  }
  return args
}

export function faceArgsComplete(verb, input) {
  const params = Array.isArray(verb?.parameters) ? verb.parameters : []
  if (!params.length) return true
  const args = argsFromFace(verb, input)
  for (const row of params) {
    if (row.wire === 'request') continue
    if (args[row.wire] === undefined) return false
  }
  return true
}

function collectVerb(rows, input, match) {
  const hits = rows.filter(match)
  return hits.find((row) => faceArgsComplete(row, input)) || hits[0]
}

export function describeKindVerbs(kind, verbs = listTypertVerbs()) {
  const key = String(kind || '').trim()
  const rows = verbsForKind(key, verbs)
  if (key === 'file') {
    for (const verb of verbsForKind('session', verbs)) {
      const wires = [
        ...(verb.parameters || []).map((row) => row.wire),
        ...(verb.requestFields || []),
      ]
      if (wires.includes('path') && !rows.some((row) => row.endpoint === verb.endpoint)) rows.push(verb)
    }
  }
  return {
    projections: unique(rows.filter((row) => row.role === 'projection').map((row) => row.method)),
    actions: unique(rows.filter((row) => row.role === 'action').map((row) => row.method)),
    lists: unique(rows.filter((row) => row.role === 'list').map((row) => row.endpoint)),
    reads: unique(rows.filter((row) => row.role === 'read').map((row) => row.endpoint)),
    rows,
  }
}

export async function collectBag(aiRuntime, kind, input = {}, verbs) {
  const face = Array.isArray(verbs) ? verbs : await ensureTypertVerbs()
  const key = String(kind || '').trim()
  const surface = surfaceOfKind(key)
  const described = describeKindVerbs(key, face)
  const bag = {
    kind: key,
    href: surface.href,
    seam: surface.seam,
    projections: described.projections,
    actions: described.actions,
    items: [],
    raw: null,
  }
  if (surface.seam !== SEAM_CATALOG && key !== 'session' && key !== 'terminal') return bag
  if (key === 'goal' || key === 'todo') {
    bag.items = await collectGoals(aiRuntime, input)
    return bag
  }
  if (key === 'file') {
    const list = collectVerb(described.rows, input, (row) => row.ns === 'workspaceFiles' && row.method === 'list')
    if (list && input.sessionId && aiRuntime && typeof aiRuntime.call === 'function') {
      bag.raw = await aiRuntime.call(list.endpoint, argsFromFace(list, input))
      bag.items = fileItems(bag.raw, input.path)
    }
    return bag
  }
  if (key === 'skill') {
    const list = collectVerb(described.rows, input, (row) => row.role === 'list')
    if (list && input.sessionId && aiRuntime && typeof aiRuntime.call === 'function') {
      const listed = await aiRuntime.call(list.endpoint, argsFromFace(list, input))
      const rows = rowsFromFaceValue(listed, list)
      const { bundleRootFromPath } = await import('./skill-bundle.mjs')
      bag.items = rows.map((row) => {
        const id = String(row?.name || row?.id || '')
        if (!id) return null
        const fields = row && typeof row === 'object' ? { ...row, origin: 'catalog' } : { origin: 'catalog' }
        if (!fields.name) fields.name = id
        if (!fields.id) fields.id = id
        if (fields.path) fields.bundleRoot = bundleRootFromPath(fields.path)
        return {
          kind: 'skill',
          id,
          title: String(fields.name || id),
          href: { panel: 'skills' },
          fields,
        }
      }).filter(Boolean)
    }
    const listNs = list ? list.ns : ''
    const extraNs = unique(described.rows.map((row) => row.ns).filter((ns) => ns && ns !== listNs))
    const seen = new Set(bag.items.map((row) => row.id))
    for (const ns of extraNs) {
      if (seen.has(ns)) continue
      seen.add(ns)
      const methods = unique(described.rows.filter((row) => row.ns === ns).map((row) => row.method))
      bag.items.push({
        kind: 'skill',
        id: ns,
        title: ns,
        href: { panel: 'skills' },
        fields: { id: ns, name: ns, methods, origin: 'face' },
      })
    }
    bag.raw = { items: bag.items.map((row) => ({ ...(row.fields && typeof row.fields === 'object' ? row.fields : {}), id: row.id, name: row.title })) }
    return bag
  }
  if (key === 'agent') {
    const list = collectVerb(described.rows, input, (row) => row.ns === 'agentPresets' && row.role === 'list')
    if (list && aiRuntime && typeof aiRuntime.call === 'function') {
      bag.raw = await aiRuntime.call(list.endpoint, argsFromFace(list, input))
      const presets = Array.isArray(bag.raw?.presets) ? bag.raw.presets : (Array.isArray(bag.raw) ? bag.raw : [])
      bag.items = presets.map((row) => ({
        kind: 'agent',
        id: String(row?.id || ''),
        title: String(row?.name || row?.id || ''),
        href: { panel: 'ai' },
        fields: row && typeof row === 'object' ? row : {},
      })).filter((row) => row.id)
    }
    return bag
  }
  if (key === 'schedule' || key === 'job') {
    const list = collectVerb(described.rows, input, (row) => row.role === 'list')
    const sids = await primarySessionIds(aiRuntime, input)
    if (list && aiRuntime && typeof aiRuntime.call === 'function') {
      for (const sessionId of sids) {
        try {
          const args = argsFromFace(list, { ...input, sessionId })
          const raw = await takeRemoteValue(
            list.stream && typeof aiRuntime.stream === 'function'
              ? aiRuntime.stream(list.endpoint, args)
              : await aiRuntime.call(list.endpoint, args),
          )
          const mapped = key === 'schedule' ? scheduleItems(raw, input.workspaceId, sessionId) : jobItems(raw, input.workspaceId, sessionId)
          bag.items.push(...mapped)
        } catch {
          /* empty bag for this session */
        }
      }
    }
    return bag
  }
  if (key === 'terminal') {
    const list = collectVerb(described.rows, input, (row) => row.ns === 'terminal' && row.method === 'list')
    if (list && input.sessionId && aiRuntime && typeof aiRuntime.call === 'function') {
      try {
        bag.raw = await aiRuntime.call(list.endpoint, argsFromFace(list, input))
        const rows = Array.isArray(bag.raw) ? bag.raw : (bag.raw?.items || bag.raw?.terminals || [])
        bag.items = rows.map((row, index) => ({
          kind: 'terminal',
          id: String(row?.id || row?.terminalId || index),
          title: String(row?.title || row?.name || row?.id || '终端'),
          href: { panel: 'ai', accessory: 'terminal' },
          fields: row && typeof row === 'object' ? row : {},
        }))
      } catch {
        bag.raw = null
        bag.items = []
      }
    }
    return bag
  }
  if (key === 'workspace') {
    const follow = described.rows.find((row) => row.method === 'follow' && row.stream)
    if (follow && aiRuntime && typeof aiRuntime.stream === 'function') {
      try {
        const frame = await takeRemoteValue(aiRuntime.stream(follow.endpoint, argsFromFace(follow, input)))
        bag.raw = frame
        const value = frame?.type === 'baseline' ? (frame.value || {}) : (frame && typeof frame === 'object' ? frame : {})
        const pins = Array.isArray(value.pinnedSessionIds) ? value.pinnedSessionIds : []
        const archived = Array.isArray(value.archivedSessionIds) ? value.archivedSessionIds : []
        bag.items = [
          ...pins.map((id) => ({
            kind: 'workspace',
            id: String(id),
            title: String(id),
            href: { panel: 'ai' },
            fields: { pinned: true },
          })),
          ...archived.map((id) => ({
            kind: 'workspace',
            id: String(id),
            title: String(id),
            href: { panel: 'ai' },
            fields: { archived: true },
          })),
        ]
      } catch (error) {
        bag.error = error instanceof Error ? error.message : String(error)
      }
    }
    return bag
  }
  if (key === 'settings') {
    const describe = collectVerb(described.rows, input, (row) => row.method === 'describe')
    if (describe && aiRuntime && typeof aiRuntime.call === 'function') {
      try {
        bag.raw = await aiRuntime.call(describe.endpoint, argsFromFace(describe, input))
        const rows = Array.isArray(bag.raw?.namespaces) ? bag.raw.namespaces : []
        bag.items = rows.map((row) => ({
          kind: 'settings',
          id: String(row?.ns || ''),
          title: String(row?.ns || ''),
          href: { panel: 'settings', section: 'core' },
          fields: row && typeof row === 'object' ? row : {},
        })).filter((row) => row.id)
      } catch (error) {
        bag.error = error instanceof Error ? error.message : String(error)
      }
    }
    if (aiRuntime && typeof aiRuntime.call === 'function') {
      const catalogs = {}
      for (const verb of described.rows.filter((row) => row.method === 'catalog' && faceArgsComplete(row, input))) {
        try {
          const raw = await aiRuntime.call(verb.endpoint, argsFromFace(verb, input))
          catalogs[verb.endpoint] = raw
          const extra = catalogResultItems(key, bag.href, raw)
          const seen = new Set(bag.items.map((row) => row.id))
          for (const row of extra) {
            if (seen.has(row.id)) continue
            seen.add(row.id)
            bag.items.push(row)
          }
        } catch {
          /* catalog mouth exists on Face but the plugin is not mounted */
        }
      }
      if (Object.keys(catalogs).length) {
        bag.raw = bag.raw && typeof bag.raw === 'object' ? { ...bag.raw, catalogs } : { catalogs }
      }
    }
    return bag
  }
  if (key === 'plugin') {
    const list = collectVerb(described.rows, input, (row) => row.role === 'list')
      || collectVerb(described.rows, input, (row) => row.method === 'listPlugins')
    if (list && aiRuntime && typeof aiRuntime.call === 'function') {
      try {
        bag.raw = await aiRuntime.call(list.endpoint, argsFromFace(list, input))
        bag.items = pluginRows(bag.raw).map((row) => {
          const id = String(row?.entryId || row?.id || row?.name || row?.moduleName || '')
          if (!id || id === 'include') return null
          const title = localizedText(row?.meta?.title) || String(row?.moduleName || row?.name || id)
          return {
            kind: 'plugin',
            id,
            title,
            href: { panel: 'settings', section: 'core' },
            fields: row && typeof row === 'object' ? row : {},
          }
        }).filter(Boolean)
      } catch (error) {
        bag.raw = null
        bag.items = []
        bag.error = error instanceof Error ? error.message : String(error)
      }
    }
    const bundlesVerb = collectVerb(described.rows, input, (row) => row.method === 'listBundles')
    if (bundlesVerb && aiRuntime && typeof aiRuntime.call === 'function') {
      try {
        const bundles = await aiRuntime.call(bundlesVerb.endpoint, argsFromFace(bundlesVerb, input))
        bag.raw = bag.raw && typeof bag.raw === 'object' ? { inventory: bag.raw, bundles } : { bundles }
        const seen = new Set(bag.items.map((row) => row.id))
        for (const row of bundleRows(bundles)) {
          if (!row || row.optional === false) continue
          const id = String(row.name || row.id || '')
          if (!id || seen.has(id)) continue
          seen.add(id)
          bag.items.push({
            kind: 'plugin',
            id,
            title: localizedText(row.meta?.title) || String(row.name || id),
            href: { panel: 'settings', section: 'core' },
            fields: { ...row, bundle: true, enabled: row.enabled === true },
          })
        }
      } catch (error) {
        if (!bag.error) bag.error = error instanceof Error ? error.message : String(error)
      }
    }
    return bag
  }
  if (key === 'mcp') {
    const {
      buildMcpServersV2,
      listSessionProjectedToolNames,
      readMcpArchiveText,
      resolveMcpProjectionSession,
    } = await import('./routes/mcp.mjs')
    const text = await readMcpArchiveText(aiRuntime)
    const project = Boolean(input && input.project)
    const sessionId = project ? await resolveMcpProjectionSession(aiRuntime, input) : ''
    const projected = (project && sessionId)
      ? await listSessionProjectedToolNames(aiRuntime, sessionId)
      : []
    const mcp = await buildMcpServersV2(aiRuntime, text, projected)
    bag.items = (Array.isArray(mcp) ? mcp : []).map((row) => ({
      kind: 'mcp',
      id: String(row?.serverName || row?.id || ''),
      title: String(row?.serverName || row?.id || ''),
      href: { panel: 'mcp' },
      fields: row && typeof row === 'object' ? row : {},
    })).filter((row) => row.id)
    const resourceTools = listMcpResourceToolNames().filter((name) => projected.includes(name))
    bag.actions = unique([...bag.actions, ...resourceTools])
    bag.raw = {
      mcp: bag.items.map((row) => row.fields),
      resourceTools,
    }
    return bag
  }
  return bag
}

async function sessionIdForBagItem(aiRuntime, kind, input, verbs) {
  const hinted = String(input.sessionId || '')
  if (hinted) return hinted
  const bag = await collectBag(aiRuntime, kind, input, verbs)
  const hit = (bag.items || []).find((row) => row && row.id === input.id)
  return String(hit?.fields?.sessionId || '')
}

export async function mutateBag(aiRuntime, input = {}, verbs) {
  const face = Array.isArray(verbs) ? verbs : await ensureTypertVerbs()
  const kind = String(input.kind || '').trim()
  const action = String(input.action || '').trim()
  if (kind === 'goal' || kind === 'todo') {
    return mutateHostGoal(aiRuntime, input)
  }
  const described = describeKindVerbs(kind, face)
  if (!aiRuntime || typeof aiRuntime.call !== 'function') throw new Error('核心未接通')
  let sessionId = String(input.sessionId || '')
  if (!sessionId && (kind === 'schedule' || kind === 'job')) {
    sessionId = await sessionIdForBagItem(aiRuntime, kind, input, face)
    if (!sessionId) throw new Error('当前工作区没有这条')
  }
  const next = sessionId ? { ...input, sessionId } : input
  const verb = collectVerb(described.rows, next, (row) => row.method === action)
  if (!verb) throw new Error('Host 没有这个动作')
  if (verb.stream) throw new Error('Host 这个动作是流')
  const args = argsFromFace(verb, next)
  if (verb.result === 'bytes') {
    const { readFaceBytes } = await import('./files-bytes.mjs')
    const mutation = await readFaceBytes(aiRuntime, verb, next)
    return { kind, href: surfaceOfKind(kind).href, seam: surfaceOfKind(kind).seam, projections: [], actions: [], items: [], raw: null, mutation }
  }
  const mutation = await aiRuntime.call(verb.endpoint, args)
  const bag = await collectBag(aiRuntime, kind, next, face)
  bag.mutation = mutation
  return bag
}

export async function* streamBag(aiRuntime, input = {}, verbs) {
  const face = Array.isArray(verbs) ? verbs : await ensureTypertVerbs()
  const kind = String(input.kind || '').trim()
  const action = String(input.action || '').trim()
  const described = describeKindVerbs(kind, face)
  const verb = collectVerb(described.rows, input, (row) => row.method === action && row.stream)
  if (!verb || !verb.stream) throw new Error('Host 没有这个流')
  if (!aiRuntime || typeof aiRuntime.stream !== 'function') throw new Error('核心未接通')
  const sessionId = String(input.sessionId || '')
  yield* aiRuntime.stream(verb.endpoint, argsFromFace(verb, { ...input, sessionId }), input.signal)
}
