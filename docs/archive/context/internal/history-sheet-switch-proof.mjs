import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const MEDIA = `${STORE}/media/records-history-switched.png`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'

let sha = 'unknown'
try {
  sha = execSync('git rev-parse HEAD', { cwd: SCENE, encoding: 'utf8' }).trim()
} catch {
  /* ignore */
}

await mkdir(`${STORE}/media`, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } })

let report = { before: null, after: null, picked: '', options: [] }

try {
  await page.goto(`${mainBase}/data`, { waitUntil: 'networkidle', timeout: 90000 })
  await page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeDataSubview = 'records'
    const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
    if (!rows.some((r) => r.id === wsId)) {
      rows.push({ id: wsId, name: 'fdex测试1', desc: cwd, cwd })
    } else {
      state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
    }
    state.state.workspaces = state.state.workspaces || rows
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd })
  await page.reload({ waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(2500)

  const historySelect = page.locator('select').filter({ has: page.locator('option', { hasText: '本会话浮现历史' }) })
  await historySelect.waitFor({ state: 'visible', timeout: 60000 })

  const options = await historySelect.locator('option').evaluateAll((els) =>
    els.slice(1).map((o) => ({ value: o.value, text: o.textContent?.trim() || '' })),
  )
  report.options = options

  const before = await page.evaluate(() => {
    const source = [...document.querySelectorAll('span')].find((s) => s.textContent?.startsWith('来源：'))?.textContent?.trim() || ''
    const headers = [...document.querySelectorAll('thead th')].map((th) => th.textContent?.trim()).filter(Boolean)
    const firstRow = document.querySelector('tbody tr td:nth-child(2)')?.textContent?.trim() || ''
    const chipActive = [...document.querySelectorAll('button.btn')].filter((b) => b.className.includes('bg-ink')).map((b) => b.textContent?.trim())
    return { source, headers, firstRow, chipActive }
  })
  report.before = before

  const beforeSource = before.source
  const pick = options.find((o) => /审批单/.test(o.text))
    || options.find((o) => /客户 ·/.test(o.text))
    || options.find((o) => o.text && !beforeSource.includes(o.text.split(' · ').slice(0, 2).join(' · ')))
    || options.find((o) => /现查/.test(o.text) && /14:15/.test(o.text))
    || options[Math.min(8, options.length - 1)]
  if (!pick?.value) throw new Error('no history option to select')

  report.picked = pick.text
  await historySelect.selectOption(pick.value)
  await page.waitForTimeout(1200)

  const after = await page.evaluate(() => {
    const source = [...document.querySelectorAll('span')].find((s) => s.textContent?.startsWith('来源：'))?.textContent?.trim() || ''
    const headers = [...document.querySelectorAll('thead th')].map((th) => th.textContent?.trim()).filter(Boolean)
    const firstRow = document.querySelector('tbody tr td:nth-child(2)')?.textContent?.trim() || ''
    const chipActive = [...document.querySelectorAll('button.btn')].filter((b) => b.className.includes('bg-ink')).map((b) => b.textContent?.trim())
    return { source, headers, firstRow, chipActive }
  })
  report.after = after

  await page.screenshot({ path: MEDIA, fullPage: false })
} finally {
  await browser.close()
}

const switched = report.before && report.after && (
  report.before.source !== report.after.source
  || report.before.headers.join('|') !== report.after.headers.join('|')
  || report.before.firstRow !== report.after.firstRow
)

const verify = `# 本会话浮现历史 → 表格切换

- scene-39 \`main\` @ \`${sha.slice(0, 8)}\`
- 探针：\`${mainBase}/data\` · cwd \`${workspaceCwd}\`
- 4318：已重启以加载 \`sheet_json\` 与 \`GET /api/v1/biz/surfaces/:id/sheet\`

## 操作

1. 打开业务记录，读取当前「来源」、表头、首行。
2. 在下拉「本会话浮现历史」选与当前不同的项：\`${report.picked}\`（共 ${report.options.length} 条可选）。

## 结果

| 项 | 切换前 | 切换后 |
| --- | --- | --- |
| 来源 | ${report.before?.source || '—'} | ${report.after?.source || '—'} |
| 表头 | ${(report.before?.headers || []).slice(0, 4).join(' / ')} | ${(report.after?.headers || []).slice(0, 4).join(' / ')} |
| 首行第2列 | ${report.before?.firstRow || '—'} | ${report.after?.firstRow || '—'} |
| 高亮 chip | ${(report.before?.chipActive || []).join(', ') || '—'} | ${(report.after?.chipActive || []).join(', ') || '—'} |

**表格随历史切换：** ${switched ? '是' : '否（需本 session 内有多条带 sheet 的快照；旧 surface 无 sheet_json 时仅内存/sessionStorage 命中）'}

截图：\`media/records-history-switched.png\`
`

await writeFile(`${STORE}/internal/verify-history-sheet-switch.md`, verify, 'utf8')
console.log(JSON.stringify({ switched, report, media: MEDIA }, null, 2))
