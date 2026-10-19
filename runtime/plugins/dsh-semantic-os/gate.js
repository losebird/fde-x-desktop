/**
 * Host tools/pre-execute: hard gates always on. PolicyEngine is true/false only.
 * Only allow calls next(). deny/ask must not next(). warn = official ask.
 * @module dsh-semantic-os/gate
 */

import { isAbsolute, resolve, sep } from 'node:path'
import { postPython } from './ingest.js'

const PLUGIN_TOOLS = new Set([
  'extract_entities', 'extract_relations', 'record_decision', 'query_decisions',
  'find_precedents', 'get_causal_chain', 'add_entity', 'add_relationship',
  'run_reasoning', 'get_graph_analytics', 'export_graph', 'get_graph_summary',
  'search_text', 'lineage', 'brief_for_decision', 'query_graph', 'route_intent',
  'export_ledger', 'backup_graph', 'restore_graph', 'erase_ledger',
  'upsert_workspace_vocab', 'nod_memory_card', 'nod_memory_edge', 'retire_memory_card',
  'source_memory_card', 'renew_memory_card', 'mute_health_kind',
  'list_memory_cards', 'open_node', 'draft_memory_card',
])

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ sidecar: any, getConfig: Function, onBlocked?: Function }} opts
 */
export function registerGate(ctx, opts) {
  const { sidecar, getConfig } = opts
  let chain = Promise.resolve()
  const writeTools = new Set([
    'extract_entities', 'extract_relations', 'record_decision', 'add_entity', 'add_relationship',
    'upsert_workspace_vocab', 'nod_memory_card', 'nod_memory_edge', 'retire_memory_card',
    'source_memory_card', 'renew_memory_card', 'mute_health_kind',
    'draft_memory_card', 'erase_ledger', 'restore_graph',
  ])

  ctx.on('tools/pre-execute', async (exec, next) => {
    const name = String(exec && (exec.name || exec.toolName) || '')
    if (!PLUGIN_TOOLS.has(name)) return next()

    const run = async () => decide(exec, next, sidecar, getConfig, opts)
    if (!writeTools.has(name)) return run()
    const pending = chain.then(run, run)
    chain = pending.then(() => undefined, () => undefined)
    return pending
  })
}

async function decide(exec, next, sidecar, getConfig, opts) {
  const name = String(exec && (exec.name || exec.toolName) || '')
  const snap = sidecar.snapshot()
  const cwd = sessionCwd(exec)

  if (!snap.ready || !snap.port) {
    return deny('gate.hard.notReady', name, opts, exec)
  }
  if (!cwd) {
    return deny('gate.hard.noCwd', name, opts, exec)
  }

  const args = (exec && exec.arguments) || {}
  if (isDecisionsRestWrite(name, args)) {
    return deny('gate.hard.refuseDecisionsWrite', name, opts, exec)
  }
  if (name === 'record_decision' && !hasDecisionEvidence(args)) {
    return deny('gate.hard.decisionNeedsBrief', name, opts, exec)
  }
  if (name === 'record_decision' && wantsLiveBoard(args) && nodKind(args) !== '业务过账') {
    return deny('gate.hard.nodNotPosting', name, opts, exec)
  }
  if (name === 'record_decision' && wantsLiveBoard(args) && !hasLiveBoard(args)) {
    return deny(liveBoardDenyReason(args), name, opts, exec)
  }

  if (name === 'export_graph' || name === 'backup_graph' || name === 'restore_graph') {
    const dest = String(args.path || args.dest || args.output || '')
    if (dest && !insideCwd(cwd, dest)) {
      return ask('gate.hard.exportOutsideCwd', name)
    }
  }
  if ((name === 'erase_ledger' || name === 'restore_graph') && !args.confirm && !args.nodded) {
    return deny('gate.hard.eraseNeedsNod', name, opts, exec)
  }
  const memoryNods = ['nod_memory_card', 'nod_memory_edge', 'retire_memory_card', 'source_memory_card', 'renew_memory_card', 'mute_health_kind']
  if (memoryNods.includes(name) && !args.nodded && !args.pointed && !args['点头']) {
    return deny('gate.hard.memoryNeedsNod', name, opts, exec)
  }
  if (name === 'upsert_workspace_vocab' && !hasVocabConcepts(args)) {
    return deny('gate.hard.vocabNeedsConcepts', name, opts, exec)
  }

  try {
    const check = typeof opts.policy === 'function'
      ? opts.policy
      : (payload) => postPython(sidecar, payload)
    const policy = await check({
      op: 'policy_check',
      cwd,
      args: { tool: name, args },
    })
    if (policy && policy.error === 'NOT_READY') {
      return deny('gate.failClosed', name, opts, exec)
    }
    if (policy && policy.ok === false) {
      return deny('gate.block', name, opts, exec)
    }
    if (policy && policy.warn === true) {
      return ask('gate.warn', name)
    }
  } catch {
    return deny('gate.failClosed', name, opts, exec)
  }

  return next()
}

