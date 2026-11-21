/**
 * First-turn Host flip: route_intent then maybe one search.
 * Result is a compact recall card, not a graph dump into system rules.
 * @module dsh-semantic-os/first-turn
 */

import { loadSpokenSeed, speechHasConnectorLookup, speechHasSpokenRole } from '../dsh-lan-assist/live-write-intent.mjs'
import { speechHoldsWorkstationWrite } from '../dsh-lan-assist/slots.js'
import { listBridgePeers } from './bridge.js'
import { createBriefCache, fetchFiledRules, fetchOpenTodos, fillSessionTitles, formatCoreBrief, isContinueQuery, mergeSessionLists, pickLastSession, rewriteContinueQuery } from './continue-brief.js'

export { fetchFiledRules, fetchOpenTodos, fillSessionTitles, mergeSessionLists }

const SEARCH_INTENTS = new Set(['查询', '出处', '催待办'])
const CARD_CAP = 1600
const HIT_CAP = 4
const SNIP = 180
const spokenSeed = loadSpokenSeed()
const GREETING = /^(你好|您好|嗨+|哈喽|哈囉|在吗|在嘛|早上好|晚上好|下午好|早安|晚安|谢谢|多謝|好的|嗯+|ok|okay|hello|hi|hey)([！!。.?？~～、，\s]*)$/i
const LOOKUP_MARK = /[?？]|什么|怎么|哪些|哪次|哪个|为什么|为何|多少|谁|何时|啥|吗|呢|查(一?下)?|搜(一?下)?|找(一?下)?|记得|上次|之前|出处|待办|接着|继续|定了|拍板/

export function isCasualOpener(text) {
  const raw = String(text || '').trim()
  if (!raw) return true
  if (GREETING.test(raw)) return true
  const compact = raw.replace(/\s+/g, '')
  return compact.length <= 4 && !LOOKUP_MARK.test(raw)
}

function hasRole(text, role) {
  return speechHasSpokenRole(text, spokenSeed, role)
}

export function routeIntent(text) {
  const raw = String(text || '').trim()
  if (!raw) return { intent: '闲聊', tool: '' }
  if (hasRole(raw, '出处')) return { intent: '出处', tool: 'lineage' }
  if (hasRole(raw, '定了') && !hasRole(raw, '拍板')) return { intent: '查询', tool: 'search_text' }
  if (hasRole(raw, '拍板')) return { intent: '拍板', tool: 'find_precedents' }
  if (hasRole(raw, '记忆卡')) return { intent: '查询', tool: 'list_memory_cards' }
  if (speechHoldsWorkstationWrite(raw)) return { intent: '现况', tool: 'biz_preview' }
  if (speechHasConnectorLookup(raw, spokenSeed)) return { intent: '现况', tool: 'biz_preview' }
  if (hasRole(raw, '业务动作')) return { intent: '业务动作', tool: 'brief_for_decision' }
  if (hasRole(raw, '过账') && hasRole(raw, '过账帮忙')) return { intent: '业务动作', tool: 'brief_for_decision' }
  if (hasRole(raw, '催待办')) return { intent: '催待办', tool: 'search_text' }
  if (hasRole(raw, '闲聊')) return { intent: '闲聊', tool: '' }
  if (isCasualOpener(raw)) return { intent: '闲聊', tool: '' }
  return { intent: '查询', tool: 'search_text' }
}

export function needsSearch(intent) {
  return SEARCH_INTENTS.has(String(intent || ''))
}

export function userSpeechFromEvent(event) {
  if (!event || event.type !== 'user/message') return ''
  return speechFromUserMessage(event.data || {})
}

export function speechFromUserMessage(message) {
  if (!message || typeof message !== 'object') return ''
  const source = message.source || {}
  if (source.kind && source.kind !== 'user') return ''
  if (source.plugin) return ''
  return textFromContent(message.content)
}

export function isInjectedUserSpeech(text) {
  const raw = String(text || '').trim()
  if (!raw) return true
  if (/^Current (runtime context|DSH file policy)/.test(raw)) return true
  if (/^<system-reminder>/.test(raw)) return true
  if (/^Time sampled while preparing/.test(raw)) return true
  if (/^\[iui-pattern\]/.test(raw)) return true
  if (/^<skill_content\b/.test(raw)) return true
  return false
}

export function normalizeFirstTurnSpeech(text) {
  return String(text || '').replace(/^\s*\/iui\b/i, '').trim()
}

export function resolveFirstTurnSpeech({ events, remembered } = {}) {
  return firstHumanSpeech(events) || normalizeFirstTurnSpeech(remembered)
}

function textFromContent(content) {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  return content.map((part) => {
    if (!part) return ''
    if (typeof part === 'string') return part
    if (part.type === 'text' && typeof part.text === 'string') return part.text
    return ''
  }).join('').trim()
}

export function firstHumanSpeech(events) {
  const list = Array.isArray(events) ? events : []
  const lines = []
  for (const event of list) {
    const text = userSpeechFromEvent(event)
    if (!text || isInjectedUserSpeech(text)) continue
    lines.push(normalizeFirstTurnSpeech(text))
  }
  if (lines.length !== 1) return ''
  return lines[0]
}

