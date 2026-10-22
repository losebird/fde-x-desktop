/**
 * Local extract/search usage ledger. No secrets. Caps history.
 * @module dsh-semantic-os/usage-ledger
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const CAP = 80

function ledgerPath() {
  return join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'semantic-os', 'usage.json')
}

function empty() {
  return {
    version: 1,
    totals: {
      extract: { calls: 0, prompt: 0, completion: 0, total: 0, reasoning: 0 },
      search: { calls: 0, bytes: 0, context: 0 },
    },
    events: [],
  }
}

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

export function estimateTokens(text) {
  const blob = String(text || '')
  if (!blob) return 0
  let cjk = 0
  for (const ch of blob) {
    const code = ch.codePointAt(0)
    if (code >= 0x4e00 && code <= 0x9fff) cjk += 1
  }
  const rest = blob.length - cjk
  return cjk + Math.ceil(rest / 4)
}

async function load() {
  try {
    const raw = JSON.parse(await readFile(ledgerPath(), 'utf8'))
    if (!raw || typeof raw !== 'object') return empty()
    const base = empty()
    const totals = raw.totals && typeof raw.totals === 'object' ? raw.totals : {}
    base.totals.extract = { ...base.totals.extract, ...(totals.extract || {}) }
    base.totals.search = { ...base.totals.search, ...(totals.search || {}) }
    base.events = Array.isArray(raw.events) ? raw.events.filter((row) => row && row.kind) : []
    return base
  } catch {
    return empty()
  }
}

async function save(store) {
  const path = ledgerPath()
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.tmp`
  await writeFile(tmp, `${JSON.stringify(store)}\n`, 'utf8')
  await rename(tmp, path)
}

export async function recordUsage(entry) {
  const kind = entry && entry.kind === 'search' ? 'search' : 'extract'
  const row = {
    kind,
    at: Date.now(),
    model: String((entry && entry.model) || ''),
    provider: String((entry && entry.provider) || ''),
    prompt: num(entry && entry.prompt),
    completion: num(entry && entry.completion),
    total: num(entry && entry.total) || num(entry && entry.prompt) + num(entry && entry.completion),
    reasoning: num(entry && entry.reasoning),
    bytes: num(entry && entry.bytes),
    context: num(entry && entry.context),
    ms: num(entry && entry.ms),
    via: String((entry && entry.via) || ''),
  }
  const store = await load()
  if (kind === 'extract') {
    store.totals.extract.calls += 1
    store.totals.extract.prompt += row.prompt
    store.totals.extract.completion += row.completion
    store.totals.extract.total += row.total
    store.totals.extract.reasoning += row.reasoning
  } else {
    store.totals.search.calls += 1
    store.totals.search.bytes += row.bytes
    store.totals.search.context += row.context
  }
  store.events.push(row)
  if (store.events.length > CAP) store.events = store.events.slice(-CAP)
  await save(store).catch(() => undefined)
  return row
}

export async function readUsage() {
  const store = await load()
  return {
    ok: true,
    totals: store.totals,
    events: store.events.slice(-20).reverse(),
  }
}
