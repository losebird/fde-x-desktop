/**
 * Default chat model occupancy: Host namespaces first, settings.yaml if Host empty.
 * Never logs or writes the key.
 * @module dsh-semantic-os/dsh-llm
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

function dshHome() {
  return process.env.DSH_HOME || process.env.FDE_DSH_HOME || join(homedir(), '.dsh')
}

function yamlScalar(text, key) {
  const line = String(text || '').split(/\r?\n/).find((row) => {
    const trim = row.trim()
    return trim.startsWith(`${key}:`) && !trim.startsWith('#')
  })
  if (!line) return ''
  return line.slice(line.indexOf(':') + 1).trim().replace(/^['"]|['"]$/g, '')
}

function blockMatch(text, header, innerKey) {
  const lines = String(text || '').split(/\r?\n/)
  let inBlock = false
  for (const line of lines) {
    if (/^\S/.test(line) && line.trim().endsWith(':')) {
      inBlock = line.trim() === `${header}:`
      continue
    }
    if (inBlock && line.trim().startsWith(`${innerKey}:`)) {
      return line.slice(line.indexOf(':') + 1).trim().replace(/^['"]|['"]$/g, '')
    }
  }
  return ''
}

function providerFields(settings, provider) {
  const name = String(provider || '').trim()
  if (!name) return { apiKeyEnv: '', api: '', baseUrl: '' }
  const needle = `${name}:`
  const idx = String(settings || '').indexOf(needle)
  if (idx < 0) return { apiKeyEnv: '', api: '', baseUrl: '' }
  const window = String(settings).slice(idx, idx + 1200)
  const apiKeyEnv = (window.match(/apiKeyEnv:\s*([A-Z][A-Z0-9_]*)/) || [])[1] || ''
  const api = (window.match(/\bapi:\s*([A-Za-z0-9_-]+)/) || [])[1] || ''
  const baseRaw = (window.match(/baseURL:\s*(\S+)/i) || window.match(/baseUrl:\s*(\S+)/) || [])[1] || ''
  const baseUrl = String(baseRaw).replace(/[,"']+$/g, '').replace(/^["']|["']$/g, '')
  return { apiKeyEnv, api, baseUrl }
}

function readKey(home, envName) {
  const name = String(envName || '').trim()
  if (!name) return ''
  let apiKey = process.env[name] || ''
  try {
    const cred = readFileSync(join(home, '.credentials.yaml'), 'utf8')
    apiKey = yamlScalar(cred, name) || apiKey
  } catch {
    /* env only */
  }
  return apiKey
}

function readYamlLlm(home) {
  let provider = ''
  let model = ''
  let settings = ''
  try {
    settings = readFileSync(join(home, 'settings.yaml'), 'utf8')
    provider = blockMatch(settings, 'agent-default-model', 'provider') || ''
    model = blockMatch(settings, 'agent-default-model', 'model') || ''
  } catch {
    settings = ''
  }
  const fields = providerFields(settings, provider)
  return {
    dshProvider: provider,
    model,
    api: fields.api,
    apiKeyEnv: fields.apiKeyEnv,
    baseUrl: fields.baseUrl,
  }
}

function readOccupancyLlm(home) {
  const dest = join(home, 'run', 'llm-occupancy.json')
  if (!dest || !existsSync(dest)) return null
  try {
    const raw = JSON.parse(readFileSync(dest, 'utf8'))
    if (!raw || typeof raw !== 'object' || !String(raw.dshProvider || '').trim()) return null
    return {
      dshProvider: String(raw.dshProvider || ''),
      model: String(raw.model || ''),
      api: String(raw.api || ''),
      apiKeyEnv: String(raw.apiKeyEnv || ''),
      baseUrl: String(raw.baseUrl || ''),
      configured: Boolean(raw.configured),
    }
  } catch {
    return null
  }
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
  const keyRef = apiKeyEnv || (provider ? `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY` : '')
  const creds = credentials && typeof credentials === 'object' ? credentials : {}
  const cred = (keyRef && creds[keyRef]) || (apiKeyEnv && creds[apiKeyEnv]) || null
  return {
    dshProvider: provider,
    model,
    api: String(profile.api || '').trim(),
    apiKeyEnv,
    baseUrl: String(profile.baseURL || profile.baseUrl || '').trim(),
    configured: Boolean(cred && cred.configured),
  }
}

export function readDshLlm() {
  const home = dshHome()
  const host = readOccupancyLlm(home)
  const file = readYamlLlm(home)
  const base = host && host.dshProvider ? host : file
  let apiKeyEnv = String(base.apiKeyEnv || '').trim()
  if (!apiKeyEnv && /^deepseek/i.test(base.dshProvider)) apiKeyEnv = 'DEEPSEEK_API_KEY'
  const apiKey = readKey(home, apiKeyEnv)
  const officialDeepseek = /^deepseek/i.test(base.dshProvider)
  const baseUrl = String(base.baseUrl || '')
  const api = String(base.api || '') || (officialDeepseek || /chat/i.test(baseUrl) ? 'openai-chat' : '')
  const configured = Boolean(apiKey) || Boolean(host && host.configured)
  return {
    dshProvider: String(base.dshProvider || ''),
    model: String(base.model || ''),
    api,
    apiKeyEnv,
    baseUrl,
    apiKey,
    semanticaProvider: officialDeepseek ? 'deepseek' : (api ? 'openai' : ''),
    configured,
    chatCompletions: Boolean(apiKey && baseUrl && api !== 'openai-responses'),
  }
}

export function llmPublicView(llm) {
  return {
    llmProvider: llm.dshProvider || '',
    llmModel: llm.model || '',
    llmReady: Boolean(llm.configured),
  }
}
