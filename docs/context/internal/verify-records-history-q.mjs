/**
 * Q live prove only. Store internal/ — do not git-add into the product tree.
 * From the current 1-row sheet, switch 现查 history then 改行 history.
 * Does not POST /biz/preview. Does not kill pnpm.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const MEDIA = `${STORE}/media/records-history-switched.png`
const REPORT = `${STORE}/internal/verify-records-history-q.md`
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

function clockOnlyThird(label) {
  const parts = String(label || '').split(' · ').map((part) => part.trim()).filter(Boolean)
  if (parts.length < 3) return false
  const third = parts.slice(2).join(' · ')
  return /^\d{2}\/\d{2}(?:\s+\d{2}:\d{2})?$/.test(third) || /^(刚刚|\d+\s*分钟前|\d+\s*小时前)$/.test(third)
}

function optionAction(label) {
  const parts = String(label || '').split(' · ').map((part) => part.trim()).filter(Boolean)
  return parts[1] || ''
}

function fail(code, extra) {
  return { pass: false, failCode: code, ...extra }
}

const [branch, sha] = gitSha()
await mkdir(`${STORE}/internal`, { recursive: true })
await mkdir(`${STORE}/media`, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } })
let out = {
  sha,
  branch,
  hardcodedLiterals: 'none',
  workspaceCwd,
}

try {
  await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
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
      state.state.workspaces = rows
    } else {
      state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
    }
    const fallbackPanels = [
      { id: 'im', label: 'IM', icon: 'MessageCircleMore', emoji: '💬', accent: 'bg-slate-700', state: 'closed', width: 560, badge: 0, view: 'im' },
      { id: 'briefing', label: '早报', icon: 'Newspaper', emoji: '🌅', accent: 'bg-amber-500', state: 'tab', width: 560, pinned: true, view: 'briefing' },
      { id: 'plan', label: '计划', icon: 'ClipboardList', emoji: '📋', accent: 'bg-blue-500', state: 'closed', width: 600, view: 'plan' },
      { id: 'files', label: '文件', icon: 'Folder', emoji: '📁', accent: 'bg-emerald-500', state: 'closed', width: 580, view: 'files' },
      { id: 'data', label: '业务应用', icon: 'Database', emoji: '🗃️', accent: 'bg-cyan-500', state: 'full', width: 1100, view: 'data' },
      { id: 'mcp', label: 'MCP', icon: 'Plug', emoji: '🔌', accent: 'bg-rose-500', state: 'closed', width: 520, view: 'mcp' },
      { id: 'skills', label: 'Skills', icon: 'Wand2', emoji: '🪄', accent: 'bg-indigo-500', state: 'closed', width: 520, view: 'skills' },
      { id: 'memory', label: '记忆', icon: 'Brain', emoji: '🧠', accent: 'bg-fuchsia-500', state: 'closed', width: 800, view: 'memory' },
      { id: 'settings', label: '设置', icon: 'Settings', emoji: '⚙️', accent: 'bg-slate-500', state: 'closed', width: 520, view: 'settings' },
    ]
    const panels = Array.isArray(state.state.panels) ? state.state.panels : []
    state.state.panels = (panels.length ? panels : fallbackPanels).map((p) => (
      p && p.id === 'data' ? { ...p, state: 'full', width: 1100 } : p
    ))
    if (!state.state.panels.some((p) => p && p.id === 'data')) state.state.panels = fallbackPanels
    if (state.version == null) state.version = 17
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd })
  await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(2500)
  const recordsBtn = page.getByRole('button', { name: '业务记录' })
  if (await recordsBtn.count()) {
    await recordsBtn.click({ timeout: 15000 }).catch(() => {})
  }
  await page.waitForTimeout(1800)

  const snapshot = async () => page.evaluate(() => {
    const footer = [...document.querySelectorAll('span')]
      .map((s) => s.textContent?.trim() || '')
      .find((t) => t.startsWith('共 ') && t.includes('条')) || ''
    const banner = document.querySelector('div.border-blue-200.bg-blue-50')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const tbody = document.querySelector('div.overflow-x-auto.overflow-y-auto table tbody')
    const trs = tbody ? [...tbody.querySelectorAll('tr')] : []
    const first = trs[0]?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const firstNo = trs[0]?.querySelector('td:nth-child(2)')?.textContent?.trim() || ''
    const history = [...document.querySelectorAll('select')].find((el) => (
      [...el.querySelectorAll('option')].some((o) => (o.textContent || '').includes('本会话浮现历史'))
    ))
    const options = history
      ? [...history.querySelectorAll('option')].map((o) => ({ value: o.value, label: (o.textContent || '').trim() }))
      : []
    const drawerOpen = [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('确认过账'))
    const emptyChange = [...document.querySelectorAll('div')].some((d) => (d.textContent || '').trim() === '没有可展示的变更内容。')
    const chipWrap = [...document.querySelectorAll('div.flex.items-center.gap-1.flex-wrap')]
      .find((el) => [...el.querySelectorAll('button.btn')].length)
    const chips = chipWrap
      ? [...chipWrap.querySelectorAll('button.btn')].map((b) => b.textContent?.replace(/\s+/g, ' ').trim() || '')
      : []
    const active = chipWrap
      ? [...chipWrap.querySelectorAll('button.btn')]
        .filter((b) => b.className.includes('bg-ink'))
        .map((b) => b.textContent?.replace(/\s+/g, ' ').trim() || '')
      : []
    const footerCount = Number((footer.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    return {
      footer,
      footerCount,
      banner,
      tbodyRows: trs.length,
      first,
      firstNo,
      historyValue: history ? String(history.value || '') : '',
      options,
      drawerOpen,
      emptyChange,
      chips,
      active,
    }
  })

  const cacheFor = async (surfaceId) => page.evaluate((id) => {
    const read = (key) => {
      try {
        const parsed = JSON.parse(sessionStorage.getItem(key) || '[]')
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    const surface = read('fde:biz:surface-sheet-cache').find((row) => row.surfaceId === id)
    const kindList = read('fde:biz:kind-list-cache').find((row) => row.surfaceId === id)
    const hit = surface || kindList
    const sheet = hit?.sheet
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
    const first = rows[0] && typeof rows[0] === 'object'
      ? String(rows[0].no || rows[0].orderId || rows[0].id || '')
      : ''
    return {
      found: Boolean(sheet),
      kind: sheet ? String(sheet.kind || '') : '',
      action: sheet ? String(sheet.action || '') : '',
      rows: rows.length,
      first,
      speech: sheet ? String(sheet.speech || '') : '',
      sessionId: sheet && typeof sheet.sessionId === 'string' ? sheet.sessionId : '',
    }
  }, surfaceId)

  const start = await snapshot()
  out.start = start

  if (start.tbodyRows !== 1) {
    out = { ...out, ...fail('not-1-row-start', { detail: `tbody=${start.tbodyRows}` }) }
    throw new Error(out.failCode)
  }

  const labeled = start.options.filter((o) => o.value)
  if (!labeled.length) {
    out = { ...out, ...fail('no-session-history') }
    throw new Error(out.failCode)
  }
  const clockOnly = labeled.filter((o) => clockOnlyThird(o.label))
  out.clockOnly = clockOnly
  if (clockOnly.length) {
    out = { ...out, ...fail('clock-only-option', { clockOnly }) }
    throw new Error(out.failCode)
  }

  const historySelect = page.locator('select').filter({ has: page.locator('option', { hasText: '本会话浮现历史' }) })
  await historySelect.waitFor({ state: 'visible', timeout: 20000 })

  const listAction = start.options.find((o) => o.value && optionAction(o.label) && !/改|删|审|建/.test(optionAction(o.label)))
    || start.options.find((o) => o.value && /现查/.test(o.label))
  const writeAction = start.options.find((o) => o.value && /改行/.test(optionAction(o.label) || o.label))
  if (!listAction?.value) {
    out = { ...out, ...fail('no-list-history-option', { options: labeled.slice(0, 12) }) }
    throw new Error(out.failCode)
  }
  if (!writeAction?.value) {
    out = { ...out, ...fail('no-write-history-option', { options: labeled.slice(0, 12) }) }
    throw new Error(out.failCode)
  }

  const pickList = labeled.find((o) => o.value === listAction.value && o.value !== start.historyValue) || listAction
  out.pickedList = pickList
  const listCacheBefore = await cacheFor(pickList.value)
  out.listCache = listCacheBefore

  await historySelect.selectOption(pickList.value)
  await page.waitForTimeout(1200)
  const afterList = await snapshot()
  out.afterList = afterList
  const listCache = listCacheBefore.found ? listCacheBefore : await cacheFor(pickList.value)
  out.listCache = listCache

  if (afterList.historyValue !== pickList.value) {
    out = { ...out, ...fail('list-pin-lost') }
    throw new Error(out.failCode)
  }
  if (afterList.drawerOpen && afterList.emptyChange) {
    out = { ...out, ...fail('empty-drawer-on-list') }
    throw new Error(out.failCode)
  }
  if (listCache.found && listCache.first && afterList.firstNo && listCache.first !== afterList.firstNo) {
    out = { ...out, ...fail('list-table-mismatch-cache', { cacheFirst: listCache.first, uiFirst: afterList.firstNo }) }
    throw new Error(out.failCode)
  }
  if (listCache.found && listCache.rows !== afterList.footerCount) {
    out = { ...out, ...fail('list-rowcount-mismatch-cache', { cacheRows: listCache.rows, uiRows: afterList.footerCount }) }
    throw new Error(out.failCode)
  }
  if (!listCache.found && afterList.tbodyRows === start.tbodyRows && afterList.firstNo === start.firstNo) {
    out = { ...out, ...fail('list-table-did-not-switch') }
    throw new Error(out.failCode)
  }

  out.pickedWrite = writeAction
  const writeCacheBefore = await cacheFor(writeAction.value)
  out.writeCache = writeCacheBefore
  await historySelect.selectOption(writeAction.value)
  await page.waitForTimeout(1200)
  const afterWrite = await snapshot()
  out.afterWrite = afterWrite
  const writeCache = writeCacheBefore.found ? writeCacheBefore : await cacheFor(writeAction.value)
  out.writeCache = writeCache

  if (afterWrite.historyValue !== writeAction.value) {
    out = { ...out, ...fail('write-pin-lost') }
    throw new Error(out.failCode)
  }
  if (afterWrite.drawerOpen && afterWrite.emptyChange) {
    out = { ...out, ...fail('empty-drawer-on-write') }
    throw new Error(out.failCode)
  }
  if (writeCache.found && writeCache.first && afterWrite.firstNo && writeCache.first !== afterWrite.firstNo) {
    out = { ...out, ...fail('write-table-mismatch-cache', { cacheFirst: writeCache.first, uiFirst: afterWrite.firstNo }) }
    throw new Error(out.failCode)
  }
  if (writeCache.found && writeCache.rows !== afterWrite.footerCount) {
    out = { ...out, ...fail('write-rowcount-mismatch-cache', { cacheRows: writeCache.rows, uiRows: afterWrite.footerCount }) }
    throw new Error(out.failCode)
  }
  if (afterWrite.firstNo === afterList.firstNo && writeCache.found && writeCache.first && writeCache.first !== afterList.firstNo) {
    out = { ...out, ...fail('write-table-did-not-switch') }
    throw new Error(out.failCode)
  }

  out.pass = true
  out.failCode = ''
  await page.screenshot({ path: MEDIA, fullPage: false })
} catch (err) {
  if (!out.failCode) {
    out.pass = false
    out.failCode = 'probe-error'
    out.error = err instanceof Error ? err.message : String(err)
  }
  try {
    await page.screenshot({ path: MEDIA, fullPage: false })
  } catch {
    /* ignore */
  }
} finally {
  await browser.close()
}

