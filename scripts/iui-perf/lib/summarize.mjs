import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { countTokens, TOKENIZER_NAME } from './tokens.mjs'
import {
  effortOf,
  isPromptTurn,
  markerHits,
  paragraphs,
  systemText,
  toolsOf,
  userText,
} from './request-facts.mjs'

const CLASSES = [
  ['iui', /You render interactive UI INSIDE your reply|```iui-html/],
  ['semantic-os', /local knowledge graph of prior chats/],
  ['plan-mode', /You are in plan mode/],
  ['app-spec', /fde-app\/v1/],
  ['persona', /You are a coding agent powered by/],
  ['fde-tool-prose', /fde_submit_result|fde_app_spec_submit|fde_memory_draft|fde_briefing_submit/],
]

export function classifyParagraph(text) {
  for (const [name, pattern] of CLASSES) {
    if (pattern.test(text)) return name
  }
  return 'unclassified'
}

export function pickPromptTurn(records) {
  const turns = records.filter((record) => isPromptTurn(record.body) && toolsOf(record.body).length > 0)
  const live = turns.find((record) => effortOf(record.body).thinking === 'enabled')
  return live || turns[0] || null
}

export function toolUses(body) {
  const messages = body && Array.isArray(body.messages) ? body.messages : []
  const names = []
  for (const message of messages) {
    const content = message && Array.isArray(message.content) ? message.content : []
    for (const block of content) {
      if (block && block.type === 'tool_use' && block.name) names.push(String(block.name))
    }
  }
  return names
}

function countNames(names) {
  const counts = {}
  for (const name of names) counts[name] = (counts[name] || 0) + 1
  return counts
}

export async function describeTurn(record) {
  if (!record) return null
  const system = systemText(record.body)
  const tools = record.body && Array.isArray(record.body.tools) ? record.body.tools : []
  const toolJson = JSON.stringify(tools)
  const effort = effortOf(record.body)
  const fields = {}
  for (const [key, value] of Object.entries(record.body || {})) {
    fields[key] = JSON.stringify(value).length
  }
  return {
    id: record.id,
    fields,
    path: record.path,
    model: record.body && record.body.model ? record.body.model : '',
    maxTokens: record.body && record.body.max_tokens,
    effort: effort.effort || '(absent)',
    thinking: effort.thinking || '(absent)',
    systemChars: system.length,
    systemTokens: await countTokens(system),
    toolCount: tools.length,
    toolNames: toolsOf(record.body).map((tool) => tool.name).filter(Boolean),
    toolChars: toolJson.length,
    toolTokens: await countTokens(toolJson),
    markers: markerHits(system),
    userChars: userText(record.body).length,
  }
}

export async function compareCaptures(left, right) {
  const a = await describeTurn(pickPromptTurn(left.records))
  const b = await describeTurn(pickPromptTurn(right.records))
  const aSystem = a ? systemText(pickPromptTurn(left.records).body) : ''
  const bSystem = b ? systemText(pickPromptTurn(right.records).body) : ''
  const aParts = new Set(paragraphs(aSystem))
  const bOnly = []
  for (const part of paragraphs(bSystem)) {
    if (aParts.has(part)) continue
    bOnly.push({
      class: classifyParagraph(part),
      chars: part.length,
      tokens: await countTokens(part),
      head: part.slice(0, 160),
    })
  }
  const byClass = {}
  for (const row of bOnly) {
    const bucket = byClass[row.class] || { paragraphs: 0, chars: 0, tokens: 0 }
    bucket.paragraphs += 1
    bucket.chars += row.chars
    bucket.tokens += row.tokens
    byClass[row.class] = bucket
  }
  const aNames = new Set(a ? a.toolNames : [])
  const bNames = new Set(b ? b.toolNames : [])
  return {
    tokenizer: TOKENIZER_NAME,
    tokenizerNote: 'o200k_base 不是 DeepSeek 计费分词器。表内数字是同一把尺子下的静态对比，不是供应商账单。',
    A: a,
    B: b,
    delta: {
      systemTokens: a && b ? b.systemTokens - a.systemTokens : null,
      toolTokens: a && b ? b.toolTokens - a.toolTokens : null,
      toolCount: a && b ? b.toolCount - a.toolCount : null,
      toolsOnlyInB: [...bNames].filter((name) => !aNames.has(name)),
      toolsOnlyInA: [...aNames].filter((name) => !bNames.has(name)),
      bOnlyParagraphs: bOnly,
      bOnlyByClass: byClass,
    },
  }
}

export function requestIndex(records) {
  return records.map((record) => {
    const effort = effortOf(record.body)
    return {
      id: record.id,
      path: record.path,
      model: record.body && record.body.model,
      promptTurn: isPromptTurn(record.body),
      tools: toolsOf(record.body).length,
      toolUses: countNames(toolUses(record.body)),
      effort: effort.effort || '(absent)',
      thinking: effort.thinking || '(absent)',
      systemChars: systemText(record.body).length,
      userHead: userText(record.body).slice(0, 80),
    }
  })
}

export function parseSseUsage(text) {
  const usage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  }
  const raw = String(text || '')
  const frames = raw.split('\n\n')
  for (const frame of frames) {
    const dataLine = frame.split('\n').find((line) => line.startsWith('data:'))
    if (!dataLine) continue
    let payload
    try {
      payload = JSON.parse(dataLine.slice(5).trim())
    } catch {
      continue
    }
    const block = payload && payload.message && payload.message.usage
      ? payload.message.usage
      : payload && payload.response && payload.response.usage
        ? payload.response.usage
        : payload && payload.usage
          ? payload.usage
          : null
    if (!block) continue
    for (const key of Object.keys(usage)) {
      if (typeof block[key] === 'number') usage[key] = block[key]
    }
    if (typeof block.prompt_tokens === 'number') usage.input_tokens = block.prompt_tokens
    if (typeof block.completion_tokens === 'number') usage.output_tokens = block.completion_tokens
    const details = block.prompt_tokens_details || block.input_tokens_details
    if (details && typeof details.cached_tokens === 'number') usage.cache_read_input_tokens = details.cached_tokens
  }
  return usage
}

export function assistantTextFromSse(text) {
  let out = ''
  for (const frame of String(text || '').split('\n\n')) {
    const dataLine = frame.split('\n').find((line) => line.startsWith('data:'))
    if (!dataLine) continue
    let payload
    try {
      payload = JSON.parse(dataLine.slice(5).trim())
    } catch {
      continue
    }
    const delta = payload && payload.delta
    if (typeof delta === 'string') out += delta
    if (delta && typeof delta.text === 'string') out += delta.text
    if (delta && typeof delta.content === 'string') out += delta.content
    const choices = payload && Array.isArray(payload.choices) ? payload.choices : []
    for (const choice of choices) {
      const piece = choice && choice.delta && choice.delta.content
      if (typeof piece === 'string') out += piece
    }
    if (delta && delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
      /* reasoning is not the fence */
    }
  }
  return out
}

export function iuiFences(text) {
  const fences = []
  const re = /```iui-html\s*([\s\S]*?)```/g
  let match
  while ((match = re.exec(String(text || '')))) {
    fences.push(match[1].trim())
  }
  return fences
}

const TOOL_RE = /name:\s*'([^']+)',\s*\n\s*description:\s*'((?:\\'|[^'])*)'/g

export async function inventoryFile(file) {
  let text = ''
  try {
    text = await readFile(file, 'utf8')
  } catch {
    return { file, present: false }
  }
  const tools = []
  TOOL_RE.lastIndex = 0
  let match
  while ((match = TOOL_RE.exec(text))) {
    tools.push({ name: match[1], description: match[2] })
  }
  const packed = tools.map((tool) => `${tool.name}\n${tool.description}`).join('\n')
  return {
    file,
    present: true,
    fileChars: text.length,
    fileTokens: await countTokens(text),
    toolCount: tools.length,
    toolNames: tools.map((tool) => tool.name),
    descriptionTokens: await countTokens(packed),
    note: '源码清单，不是线上请求里的工具 schema。',
  }
}

export async function inventorySection(file, exportName) {
  const text = await readFile(file, 'utf8').catch(() => '')
  return {
    file: join(file),
    present: Boolean(text),
    fileChars: text.length,
    fileTokens: text ? await countTokens(text) : 0,
    exportName,
  }
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function spreadOf(values) {
  const nums = (Array.isArray(values) ? values : [])
    .map((value) => finite(value))
    .filter((value) => value != null)
    .sort((left, right) => left - right)
  if (!nums.length) return { n: 0, median: null, min: null, max: null, range: null }
  const mid = Math.floor(nums.length / 2)
  const median = nums.length % 2 === 1 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2
  return {
    n: nums.length,
    median,
    min: nums[0],
    max: nums[nums.length - 1],
    range: nums[nums.length - 1] - nums[0],
  }
}

export function billingOf(metas) {
  const steps = []
  for (const meta of Array.isArray(metas) ? metas : []) {
    const usage = meta && meta.usage && typeof meta.usage === 'object' ? meta.usage : {}
    const input = finite(usage.input)
    const cached = finite(usage.cacheRead)
    const output = finite(usage.output)
    const firstByteMs = finite(meta.firstByteMs)
    const totalMs = finite(meta.totalMs)
    steps.push({
      id: meta && meta.id,
      uncached: input == null ? null : input - (cached == null ? 0 : cached),
      cached: cached == null ? 0 : cached,
      output: output == null ? 0 : output,
      firstByteMs,
      genMs: firstByteMs == null || totalMs == null ? null : totalMs - firstByteMs,
    })
  }
  const sum = (key) => steps.reduce((total, step) => total + (typeof step[key] === 'number' ? step[key] : 0), 0)
  return { steps, uncached: sum('uncached'), cached: sum('cached'), output: sum('output') }
}

export function skillCatalogOf(body) {
  const raw = JSON.stringify(body == null ? '' : body)
  return {
    hasAvailableSkills: raw.includes('<available_skills>'),
    hasEmptyNotice: raw.includes('No skills are currently available'),
  }
}

function catalogLine(catalog) {
  if (catalog && catalog.hasEmptyNotice) return '技能目录：空通知'
  if (catalog && catalog.hasAvailableSkills) return '技能目录：有'
  return '技能目录：无'
}

function groupSection(id, group) {
  return [
    `### ${id}`,
    `首 token 中位 ${group.firstToken.median}，波动 ${group.firstToken.range}`,
    `生成耗时中位 ${group.gen.median}，波动 ${group.gen.range}`,
    `未缓存 ${group.billing.uncached.median}，缓存 ${group.billing.cached.median}，输出 ${group.billing.output.median}`,
    catalogLine(group.skillCatalog),
    '',
  ]
}

