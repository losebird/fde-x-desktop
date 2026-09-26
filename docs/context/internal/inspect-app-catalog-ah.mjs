/**
 * Read-only live inspect for AH. Do not generate, open visit, delete, or write biz.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { writeFile } from 'node:fs/promises'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })

await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd }) => {
  const key = 'scene-39-workstation'
  const raw = localStorage.getItem(key)
  const state = raw ? JSON.parse(raw) : { state: {} }
  state.state = state.state || {}
  state.state.activeWorkspaceId = wsId
  state.state.activeDataSubview = 'overview'
  const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
  if (!rows.some((r) => r.id === wsId)) {
    rows.push({ id: wsId, name: 'fdex测试1', desc: cwd, cwd })
    state.state.workspaces = rows
  } else {
    state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
  }
  const fallbackPanels = [
    { id: 'im', label: 'IM', icon: 'MessageCircleMore', emoji: '💬', accent: 'bg-slate-700', state: 'closed', width: 560, badge: 0, view: 'im' },
    { id: 'briefing', label: '早报', icon: 'Newspaper', emoji: '🌅', accent: 'bg-amber-500', state: 'tab', width: 560, pinned: true, view: 'briefing' },
    { id: 'plan', label: '计划', icon: 'ClipboardList', emoji: '📋', accent: 'bg-blue-500', state: 'closed', width: 600, view: 'plan' },
    { id: 'files', label: '文件', icon: 'Folder', emoji: '📁', accent: 'bg-emerald-500', state: 'closed', width: 580, view: 'files' },
    { id: 'mcp', label: 'MCP', icon: 'Plug', emoji: '🔌', accent: 'bg-rose-500', state: 'closed', width: 520, view: 'mcp' },
    { id: 'skills', label: 'Skills', icon: 'Wand2', emoji: '🪄', accent: 'bg-indigo-500', state: 'closed', width: 520, view: 'skills' },
    { id: 'memory', label: '记忆', icon: 'Brain', emoji: '🧠', accent: 'bg-fuchsia-500', state: 'closed', width: 800, view: 'memory' },
    { id: 'settings', label: '设置', icon: 'Settings', emoji: '⚙️', accent: 'bg-slate-500', state: 'closed', width: 520, view: 'settings' },
    { id: 'data', label: '业务应用', icon: 'Database', emoji: '🗃️', accent: 'bg-cyan-500', state: 'full', width: 1100, view: 'data' },
  ]
  const panels = Array.isArray(state.state.panels) ? state.state.panels : []
  state.state.panels = (panels.length ? panels : fallbackPanels).map((p) => (
    p && p.id === 'data' ? { ...p, state: 'full', width: 1100 } : p
  ))
  if (!state.state.panels.some((p) => p && p.id === 'data')) state.state.panels = fallbackPanels
  if (state.version == null) state.version = 17
  localStorage.setItem(key, JSON.stringify(state))
}, { workspaceId, workspaceCwd })
await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForTimeout(1500)
const overviewBtn = page.getByRole('button', { name: '应用', exact: true })
if (await overviewBtn.count()) await overviewBtn.click({ timeout: 10000 }).catch(() => {})
await page.getByText('我的业务应用').waitFor({ state: 'visible', timeout: 12000 })

const snapshot = await page.evaluate(() => {
  const catalog = document.querySelector('[data-app-catalog="true"]')
  const rows = [...document.querySelectorAll('[data-app-row]')].map((el) => ({
    id: el.getAttribute('data-app-row'),
    text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
  }))
  const wizard = document.querySelector('[data-app-create-wizard]')
  return {
    catalogText: catalog ? catalog.innerText.slice(0, 2500) : '',
    wizardStep: wizard?.getAttribute('data-app-create-wizard') || null,
    createEntry: Boolean(document.querySelector('[data-app-create-entry="true"]')),
    tabs: [...document.querySelectorAll('button')].filter((b) => ['应用', '业务记录', '操作记录'].includes(b.textContent?.trim() || '')).map((b) => b.textContent?.trim()),
    rows,
    sampleLabel: /示例/.test(catalog?.innerText || ''),
    draftGroup: /草稿/.test(catalog?.innerText || ''),
  }
})

await writeFile(`${STORE}/internal/inspect-app-catalog-ah.json`, JSON.stringify(snapshot, null, 2))
console.log(JSON.stringify(snapshot, null, 2))
await browser.close()
