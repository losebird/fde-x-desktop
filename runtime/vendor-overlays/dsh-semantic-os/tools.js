/**
 * Host tools (search_text + lineage + brief_for_decision plus the original twelve). Writes go through sidecar Python, never invented REST.
 * @module dsh-semantic-os/tools
 */

import { requestSidecar } from './sidecar-client.js'
import { clipSnippet } from './session-find.js'
import { mergePassageHits, mergeSearchHits, openCorpus, passageQueries, searchCorpus } from './session-corpus.js'
import { hasCjk } from './extract-llm.js'
import { estimateTokens, recordUsage } from './usage-ledger.js'

const SEARCH_SNIPPET = 360
const SEARCH_PAGE = 12

const ROUTED_TOOLS = new Set([
  'search_text', 'lineage', 'brief_for_decision', 'query_decisions',
  'find_precedents', 'list_memory_cards', 'query_graph', 'open_node',
  'get_causal_chain',
])

export function createRouteGate(opts = {}) {
  const graceMs = opts.graceMs == null ? 100 : Math.max(0, Number(opts.graceMs) || 0)
  const turns = new Map()
  const inflight = new Map()
  const waiters = new Map()

  function sessionId(exec) {
    return String((exec && exec.agent && exec.agent.session && (exec.agent.session.id || exec.agent.session.sessionId))
      || (exec && exec.agent && exec.agent.id)
      || '').trim()
  }

  function turnOf(exec) {
    const events = exec && exec.agent && exec.agent.session && exec.agent.session.events
    if (!Array.isArray(events)) return 1
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const row = events[i]
      if (row && row.type === 'turn/start') {
        const n = Number(row.data && row.data.turn)
        return Number.isFinite(n) ? n : 1
      }
    }
    return 1
  }

  function keyOf(exec) {
    return `${sessionId(exec)}:${turnOf(exec)}`
  }

  function wake(key) {
    const list = waiters.get(key) || []
    waiters.delete(key)
    for (const fn of list) fn()
  }

  function wait(key) {
    return new Promise((resolve) => {
      const list = waiters.get(key) || []
      list.push(resolve)
      waiters.set(key, list)
    })
  }

  function begin(exec) {
    const id = sessionId(exec)
    if (!id) return
    const key = keyOf(exec)
    inflight.set(key, (inflight.get(key) || 0) + 1)
    wake(key)
  }

  function mark(exec) {
    const id = sessionId(exec)
    if (!id) return
    turns.set(id, turnOf(exec))
    wake(keyOf(exec))
  }

  function end(exec) {
    const id = sessionId(exec)
    if (!id) return
    const key = keyOf(exec)
    inflight.set(key, Math.max(0, (inflight.get(key) || 1) - 1))
    wake(key)
  }

  function denied(name) {
    return {
      ok: false,
      error: JSON.stringify({
        error: 'ROUTE_FIRST',
        tool: name,
        detail: '本回合先调 route_intent，再查图。闲聊可以不调。',
      }),
    }
  }

  async function allow(name, exec) {
    if (!ROUTED_TOOLS.has(String(name || ''))) return { ok: true }
    const id = sessionId(exec)
    if (!id) return { ok: true }
    const turn = turnOf(exec)
    if (turns.get(id) === turn) return { ok: true }
    const key = `${id}:${turn}`
    const deadline = Date.now() + graceMs
    while (turns.get(id) !== turn) {
      if ((inflight.get(key) || 0) > 0) {
        await wait(key)
        continue
      }
      const left = deadline - Date.now()
      if (left <= 0) break
      await Promise.race([
        wait(key),
        new Promise((resolve) => setTimeout(resolve, left)),
      ])
    }
    if (turns.get(id) === turn) return { ok: true }
    return denied(name)
  }

  return { begin, mark, end, allow, sessionId, turnOf }
}

function worldSourceType(nid, ntype, via) {
  const id = String(nid || '')
  const kind = String(ntype || '')
  const path = String(via || '')
  if (id.startsWith('session:')) return 'session'
  if (id.startsWith('file:')) return 'file'
  if (id.startsWith('mail:')) return 'mail'
  if (id.startsWith('memory:') || kind === '记忆卡片' || path === 'agent-memory') return 'memory'
  if (kind.toLowerCase() === 'decision') return 'decision'
  if (kind.startsWith('skos:')) return 'vocab'
  if (path === 'faiss') return 'passage'
  return 'graph'
}

