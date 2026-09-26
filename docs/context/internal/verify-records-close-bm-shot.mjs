import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, copyFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const sessionId = 'session-c5af1309-4543-413e-8aa9-3f370e2636ef'

await mkdir(`${STORE}/media`, { recursive: true })
await mkdir(`${STORE}/internal`, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } })

await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd, sessionId: sid }) => {
  const key = 'scene-39-workstation'
  const raw = localStorage.getItem(key)
  const state = raw ? JSON.parse(raw) : { state: {} }
  state.state = state.state || {}
  state.state.activeWorkspaceId = wsId
  state.state.activeDataSubview = 'records'
  state.state.activeAiSessionId = sid
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
  state.state.panels = (panels.length ? panels : fallbackPanels).map((p) => {
    if (p && p.id === 'data') return { ...p, state: 'full', width: 1100 }
    if (p && (p.state === 'full' || p.state === 'half')) return { ...p, state: 'tab' }
    return p
  })
  if (!state.state.panels.some((p) => p && p.id === 'data')) state.state.panels = fallbackPanels
  if (state.version == null) state.version = 17
  localStorage.setItem(key, JSON.stringify(state))
}, { workspaceId, workspaceCwd, sessionId })

await page.goto(`${mainBase}/ai/${sessionId}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForTimeout(2500)
const tab = page.getByRole('button', { name: '业务记录', exact: true })
if (await tab.count()) await tab.click({ timeout: 10000 }).catch(() => {})
await page.waitForTimeout(4000)

const historySelect = page.locator('select').filter({ has: page.locator('option', { hasText: '本会话浮现历史' }) }).first()
let historyPick = { ok: false, options: [] }
if (await historySelect.count()) {
  const options = await historySelect.locator('option').allTextContents()
  const hit = options.find((text) => /费用报销/.test(text) && /过审/.test(text))
  historyPick = { ok: Boolean(hit), options, label: hit || '' }
  if (hit) {
    await historySelect.selectOption({ label: hit }).catch(async () => {
      const values = await historySelect.locator('option').evaluateAll((els) => els.map((el) => ({
        value: el.value,
        text: el.textContent || '',
      })))
      const row = values.find((opt) => /费用报销/.test(opt.text) && /过审/.test(opt.text))
      if (row) await historySelect.selectOption(row.value)
    })
    await page.waitForTimeout(3000)
  }
}

const snap = await page.evaluate(async (ws) => {
  const res = await fetch(`/api/v1/biz/pending-sheet?cwd=${encodeURIComponent(ws)}`)
  const json = await res.json().catch(() => ({}))
  const sheet = json?.data?.sheet || json?.data || null
  const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
  const drawer = document.querySelector('div.fixed.inset-y-0.right-0')
  const drawerText = drawer?.textContent?.replace(/\s+/g, ' ').trim() || ''
  const confirm = [...(drawer?.querySelectorAll('button') || [])].some((b) => /确认过账/.test(b.textContent || ''))
  const table = document.querySelector('div.overflow-x-auto.overflow-y-auto table')
  const footer = [...document.querySelectorAll('span')]
    .map((s) => s.textContent?.trim() || '')
    .find((t) => t.startsWith('共 ') && t.includes('条')) || ''
  return {
    kind: sheet?.kind || null,
    action: sheet?.action || null,
    rows: rows.length,
    first: rows[0] && typeof rows[0] === 'object' ? String(rows[0].no || '') : '',
    statuses: [...new Set(rows.map((r) => String(r?.status || '')))],
    preview_id: sheet?.preview_id || json?.data?.preview_id || null,
    speech: sheet?.speech || '',
    drawerOpen: Boolean(drawer),
    drawerAction: (drawerText.match(/操作：\s*(\S+)/) || [])[1] || '',
    drawerHasConfirm: confirm,
    drawerHasApprove: drawerText.includes('过审'),
    drawerChange: drawerText.includes('待审') && drawerText.includes('过审'),
    footer,
    tbodyRows: table ? table.querySelectorAll('tbody tr').length : 0,
    firstNo: table?.querySelector('tbody tr td:nth-child(2)')?.textContent?.trim() || '',
    selectedChip: [...document.querySelectorAll('button.btn')].find((b) => b.className.includes('bg-ink'))?.textContent?.replace(/\s+/g, ' ').trim() || '',
    confirmClicked: false,
  }
}, workspaceCwd)
snap.historyPick = historyPick

const media = `${STORE}/media/records-close-bm-case-05.png`
const internal = `${STORE}/internal/bm-case-05.png`
const stitched = `${STORE}/media/records-close-bm.png`
await page.screenshot({ path: media, fullPage: false })
await copyFile(media, internal)
await copyFile(media, stitched)
await writeFile(`${STORE}/internal/verify-records-close-bm-shot.json`, JSON.stringify(snap, null, 2), 'utf8')
await browser.close()
console.log(JSON.stringify(snap))
const uiIsApprove = Boolean(
  snap.action === '过审'
  && snap.preview_id
  && /费用报销/.test(String(snap.selectedChip || snap.footer || ''))
  && snap.drawerOpen
  && snap.drawerAction === '过审'
  && snap.firstNo === snap.first
)
if (!uiIsApprove) process.exitCode = 1
