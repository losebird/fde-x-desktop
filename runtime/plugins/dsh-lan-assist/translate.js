/**
 * Bubble translation. Sticks under the line. Never a letter, never a session followup.
 * @module dsh-lan-assist/translate
 */

export function looksChinese(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ''))
}

export function translateLang(text) {
  return looksChinese(text) ? 'EN' : '中'
}

function cleanOut(text) {
  return String(text || '')
    .replace(/^\s*---+\s*|\s*---+\s*$/g, '')
    .replace(/^["'「『]|["'」』]$/g, '')
    .replace(/\[draft EN\]|【试译】/gi, '')
    .trim()
}

function collectDelta(chunk, out) {
  if (!chunk) return out
  if (chunk.type === 'text-delta') return out + String(chunk.text || '')
  if (chunk.type === 'block-end' && chunk.block && chunk.block.type === 'text') {
    const text = String(chunk.block.text || '')
    if (!text) return out
    if (!out || text.startsWith(out)) return text
    if (out.indexOf(text) >= 0) return out
    return out
  }
  return out
}

async function pickRoute(llm) {
  const providers = typeof llm.listProviders === 'function' ? llm.listProviders() : []
  const ids = providers.map((row) => String((row && (row.id || row.provider)) || '').trim()).filter(Boolean)
  const provider = ids.find((id) => id === 'deepseek-official') || ids[0] || ''
  if (!provider) return null
  const models = typeof llm.listModels === 'function' ? await llm.listModels(provider) : []
  const model = String((models[0] && (models[0].id || models[0].model)) || '').trim()
  return { provider, model: model || 'deepseek-v4-flash' }
}

export async function translateQuote(llm, quote) {
  const text = String(quote || '').trim()
  if (!text) return { ok: false, error: 'EMPTY_BODY', hint: '还没有要译的。' }
  if (!llm || typeof llm.stream !== 'function') {
    return { ok: false, error: 'NO_LLM', hint: '本机没有模型，不能译。' }
  }
  const route = await pickRoute(llm)
  if (!route) return { ok: false, error: 'NO_LLM', hint: '本机没有模型，不能译。' }
  const toEn = looksChinese(text)
  const system = toEn
    ? 'Translate Chinese to English. Output only the translation. No quotes, no draft, no explanation.'
    : '把英文译成中文。只输出译文。不要引号、不要 draft、不要解释。'
  let out = ''
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ac && setTimeout(() => ac.abort(), 20_000)
  try {
    const messages = [{
      role: 'user',
      content: [{ type: 'text', text }],
      source: { kind: 'plugin', plugin: 'dsh-lan-assist' },
    }]
    for await (const chunk of llm.stream({
      provider: route.provider,
      model: route.model,
      system,
      messages,
      maxTokens: 512,
      purpose: 'translate',
      signal: ac && ac.signal,
    })) {
      out = collectDelta(chunk, out)
    }
  } catch (error) {
    const aborted = error && (error.name === 'AbortError' || error.code === 'ABORT')
    return { ok: false, error: aborted ? 'TIMEOUT' : 'TRANSLATE', hint: aborted ? '译太久了。再点一次。' : ((error && error.message) || '没译成') }
  } finally {
    timer && clearTimeout(timer)
  }
  const cleaned = cleanOut(out)
  if (!cleaned) return { ok: false, error: 'EMPTY_BODY', hint: '没译成' }
  return { ok: true, lang: translateLang(text), out: cleaned }
}