function worldGrade(nid, ntype, via, props) {
  const meta = props && typeof props === 'object' ? props : {}
  const id = String(nid || '')
  const kind = String(ntype || '')
  const path = String(via || '')
  if (id.startsWith('memory:') || kind === '记忆卡片' || path === 'agent-memory') return 'user_memory'
  if (meta.auto === true || String(meta.source || '') === 'session_ingest') return 'inferred'
  if (kind.toLowerCase() === 'decision') {
    const status = String(meta.status || meta.board_status || '')
    const receipt = String(meta.receipt_id || meta.receiptId || meta.receipt || '')
    const nod = String(meta.nod_kind || meta.nodKind || '')
    if (status === '已生效' && receipt && nod === '业务过账') return 'verified_receipt'
    return 'observation'
  }
  return 'observation'
}

export function stampWorldHit(row, cwd = '') {
  if (!row || typeof row !== 'object') return row
  const node = row.node && typeof row.node === 'object' ? row.node : {}
  const props = node.properties && typeof node.properties === 'object' ? node.properties : {}
  const nid = String(node.id || row.id || '')
  const ntype = String(node.type || row.kind || '')
  const via = String(row.via || props.via || '')
  const snippet = String(node.content || props.content || row.snippet || '')
  const observed = String(node.valid_from || props.valid_from || props.timestamp || row.observed_at || '')
  const until = String(node.valid_until || props.valid_until || row.valid_until || '')
  let confidence = Number(row.score || row.confidence || 0)
  if (!Number.isFinite(confidence) || confidence < 0) confidence = 0
  else if (confidence > 1) confidence = Math.min(1, confidence / 200)
  return {
    ...row,
    id: nid,
    kind: ntype,
    title: snippet.slice(0, 40) || nid,
    snippet,
    source_uri: nid,
    source_type: worldSourceType(nid, ntype, via),
    observed_at: observed,
    valid_from: observed,
    valid_until: until || null,
    confidence,
    knowledge_grade: worldGrade(nid, ntype, via, props),
    is_live: false,
    expires_at: until || null,
    workspace: String(props.cwd || row.workspace || cwd || ''),
  }
}

export function clipSearchPayload(body, args = {}) {
  if (body == null) return body
  let data = body
  if (typeof body === 'string') {
    try { data = JSON.parse(body) } catch { return body }
  }
  if (!data || typeof data !== 'object' || data.error || !Array.isArray(data.results)) return data
  const q = String(args.query || args.q || data.query || '')
  const cwd = String(args.cwd || data.cwd || '')
  let limit = Number(args.limit)
  if (!Number.isFinite(limit) || limit <= 0) limit = SEARCH_PAGE
  limit = Math.max(1, Math.min(limit, 50))
  const rows = data.results.slice(0, limit).map((row) => {
    if (!row || typeof row !== 'object') return row
    const node = row.node
    if (!node || typeof node !== 'object') return stampWorldHit(row, cwd)
    const raw = node.content || (node.properties && node.properties.content) || ''
    const snippet = clipSnippet(raw, q, SEARCH_SNIPPET)
    const props = node.properties && typeof node.properties === 'object'
      ? { ...node.properties, content: snippet }
      : { content: snippet }
    return stampWorldHit({ ...row, node: { ...node, content: snippet, properties: props } }, cwd)
  })
  const packed = { ...data, results: rows }
  const clock = String(args.date || data.date || '').trim()
  if (/^\d{1,2}:\d{2}$/.test(clock) && !rows.length) {
    packed.empty = true
    packed.detail = packed.detail || '这一分钟没有'
  }
  return packed
}

