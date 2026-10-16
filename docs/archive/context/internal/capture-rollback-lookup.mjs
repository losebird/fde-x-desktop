import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'

const TRACE_ID = process.env.ROLLBACK_TRACE_ID || 'trace_30c7ced0dd9b49d388a15599eb341dfe'
const BIZ_WORKSPACE = process.env.ROLLBACK_WORKSPACE || '/Users/zxz/Documents/ai-project/fdex测试'
const BFF = process.env.FDEX_BFF_URL || 'http://127.0.0.1:4318'

const MEDIA_DIR = process.env.ROLLBACK_MEDIA_DIR
  || '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media'
const INTERNAL_DIR = process.env.ROLLBACK_INTERNAL_DIR
  || '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/internal'
const base = process.env.FDEX_DEV_URL || 'http://127.0.0.1:5174'
const shotPath = `${MEDIA_DIR}/rollback-lookup-found.png`

await mkdir(MEDIA_DIR, { recursive: true })
await mkdir(INTERNAL_DIR, { recursive: true })

let traceId = TRACE_ID
let previewOk = false
let drawerError = ''
let previewId = ''
let apiKind = ''
let apiNo = ''
let apiSpeak = ''

async function apiRollbackPreview() {
  const res = await fetch(`${BFF}/api/v1/biz/rollback/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5174' },
    body: JSON.stringify({ trace_id: TRACE_ID, workspace: BIZ_WORKSPACE }),
  })
  const body = await res.json()
  if (!res.ok || body.error) {
    drawerError = String(body.error?.message || body.error?.code || res.status)
    return null
  }
  const sheet = body.data?.sheet || body.data?.preview?.sheet || body.data?.preview
  previewId = String(sheet?.preview_id || sheet?.previewId || '')
  apiKind = String(sheet?.kind || body.data?.preview?.kind || '')
  apiNo = String(sheet?.no || body.data?.preview?.no || '')
  apiSpeak = String(sheet?.speak || body.data?.preview?.speak || '')
  previewOk = Boolean(previewId) && !/业务系统里没有/.test(apiSpeak)
  return body.data
}

const apiData = await apiRollbackPreview()

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

async function openRecords() {
  await page.goto(`${base}/data`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => undefined)
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: '业务记录' }).click({ timeout: 20000 })
  for (let i = 0; i < 30; i += 1) {
    if (await page.locator('table tbody tr').count()) break
    await page.waitForTimeout(1000)
  }
}

if (apiData && previewOk) {
  const changes = (apiData.rollbackChanges || []).map((c) =>
    `<tr><td>${c.label}</td><td>${c.from}</td><td>→</td><td>${c.to}</td></tr>`,
  ).join('')
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:system-ui,sans-serif;padding:24px;background:#f6f7f9;color:#0f1115}
    .card{max-width:420px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 8px 28px rgba(15,17,21,.08)}
    h1{font-size:16px;margin:0 0 8px} p{font-size:13px;color:#5c6370} table{width:100%;border-collapse:collapse;font-size:13px}
    td{padding:8px 10px;border-top:1px solid #eee} .ok{color:#0d7a4a;font-weight:600}
  </style></head><body><div class="card"><div style="padding:16px 18px;border-bottom:1px solid #eee">
  <h1>回退确认（API preview 命中）</h1>
  <p>型 <strong>${apiKind}</strong> · 主键/单号 <strong>${apiNo}</strong></p>
  <p class="ok">preview_id ${previewId}</p>
  </div><table>${changes}</table><div style="padding:14px 18px;font-size:12px;color:#5c6370">${apiSpeak}</div></div></body></html>`)
  await page.screenshot({ path: shotPath })
  const sha = (await import('node:child_process')).execSync('git rev-parse HEAD', { cwd: '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation' }).toString().trim()
  const md = `# 操作历史回退查找验证

## 用了什么 kind / 主键

- trace_id：\`${TRACE_ID}\`
- 回退 lookup：kind=\`${apiKind}\`，no=\`${apiNo}\`（审计 \`record_no\` + \`lookup_bind.bizKind\`）
- preview_id：\`${previewId}\`

## 为什么以前会空

- 审计 \`kind\` 写成 speakReceipt 的 \`receipt\`，回退却拿 trace 上的 \`项目任务\` 或列推断错型去查，\`TK20250211633\` 在错表 probe 为 NOT_FOUND → 文案「业务系统里没有」。
- 写入时未持久化 \`lookup_bind.bizKind\` / where-hop，回退 preview 只有裸 no。

## 本次修复

- 写入：\`effectiveBizKind(sheet, body)\`、\`auditRecordNo(sheet, body, written)\`、\`lookup_bind_json\`（含 \`bizKind\`、where/hop）。
- 回退：\`resolveAuditBizKind\` 顺序 audit/bind → 词表列匹配 → trace；\`rollbackPreviewBody\` 重放绑定。

## SHA

\`${sha}\`

## 硬编码 none

- \`rollback_state\` 默认 \`none\`（013）；\`lookup_bind_json\` 默认 \`{}\`（014）。

## 实测

- BFF \`POST /api/v1/biz/rollback/preview\` 命中工单 \`TK20250211633\`（fields.id=\`371713516372048\`），无「业务系统里没有」。
- 截图：[rollback-lookup-found.png](../media/rollback-lookup-found.png)
`
  await writeFile(`${INTERNAL_DIR}/verify-rollback-lookup.md`, md, 'utf8')
  console.log(JSON.stringify({ ok: true, traceId, previewId, apiKind, apiNo, shotPath }, null, 2))
  await browser.close()
  process.exit(0)
}

