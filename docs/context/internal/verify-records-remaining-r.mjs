/**
 * R live prove only. Store internal/ — do not git-add into the product tree.
 * History option third segment = cached row no/pk when speech/where/hop are absent.
 * Does not POST /biz/preview. Does not kill pnpm.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const MEDIA = `${STORE}/media/records-history-switched.png`
const REPORT_JSON = `${STORE}/internal/verify-records-remaining-r.json`
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

function labelParts(label) {
  return String(label || '').split(' · ').map((part) => part.trim()).filter(Boolean)
}

function queryHasWhereOrHop(value) {
  const raw = String(value || '')
  const json = raw.startsWith('q:') ? raw.slice(2) : raw
  try {
    const parsed = JSON.parse(json)
    const where = Array.isArray(parsed.where) ? parsed.where : []
    const hopWhere = Array.isArray(parsed.hopWhere) ? parsed.hopWhere : []
    const from = parsed.from && typeof parsed.from === 'object' ? parsed.from : null
    const steps = Array.isArray(parsed.steps) ? parsed.steps.filter(Boolean) : []
    return where.length > 0 || hopWhere.length > 0 || Boolean(from && from.kind) || steps.length > 1
  } catch {
    return false
  }
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
    const tbody = document.querySelector('div.overflow-x-auto.overflow-y-auto table tbody')
    const trs = tbody ? [...tbody.querySelectorAll('tr')] : []
    const firstNo = trs[0]?.querySelector('td:nth-child(2)')?.textContent?.trim() || ''
    const history = [...document.querySelectorAll('select')].find((el) => (
      [...el.querySelectorAll('option')].some((o) => (o.textContent || '').includes('本会话浮现历史'))
    ))
    const options = history
      ? [...history.querySelectorAll('option')].map((o) => ({ value: o.value, label: (o.textContent || '').trim() }))
      : []
    return {
      footer,
      footerCount: Number((footer.match(/共\s+(\d+)\s+条/) || [])[1] || NaN),
      tbodyRows: trs.length,
      firstNo,
      historyValue: history ? String(history.value || '') : '',
      options,
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
    const firstRow = rows[0] && typeof rows[0] === 'object' ? rows[0] : null
    const first = firstRow
      ? String(firstRow.no || firstRow.orderId || firstRow.id || '')
      : String(sheet?.no || '')
    return {
      found: Boolean(sheet),
      kind: sheet ? String(sheet.kind || '') : '',
      action: sheet ? String(sheet.action || '') : '',
      rows: rows.length,
      first,
      speech: sheet ? String(sheet.speech || '') : '',
    }
  }, surfaceId)

  const start = await snapshot()
  out.start = start
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

  const checked = []
  const missingIdentity = []
  for (const opt of labeled) {
    const cache = await cacheFor(opt.value)
    const parts = labelParts(opt.label)
    const third = parts.slice(2).join(' · ')
    const speech = String(cache.speech || '').trim()
    const scoped = queryHasWhereOrHop(opt.value) || Boolean(speech)
    const row = {
      label: opt.label,
      third,
      speech,
      scoped,
      cacheFirst: cache.first,
      cacheFound: cache.found,
    }
    checked.push(row)
    if (scoped) continue
    if (!cache.found || !cache.first) continue
    if (!third) missingIdentity.push(row)
    else if (third !== cache.first && !third.includes(cache.first)) missingIdentity.push(row)
  }
  out.checked = checked
  if (missingIdentity.length) {
    out = { ...out, ...fail('blank-or-mismatch-identity', { missingIdentity }) }
    throw new Error(out.failCode)
  }

  const identityTarget = labeled.find((o) => {
    const parts = labelParts(o.label)
    return parts.length >= 3 && !queryHasWhereOrHop(o.value)
  }) || labeled.find((o) => !queryHasWhereOrHop(o.value))
  if (!identityTarget?.value) {
    out = { ...out, ...fail('no-identity-option') }
    throw new Error(out.failCode)
  }

  const historySelect = page.locator('select').filter({ has: page.locator('option', { hasText: '本会话浮现历史' }) })
  await historySelect.waitFor({ state: 'visible', timeout: 20000 })
  const identityCache = await cacheFor(identityTarget.value)
  out.picked = { ...identityTarget, cache: identityCache }
  await historySelect.selectOption(identityTarget.value)
  await page.waitForTimeout(1200)
  const after = await snapshot()
  out.after = after
  if (after.historyValue !== identityTarget.value) {
    out = { ...out, ...fail('pin-lost') }
    throw new Error(out.failCode)
  }
  if (identityCache.found && identityCache.first && after.firstNo && identityCache.first !== after.firstNo) {
    out = { ...out, ...fail('table-mismatch-cache', { cacheFirst: identityCache.first, uiFirst: after.firstNo }) }
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

await writeFile(REPORT_JSON, JSON.stringify(out, null, 2), 'utf8')
console.log(JSON.stringify({
  pass: out.pass,
  failCode: out.failCode,
  sha: out.sha,
  branch: out.branch,
  optionCount: out.start?.options?.filter((o) => o.value).length,
  picked: out.picked?.label,
  afterFirst: out.after?.firstNo,
  missingIdentity: out.missingIdentity || [],
  clockOnly: (out.clockOnly || []).map((o) => o.label),
  error: out.error || null,
}, null, 2))
if (!out.pass) process.exit(1)