const TOOLS = [
  {
    name: 'extract_entities',
    description: 'Extract named entities (people, places, organisations, concepts) from text using Semantica NER.',
    parameters: {
      text: { type: 'string', required: true, description: 'Input text to extract entities from' },
    },
  },
  {
    name: 'extract_relations',
    description: 'Extract relations and (subject, predicate, object) triplets from text.',
    parameters: {
      text: { type: 'string', required: true, description: 'Input text to extract relations from' },
    },
  },
  {
    name: 'record_decision',
    description: 'Record a board decision after the user has chosen. Assist in chat first; call this only when they confirm. Omit status to stay 起草. status=已生效 needs because, leads_to, and receipt_id. Auto extract cannot become 已生效. tenant_cwd must match this workspace.',
    parameters: {
      category: { type: 'string', required: true, description: 'Decision category, e.g. loan_approval' },
      scenario: { type: 'string', required: true, description: 'Natural-language situation description' },
      reasoning: { type: 'string', required: true, description: 'Why this decision was made' },
      outcome: { type: 'string', required: true, description: 'Decision outcome, e.g. approved' },
      confidence: { type: 'number', required: true, description: 'Confidence score 0-1' },
      decision_maker: { type: 'string', description: 'Who or what made the decision' },
      because: { type: 'array', items: { type: 'string' }, description: 'Evidence / premise node ids. Each gets a supports edge into this decision.' },
      leads_to: { type: 'array', items: { type: 'string' }, description: 'Consequence node ids. This decision gets a leads_to edge into each.' },
      status: { type: 'string', description: '起草 / 已生效 / 已冲正 / 作废. Default 起草. 已生效 needs because, leads_to, receipt_id, and nod_kind=业务过账.' },
      receipt_id: { type: 'string', description: 'Business receipt id. Required for 已生效.' },
      tenant_cwd: { type: 'string', description: 'Workspace this envelope belongs to. Must match the session cwd.' },
      nod_kind: { type: 'string', description: '会签同意 / 本机工具 / 业务过账. Only 业务过账 can be 已生效.' },
      trace_id: { type: 'string', description: 'Envelope / followup / receipt line. Same id cannot record 已生效 twice.' },
      system: { type: 'string', description: 'Business system for a 业务引用, e.g. 采购.' },
      environment: { type: 'string', description: '测试 or 生产. Same ticket in two environments is two references.' },
      kind: { type: 'string', description: 'Type of the ticket, e.g. 采购单. Not an ERP row.' },
      ticket: { type: 'string', description: 'Ticket number only. No phone, account, or amount.' },
      holder: { type: 'string', description: 'Who now holds this 业务引用. Leave later only drops this hold.' },
      valid_from: { type: 'string', description: 'ISO date validity start' },
      valid_until: { type: 'string', description: 'ISO date validity end' },
    },
  },
  {
    name: 'nod_memory_card',
    description: 'Promote a 记忆卡片 after a nod. Draft stays 起草 until this. Cannot become 已生效. Needs id and nodded=true.',
    parameters: {
      id: { type: 'string', required: true, description: 'Memory card id, e.g. memory:ab12' },
      nodded: { type: 'boolean', required: true, description: 'Must be true. Promote is a nod.' },
    },
  },
  {
    name: 'nod_memory_edge',
    description: 'Write a 理解边 between two 记忆卡片 after a nod. challenges / enriches / confirms / replaces are all allowed. Auto-suggest is confirms/enriches only; do not guess challenges or replaces. Cannot touch 已生效 boards. Needs nodded=true.',
    parameters: {
      source: { type: 'string', required: true, description: 'Newer memory card id' },
      target: { type: 'string', required: true, description: 'Older memory card id' },
      type: { type: 'string', required: true, description: 'challenges / enriches / confirms / replaces' },
      nodded: { type: 'boolean', required: true, description: 'Must be true. Linking is a nod.' },
    },
  },
  {
    name: 'retire_memory_card',
    description: 'Stop using a 记忆卡片 after a nod. Sets valid_until. Body stays. Not 冲正, not delete. Needs id and nodded=true.',
    parameters: {
      id: { type: 'string', required: true, description: 'Memory card id' },
      nodded: { type: 'boolean', required: true, description: 'Must be true. Retire is a nod.' },
    },
  },
  {
    name: 'open_node',
    description: 'Open one graph node after a 摘录. Returns id + then + a capped body for working memory. truncated=true means the archive is longer; the stored node is not cut. Default 4000 chars, max 8000. Read-only.',
    parameters: {
      id: { type: 'string', required: true, description: 'Node id from search_text / lineage / brief, e.g. session:… or memory:…' },
      limit: { type: 'integer', description: 'Max chars to show (default 4000, max 8000). Archive stays whole.' },
    },
  },
  {
    name: 'source_memory_card',
    description: 'Attach a session: or file: 出处 to a 记忆卡片 after a nod. Body stays. Needs id, source, nodded=true.',
    parameters: {
      id: { type: 'string', required: true, description: 'Memory card id' },
      source: { type: 'string', required: true, description: 'session: or file: path' },
      nodded: { type: 'boolean', required: true, description: 'Must be true. Sourcing is a nod.' },
    },
  },
  {
    name: 'renew_memory_card',
    description: 'Clear valid_until so a 记忆卡片 counts again after a nod. Body stays. Needs id and nodded=true.',
    parameters: {
      id: { type: 'string', required: true, description: 'Memory card id' },
      nodded: { type: 'boolean', required: true, description: 'Must be true. Renew is a nod.' },
    },
  },
  {
    name: 'mute_health_kind',
    description: 'Stop listing one 梳理 kind after a nod. Body stays. Needs kind and nodded=true.',
    parameters: {
      kind: { type: 'string', required: true, description: 'Scan kind, e.g. 报告噪音' },
      nodded: { type: 'boolean', required: true, description: 'Must be true. Mute is a nod.' },
    },
  },
  {
    name: 'draft_memory_card',
    description: 'Encode a short cue as 起草 when the human is already encoding: a correction/铁律, or after they pick a brief option. cause=correction|choice. One cue one card. Call this first; board/goal/skill later. Stays 起草. Cannot become 已入档 or 已生效. Needs a later nod to file.',
    parameters: {
      label: { type: 'string', required: true, description: 'The cue in the human\'s words. Not an assistant report.' },
      cause: { type: 'string', required: true, description: 'correction (rebuke / 铁律 / 记住) or choice (they picked a brief option).' },
      source: { type: 'string', description: 'session: or file: path if known' },
    },
  },
  {
    name: 'list_memory_cards',
    description: 'List 记忆卡片. Default is 起草 waiting for a nod. include_filed also returns still-counting 已入档. Retired drafts are omitted. Draft cards are not 依据. Read-only.',
    parameters: {
      include_filed: { type: 'boolean', description: 'Also return 已入档 cards that still count. Default false.' },
      limit: { type: 'integer', description: 'Max cards (default 20, max 80)' },
      offset: { type: 'integer', description: 'Skip this many cards. Use with has_more to page.' },
    },
  },
  {
    name: 'query_decisions',
    description: 'Query recorded decisions by natural language, category, or list recent decisions. Returns 已生效 plus human 起草. Auto extract is hidden. Hits stay 当时.',
    parameters: {
      query: { type: 'string', description: 'Natural language query' },
      category: { type: 'string', description: 'Filter by category' },
      limit: { type: 'integer', description: 'Max results (default 10)' },
    },
  },
  {
    name: 'find_precedents',
    description: 'Find past decisions similar to a given scenario using find_similar_decisions. Only returns 已生效.',
    parameters: {
      scenario: { type: 'string', required: true, description: 'Scenario description to find precedents for' },
      max_results: { type: 'integer', description: 'Max results (default 5)' },
    },
  },
  {
    name: 'get_causal_chain',
    description: 'Walk only supports/causes/leads_to edges from a recorded decision. upstream = evidence that supports it; downstream = what it leads to. Not session neighbors.',
    parameters: {
      decision_id: { type: 'string', required: true, description: 'Decision ID to trace' },
      direction: { type: 'string', description: 'upstream or downstream' },
      max_depth: { type: 'integer', description: 'Max chain depth (default 5)' },
    },
  },
  {
    name: 'add_entity',
    description: 'Add a node/entity to the Semantica knowledge graph (Python add_node). For events/orders pass valid_from as the real event time, not ingest time.',
    parameters: {
      id: { type: 'string', required: true, description: 'Unique node ID' },
      label: { type: 'string', description: 'Human-readable label' },
      type: { type: 'string', description: 'Node type, e.g. Person' },
      valid_from: { type: 'string', description: 'ISO event time (order/ship/board time), not file mtime' },
      timestamp: { type: 'string', description: 'Optional same as valid_from' },
    },
  },
  {
    name: 'add_relationship',
    description: 'Add a directed relationship (edge) between two entities (Python add_edge).',
    parameters: {
      source: { type: 'string', required: true, description: 'Source node ID' },
      target: { type: 'string', required: true, description: 'Target node ID' },
      type: { type: 'string', description: 'Relationship type' },
    },
  },
  {
    name: 'run_reasoning',
    description: 'Run rules over facts. mode=forward uses Reasoner.infer_facts; mode=rete uses official ReteEngine; mode=datalog uses official DatalogReasoner (Horn clauses).',
    parameters: {
      facts: {
        type: 'array',
        items: { type: 'string' },
        required: true,
        description: 'Fact strings, e.g. Person(John)',
      },
      rules: {
        type: 'array',
        items: { type: 'string' },
        required: true,
        description: 'IF/THEN rule strings',
      },
      mode: {
        type: 'string',
        description: 'forward, rete, or datalog',
      },
    },
  },
  {
    name: 'get_graph_analytics',
    description: 'Compute PageRank centrality and community detection over the knowledge graph.',
    parameters: {},
  },
  {
    name: 'export_ledger',
    description: 'Read-only export of the decision 台账. Not the whole graph, not secretary mail. Hits stay 当时.',
    parameters: {},
  },
  {
    name: 'backup_graph',
    description: 'Copy this workspace graph.json to dest inside the cwd. Not the import-failure .bak. Keys never go in the backup.',
    parameters: {
      dest: { type: 'string', required: true, description: 'Destination path inside this workspace' },
    },
  },
  {
    name: 'restore_graph',
    description: 'Restore this workspace graph.json from a backup inside the cwd. Needs confirm. Not 冲正.',
    parameters: {
      dest: { type: 'string', required: true, description: 'Backup file path inside this workspace' },
      confirm: { type: 'boolean', description: 'Must be true. Restore is a nod.' },
    },
  },
  {
    name: 'erase_ledger',
    description: 'Erase PII or void 业务引用 after a nod. Not 冲正. kind=pii|引用|workspace.',
    parameters: {
      kind: { type: 'string', description: 'pii (default), 引用, or workspace' },
      confirm: { type: 'boolean', description: 'Must be true. Erase is a nod.' },
    },
  },
  {
    name: 'export_graph',
    description: 'Export the current knowledge graph. REST-aligned formats are json and csv; other formats use sidecar Python exporters. For audit use export_ledger.',
    parameters: {
      format: { type: 'string', description: 'json, csv, turtle, ttl, nt, xml, json-ld' },
    },
  },
  {
    name: 'get_graph_summary',
    description: 'Return a high-level summary of the current knowledge graph: node count, decision count, status.',
    parameters: {},
  },
  {
    name: 'query_graph',
    description: 'Walk graph edges from a start person/order/node. Optional date filters by node valid_from (event time). Use for 某客户某天买了什么 / 什么物流. Not full-text search.',
    parameters: {
      start: { type: 'string', required: true, description: 'Start node id or a name to resolve, e.g. 张三' },
      date: { type: 'string', description: 'Optional day (YYYY-MM-DD, this machine\'s calendar day) or ISO-Z instant to keep nodes whose valid_from covers it' },
      edge: { type: 'string', description: 'Optional edge types, comma-separated, e.g. 下单,购买,承运' },
      node_type: { type: 'string', description: 'Optional keep only this node type, e.g. 订单' },
      hops: { type: 'integer', description: 'Walk depth 1-4, default 2' },
    },
  },
  {
    name: 'route_intent',
    description: 'Classify one utterance as 查询 / 出处 / 拍板 / 业务动作 / 现况 / 催待办 / 闲聊 and name the existing tool. Does not search. 查询 → search_text; 现况 → biz_preview (live connector); 待审记忆 / 记忆卡片 → list_memory_cards; 闲聊 returns an empty tool. Follow the returned tool. Do not search_text when the tool is biz_preview.',
    parameters: {
      text: { type: 'string', required: true, description: 'The utterance to classify' },
    },
  },
  {
    name: 'search_text',
    description: 'Search the session cwd knowledge graph by original text, names, file contents, and session snippets — not only extracted entity labels. Hits are 摘录 (id + then + nearby text), not the whole session. total is the full hit count; do not say 图里没有 when results are a page. Use this when the user asks where something was said, which file mentions a word, or who/what is in the graph. Pass date for 某天我们沟通了什么. Follows configured workspace bridges and also searches session: messages on the other side. Each hit carries knowledge_grade (observation / user_memory / inferred / verified_receipt). Hits are 当时, never live. missing lists vocab kinds that need 现查 on the assist plugin; live_facts is always empty here.',
    parameters: {
      query: { type: 'string', required: true, description: 'The words to find. Sidecar already accepts q or query. For a whole day of chat, use a broad word plus date.' },
      date: { type: 'string', description: 'Optional day (YYYY-MM-DD, this machine\'s calendar day), local clock (HH:MM or YYYY-MM-DD HH:MM, host timezone that minute), or ISO-Z instant. Do not put 14:33 in query.' },
      date_from: { type: 'string', description: 'Optional range start' },
      date_to: { type: 'string', description: 'Optional range end' },
      across_bridges: { type: 'boolean', description: 'Default true. Also search session text in bridged workspaces. Set false to stay in this cwd only.' },
      limit: { type: 'integer', description: 'How many 摘录 to return (default 12, max 50). total is the full hit count.' },
      intent: { type: 'string', description: 'Optional 查询 / 出处 / 拍板 / 业务动作 / 催待办 / 闲聊. Omit to classify from the query. Changes ranking only; not a second search engine. 闲聊 returns no hits.' },
    },
  },
  {
    name: 'brief_for_decision',
    description: 'Pack graph evidence for a choice the user is making. Call this before advising or recording a decision. Returns search hits, similar past boards, human 起草 of the same kind, still-counting 已入档 记忆卡片, options from 已生效 outcomes, and because ids to pass into record_decision. Draft 记忆卡片 are not 依据. Hits are 当时, never 现在. Show options, then wait. Read-only.',
    parameters: {
      scenario: { type: 'string', required: true, description: 'The choice or situation, e.g. 要不要只发 darwin-arm64' },
      category: { type: 'string', description: 'Optional decision category filter for precedents' },
    },
  },
  {
    name: 'lineage',
    description: 'Trace where a graph node came from (出自). Given a node id like a person name, returns the session: or file: source path and hops.',
    parameters: {
      id: { type: 'string', required: true, description: 'Node id (e.g. 张伟)' },
    },
  },
  {
    name: 'upsert_workspace_vocab',
    description: 'Write hand-written 型 into this session cwd vocabulary (SKOS). Use when importing kinds such as 采购单 / 待办 / 过审. Each concept needs id, label, fields, can. Existing ids merge resource / ticketField / clues and keep fields/can. At most 16 concepts per call — split larger packs. Do not add ERP 行, ticket numbers, phones, or amounts. Do not POST /semantic-os/python; this tool is the write path. Do not use add_entity to patch a 型. Does not import a whole graph.',
    parameters: {
      name: { type: 'string', description: 'Scheme title, e.g. 本机业务单据型 · 单据' },
      concepts: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', description: 'Stable slug, e.g. purchase-order' },
            label: { type: 'string', description: 'Human kind name, e.g. 采购单' },
            fields: { type: 'array', items: { type: 'string' }, description: 'Gate fields only: 单号, 行号, 状态' },
            can: { type: 'array', items: { type: 'string' }, description: 'What this kind can do: 现查, 过审' },
            resource: { type: 'string', description: 'Connector table, e.g. biz_customers' },
            ticketField: { type: 'string', description: 'Real ticket column, e.g. code / orderNo' },
            catalogVersion: { type: 'string', description: 'Published catalog version id. Old previews must not use a stale version.' },
            relations: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  from: { type: 'string', description: 'Parent kind label' },
                  to: { type: 'string', description: 'Child kind label' },
                  field: { type: 'string', description: 'FK column on the child, e.g. customerId' },
                },
              },
              description: 'Maintainer-registered executable hops. Gate only hops these if the connector still has the field.',
            },
            clues: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  say: { type: 'array', items: { type: 'string' } },
                  keys: { type: 'array', items: { type: 'string' } },
                  values: { type: 'array', items: { type: 'string' } },
                  dateBefore: { type: 'array', items: { type: 'string' } },
                  dateAfter: { type: 'array', items: { type: 'string' } },
                  role: { type: 'string', description: '问句 / 型 / 时间 / 动作. Not free text.' },
                  not: { type: 'boolean', description: 'Exclude these values' },
                },
              },
              description: 'Spoken terms mapped to live columns. Not ERP rows.',
            },
          },
        },
        description: 'Kinds to write. Max 16. Rows (ticket / amount) are refused. Same id patches extras.',
      },
    },
  },
]

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ defineTool: Function }} toolsMod
 * @param {{ snapshot: Function, getApiKey: Function }} sidecar
 */
