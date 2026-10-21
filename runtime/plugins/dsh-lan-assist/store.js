/**
 * Disk mailbox under ~/.dsh/lan-assist. Uninstall does not delete this tree.
 * Conversations are the on-disk letters. Memory still exposes requests as the same map.
 * @module dsh-lan-assist/store
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { assistHome, dshHome } from './home.js'
import { replaceFile } from './disk.js'
import { conversationOf } from './conversation.js'

export const LETTERS_BAK = 'state.letters.bak.json'
export const CONVERSATIONS_REL = 'conversations.projection.json'

export function lettersMap(parsed) {
  const conv = parsed && parsed.conversations
  if (conv && typeof conv === 'object' && !Array.isArray(conv) && Object.keys(conv).length) {
    return conv
  }
  const req = parsed && parsed.requests
  if (req && typeof req === 'object' && !Array.isArray(req)) return req
  return {}
}

function stripMessages(map) {
  const out = {}
  for (const [id, req] of Object.entries(map || {})) {
    if (!req || typeof req !== 'object') {
      out[id] = req
      continue
    }
    const row = { ...req }
    delete row.messages
    out[id] = row
  }
  return out
}

/**
 * @param {{ root?: string }} [opts]
 */
export function createStore(opts = {}) {
  const root = assistHome(opts.root || dshHome())
  /** @type {Record<string, unknown> | null} */
  let cache = null
  /** @type {Record<string, string> | null} */
  let secrets = null
  /** @type {Promise<unknown>} */
  let writes = Promise.resolve()
  let lastJson = ''

  async function readMailbox() {
    try {
      return JSON.parse(await readFile(join(root, 'state.json'), 'utf8'))
    } catch {
      return JSON.parse(await readFile(join(root, LETTERS_BAK), 'utf8'))
    }
  }

  async function load() {
    if (cache) return cache
    try {
      const parsed = await readMailbox()
      cache = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (() => {
          const letters = lettersMap(parsed)
          return {
            ...emptyState(),
            ...parsed,
            requests: letters,
            conversations: letters,
            peers: parsed.peers && typeof parsed.peers === 'object' ? parsed.peers : {},
          }
        })()
        : emptyState()
      lastJson = JSON.stringify(diskState(cache), null, 2)
    } catch {
      cache = emptyState()
    }
    if (cache.lookup && cache.lookup.token) {
      await setSecret('lookupToken', String(cache.lookup.token))
      cache.lookup.token = ''
      await save()
    }
    cache.lookups = migrateLookups(cache)
    return cache
  }

  function diskState(state) {
    const next = {
      ...state,
      lastTick: undefined,
      lookup: { ...(state.lookup || {}), token: '' },
      lookups: migrateLookups(state),
    }
    delete next.lastTick
    if (state.pairCode) {
      const pending = state.pairCode.pending
      next.pairCode = pending
        ? { ...state.pairCode, pending: { ...pending, privateKey: undefined } }
        : state.pairCode
      if (next.pairCode.pending) delete next.pairCode.pending.privateKey
    }
    const letters = stripMessages(
      (state.requests && Object.keys(state.requests).length ? state.requests : state.conversations) || {},
    )
    next.conversations = letters
    delete next.requests
    return next
  }

  async function save() {
    const state = cache || emptyState()
    const letters = (state.requests && Object.keys(state.requests).length)
      ? state.requests
      : (state.conversations || {})
    state.requests = letters
    state.conversations = letters
    const text = JSON.stringify(diskState(state), null, 2)
    if (text === lastJson) return
    lastJson = text
    await mkdir(root, { recursive: true, mode: 0o700 })
    await replaceFile(join(root, 'state.json'), text)
    await replaceFile(
      join(root, CONVERSATIONS_REL),
      `${JSON.stringify(Object.values(letters).map(conversationOf))}\n`,
    )
    if (Object.keys(letters).length) {
      try {
        await writeFile(join(root, LETTERS_BAK), text, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
      } catch { /* keep the first letter snapshot */ }
    }
  }

  async function loadSecrets() {
    if (secrets) return secrets
    try {
      secrets = JSON.parse(await readFile(join(root, 'secrets.json'), 'utf8'))
    } catch {
      secrets = {}
    }
    return secrets
  }

  async function saveSecrets() {
    const row = secrets || {}
    await mkdir(root, { recursive: true, mode: 0o700 })
    await replaceFile(join(root, 'secrets.json'), JSON.stringify(row, null, 2))
  }

  async function getSecret(key) {
    const row = await loadSecrets()
    return String(row[key] || '')
  }

  async function setSecret(key, value) {
    const row = await loadSecrets()
    if (value) row[key] = String(value)
    else delete row[key]
    secrets = row
    await saveSecrets()
    return row[key] || ''
  }

  return {
    root,
    async get() {
      return load()
    },
    /**
     * @param {(state: Record<string, unknown>) => void | Promise<void>} fn
     */
    async update(fn) {
      const run = writes.then(async () => {
        const state = await load()
        await fn(state)
        await save()
        return state
      })
      writes = run.then(() => undefined, () => undefined)
      return run
    },
    getSecret,
    setSecret,
  }
}

export function emptyState() {
  const letters = {}
  return {
    version: 1,
    self: null,
    pairCode: null,
    pairAsk: null,
    pairWait: null,
    relayInvites: {},
    relayUrl: '',
    peers: {},
    sightings: {},
    requests: letters,
    conversations: letters,
    outbox: [],
    ledger: [],
    seen: {},
    briefOff: false,
    lastBriefDay: '',
    listenGranted: false,
    asleep: false,
    lastTick: 0,
    sinkCommand: '',
    displayName: '',
    advice: null,
    events: [],
    reminders: {},
    drafts: [],
    writeStopped: false,
    lookup: { baseUrl: '', token: '', system: '', env: '' },
    lookups: [],
    observe: { day: '', sends: 0, lookups: 0 },
    nudgeAsk: null,
    nudges: [],
    pendingWrite: null,
    pendingSheet: null,
    sheetTrail: [],
    liveOpening: null,
    focus: null,
    groups: [],
  }
}

export function migrateLookups(state) {
  const listed = Array.isArray(state && state.lookups) ? state.lookups.filter((row) => row && row.id) : []
  if (listed.length) {
    return listed.map((row) => ({
      id: String(row.id),
      dialect: String(row.dialect || 'nocobase') === 'rest' ? 'rest' : 'nocobase',
      baseUrl: String(row.baseUrl || '').replace(/\/+$/, ''),
      system: String(row.system || '').trim(),
      env: String(row.env || '').trim(),
      listPath: String(row.listPath || '').trim(),
      ticketField: String(row.ticketField || '').trim(),
      statusField: String(row.statusField || '').trim(),
      ownerField: String(row.ownerField || '').trim(),
      writePath: String(row.writePath || '').trim(),
      writeMethod: String(row.writeMethod || '').trim(),
      token: '',
    }))
  }
  const one = state && state.lookup
  if (one && String(one.baseUrl || '').trim()) {
    return [{
      id: 'default',
      dialect: 'nocobase',
      baseUrl: String(one.baseUrl || '').replace(/\/+$/, ''),
      system: String(one.system || '').trim(),
      env: String(one.env || '').trim(),
      token: '',
    }]
  }
  return []
}
