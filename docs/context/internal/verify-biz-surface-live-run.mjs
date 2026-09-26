import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const MEDIA_DIR = `${STORE}/media`
const INTERNAL_DOC = `${STORE}/internal/verify-biz-surface-live.md`
const REPO = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'

const shotAi = `${MEDIA_DIR}/records-follows-ai-sheet.png`
const shotHistory = `${MEDIA_DIR}/records-history-switched.png`

let gitSha = 'unknown'
try {
  gitSha = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim()
} catch {
  // ignore
}

async function apiPreview(page, kind, speech) {
  return page.evaluate(async ({ ws, kind, speech }) => {
    const res = await fetch('/api/v1/biz/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind,
        action: '现查',
        workspace: ws,
        cwd: ws,
        speech,
        system: 'lan-assist',
        connectionId: 'conn_lan_assist',
      }),
    })
    const json = await res.json()
    const sheet = json?.data?.sheet || json?.data
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
    const nos = rows.map((r) => String(r.no || r.id || '')).filter(Boolean)
    return {
      ok: res.ok && !json?.error,
      err: json?.error,
      kind: sheet?.kind,
      rowCount: rows.length,
      nos: nos.slice(0, 12),
      surfaceId: json?.data?.surfaceId,
    }
  }, { ws: workspaceCwd, kind, speech })
}

async function apiPending(page) {
  return page.evaluate(async () => {
    const res = await fetch('/api/v1/biz/pending-sheet')
    const json = await res.json()
    const sheet = json?.data?.sheet
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
    const nos = rows.map((r) => String(r.no || r.id || '')).filter(Boolean)
    return {
      kind: sheet?.kind,
      rowCount: rows.length,
      nos,
    }
  })
}

async function apiSurfaces(page) {
  return page.evaluate(async (ws) => {
    const res = await fetch(`/api/v1/biz/surfaces?workspace=${encodeURIComponent(ws)}&limit=12`)
    const json = await res.json()
    const items = Array.isArray(json?.items) ? json.items : []
    return items.map((s) => ({
      id: s.id,
      kind: s.kind,
      action: s.action,
      rowCount: s.rowCount ?? 0,
      createdAt: s.createdAt,
    }))
  }, workspaceCwd)
}

function tableNosFromPage(page) {
  return page.evaluate(() => {
    const headers = [...document.querySelectorAll('table thead th')].map((th) => (th.textContent || '').trim())
    const noIdx = headers.findIndex((h) => h === '单号' || h.includes('单号'))
    const nos = []
    for (const row of document.querySelectorAll('table tbody tr')) {
      const cells = [...row.querySelectorAll('td')]
      const cell = noIdx >= 0 ? cells[noIdx] : cells[1]
      const t = (cell?.textContent || '').trim()
      if (t) nos.push(t)
      if (nos.length >= 12) break
    }
    return nos
  })
}

async function scrollDshNoIntoView(page, no) {
  const frame = page.frames().find((f) => f.url().includes('dsh-app'))
  if (!frame || !no) return false
  const loc = frame.getByText(String(no), { exact: false }).last()
  await loc.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => undefined)
  await page.waitForTimeout(300)
  return loc.isVisible().catch(() => false)
}

async function dshIncludesNo(page, no) {
  const frame = page.frames().find((f) => f.url().includes('dsh-app'))
  if (!frame || !no) return false
  const loc = frame.getByText(String(no), { exact: false }).last()
  return loc.isVisible().catch(() => false)
}

