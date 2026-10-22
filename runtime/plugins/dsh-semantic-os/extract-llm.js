/**
 * Extract entities with the user's current DSH model (ctx.llm).
 * Same text + same model returns the cached JSON (stable relations).
 * @module dsh-semantic-os/extract-llm
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { importPeer } from './peers.js'
import { readDshLlm } from './dsh-llm.js'
import { cleanExtract } from './extract-clean.js'
import { estimateTokens, recordUsage } from './usage-ledger.js'

const CJK = /[\u4e00-\u9fff]/
const CACHE_CAP = 400
const EXTRACT_MS = 45_000

export function hasCjk(text) {
  return CJK.test(String(text || ''))
}

function cachePath() {
  return join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'semantic-os', 'extract-cache.json')
}

function cacheKey(provider, model, text) {
  return createHash('sha256')
    .update(String(provider || ''))
    .update('\n')
    .update(String(model || ''))
    .update('\n')
    .update(String(text || ''))
    .digest('hex')
}

async function loadCache() {
  try {
    const raw = JSON.parse(await readFile(cachePath(), 'utf8'))
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  } catch {
    return {}
  }
}

async function saveCache(map) {
  const path = cachePath()
  await mkdir(dirname(path), { recursive: true })
  const keys = Object.keys(map)
  if (keys.length > CACHE_CAP) {
    for (const key of keys.slice(0, keys.length - CACHE_CAP)) delete map[key]
  }
  await writeFile(path, `${JSON.stringify(map)}\n`, 'utf8')
}

function parseExtractJson(raw) {
  const empty = { entities: [], relations: [] }
  const content = String(raw || '').trim()
  if (!content) return empty
  const o0 = content.indexOf('{')
  const o1 = content.lastIndexOf('}')
  if (o0 < 0 || o1 <= o0) return empty
  try {
    const obj = JSON.parse(content.slice(o0, o1 + 1))
    const entities = Array.isArray(obj.entities) ? obj.entities : []
    const relations = Array.isArray(obj.relations) ? obj.relations : []
    return { entities, relations }
  } catch {
    return empty
  }
}

function pickUsage(chunk) {
  if (!chunk || typeof chunk !== 'object') return null
  const raw = chunk.usage || chunk.tokenUsage || (chunk.data && chunk.data.usage) || null
  if (!raw || typeof raw !== 'object') return null
  return {
    prompt: Number(raw.prompt_tokens || raw.input_tokens || raw.prompt) || 0,
    completion: Number(raw.completion_tokens || raw.output_tokens || raw.completion) || 0,
    total: Number(raw.total_tokens || raw.total) || 0,
    reasoning: Number((raw.completion_tokens_details && raw.completion_tokens_details.reasoning_tokens) || raw.reasoning_tokens || raw.reasoning) || 0,
  }
}

function blocksToText(assembler) {
  if (assembler && typeof assembler.finish === 'function') {
    try { assembler.finish() } catch { /* ignore */ }
  }
  const blocks = typeof assembler.blocks === 'function' ? assembler.blocks() : []
  return blocks
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('')
}

async function streamOnce(llm, opts) {
  const llmMod = await importPeer('@deepseek-ai/dsh-llm')
  const assembler = new llmMod.BlockAssembler()
  let usage = null
  for await (const chunk of llm.stream(opts)) {
    assembler.push(chunk)
    usage = pickUsage(chunk) || usage
  }
  return { text: blocksToText(assembler), usage }
}