const READ_TOOLS = new Set([
  'extract_entities', 'extract_relations', 'search_text', 'lineage', 'brief_for_decision',
  'query_graph', 'route_intent', 'list_memory_cards', 'open_node', 'query_decisions',
  'find_precedents', 'get_causal_chain', 'get_graph_summary', 'get_graph_analytics',
])

export function runHostSearch(sidecar, args, exec, writes, corpus) {
  return callTool(sidecar, 'search_text', args, exec, writes, corpus)
}

export function registerTools(ctx, { defineTool }, sidecar, writes, extractQueue, corpus) {
  for (const spec of TOOLS) {
    ctx.tools.register(defineTool({
      name: spec.name,
      description: spec.description,
      parameters: spec.parameters,
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: String(value) }],
      },
      isConcurrencySafe: () => READ_TOOLS.has(spec.name),
      async execute(args, exec) {
        if (extractQueue && typeof extractQueue.markBusy === 'function') extractQueue.markBusy()
        try {
          const packed = await callTool(sidecar, spec.name, args, exec, writes, corpus)
          offerHits(extractQueue, spec.name, args, exec, packed)
          return packed
        } finally {
          setTimeout(() => {
            if (extractQueue && typeof extractQueue.markIdle === 'function') extractQueue.markIdle()
          }, 8000)
        }
      },
      presentCall() {
        return { card: 'generic', title: spec.name, kind: 'read' }
      },
    }))
  }
}

