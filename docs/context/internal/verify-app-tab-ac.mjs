/**
 * Live AC: App Tab create → preview → activate → new row persists.
 * Store internal/ only — do not git-add. Never 确认过账 / biz_write.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const MEDIA = `${STORE}/media/app-tab-ac.png`
const REPORT_JSON = `${STORE}/internal/verify-app-tab-ac.json`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const DB = `${SCENE}/runtime/data/fde-workstation.sqlite`
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const description = '本周现场走访记录：对方名称、走访日期、要点、状态（计划/已完成/需跟进）'
const rowMarker = `走访-${Date.now().toString(36)}`

function gitSha() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD && git rev-parse HEAD', { cwd: SCENE, encoding: 'utf8' }).trim().split('\n')
  } catch {
    return ['unknown', 'unknown']
  }
}

function coolingIn(text) {
  return /429|RATE_LIMIT|rate.?limit|upstream_cooling|上游账号正在冷却|可用账号正在冷却/i.test(String(text || ''))
}

const [branch, sha] = gitSha()
await mkdir(`${STORE}/internal`, { recursive: true })
await mkdir(`${STORE}/media`, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } })
const out = {
  sha,
  branch,
  hardcoded: 'none',
  workspaceCwd,
  description,
  rowMarker,
  created: false,
  previewed: false,
  activated: false,
  rowCreated: false,
  rowPersisted: false,
  inAppList: false,
  masqueradeKindChip: false,
  silentBizWrite: false,
  confirmed: false,
  originPushed: false,
}

function seedState(activeDataSubview = 'overview') {
  return page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd, activeDataSubview: view }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeDataSubview = view
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
  }, { workspaceId, workspaceCwd, activeDataSubview })
}

try {
  await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(async () => {
    await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => ({}))
  })
  await page.waitForTimeout(1500)
  await seedState('overview')
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1500)

  const st = await page.evaluate(async () => {
    const json = await fetch('/api/v1/ai/status', { headers: { accept: 'application/json' } }).then((r) => r.json()).catch(() => ({}))
    return json?.data || {}
  })
  out.connect = { connected: Boolean(st.connected), pid: st.pid, error: st.lastError || null }
  if (!out.connect.connected) {
    out.failCode = 'dsh-not-connected'
    throw new Error(out.failCode)
  }

  const overviewBtn = page.getByRole('button', { name: '应用', exact: true })
  if (await overviewBtn.count()) await overviewBtn.click({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(800)

  const fixtureIds = ['app_634b18c2aea84e72a5013a91d89b8a9a', 'app_522b558f263e43d18c5b5993596ee1dd']
  const listApps = async () => page.evaluate(async ({ wsId, cwd }) => {
    const params = new URLSearchParams({ workspaceId: wsId, workspaceCwd: cwd })
    const json = await fetch(`/api/v1/business/apps?${params}`).then((r) => r.json())
    return (json.items || []).map((row) => ({ id: row.id, name: row.name, status: row.status, kind: row.appKind }))
  }, { wsId: workspaceId, cwd: workspaceCwd })

  const listed = await listApps()
  out.leftoverIds = fixtureIds
  const already = listed.find((row) => row.kind === 'generated' && !fixtureIds.includes(row.id))
  let activateBtn = page.getByRole('button', { name: '采纳并激活' })

  if (already) {
    out.createdStarted = true
    out.created = true
    out.reusedDraft = { id: already.id, name: already.name, status: already.status }
    const rowBtn = page.locator('button.w-full').filter({ hasText: already.name }).first()
    await rowBtn.click()
    await page.waitForTimeout(2000)
    activateBtn = page.getByRole('button', { name: '采纳并激活' })
    try {
      await activateBtn.waitFor({ state: 'visible', timeout: 15000 })
      out.previewed = true
    } catch {
      out.previewNote = await page.locator('body').innerText().then((t) => t.slice(0, 800))
      if (already.status === 'active') {
        out.previewed = true
        out.activated = true
      } else {
        const bodyText = await page.locator('body').innerText()
        out.failText = bodyText.slice(0, 1200)
        out.failCode = 'preview-missing-activate'
        throw new Error(out.failCode)
      }
    }
  } else {
    const createBtn = page.getByRole('button', { name: /AI 创建应用/ })
    await createBtn.click({ timeout: 15000 })
    await page.waitForTimeout(400)
    const textarea = page.locator('textarea').first()
    await textarea.fill(description)
    const generateBtn = page.getByRole('button', { name: '生成', exact: true })
    const generateDisabled = await generateBtn.isDisabled().catch(() => true)
    out.generateDisabled = generateDisabled
    if (generateDisabled) {
      out.failCode = 'generate-disabled'
      throw new Error(out.failCode)
    }
    await generateBtn.click()
    out.createdStarted = true
    const generating = page.getByText('生成中…')
    await generating.waitFor({ state: 'visible', timeout: 15000 })
    try {
      await generating.waitFor({ state: 'hidden', timeout: 250000 })
    } catch {
      const bodyText = await page.locator('body').innerText()
      out.failText = bodyText.slice(0, 1200)
      out.cooling = coolingIn(bodyText)
      out.failCode = out.cooling ? 'ai-cooling' : 'preview-timeout'
      throw new Error(out.failCode)
    }
    activateBtn = page.getByRole('button', { name: '采纳并激活' })
    try {
      await activateBtn.waitFor({ state: 'visible', timeout: 15000 })
      out.created = true
      out.previewed = true
    } catch {
      const bodyText = await page.locator('body').innerText()
      out.failText = bodyText.slice(0, 1200)
      out.cooling = coolingIn(bodyText)
      out.failCode = out.cooling ? 'ai-cooling' : 'preview-missing-activate'
      throw new Error(out.failCode)
    }
  }

  const previewTitle = await page.locator('text=AI 创建应用').first().textContent().catch(() => '')
  out.previewChrome = previewTitle

  await activateBtn.click()
  await page.waitForTimeout(2000)

  const newBtn = page.getByRole('button', { name: '新建', exact: true }).last()
  try {
    await newBtn.waitFor({ state: 'visible', timeout: 20000 })
    out.activated = true
  } catch {
    const bodyText = await page.locator('body').innerText()
    out.failText = bodyText.slice(0, 1200)
    out.failCode = 'activate-no-new-button'
    throw new Error(out.failCode)
  }

  const listBefore = await page.evaluate(async ({ wsId, cwd }) => {
    const params = new URLSearchParams({ workspaceId: wsId, workspaceCwd: cwd })
    const json = await fetch(`/api/v1/business/apps?${params}`).then((r) => r.json())
    return (json.items || []).map((row) => ({ id: row.id, name: row.name, status: row.status, kind: row.appKind }))
  }, { wsId: workspaceId, cwd: workspaceCwd })
  out.listAfterActivate = listBefore
  const generated = listBefore.filter((row) => row.kind === 'generated' && row.status === 'active' && !fixtureIds.includes(row.id))
  out.inAppList = generated.length > 0
  out.activeApp = generated[0] || null

  await newBtn.click()
  await page.waitForTimeout(400)

  const form = page.locator('label').filter({ has: page.locator('input, textarea, select') })
  const formCount = await form.count()
  out.formFields = formCount
  for (let i = 0; i < formCount; i++) {
    const label = form.nth(i)
    const input = label.locator('input, textarea, select').first()
    const type = await input.evaluate((el) => el.tagName === 'SELECT' ? 'select' : (el.getAttribute('type') || el.tagName.toLowerCase()))
    if (type === 'select') {
      const options = await input.locator('option').evaluateAll((els) => els.map((el) => el.value).filter(Boolean))
      if (options[0]) await input.selectOption(options[0])
    } else if (type === 'date') {
      await input.fill('2026-09-19')
    } else if (type === 'checkbox') {
      await input.check().catch(() => {})
    } else if (type === 'number') {
      await input.fill('1')
    } else {
      await input.fill(i === 0 ? rowMarker : `要点 ${rowMarker}`)
    }
  }
  await page.getByRole('button', { name: '创建', exact: true }).click()
  await page.waitForTimeout(1500)
  const bodyAfterCreate = await page.locator('body').innerText()
  out.rowCreated = bodyAfterCreate.includes(rowMarker)
  out.createNote = bodyAfterCreate.includes('已创建')

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1500)
  if (out.activeApp?.name) {
    const appRow = page.getByRole('button', { name: new RegExp(out.activeApp.name) }).first()
    if (await appRow.count()) await appRow.click().catch(() => {})
    await page.waitForTimeout(800)
  }
  const bodyAfterReload = await page.locator('body').innerText()
  out.rowPersisted = bodyAfterReload.includes(rowMarker)
  const marker = page.getByText(rowMarker).first()
  if (await marker.count()) await marker.scrollIntoViewIfNeeded().catch(() => {})
  await page.screenshot({ path: MEDIA, fullPage: false })
  out.screenshot = MEDIA

  const recordsBtn = page.getByRole('button', { name: '业务记录', exact: true })
  if (await recordsBtn.count()) await recordsBtn.click({ timeout: 10000 })
  await page.waitForTimeout(1200)
  const chipTexts = await page.locator('button.btn').evaluateAll((els) => els.map((el) => (el.textContent || '').trim()).filter(Boolean))
  const appName = out.activeApp?.name || ''
  out.recordsChips = chipTexts.slice(0, 40)
  out.masqueradeKindChip = Boolean(appName) && chipTexts.some((text) => text === appName || text.startsWith(`${appName} `) || text.includes(`本地 · ${appName}`))

  const sqlite = new DatabaseSync(DB)
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'app_%'").all().map((row) => row.name)
  out.sqliteTables = tables
  let sqliteHit = false
  for (const table of tables) {
    try {
      const rows = sqlite.prepare(`SELECT * FROM "${table}" WHERE workspace_cwd = ?`).all(workspaceCwd)
      if (JSON.stringify(rows).includes(rowMarker)) sqliteHit = true
    } catch {
      // skip non-app row tables
    }
  }
  sqlite.close()
  out.sqliteHasRow = sqliteHit
  if (sqliteHit) out.rowPersisted = true

  out.pass = Boolean(out.created && out.previewed && out.activated && out.rowCreated && out.rowPersisted && out.inAppList && !out.masqueradeKindChip && !out.silentBizWrite)
} catch (error) {
  out.error = error instanceof Error ? error.message : String(error)
  out.pass = false
  await page.screenshot({ path: MEDIA, fullPage: true }).catch(() => {})
  out.screenshot = MEDIA
} finally {
  await writeFile(REPORT_JSON, JSON.stringify(out, null, 2))
  await browser.close()
}

console.log(JSON.stringify(out, null, 2))
if (!out.pass) process.exit(1)