await mkdir(MEDIA_DIR, { recursive: true })
await mkdir(`${STORE}/internal`, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()

const evidence = {
  gitSha,
  lanAssist: { ok: false, note: '' },
  proof1: { ok: false, pendingRows: 0, tableNos: [], pendingNos: [], bannerRows: null, kind: '', aiHasLeadNo: false, totalLabel: null },
  proof2: { ok: false, before: {}, after: {}, staleHint: false, historyOption: '' },
  notes: [],
}

try {
  await page.goto(mainBase, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
    if (!rows.some((r) => r.id === wsId)) {
      rows.push({ id: wsId, name: 'fdex测试', desc: cwd, cwd })
    } else {
      state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试', desc: cwd, cwd } : r))
    }
    state.state.workspaces = state.state.workspaces || rows
    state.state.activeDataSubview = 'records'
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd })

  const la = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/v1/biz/pending-sheet')
      return { httpOk: res.ok, status: res.status }
    } catch (e) {
      return { httpOk: false, error: String(e) }
    }
  })
  evidence.lanAssist.ok = la.httpOk
  evidence.lanAssist.note = JSON.stringify(la)

  await page.evaluate(async () => {
    await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  })
  await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: '业务记录' }).click({ timeout: 20000 })
  await page.waitForTimeout(600)

  const payPreview = await apiPreview(page, '销售回款', 'live-verify-payment-list')
  evidence.notes.push(`preview:${JSON.stringify({ ok: payPreview.ok, rows: payPreview.rowCount, kind: payPreview.kind })}`)
  if (!payPreview.ok || payPreview.rowCount < 1) {
    throw new Error(`现查失败: ${JSON.stringify(payPreview.err)}`)
  }

  await page.waitForFunction(
    () => (document.body.innerText || '').includes('AI 刚查了'),
    undefined,
    { timeout: 20000 },
  )
  await page.waitForTimeout(800)
  let pending = await apiPending(page)
  const leadNoEarly = pending.nos[0] || ''
  await scrollDshNoIntoView(page, leadNoEarly)
  pending = await apiPending(page)
  const tableNos = await tableNosFromPage(page)
  const banner = await page.locator('text=/AI 刚查了/').first().textContent().catch(() => '')
  const bannerMatch = banner && banner.match(/(\d+)\s*行/)
  const bannerRows = bannerMatch ? Number(bannerMatch[1]) : null
  const totalLabel = await page.locator('text=/共 \\d+ 条/').first().textContent().catch(() => '')
  const totalMatch = totalLabel && totalLabel.match(/共\s+(\d+)\s+条/)
  const totalRows = totalMatch ? Number(totalMatch[1]) : null
  const leadNo = pending.nos[0] || ''
  const aiHasLeadNo = await dshIncludesNo(page, leadNo)
  const pageSize = 10
  const firstPageNos = [...new Set(tableNos.slice(0, pageSize))]
  const tableSubsetOk = firstPageNos.length > 0 && firstPageNos.every((no) => pending.nos.includes(no))

  evidence.proof1 = {
    ok:
      pending.rowCount > 0
      && tableSubsetOk
      && tableNos[0] === leadNo
      && bannerRows === pending.rowCount
      && totalRows === pending.rowCount,
    pendingRows: pending.rowCount,
    tableNos,
    pendingNos: pending.nos.slice(0, pageSize),
    bannerRows,
    kind: pending.kind || payPreview.kind,
    bannerText: banner,
    aiHasLeadNo,
    totalLabel,
    leadNo,
  }

  await page.screenshot({ path: shotAi, fullPage: false })

  const contractPreview = await apiPreview(page, '合同', 'live-verify-contract-list')
  evidence.notes.push(`preview合同:${JSON.stringify({ ok: contractPreview.ok, rows: contractPreview.rowCount })}`)
  await page.waitForTimeout(1500)

  const surfaces = await apiSurfaces(page)
  const paySurface = surfaces.find((s) => (s.kind === '销售回款' || s.kind === '回款单') && s.rowCount > 0)
  const contractSurface = surfaces.find((s) => s.kind === '合同' && s.rowCount > 0)
  if (!paySurface || !contractSurface) {
    throw new Error(`surfaces missing: ${JSON.stringify(surfaces.slice(0, 4))}`)
  }

  const beforeRows = await page.locator('table tbody tr').count()
  const beforeKind = await page.locator('.btn.!bg-ink').first().textContent().catch(() => '')

  const select = page.locator('select').filter({ hasText: '本会话浮现历史' }).first()
  await select.selectOption(paySurface.id)
  await page.waitForTimeout(1500)
  await scrollDshNoIntoView(page, payPreview.nos[0] || '')

  const afterRows = await page.locator('table tbody tr').count()
  const afterNos = await tableNosFromPage(page)
  const staleVisible = await page.locator('text=/不在待确认区/').isVisible().catch(() => false)
  const payPendingSubset = payPreview.nos.slice(0, Math.min(10, payPreview.nos.length))
  const historyShowsPay = afterNos.length > 0 && payPendingSubset.some((no) => afterNos.includes(no))

  evidence.proof2 = {
    ok: afterRows > 0 && !staleVisible && historyShowsPay && paySurface.id !== contractSurface.id,
    before: { rows: beforeRows, kind: (beforeKind || '').trim(), surfaceId: contractSurface.id },
    after: { rows: afterRows, nos: afterNos, surfaceId: paySurface.id },
    staleHint: staleVisible,
    historyOption: paySurface.id,
    paySample: payPendingSubset,
  }

  await page.screenshot({ path: shotHistory, fullPage: false })
} catch (error) {
  evidence.notes.push(error instanceof Error ? error.message : String(error))
  await page.screenshot({ path: shotAi, fullPage: false }).catch(() => undefined)
  await page.screenshot({ path: shotHistory, fullPage: false }).catch(() => undefined)
}

