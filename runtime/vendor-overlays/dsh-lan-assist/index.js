/**
 * Host plugin: LAN mailbox + same-origin /lan-assist + tools/commands.
 * Followup happens after a human adopt or 拟回 click. Typed chat is already a session.
 * @module dsh-lan-assist
 */

import { readdir, readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { registerCommands } from './commands.js'
import { DEFAULT_LAN_PORT, PLUGIN, assistHome } from './home.js'
import { createLocalHandler, createSseHub } from './http.js'
import { randomUUID } from 'node:crypto'
import { keyFromHex, verifyFrame } from './crypto.js'
import { absCwd, routeOf, seedEventsOf } from './handoff.js'
import { createLanServer, guessPeerDoor, publicDoors } from './lan.js'
import { createLanFirstTransport, createLanTransport } from './transport.js'
import { createNatsTransport, relayCredsPath, relayUrl, setRelayStore } from './nats-relay.js'
import { installUserAutostart, removeUserAutostart, startListenDaemon, stopListenDaemon } from './listen.js'
import { importPeer } from './peers.js'
import { createSecretary } from './secretary.js'
import { copyLetterAttach } from './copy-attach.js'
import { normalizeCwd, placeEmptyHomes } from './letter-home.js'
import { createSemanticBridge, cwdFromWorkspaceStore, extractUserSpeech, looksLikeChoice, readLeftIds } from './semantic.js'
import { createStore } from './store.js'
import { registerTools, toolSessionId } from './tools.js'
import { createLookup, collapseKindsToConnectedTables } from './lookup.js'
import { translateQuote } from './translate.js'
import { createEyesSee, hasEyes } from './eyes-bridge.js'
import { createGate, createNocoWrite, WORKSTATION_CONFIRM_HINT } from './write.js'
import { rememberUserSpeech, speechHoldsWorkstationWrite } from './slots.js'
import { createTraceLog } from './traces.js'
import {
  createSessionRoundStore,
  stampWroteLookup,
  wroteLookupLocksSpec,
  roundBlocksChatAsk,
  isConfirmableWritePreview,
  sheetCarriesWrittenIdentity,
} from './session-round.js'
import { projectOfficialKind } from './operation-kind-sheet.mjs'
import { describeKindCatalog } from './catalog.js'

const schemaMod = await importPeer('@deepseek-ai/schemastery')
const { defineTool } = await importPeer('@deepseek-ai/dsh-tools')
const Schema = schemaMod.default

export const name = PLUGIN
export const inject = ['tools', 'webServer', 'llm', 'agents']

export const Config = Schema.object({
  lanPort: Schema.number().default(DEFAULT_LAN_PORT),
  lanHost: Schema.string().default('0.0.0.0'),
})

async function loadWorkspaceVocab(semantic, workspace) {
  const found = await semantic.vocab(workspace)
  if (found && found.ok) {
    const raw = Array.isArray(found.kinds) ? found.kinds : []
    return collapseKindsToConnectedTables(raw).kinds
  }
  const err = new Error((found && found.error) || 'NO_VOCAB')
  err.code = 'NO_VOCAB'
  throw err
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {Record<string, unknown>} config
 */
export async function apply(ctx, config) {
  const port = Number(process.env.DSH_LAN_ASSIST_PORT || (config && config.lanPort) || DEFAULT_LAN_PORT)
  const host = String((config && config.lanHost) || '0.0.0.0')
  const store = createStore()
  const sse = createSseHub()
  const sessionRounds = createSessionRoundStore()
  let lan = null
  /** @type {any} */
  let agentsCtx = ctx

  async function deliverFollowup(followup) {
    const sid = String(followup && followup.sessionId || '').trim()
    const close = followup && followup.roundClose
    if (sid && close) sessionRounds.closeRound(sid, close, { identity: followup.wroteIdentity })
    return tryFollowup(agentsCtx, followup)
  }

  const semantic = createSemanticBridge({
    resolvePage: () => {
      const ws = ctx.webServer
      const port = ws && typeof ws.port === 'number' ? ws.port : Number(ws?.port)
      if (Number.isFinite(port) && port > 0) return `http://127.0.0.1:${port}`
      return ''
    },
    resolveCwd: async (sessionId) => {
      const live = agentsCtx && agentsCtx.agents
      const agent = live && typeof live.get === 'function' ? live.get(sessionId) : undefined
      const cwd = agent && agent.session && agent.session.header && agent.session.header.cwd
      if (typeof cwd === 'string' && cwd.trim()) return cwd.trim()
      return cwdFromWorkspaceStore(sessionId)
    },
  })
  async function resolveConnections() {
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
  const lookup = createLookup({ resolve: resolveConnections })
  const writer = createNocoWrite({ resolve: resolveConnections })
  const traces = createTraceLog()
  let restartRelayListen = async () => undefined
  function relayListenEnv() {
    const env = {}
    const nats = relayUrl()
    const creds = relayCredsPath()
    if (nats) env.DSH_LAN_ASSIST_NATS = nats
    if (creds) env.DSH_LAN_ASSIST_NATS_CREDS = creds
    return env
  }
  const boot = await store.get()
  setRelayStore({
    url: boot.relayUrl,
    credsPath: typeof store.getSecret === 'function' ? await store.getSecret('natsCredsPath') : '',
  })
  const relay = createNatsTransport({ lazy: true })
  const transport = createLanFirstTransport({ lan: createLanTransport(), relay })
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    fieldsOf: (kind, vocab) => lookup.fieldsOf(kind, vocab),
    collectionsOf: () => lookup.collectionsFor(),
    resolveConnections,
    postWrite: (spec) => writer.write(spec),
    roundSpeech: (sid) => sessionRounds.roundSpeech(sid),
    loadVocab: async (workspace) => loadWorkspaceVocab(semantic, workspace),
    saveVocab: async (workspace, concept) => semantic.upsertVocab(workspace, concept),
    traces,
  })
  const secretary = createSecretary({
    store,
    port,
    send: (door, frame, opts) => transport.send(door, frame, opts),
    relayStatus: () => (relay && typeof relay.status === 'function'
      ? relay.status()
      : { configured: false, connected: false }),
    onRelayChange: async () => {
      await restartRelayListen()
      try {
        const state = await store.get()
        if (state.listenGranted) await installUserAutostart(port, relayListenEnv())
      } catch { /* autostart is best effort */ }
    },
    publicDoors: () => publicDoors(port),
    looksLikeChoice,
    ingestPaths: (workspace, paths) => semantic.ingestPaths(workspace, paths),
    univer: () => ctx.get('univer'),
    brief: (sessionId, scenario, workspace) => semantic.brief(sessionId, scenario, workspace),
    record: (sessionId, payload) => semantic.record(sessionId, payload),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async (workspace) => loadWorkspaceVocab(semantic, workspace),
    traces,
    saveVocab: async (workspace, concept) => semantic.upsertVocab(workspace, concept),
    gate,
    officialSheet: (sessionId) => sessionRounds.officialSheet(sessionId),
    onPreview: () => sse.emit('mailbox', { type: 'preview' }),
    hasEyes: () => hasEyes(ctx),
    see: createEyesSee(ctx),
    readSession: (sessionId) => readSessionTurns(agentsCtx, sessionId),
  })
  const grantListen = secretary.grantListen
  secretary.placeLetters = async (spec = {}) => {
    const cwd = normalizeCwd(spec && spec.workspace)
    if (!cwd) {
      return { ok: false, error: 'NO_CWD', hint: '要归到一个本机工作区目录。' }
    }
    const ids = Array.isArray(spec.requestIds)
      ? spec.requestIds.map((id) => String(id || '')).filter(Boolean)
      : []
    if (!ids.length) return { ok: false, error: 'NO_LETTER', hint: '没有要归的信。' }
    const at = Date.now()
    await store.update((s) => {
      placeEmptyHomes(s.requests, ids, cwd, at)
    })
    const view = typeof secretary.snapshot === 'function' ? await secretary.snapshot() : {}
    return { ok: true, workspace: cwd, requestIds: ids, ...view }
  }
  const origCopyAttachment = secretary.copyAttachment
  const origGetAttachment = secretary.getAttachment
  if (typeof origCopyAttachment === 'function' && typeof origGetAttachment === 'function') {
    secretary.copyAttachment = (spec) => copyLetterAttach(origCopyAttachment, origGetAttachment, spec)
  }
  secretary.grantListen = async (on) => {
    const result = await grantListen(on)
    try {
      if (on) await installUserAutostart(port, relayListenEnv())
      else await removeUserAutostart()
    } catch { /* user-level autostart is best effort */ }
    return result
  }
  const attachOfficial = (view, sessionId) => {
    if (!view || typeof view !== 'object') return view
    const sid = String(sessionId || (view.pendingSheet && view.pendingSheet.sessionId) || '').trim()
    const writePreview = typeof gate.previewTokenIndex === 'function' ? gate.previewTokenIndex() : {}
    return { ...view, officialRoundSheet: sessionRounds.servedSheet(sid), writePreview }
  }
  if (typeof secretary.describeBiz === 'function') {
    secretary.describeBiz = async (spec = {}) => {
      const cwd = String((spec && spec.workspace) || '').trim()
      if (!cwd) return { ok: false, error: 'NO_CWD', hint: '这封没绑工作区，不能打开目录。' }
      let vocab = []
      try {
        const loaded = await loadWorkspaceVocab(semantic, cwd)
        vocab = Array.isArray(loaded) ? loaded : []
      } catch {
        vocab = []
      }
      let collections = []
      try {
        collections = await lookup.collectionsFor()
      } catch {
        collections = []
      }
      const catalog = describeKindCatalog(vocab, { collections })
      const want = String((spec && spec.kind) || '').trim()
      if (!want) return catalog
      return {
        ...catalog,
        kinds: catalog.kinds.filter((row) => row.kind === want),
        relations: catalog.relations.filter((row) => row.from === want || row.to === want),
      }
    }
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

  async function onLanFrame(frame, meta) {
    const type = frame && frame.type
    if (type && String(type).startsWith('pair.')) {
      const result = typeof secretary.acceptPairFrame === 'function'
        ? await secretary.acceptPairFrame(frame)
        : { ok: false, error: 'NO_PAIR' }
      sse.emit('mailbox', { type })
      return result
    }
    if (type === 'hello') {
      const remote = guessPeerDoor(meta.remote, frame.door, port)
      const accepted = await secretary.acceptHello(frame, remote)
      if (accepted && accepted.ok === false && frame.from) {
        await secretary.noteSighting({
          id: frame.from,
          displayName: frame.fromName,
          door: remote,
        })
      }
      sse.emit('mailbox', { type: 'hello' })
      return accepted
    }
    if (type === 'shout') {
      const claimed = String((frame && frame.door) || '')
      const remote = claimed ? guessPeerDoor(meta.remote, claimed, port) : ''
      const from = String((frame && frame.from) || '')
      const peer = from ? await secretary.peerFor(from) : null
      if (peer && peer.keyHex && !peer.unpaired) {
        try {
          if (!verifyFrame(keyFromHex(peer.keyHex), frame)) return { ok: false, error: 'BAD_MAC' }
        } catch {
          return { ok: false, error: 'BAD_MAC' }
        }
        await secretary.hear(from, remote, frame.fromName, frame.avatar)
        sse.emit('mailbox', { type: 'shout' })
        return { ok: true }
      }
      await secretary.noteSighting({
        id: from,
        displayName: frame.fromName,
        door: remote,
      })
      return { ok: true, trusted: false }
    }
    const from = String((frame && frame.from) || '')
    const peer = await secretary.peerFor(from)
    if (!peer || peer.unpaired || !peer.keyHex) {
      if (from) {
        await secretary.noteSighting({
          id: from,
          displayName: frame.fromName,
          door: guessPeerDoor(meta.remote, frame.door, port),
        })
      }
      return { ok: false, error: 'KEY_REJECT' }
    }
    const fresh = await secretary.noteSeen(from, frame.nonce)
    if (!fresh) return { ok: false, error: 'REPLAY' }
    if (frame.door) await secretary.hear(from, frame.door, frame.fromName, frame.avatar)
    let result = { ok: false, error: 'UNKNOWN' }
    if (type === 'envelope') result = await secretary.receiveEnvelope(frame, peer)
    else if (type === 'reply') result = await secretary.receiveReply(frame, peer)
    else if (type === 'ack') result = await secretary.receiveAck(frame, peer)
    sse.emit('mailbox', { type })
    return result
  }

  lan = createLanServer({ port, host, onFrame: onLanFrame })

  function refuseWorkstationChatAsk(request, next) {
    const round = sessionRounds.peek(toolSessionId(request))
    const writeSpeech = Boolean(round && speechHoldsWorkstationWrite(round.userSpeech))
    if (roundBlocksChatAsk(round, writeSpeech)) {
      const err = new Error(WORKSTATION_CONFIRM_HINT)
      err.code = 'NEED_WORKSTATION_CONFIRM'
      return Promise.reject(err)
    }
    return next()
  }

  const boundAskRefuse = new WeakSet()
  function bindWorkstationAskRefuse(agent) {
    if (!agent || boundAskRefuse.has(agent)) return
    const scoped = agent.ctx
    if (!scoped || typeof scoped.on !== 'function') return
    scoped.on('user-questions/request', refuseWorkstationChatAsk, { prepend: true })
    boundAskRefuse.add(agent)
  }

  ctx.on('agent/created', ({ agent }) => bindWorkstationAskRefuse(agent))
  const liveAgents = ctx.agents
  if (liveAgents && typeof liveAgents.list === 'function') {
    for (const agent of liveAgents.list()) bindWorkstationAskRefuse(agent)
  }

  ctx.inject(['sessions'], (sctx) => {
    try {
      sctx.on('session/event', (session, event) => {
        const sessionId = session && (session.id || (session.header && session.header.id))
        if (event && event.type === 'assistant/message') {
          const draft = secretary.takeAssistantText(event)
          if (draft) {
            void secretary.acceptDraftFromSession(sessionId, draft).then((result) => {
              if (result && result.ok) sse.emit('mailbox', { type: 'draft' })
            }).catch(() => undefined)
          }
          return
        }
        if (event && event.type === 'turn/start') {
          const prev = sessionRounds.peek(sessionId)
          const followup = Boolean(prev && !prev.open && prev.closedBy === 'wrote' && prev.wroteFollowup)
          sessionRounds.startRound(sessionId, { followup })
        }
        if (event && event.type === 'turn/end') {
          const closed = sessionRounds.closeRound(sessionId, 'turn')
          if (closed.emit) sse.emit('mailbox', { type: 'official-sheet', sessionId: String(sessionId || '') })
          void secretary.finalizeDraftFromSession(sessionId).then((result) => {
            if (result && result.ok) sse.emit('mailbox', { type: 'draft' })
          }).catch(() => undefined)
          return
        }
        const speech = extractUserSpeech(event)
        if (!speech) return
        sessionRounds.noteHumanUtterance(sessionId)
        const prevRound = sessionRounds.peek(sessionId)
        if (prevRound && prevRound.open) {
          const closed = sessionRounds.closeRound(sessionId, 'turn')
          if (closed.emit) sse.emit('mailbox', { type: 'official-sheet', sessionId: String(sessionId || '') })
        }
        sessionRounds.startRound(sessionId, { utterance: true, speech })
        rememberUserSpeech(sessionId, speech)
        const workspace = session && session.header && typeof session.header.cwd === 'string'
          ? session.header.cwd.trim()
          : ''
        void secretary.hearUserLine(sessionId, speech, workspace).then((result) => {
          if (result && result.followup) void deliverFollowup(result.followup).catch(() => undefined)
          if (result && result.ok && !result.skipped) sse.emit('mailbox', { type: 'advice' })
        }).catch(() => undefined)
      })
    } catch { /* session events optional */ }
  })

  const handler = createLocalHandler({
    secretary,
    lan,
    sse,
    followup: (spec) => deliverFollowup(spec),
    restoreHandoff: (spec) => tryRestoreHandoff(agentsCtx, spec),
    translate: (quote) => translateQuote((ctx.llm || (ctx.get && ctx.get('llm'))), quote),
    focusOperationKind: async (sessionId, kind) => {
      return projectOfficialKind(sessionRounds.officialSheet(sessionId), kind)
    },
  })

  if (ctx.webServer && typeof ctx.webServer.register === 'function') {
    ctx.effect(() => ctx.webServer.register({
      kind: 'prefix',
      path: '/lan-assist',
      handler,
    }))
  }

  ctx.effect(() => {
    let stopRelay = null
    restartRelayListen = async () => {
      if (typeof stopRelay === 'function') {
        stopRelay()
        stopRelay = null
      }
      if (relay && typeof relay.close === 'function') await relay.close()
      const self = (await store.get()).self
      const st = relay && typeof relay.status === 'function' ? relay.status() : { configured: false }
      if (relay && st.configured && self && self.id && typeof relay.listen === 'function') {
        stopRelay = await relay.listen(self.id, (frame) => onLanFrame(frame, { remote: 'relay' }))
      }
    }
    void (async () => {
      await stopListenDaemon()
      await drainListenInbox(secretary).catch(() => undefined)
      await lan.start()
      await restartRelayListen()
    })().catch((error) => {
      ctx.logger?.warn?.(`[${PLUGIN}] lan listen failed: ${error instanceof Error ? error.message : error}`)
    })
    let ticking = false
    const timer = setInterval(() => {
      if (ticking) return
      ticking = true
      void secretary.tick()
        .then((view) => (view && view.changed
          ? readLeftIds().then((ids) => secretary.applyLeftIds(ids)).then(() => view)
          : view))
        .then((view) => secretary.shout().then(() => view))
        .then((view) => {
          sse.emit('mailbox', { type: 'tick' })
          return view
        })
        .catch(() => undefined)
        .finally(() => { ticking = false })
    }, 15_000)
    return () => {
      clearInterval(timer)
      sse.close()
      if (typeof stopRelay === 'function') stopRelay()
      void lan.stop().then(async () => {
        if (relay && typeof relay.close === 'function') await relay.close()
        const view = await secretary.snapshot()
        if (view.listenGranted) await startListenDaemon(port, relayListenEnv())
      }).catch(() => undefined)
    }
  })

  try {
    registerTools(ctx, { defineTool }, secretary, {
      noteToolSheet: (sessionId, sheet) => {
        const outcome = sessionRounds.noteToolSheet(sessionId, sheet)
        if (outcome && outcome.emit) {
          sse.emit('mailbox', { type: 'official-sheet', sessionId: String(sessionId || '') })
        }
        return outcome
      },
      notePostSettledHopTool: (sessionId, toolName) => sessionRounds.notePostSettledHopTool(sessionId, toolName),
    })
    ctx.tools.guard((exec) => {
      if (!exec || String(exec.name || '') !== 'ask_user_question') return
      const round = sessionRounds.peek(toolSessionId(exec))
      const writeSpeech = Boolean(round && speechHoldsWorkstationWrite(round.userSpeech))
      if (roundBlocksChatAsk(round, writeSpeech)) return WORKSTATION_CONFIRM_HINT
    })
  } catch (error) {
    ctx.logger?.warn?.(`[${PLUGIN}] tools: ${error instanceof Error ? error.message : error}`)
  }
  ctx.inject(['commands'], (cctx) => {
    registerCommands(cctx, secretary)
  })
}

function copySessionTurns(session) {
  const events = session && Array.isArray(session.events) ? session.events : []
  const out = []
  for (const event of events) {
    if (!event) continue
    const type = event.type
    if (type !== 'user/message' && type !== 'assistant/message') continue
    const data = event.data || {}
    const source = data.source || {}
    const message = data.message || {}
    const blocks = Array.isArray(data.content)
      ? data.content
      : (Array.isArray(message.content) ? message.content : [])
    const content = []
    for (const block of blocks) {
      if (block && block.type === 'text' && typeof block.text === 'string') {
        content.push({ type: 'text', text: block.text })
      }
    }
    if (!content.length) continue
    out.push({
      type,
      data: {
        source: { kind: source.kind || '', plugin: source.plugin || '' },
        content,
      },
    })
  }
  const header = (session && session.header) || {}
  return {
    events: out,
    cwd: typeof header.cwd === 'string' ? header.cwd : '',
    title: typeof session.title === 'string' ? session.title : '',
  }
}

async function readSessionTurns(ctx, sessionId) {
  const sid = String(sessionId || '').trim()
  if (!sid) return null
  const agents = ctx && (ctx.agents || (typeof ctx.get === 'function' ? ctx.get('agents') : undefined))
  if (!agents) return null
  let agent = typeof agents.get === 'function' ? agents.get(sid) : undefined
  if (!agent && typeof agents.resume === 'function') {
    try {
      const handle = await agents.resume({ resumeSessionId: sid })
      agent = handle && (handle.agent || handle)
    } catch {
      return null
    }
  }
  const session = agent && agent.session
  if (!session) return null
  return copySessionTurns(session)
}

function liveAgentOf(agents, fromSessionId) {
  const sid = String(fromSessionId || '').trim()
  if (sid && typeof agents.get === 'function') {
    const hit = agents.get(sid)
    if (hit && routeOf(hit)) return hit
  }
  const listed = typeof agents.list === 'function' ? agents.list() : []
  for (const row of listed) {
    if (row && routeOf(row)) return row
  }
  return null
}

async function tryRestoreHandoff(ctx, spec) {
  const agents = ctx && typeof ctx.get === 'function' ? ctx.get('agents') : (ctx && ctx.agents)
  if (!agents || typeof agents.create !== 'function') {
    return { ok: false, error: 'NO_AGENTS', hint: '没开成新会话。' }
  }
  const live = liveAgentOf(agents, spec && spec.fromSessionId)
  const route = routeOf(live)
  if (!route) return { ok: false, error: 'NO_MODEL', hint: '本机还没有可用的模型，不能接着聊。' }
  const seed = seedEventsOf(spec && spec.pack, route)
  if (!seed.length) return { ok: false, error: 'EMPTY_HANDOFF', hint: '这次会话还没有可交接的人话。工具卡不会带上。' }
  const sessionId = `session-${randomUUID()}`
  const cwd = absCwd((spec && spec.cwd) || (live && live.session && live.session.header && live.session.header.cwd) || '')
  const meta = { seedLength: seed.length }
  if (cwd) meta.cwd = cwd
  if (route.agentPreset) meta.agentPreset = route.agentPreset
  let setup
  try {
    const agentMod = await importPeer('@deepseek-ai/dsh-agent')
    const install = agentMod && agentMod.installModelSelection
    const presets = ctx && typeof ctx.get === 'function' ? ctx.get('agentPresets') : undefined
    const picked = { provider: route.provider, model: route.model }
    setup = async (agentCtx) => {
      if (typeof install === 'function') {
        install(agentCtx, {
          get current() { return picked },
          set current(next) {
            if (next && next.provider && next.model) {
              picked.provider = next.provider
              picked.model = next.model
            }
          },
          assembled: undefined,
        })
      }
      if (presets && typeof presets.mount === 'function') {
        const presetId = route.agentPreset || (presets.resolve && (await presets.resolve()).id)
        if (presetId) await presets.mount(agentCtx, presetId)
      }
    }
  } catch {
    setup = undefined
  }
  try {
    const handle = await agents.create({
      sessionId,
      seed,
      agentOptions: { provider: route.provider, model: route.model },
      meta,
      setup,
    })
    const agent = handle && (handle.agent || handle)
    if (!agent) return { ok: false, error: 'NO_AGENT', hint: '没开成新会话。' }
    return { ok: true, sessionId }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), hint: '没开成新会话。' }
  }
}

