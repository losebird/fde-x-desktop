import { readFile, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { createLibraryCountContext } from './biz-data-eval-library-count.mjs'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const DATA = '/Users/zxz/Documents/ai-project/fdex测试'
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const WS = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const mainBase = 'http://127.0.0.1:5174'
const bffBase = 'http://127.0.0.1:4318'
const TAIL = '只要预览，不要过账，不要 biz_write。'
const CONCURRENCY = 8

const COMMIT = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim()
const BRANCH = 'cursor/eval-three-causes-2d90'

const prior = JSON.parse(await readFile(`${STORE}/internal/biz-data-eval.json`, 'utf8'))
const cases = prior.results
if (cases.length !== 362) throw new Error(`expected 362 cases, got ${cases.length}`)

async function bffJson(path, { method = 'GET', body, timeoutMs = 120000 } = {}) {
  const res = await fetch(`${bffBase}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      Origin: mainBase,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  })
  const json = await res.json().catch(() => ({}))
  return { http: res.status, json }
}

function speechFor(speech) {
  const s = String(speech || '').trim()
  return s.includes(TAIL) ? s : `${s.replace(/[。.]?$/, '')}。${TAIL}`
}

function sheetToPlan(sheet) {
  if (!sheet || typeof sheet !== 'object') return null
  return {
    kind: sheet.kind,
    where: sheet.where || sheet.listWhere || [],
    steps: sheet.steps || [],
    from: sheet.from,
    peers: sheet.peers || [],
    hitTotal: sheet.hitTotal,
    hitTotalState: sheet.hitTotalState,
  }
}

function flattenOptions(objects) {
  const raw = objects?.options || []
  if (!raw.length) return []
  if (Array.isArray(raw[0])) {
    const out = []
    for (const group of raw) for (const opt of group) out.push(opt)
    return out
  }
  return raw
}

function planWhereValues(plan, kind) {
  if (!plan || typeof plan !== 'object') return null
  if (String(plan.kind || '').trim() === kind) return (plan.where || []).flatMap((term) => term.values || [])
  const peer = (plan.peers || []).find((row) => String(row.kind || '').trim() === kind)
  if (peer) return (peer.where || []).flatMap((term) => term.values || [])
  for (const step of plan.steps || []) {
    if (String(step.kind || '').trim() === kind) return (step.where || []).flatMap((term) => term.values || [])
  }
  let from = plan.from
  if (Array.isArray(from)) {
    const row = from.find((r) => String(r.kind || '').trim() === kind)
    if (row) return (row.where || []).flatMap((term) => term.values || [])
  } else if (from && typeof from === 'object' && String(from.kind || '').trim() === kind) {
    return (from.where || []).flatMap((term) => term.values || [])
  }
  return null
}

function normFrom(from) {
  const out = []
  let f = from
  if (Array.isArray(from)) for (const x of from) out.push(String(x.kind || '').trim())
  else while (f && typeof f === 'object') {
    out.push(String(f.kind || '').trim())
    f = f.from
  }
  return out
}

function edgeGate(caseRow, plan) {
  const o = caseRow.objects
  const from = o.from
  const to = o.to
  const pk = String(plan?.kind || '').trim()
  if (pk !== String(caseRow.requestKind || '').trim()) return false
  const steps = (plan?.steps || []).map((s) => String(s.kind || '').trim()).filter(Boolean)
  const fromKinds = normFrom(plan?.from)
  if (from === to) {
    if (steps.length === 0 && fromKinds.length === 0) return false
    return true
  }
  if (steps.length === 2 && steps[0] === from && steps[1] === to) return true
  if (steps.length === 0 && fromKinds.includes(from) && pk === to) return true
  if (steps.length === 1 && steps[0] === from && pk === to) return true
  if (pk === from) return false
  return false
}

function enumGate(caseRow, plan) {
  const opts = flattenOptions(caseRow.objects)
  const pk = String(plan?.kind || '').trim()
  if (pk !== String(caseRow.requestKind || '').trim()) return false
  if (!opts.length) return false
  const multiField = opts.length > 1 && new Set(opts.map((o) => o.field)).size < opts.length
  const wh = (plan?.where || []).flatMap((t) => t.values || [])
  if (!wh.length) {
    if (multiField) return true
    if (opts.some((o) => o.field === 'rating')) return false
    return opts.some(
      (o) =>
        caseRow.speech.startsWith(String(o.say || '') + '的') ||
        String(caseRow.objects.kind || '').includes(String(o.say || '')),
    )
  }
  for (const opt of opts) {
    const vals = planWhereValues(plan, opt.kind)
    if (!vals) return false
    const code = String(opt.code || '').trim()
    const say = String(opt.say || '').trim()
    if (!vals.includes(code) && !vals.includes(say)) return false
    if (code && code !== say && !vals.includes(code)) return false
  }
  if (
    opts.some((o) => o.kind === '工单' && (o.code === 'resolved' || o.code === 'closed')) &&
    wh.includes('resolved') &&
    wh.includes('closed')
  ) {
    return false
  }
  if (opts.some((o) => o.code === 'new') && wh.includes('pending')) return false
  return true
}

function sharedGate(caseRow, plan) {
  const opts = flattenOptions(caseRow.objects)
  for (const opt of opts) {
    const vals = planWhereValues(plan, opt.kind)
    if (!vals) return false
    const code = String(opt.code || '').trim()
    const say = String(opt.say || '').trim()
    if (!vals.includes(code) && !vals.includes(say)) return false
    if (code && code !== say && !vals.includes(code)) return false
  }
  const owners = new Set(caseRow.objects?.owners || [])
  const steps = plan?.steps || []
  if (steps.length > 2) return false
  for (const step of steps) {
    const k = String(step.kind || '').trim()
    if (k && !owners.has(k) && k !== String(plan?.kind || '').trim()) return false
  }
  return true
}

function coverGate(caseRow, plan) {
  return (
    String(plan?.kind || '').trim() === String(caseRow.requestKind || '').trim() &&
    String(caseRow.requestKind || '').trim() === String(caseRow.objects.long || '').trim()
  )
}

function schemaGate(caseRow, plan) {
  const pk = String(plan?.kind || '').trim()
  if (pk !== String(caseRow.requestKind || '').trim()) return false
  const steps = (plan?.steps || []).map((s) => String(s.kind || '').trim()).filter(Boolean)
  const parent = caseRow.objects.parent
  const child = caseRow.objects.child
  if (steps.length === 0) return true
  if (steps.includes(parent) && steps.includes(child)) return false
  return true
}

function gateFor(caseRow, plan) {
  switch (caseRow.classId) {
    case 'edge':
      return edgeGate(caseRow, plan)
    case 'enum':
      return enumGate(caseRow, plan)
    case 'shared':
      return sharedGate(caseRow, plan)
    case 'cover':
      return coverGate(caseRow, plan)
    case 'schema-gap':
      return schemaGate(caseRow, plan)
    default:
      return false
  }
}

function kindResource(kind, kinds) {
  return kinds.find((row) => row.kind === kind)?.resource || null
}

async function libraryBundle(caseRow, kinds, libraryCountFor, walkFk) {
  const priorCounts = caseRow.counts || []
  const counts = []
  for (const row of priorCounts) {
    let countRow = row
    if (caseRow.classId === 'edge' && row.kind === caseRow.objects?.from && row.kind !== caseRow.requestKind) {
      countRow = { kind: caseRow.requestKind, field: row.field, codes: row.codes, column: row.column }
    }
    let expected = await libraryCountFor(caseRow, countRow, walkFk)
    if (expected == null && Number.isFinite(row.expected)) expected = row.expected
    const kind = caseRow.classId === 'edge' && row.kind === caseRow.objects?.from ? caseRow.requestKind : row.kind
    counts.push({ ...row, kind, expected, actual: null })
  }
  if (!counts.length) {
    const resource = kindResource(caseRow.requestKind, kinds)
    if (resource) {
      const expected = await libraryCountFor(caseRow, { kind: caseRow.requestKind }, walkFk)
      counts.push({ kind: caseRow.requestKind, expected, actual: null })
    }
  }
  const primary =
    counts.find((c) => c.kind === caseRow.requestKind) ||
    counts.find((c) => c.kind === caseRow.objects?.to) ||
    counts[0]
  return { counts, expectedCount: primary?.expected ?? null }
}

async function previewCase(caseRow) {
  const speech = speechFor(caseRow.speech)
  const { json } = await bffJson('/api/v1/biz/preview', {
    method: 'POST',
    body: {
      workspaceId: WS,
      cwd: DATA,
      kind: caseRow.requestKind,
      action: '现查',
      speech,
    },
  })
  const sheet = json?.data?.sheet || json?.data
  const plan = sheetToPlan(sheet)
  const actual =
    plan?.hitTotalState === 'known' && plan?.hitTotal != null ? Number(plan.hitTotal) : null
  return { plan, sheet, error: json?.error || null, actual }
}

async function mapPool(items, worker, limit) {
  const out = new Array(items.length)
  let i = 0
  const runners = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await worker(items[idx], idx)
    }
  })
  await Promise.all(runners)
  return out
}

const kindsPayload = (await bffJson(`/api/v1/biz/kinds?cwd=${encodeURIComponent(DATA)}&workspaceId=${WS}`)).json
const kinds = kindsPayload?.data?.kinds || []
if (!kinds.length) throw new Error('biz/kinds empty')

const { libraryCountFor, nocoMeta, walkFk } = await createLibraryCountContext(kinds)

console.log(`rescore ${cases.length} @ ${COMMIT}`)

const rescored = await mapPool(
  cases,
  async (caseRow, idx) => {
    const lib = await libraryBundle(caseRow, kinds, libraryCountFor, walkFk)
    let preview
    try {
      preview = await previewCase(caseRow)
    } catch (err) {
      preview = { plan: null, sheet: null, error: String(err.message || err), actual: null }
    }
    const plan = preview.plan
    const gatePass = plan ? gateFor(caseRow, plan) : false
    const actualCount = preview.actual
    const counts = lib.counts.map((row) => {
      let actual = null
      if (plan && row.kind === plan.kind) {
        actual = plan.hitTotalState === 'known' && plan.hitTotal != null ? Number(plan.hitTotal) : null
      }
      const peer = (plan?.peers || []).find((p) => p.kind === row.kind)
      if (peer) {
        actual = peer.hitTotalState === 'known' && peer.hitTotal != null ? Number(peer.hitTotal) : null
      }
      return { ...row, actual }
    })
    const expectedCount = lib.expectedCount
    const primary = counts.find((c) => c.kind === caseRow.requestKind)
    const primaryActual = primary?.actual ?? actualCount
    const countsAlign = counts.every((row) => {
      if (row.expected == null) return row.actual == null
      return row.actual != null && row.actual === row.expected
    })
    const livePass =
      gatePass &&
      plan?.hitTotalState === 'known' &&
      primaryActual != null &&
      expectedCount != null &&
      primaryActual === expectedCount &&
      countsAlign
    if ((idx + 1) % 40 === 0) console.log(`progress ${idx + 1}/${cases.length}`)
    return {
      ...caseRow,
      gatePass,
      livePass,
      expectedCount,
      actualCount,
      counts,
      plan: plan || caseRow.plan,
      error: preview.error,
    }
  },
  CONCURRENCY,
)

const summary = {
  edge: { total: 0, gatePass: 0, livePass: 0 },
  enum: { total: 0, gatePass: 0, livePass: 0 },
  cover: { total: 0, gatePass: 0, livePass: 0 },
  shared: { total: 0, gatePass: 0, livePass: 0 },
  'schema-gap': { total: 0, gatePass: 0, livePass: 0 },
}
for (const row of rescored) {
  const bucket = summary[row.classId]
  if (!bucket) continue
  bucket.total += 1
  if (row.gatePass) bucket.gatePass += 1
  if (row.livePass) bucket.livePass += 1
}

const outDoc = {
  branch: BRANCH,
  sha: COMMIT,
  workspace: DATA,
  generatedFrom: 'published vocab and graph',
  handPicked: false,
  productChanged: false,
  mergedMain: false,
  pushed: false,
  summary,
  results: rescored,
}

await writeFile(`${STORE}/internal/biz-data-eval.json`, `${JSON.stringify(outDoc, null, 2)}\n`)

function countLine(caseRow) {
  const lib = caseRow.expectedCount
  const right = caseRow.actualCount
  if (lib == null && right == null) return '右边没有总数'
  if (right == null) return `库里 ${lib}，右边没有总数`
  return `库里 ${lib}，右边 ${right}`
}

function caseLabel(caseRow) {
  switch (caseRow.classId) {
    case 'edge':
      return `${caseRow.objects.from} → ${caseRow.objects.to}`
    case 'enum':
      return `${caseRow.objects.kind} / ${caseRow.objects.say}`
    case 'shared':
      return `${caseRow.objects.say}（${(caseRow.objects.owners || []).join('、')}）`
    case 'cover':
      return `${caseRow.objects.long} 盖住 ${caseRow.objects.short}`
    case 'schema-gap':
      return `${caseRow.objects.parent} → ${caseRow.objects.child}（图上无边）`
    default:
      return caseRow.speech
  }
}

function failBuckets(classId) {
  const rows = rescored.filter((r) => r.classId === classId)
  const groups = {
    gateCount: [],
    gateOnly: [],
    countOnly: [],
  }
  for (const row of rows) {
    const countsOk =
      row.expectedCount != null &&
      row.actualCount != null &&
      row.expectedCount === row.actualCount
    const countsBad =
      row.expectedCount == null ||
      row.actualCount == null ||
      row.expectedCount !== row.actualCount
    if (!row.gatePass && countsBad) groups.gateCount.push(row)
    else if (!row.gatePass && countsOk) groups.gateOnly.push(row)
    else if (row.gatePass && countsBad) groups.countOnly.push(row)
  }
  return groups
}

const classTitles = {
  edge: '已发布的边',
  enum: '每个对象上的枚举词',
  shared: '同一个枚举词落在多个对象上',
  cover: '长对象名盖住短对象名',
  'schema-gap': '字段指向了对象，图上没有这条边',
}

let md = `# 业务数据评测

分支 \`${BRANCH}\`，提交 \`${COMMIT}\`。工作区 \`${DATA}\`。362 条对现网词表与已发布图重打（预览 API，未开 362 轮聊天）。没有合进 main，没有推远程，没有过账。

闸看计划是不是这条结构。现网看右边报出的命中条数是不是等于业务库 \`meta.count\` 单独数出来的条数。右边没有报出总数的，算没对上。五类分开，不合成一个百分比。

生成规则：

- 已发布的边，每条走一遍。85 条。
- 每个对象上的每个枚举词，各加一遍。220 条。
- 更长的对象名盖住更短的对象名，每一对走一遍。6 对。
- 同一个枚举词落在多个对象上，每一组走一遍。29 组。
- 连接器字段指向了对象，但已发布的图上没有这条边。22 对。没有把所有「没有边」的对象对都做一遍。

\`{{t("Departments")}}\`、\`{{t("Users")}}\`、\`{{t("Roles")}}\` 是已发布的对象名，留在集合里。

## 分数

| 类 | 用例 | 闸 | 现网 |
|---|---:|---:|---:|
| 已发布的边 | ${summary.edge.total} | ${summary.edge.gatePass} | ${summary.edge.livePass} |
| 每个对象上的枚举词 | ${summary.enum.total} | ${summary.enum.gatePass} | ${summary.enum.livePass} |
| 长对象名盖住短对象名 | ${summary.cover.total} | ${summary.cover.gatePass} | ${summary.cover.livePass} |
| 同一个枚举词落在多个对象上 | ${summary.shared.total} | ${summary.shared.gatePass} | ${summary.shared.livePass} |
| 字段指向了对象，图上没有这条边 | ${summary['schema-gap'].total} | ${summary['schema-gap'].gatePass} | ${summary['schema-gap'].livePass} |

长名 6 对、图上没边的 22 对，闸和现网都对上了时下面不写该类。条数写「库里 / 右边」。

`

for (const classId of ['edge', 'enum', 'shared']) {
  const b = failBuckets(classId)
  if (!b.gateCount.length && !b.gateOnly.length && !b.countOnly.length) continue
  md += `## ${classTitles[classId]}\n\n`
  if (b.gateCount.length) {
    md += '闸没过，条数也没对上：\n\n'
    for (const row of b.gateCount) {
      md += `- ${caseLabel(row)}。${countLine(row)}。\n`
    }
    md += '\n'
  }
  if (b.gateOnly.length) {
    md += '闸没过，条数对上：\n\n'
    for (const row of b.gateOnly) {
      md += `- ${caseLabel(row)}。${countLine(row)}。\n`
    }
    md += '\n'
  }
  if (b.countOnly.length) {
    md += '闸过了，条数没对上：\n\n'
    for (const row of b.countOnly) {
      md += `- ${caseLabel(row)}。${countLine(row)}。\n`
    }
    md += '\n'
  }
}

if (summary.cover.gatePass === summary.cover.total && summary.cover.livePass === summary.cover.total) {
  md += `## 另外两类\n\n长对象名盖住短对象名：${summary.cover.total} 条，闸 ${summary.cover.gatePass}，现网 ${summary.cover.livePass}。\n\n`
}
if (summary['schema-gap'].gatePass === summary['schema-gap'].total && summary['schema-gap'].livePass === summary['schema-gap'].total) {
  md += `字段指向了对象、图上没有这条边：${summary['schema-gap'].total} 条，闸 ${summary['schema-gap'].gatePass}，现网 ${summary['schema-gap'].livePass}。\n`
}

await writeFile(`${STORE}/docs/biz-data-eval.md`, md)
console.log(JSON.stringify(summary, null, 2))
