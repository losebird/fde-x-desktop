import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE = '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const MEDIA_DIR = `${STORE}/media`
const INTERNAL_DOC = `${STORE}/internal/verify-biz-surface-e2e.md`
const mainBase = 'http://127.0.0.1:5174'
const workspace = '/Users/zxz/Documents/ai-project/fdex测试'
const runtimeBase = 'http://127.0.0.1:4318'

const shotAi = `${MEDIA_DIR}/records-follows-ai-sheet.png`
const shotHistory = `${MEDIA_DIR}/records-history-switched.png`

let gitSha = 'unknown'
try {
  gitSha = execSync('git rev-parse HEAD', {
    cwd: '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation',
    encoding: 'utf8',
  }).trim()
} catch {
  // ignore
}

const surfacesRes = await fetch(
  `${runtimeBase}/api/v1/biz/surfaces?workspace=${encodeURIComponent(workspace)}&limit=6`,
)
const surfacesBody = await surfacesRes.json()
const surfaces = Array.isArray(surfacesBody?.items) ? surfacesBody.items : []
const kind = surfaces[0]?.kind || '回款单'
const surfaceA = surfaces[0]?.id || 'bsurf_proof_a'
const surfaceB = surfaces[1]?.id || 'bsurf_proof_b'

function sheetFor(whereLabel, rows) {
  return {
    kind,
    action: '现查',
    rows,
    columns: [
      { key: 'no', label: '单号' },
      { key: 'amount', label: '金额' },
    ],
    where: [{ field: 'proofTag', op: 'eq', value: whereLabel }],
    speech: `proof-${whereLabel}`,
  }
}

const sheetBroad = sheetFor('broad', [
  { no: 'HK-2026-001', amount: 1200 },
  { no: 'HK-2026-002', amount: 3400 },
  { no: 'HK-2026-003', amount: 900 },
])
const sheetNarrow = sheetFor('narrow', [])

function envelope(surfaceId, sheet) {
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  return {
    id: `proof_${surfaceId}_${Date.now()}`,
    ts: Date.now(),
    type: 'biz.sheet.pending',
    workspaceCwd: null,
    source: 'proof-sse',
    payload: {
      kind: sheet.kind,
      action: sheet.action,
      rows: rows.length,
      surfaceId,
      sheet,
    },
  }
}

await mkdir(MEDIA_DIR, { recursive: true })
await mkdir(`${STORE}/internal`, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})

const evidence = {
  gitSha,
  lanAssistKinds: 'skipped',
  proof1: { ok: false, apiRows: sheetBroad.rows.length, tableRows: -1, kind },
  proof2: { ok: false, beforeLabel: '', afterLabel: '', beforeRows: -1, afterRows: -1 },
  notes: [`surfaces=${surfaces.length}`, `surfaceA=${surfaceA}`, `surfaceB=${surfaceB}`],
}

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

await page.addInitScript(({ surfaceA, surfaceB, sheetBroad, sheetNarrow }) => {
  const NativeES = window.EventSource
  function mkEnvelope(surfaceId, sheet) {
    const rows = Array.isArray(sheet.rows) ? sheet.rows : []
    return {
      id: `proof_${surfaceId}_${Date.now()}`,
      ts: Date.now(),
      type: 'biz.sheet.pending',
      workspaceCwd: null,
      source: 'proof-sse',
      payload: {
        kind: sheet.kind,
        action: sheet.action,
        rows: rows.length,
        surfaceId,
        sheet,
      },
    }
  }
  window.EventSource = function EventSourcePatched(url, options) {
    const es = new NativeES(url, options)
    const fire = () => {
      const queue = [
        mkEnvelope(surfaceB, sheetNarrow),
        mkEnvelope(surfaceA, sheetBroad),
      ]
      queue.forEach((item, index) => {
        setTimeout(() => {
          const raw = JSON.stringify(item)
          es.dispatchEvent(new MessageEvent('biz.sheet.pending', { data: raw }))
          es.dispatchEvent(new MessageEvent('message', { data: raw }))
        }, index * 350)
      })
    }
    es.addEventListener('open', () => setTimeout(fire, 400), { once: true })
    return es
  }
  window.EventSource.prototype = NativeES.prototype
}, { surfaceA, surfaceB, sheetBroad, sheetNarrow })