async function tryFollowup(ctx, followup) {
  const agents = ctx && typeof ctx.get === 'function' ? ctx.get('agents') : (ctx && ctx.agents)
  if (!agents) return { ok: false, error: 'NO_AGENTS' }
  let agent = typeof agents.get === 'function' ? agents.get(followup.sessionId) : undefined
  if (!agent && typeof agents.resume === 'function') {
    try {
      const handle = await agents.resume({ resumeSessionId: followup.sessionId })
      agent = handle && (handle.agent || handle)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
  if (!agent || typeof agent.followup !== 'function') return { ok: false, error: 'NO_AGENT' }
  try {
    const llm = await importPeer('@deepseek-ai/dsh-llm')
    const message = llm.createUserMessage({
      content: [{ type: 'text', text: followup.text }],
      source: { kind: 'plugin', plugin: PLUGIN },
    })
    agent.followup(message)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function drainListenInbox(secretary) {
  const dir = join(assistHome(), 'inbox')
  let names = []
  try { names = await readdir(dir) } catch { return }
  const files = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    try {
      files.push(JSON.parse(await readFile(join(dir, name), 'utf8')))
      await unlink(join(dir, name))
    } catch { /* skip bad drop */ }
  }
  if (files.length) await secretary.ingestListenInbox(files)
}