export function measurementReport(runs) {
  const rows = Array.isArray(runs) ? runs : []
  const buckets = new Map()
  for (const run of rows) {
    const id = String(run && run.group || '')
    if (!buckets.has(id)) buckets.set(id, [])
    buckets.get(id).push(run)
  }
  const groups = {}
  for (const [id, bucket] of buckets) {
    const billings = bucket.map((run) => billingOf(run.metas))
    const firstSteps = billings.map((bill) => bill.steps[0] || {})
    const sample = bucket.find((run) => run && run.body != null) || bucket[0]
    groups[id] = {
      effort: bucket[0] && bucket[0].effort,
      firstToken: spreadOf(firstSteps.map((step) => step.firstByteMs)),
      gen: spreadOf(firstSteps.map((step) => step.genMs)),
      billing: {
        uncached: spreadOf(billings.map((bill) => bill.uncached)),
        cached: spreadOf(billings.map((bill) => bill.cached)),
        output: spreadOf(billings.map((bill) => bill.output)),
      },
      skillCatalog: skillCatalogOf(sample && sample.body),
    }
  }
  const lines = []
  for (const effort of ['low', 'high']) {
    const ids = [...buckets.keys()].filter((id) => groups[id].effort === effort)
    if (!ids.length) continue
    lines.push(`## effort=${effort}`, '')
    for (const id of ids) lines.push(...groupSection(id, groups[id]))
  }
  if (groups['B-default']) {
    lines.push('## B-default', '')
    lines.push(...groupSection('B-default', groups['B-default']))
  }
  return { groups, markdown: `${lines.join('\n')}\n` }
}