export function sessionIdFromSession(session) {
  if (!session || typeof session !== 'object') return ''
  const header = session.header || {}
  return String(session.id || session.sessionId || header.id || header.sessionId || '').trim()
}

export function assembleAgentPreset(context) {
  const agent = context && context.agent
  const session = (agent && agent.session) || (context && context.session) || null
  const header = session && session.header && typeof session.header === 'object' ? session.header : {}
  return String(
    (agent && (agent.agentPreset || agent.preset))
    || header.agentPreset
    || '',
  ).trim()
}

async function resolveBrief(opts, context, sessionId) {
  const session = (context && context.agent && context.agent.session) || (context && context.session) || null
  const cwd = String((session && session.header && session.header.cwd) || (opts && opts.cwd) || '').trim()
  let rows = []
  if (opts && typeof opts.listSessions === 'function') {
    try { rows = await opts.listSessions(cwd, context) } catch { rows = [] }
  }
  let todos = []
  if (opts && typeof opts.listTodos === 'function') {
    try { todos = await opts.listTodos(cwd, context) } catch { todos = [] }
  }
  const lastSession = pickLastSession(rows, { cwd, currentId: sessionId, todos })
  let peers = []
  if (opts && typeof opts.listBridgePeers === 'function') {
    try { peers = await opts.listBridgePeers(cwd, context) } catch { peers = [] }
  } else if (cwd) {
    try {
      peers = await listBridgePeers(cwd, process.env.DSH_HOME || process.env.FDE_DSH_HOME)
    } catch { peers = [] }
  }
  let filedRules = []
  const fileOpts = { todos, lastTitle: lastSession && lastSession.title }
  if (opts && typeof opts.listFiledRules === 'function') {
    try { filedRules = await opts.listFiledRules(cwd, fileOpts) } catch { filedRules = [] }
  } else if (cwd) {
    try { filedRules = await fetchFiledRules(cwd, fileOpts) } catch { filedRules = [] }
  }
  return { cwd, lastSession, todos, peers, filedRules }
}

export function installFirstTurn(ctx, opts) {
  const cache = createFirstTurnCache()
  const briefCache = (opts && opts.briefCache) || createBriefCache()
  const search = opts && typeof opts.search === 'function' ? opts.search : null
  if (!ctx || typeof ctx.on !== 'function' || !search) return cache

  ctx.on('session/event', (session, event) => {
    const header = session && session.header && typeof session.header === 'object' ? session.header : {}
    if (String(header.agentPreset || '').trim() === 'fde-briefing') return
    const id = sessionIdFromSession(session)
    const text = normalizeFirstTurnSpeech(userSpeechFromEvent(event))
    if (!id || !text || isInjectedUserSpeech(text)) return
    cache.noteSpeech(id, text)
  })

  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    if (assembleAgentPreset(context) === 'fde-briefing') {
      return typeof next === 'function' ? await next() : _assembly
    }
    const assembled = typeof next === 'function' ? await next() : _assembly
    const pack = assembled && typeof assembled === 'object' ? assembled : { sections: [] }
    const sessionId = sessionIdFromAssembleContext(context) || sessionIdFromSession(context && context.agent && context.agent.session)
    const events = eventsFromAssembleContext(context)
    const speech = resolveFirstTurnSpeech({ events, remembered: cache.speechOf(sessionId) })
    const session = (context && context.agent && context.agent.session) || (context && context.session) || null
    const cwd = String((session && session.header && session.header.cwd) || (opts && opts.cwd) || '').trim()
    const brief = await briefCache.load(cwd, sessionId, () => resolveBrief(opts, context, sessionId))
    const sections = Array.isArray(pack.sections) ? pack.sections.slice() : []
    const core = formatCoreBrief(brief)
    if (core && !sections.some((row) => row && row.name === 'tool:dsh-semantic-os-continue')) {
      sections.push({
        name: 'tool:dsh-semantic-os-continue',
        order: 118,
        text: core,
      })
    }
    if (sessionId && speech) {
      const card = await cache.ensure(sessionId, speech, (text, routed) => search(text, routed, context), brief)
      if (card && !sections.some((row) => row && row.name === 'tool:dsh-semantic-os-first-turn')) {
        sections.push({
          name: 'tool:dsh-semantic-os-first-turn',
          order: 120,
          text: card,
        })
      }
    }
    return { ...pack, sections }
  })

  return cache
}

export function clipHit(row) {
  const node = row && row.node && typeof row.node === 'object' ? row.node : {}
  const id = String(node.id || '')
  const raw = String(node.content || (node.properties && node.properties.content) || '')
  const then = row && row.then && row.then.label ? String(row.then.label) : ''
  const grade = row && row.knowledge_grade ? String(row.knowledge_grade) : ''
  const snippet = raw.replace(/\s+/g, ' ').trim().slice(0, SNIP)
  if (!id || !snippet) return ''
  const marks = [then, grade].filter(Boolean).join(' · ')
  return `- ${id}${marks ? ` · ${marks}` : ''}\n  ${snippet}`
}