try {
  await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.getByRole('button', { name: '业务记录' }).click({ timeout: 20000 })
  await page.waitForTimeout(4500)
  await page.waitForFunction(
    () => document.querySelectorAll('table tbody tr').length >= 3,
    undefined,
    { timeout: 8000 },
  ).catch(() => undefined)

  const tableRows = await page.locator('table tbody tr').count()
  evidence.proof1.tableRows = tableRows
  evidence.proof1.ok = tableRows === Math.min(sheetBroad.rows.length, 10)

  const pendingText = await page.locator('text=/AI 刚查了/').first().textContent().catch(() => '')
  if (pendingText && pendingText.includes(String(sheetBroad.rows.length))) {
    evidence.notes.push('pending-banner-rows-match')
  }

  await page.screenshot({ path: shotAi, fullPage: false })

  const select = page.locator('select').filter({ hasText: '本会话浮现历史' }).first()
  const optionCount = await select.locator('option').count()
  evidence.proof2.beforeRows = tableRows
  evidence.proof2.beforeLabel = await page.locator('text=/连接器 · 现查/').first().textContent().catch(() => '')

  if (optionCount >= 2) {
    const values = await select.locator('option').evaluateAll((nodes) => nodes.map((n) => n.value))
    const alt = values.find((v) => v && v !== surfaceA) || values[1]
    if (alt) {
      await select.selectOption(alt)
      await page.waitForTimeout(1200)
      evidence.proof2.afterRows = await page.locator('table tbody tr').count()
      evidence.proof2.afterLabel = await page.locator('text=/连接器 · 现查/').first().textContent().catch(() => '')
      const labelChanged = evidence.proof2.beforeLabel !== evidence.proof2.afterLabel
      const rowsChanged = evidence.proof2.beforeRows !== evidence.proof2.afterRows
      evidence.proof2.ok = labelChanged || rowsChanged
    }
  }

  await page.screenshot({ path: shotHistory, fullPage: false })
} catch (error) {
  evidence.notes.push(error instanceof Error ? error.message : String(error))
  await page.screenshot({ path: shotAi, fullPage: false }).catch(() => undefined)
  await page.screenshot({ path: shotHistory, fullPage: false }).catch(() => undefined)
}

await browser.close()

const md = `# 业务记录 · AI sheet 链路验证（${new Date().toISOString()})

## Git

- \`scene-39-personal-workstation\` @ \`${gitSha}\` + 工作区未提交补丁（\`emitBizSheetPending\` / \`RecordsPanel\` / kind-list cache）

## 根因（已修）

1. **空 pending 覆盖有行列表**：lan-assist 轮询偶发 \`rows:[]\` 的现查 pending，\`applyPendingSheet\` 仍 apply，把右侧表清空（§9）。
2. **浮现历史点选无效**：\`hydrateFromPending\` 把 pending 盖回历史；标签用同 kind 最新缓存冒充；SSE 丢 \`from/related/hopWhere\`。
3. **「同 kind 最新」回退**：\`peekBizKindListSheet\` / 无 anchor 的 \`peekBizKindListSheetForOperation\` 已去掉。

## 改动文件

- \`runtime/routes/biz.mjs\`
- \`src/components/biz/RecordsPanel.tsx\`
- \`src/lib/biz-kind-list-cache.ts\`
- \`src/lib/biz-session-sheet.ts\`

## 证明

| # | 断言 | 结果 | 说明 |
|---|------|------|------|
| 1 | SSE 现查 sheet 行数 = 右侧表行数 | ${evidence.proof1.ok ? 'yes' : 'no'} | apiRows=${evidence.proof1.apiRows} tableRows=${evidence.proof1.tableRows} kind=\`${kind}\` → [records-follows-ai-sheet.png](../media/records-follows-ai-sheet.png) |
| 2 | 切换历史后来源/行数变化 | ${evidence.proof2.ok ? 'yes' : 'no'} | before rows=${evidence.proof2.beforeRows} after rows=${evidence.proof2.afterRows} → [records-history-switched.png](../media/records-history-switched.png) |

**环境**：本 worker \`lan-assist\` 为 NOT_READY，证明 1–2 用 Playwright 补丁 \`EventSource\` 注入 \`biz.sheet.pending\`（与真 SSE 同 envelope），surface id 来自 SQLite \`biz_surfaces\`。Ace 机 lan-assist 就绪时请再跑 \`node scripts/capture-biz-records-e2e-proof.mjs\` 或真 AI 现查复验。

\`\`\`json
${JSON.stringify(evidence, null, 2)}
\`\`\`
`

await writeFile(INTERNAL_DOC, md, 'utf8')
console.log(JSON.stringify({ evidence, shotAi, shotHistory, INTERNAL_DOC }, null, 2))
