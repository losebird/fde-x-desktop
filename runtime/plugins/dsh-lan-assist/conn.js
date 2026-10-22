/**
 * Read-only lookup connections. Tokens stay on this machine, never ride a letter.
 * @module dsh-lan-assist/conn
 */

import { randomHex } from './crypto.js'

export function persistLookup(row) {
  return {
    id: row.id,
    dialect: row.dialect === 'rest' ? 'rest' : 'nocobase',
    baseUrl: row.baseUrl || '',
    system: row.system || '',
    env: row.env || '',
    listPath: row.listPath || '',
    ticketField: row.ticketField || '',
    statusField: row.statusField || '',
    ownerField: row.ownerField || '',
    writePath: row.writePath || '',
    writeMethod: row.writeMethod || '',
    token: '',
  }
}

export function emptyLookupRow(id) {
  return {
    id: id || 'default',
    baseUrl: '',
    hasToken: false,
    configured: false,
    dialect: 'nocobase',
    system: '',
    env: '',
    listPath: '',
    ticketField: '',
    statusField: '',
    ownerField: '',
    writePath: '',
    writeMethod: '',
  }
}

/**
 * @param {object} bag
 */
export function createConns(bag) {
  const { store, now, snapshot, note, bumpObserve, opts } = bag
  const tokenCache = {}
  let lookupToken = ''
  let secretsReady = false

  async function tokenKey(id) {
    return String(id || 'default') === 'default' ? 'lookupToken' : `lookupToken:${id}`
  }

  async function loadConnToken(id) {
    const key = await tokenKey(id)
    if (Object.prototype.hasOwnProperty.call(tokenCache, key)) return tokenCache[key]
    const value = typeof store.getSecret === 'function' ? String(await store.getSecret(key) || '') : ''
    tokenCache[key] = value
    key === 'lookupToken' && (lookupToken = value, secretsReady = true)
    return value
  }

  async function saveConnToken(id, value) {
    const key = await tokenKey(id)
    tokenCache[key] = String(value || '')
    key === 'lookupToken' && (lookupToken = tokenCache[key], secretsReady = true)
    typeof store.setSecret === 'function' && await store.setSecret(key, tokenCache[key])
  }

  async function loadLookupToken() {
    secretsReady || (lookupToken = await loadConnToken('default'), secretsReady = true)
    return lookupToken
  }

  async function saveLookupToken(value) {
    await saveConnToken('default', value)
  }

  function publicLookups(state) {
    const listed = Array.isArray(state && state.lookups) ? state.lookups : []
    const rows = listed.length
      ? listed
      : (state && state.lookup && String(state.lookup.baseUrl || '').trim()
        ? [{ id: 'default', ...state.lookup }]
        : [])
    return rows.map((row) => {
      const id = String((row && row.id) || 'default')
      const baseUrl = String((row && row.baseUrl) || '').trim()
      const key = id === 'default' ? 'lookupToken' : `lookupToken:${id}`
      const hasToken = !!(tokenCache[key] || (id === 'default' && lookupToken))
      return {
        id,
        baseUrl,
        hasToken,
        configured: !!baseUrl,
        dialect: String((row && row.dialect) || 'nocobase') === 'rest' ? 'rest' : 'nocobase',
        system: String((row && row.system) || '').trim(),
        env: String((row && row.env) || '').trim(),
        listPath: String((row && row.listPath) || '').trim(),
        ticketField: String((row && row.ticketField) || '').trim(),
        statusField: String((row && row.statusField) || '').trim(),
        ownerField: String((row && row.ownerField) || '').trim(),
        writePath: String((row && row.writePath) || '').trim(),
        writeMethod: String((row && row.writeMethod) || '').trim(),
      }
    })
  }

  function publicLookup(state) {
    const rows = publicLookups(state)
    const row = rows[0] || { id: 'default', baseUrl: '', hasToken: false, configured: false, system: '', env: '' }
    return { ...row, connections: rows }
  }

  function lookupReady(state) {
    const rows = publicLookups(state)
    const envUrl = (() => {
      try {
        return !!(typeof process !== 'undefined' && process.env && String(process.env.DSH_LAN_ASSIST_LOOKUP_URL || '').trim())
      } catch {
        return false
      }
    })()
    return rows.some((row) => row.configured) || envUrl
  }

  async function setLookup({ id, baseUrl, token, system, env, dialect, listPath, ticketField, statusField, ownerField, writePath, writeMethod, remove, add }) {
    await loadLookupToken()
    const state = await store.get()
    const rows = publicLookups(state).map((row) => ({ ...row }))
    let targetId = String(id || '')
    ;(add || (!targetId && !rows.length && baseUrl !== undefined)) && (targetId = rows.length ? `conn_${randomHex(3)}` : 'default')
    !targetId && (targetId = (rows[0] && rows[0].id) || 'default')
    if (remove) {
      const next = rows.filter((row) => row.id !== targetId)
      await saveConnToken(targetId, '')
      await store.update((s) => {
        s.lookups = next.map(persistLookup)
        s.lookup = s.lookups[0] || { baseUrl: '', token: '', system: '', env: '' }
        note(s, '本机探活已清一套。没连业务，不能装成已查待办。', now())
      })
      return { ok: true, lookup: publicLookup(await store.get()), ...(await snapshot()) }
    }
    let row = rows.find((item) => item.id === targetId)
    if (!row) {
      targetId = targetId || `conn_${randomHex(3)}`
      row = emptyLookupRow(targetId)
      rows.push(row)
    }
    baseUrl !== undefined && (row.baseUrl = String(baseUrl || '').trim().replace(/\/+$/, ''))
    system !== undefined && (row.system = String(system || '').trim())
    env !== undefined && (row.env = String(env || '').trim())
    dialect !== undefined && (row.dialect = String(dialect || 'nocobase') === 'rest' ? 'rest' : 'nocobase')
    listPath !== undefined && (row.listPath = String(listPath || '').trim())
    ticketField !== undefined && (row.ticketField = String(ticketField || '').trim())
    statusField !== undefined && (row.statusField = String(statusField || '').trim())
    ownerField !== undefined && (row.ownerField = String(ownerField || '').trim())
    writePath !== undefined && (row.writePath = String(writePath || '').trim())
    writeMethod !== undefined && (row.writeMethod = String(writeMethod || '').trim())
    token !== undefined && token !== null
      ? await saveConnToken(row.id, row.baseUrl ? String(token) : '')
      : (!row.baseUrl && await saveConnToken(row.id, ''))
    await store.update((s) => {
      s.lookups = rows.map(persistLookup)
      s.lookup = {
        baseUrl: (s.lookups[0] && s.lookups[0].baseUrl) || '',
        token: '',
        system: (s.lookups[0] && s.lookups[0].system) || '',
        env: (s.lookups[0] && s.lookups[0].env) || '',
      }
      note(s, row.baseUrl ? `本机探活已记下 · ${row.system || row.id} · 登录口令不进邮箱` : '本机探活已清。没连业务，不能装成已查待办。', now())
    })
    return { ok: true, lookup: publicLookup(await store.get()), ...(await snapshot()) }
  }

  async function lookupRef(ref, workspace) {
    if (!ref || (!ref.no && !ref.kind)) return { ok: false, error: 'NO_REF' }
    if (typeof opts.lookupTodo !== 'function') return { ok: false, error: 'NO_CONNECTOR' }
    try {
      const seat = ((await store.get()).self || {}).staffId || ''
      const found = await opts.lookupTodo({
        kind: ref.kind,
        no: ref.no,
        workspace: workspace || '',
        staffId: seat,
        vocab: typeof opts.loadVocab === 'function' ? await opts.loadVocab(workspace || '') : undefined,
      })
      if (!found || found.ok === false) {
        const error = (found && found.error) || 'LOOKUP'
        error !== 'NO_CONNECTOR' && error !== 'NO_REF' && await store.update((s) => bumpObserve(s, 'lookups', now()))
        return {
          ok: false,
          error,
          expired: error === 'EXPIRED',
          mine: found && found.mine,
          no: found && found.no,
          fields: (found && found.fields) || {},
          matches: (found && found.matches) || [],
          ambiguous: !!(found && found.ambiguous),
        }
      }
      return {
        ok: true,
        status: String(found.status || '未知'),
        fingerprint: String(found.fingerprint || found.status || ''),
        mine: found.mine,
        system: found.system || '',
        env: found.env || '',
        no: found.no || ref.no,
        fields: found.fields || {},
        matches: found.matches || [],
        ambiguous: !!found.ambiguous,
      }
    } catch {
      return { ok: false, error: 'LOOKUP' }
    }
  }

  return {
    loadConnToken,
    saveConnToken,
    loadLookupToken,
    saveLookupToken,
    publicLookups,
    publicLookup,
    lookupReady,
    setLookup,
    lookupRef,
  }
}