function offerHits(extractQueue, name, args, exec, packed) {
  if (!extractQueue || typeof extractQueue.enqueueHits !== 'function') return
  if (name !== 'search_text' && name !== 'query_graph' && name !== 'lineage') return
  let data = packed
  if (typeof packed === 'string') {
    try { data = JSON.parse(packed) } catch { return }
  }
  const hits = Array.isArray(data && data.results)
    ? data.results
    : Array.isArray(data && data.nodes)
      ? data.nodes.map((node) => ({ node }))
      : []
  const cwd = sessionCwd(exec)
  if (!cwd || !hits.length) return
  const query = String((args && (args.query || args.q || args.start || args.id)) || data.query || '')
  void extractQueue.enqueueHits(cwd, hits, query)
}

function sessionCwd(exec) {
  const cwd = exec?.agent?.session?.header?.cwd
  return typeof cwd === 'string' && cwd.trim() ? cwd : ''
}

async function openFromCorpus(args, corpus) {
  const id = String((args && (args.id || args.path)) || '')
  if (!id.startsWith('session:') || !corpus || typeof corpus.getPersistence !== 'function') return null
  return openCorpus({ getPersistence: corpus.getPersistence, id, limit: args.limit })
}

async function foldCorpusSearch(body, args, cwd, corpus, sidecar) {
  let graph = body
  if (typeof body === 'string') {
    try { graph = JSON.parse(body) } catch { graph = { results: [] } }
  }
  if (!corpus || typeof corpus.getPersistence !== 'function') return graph
  const q = String(args.query || args.q || '')
  if (!graph || typeof graph !== 'object' || graph.error) graph = { results: [] }
  const logs = await searchCorpus({
    getPersistence: corpus.getPersistence,
    cwd,
    args: { ...args, maxSessions: Number(args.maxSessions) || 16, maxMs: 2500 },
  })
  let merged = mergeSearchHits(graph, logs, q, args)
  if (!sidecar || !q) return merged
  try {
    const seenId = new Set()
    const rows = []
    const have = Array.isArray(merged && merged.results) ? merged.results.length : 0
    const queries = passageQueries(q)
    const vecQueries = have >= 3
      ? [queries[queries.length - 1] || q]
      : queries.slice(0, 2)
    for (const pq of vecQueries) {
      const vec = await requestSidecar(sidecar, {
        method: 'POST',
        path: '/_dsh/python',
        body: JSON.stringify({ op: 'search_passages', cwd, args: { query: pq, limit: 8 } }),
        cwd,
        timeoutMs: 3_000,
      })
      for (const row of (vec && vec.results) || []) {
        const id = String((row && row.id) || '')
        if (!id || seenId.has(id)) continue
        seenId.add(id)
        rows.push(row)
      }
    }
    merged = await mergePassageHits(merged, {
      rows,
      query: q,
      cwd,
      args,
      getPersistence: corpus.getPersistence,
    })
  } catch {
    /* substring hits still stand */
  }
  return merged
}