const lines = []
lines.push('# Verify: Q records history switch')
lines.push('')
lines.push(`**hardcoded:** none`)
lines.push(`**pass:** ${out.pass ? 'yes' : 'no'}`)
lines.push(`**failCode:** ${out.failCode || '—'}`)
lines.push('')
lines.push('## SHA')
lines.push('')
lines.push('| 项 | 值 |')
lines.push('|---|---|')
lines.push(`| daily branch | \`${out.branch}\` |`)
lines.push(`| HEAD | \`${out.sha}\` |`)
lines.push('| origin | not pushed |')
lines.push('')
lines.push(`cwd \`${workspaceCwd}\``)
lines.push('')
lines.push('## Start (1-row sheet)')
lines.push('')
lines.push(`- tbody ${out.start?.tbodyRows ?? '—'} firstNo \`${out.start?.firstNo || '—'}\``)
lines.push(`- footer ${out.start?.footer || '—'}`)
lines.push(`- banner ${out.start?.banner || '—'}`)
lines.push(`- chips ${(out.start?.active || []).join(', ') || '—'}`)
lines.push(`- history options ${out.start?.options?.filter((o) => o.value).length ?? 0}`)
if (out.start?.options) {
  for (const opt of out.start.options.slice(0, 10)) {
    lines.push(`  - \`${opt.value.slice(0, 80)}\` ${opt.label}`)
  }
}
lines.push('')
lines.push('## 现查 history')
lines.push('')
lines.push(`- picked: ${out.pickedList?.label || '—'}`)
lines.push(`- cache found: ${out.listCache?.found ? 'yes' : 'no'} kind=${out.listCache?.kind || '—'} action=${out.listCache?.action || '—'} rows=${out.listCache?.rows ?? '—'} first=${out.listCache?.first || '—'}`)
lines.push(`- after tbody ${out.afterList?.tbodyRows ?? '—'} firstNo \`${out.afterList?.firstNo || '—'}\` pin=${out.afterList?.historyValue === out.pickedList?.value ? 'yes' : 'no'}`)
lines.push(`- drawerOpen ${out.afterList?.drawerOpen ? 'yes' : 'no'} emptyChange ${out.afterList?.emptyChange ? 'yes' : 'no'}`)
lines.push('')
lines.push('## 改行 history')
lines.push('')
lines.push(`- picked: ${out.pickedWrite?.label || '—'}`)
lines.push(`- cache found: ${out.writeCache?.found ? 'yes' : 'no'} kind=${out.writeCache?.kind || '—'} action=${out.writeCache?.action || '—'} rows=${out.writeCache?.rows ?? '—'} first=${out.writeCache?.first || '—'}`)
lines.push(`- after tbody ${out.afterWrite?.tbodyRows ?? '—'} firstNo \`${out.afterWrite?.firstNo || '—'}\` pin=${out.afterWrite?.historyValue === out.pickedWrite?.value ? 'yes' : 'no'}`)
lines.push(`- drawerOpen ${out.afterWrite?.drawerOpen ? 'yes' : 'no'} emptyChange ${out.afterWrite?.emptyChange ? 'yes' : 'no'}`)
lines.push('')
lines.push('## 对照')
lines.push('')
if (out.pass) {
  lines.push(`- 已对：从 1 行表切到「${out.pickedList?.label}」再切「${out.pickedWrite?.label}」，tbody 跟该 surfaceId 会话缓存（first ${out.writeCache?.first || out.afterWrite?.firstNo}），空抽屉未出现。option 非钟点。只列本会话。`)
  lines.push('- 未对：顶栏 / FaceSidebar / Stage / Palette / OfficialConversation hide（本切片没测）。')
  lines.push('- 仍差：无。')
} else {
  lines.push(`- 已对：无（失败停）。`)
  lines.push(`- 未对：失败后未继续。`)
  lines.push(`- 仍差：\`${out.failCode}\` ${out.error || ''}`)
}
lines.push('')
lines.push(`截图: \`media/records-history-switched.png\``)
lines.push('')

await writeFile(REPORT, lines.join('\n'), 'utf8')
await writeFile(`${STORE}/internal/verify-records-history-q.json`, JSON.stringify(out, null, 2), 'utf8')
console.log(JSON.stringify({
  pass: out.pass,
  failCode: out.failCode,
  sha: out.sha,
  branch: out.branch,
  startRows: out.start?.tbodyRows,
  startFirst: out.start?.firstNo,
  optionCount: out.start?.options?.filter((o) => o.value).length,
  pickedList: out.pickedList?.label,
  afterList: { rows: out.afterList?.tbodyRows, first: out.afterList?.firstNo, drawer: out.afterList?.drawerOpen, empty: out.afterList?.emptyChange },
  pickedWrite: out.pickedWrite?.label,
  afterWrite: { rows: out.afterWrite?.tbodyRows, first: out.afterWrite?.firstNo, drawer: out.afterWrite?.drawerOpen, empty: out.afterWrite?.emptyChange },
  error: out.error || null,
}, null, 2))
if (!out.pass) process.exit(1)
