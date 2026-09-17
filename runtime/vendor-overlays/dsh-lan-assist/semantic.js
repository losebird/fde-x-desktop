/**
 * Talk to dsh-semantic-os over same-origin /semantic-os.
 * This plugin never stores a second decision ledger.
 * @module dsh-lan-assist/semantic
 */

import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { dshHome } from './home.js'
import { kindsFromGraphNodes } from './write.js'

export function looksLikeChoice(text) {
  const s = String(text || '')
  if (!s.trim()) return false
  if (/什么意思|啥意思|理解成|看成是|当成是|是不是说|什么叫/.test(s)) return false
  // Capability questions are not boards. 「能不能做成/发版」still counts.
  if (/能不能做到|能不能当|能不能用上|能不能记住|交接得了|是否可以|有没有可能/.test(s)) return false
  return /要不要|该不该|还是只|选哪个|拍板|定了|按他说|先切|发不发|同不同意|可否|能不能/.test(s)
}

export { looksLikeBusiness, looksLikeChase, looksLikeNudge } from './probe.js'

const SKIP_SPEECH = /Current runtime context|system-reminder|available_skills|<goal_round>|<skill_content>|Compactions remaining/
const MAX_SPEECH = 400

export function extractUserSpeech(event) {
  if (!event || event.type !== 'user/message') return ''
  const data = event.data || {}
  const source = data.source || {}
  if (source.kind && source.kind !== 'user') return ''
  if (source.plugin === 'dsh-lan-assist') return ''
  const blocks = Array.isArray(data.content) ? data.content : []
  const parts = []
  for (const block of blocks) {
    if (block && block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  const text = parts.join('\n').trim()
  if (!text || text.length > MAX_SPEECH) return ''
  if (SKIP_SPEECH.test(text)) return ''
  if (text.startsWith('/')) return ''
  return text
}

export function hasCausalChain(row) {
  if (!row || typeof row !== 'object') return false
  const n = (value) => {
    const x = Number(value)
    return Number.isFinite(x) && x > 0
  }
  if (n(row.supports) || n(row.leads_to) || n(row.leadsTo)) return true
  const causal = row.causal
  if (causal && typeof causal === 'object' && (n(causal.supports) || n(causal.leads_to))) return true
  if ((Array.isArray(row.upstream) && row.upstream.length) || (Array.isArray(row.downstream) && row.downstream.length)) return true
  return Array.isArray(row.chain) && row.chain.length > 0
}

export function packAdvice(brief, scenario) {
  const rawBecause = Array.isArray(brief && brief.because)
    ? brief.because.map((id) => String(id || '').trim()).filter(Boolean)
    : []
  const rawEvidence = Array.isArray(brief && brief.evidence) ? brief.evidence.slice(0, 6) : []
  const rawPrecedents = Array.isArray(brief && brief.precedents) ? brief.precedents.slice(0, 3) : []
  const rawDrafts = Array.isArray(brief && brief.drafts) ? brief.drafts.slice(0, 5) : []
  const evidence = rawEvidence.filter((row) => relatedToScenario(row.snippet || row.id, scenario))
  const precedents = rawPrecedents.filter((row) => relatedToScenario(row.scenario || row.outcome || row.id, scenario))
  const drafts = rawDrafts.filter((row) => relatedToScenario(row.scenario || row.outcome || row.id, scenario))
  const chained = precedents.concat(drafts).filter((row) => hasCausalChain(row))
  const keep = new Set()
  for (const row of evidence.concat(chained)) {
    const id = String(row.id || '').trim()
    if (id) keep.add(id)
  }
  const because = rawBecause.filter((id) => keep.has(id) || relatedToScenario(id, scenario))
  for (const row of chained) {
    const id = String(row.id || '').trim()
    if (id && !because.includes(id)) because.push(id)
  }
  const lines = []
  if (evidence.length) {
    lines.push('图里相关：' + evidence.map((row) => clip(row.snippet || row.id, 36)).join('；'))
  }
  if (chained.length) {
    lines.push('因果链：' + chained.map((row) => clip(row.scenario || row.outcome || row.id, 28)).join('；'))
  }
  if (!because.length || !chained.length) {
    return {
      ready: false,
      scenario,
      because: [],
      evidence,
      precedents: chained,
      speak: '语义图里没有带因果链的决策，不能装成有档案。',
    }
  }
  return {
    ready: true,
    scenario,
    because,
    evidence,
    precedents: chained,
    speak: (lines.join(' ') || '图里有依据。') + ' 你点了才记进决策台账。',
  }
}

export function recordArgs({ scenario, reasoning, outcome, actor, because, leadsTo, sessionId, requestId }) {
  const becauseIds = uniqueIds(because)
  if (!becauseIds.length) return { ok: false, error: 'NO_BECAUSE' }
  const leads = uniqueIds(leadsTo)
  if (!leads.length) return { ok: false, error: 'NO_LEADS_TO' }
  return {
    ok: true,
    args: {
      category: 'lan_assist',
      scenario: String(scenario || '').trim() || '协助拍板',
      reasoning: String(reasoning || '').trim() || '用户在秘书卡上确认',
      outcome: String(outcome || '').trim() || 'confirmed',
      confidence: 1,
      decision_maker: String(actor || 'secretary').trim() || 'secretary',
      because: becauseIds,
      leads_to: leads,
      metadata: {
        actor: String(actor || 'secretary'),
        sessionId: String(sessionId || ''),
        requestId: String(requestId || ''),
        source: 'dsh-lan-assist',
      },
    },
  }
}

export async function readLeftIds(home = dshHome()) {
  try {
    const raw = JSON.parse(await readFile(join(home || join(homedir(), '.dsh'), 'semantic-os', 'people.json'), 'utf8'))
    const people = raw && Array.isArray(raw.people) ? raw.people : []
    const ids = []
    for (const row of people) {
      if (!row || typeof row !== 'object') continue
      if (String(row.status || '').trim() !== 'left') continue
      const id = String(row.id || '').trim()
      if (id && !ids.includes(id)) ids.push(id)
    }
    return ids
  } catch {
    return []
  }
}

export function workspaceStorePath(home = dshHome()) {
  return join(home || join(homedir(), '.dsh'), 'storages', 'workspace.json')
}

export async function cwdFromWorkspaceStore(sessionId, home = dshHome()) {
  const id = String(sessionId || '').trim()
  if (!id) return ''
  try {
    const raw = JSON.parse(await readFile(workspaceStorePath(home), 'utf8'))
    const workspaces = raw && raw.tables && raw.tables.workspaces
    if (!workspaces || typeof workspaces !== 'object') return ''
    for (const row of Object.values(workspaces)) {
      if (!row || typeof row !== 'object') continue
      const ids = Array.isArray(row.sessionIds) ? row.sessionIds : []
      if (ids.includes(id) && typeof row.path === 'string' && row.path.trim()) {
        return row.path.trim()
      }
    }
  } catch { /* ignore */ }
  return ''
}

/**
 * @param {string} origin
 * @param {() => string} [resolvePage]
 */
function pageOrigin(origin, resolvePage) {
  const raw = String(origin || '').trim()
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, '')
  if (typeof resolvePage === 'function') {
    const live = String(resolvePage() || '').trim()
    if (/^https?:\/\//i.test(live)) return live.replace(/\/+$/, '')
  }
  const port = String(process.env.PORT || process.env.DSH_WEB_PORT || '3080').trim() || '3080'
  return `http://127.0.0.1:${port}`
}

/**
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   origin?: string,
 *   resolvePage?: () => string,
 *   resolveCwd?: (sessionId: string) => Promise<string>,
 * }} [opts]
 */
export function createSemanticBridge(opts = {}) {
  const fetchImpl = opts.fetchImpl || (typeof fetch === 'function' ? fetch : null)
  const origin = opts.origin || ''
  const resolvePage = typeof opts.resolvePage === 'function' ? opts.resolvePage : () => ''
  const sameOriginPage = () => pageOrigin(origin, resolvePage)
  const resolveCwd = opts.resolveCwd || ((sessionId) => cwdFromWorkspaceStore(sessionId))

  async function python(cwd, op, args) {
    if (!fetchImpl) return { ok: false, error: 'NO_FETCH' }
    if (!cwd) return { ok: false, error: 'NO_CWD' }
    try {
      const page = sameOriginPage()
      const headers = {
        'content-type': 'application/json',
        origin: page,
      }
      if (!/[^\u0000-\u007F]/u.test(cwd)) headers['x-dsh-cwd'] = cwd
      const res = await fetchImpl(page + '/semantic-os/python', {
        method: 'POST',
        headers,
        body: JSON.stringify({ op, cwd, args: args || {} }),
      })
      const body = await res.json()
      if (!res.ok || (body && body.error)) {
        return { ok: false, error: (body && body.error) || `HTTP_${res.status}`, body }
      }
      return { ok: true, ...body }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  return {
    async ready() {
      if (!fetchImpl) return false
      try {
        const res = await fetchImpl(sameOriginPage() + '/semantic-os/ready')
        const body = await res.json()
        return !!(body && (body.ready === true || body.ok === true))
      } catch {
        return false
      }
    },
    resolveCwd,
    async vocab(workspace) {
      const cwd = String(workspace || '').trim()
      if (!cwd) return { ok: false, error: 'NO_CWD', kinds: [] }
      const ready = await this.ready()
      if (!ready) return { ok: false, error: 'NOT_READY', cwd, kinds: [] }
      const found = await python(cwd, 'list_graph_nodes', { type: 'skos:Concept', limit: 5000 })
      if (!found.ok) return { ok: false, error: found.error || 'VOCAB_FAILED', cwd, kinds: [] }
      return { ok: true, cwd, kinds: kindsFromGraphNodes(found.nodes) }
    },
    async upsertVocab(workspace, concept) {
      const cwd = String(workspace || '').trim()
      if (!cwd) return { ok: false, error: 'NO_CWD' }
      const ready = await this.ready()
      if (!ready) return { ok: false, error: 'NOT_READY' }
      const row = concept && typeof concept === 'object' ? concept : {}
      return python(cwd, 'upsert_workspace_vocab', { concepts: [row] })
    },
    async brief(sessionId, scenario, workspace) {
      const letterCwd = String(workspace || '').trim()
      const cwd = letterCwd || await resolveCwd(sessionId)
      if (!cwd) return { ok: false, error: 'NO_CWD', advice: packAdvice(null, scenario) }
      const ready = await this.ready()
      if (!ready) return { ok: false, error: 'NOT_READY', advice: packAdvice(null, scenario) }
      const found = await python(cwd, 'brief_for_decision', { scenario })
      if (!found.ok) {
        return { ok: false, error: found.error || 'BRIEF_FAILED', advice: packAdvice(null, scenario), cwd }
      }
      const packed = {
        ...found,
        precedents: await attachCausal(python, cwd, found.precedents, scenario),
        drafts: await attachCausal(python, cwd, found.drafts, scenario),
      }
      return { ok: true, cwd, advice: packAdvice(packed, scenario), brief: packed }
    },
    async ingestPaths(workspace, paths) {
      const cwd = String(workspace || '').trim()
      const list = (Array.isArray(paths) ? paths : []).map((row) => String(row || '').trim()).filter(Boolean)
      if (!cwd) return { ok: false, error: 'NO_CWD' }
      if (!list.length) return { ok: false, error: 'NO_PATHS', hint: '进图要点名投影文件。' }
      if (!fetchImpl) return { ok: false, error: 'NO_FETCH' }
      const ready = await this.ready()
      if (!ready) return { ok: false, error: 'NOT_READY', hint: '语义仓没起来。' }
      try {
        const page = sameOriginPage()
        const res = await fetchImpl(page + '/semantic-os/ingest/start', {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: page },
          body: JSON.stringify({ cwd, paths: list }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok || (body && body.error && body.ok === false)) {
          return { ok: false, error: (body && body.error) || `HTTP_${res.status}`, hint: '语义仓拒了这次 ingest。' }
        }
        return { ok: true, ...body }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'UNREACHABLE', hint: '语义仓没接上。' }
      }
    },
    async record(sessionId, payload) {
      const packed = recordArgs(payload)
      if (!packed.ok) return packed
      const cwd = payload.cwd || await resolveCwd(sessionId)
      if (!cwd) return { ok: false, error: 'NO_CWD' }
      const ready = await this.ready()
      if (!ready) return { ok: false, error: 'NOT_READY' }
      const written = await python(cwd, 'record_decision', packed.args)
      if (!written.ok) return written
      return {
        ok: true,
        cwd,
        decisionId: written.decision_id || written.decisionId || '',
        causal: written.causal || { supports: packed.args.because.length, leads_to: packed.args.leads_to.length },
        args: packed.args,
      }
    },
  }
}

async function attachCausal(python, cwd, rows, scenario) {
  const out = []
  for (const row of Array.isArray(rows) ? rows.slice(0, 5) : []) {
    if (!row || typeof row !== 'object') continue
    if (!relatedToScenario(row.scenario || row.outcome || row.id, scenario)) {
      out.push(row)
      continue
    }
    const id = String(row.id || '').trim()
    if (!id || hasCausalChain(row)) {
      out.push(row)
      continue
    }
    const up = await python(cwd, 'get_causal_chain', { decision_id: id, direction: 'upstream' })
    const down = await python(cwd, 'get_causal_chain', { decision_id: id, direction: 'downstream' })
    const supports = Array.isArray(up && up.chain) ? up.chain.length : 0
    const leadsTo = Array.isArray(down && down.chain) ? down.chain.length : 0
    out.push({ ...row, supports, leads_to: leadsTo })
  }
  return out
}

function uniqueIds(list) {
  const out = []
  for (const item of Array.isArray(list) ? list : []) {
    const id = String(item || '').trim()
    if (id && !out.includes(id)) out.push(id)
  }
  return out
}

const STOP = new Set('这个 那个 什么 意思 一个 我们 可以 不是 还是 或者 因为 所以 然后 自己 他们 没有 就是 还有 怎么 这样 那样 如果 已经 现在 时候 问题 东西 地方 以及 语义 插件 系统 工作 图里 依据 相关 做到 记得 the this that what with from for and are was were you'.split(' '))

function relatedToScenario(snippet, scenario) {
  const a = contentTokens(snippet)
  const b = contentTokens(scenario)
  if (!a.size || !b.size) return false
  let hit = 0
  for (const token of a) {
    if (b.has(token)) hit += 1
  }
  return hit >= 2
}

function contentTokens(text) {
  const raw = String(text || '')
  const tokens = new Set()
  const latin = raw.toLowerCase().match(/[a-z][a-z0-9]{2,}|\d{2,}/g) || []
  for (const word of latin) {
    if (!STOP.has(word)) tokens.add(word)
  }
  const cjk = raw.replace(/[^\u4e00-\u9fff]/g, '')
  for (let i = 0; i < cjk.length - 1; i += 1) {
    const gram = cjk.slice(i, i + 2)
    if (!STOP.has(gram)) tokens.add(gram)
  }
  return tokens
}

function clip(text, n) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  return s.length <= n ? s : `${s.slice(0, n)}…`
}