export function formatHandoff({ intent, tool, hits, sessionId, filedRules }) {
  const lines = [
    '本回合 Host 已代调（工具回执，不是把图灌进 system）。',
    `intent: ${intent || ''}`,
    `tool: ${tool || '（不开检索）'}`,
  ]
  if (sessionId) lines.push(`session: ${sessionId}`)
  const rules = Array.isArray(filedRules) ? filedRules.filter((row) => row && row.label) : []
  if (rules.length) {
    lines.push('已入档规则（待审不是依据）：')
    for (const row of rules.slice(0, 3)) {
      const id = String(row.id || '').trim()
      const cue = String(row.label || '').replace(/\s+/g, ' ').trim()
      if (!cue) continue
      lines.push(id ? `- ${id} ${cue}` : `- ${cue}`)
    }
  }
  const packed = Array.isArray(hits) ? hits.map(clipHit).filter(Boolean).slice(0, HIT_CAP) : []
  if (packed.length) {
    lines.push('hits:')
    lines.push(...packed)
  } else if (needsSearch(intent)) {
    lines.push('hits: （这一拍没有摘录）')
  }
  if (tool === 'search_text') {
    lines.push('用这些摘录回答。不要 find_precedents。不要解压 session zstd。')
  }
  const text = lines.join('\n').trim()
  return text.length <= CARD_CAP ? text : `${text.slice(0, CARD_CAP - 1)}…`
}

export function parseSearchHits(packed) {
  let data = packed
  if (typeof packed === 'string') {
    try { data = JSON.parse(packed) } catch { return [] }
  }
  if (!data || typeof data !== 'object' || data.error) return []
  return Array.isArray(data.results) ? data.results : []
}

export function eventsFromAssembleContext(context) {
  const session = (context && context.agent && context.agent.session)
    || (context && context.session)
    || null
  if (session && Array.isArray(session.events)) return session.events
  if (session && typeof session.eventAt === 'function') {
    const seq = Number(session.seq)
    const out = []
    const cap = Number.isSafeInteger(seq) && seq > 0 ? Math.min(seq, 64) : 0
    for (let index = 0; index < cap; index += 1) {
      try {
        const event = session.eventAt(index)
        if (event) out.push(event)
      } catch { /* skip */ }
    }
    if (out.length) return out
  }
  if (context && Array.isArray(context.events)) return context.events
  if (context && Array.isArray(context.messages)) return context.messages
  return []
}

export function sessionIdFromAssembleContext(context) {
  const session = (context && context.agent && context.agent.session) || (context && context.session) || null
  return sessionIdFromSession(session) || String((context && context.sessionId) || '').trim()
}

export async function flipFirstTurn({ text, search, brief }) {
  const spoken = String(text || '').trim()
  const query = rewriteContinueQuery(spoken, brief)
  const routed = routeIntent(isContinueQuery(spoken) ? query : spoken)
  if (isContinueQuery(spoken)) {
    routed.intent = '查询'
    routed.tool = 'search_text'
  }
  let hits = []
  if (needsSearch(routed.intent) && typeof search === 'function') {
    try {
      hits = parseSearchHits(await search(query, routed))
    } catch {
      hits = []
    }
  }
  return { ...routed, hits, query }
}

export function createFirstTurnCache() {
  /** @type {Map<string, { speech: string, card: string, wait: Promise<string> | null }>} */
  const map = new Map()

  function peek(sessionId) {
    const hit = map.get(String(sessionId || ''))
    return hit && hit.card ? hit.card : ''
  }

  function speechOf(sessionId) {
    const hit = map.get(String(sessionId || ''))
    return hit && hit.speech ? hit.speech : ''
  }

  function noteSpeech(sessionId, speech) {
    const id = String(sessionId || '').trim()
    const line = String(speech || '').trim()
    if (!id || !line) return
    const hit = map.get(id)
    if (hit && hit.speech) return
    map.set(id, { speech: line, card: (hit && hit.card) || '', wait: (hit && hit.wait) || null })
  }

  async function ensure(sessionId, speech, search, brief) {
    const id = String(sessionId || '').trim()
    const line = String(speech || '').trim()
    if (!id || !line) return ''
    const hit = map.get(id)
    if (hit && hit.card) return hit.card
    if (hit && hit.wait) return hit.wait
    let settle
    const wait = new Promise((resolve) => { settle = resolve })
    map.set(id, { speech: line, card: '', wait })
    try {
      const flipped = await flipFirstTurn({ text: line, search, brief })
      const card = formatHandoff({
        ...flipped,
        sessionId: id,
        filedRules: isContinueQuery(line) ? (brief && brief.filedRules) : [],
      })
      map.set(id, { speech: line, card, wait: null })
      settle(card)
      return card
    } catch {
      map.set(id, { speech: line, card: '', wait: null })
      settle('')
      return ''
    }
  }

  return { peek, ensure, noteSpeech, speechOf }
}
