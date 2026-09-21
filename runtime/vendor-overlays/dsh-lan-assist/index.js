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
import { createSemanticBridge, cwdFromWorkspaceStore, extractUserSpeech, looksLikeChoice, readLeftIds } from './semantic.js'
import { createStore } from './store.js'
import { registerTools } from './tools.js'
import { createLookup, collapseKindsToConnectedTables } from './lookup.js'
import { translateQuote } from './translate.js'
import { createEyesSee, hasEyes } from './eyes-bridge.js'
import { createGate, createNocoWrite } from './write.js'
import { rememberUserSpeech } from './slots.js'
import { createTraceLog } from './traces.js'
import { createSessionRoundStore } from './session-round.js'

const schemaMod = await importPeer('@deepseek-ai/schemastery')
const { defineTool } = await importPeer('@deepseek-ai/dsh-tools')
const Schema = schemaMod.default

export const name = PLUGIN
export const inject = ['tools', 'webServer', 'llm']

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
  let agentsCtx = null

  const lastCancelAt = new Map()
  async function cancelLeftover(sessionId) {
    const sid = String(sessionId || '').trim()
    if (!sid) return
    const now = Date.now()
    const prev = Number(lastCancelAt.get(sid) || 0)
    if (now - prev < 1500) return
    lastCancelAt.set(sid, now)
    const agents = agentsCtx && (agentsCtx.agents || (typeof agentsCtx.get === 'function' ? agentsCtx.get('agents') : null))
    let agent = agents && typeof agents.get === 'function' ? agents.get(sid) : null
    if (!agent && agents && typeof agents.resume === 'function') {
      try {
        const handle = await agents.resume({ resumeSessionId: sid })
        agent = handle && (handle.agent || handle)
      } catch { /* optional */ }
    }
    if (agent && typeof agent.cancel === 'function') {
      try { await agent.cancel() } catch { /* leftover cancel is best-effort */ }
      return
    }
    if (agent && typeof agent.abort === 'function') {
      try { await agent.abort() } catch { /* leftover cancel is best-effort */ }
    }
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
    postWrite: (spec) => writer.write(spec),
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
    onPreview: () => sse.emit('mailbox', { type: 'preview' }),
    hasEyes: () => hasEyes(ctx),
    see: createEyesSee(ctx),
    readSession: (sessionId) => readSessionTurns(agentsCtx, sessionId),
  })
  const grantListen = secretary.grantListen
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
    return { ...view, officialRoundSheet: sessionRounds.servedSheet(sid) }
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

  ctx.inject(['agents'], (actx) => {
    agentsCtx = actx
    return () => { agentsCtx = null }
  })

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
          sessionRounds.startRound(sessionId)
        }
        if (event && event.type === 'turn/end') {
          sessionRounds.closeRound(sessionId)
          void secretary.finalizeDraftFromSession(sessionId).then((result) => {
            if (result && result.ok) sse.emit('mailbox', { type: 'draft' })
          }).catch(() => undefined)
          return
        }
        const speech = extractUserSpeech(event)
        if (!speech) return
        sessionRounds.startRound(sessionId)
        rememberUserSpeech(sessionId, speech)
        const workspace = session && session.header && typeof session.header.cwd === 'string'
          ? session.header.cwd.trim()
          : ''
        void secretary.hearUserLine(sessionId, speech, workspace).then((result) => {
          if (result && result.followup) void tryFollowup(agentsCtx, result.followup).catch(() => undefined)
          if (result && result.ok && !result.skipped) sse.emit('mailbox', { type: 'advice' })
        }).catch(() => undefined)
      })
    } catch { /* session events optional */ }
  })

  const handler = createLocalHandler({
    secretary,
    lan,
    sse,
    followup: (spec) => tryFollowup(agentsCtx, spec),
    restoreHandoff: (spec) => tryRestoreHandoff(agentsCtx, spec),
    translate: (quote) => translateQuote((ctx.llm || (ctx.get && ctx.get('llm'))), quote),
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
      noteToolSheet: (sessionId, sheet) => sessionRounds.noteToolSheet(sessionId, sheet),
      cancelLeftover,
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