function deny(reason, toolName, opts, exec) {
  if (typeof opts.onBlocked === 'function') {
    try { opts.onBlocked(sessionCwd(exec), toolName, reason) } catch { /* ignore */ }
  }
  const tool = String(toolName || '')
  const message = `门禁挡住了「${tool}」（${reason}）。可以去问同事，把挡住的这条带上。仍须人点发送，不会自动发。`
  return { kind: 'deny', reason, tool, message }
}

function ask(reason, toolName) {
  return { kind: 'ask', reason: `${reason}:${toolName}` }
}

function sessionCwd(exec) {
  const cwd = exec && exec.agent && exec.agent.session && exec.agent.session.header && exec.agent.session.header.cwd
  return typeof cwd === 'string' && cwd.trim() ? cwd : ''
}

function hasVocabConcepts(args) {
  const rows = args && args.concepts
  return Array.isArray(rows) && rows.some((row) => row && typeof row === 'object'
    && (String(row.label || row.kind || row.id || '').trim()))
}

function hasDecisionEvidence(args) {
  const rows = args && (args.because || args.evidence || args.supports)
  if (Array.isArray(rows)) return rows.some((row) => String(row || '').trim())
  return Boolean(String(rows || '').trim())
}

function idList(value) {
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  if (Array.isArray(value)) return value.map((row) => String(row || '').trim()).filter(Boolean)
  return []
}

function receiptId(args) {
  const meta = args && args.metadata && typeof args.metadata === 'object' ? args.metadata : {}
  for (const key of ['receipt_id', 'receiptId', 'receipt']) {
    const text = String((args && args[key]) || meta[key] || '').trim()
    if (text) return text
  }
  return ''
}

function nodKind(args) {
  const meta = args && args.metadata && typeof args.metadata === 'object' ? args.metadata : {}
  return String((args && (args.nod_kind || args.nodKind)) || meta.nod_kind || meta.nodKind || '').trim()
}

function wantsLiveBoard(args) {
  const status = String((args && (args.status || args.board_status)) || '').trim()
  return status === '已生效'
}

function hasLiveBoard(args) {
  return idList(args && (args.because || args.evidence || args.supports)).length
    && idList(args && (args.leads_to || args.consequences || args.causes)).length
    && Boolean(receiptId(args))
}

function liveBoardDenyReason(args) {
  if (!idList(args && (args.because || args.evidence || args.supports)).length) return 'gate.hard.decisionNeedsBrief'
  if (!idList(args && (args.leads_to || args.consequences || args.causes)).length) return 'gate.hard.decisionNeedsLeadsTo'
  return 'gate.hard.decisionNeedsReceipt'
}

function isDecisionsRestWrite(name, args) {
  if (name !== 'record_decision' && name !== 'export_graph') {
    const method = String(args.method || '').toUpperCase()
    const path = String(args.path || args.url || '')
    if (path.includes('/api/decisions') && method && method !== 'GET' && method !== 'HEAD') return true
  }
  return false
}

function insideCwd(cwd, dest) {
  if (!dest) return true
  try {
    const root = resolve(cwd)
    const abs = isAbsolute(dest) ? resolve(dest) : resolve(cwd, dest)
    const prefix = root.endsWith(sep) ? root : root + sep
    return abs === root || abs.startsWith(prefix)
  } catch {
    return false
  }
}