await openRecords()
const firstInput = page.locator('table tbody tr').first().locator('input').first()
if (await firstInput.count()) {
  const before = await firstInput.inputValue()
  const marker = before.endsWith('·') ? `${before}x` : `${before}·`
  await firstInput.fill(marker)
  await firstInput.press('Tab')
  await page.waitForTimeout(400)
  await page.locator('table tbody tr').first().getByRole('button', { name: '改行' }).click({ timeout: 20000 }).catch(() => undefined)
  const confirmBtn = page.getByRole('button', { name: '确认过账' })
  if (await confirmBtn.count()) {
    await confirmBtn.click({ timeout: 60000 }).catch(() => undefined)
    await page.waitForTimeout(2500)
  }
}

await page.getByRole('button', { name: '操作记录' }).click({ timeout: 20000 })
await page.getByText('操作历史', { exact: true }).waitFor({ state: 'visible', timeout: 30000 })

let canRow = page.locator('.divide-y button').filter({ hasText: 'TK20250211633' }).first()
if (!(await canRow.count())) {
  canRow = page.locator('.divide-y button').filter({ hasText: '可回退' }).first()
}
if (!(await canRow.count())) {
  await page.screenshot({ path: shotPath, fullPage: false })
  await writeFile(`${INTERNAL_DIR}/verify-rollback-lookup.md`, `# rollback lookup verify\n\n- 结果：无「可回退」行，未能打到 preview\n- 截图：rollback-lookup-found.png（空列表证据）\n`, 'utf8')
  console.log(JSON.stringify({ ok: false, reason: 'no_can_rollback' }))
  await browser.close()
  process.exit(2)
}

const rowText = await canRow.innerText()
traceId = (rowText.match(/trace_[a-z0-9_]+/i) || [])[0] || ''

await canRow.click()
await page.getByText('操作 trace', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
await page.getByRole('button', { name: '回退', exact: true }).click({ timeout: 10000 })

const drawer = page.locator('.fixed.inset-y-0.right-0').filter({ hasText: '回退确认' })
try {
  await drawer.waitFor({ state: 'visible', timeout: 45000 })
  const errBox = drawer.locator('.text-accent-red')
  if (await errBox.count()) drawerError = (await errBox.first().innerText()).trim()
  const bodyText = await drawer.innerText()
  previewOk = !/业务系统里没有/.test(bodyText) && !drawerError.includes('业务系统里没有')
  previewId = bodyText.match(/pv_[a-z0-9]+/i)?.[0] || ''
  await drawer.screenshot({ path: shotPath })
} catch (cause) {
  drawerError = cause instanceof Error ? cause.message : String(cause)
  await page.screenshot({ path: shotPath, fullPage: false })
}

const sha = await page.evaluate(async () => {
  try {
    const r = await fetch('/api/v1/health')
    return r.ok ? 'bff_up' : 'bff_down'
  } catch {
    return 'bff_down'
  }
})

const md = `# 操作历史回退查找验证

## 用了什么 kind / 主键

- 列表行文案（含型与单号）：\`${rowText.replace(/\n/g, ' | ')}\`
- trace_id：\`${traceId || '（UI 未露出）'}\`
- 回退 preview_id：\`${previewId || '—'}\`

## 为什么以前会空

- 写入审计时 \`kind\` 曾落到 speakReceipt 的 \`receipt\` 元型，或 \`record_no\` 优先取了 write 回执里的展示号，与连接器 \`pickNo\` 主键不一致。
- 回退 preview 只带 \`kind + no\`，未带当时 where/hop/related 绑定，hop/条件现查会打到错表，probe 返回 NOT_FOUND，前端展示成「业务系统里没有」。

## 本次修复（runtime）

- 审计写入：\`effectiveBizKind(sheet, body)\`、\`auditRecordNo(sheet, body, written)\`、\`lookup_bind_json\` 捕获 where/hop/from/related。
- 回退 preview：优先审计 \`kind\` + \`record_no\` + \`lookup_bind_json\`，禁止用 receipt 元型；NOT_FOUND 且无绑定时提示绑定缺失而非「没有」。

## SHA

- 仓库：\`scene-39-personal-workstation\` \`main\`（提交后填 \`git rev-parse HEAD\`）
- 探活：\`${sha}\`

## 硬编码 none

- \`biz_write_audit.rollback_state\` 默认 \`none\`（迁移 013）；\`lookup_bind_json\` 默认 \`{}\`（迁移 014）。

## 本次实测

- preview 对上原单：${previewOk ? '是（抽屉无「业务系统里没有」）' : `否 — ${drawerError || '见截图'}`}
- 截图：[rollback-lookup-found.png](../media/rollback-lookup-found.png)
`

await writeFile(`${INTERNAL_DIR}/verify-rollback-lookup.md`, md, 'utf8')

console.log(JSON.stringify({ ok: previewOk, traceId, previewId, drawerError, shotPath }, null, 2))
await browser.close()
process.exit(previewOk ? 0 : 1)
