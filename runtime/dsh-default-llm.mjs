import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { providerKeyRef } from './models-settings.mjs'

export function llmOccupancyPath(dshHome) {
  return join(String(dshHome || ''), 'run', 'llm-occupancy.json')
}

export function llmPublicView(llm) {
  const row = llm && typeof llm === 'object' ? llm : {}
  return {
    llmProvider: String(row.dshProvider || row.llmProvider || ''),
    llmModel: String(row.model || row.llmModel || ''),
    llmReady: Boolean(row.configured || row.llmReady || row.apiKey),
  }
}

export function llmFingerprint(llm) {
  const view = llmPublicView(llm)
  const env = String((llm && llm.apiKeyEnv) || '')
  return `${view.llmProvider}|${view.llmModel}|${env}|${view.llmReady ? '1' : '0'}`
}

export function llmFromDescribe(namespaces, credentials) {
  const rows = Array.isArray(namespaces) ? namespaces : []
  const def = rows.find((row) => row && row.ns === 'agent-default-model')
  const value = def && def.value && typeof def.value === 'object' ? def.value : {}
  const provider = String(value.provider || '').trim()
  const model = String(value.model || '').trim()
  const pi = rows.find((row) => row && row.ns === 'llm-pi-ai')
  const providers = pi && pi.value && pi.value.providers && typeof pi.value.providers === 'object'
    ? pi.value.providers
    : {}
  const profile = provider && providers[provider] && typeof providers[provider] === 'object'
    ? providers[provider]
    : {}
  const apiKeyEnv = String(profile.apiKeyEnv || '').trim()
  const keyRef = apiKeyEnv || (provider ? providerKeyRef(provider) : '')
  const creds = credentials && typeof credentials === 'object' ? credentials : {}
  const cred = (keyRef && creds[keyRef]) || (apiKeyEnv && creds[apiKeyEnv]) || null
  const configured = Boolean(cred && cred.configured)
  const baseUrl = String(profile.baseURL || profile.baseUrl || '').trim()
  const api = String(profile.api || '').trim()
  return {
    dshProvider: provider,
    model,
    api,
    apiKeyEnv,
    baseUrl,
    configured,
  }
}

export async function readDshDefaultLlm(aiRuntime) {
  if (!aiRuntime || typeof aiRuntime.rpc !== 'function') return llmFromDescribe([], {})
  let describe = { namespaces: [] }
  try {
    describe = await aiRuntime.rpc('settings/describe', {}) || describe
  } catch {
    describe = { namespaces: [] }
  }
  const namespaces = Array.isArray(describe.namespaces) ? describe.namespaces : []
  const llm = llmFromDescribe(namespaces, {})
  const refs = []
  if (llm.apiKeyEnv) refs.push(llm.apiKeyEnv)
  if (llm.dshProvider) refs.push(providerKeyRef(llm.dshProvider))
  let credentials = {}
  if (refs.length) {
    try {
      credentials = await aiRuntime.rpc('credentials/describe', { refs }) || {}
    } catch {
      credentials = {}
    }
  }
  return llmFromDescribe(namespaces, credentials)
}

export async function writeLlmOccupancy(dshHome, llm) {
  const home = String(dshHome || '').trim()
  if (!home) return
  const dest = llmOccupancyPath(home)
  const prev = readLlmOccupancySync(home) || {}
  const body = {
    dshProvider: String((llm && llm.dshProvider) || ''),
    model: String((llm && llm.model) || ''),
    api: String((llm && llm.api) || ''),
    apiKeyEnv: String((llm && llm.apiKeyEnv) || ''),
    baseUrl: String((llm && llm.baseUrl) || ''),
    configured: Boolean(llm && llm.configured),
    spawnedFp: String((llm && llm.spawnedFp) || prev.spawnedFp || ''),
  }
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, `${JSON.stringify(body)}\n`, 'utf8')
}

export function readLlmOccupancySync(dshHome) {
  const dest = llmOccupancyPath(dshHome)
  if (!dest || !existsSync(dest)) return null
  try {
    const raw = JSON.parse(readFileSync(dest, 'utf8'))
    if (!raw || typeof raw !== 'object') return null
    return raw
  } catch {
    return null
  }
}

export function enrichReadyWithLlm(snap, llm) {
  const row = snap && typeof snap === 'object' ? { ...snap } : {}
  return { ...row, ...llmPublicView(llm) }
}
