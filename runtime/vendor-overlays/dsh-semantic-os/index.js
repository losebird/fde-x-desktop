/**
 * Host plugin: one semantica==0.6.7 sidecar, same-origin /semantic-os, host tools.
 * apply() never throws on doctor fail — the plugin stays not-ready.
 * @module dsh-semantic-os
 */

import { createHandler, createUpgradeHandler } from './http.js'
import { importPeer } from './peers.js'
import { DEFAULT_API_KEY_ENV, DEFAULT_START_TIMEOUT_MS, loadOverlaySync, mergeConfig } from './persist.js'
import { createSidecar } from './sidecar.js'
import { registerTools } from './tools.js'
import { createIngest, postPython } from './ingest.js'
import { registerGate } from './gate.js'
import { createWriteLog } from './product.js'
import { createOpeningCache } from './opening-brief.js'

import { adaptSessionPersistence, createSessionIngest, DEFAULT_SESSION_INGEST_INTERVAL_MIN } from './session-ingest.js'
import { createExtract } from './extract-llm.js'
import { createExtractQueue } from './extract-queue.js'
import { createSlipIngest } from './slips.js'
import { createPeopleSync } from './people-sync.js'
import { createWorkspaceAuthority } from './workspace-authority.js'

const schemaMod = await importPeer('@deepseek-ai/schemastery')
const { defineTool } = await importPeer('@deepseek-ai/dsh-tools')
const Schema = schemaMod.default

export const name = 'dsh-semantic-os'
export const inject = ['tools', 'webServer']

export const Config = Schema.object({
  pythonPath: Schema.string().default(''),
  startTimeoutMs: Schema.number().default(DEFAULT_START_TIMEOUT_MS),
  apiKeyEnv: Schema.string().default(DEFAULT_API_KEY_ENV),
  sessionIngestIntervalMin: Schema.number().default(DEFAULT_SESSION_INGEST_INTERVAL_MIN),
  installTimeoutMs: Schema.number().default(15 * 60 * 1000),
  peopleAllowPrivateNetwork: Schema.boolean().default(false),
})

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {Record<string, unknown>} config
 */
