/**
 * Gate + secretary core. FDE imports this via runtime/lan-assist-engine.mjs.
 * Do not load client.js.
 */
import { createLocalHandler, createSseHub } from './http.js'
import {
  armHandoffConfirmWindow,
  markHandoffToken,
  openHandoffMints,
  speechForPlanHandoffMint,
} from './handoff-mints.js'
import { createLookup } from './lookup.js'
import { createSecretary } from './secretary.js'
import {
  createSessionRoundStore,
  isConfirmableWritePreview,
  sheetCarriesWrittenIdentity,
  stampWroteLookup,
  wroteLookupLocksSpec,
} from './session-round.js'
import { createStore } from './store.js'
import { createTraceLog } from './traces.js'
import { createGate, createNocoWrite, WORKSTATION_CONFIRM_HINT } from './write.js'

export {
  createGate,
  createLocalHandler,
  createLookup,
  createNocoWrite,
  createSecretary,
  createSseHub,
  createStore,
  WORKSTATION_CONFIRM_HINT,
}

export async function resolveLanAssistConnections(store) {
  const state = await store.get()
  const staffId = (state.self && state.self.staffId) || ''
  const listed = Array.isArray(state.lookups) && state.lookups.length
    ? state.lookups
    : (state.lookup && state.lookup.baseUrl ? [{ id: 'default', ...state.lookup }] : [])
  const connections = []
  for (const row of listed) {
    const id = String((row && row.id) || 'default')
    const key = id === 'default' ? 'lookupToken' : `lookupToken:${id}`
    connections.push({
      id,
      dialect: (row && row.dialect) || 'nocobase',
      baseUrl: (row && row.baseUrl) || '',
      system: (row && row.system) || '',
      env: (row && row.env) || '',
      listPath: (row && row.listPath) || '',
      ticketField: (row && row.ticketField) || '',
      statusField: (row && row.statusField) || '',
      ownerField: (row && row.ownerField) || '',
      writePath: (row && row.writePath) || '',
      writeMethod: (row && row.writeMethod) || '',
      token: typeof store.getSecret === 'function' ? await store.getSecret(key) : '',
      staffId,
    })
  }
  return { staffId, connections }
}

