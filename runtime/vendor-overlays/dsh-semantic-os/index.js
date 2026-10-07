/**
 * Host plugin: one semantica==0.6.7 sidecar, same-origin /semantic-os, host tools.
 * apply() never throws on doctor fail — the plugin stays not-ready.
 * @module dsh-semantic-os
 */

import { createHandler, createUpgradeHandler } from './http.js'
import { importPeer } from './peers.js'
import { DEFAULT_API_KEY_ENV, DEFAULT_START_TIMEOUT_MS, loadOverlaySync, mergeConfig } from './persist.js'
import { createSidecar } from './sidecar.js'
import { llmPublicView, readDshLlm } from './dsh-llm.js'
import { registerTools } from './tools.js'
import { createIngest, postPython } from './ingest.js'
import { registerGate } from './gate.js'
import { createWriteLog } from './product.js'
import { createOpeningCache } from './opening-brief.js'
import { ensureProjectMemorySkill } from './skill-install.js'

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

  ctx.effect(() => {
    const home = process.env.FDE_DSH_HOME || process.env.DSH_HOME || ''
    void ensureProjectMemorySkill(home)
    return () => undefined
  })

  const innerSidecar = createSidecar(() => current())
  const sidecar = new Proxy(innerSidecar, {
    get(target, prop) {
      if (prop === 'snapshot') {
        return () => ({ ...target.snapshot(), ...llmPublicView(readDshLlm()) })
      }
      if (prop === 'retryReady') {
        return async () => {
          const next = await target.retryReady()
          return { ...next, ...llmPublicView(readDshLlm()) }
        }
      }
      const value = target[prop]
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
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
      text: () => [
        'This cwd has a local knowledge graph of prior chats, files, and recorded decisions. Hits are 当时, never live ERP.',
        'route_intent names which graph tool fits an utterance; it does not search. Follow its tool field when you call it. 现况 → biz_preview (live connector). Do not search_text when the tool is biz_preview.',
        'Graph ops without a session cwd return NO_CWD. If the engine is not ready they return NOT_READY.',
      ].join(' '),
    })
  }
}