export function apply(ctx, config) {
  let current = () => mergeConfig(config || {})
  loadOverlaySync()

  ctx.inject(['settings'], (sctx) => {
    try {
      const scope = sctx.settings.register('dsh-semantic-os', Config, {
        base: config,
        applies: 'live',
      })
      current = () => mergeConfig(scope.get() || config || {})
      sctx.effect(() => () => {
        current = () => mergeConfig(config || {})
      })
    } catch {
      // namespace already taken or settings surface declined the tree-out ns
    }
  })

  const sidecar = createSidecar(() => current())
  const writes = createWriteLog()
  const opening = createOpeningCache()
  const wantedCwds = new Set()
  const markWrite = writes.mark.bind(writes)
  writes.mark = (cwd, op) => {
    markWrite(cwd, op)
    opening.forget(cwd)
  }
  let persistence = null
  let eyes = null
  let extract = null
  const extractQueue = createExtractQueue({
    getExtract: () => extract,
    postPython: (payload) => postPython(sidecar, payload),
    onGraphWrite: (cwd, op) => writes.mark(cwd, op),
  })
  const ingest = createIngest({ sidecar, getEyes: () => eyes, getExtract: () => extract, getExtractQueue: () => extractQueue, onGraphWrite: (cwd, op) => writes.mark(cwd, op) })
  const sessionIngest = createSessionIngest({
    sidecar,
    getPersistence: () => persistence,
    getEyes: () => eyes,
    getExtract: () => extract,
    extractQueue,
    getConfig: () => current(),
    onGraphWrite: (cwd, op) => writes.mark(cwd, op),
  })
  const slips = createSlipIngest({
    sidecar,
    getPersistence: () => persistence,
    onGraphWrite: (cwd, op) => writes.mark(cwd, op),
  })
  const peopleSync = createPeopleSync({
    getConfig: () => current(),
    onRoster: (people) => {
      for (const cwd of wantedCwds) {
        void postPython(sidecar, { op: 'sync_roster', cwd, args: { people } }).catch(() => null)
      }
    },
  })
  const workspaceAuthority = createWorkspaceAuthority()
  const handler = createHandler({ sidecar, getConfig: () => current(), ingest, writes, sessionIngest, peopleSync, workspaceAuthority, extractQueue, getPersistence: () => persistence, getExtract: () => extract })

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/semantic-os',
    handler,
  }))

  if (typeof ctx.webServer.registerUpgrade === 'function') {
    ctx.effect(() => ctx.webServer.registerUpgrade({
      path: '/semantic-os/ws/graph-updates',
      handler: createUpgradeHandler(sidecar, workspaceAuthority),
    }))
  }

  ctx.effect(() => {
    const off = typeof sidecar.onReady === 'function'
      ? sidecar.onReady(() => {
          for (const key of wantedCwds) {
            warmupOpening(key)
            if (extractQueue && typeof extractQueue.idleWarm === 'function') {
              void extractQueue.idleWarm(key).catch(() => undefined)
            }
          }
        })
      : () => undefined
    void sidecar.start()
    return () => {
      if (typeof off === 'function') off()
      void sidecar.dispose()
    }
  })

  try {
    registerTools(ctx, { defineTool }, sidecar, writes, extractQueue, {
      getPersistence: () => persistence,
      getExtract: () => extract,
    })
  } catch {
    // A bad tool schema must not take down apply() / the web shell.
  }
  registerGate(ctx, {
    sidecar,
    getConfig: () => current(),
    onBlocked: (cwd, toolName, reason) => {
      if (!cwd) return
      void postPython(sidecar, {
        op: 'record_decision',
        cwd,
        args: {
          category: 'gate',
          scenario: String(toolName || ''),
          reasoning: String(reason || 'blocked'),
          outcome: 'blocked',
          confidence: 1,
          decision_maker: 'plugin',
          metadata: { actor: 'plugin', toolName, ts: new Date().toISOString() },
        },
      }).then(() => writes.mark(cwd, 'record_decision')).catch(() => undefined)
    },
  })

  const listen = (name, fn) => {
    if (typeof ctx.on === 'function') {
      try { ctx.on(name, fn) } catch { /* optional */ }
    }
  }
  const maybeArchive = (session) => {
    const cfg = current()
    if (!cfg.sessionEndRecord) return
    const cwd = session && session.header && session.header.cwd
    if (!cwd) return
    void postPython(sidecar, {
      op: 'record_decision',
      cwd,
      args: {
        category: 'session_end',
        scenario: 'archived session',
        reasoning: 'workspace.archiveSession',
        outcome: 'archived',
        confidence: 1,
        decision_maker: 'plugin',
        metadata: { actor: 'plugin', cwd, ts: new Date().toISOString() },
      },
    }).then(() => writes.mark(cwd, 'record_decision')).catch(() => undefined)
  }
  listen('workspace.archiveSession', (_s, session) => maybeArchive(session || _s))
  listen('host/archived-sessions-changed', (_s, payload) => {
    const rows = (payload && payload.sessions) || payload || []
    if (Array.isArray(rows)) rows.forEach(maybeArchive)
  })

  ctx.inject(['sessionPersistence'], (pctx) => {
    persistence = adaptSessionPersistence(pctx.sessionPersistence)
    workspaceAuthority.setPersistence(persistence)
    pctx.effect(() => () => {
      persistence = null
      workspaceAuthority.setPersistence(null)
    })
  })

  ctx.inject(['dshEyes'], (ectx) => {
    eyes = ectx.dshEyes
    ectx.effect(() => () => { eyes = null })
  })

  ctx.inject(['llm'], (lctx) => {
    extract = createExtract(lctx)
    lctx.effect(() => () => { extract = null })
  })

  ctx.inject(['sessions'], (sctx) => {
    workspaceAuthority.setSessions(sctx.sessions)
    sctx.effect(() => () => workspaceAuthority.setSessions(null))
    try {
      sctx.on('session/created', (_s, session) => {
        const cwd = session && session.header && session.header.cwd
        if (cwd) {
          ingest.ensure(cwd, session && session.id)
          warmupOpening(cwd)
        }
      })
    } catch { /* optional */ }
  })

  ctx.effect(() => {
    sessionIngest.start()
    let cancelled = false
    let tries = 0
    const runBackfill = () => {
      if (cancelled) return
      const persistenceNow = typeof persistence?.list === 'function' ? persistence : null
      const extractNow = extract && typeof extract.extract === 'function'
      if (!persistenceNow || !extractNow) {
        if (tries >= 30) return
        tries += 1
        setTimeout(runBackfill, 5_000)
        return
      }
      void persistenceNow.list().then((headers) => {
        if (cancelled) return
        const seen = new Set()
        for (const header of Array.isArray(headers) ? headers : []) {
          const cwd = header && (header.cwd || (header.meta && header.meta.cwd))
          const key = String(cwd || '').replace(/[\r\n\t]/g, '')
          if (!key || seen.has(key)) continue
          seen.add(key)
          void extractQueue.backfill(key)
          warmupOpening(key)
        }
      }).catch(() => undefined)
    }
    const backfillTimer = setTimeout(runBackfill, 45_000)
    return () => {
      cancelled = true
      clearTimeout(backfillTimer)
      void sessionIngest.stop()
      void extractQueue.stop()
    }
  })

  ctx.effect(() => {
    slips.start()
    return () => slips.stop()
  })

  ctx.effect(() => {
    peopleSync.start()
    return () => peopleSync.stop()
  })

  function sessionCwd(context) {
    const cwd = context && context.agent && context.agent.session && context.agent.session.header && context.agent.session.header.cwd
    return typeof cwd === 'string' && cwd.trim() ? cwd.trim() : ''
  }

  function fetchOpening(key) {
    return postPython(sidecar, { op: 'opening_brief', cwd: key, args: {} })
      .then((body) => (body && body.ok && typeof body.text === 'string' ? body.text : ''))
      .catch(() => '')
  }

  function openingText(cwd) {
    const snap = sidecar.snapshot()
    return opening.openingText(cwd, {
      ready: Boolean(snap.ready && snap.port),
      fetchBrief: fetchOpening,
    })
  }

  function warmupOpening(cwd) {
    const key = String(cwd || '').trim()
    if (!key) return
    wantedCwds.add(key)
    const snap = sidecar.snapshot()
    opening.warmup(key, {
      ready: Boolean(snap.ready && snap.port),
      fetchBrief: fetchOpening,
    })
  }

  const systemPrompt = ctx.get('systemPrompt')
  if (systemPrompt && typeof systemPrompt.section === 'function') {
    systemPrompt.section({
      name: 'tool:dsh-semantic-os',
      order: 119,
      text: (context) => {
        const cwd = sessionCwd(context)
        const opening = cwd ? openingText(cwd) : ''
        const rules = [
        'dsh-semantic-os keeps a local Semantica 0.6.7 knowledge graph shared by every session in this cwd.',
        'It accumulates prior conversation text, ingested file contents, extracted entities/relations, and recorded decisions.',
        'A new session has no memory of this project except this graph, so treat it as the project\'s persistent memory.',
        'Intent routing (no second search engine): call route_intent first. Follow its tool field. 查询 → search_text; 出处 → lineage; 拍板 / 业务动作 → brief_for_decision then record_decision; 现况 → biz_preview on the assist plugin (live connector, not the graph); 催待办 → search_text only (the graph is not a催办引擎); 待审记忆 / 记忆卡片 → list_memory_cards; 闲聊 → no graph tool. Do not call search_text first when route_intent named biz_preview. Vocabulary is hand-written 型 (采购单 / 待办 / 过审, field names, what it can do). Write kinds with upsert_workspace_vocab (max 16 concepts per call; split larger packs). Same id merges resource / ticketField / clues and keeps fields/can. Do not use add_entity to patch a 型. Do not add ERP 行, ticket numbers, or amounts as vocab concepts. Do not POST /semantic-os/python or /_dsh/python to import a vocab.',
        'Retrieval-first rule: before answering anything whose answer may already live in the project (prior chats, files, decisions, people, shops, facts, conclusions, or anything asked as 之前/曾经/这个项目里/有哪些/出自/谁负责/什么价格/结论/某天聊了什么), call search_text first — unless route_intent named biz_preview, which is live connector work. Answer from the 摘录 immediately; do not wait for entity extraction. After a 摘录, open the diary with open_node(id); truncated means the archive is longer, not that chat was cut. Who/shop/relation questions still start with search_text; edges may fill in later. For 某天我们沟通了什么, pass date on search_text (message timestamps). For 几点/14:33/下午聊了什么, pass that clock on date (HH:MM is this machine\'s timezone that minute; YYYY-MM-DD is this machine\'s calendar day, not UTC; do not grep the digits 14:33). search_text also follows configured workspace bridges and searches session text on the other side (hits carry via=bridge). A clock question about another workspace must still use search_text (default across_bridges true); do not only scan this cwd graph.json. When in doubt whether the project already contains the answer, search anyway. Hits carry knowledge_grade: observation / user_memory / inferred / verified_receipt — never treat them as live ERP. missing lists vocab kinds that need 现查; live_facts is always empty. 现查 is biz_preview on the assist plugin, where connection config lives.',
        'Use lineage to answer 出自 / where a fact came from.',
        'Graph facts are 当时, never 现在. brief_for_decision / search_text hits carry a then label. Do not tell the user a ticket is still 待审 from the graph; that needs a live connector lookup. 起草 is not current. File bodies enter the graph only after a nod: see_file / see_image, or an explicit ingest of chosen paths. Pasting a path or opening the Semantic tab is not a nod. Chat text is searched in DSH session logs via search_text. Decisions: when the user is choosing, weighing options, or about to board, call brief_for_decision first and wait; show the brief options and evidence, then wait. Do not advise a choice from chat memory alone. After they confirm, call record_decision with because (ids from the brief); the gate rejects a board with no because. Never put scenario text in because. Omit status to stay 起草. status=已生效 needs leads_to, receipt_id, and nod_kind=业务过账 — omitting nod_kind is not a post. Same trace_id or same receipt_id cannot record 已生效 twice. A 业务引用 needs system + environment + kind + ticket; 测试 and 生产 of the same ticket are two nodes. If the envelope names a tenant_cwd, it must be this workspace.',
        'Use query_decisions to recall prior boards (已生效 plus human 起草). find_precedents only returns 已生效. Use get_causal_chain for 依据→决策→后果 (not session neighbors).',
        '记忆卡片: encode at the act like Semantica AgentMemory — draft_memory_card writes 已入档 and may be 依据 immediately. Leftover 起草 is not 依据. Do not ask 要不要做成卡. when the human is correcting / pinning a 铁律 / saying 记住, or after they pick a brief option, call draft_memory_card FIRST (cause=correction|choice) in the same turn — one cue one card. Board, goal, and skill come after. List leftover drafts with list_memory_cards and wait for the human to nod. Do not call nod_memory_card unless the human nodded. retire with retire_memory_card, link with nod_memory_edge — all need nodded=true; none become 已生效. Suggested 理解边 is confirms/enriches only. Opening 工作记忆 is 当时, not 现在. A 超长会话 is archive, not dirt: do not truncate chat. 业务过账 已生效 still needs receipt.',
        'Only after search_text returns nothing may you say it is not in the graph. Never guess project facts from memory.',
        'The Semantic tab is a product canvas (home plus explore/analyze/decisions/io/admin/ontology); extract_entities / extract_relations / add_entity / add_relationship write the graph; get_graph_summary / get_graph_analytics / export_graph / run_reasoning inspect it.',
        'Graph ops without a session cwd return NO_CWD. If the engine is not ready they return NOT_READY.',
        ]
        if (!opening) return rules.join(' ')
        return `${rules.join(' ')}\n\n${opening}`
      },
    })
  }
}