await browser.close()

const md = `# 业务记录 · 真现查 live 验证（${new Date().toISOString()})

## Git

- \`scene-39-personal-workstation\` @ \`${gitSha}\`

## 环境

- Vite \`${mainBase}\`，runtime 经 proxy；\`lan-assist\` \`GET /api/v1/biz/pending-sheet\` → ${evidence.lanAssist.ok ? '可达' : '失败'}（${evidence.lanAssist.note}）
- 工作区 cwd：\`${workspaceCwd}\`
- 现查路径：页面内 \`POST /api/v1/biz/preview\` → BFF \`lanAssist('/preview')\` → SSE \`biz.sheet.pending\`（无 EventSource 补丁）

## 仍差

- **未对（锁外）**：左侧 DSH 气泡若本轮未走会话内 \`biz_preview\`，截图里仍可能露出更早现查列表（如 \`PAY-2026-*\`）；与右侧/lan-assist \`pending-sheet\` 不同屏。复验时在**同一会话**里发出现查后再截图，或以 \`pending-sheet\` ↔ 业务记录表为权威对齐。

## 证明

| # | 断言 | 结果 | 说明 |
|---|------|------|------|
| 1 | lan-assist \`pending-sheet\` 行数 = 右侧「共 N 条」= 横幅 N；表首列 = pending 首单号 | ${evidence.proof1.ok ? 'yes' : 'no'} | kind=\`${evidence.proof1.kind}\` pending=${evidence.proof1.pendingRows} lead=\`${evidence.proof1.leadNo}\`（DSH 气泡同屏可见：${evidence.proof1.aiHasLeadNo ? 'yes' : '未测/旧气泡'}）→ [records-follows-ai-sheet.png](../media/records-follows-ai-sheet.png) |
| 2 | 浮现历史切到较早 surface：有行、无「不在待确认区」、行键含该次现查样本 | ${evidence.proof2.ok ? 'yes' : 'no'} | ${evidence.proof2.before.rows}→${evidence.proof2.after.rows} rows surface \`${String(evidence.proof2.historyOption).slice(-12)}\` → [records-history-switched.png](../media/records-history-switched.png) |

\`\`\`json
${JSON.stringify(evidence, null, 2)}
\`\`\`
`

await writeFile(INTERNAL_DOC, md, 'utf8')
console.log(JSON.stringify({ evidence, shotAi, shotHistory, INTERNAL_DOC }, null, 2))
process.exit(evidence.proof1.ok && evidence.proof2.ok ? 0 : 1)