async function callTool(sidecar, op, args, exec, writes, corpus) {
  const snap = sidecar.snapshot()
  if (!snap.ready || !snap.port) {
    return JSON.stringify({ error: 'NOT_READY', reason: snap.reason || 'not_ready' })
  }
  const cwd = sessionCwd(exec)
  if (!cwd) return JSON.stringify({ error: 'NO_CWD' })
  const nextArgs = { ...(args || {}) }
  if ((op === 'extract_entities' || op === 'extract_relations') && corpus && typeof corpus.getExtract === 'function') {
    const text = String(nextArgs.text || '')
    const extract = corpus.getExtract()
    if (extract && typeof extract.extract === 'function' && hasCjk(text)) {
      const packed = await extract.extract(text)
      if (op === 'extract_entities') {
        return JSON.stringify({
          entities: packed.entities || [],
          relations: packed.relations || [],
          extractMethod: packed.via || 'dsh-llm',
        })
      }
      return JSON.stringify({
        relations: packed.relations || [],
        triplets: [],
        extractMethod: packed.via || 'dsh-llm',
      })
    }
  }
  if (op === 'search_text' && nextArgs.across_bridges === undefined) nextArgs.across_bridges = true
  if (op === 'open_node') {
    const opened = await openFromCorpus(nextArgs, corpus)
    if (opened && opened.ok) return JSON.stringify(opened)
  }
  const payload = JSON.stringify({ op, cwd, args: nextArgs })
  try {
    const body = await requestSidecar(sidecar, {
      method: 'POST',
      path: '/_dsh/python',
      body: payload,
      cwd,
      signal: exec?.signal,
      timeoutMs: op === 'search_text' ? 8_000 : 2 * 60 * 1000,
    })
    const mutating = ['extract_entities', 'extract_relations', 'record_decision', 'add_entity', 'add_relationship', 'upsert_workspace_vocab', 'nod_memory_card', 'nod_memory_edge', 'retire_memory_card', 'source_memory_card', 'renew_memory_card', 'mute_health_kind', 'draft_memory_card'].includes(op)
    if (mutating && writes && cwd && !(body && typeof body === 'object' && body.error)) writes.mark(cwd, op)
    let packed = body
    if (op === 'search_text') packed = await foldCorpusSearch(body, nextArgs, cwd, corpus, sidecar)
    packed = op === 'search_text' ? clipSearchPayload(packed, nextArgs) : packed
    if (op === 'search_text') {
      const text = typeof packed === 'string' ? packed : JSON.stringify(packed)
      void recordUsage({
        kind: 'search',
        bytes: Buffer.byteLength(text, 'utf8'),
        context: estimateTokens(text),
        via: 'search_text',
      }).catch(() => undefined)
    }
    return typeof packed === 'string' ? packed : JSON.stringify(packed)
  } catch (error) {
    return JSON.stringify({
      error: 'PYTHON_FAILED',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}