export function wireOfficialOccupancy(secretary, { gate, sessionRounds, sse }) {
  const attachOfficial = (view, sessionId) => {
    if (!view || typeof view !== 'object') return view
    const sid = String(sessionId || (view.pendingSheet && view.pendingSheet.sessionId) || '').trim()
    const writePreview = typeof gate.previewTokenIndex === 'function' ? gate.previewTokenIndex() : {}
    const handoffMints = openHandoffMints(gate.tokens)
    return { ...view, officialRoundSheet: sessionRounds.servedSheet(sid), writePreview, handoffMints }
  }
  function planHandoffMintEvent(spec, result, sessionId) {
    if (spec && spec.workstation === true) return null
    const sheet = result && result.sheet && typeof result.sheet === 'object'
      ? result.sheet
      : (result && typeof result === 'object' ? result : null)
    if (!sheet || (result && result.ok === false)) return null
    const previewId = String(
      sheet.preview_id || sheet.previewId || (result && (result.preview_id || result.previewId)) || '',
    ).trim()
    if (!previewId) return null
    const changes = []
    for (const row of Array.isArray(sheet.changes) ? sheet.changes : []) {
      if (!row || typeof row !== 'object') continue
      const field = String(row.field || '').trim()
      if (!field) continue
      changes.push({
        field,
        label: String(row.label || field),
        from: row.from == null ? '' : String(row.from),
        to: row.to == null ? '' : String(row.to),
      })
    }
    return {
      type: 'mint',
      sessionId: String(sessionId || sheet.sessionId || (spec && spec.sessionId) || '').trim(),
      previewId,
      workstation: false,
      action: String(sheet.action || (spec && spec.action) || '').trim(),
      changes,
    }
  }
  function emitPlanHandoffMint(event) {
    if (!event) return
    sse.emit('mailbox', {
      type: 'handoff-preview',
      sessionId: event.sessionId,
      previewId: event.previewId,
      workstation: false,
      action: event.action,
      changes: event.changes,
    })
  }
  const origPreviewBiz = secretary.previewBiz.bind(secretary)
  secretary.previewBiz = async (spec = {}) => {
    const sid = String((spec && spec.sessionId) || '').trim()
    const toolAction = String((spec && spec.action) || '').trim()
    const followup = Boolean(sid && sessionRounds.isWroteFollowup(sid) && toolAction === '现查')
    const ident = followup && typeof sessionRounds.wroteIdentity === 'function' ? sessionRounds.wroteIdentity(sid) : null
    if (followup && ident) {
      const official = sessionRounds.officialSheet(sid)
      if (
        official
        && String(official.action || '').trim() === '现查'
        && sheetCarriesWrittenIdentity(official, ident)
        && Array.isArray(official.rows)
        && official.rows.some((row) => String((row && row.no) || '').trim())
      ) {
        return {
          ok: true,
          action: '现查',
          kind: official.kind,
          querySettled: true,
          querySettledRepeat: true,
          error: 'QUERY_SETTLED',
          sheet: official,
          published: true,
        }
      }
    }
    const locked = Boolean(ident && wroteLookupLocksSpec(spec, ident))
    const stamped = locked ? stampWroteLookup(spec, ident, { lock: true }) : spec
    const incoming = locked ? { ...stamped, lookupLocked: true } : stamped
    const result = await origPreviewBiz(incoming)
    const sheet = result && result.sheet && typeof result.sheet === 'object'
      ? result.sheet
      : (result && typeof result === 'object' ? result : null)
    const publishSid = String((spec && spec.sessionId) || (sheet && sheet.sessionId) || sid || '').trim()
    if (
      spec && spec.workstation === true
      && publishSid
      && result && result.ok !== false
      && isConfirmableWritePreview(sheet)
    ) {
      const published = sessionRounds.publishOfficial(publishSid, { ...sheet, ok: true, sessionId: publishSid })
      if (published) sse.emit('mailbox', { type: 'official-sheet', sessionId: publishSid })
      if (result && typeof result === 'object') return { ...result, published: true }
      return result
    }
    const handoffEvent = planHandoffMintEvent(spec, result, publishSid)
    if (handoffEvent) {
      emitPlanHandoffMint(handoffEvent)
      const token = gate.tokens && typeof gate.tokens.get === 'function'
        ? gate.tokens.get(handoffEvent.previewId)
        : null
      markHandoffToken(token, handoffEvent)
      armHandoffConfirmWindow(handoffEvent.sessionId)
      if (result && typeof result === 'object') {
        return { ...speechForPlanHandoffMint(result, handoffEvent), published: false }
      }
      return result
    }
    if (result && typeof result === 'object') return { ...result, published: false }
    return result
  }
  if (typeof secretary.commitWrite === 'function') {
    const origCommitWrite = secretary.commitWrite.bind(secretary)
    secretary.commitWrite = async (spec = {}) => {
      const sid = String((spec && spec.sessionId) || '').trim()
      const official = sid ? sessionRounds.officialSheet(sid) : null
      const result = await origCommitWrite(official ? { ...spec, officialSheet: official } : spec)
      const sheet = result && result.sheet && typeof result.sheet === 'object' ? result.sheet : null
      const publishSid = String((spec && spec.sessionId) || (sheet && sheet.sessionId) || sid || '').trim()
      if (result && result.ok && sheet && publishSid) {
        const published = sessionRounds.publishOfficial(publishSid, sheet)
        if (published) sse.emit('mailbox', { type: 'official-sheet', sessionId: publishSid })
      }
      return result
    }
  }
  if (typeof secretary.dismissWrite === 'function') {
    const origDismissWrite = secretary.dismissWrite.bind(secretary)
    secretary.dismissWrite = async (spec = {}) => {
      const result = await origDismissWrite(spec)
      const restored = result && result.pendingSheet && typeof result.pendingSheet === 'object'
        ? result.pendingSheet
        : null
      const publishSid = String(
        (spec && spec.sessionId)
        || (restored && restored.sessionId)
        || '',
      ).trim()
      if (publishSid) sessionRounds.republishAfterDismiss(publishSid, restored)
      if (result && typeof result === 'object') return { ...result, publishedSessionId: publishSid }
      return result
    }
  }
  const origHall = secretary.hall.bind(secretary)
  const origSnapshot = secretary.snapshot.bind(secretary)
  secretary.hall = async (sid) => attachOfficial(await origHall(sid), sid)
  secretary.snapshot = async (sid) => attachOfficial(await origSnapshot(sid), sid)
  return { attachOfficial }
}

export async function createLanAssistCore(adapters = {}) {
  const store = adapters.store || createStore()
  const sse = adapters.sse || createSseHub()
  const sessionRounds = adapters.sessionRounds || createSessionRoundStore()
  const traces = adapters.traces || createTraceLog()
  const resolveConnections = adapters.resolveConnections || (() => resolveLanAssistConnections(store))
  const lookup = createLookup({ resolve: resolveConnections })
  const writer = createNocoWrite({ resolve: resolveConnections })
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    fieldsOf: (kind, vocab) => lookup.fieldsOf(kind, vocab),
    collectionsOf: () => lookup.collectionsFor(),
    resolveConnections,
    postWrite: (spec) => writer.write(spec),
    roundSpeech: (sid) => sessionRounds.roundSpeech(sid),
    loadVocab: adapters.loadVocab,
    saveVocab: adapters.saveVocab,
    traces,
  })
  const secretary = createSecretary({
    store,
    port: adapters.port,
    send: adapters.send,
    relayStatus: adapters.relayStatus,
    onRelayChange: adapters.onRelayChange,
    publicDoors: adapters.publicDoors,
    looksLikeChoice: adapters.looksLikeChoice,
    ingestPaths: adapters.ingestPaths,
    univer: adapters.univer,
    brief: adapters.brief,
    record: adapters.record,
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: adapters.loadVocab,
    collectionsOf: () => lookup.collectionsFor(),
    traces,
    saveVocab: adapters.saveVocab,
    gate,
    officialSheet: (sessionId) => sessionRounds.officialSheet(sessionId),
    onPreview: () => sse.emit('mailbox', { type: 'preview' }),
    hasEyes: adapters.hasEyes,
    see: adapters.see,
    readSession: adapters.readSession,
  })
  wireOfficialOccupancy(secretary, { gate, sessionRounds, sse })
  return {
    store,
    sse,
    sessionRounds,
    traces,
    lookup,
    writer,
    gate,
    secretary,
    resolveConnections,
  }
}
