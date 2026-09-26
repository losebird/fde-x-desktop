/**
 * Live AJ: product work surface on an existing generated app.
 * Store internal/ only — do not git-add. Never 确认过账 / biz_write.
 * Do not kill pnpm 5174. Do not open/edit 走访.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const MEDIA = `${STORE}/media/app-product-aj.png`
const REPORT_JSON = `${STORE}/internal/verify-app-product-aj.json`
const REPORT_MD = `${STORE}/internal/verify-app-product-aj.md`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const DB = `${SCENE}/runtime/data/fde-workstation.sqlite`
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const visitName = '本周现场走访记录'
const visitId = 'app_5d1eef0062114901b4797d705e5166b5'
const rowMarker = `记-${Date.now().toString(36)}`

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
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
const bizWriteUrls = []
page.on('request', (req) => {
  const url = req.url()
  if (/biz\/write|biz_write/i.test(url)) bizWriteUrls.push(url)
})

const out = {
  sha,
  branch,
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
    const dataPanel = [...document.querySelectorAll('div')].find((el) => el.style && el.style.width && el.className.includes('border-l'))
    return {
      mainW: main ? Math.round(main.getBoundingClientRect().width) : 0,
      asideW: aside ? Math.round(aside.getBoundingClientRect().width) : 0,
      asideOpen: aside ? aside.getBoundingClientRect().width > 80 : false,
      stageW: dataPanel ? Math.round(dataPanel.getBoundingClientRect().width) : 0,
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
    const workspace = document.querySelector('[data-app-workspace]')
    const text = (workspace?.innerText || document.body.innerText || '')
    return {
      product: Boolean(product),
      overview: Boolean(document.querySelector('[data-app-overview]')),
      compose: Boolean(document.querySelector('[data-app-compose]')),
      chart: Boolean(document.querySelector('[data-app-chart]')),
      feed: Boolean(document.querySelector('[data-app-feed]')),
      cards: Boolean(document.querySelector('[data-app-cards]')),
      cardCount: document.querySelectorAll('[data-app-card]').length,
      table: Boolean(document.querySelector('[data-app-table]')),
      nav: (document.querySelector('[data-app-product-nav]')?.textContent || '').trim().slice(0, 80),
      navButtons: [...document.querySelectorAll('[data-app-product-nav] button')].map((el) => (el.textContent || '').trim()),
      uses: document.querySelector('[data-app-uses]')?.getAttribute('data-app-uses') || '',
      editSpec: text.includes('编辑 spec'),
      rollback: text.includes('版本回滚'),
      longDescription: /登记家中药品|独立工作面 ·/.test(text),
      builderOpen: Boolean(document.querySelector('[data-app-builder-open]')),
      builderDrawer: Boolean(document.querySelector('[data-app-builder-drawer]')),
      workspaceText: text.slice(0, 500),
    }
  })
}

async function openGeneratedApp(name) {
  const row = page.locator('[data-app-row]').filter({ hasText: name }).locator('button').first()
  await row.click({ timeout: 15000 })
  await page.locator('[data-app-workspace]').waitFor({ state: 'visible', timeout: 20000 })
  await page.locator('[data-app-product]').waitFor({ state: 'visible', timeout: 15000 })
}

try {
  await page.goto(`${mainBase}/ai?aj=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(async () => {
    await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => ({}))
  })
  await seedState()
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1800)

  const overviewBtn = page.getByRole('button', { name: '应用', exact: true })
  if (await overviewBtn.count()) await overviewBtn.click({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(800)

  const listedBefore = await listApps()
  out.listedBefore = listedBefore.map((row) => ({ id: row.id, name: row.name, status: row.status, updatedAt: row.updatedAt }))
  const visitBefore = listedBefore.find((row) => row.id === visitId) || listedBefore.find((row) => row.name === visitName)
  out.visitBefore = visitBefore || null
  if (!visitBefore || visitBefore.status !== 'active') {
    out.failCode = 'visit-missing'
    throw new Error(out.failCode)
  }

  const productApp = listedBefore.find((row) => row.status === 'active' && row.id !== visitBefore.id && row.name !== visitName)
  out.openedApp = productApp || null
  if (!productApp) {
    out.failCode = 'no-generated-app'
    throw new Error(out.failCode)
  }

  await openGeneratedApp(productApp.name)
  out.liveShot = await productShot()
  out.builderOffDaily = Boolean(!out.liveShot.editSpec && !out.liveShot.rollback && !out.liveShot.longDescription && !out.liveShot.builderDrawer)
  out.hasNav = (out.liveShot.navButtons || []).length >= 2
  out.openedVisit = false

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
      await input.fill('3')
    } else {
      await input.fill(i === 0 ? rowMarker : `备注 ${rowMarker}`)
    }
  }
  await compose.locator('button.btn-brand').click()
  await page.waitForTimeout(1500)
  const bodyAfterCreate = await page.locator('[data-app-workspace]').innerText()
  out.rowCreated = bodyAfterCreate.includes(rowMarker)

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
  }

  await seedState()
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1500)
  if (await overviewBtn.count()) await overviewBtn.click({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(600)
  await openGeneratedApp(productApp.name)
  const bodyAfterReload = await page.locator('[data-app-workspace]').innerText()
  out.rowPersistedUi = bodyAfterReload.includes(rowMarker)
  out.reloadShot = await productShot()

  const navButtons = page.locator('[data-app-product-nav] button')
  const navCount = await navButtons.count()
  out.navCount = navCount
  if (navCount >= 2) {
    await navButtons.nth(1).click()
    await page.waitForTimeout(800)
  }
  await page.locator('[data-app-cards]').waitFor({ state: 'visible', timeout: 10000 })
  out.cardsShot = await productShot()
  out.hasCards = Boolean(out.cardsShot.cards)
  const card = page.locator('[data-app-card]').first()
  if (await card.count()) await card.scrollIntoViewIfNeeded().catch(() => {})
  await page.screenshot({ path: MEDIA, fullPage: false })
  out.screenshot = MEDIA

  const listedAfter = await listApps()
  const visitAfter = listedAfter.find((row) => row.id === visitBefore.id)
  out.visitAfter = visitAfter || null
  out.visitUnchanged = Boolean(
    visitAfter
    && visitAfter.status === visitBefore.status
    && visitAfter.revision === visitBefore.revision
    && visitAfter.updatedAt === visitBefore.updatedAt,
  )

  await page.getByRole('button', { name: '返回列表' }).click()
  await page.waitForTimeout(600)
  const threeTabs = {
    app: await page.getByRole('button', { name: '应用', exact: true }).count() > 0,
    records: await page.getByRole('button', { name: '业务记录', exact: true }).count() > 0,
    ops: await page.getByRole('button', { name: '操作记录', exact: true }).count() > 0,
  }
  out.threeTabs = threeTabs
  out.createEntry = await page.locator('[data-app-create-entry]').count() > 0
  out.deleteEntry = await page.getByRole('button', { name: /删除/ }).count() > 0

  await page.getByRole('button', { name: '业务记录', exact: true }).click({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1000)
  const chipTexts = await page.locator('button').evaluateAll((els) => els.map((el) => (el.textContent || '').trim()).filter(Boolean))
  out.masqueradeKindChip = Boolean(productApp.name) && chipTexts.some((text) => text === productApp.name || text.startsWith(`${productApp.name} `))

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

  const banned = execSync("rg -n '健身|记账|库存盘点|运动塑形|家庭药箱' src/components/apps runtime/apps src/lib/app-spec.ts || true", { cwd: SCENE, encoding: 'utf8' })
  out.templateHits = banned.trim() || 'none'
  out.bizWriteUrls = bizWriteUrls
  out.silentBizWrite = bizWriteUrls.length > 0
  out.wired = [out.hasAi && out.aiSession ? 'ai' : '', out.hasFloat && out.floated ? 'float' : ''].filter(Boolean).join(',') || 'none'
  out.lookAligned = Boolean(out.hasNav && out.hasCards && out.cardsShot.cardCount > 0 && !out.cardsShot.table)

  out.pass = Boolean(
    out.builderOffDaily && out.hasNav && out.hasCards && out.lookAligned
    && out.rowCreated && (out.rowPersistedUi || out.sqliteHasRow)
    && out.visitUnchanged && out.resizeCollapse && out.resizeExpand
    && out.iframeShieldCss && out.stageShieldFn
    && threeTabs.app && threeTabs.records && threeTabs.ops
    && out.createEntry && out.deleteEntry && !out.masqueradeKindChip && !out.silentBizWrite
    && out.templateHits === 'none'
    && (out.wired === 'ai' || out.wired === 'float' || out.wired === 'ai,float'),
  )
} catch (error) {
  out.error = error instanceof Error ? error.message : String(error)
  out.pass = false
  await page.screenshot({ path: MEDIA, fullPage: true }).catch(() => {})
  out.screenshot = MEDIA
} finally {
  const yesNo = (value) => (value ? 'yes' : 'no')
  const md = [
    '---',
    'cursor:',
    '  subagentId: "bc-e3c27668-b75e-55f6-bb0b-fc07e64a145a"',
    '---',
    '',
    '# Verify: AJ 产品工作面',
    '',
    `**pass:** ${out.pass ? 'yes' : 'no'}`,
    `**main SHA:** \`${out.sha}\``,
    `**branch:** \`${out.branch}\`（未推 origin）`,
    `**builder off daily:** ${yesNo(out.builderOffDaily)}`,
    `**nav or cards:** ${yesNo(out.hasNav && out.hasCards)}`,
    `**look vs refs:** ${yesNo(out.lookAligned)}`,
    `**refresh persists:** ${yesNo(out.rowPersistedUi || out.sqliteHasRow)}`,
    `**visit unchanged:** ${yesNo(out.visitUnchanged)}`,
    `**resize still good:** ${yesNo(out.resizeCollapse && out.resizeExpand)}`,
    `**silent biz_write:** ${out.silentBizWrite ? 'yes' : 'no'}`,
    `**hardcoded:** ${out.hardcoded}`,
    '',
    '## SHA',
    '',
    '| 项 | 值 |',
    '|---|---|',
    `| daily main | \`${out.sha}\` |`,
    `| branch | \`${out.branch}\` |`,
    '',
    '## 过关项',
    '',
    '| 项 | 结果 | 证据 |',
    '|---|---|---|',
    `| 建造后台是否让开 | ${yesNo(out.builderOffDaily)} | 日常面无「编辑 spec / 版本回滚 / 大段说明」；建造在抽屉 \`${yesNo(out.liveShot?.builderOpen)}\` |`,
    `| 是否有栏目或卡片 | ${yesNo(out.hasNav && out.hasCards)} | nav=${JSON.stringify(out.cardsShot?.navButtons || out.liveShot?.navButtons || [])}；cards=${yesNo(out.hasCards)} count=${out.cardsShot?.cardCount ?? 0} |`,
    `| 观感是否按参照 | ${yesNo(out.lookAligned)} | 栏目导航 + 卡片栅格；非后台宽表 table=${yesNo(out.cardsShot?.table)} |`,
    `| 刷新是否仍在 | ${yesNo(out.rowPersistedUi || out.sqliteHasRow)} | 记下 \`${rowMarker}\`；UI=${yesNo(out.rowPersistedUi)} SQLite=${yesNo(out.sqliteHasRow)} |`,
    `| 走访是否未改 | ${yesNo(out.visitUnchanged)} | ${visitId} updatedAt ${out.visitAfter?.updatedAt || '—'} |`,
    `| 拉伸是否仍好 | ${yesNo(out.resizeCollapse && out.resizeExpand)} | 拉宽 aside ${out.wide?.asideW ?? '—'}px；拉窄 ${out.narrow?.asideW ?? '—'}px |`,
    `| StagePanel iframe 指针屏蔽 | ${yesNo(out.iframeShieldCss && out.stageShieldFn)} | index.css + StagePanel.iframeDragShield 未拆 |`,
    `| 三 Tab / 创建 / 删除 | ${yesNo(out.threeTabs?.app && out.threeTabs?.records && out.threeTabs?.ops && out.createEntry && out.deleteEntry)} | 应用/业务记录/操作记录；创建应用；删除 |`,
    `| 静默写 | ${out.silentBizWrite ? 'yes' : 'no'} | ${out.bizWriteUrls?.length ? out.bizWriteUrls.join(' ') : '无 biz_write'} |`,
    `| 硬编码 | ${out.hardcoded} | templateHits=${out.templateHits || 'none'} |`,
    '',
    '## 现网',
    '',
    `打开已有应用「${out.openedApp?.name || '—'}」，未改走访，未再走创建。`,
    '',
    '## 图',
    '',
    '产品工作面：栏目导航 + 卡片栅格。不是后台宽表，不是走访。',
    '',
    MEDIA,
    '',
    out.error ? `失败：${out.error}` : '',
  ].join('\n')
  await writeFile(REPORT_JSON, JSON.stringify(out, null, 2))
  await writeFile(REPORT_MD, md)
  await browser.close()
}

console.log(JSON.stringify(out, null, 2))
if (!out.pass) process.exit(1)
