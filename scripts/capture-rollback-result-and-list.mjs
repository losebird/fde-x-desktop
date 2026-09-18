import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'

const MEDIA_DIR = process.env.ROLLBACK_MEDIA_DIR
  || '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media'
const INTERNAL_DIR = process.env.ROLLBACK_INTERNAL_DIR
  || '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/internal'
const base = process.env.FDEX_DEV_URL || 'http://127.0.0.1:5174'

await mkdir(MEDIA_DIR, { recursive: true })
await mkdir(INTERNAL_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const report = {
  toastVisible: false,
  toastText: '',
  listHasArrowDiff: false,
  listSample: '',
  rollbackRowNotCan: null,
  ok: false,
}

await page.goto(`${base}/data`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => undefined)
await page.waitForTimeout(1500)
await page.locator('button').filter({ hasText: /^操作记录$/ }).first().click({ timeout: 20000 })
await page.getByText('操作历史', { exact: true }).waitFor({ state: 'visible', timeout: 30000 })

const listTextBefore = await page.locator('.divide-y').first().innerText().catch(() => '')
report.listHasArrowDiff = listTextBefore.includes('→')
report.listSample = listTextBefore.split('\n').slice(0, 6).join(' | ')

await page.screenshot({
  path: `${MEDIA_DIR}/operation-list-with-diff.png`,
  fullPage: false,
})

const canRollbackRow = page.locator('.divide-y button').filter({ hasText: '可回退' }).first()
if (await canRollbackRow.count()) {
  await canRollbackRow.click()
  await page.getByText('操作 trace', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
  await page.getByRole('button', { name: '回退', exact: true }).click({ timeout: 10000 })
  await page.getByText('回退确认').waitFor({ state: 'visible', timeout: 15000 })
  await page.getByRole('button', { name: '确认回退并写回' }).click({ timeout: 10000 })
  await page.getByText('已回退并写回', { exact: false }).or(page.getByText('回退写回失败')).first()
    .waitFor({ state: 'visible', timeout: 20000 }).catch(() => undefined)
  await page.waitForTimeout(500)
  await page.locator('button').filter({ hasText: /^操作记录$/ }).first().click({ timeout: 5000 }).catch(() => undefined)
  await page.waitForTimeout(400)

  const alert = page.locator('[role="alert"][aria-live="assertive"]').first()
  if (await alert.count()) {
    report.toastVisible = await alert.isVisible()
    report.toastText = (await alert.innerText()).trim()
  }

  await page.screenshot({ path: `${MEDIA_DIR}/rollback-result-toast.png`, fullPage: false })

  const firstRowText = await page.locator('.divide-y button').first().innerText().catch(() => '')
  report.rollbackRowNotCan = !firstRowText.includes('可回退') || firstRowText.includes('已完成')
  if (!report.listHasArrowDiff) {
    report.listHasArrowDiff = firstRowText.includes('→')
  }
} else {
  await page.screenshot({ path: `${MEDIA_DIR}/rollback-result-toast.png`, fullPage: false })
  report.toastText = '(no can-rollback row — toast not exercised)'
}

report.ok = report.toastVisible
  && (report.toastText.includes('已回退并写回') || report.toastText.includes('回退写回失败') || report.toastText.includes('失败'))
  && report.listHasArrowDiff

const md = `---
cursor:
  subagentId: "bc-90395b4e-50d9-5040-8bb4-2ac649dcda06"
---

# 回退提示与列表变更 · 验证

## 根因（仍无桌面提示）

| 假设 | 结论 |
|------|------|
| 成功路径未 set | \`confirmRollback\` 会 \`showRollbackFeedback\`；原先只有卡片顶栏条，抽屉关掉后易被忽略 |
| 刷新清掉 | \`refresh()\` 不清 feedback；但打开回退预览时会 \`setRollbackFeedback(null)\`，与确认无关 |
| 点列表「回退」 | 列表无回退键，只有 trace 内「回退」+ 确认抽屉「确认回退并写回」 |

## 修复

- 固定 \`role=alert\` 桌面 toast（\`z-[100]\`），确认写回后立即显示成功/失败。
- 回退写回审计 \`action=回退\`，\`canRollbackAudit\` 排除回退，原 trace 标 \`rolled_back\`。
- 列表副标题用 \`changes\` + 列 enum 映射展示 \`字段：原→新\`。

## 截图

- [rollback-result-toast.png](../media/rollback-result-toast.png) — toast 文案：\`${report.toastText.replace(/`/g, "'") || '—'}\`
- [operation-list-with-diff.png](../media/operation-list-with-diff.png) — 列表含 →：${report.listHasArrowDiff ? 'yes' : 'no'}

## 自动化读图

\`\`\`json
${JSON.stringify(report, null, 2)}
\`\`\`
`

await writeFile(`${INTERNAL_DIR}/verify-rollback-result-and-list.md`, md, 'utf8')
console.log(JSON.stringify(report, null, 2))
await browser.close()
process.exit(report.ok ? 0 : 1)