async function completeJson(ctx, prompt, maxTokens) {
  const llm = ctx.llm || (typeof ctx.get === 'function' ? ctx.get('llm') : null)
  if (!llm || typeof llm.stream !== 'function') return { text: '', usage: null, via: 'skip' }
  const route = readDshLlm()
  const llmMod = await importPeer('@deepseek-ai/dsh-llm')
  const messages = [llmMod.createUserMessage({
    content: [{ type: 'text', text: String(prompt || '') }],
    source: { kind: 'plugin', plugin: 'dsh-semantic-os' },
  })]
  const ac = typeof AbortController === 'function' ? new AbortController() : null
  const timer = ac ? setTimeout(() => ac.abort(), EXTRACT_MS) : null
  const base = {
    messages,
    maxTokens,
    temperature: 0,
  }
  if (route.dshProvider) base.provider = route.dshProvider
  if (route.model) base.model = route.model
  if (ac) base.signal = ac.signal
  try {
    try {
      return { ...await streamOnce(llm, { ...base, reasoningEffort: 'low' }), via: 'dsh-llm' }
    } catch (error) {
      const msg = String(error && error.message || error)
      if (/UNSUPPORTED_REASONING_EFFORT/i.test(msg)) {
        return { ...await streamOnce(llm, base), via: 'dsh-llm' }
      }
      if (ac && ac.signal && ac.signal.aborted) return { text: '', usage: null, via: 'timeout' }
      throw error
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function createExtract(ctx) {
  return {
    async extract(text, types) {
      const raw = String(text || '').trim()
      if (!raw) return { entities: [], relations: [], via: '' }
      const allowed = Array.isArray(types) ? types.map((row) => String(row || '').trim()).filter(Boolean).slice(0, 16) : []
      const route = readDshLlm()
      const sliced = raw.slice(0, 4000)
      const key = cacheKey(route.dshProvider, route.model, `extract-v3\n${allowed.join('|')}\n${sliced}`)
      const cache = await loadCache()
      const hit = cache[key]
      if (hit && Array.isArray(hit.entities)) {
        return { entities: hit.entities, relations: hit.relations || [], via: 'cache' }
      }
      const typeLine = allowed.length
        ? `type 必须从这些类里选：${allowed.join('、')}。对不上就不要这条实体。`
        : 'type 用两到六个字，按这段文字所属工作区自己起类名。不要用店铺/商品/旗舰店。拿不准就不要抽。'
      const prompt = [
        '从下面文字抽出实体和关系。只输出一个 JSON 对象，不要其它字。',
        '格式: {"entities":[{"text":"名称","type":"短类型","time":"事件发生时间，没有就省略"}],"relations":[{"source":"...","type":"关系","target":"..."}]}',
        'text 必须是原文里连续出现的专名（人、组织、产品、文件、地点、已定方案名）。禁止改写、禁止同义词。',
        '不要抽代词、套话、进度表、问句里的虚词。拿不准就少抽。',
        'relations 的 source/target 必须等于 entities 里某条 text。',
        'time 只写文字里出现的发生时刻（下单、发货、拍板），不要写今天或文件时间。',
        typeLine,
        '',
        sliced,
      ].join('\n')
      const started = Date.now()
      const got = await completeJson(ctx, prompt, 400).catch(() => ({ text: '', usage: null, via: 'skip' }))
      const ms = Date.now() - started
      const usage = got.usage || {}
      const promptTok = Number(usage.prompt) || estimateTokens(prompt)
      const completionTok = Number(usage.completion) || estimateTokens(got.text)
      void recordUsage({
        kind: 'extract',
        provider: route.dshProvider,
        model: route.model,
        prompt: promptTok,
        completion: completionTok,
        total: Number(usage.total) || (promptTok + completionTok),
        reasoning: Number(usage.reasoning) || 0,
        ms,
        via: got.via || '',
      }).catch(() => undefined)
      if (!got.text || got.via === 'skip' || got.via === 'timeout') {
        return { entities: [], relations: [], via: got.via === 'timeout' ? 'timeout' : 'skip' }
      }
      const packed = parseExtractJson(got.text)
      cache[key] = { entities: packed.entities, relations: packed.relations }
      await saveCache(cache).catch(() => undefined)
      return { ...packed, via: 'dsh-llm' }
    },
  }
}

/**
 * @param {{ extract: Function } | null | undefined} extract
 * @param {Array<{ path?: string, text?: string }>} texts
 */
export async function attachExtract(extract, texts, concurrency = 1, types) {
  const rows = Array.isArray(texts) ? texts : []
  if (!extract || typeof extract.extract !== 'function') return rows
  const allowed = Array.isArray(types) ? types : []
  const out = new Array(rows.length)
  let index = 0
  const workers = Math.min(Math.max(1, Number(concurrency) || 1), rows.length || 1)
  async function worker() {
    while (true) {
      const i = index
      index += 1
      if (i >= rows.length) return
      const row = rows[i]
      const text = String(row && row.text || '')
      if (!text.trim()) {
        out[i] = row
        continue
      }
      const packed = await extract.extract(text, allowed).catch(() => ({ entities: [], relations: [], via: '' }))
      if (!packed || packed.via === 'skip' || packed.via === 'timeout' || packed.via === '') {
        if (packed && packed.via === '') throw new Error('EXTRACT_LLM_UNAVAILABLE')
        out[i] = row
        continue
      }
      if (packed.via !== 'dsh-llm' && packed.via !== 'cache') {
        throw new Error('EXTRACT_LLM_UNAVAILABLE')
      }
      const cleaned = cleanExtract(text, packed, allowed)
      out[i] = {
        ...row,
        entities: cleaned.entities,
        relations: cleaned.relations,
        extracted_by: packed.via === 'cache' ? 'cache' : 'dsh-llm',
      }
    }
  }
  await Promise.all(Array.from({ length: workers }, worker))
  return out
}
