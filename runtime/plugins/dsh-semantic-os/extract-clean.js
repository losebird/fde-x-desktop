/**
 * Keep extracted entities that actually appear in the source window.
 * Drops chat filler. Does not hard-code business kind names.
 * @module dsh-semantic-os/extract-clean
 */

const CHAT_FILLER = new Set([
  '我', '你', '他', '她', '我们', '你们', '他们', '咱们',
  '这个', '那个', '这些', '那些', '这里', '那里',
  '什么', '怎么', '为什么', '是否', '如何',
  '今天', '明天', '昨天', '现在', '刚才',
  '问题', '事情', '东西', '内容', '信息',
  '功能', '系统', '用户', '页面', '按钮',
  'ok', 'OK', 'yes', 'no',
])

function compact(text) {
  return String(text || '').replace(/\s+/g, '').toLowerCase()
}

export function labelInSource(label, source) {
  const needle = compact(label)
  if (needle.length < 2) return false
  const hay = compact(source)
  return hay.includes(needle)
}

export function isChatFiller(label) {
  const raw = String(label || '').trim()
  if (!raw) return true
  if (CHAT_FILLER.has(raw) || CHAT_FILLER.has(raw.toLowerCase())) return true
  if (raw.length < 2 || raw.length > 40) return true
  if (/^[?？。.!！,，、]+$/.test(raw)) return true
  if (/^(请问|帮我|看一下|怎么样|好的|嗯|啊)+$/.test(raw)) return true
  return false
}

export function cleanExtract(source, packed, types) {
  const window = String(source || '')
  const allowed = new Set((Array.isArray(types) ? types : []).map((row) => String(row || '').trim()).filter(Boolean))
  const kept = []
  const names = new Set()
  for (const row of Array.isArray(packed && packed.entities) ? packed.entities : []) {
    const label = String((row && (row.text || row.label || row.name)) || '').trim()
    if (!label || isChatFiller(label) || !labelInSource(label, window)) continue
    let type = String((row && row.type) || 'Entity').trim() || 'Entity'
    if (allowed.size && type !== 'Entity' && !allowed.has(type)) type = 'Entity'
    if (names.has(label)) continue
    names.add(label)
    kept.push({ ...row, text: label, label, type })
    if (kept.length >= 12) break
  }
  const relations = []
  for (const row of Array.isArray(packed && packed.relations) ? packed.relations : []) {
    const src = String((row && (row.source || row.subject)) || '').trim()
    const tgt = String((row && (row.target || row.object)) || '').trim()
    const kind = String((row && (row.type || row.predicate)) || 'related_to').trim() || 'related_to'
    if (!names.has(src) || !names.has(tgt) || src === tgt) continue
    relations.push({ ...row, source: src, target: tgt, type: kind })
    if (relations.length >= 16) break
  }
  return { entities: kept, relations }
}
