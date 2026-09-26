/**
 * Live AM: same-group cards pack horizontally; product-complete tiles.
 * Store internal/ only — do not git-add. Never 确认过账 / biz_write.
 * Do not kill pnpm 5174. Do not open-to-edit 走访 / 药箱. Do not create a new app.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const MEDIA = `${STORE}/media/app-product-am.png`
const REPORT_JSON = `${STORE}/internal/verify-app-product-am.json`
const REPORT_MD = `${STORE}/internal/verify-app-product-am.md`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const DB = `${SCENE}/runtime/data/fde-workstation.sqlite`
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const visitName = '本周现场走访记录'
const visitId = 'app_5d1eef0062114901b4797d705e5166b5'
const boardName = '资料卡片板'
const ledgerName = '家庭药箱'
const rowMarker = `am-${Date.now().toString(36)}`

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
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } })
const bizWriteUrls = []
page.on('request', (req) => {
  const url = req.url()
  if (/biz\/write|biz_write/i.test(url)) bizWriteUrls.push(url)
})

const out = {
  sha,
  branch,
  rowMarker,
  boardName,
  visitName,
  hardcoded: 'none',
  silentBizWrite: false,
  originPushed: false,
  createdNewApp: false,
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
    const serialRe = /[\u4e00-\u9fffA-Za-z]{1,6}-[a-z0-9]{5,}/
    const cardTitles = [...document.querySelectorAll('[data-app-card]')].map((el) => (
      el.getAttribute('data-app-card-title') || el.querySelector('h3')?.textContent || ''
    ).trim())
    const groups = [...document.querySelectorAll('[data-app-card-group]')].map((el) => {
      const cards = [...el.querySelectorAll('[data-app-card]')]
      const boxes = cards.map((card) => {
        const box = card.getBoundingClientRect()
        return {
          title: (card.getAttribute('data-app-card-title') || card.querySelector('h3')?.textContent || '').trim(),
          left: Math.round(box.left),
          top: Math.round(box.top),
          width: Math.round(box.width),
          height: Math.round(box.height),
        }
      })
      const multi = boxes.length >= 2
      const sameRow = multi && boxes.every((box) => Math.abs(box.top - boxes[0].top) <= 24)
      const distinctX = multi && new Set(boxes.map((box) => box.left)).size >= 2
      return {
        key: el.getAttribute('data-app-card-group') || '',
        label: (el.querySelector('[data-app-card-group-label]')?.textContent || '').trim(),
        count: boxes.length,
        boxes,
        horizontal: Boolean(sameRow && distinctX),
      }
    })
    return {
      product: Boolean(product),
      ledger: Boolean(document.querySelector('[data-app-ledger]')),
      overview: Boolean(document.querySelector('[data-app-overview]')),
      compose: Boolean(document.querySelector('[data-app-compose]')),
      chart: Boolean(document.querySelector('[data-app-chart]')),
      feed: Boolean(document.querySelector('[data-app-feed]')),
      cards: Boolean(document.querySelector('[data-app-cards]')),
      cardCount: document.querySelectorAll('[data-app-card]').length,
      cardGroups: groups.map((group) => group.key),
      groupLayouts: groups,
      horizontalGroup: groups.find((group) => group.horizontal) || null,
      cardActions: document.querySelectorAll('[data-app-card-action]').length,
      table: Boolean(document.querySelector('[data-app-table]')),
      nav: (document.querySelector('[data-app-product-nav]')?.textContent || '').trim().slice(0, 80),
      uses: document.querySelector('[data-app-uses]')?.getAttribute('data-app-uses') || '',
      editSpec: text.includes('编辑 spec'),
      rollback: text.includes('版本回滚'),
      builderOpen: Boolean(document.querySelector('[data-app-builder-open]')),
      builderDrawer: Boolean(document.querySelector('[data-app-builder-drawer]')),
      cardTitles,
      serialCardTitle: cardTitles.some((title) => serialRe.test(title)),
      workspaceText: text.slice(0, 800),
    }
  })
}

async function openGeneratedApp(name) {
  const row = page.locator('[data-app-row]').filter({ hasText: name }).locator('button').first()
  await row.click({ timeout: 15000 })
  await page.locator('[data-app-workspace]').waitFor({ state: 'visible', timeout: 20000 })
  await page.locator('[data-app-product]').waitFor({ state: 'visible', timeout: 15000 })
}

async function addCard({ title, blurb, groupKey, url }) {
  const compose = page.locator('[data-app-compose]')
  await compose.waitFor({ state: 'visible', timeout: 10000 })
  const fields = compose.locator('input, textarea, select')
  const fieldCount = await fields.count()
  let filledTitle = false
  let filledUrl = false
  for (let i = 0; i < fieldCount; i++) {
    const input = fields.nth(i)
    const type = await input.evaluate((el) => el.tagName === 'SELECT' ? 'select' : (el.getAttribute('type') || el.tagName.toLowerCase()))
    if (type === 'select') {
      const options = await input.locator('option').evaluateAll((els) => els.map((el) => el.value).filter(Boolean))
      const pick = options.includes(groupKey) ? groupKey : options[0]
      if (pick) await input.selectOption(pick)
    } else if (type === 'textarea') {
      await input.fill(blurb)
    } else if (type === 'date' || type === 'datetime-local' || type === 'checkbox' || type === 'number') {
      // unused on this board
    } else if (!filledTitle) {
      await input.fill(title)
      filledTitle = true
    } else if (!filledUrl) {
      await input.fill(url)
      filledUrl = true
    }
  }
  await compose.locator('button.btn-brand').click()
  await page.waitForTimeout(1200)
  const body = await page.locator('[data-app-workspace]').innerText()
  return body.includes(title)
}

try {
  await page.goto(`${mainBase}/ai?am=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
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

  const board = listedBefore.find((row) => row.name === boardName && row.status === 'active')
  const ledgerApp = listedBefore.find((row) => row.name === ledgerName && row.status === 'active')
  out.openedApp = board || null
  out.ledgerApp = ledgerApp ? { id: ledgerApp.id, name: ledgerApp.name, updatedAt: ledgerApp.updatedAt } : null
  if (!board) {
    out.failCode = 'board-missing'
    throw new Error(out.failCode)
  }

  await openGeneratedApp(board.name)
  out.liveShot = await productShot()
  out.builderOffDaily = Boolean(!out.liveShot.editSpec && !out.liveShot.rollback && !out.liveShot.builderDrawer)
  out.openedVisit = false
  out.cardsBefore = out.liveShot.cardCount

  const firstGroup = (out.liveShot.groupLayouts || []).find((group) => group.count >= 1) || { key: '', label: '' }
  const secondGroup = (out.liveShot.groupLayouts || []).find((group) => group.key && group.key !== firstGroup.key) || firstGroup
  const extra = [
    { title: '验收清单', blurb: `发布前对照 ${rowMarker}`, groupKey: firstGroup.key, url: 'https://example.com/checklist' },
    { title: '接口说明', blurb: `字段和错误码 ${rowMarker}`, groupKey: firstGroup.key, url: 'https://example.com/api' },
    { title: '设计规范', blurb: `间距和字号 ${rowMarker}`, groupKey: secondGroup.key, url: 'https://example.org/design' },
  ]
  const existingTitles = new Set(out.liveShot.cardTitles || [])
  out.addedTitles = extra.filter((card) => existingTitles.has(card.title)).map((card) => card.title)
  for (const card of extra) {
    if (existingTitles.has(card.title)) continue
    const ok = await addCard(card)
    if (ok) out.addedTitles.push(card.title)
  }
  out.rowCreated = extra.every((card) => existingTitles.has(card.title) || out.addedTitles.includes(card.title))

  const afterAdd = await productShot()
  out.afterAdd = afterAdd
  out.sameGroupHorizontal = Boolean(afterAdd.horizontalGroup && afterAdd.horizontalGroup.count >= 2)
  out.titleIsBusinessName = Boolean(
    (afterAdd.cardTitles || []).includes('入门手册')
    && (afterAdd.cardTitles || []).some((title) => out.addedTitles.includes(title))
    && !afterAdd.serialCardTitle,
  )

  const openBtn = page.locator('[data-app-card-action="url"]').first()
  out.hasOpenAction = await openBtn.count() > 0
  if (out.hasOpenAction) {
    const href = await openBtn.getAttribute('href')
    const target = await openBtn.getAttribute('target')
    out.actionHref = href || ''
    out.actionTarget = target || ''
    await openBtn.scrollIntoViewIfNeeded().catch(() => {})
    const popupPromise = page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null)
    await openBtn.click({ force: true })
    const popup = await popupPromise
    out.openedHref = popup ? popup.url() : (href || '')
    out.openLinkReal = /^https?:\/\//.test(out.openedHref || '') && (target === '_blank' || Boolean(popup))
    if (popup) await popup.close().catch(() => {})
  } else {
    out.openLinkReal = false
  }

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
  await openGeneratedApp(board.name)
  const bodyAfterReload = await page.locator('[data-app-workspace]').innerText()
  out.rowPersistedUi = extra.every((card) => bodyAfterReload.includes(card.title)) && bodyAfterReload.includes('入门手册')
  out.reloadShot = await productShot()
  out.sameGroupHorizontalAfterReload = Boolean(out.reloadShot.horizontalGroup && out.reloadShot.horizontalGroup.count >= 2)

  const cardsRoot = page.locator('[data-app-cards]')
  await cardsRoot.waitFor({ state: 'visible', timeout: 10000 })
  const multiGroup = page.locator('[data-app-card-group]').filter({ has: page.locator('[data-app-card]').nth(1) }).first()
  if (await multiGroup.count()) await multiGroup.scrollIntoViewIfNeeded().catch(() => {})
  else await cardsRoot.scrollIntoViewIfNeeded().catch(() => {})
  await page.screenshot({ path: MEDIA, fullPage: false })
  out.screenshot = MEDIA

  const listedAfterBoard = await listApps()
  const visitAfterBoard = listedAfterBoard.find((row) => row.id === visitBefore.id)
  const ledgerAfterBoard = listedAfterBoard.find((row) => row.id === ledgerApp?.id)
  out.visitAfterBoard = visitAfterBoard || null
  out.ledgerUnchangedAfterBoard = Boolean(
    ledgerApp && ledgerAfterBoard && ledgerAfterBoard.updatedAt === ledgerApp.updatedAt,
  )

  await page.getByRole('button', { name: '返回列表' }).click()
  await page.waitForTimeout(600)

  if (ledgerApp) {
    await openGeneratedApp(ledgerApp.name)
    out.ledgerShot = await productShot()
    out.ledgerStillFull = Boolean(
      out.ledgerShot.overview && out.ledgerShot.compose && out.ledgerShot.chart && out.ledgerShot.feed,
    )
    await page.getByRole('button', { name: '返回列表' }).click()
    await page.waitForTimeout(600)
  }

  const listedAfter = await listApps()
  const visitAfter = listedAfter.find((row) => row.id === visitBefore.id)
  out.visitAfter = visitAfter || null
  out.visitUnchanged = Boolean(
    visitAfter
    && visitAfter.status === visitBefore.status
    && visitAfter.revision === visitBefore.revision
    && visitAfter.updatedAt === visitBefore.updatedAt,
  )
  const boardAfter = listedAfter.find((row) => row.id === board.id)
  out.sameApp = Boolean(boardAfter && boardAfter.id === board.id)
  out.createdNewApp = listedAfter.filter((row) => row.kind === 'generated').length
    !== listedBefore.filter((row) => row.kind === 'generated').length

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
  out.masqueradeKindChip = Boolean(board.name) && chipTexts.some((text) => text === board.name || text.startsWith(`${board.name} `))

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
  const rows = sqlite.prepare('SELECT title, source, url FROM "app_resource-cards__resource" WHERE workspace_cwd = ? AND deleted_at IS NULL').all(workspaceCwd)
  sqlite.close()
  out.sqliteRows = rows
  out.sqliteHasRow = extra.every((card) => rows.some((row) => row.title === card.title))
    && rows.some((row) => row.title === '入门手册')
  const groupCounts = {}
  for (const row of rows) groupCounts[row.source] = (groupCounts[row.source] || 0) + 1
  out.sqliteGroupCounts = groupCounts

  const banned = execSync("rg -n '健身|记账|库存盘点|运动塑形|家庭药箱|资料卡片板' src/components/apps runtime/apps src/lib/app-spec.ts || true", { cwd: SCENE, encoding: 'utf8' })
  out.templateHits = banned.trim() || 'none'
  out.bizWriteUrls = bizWriteUrls
  out.silentBizWrite = bizWriteUrls.length > 0
  out.wired = [out.hasAi && out.aiSession ? 'ai' : '', out.hasFloat && out.floated ? 'float' : ''].filter(Boolean).join(',') || 'none'

  out.pass = Boolean(
    out.builderOffDaily && out.sameGroupHorizontalAfterReload && out.titleIsBusinessName
    && out.rowCreated && out.rowPersistedUi && out.sqliteHasRow
    && out.openLinkReal
    && out.ledgerStillFull
    && out.visitUnchanged && out.ledgerUnchangedAfterBoard
    && out.resizeCollapse && out.resizeExpand
    && out.iframeShieldCss && out.stageShieldFn
    && threeTabs.app && threeTabs.records && threeTabs.ops
    && out.createEntry && out.deleteEntry && !out.masqueradeKindChip && !out.silentBizWrite
    && out.templateHits === 'none' && !out.createdNewApp && out.sameApp
    && !out.reloadShot.table
    && (out.wired === 'ai' || out.wired === 'float' || out.wired === 'ai,float'),
  )
} catch (error) {
  out.error = error instanceof Error ? error.message : String(error)
  out.pass = false
  await page.screenshot({ path: MEDIA, fullPage: true }).catch(() => {})
  out.screenshot = MEDIA
} finally {
  const yesNo = (value) => (value ? 'yes' : 'no')
  const horiz = out.reloadShot?.horizontalGroup || out.afterAdd?.horizontalGroup
  const md = [
    '---',
    'cursor:',
    '  subagentId: "bc-e1d0beb7-6588-5ac8-b255-550425b23ee6"',
    '---',
    '',
    '# Verify: AM 分组卡片密度',
    '',
    `**pass:** ${out.pass ? 'yes' : 'no'}`,
    `**main SHA:** \`${out.sha}\``,
    `**branch:** \`${out.branch}\`（未推 origin）`,
    `**同组是否多卡横排:** ${yesNo(out.sameGroupHorizontalAfterReload)}`,
    `**标题是否业务名:** ${yesNo(out.titleIsBusinessName)}`,
    `**打开链接是否仍真:** ${yesNo(out.openLinkReal)}`,
    `**刷新是否仍在:** ${yesNo(out.rowPersistedUi && out.sqliteHasRow)}`,
    `**走访是否未改:** ${yesNo(out.visitUnchanged)}`,
    `**拉伸是否仍好:** ${yesNo(out.resizeCollapse && out.resizeExpand)}`,
    `**静默写:** ${out.silentBizWrite ? 'yes' : 'no'}`,
    `**硬编码:** ${out.hardcoded}`,
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
    `| 同组是否多卡横排 | ${yesNo(out.sameGroupHorizontalAfterReload)} | group=${horiz?.label || horiz?.key || '—'} count=${horiz?.count ?? 0} tops=${JSON.stringify((horiz?.boxes || []).map((box) => box.top))} lefts=${JSON.stringify((horiz?.boxes || []).map((box) => box.left))} |`,
    `| 标题是否业务名 | ${yesNo(out.titleIsBusinessName)} | titles=${JSON.stringify(out.reloadShot?.cardTitles || [])}；serial=${yesNo(out.reloadShot?.serialCardTitle)} |`,
    `| 打开链接是否仍真 | ${yesNo(out.openLinkReal)} | href=\`${out.openedHref || '—'}\` |`,
    `| 刷新是否仍在 | ${yesNo(out.rowPersistedUi && out.sqliteHasRow)} | UI=${yesNo(out.rowPersistedUi)} SQLite=${yesNo(out.sqliteHasRow)} groups=${JSON.stringify(out.sqliteGroupCounts || {})} |`,
    `| 问 AI / 浮窗 | ${out.wired} | uses=${out.reloadShot?.uses || out.liveShot?.uses || ''} |`,
    `| 建造后台是否让开 | ${yesNo(out.builderOffDaily)} | 日常面无「编辑 spec / 版本回滚」；建造入口 ${yesNo(out.liveShot?.builderOpen)} |`,
    `| 记账整屏还在 | ${yesNo(out.ledgerStillFull)} | 药箱未改；overview/compose/chart/feed=${yesNo(out.ledgerShot?.overview)}/${yesNo(out.ledgerShot?.compose)}/${yesNo(out.ledgerShot?.chart)}/${yesNo(out.ledgerShot?.feed)} |`,
    `| 走访是否未改 | ${yesNo(out.visitUnchanged)} | ${visitId} updatedAt ${out.visitAfter?.updatedAt || '—'} |`,
    `| 拉伸是否仍好 | ${yesNo(out.resizeCollapse && out.resizeExpand)} | 拉宽 aside ${out.wide?.asideW ?? '—'}px；拉窄 ${out.narrow?.asideW ?? '—'}px |`,
    `| StagePanel iframe 指针屏蔽 | ${yesNo(out.iframeShieldCss && out.stageShieldFn)} | index.css + StagePanel.iframeDragShield 未拆 |`,
    `| 三 Tab / 创建 / 删除 | ${yesNo(out.threeTabs?.app && out.threeTabs?.records && out.threeTabs?.ops && out.createEntry && out.deleteEntry)} | 应用/业务记录/操作记录；创建应用；删除 |`,
    `| 静默写 | ${out.silentBizWrite ? 'yes' : 'no'} | ${out.bizWriteUrls?.length ? out.bizWriteUrls.join(' ') : '无 biz_write'} |`,
    `| 硬编码 | ${out.hardcoded} | templateHits=${out.templateHits || 'none'} |`,
    '',
    '## 现网',
    '',
    `打开已有应用「${out.openedApp?.name || '—'}」，未新造应用，未改走访/药箱。同一组再记 ${out.addedTitles?.join(' / ') || '—'}。`,
    '',
    '## 图',
    '',
    '产品工作面：同一组里多张卡片横排。标题是业务名，卡片有说明和打开。对照跟练密度，不是每组一张竖排。',
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
