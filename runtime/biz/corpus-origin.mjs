import { getBizWriteAuditByTraceId } from '../db.mjs'
import { parseLookupBind } from './audit-lookup.mjs'
import { looksLikeJsonDump, readSessionUserOrigin } from './session-origin-text.mjs'

function workspaceOf(url, audit) {
  const fromQuery = String(url?.searchParams?.get('cwd') || url?.searchParams?.get('workspace') || '').trim()
  if (fromQuery.startsWith('/')) return fromQuery
  const fromAudit = String(audit?.workspaceCwd || '').trim()
  return fromAudit.startsWith('/') ? fromAudit : ''
}

function notedSpeech(audit) {
  const bind = parseLookupBind(audit)
  const speech = String(bind.speech || '').trim()
  if (!speech || speech === '回退' || looksLikeJsonDump(speech)) return ''
  return speech
}

function sessionIdOf(audit, traceRow) {
  const bind = parseLookupBind(audit)
  return String(
    audit?.sessionId
    || bind.sessionId
    || traceRow?.sessionId
    || traceRow?.session_id
    || '',
  ).trim()
}

async function loadTraceRow(aiRuntime, workspace, traceId) {
  if (!aiRuntime || typeof aiRuntime.lanAssist !== 'function' || !workspace) return null
  try {
    const traces = await aiRuntime.lanAssist('/traces', {
      search: { workspace, id: traceId },
    })
    if (traces && traces.ok === false) return null
    const row = traces?.row && typeof traces.row === 'object' ? traces.row : null
    if (row) return row
    const rows = Array.isArray(traces?.rows) ? traces.rows : []
    return rows.find((item) => String(item?.id || item?.traceId || '') === traceId) || null
  } catch {
    return null
  }
}

function unreadableReason(audit, sessionId) {
  if (!audit) return '找不到这条操作记录，读不出当时原文。'
  if (sessionId) return '这条操作关联了会话，但会话原文读不出来。不是回退，也不是业务表。'
  if (String(audit.source || '') === 'workstation') {
    return '这条是工作台写入，当时没有关联会话，也没有记下原话，无法核对凭什么改。'
  }
  return '暂时读不出当时对话或记下的文本。不是回退，也不是业务表。'
}

/**
 * Original conversation / noted speech for a biz write. Never JSON dumps or receipts.
 * @param {{ db: unknown, aiRuntime?: { lanAssist?: Function }, traceId: string, url?: URL, sessionRoot?: string }} spec
 */
export async function resolveBizCorpusOrigin(spec) {
  const traceId = String(spec?.traceId || '').trim()
  const href = { panel: 'data', tab: 'operations', traceId }
  if (!traceId) {
    return { ok: false, message: '缺少操作记录 id，读不出当时原文。', href }
  }
  const audit = getBizWriteAuditByTraceId(spec.db, traceId)
  const workspace = workspaceOf(spec.url, audit)
  const traceRow = await loadTraceRow(spec.aiRuntime, workspace, traceId)
  const sessionId = sessionIdOf(audit, traceRow)
  if (sessionId) {
    const origin = await readSessionUserOrigin(sessionId, { sessionRoot: spec.sessionRoot })
    if (origin && !looksLikeJsonDump(origin)) {
      return { ok: true, title: '当时原文', text: origin, href }
    }
  }
  const noted = notedSpeech(audit)
  if (noted) {
    return { ok: true, title: '当时原文', text: noted, href }
  }
  return { ok: false, message: unreadableReason(audit, sessionId), href }
}
