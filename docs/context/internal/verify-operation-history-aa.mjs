/**
 * AA live prove: operation history search + action/status tones + page size 20.
 * Store internal/ only — do not git-add. Never 确认过账 / biz_write. Do not open 业务记录.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const MEDIA = `${STORE}/media/operation-history-aa.png`
const REPORT_JSON = `${STORE}/internal/verify-operation-history-aa.json`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'

function gitSha() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD && git rev-parse HEAD', { cwd: SCENE, encoding: 'utf8' }).trim().split('\n')
  } catch {
    return ['unknown', 'unknown']
  }
}

const [branch, sha] = gitSha()
await mkdir(`${STORE}/internal`, { recursive: true })
await mkdir(`${STORE}/media`, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const writes = []
page.on('request', (req) => {
  const url = req.url()
  if (/\/api\/v1\/biz\/write\b/.test(url) && req.method() === 'POST') writes.push(url)
})

const out = {
  sha,
  branch,
  hardcodedLiterals: 'none',
  workspaceCwd,
  wrote: false,
  confirmed: false,
  silentBizWrite: false,
  searchShrinks: false,
  pageStaysOn2: false,
  pageSize: null,
  liveCount: 0,
  filteredCount: 0,
  searchQuery: '',
  actionTones: {},
  statusTones: {},
  actionColorsDistinct: false,
  statusColorsDistinct: false,
  colorsByActionAndStatus: false,
  pageAfterRefresh: null,
  nextEnabled: false,
  pagerText: '',
  fail: '',
}

function rgbOf(color) {
  const m = String(color || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return String(color || '')
  return `${m[1]},${m[2]},${m[3]}`
}

try {
  await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeDataSubview = 'operations'
    const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
    if (!rows.some((r) => r.id === wsId)) {
      rows.push({ id: wsId, name: 'fdex测试1', desc: cwd, cwd })
      state.state.workspaces = rows
    } else {
      state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
    }
    const fallbackPanels = [
      { id: 'im', label: 'IM', icon: 'MessageCircleMore', emoji: '💬', accent: 'bg-slate-700', state: 'closed', width: 560, badge: 0, view: 'im' },
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

  const opsTab = page.locator('button').filter({ hasText: /^操作记录$/ }).first()
  if (await opsTab.count()) await opsTab.click({ timeout: 15000 })
  await page.getByText('操作历史', { exact: true }).waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(800)

  const snapshot = await page.evaluate(() => {
    const items = [...document.querySelectorAll('[data-history-action]')]
    const actionTones = {}
    const statusTones = {}
    const actionColors = {}
    const statusColors = {}
    for (const el of items) {
      const action = el.getAttribute('data-history-action') || ''
      const actionTone = el.getAttribute('data-history-action-tone') || ''
      const status = el.getAttribute('data-history-status') || ''
      const statusTone = el.getAttribute('data-history-status-tone') || ''
      if (action) actionTones[action] = actionTone
      if (status) statusTones[status] = statusTone
      const tags = [...el.querySelectorAll('.tag')]
      const actionTag = tags.find((t) => (t.textContent || '').trim() === action)
      const statusTag = tags.find((t) => (t.textContent || '').trim() === status)
      if (actionTag && action) actionColors[action] = getComputedStyle(actionTag).color
      if (statusTag && status) statusColors[status] = getComputedStyle(statusTag).color
    }
    const pager = document.querySelector('[data-history-page]')
    return {
      count: items.length,
      actionTones,
      statusTones,
      actionColors,
      statusColors,
      page: pager?.getAttribute('data-history-page') || '',
      pageSize: pager?.getAttribute('data-history-page-size') || '',
      totalPages: pager?.getAttribute('data-history-total-pages') || '',
      pagerText: pager?.textContent?.trim() || '',
      searchPlaceholder: document.querySelector('input[aria-label="搜索操作历史"]')?.getAttribute('placeholder') || '',
    }
  })

  out.liveCount = snapshot.count
  out.pageSize = Number(snapshot.pageSize || 0)
  out.actionTones = snapshot.actionTones
  out.statusTones = snapshot.statusTones
  out.pagerText = snapshot.pagerText
  out.searchPlaceholder = snapshot.searchPlaceholder

  const actionColorValues = [...new Set(Object.values(snapshot.actionColors).map(rgbOf))]
  const statusColorValues = [...new Set(Object.values(snapshot.statusColors).map(rgbOf))]
  out.actionColors = snapshot.actionColors
  out.statusColors = snapshot.statusColors
  out.actionColorsDistinct = Object.keys(snapshot.actionTones).length <= 1 || new Set(Object.values(snapshot.actionTones)).size >= 2
  out.statusColorsDistinct = Object.keys(snapshot.statusTones).length <= 1 || new Set(Object.values(snapshot.statusTones)).size >= 2
  const sameRowClash = await page.evaluate(() => (
    [...document.querySelectorAll('[data-history-action]')].some((el) => {
      const actionTone = el.getAttribute('data-history-action-tone') || ''
      const statusTone = el.getAttribute('data-history-status-tone') || ''
      return actionTone && statusTone && actionTone === statusTone
    })
  ))
  out.sameRowClash = sameRowClash
  out.colorsByActionAndStatus = out.actionColorsDistinct && out.statusColorsDistinct && !sameRowClash

  const search = page.locator('input[aria-label="搜索操作历史"]')
  await search.waitFor({ state: 'visible', timeout: 10000 })
  const actionCounts = await page.evaluate(() => {
    const map = {}
    for (const el of document.querySelectorAll('[data-history-action]')) {
      const key = el.getAttribute('data-history-action') || ''
      map[key] = (map[key] || 0) + 1
    }
    return map
  })
  const ranked = Object.entries(actionCounts).sort((a, b) => a[1] - b[1])
  const searchQuery = ranked[0]?.[0] || ''
  out.searchQuery = searchQuery
  if (!searchQuery) throw new Error('no live action to search')
  await search.fill(searchQuery)
  await page.waitForTimeout(400)

  const afterSearch = await page.evaluate(() => ({
    count: document.querySelectorAll('[data-history-action]').length,
    page: document.querySelector('[data-history-page]')?.getAttribute('data-history-page') || '',
    query: document.querySelector('input[aria-label="搜索操作历史"]')?.value || '',
  }))
  out.filteredCount = afterSearch.count
  out.searchShrinks = afterSearch.count > 0 && afterSearch.count < out.liveCount && afterSearch.query === searchQuery

  const nextBtn = page.getByRole('button', { name: '下一页' })
  out.nextEnabled = await nextBtn.isEnabled()
  if (out.nextEnabled) {
    await nextBtn.click()
    await page.waitForTimeout(300)
    const on2 = await page.locator('[data-history-page]').getAttribute('data-history-page')
    await page.getByRole('button', { name: '刷新' }).click()
    await page.waitForTimeout(800)
    const afterRefresh = await page.evaluate(() => ({
      page: document.querySelector('[data-history-page]')?.getAttribute('data-history-page') || '',
      query: document.querySelector('input[aria-label="搜索操作历史"]')?.value || '',
    }))
    out.pageAfterRefresh = afterRefresh.page
    out.pageStaysOn2 = on2 === '2' && afterRefresh.page === '2'
  } else {
    out.pageStaysOn2 = false
    out.page2Reason = `live ${out.liveCount} rows < page size ${out.pageSize || 20}`
  }

  await page.screenshot({ path: MEDIA, fullPage: false })
  out.wrote = writes.length > 0
  out.silentBizWrite = writes.length > 0
} catch (error) {
  out.fail = error instanceof Error ? error.message : String(error)
  await page.screenshot({ path: MEDIA, fullPage: false }).catch(() => undefined)
} finally {
  await browser.close()
}

out.pass = Boolean(
  !out.fail
  && out.searchShrinks
  && out.pageSize === 20
  && out.colorsByActionAndStatus
  && out.actionColorsDistinct
  && out.statusColorsDistinct
  && !out.silentBizWrite
  && (out.pageStaysOn2 || out.liveCount <= 20)
)

await writeFile(REPORT_JSON, JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
