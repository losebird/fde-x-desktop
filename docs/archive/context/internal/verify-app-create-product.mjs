/**
 * Live AI: create a product-shaped app. Store internal/ only — do not git-add.
 * Never 确认过账 / biz_write. Do not kill pnpm 5174. Do not open/edit 走访.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const MEDIA = `${STORE}/media/app-create-product.png`
const REPORT_JSON = `${STORE}/internal/verify-app-create-product.json`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const DB = `${SCENE}/runtime/data/fde-workstation.sqlite`
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const visitName = '本周现场走访记录'
const description = '家庭药箱：药名、分类（常备/处方/外用）、剩余片数、到期日、备注。要概览数字、记一笔、按分类的图和流水。能问 AI，并能撕成浮窗。'
const rowMarker = `药-${Date.now().toString(36)}`

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

try {
  execSync('cp -R runtime/presets/fde-app-builder "$HOME/.dsh-fde-x/.agent-presets/fde-app-builder"', {
    cwd: SCENE,
    shell: '/bin/zsh',
  })
} catch {
  // preset copy is best-effort; createAppDraft still lays out pages
}

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } })
const bizWriteUrls = []
page.on('request', (req) => {
  const url = req.url()
  if (/biz\/write|biz_write/i.test(url)) bizWriteUrls.push(url)
})

const out = {
  sha,
  branch,
  description,
  rowMarker,
  visitName,
  hardcoded: 'none',
  silentBizWrite: false,
  originPushed: false,
  template: false,
}

function seedState({ activeDataSubview = 'overview', panelWidth = 1100 } = {}) {
  return page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd, activeDataSubview: view, panelWidth: width }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeDataSubview = view
    state.state.floating = {}
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
      { id: 'data', label: '业务应用', icon: 'Database', emoji: '🗃️', accent: 'bg-cyan-500', state: 'full', width, view: 'data' },
    ]
    const panels = Array.isArray(state.state.panels) ? state.state.panels : []
    state.state.panels = (panels.length ? panels : fallbackPanels).map((p) => (
      p && p.id === 'data' ? { ...p, state: 'full', width } : p
    ))
    if (!state.state.panels.some((p) => p && p.id === 'data')) state.state.panels = fallbackPanels
    if (state.version == null) state.version = 17
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd, activeDataSubview, panelWidth })
}

async function measureChrome() {
  return page.evaluate(() => {
    const main = document.querySelector('main')
    const aside = document.querySelector('aside')
    const stage = document.querySelector('[style*="width"]')
    const dataPanel = [...document.querySelectorAll('div')].find((el) => el.style && el.style.width && el.className.includes('border-l'))
    return {
      mainW: main ? Math.round(main.getBoundingClientRect().width) : 0,
      asideW: aside ? Math.round(aside.getBoundingClientRect().width) : 0,
      asideOpen: aside ? aside.getBoundingClientRect().width > 80 : false,
      sessionTitle: Boolean(aside && /会话/.test(aside.textContent || '')),
      stageW: dataPanel ? Math.round(dataPanel.getBoundingClientRect().width) : 0,
      shieldAttr: document.body.hasAttribute('data-floating-drag'),
      iframe: Boolean(document.querySelector('iframe')),
    }
  })
}

async function listApps() {
  return page.evaluate(async ({ wsId, cwd }) => {
    const params = new URLSearchParams({ workspaceId: wsId, workspaceCwd: cwd })
    const json = await fetch(`/api/v1/business/apps?${params}`).then((r) => r.json())
    return (json.items || []).map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      kind: row.appKind,
      revision: row.currentRevision,
      updatedAt: row.updatedAt,
    }))
  }, { wsId: workspaceId, cwd: workspaceCwd })
}

async function productShot() {
  return page.evaluate(() => {
    const product = document.querySelector('[data-app-product]')
    const table = document.querySelector('[data-app-table]')
    return {
      product: Boolean(product),
      overview: Boolean(document.querySelector('[data-app-overview]')),
      compose: Boolean(document.querySelector('[data-app-compose]')),
      chart: Boolean(document.querySelector('[data-app-chart]')),
      feed: Boolean(document.querySelector('[data-app-feed]')),
      cards: Boolean(document.querySelector('[data-app-cards]')),
      uses: document.querySelector('[data-app-uses]')?.getAttribute('data-app-uses') || '',
      table: Boolean(table),
      nav: (document.querySelector('[data-app-product-nav]')?.textContent || '').trim().slice(0, 80),
    }
  })
}

try {
  await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(async () => {
    await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => ({}))
  })
  await page.waitForTimeout(1500)
  await seedState()
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

  const listedBefore = await listApps()
  out.listedBefore = listedBefore.map((row) => ({ id: row.id, name: row.name, status: row.status }))
  const visitBefore = listedBefore.find((row) => row.name === visitName)
  out.visitBefore = visitBefore || null
  if (!visitBefore || visitBefore.status !== 'active') {
    out.failCode = 'visit-missing'
    throw new Error(out.failCode)
  }

  const createBtn = page.locator('[data-app-create-entry]')
  await createBtn.click({ timeout: 15000 })
  await page.waitForTimeout(400)
  const textarea = page.locator('[data-app-create-wizard] textarea').first()
  await textarea.fill(description)
  const generateBtn = page.getByRole('button', { name: '生成', exact: true })
  if (await generateBtn.isDisabled()) {
    out.failCode = 'generate-disabled'
    throw new Error(out.failCode)
  }
  await generateBtn.click()
  out.createdStarted = true
  try {
    await page.locator('[data-app-create-wizard="preview"]').waitFor({ state: 'visible', timeout: 250000 })
  } catch {
    const bodyText = await page.locator('body').innerText()
    out.failText = bodyText.slice(0, 1200)
    out.cooling = coolingIn(bodyText)
    out.failCode = out.cooling ? 'ai-cooling' : 'preview-timeout'
    throw new Error(out.failCode)
  }
  out.created = true
  out.previewed = true
  out.previewShot = await productShot()

  const activateBtn = page.getByRole('button', { name: '采纳并激活' })
  await activateBtn.waitFor({ state: 'visible', timeout: 15000 })
  await activateBtn.click()
  await page.waitForTimeout(2500)
  try {
    await page.locator('[data-app-workspace]').waitFor({ state: 'visible', timeout: 20000 })
    out.activated = true
  } catch {
    const bodyText = await page.locator('body').innerText()
    out.failText = bodyText.slice(0, 1200)
    out.failCode = 'activate-no-workspace'
    throw new Error(out.failCode)
  }

  const listedActive = await listApps()
  const newActive = listedActive.find((row) => row.status === 'active' && row.id !== visitBefore.id && !out.listedBefore.some((old) => old.id === row.id && old.status === 'active'))
    || listedActive.find((row) => row.status === 'active' && row.name !== visitName && !['库存盘点'].includes(row.name) && row.updatedAt && Date.parse(row.updatedAt) > Date.now() - 15 * 60 * 1000)
  out.activeApp = newActive || listedActive.filter((row) => row.status === 'active').find((row) => row.id !== visitBefore.id) || null
  out.newAppName = out.activeApp?.name || ''
  out.visitUnchanged = listedActive.some((row) => row.id === visitBefore.id && row.status === visitBefore.status && row.revision === visitBefore.revision)

  const liveShot = await productShot()
  out.liveShot = liveShot
  out.productPage = Boolean(liveShot.product && liveShot.overview && liveShot.compose && (liveShot.feed || liveShot.cards) && !liveShot.table)

  const compose = page.locator('[data-app-compose]')
  await compose.waitFor({ state: 'visible', timeout: 10000 })
  const fields = compose.locator('input, textarea, select')
  const fieldCount = await fields.count()
  out.formFields = fieldCount
  for (let i = 0; i < fieldCount; i++) {
    const input = fields.nth(i)
    const type = await input.evaluate((el) => el.tagName === 'SELECT' ? 'select' : (el.getAttribute('type') || el.tagName.toLowerCase()))
    if (type === 'select') {
      const options = await input.locator('option').evaluateAll((els) => els.map((el) => el.value).filter(Boolean))
      if (options[0]) await input.selectOption(options[0])
    } else if (type === 'date' || type === 'datetime-local') {
      await input.fill(type === 'date' ? '2026-09-19' : '2026-09-19T10:00')
    } else if (type === 'checkbox') {
      await input.check().catch(() => {})
    } else if (type === 'number') {
      await input.fill('12')
    } else {
      await input.fill(i === 0 ? rowMarker : `备注 ${rowMarker}`)
    }
  }
  await compose.locator('button.btn-brand').click()
  await page.waitForTimeout(1500)
  const bodyAfterCreate = await page.locator('body').innerText()
  out.rowCreated = bodyAfterCreate.includes(rowMarker)
  out.createNote = /已记下|已创建/.test(bodyAfterCreate)

  const useAi = page.locator('[data-app-use="ai"]')
  const useFloat = page.locator('[data-app-use="float"]')
  out.hasAi = await useAi.count() > 0
  out.hasFloat = await useFloat.count() > 0
  if (out.hasAi) {
    await useAi.click()
    await page.waitForTimeout(2500)
    out.aiSession = await page.evaluate(() => {
      const raw = localStorage.getItem('scene-39-workstation')
      const state = raw ? JSON.parse(raw) : {}
      return state.state?.activeAiSessionId || null
    })
  }
  if (out.hasFloat) {
    await useFloat.click()
    await page.waitForTimeout(800)
    out.floated = await page.evaluate(() => {
      const raw = localStorage.getItem('scene-39-workstation')
      const state = raw ? JSON.parse(raw) : {}
      return Boolean(state.state?.floating?.data)
    })
    // dock back so screenshot is the product page, not an empty catalog
    await page.evaluate(() => {
      const key = 'scene-39-workstation'
      const raw = localStorage.getItem(key)
      const state = raw ? JSON.parse(raw) : { state: {} }
      state.state = state.state || {}
      state.state.floating = {}
      const panels = Array.isArray(state.state.panels) ? state.state.panels : []
      state.state.panels = panels.map((p) => (p && p.id === 'data' ? { ...p, state: 'full' } : p))
      localStorage.setItem(key, JSON.stringify(state))
    })
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForTimeout(1500)
  } else {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForTimeout(1500)
  }

  const back = page.getByRole('button', { name: /返回列表/ })
  if (await back.count()) {
    // already in workspace after reload? seed keeps data panel; workspaceAppId is component state and resets
    out.afterReloadOnCatalog = true
  }
  const listedReload = await listApps()
  out.visitAfterReload = listedReload.find((row) => row.id === visitBefore.id) || null
  const appName = out.newAppName
  if (appName) {
    const appRow = page.locator('[data-app-row]').filter({ hasText: appName }).locator('button').first()
    if (await appRow.count()) await appRow.click().catch(() => {})
    await page.waitForTimeout(1200)
  }
  const bodyAfterReload = await page.locator('body').innerText()
  out.rowPersistedUi = bodyAfterReload.includes(rowMarker)
  out.reloadShot = await productShot()

  const marker = page.getByText(rowMarker).first()
  if (await marker.count()) await marker.scrollIntoViewIfNeeded().catch(() => {})
  await page.screenshot({ path: MEDIA, fullPage: false })
  out.screenshot = MEDIA

  const recordsBtn = page.getByRole('button', { name: '业务记录', exact: true })
  if (await recordsBtn.count()) await recordsBtn.click({ timeout: 10000 })
  await page.waitForTimeout(1200)
  const chipTexts = await page.locator('button').evaluateAll((els) => els.map((el) => (el.textContent || '').trim()).filter(Boolean))
  out.recordsChips = chipTexts.filter((text) => /回款|合同|chip|销售/.test(text)).slice(0, 20)
  out.masqueradeKindChip = Boolean(appName) && chipTexts.some((text) => text === appName || text.startsWith(`${appName} `))

  await page.getByRole('button', { name: '应用', exact: true }).click().catch(() => {})
  await page.waitForTimeout(600)
  const threeTabs = {
    app: await page.getByRole('button', { name: '应用', exact: true }).count() > 0,
    records: await page.getByRole('button', { name: '业务记录', exact: true }).count() > 0,
    ops: await page.getByRole('button', { name: '操作记录', exact: true }).count() > 0,
  }
  out.threeTabs = threeTabs
  out.createEntry = await page.locator('[data-app-create-entry]').count() > 0
  out.deleteEntry = await page.getByRole('button', { name: /删除/ }).count() > 0

  await seedState({ panelWidth: 872 })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(800)
  out.wide = await measureChrome()
  await seedState({ panelWidth: 360 })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(800)
  out.narrow = await measureChrome()
  out.resizeCollapse = out.wide.asideW <= 56
  out.resizeExpand = out.narrow.asideW >= 200

  const css = await readFile(`${SCENE}/src/index.css`, 'utf8')
  const stage = await readFile(`${SCENE}/src/components/StagePanel.tsx`, 'utf8')
  out.iframeShieldCss = /\[data-floating-drag\] iframe/.test(css) && /pointer-events:\s*none/.test(css)
  out.stageShieldFn = /function iframeDragShield/.test(stage) && /iframeDragShield\(true\)/.test(stage)

  const sqlite = new DatabaseSync(DB)
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'app_%'").all().map((row) => row.name)
  out.sqliteTables = tables
  let sqliteHit = false
  for (const table of tables) {
    try {
      const rows = sqlite.prepare(`SELECT * FROM "${table}" WHERE workspace_cwd = ?`).all(workspaceCwd)
      if (JSON.stringify(rows).includes(rowMarker)) sqliteHit = true
    } catch {
      // skip
    }
  }
  sqlite.close()
  out.sqliteHasRow = sqliteHit

  const srcGrep = execSync(`rg -n ${JSON.stringify(out.newAppName || '___none___')} src runtime/presets runtime/apps || true`, { cwd: SCENE, encoding: 'utf8' })
  out.newNameInSrc = srcGrep.trim() || 'none'
  const banned = execSync("rg -n '健身|记账|库存盘点|运动塑形' src/components/apps runtime/apps || true", { cwd: SCENE, encoding: 'utf8' })
  out.templateHits = banned.trim() || 'none'
  out.bizWriteUrls = bizWriteUrls
  out.silentBizWrite = bizWriteUrls.length > 0

  out.wired = [out.hasAi && out.aiSession ? 'ai' : '', out.hasFloat && out.floated ? 'float' : ''].filter(Boolean).join(',') || 'none'
  out.pass = Boolean(
    out.created && out.previewed && out.activated && out.productPage && out.rowCreated
    && (out.rowPersistedUi || out.sqliteHasRow) && out.visitUnchanged && out.resizeCollapse && out.resizeExpand
    && out.iframeShieldCss && out.stageShieldFn && threeTabs.app && threeTabs.records && threeTabs.ops
    && out.createEntry && out.deleteEntry && !out.masqueradeKindChip && !out.silentBizWrite
    && out.newNameInSrc === 'none' && out.templateHits === 'none'
    && (out.wired === 'ai' || out.wired === 'float' || out.wired === 'ai,float'),
  )
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
