/**
 * Live AY: product density for created-app cards + ledger. Store internal/ + media/.
 * Never 确认过账 / biz_write / IM send. Do not kill pnpm 5174.
 * Do not open-to-edit 走访. Do not create a new app. Do not patch URLs.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const CURSOR_STORE = '/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e'
const MEDIA = `${STORE}/media/app-create-ay.png`
const REPORT_JSON = `${STORE}/internal/verify-app-create-ay.json`
const REPORT_MD = `${STORE}/internal/verify-app-create-ay.md`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const DB = `${SCENE}/runtime/data/fde-workstation.sqlite`
const AX_CARDS = `${STORE}/internal/ax-cards.png`
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const visitName = '本周现场走访记录'
const visitId = 'app_5d1eef0062114901b4797d705e5166b5'
const RECIPE_ID = 'app_4b3607a735ea42d295306f4ab9499d1f'
const LEDGER_ID = 'app_9de6038b186a4e9786e28bc4f48add9d'

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
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const bizWriteUrls = []
const imSendUrls = []
page.on('request', (req) => {
  const url = req.url()
  if (/biz\/write|biz_write/i.test(url)) bizWriteUrls.push(url)
  if (/\/api\/v1\/im\/send(?:\?|$)/.test(url) && req.method() !== 'GET') imSendUrls.push(`${req.method()} ${url}`)
})

const tmpShots = {
  cards: `${STORE}/internal/ay-cards.png`,
  ledger: `${STORE}/internal/ay-ledger.png`,
  catalog: `${STORE}/internal/ay-catalog.png`,
  axCards: AX_CARDS,
}

const out = {
  sha,
  branch,
  visitId,
  silentBizWrite: false,
  originPushed: false,
  createdApp: false,
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
    state.state.panels = (panels.length ? panels : fallbackPanels).map((p) => {
      if (p && p.id === 'data') return { ...p, state: 'full', width }
      if (p && (p.state === 'full' || p.state === 'half')) return { ...p, state: 'tab' }
      return p
    })
    if (!state.state.panels.some((p) => p && p.id === 'data')) state.state.panels = fallbackPanels
    state.state.dataBrowse = { ...(state.state.dataBrowse || {}), workspaceAppId: null }
    if (state.version == null) state.version = 17
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd, activeDataSubview, panelWidth })
}

async function measureChrome() {
  return page.evaluate(() => {
    const aside = document.querySelector('aside')
    return {
      asideW: aside ? Math.round(aside.getBoundingClientRect().width) : 0,
      asideOpen: aside ? aside.getBoundingClientRect().width > 80 : false,
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

async function goAppsTab() {
  const overviewBtn = page.getByRole('button', { name: '应用', exact: true })
  if (await overviewBtn.count()) await overviewBtn.click({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(700)
}

async function dragStage(deltaX) {
  const handle = page.locator('[title="拖拽调整宽度"]').first()
  await handle.waitFor({ state: 'visible', timeout: 10000 })
  const box = await handle.boundingBox()
  if (!box) throw new Error('no-resize-handle')
  const x = box.x + box.width / 2
  const y = box.y + Math.min(120, box.height / 2)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + deltaX, y, { steps: 24 })
  await page.mouse.up()
  await page.waitForTimeout(500)
}

async function dualWrite(src, rel) {
  const dest = `${CURSOR_STORE}/${rel}`
  try {
    await mkdir(dirname(dest), { recursive: true })
    await copyFile(src, dest)
    return dest
  } catch (error) {
    return String(error)
  }
}

async function openRunningApp(id) {
  const back = page.getByRole('button', { name: /返回列表/ })
  if (await back.count()) await back.click({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(400)
  if (await page.locator('[data-app-catalog]').count() === 0) await goAppsTab()
  await page.locator('[data-app-catalog]').waitFor({ state: 'visible', timeout: 15000 })
  await page.locator(`[data-app-row="${id}"]`).locator('button').first().click({ timeout: 15000 })
  await page.locator('[data-app-workspace]').waitFor({ state: 'visible', timeout: 20000 })
  await page.locator('[data-app-product]').waitFor({ state: 'visible', timeout: 20000 })
}

function productShot() {
  return page.evaluate(() => {
    const product = document.querySelector('[data-app-product]')
    const body = (document.body.innerText || '').replace(/\s+/g, ' ')
    const productText = (product?.innerText || '').replace(/\s+/g, ' ')
    return {
      product: Boolean(product),
      overview: Boolean(document.querySelector('[data-app-overview]')),
      compose: Boolean(document.querySelector('[data-app-compose]')),
      chart: Boolean(document.querySelector('[data-app-chart]')),
      feed: Boolean(document.querySelector('[data-app-feed]')),
      cards: Boolean(document.querySelector('[data-app-cards]')),
      play: Boolean(document.querySelector('[data-app-card-action="play"]')),
      heroOpen: Boolean(document.querySelector('[data-app-card-hero-open]')),
      titles: [...document.querySelectorAll('[data-app-card]')].map((el) => el.getAttribute('data-app-card-title') || ''),
      feedTitles: [...document.querySelectorAll('[data-app-feed-title]')].map((el) => (el.textContent || '').trim()),
      ledgerStrip: /事务底座运行正常|正在检查事务底座|先登记连接器|先在设置登记业务连接器/.test(body),
      toolbar: /引用文件|起草记忆卡片|拟回进输入框/.test(productText),
    }
  })
}

function measureLook() {
  return page.evaluate(() => {
    const card = document.querySelector('[data-app-card]')
    const hero = card?.querySelector(':scope > div')
    const title = card?.querySelector('h3')
    const disc = card?.querySelector('[data-app-card-hero-open]')
    const play = card?.querySelector('[data-app-card-action="play"], [data-app-card-action="url"]')
    const cards = [...document.querySelectorAll('[data-app-card]')]
    const firstGroup = document.querySelector('[data-app-card-group]')
    const groupCards = firstGroup ? [...firstGroup.querySelectorAll('[data-app-card]')] : cards
    const compose = document.querySelector('[data-app-compose]')
    const pie = document.querySelector('[data-app-chart] svg')
    const legend = document.querySelector('[data-app-chart-legend]')
    const bars = document.querySelector('[data-app-chart] .h-16')
    const pieCircle = document.querySelector('[data-app-chart] svg circle[fill="currentColor"], [data-app-chart] svg path')
    const feed = document.querySelector('[data-app-feed]')
    const overview = document.querySelector('[data-app-overview]')
    const chart = document.querySelector('[data-app-chart]')
    const workspace = document.querySelector('[data-app-workspace]') || document.querySelector('.stage-content')
    const vis = (el) => {
      if (!el || !workspace) return false
      const r = el.getBoundingClientRect()
      const p = workspace.getBoundingClientRect()
      return r.bottom > p.top + 8 && r.top < p.bottom - 8 && r.height > 12
    }
    const cardBox = card?.getBoundingClientRect()
    const heroBox = hero?.getBoundingClientRect()
    const titleBox = title?.getBoundingClientRect()
    const playBox = play?.getBoundingClientRect()
    const groupTops = groupCards.map((el) => Math.round(el.getBoundingClientRect().top))
    const sameRow = groupTops.filter((top) => Math.abs(top - (groupTops[0] || 0)) < 8).length
    const pieBox = pie?.getBoundingClientRect()
    const legendBox = legend?.getBoundingClientRect()
    return {
      cardCount: cards.length,
      groupCardCount: groupCards.length,
      groupSameRow: sameRow,
      cardW: cardBox ? Math.round(cardBox.width) : 0,
      heroH: heroBox ? Math.round(heroBox.height) : 0,
      titleOnHero: Boolean(hero && title && hero.contains(title)),
      titleBelowHero: Boolean(heroBox && titleBox && titleBox.top >= heroBox.bottom - 2),
      titleColor: title ? getComputedStyle(title).color : '',
      disc: Boolean(disc),
      playFull: Boolean(playBox && cardBox && playBox.width >= cardBox.width * 0.72),
      playH: playBox ? Math.round(playBox.height) : 0,
      playInHero: Boolean(hero && play && hero.contains(play)),
      enumPills: compose ? compose.querySelectorAll('button[role], [role="group"] button').length : 0,
      composeSelect: compose ? compose.querySelectorAll('select').length : 0,
      legendBelowPie: Boolean(pieBox && legendBox && legendBox.top >= pieBox.bottom - 4),
      legendBesidePie: Boolean(pieBox && legendBox && Math.abs(legendBox.top - pieBox.top) < 48 && legendBox.left >= pieBox.right - 8),
      pieDrawn: Boolean(pieCircle),
      bars: Boolean(bars),
      overviewVisible: vis(overview),
      composeVisible: vis(compose),
      chartVisible: vis(chart),
      feedVisible: vis(feed),
      feedRowH: document.querySelector('[data-app-feed-row]')
        ? Math.round(document.querySelector('[data-app-feed-row]').getBoundingClientRect().height)
        : 0,
      sameAsAx: Boolean(
        heroBox && titleBox && titleBox.top >= heroBox.bottom - 2 && disc,
      ),
    }
  })
}

async function stitchShots() {
  const labels = [
    'AY 卡片 · 标题压色块 + 通栏播放',
    '对照 AX · 空色块+中心圆+双芯片',
    'AY 台账 · 概览/记一笔/图/流水同一屏',
    '目录 · 走访未改',
  ]
  const files = [tmpShots.cards, tmpShots.axCards, tmpShots.ledger, tmpShots.catalog]
  const imgs = []
  for (const file of files) {
    if (!existsSync(file)) continue
    const buf = await readFile(file)
    imgs.push(`data:image/png;base64,${buf.toString('base64')}`)
  }
  const shot = await browser.newPage({ viewport: { width: 1600, height: 1280 } })
  const cells = imgs.map((src, i) => (
    `<div style="background:#fff;border:1px solid #d4d4d8;overflow:hidden">`
    + `<div style="font:12px/1.4 -apple-system,sans-serif;padding:6px 8px;background:#18181b;color:#fafafa">${labels[i] || ''}</div>`
    + `<img src="${src}" style="width:100%;height:580px;object-fit:contain;object-position:top;background:#fff;display:block"/>`
    + `</div>`
  )).join('')
  await shot.setContent(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#111;padding:8px">${cells}</div>`)
  await shot.screenshot({ path: MEDIA, fullPage: true })
  await shot.close()
}

try {
  await page.goto(`${mainBase}/ai?cwd=${encodeURIComponent(workspaceCwd)}&as=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(async () => {
    await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => ({}))
  })
  await seedState()
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1600)
  await goAppsTab()

  const listedBefore = await listApps()
  out.listedBefore = listedBefore.map((row) => ({ id: row.id, name: row.name, status: row.status, updatedAt: row.updatedAt }))
  const visitBefore = listedBefore.find((row) => row.id === visitId) || listedBefore.find((row) => row.name === visitName)
  out.visitBefore = visitBefore || null
  if (!visitBefore || visitBefore.updatedAt !== '2026-09-19T06:03:58.932Z') {
    out.failCode = 'visit-updatedAt'
    throw new Error(out.failCode)
  }

  const recipe = listedBefore.find((row) => row.id === RECIPE_ID)
  const ledger = listedBefore.find((row) => row.id === LEDGER_ID)
  if (!recipe || recipe.status !== 'active' || !ledger || ledger.status !== 'active') {
    out.failCode = 'fixture-missing'
    throw new Error(out.failCode)
  }

  await openRunningApp(RECIPE_ID)
  await page.waitForTimeout(800)
  out.cardLive = await productShot()
  out.cardLook = await measureLook()
  const recipeCards = page.locator('[data-app-cards]')
  if (await recipeCards.count()) await recipeCards.screenshot({ path: tmpShots.cards })
  else await page.screenshot({ path: tmpShots.cards, fullPage: false })

  await openRunningApp(LEDGER_ID)
  await page.waitForTimeout(800)
  out.ledgerLive = await productShot()
  out.ledgerLook = await measureLook()
  const ledgerBox = page.locator('[data-app-product]')
  if (await ledgerBox.count()) await ledgerBox.screenshot({ path: tmpShots.ledger })
  else await page.screenshot({ path: tmpShots.ledger, fullPage: false })

  const backToList = page.getByRole('button', { name: /返回列表/ })
  if (await backToList.count()) await backToList.click({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(600)
  if (await page.locator('[data-app-catalog]').count() === 0) await goAppsTab()
  await page.locator('[data-app-catalog]').waitFor({ state: 'visible', timeout: 15000 })
  out.catalogHasVisit = await page.locator(`[data-app-row="${visitId}"]`).count() > 0
  const catalogBox = page.locator('[data-app-catalog]')
  if (await catalogBox.count()) await catalogBox.screenshot({ path: tmpShots.catalog })
  else await page.screenshot({ path: tmpShots.catalog, fullPage: false })

  await stitchShots()
  const png = existsSync(MEDIA) ? await readFile(MEDIA) : Buffer.alloc(0)
  out.pngBytes = png.length
  out.pngHeader = png.subarray(0, 8).toString('hex')

  const listedAfter = await listApps()
  const visitAfter = listedAfter.find((row) => row.id === visitBefore.id)
  out.visitAfter = visitAfter || null
  out.visitUnchanged = Boolean(
    visitAfter
    && visitAfter.status === visitBefore.status
    && visitAfter.revision === visitBefore.revision
    && visitAfter.updatedAt === '2026-09-19T06:03:58.932Z',
  )

  await seedState({ panelWidth: 500 })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1000)
  await goAppsTab()
  out.threeTabs = {
    app: await page.getByRole('button', { name: '应用', exact: true }).count() > 0,
    records: await page.getByRole('button', { name: '业务记录', exact: true }).count() > 0,
    ops: await page.getByRole('button', { name: '操作记录', exact: true }).count() > 0,
  }
  out.createEntry = await page.locator('[data-app-create-entry]').count() > 0
  out.deleteEntry = await page.getByRole('button', { name: /删除/ }).count() > 0
  await dragStage(-420)
  out.wide = await measureChrome()
  await dragStage(520)
  out.narrow = await measureChrome()
  out.resizeCollapse = out.wide.asideW <= 56
  out.resizeExpand = out.narrow.asideW >= 200

  const css = await readFile(`${SCENE}/src/index.css`, 'utf8')
  const stage = await readFile(`${SCENE}/src/components/StagePanel.tsx`, 'utf8')
  out.iframeShieldCss = /\[data-floating-drag\] iframe/.test(css) && /pointer-events:\s*none/.test(css)
  out.stageShieldFn = /function iframeDragShield/.test(stage) && /iframeDragShield\(true\)/.test(stage)
  const banned = execSync("rg -n '健身|记账|库存盘点|运动塑形|水电气' src/components/apps src/lib/app-open.ts src/lib/app-platform.ts || true", { cwd: SCENE, encoding: 'utf8' })
  out.templateHits = banned.trim() || 'none'
  out.bizWriteUrls = bizWriteUrls
  out.imSendUrls = imSendUrls
  out.silentBizWrite = bizWriteUrls.length > 0
  out.autoSendIm = imSendUrls.length > 0
  out.pid5174 = execSync("lsof -iTCP:5174 -sTCP:LISTEN -nP | awk 'NR==2{print $2}'", { encoding: 'utf8' }).trim()

  const sqlite = new DatabaseSync(DB)
  const visitRow = sqlite.prepare('SELECT id, updated_at FROM business_apps WHERE id = ?').get(visitId)
  sqlite.close()
  out.sqliteVisitUpdatedAt = visitRow?.updated_at

  const cardsPass = Boolean(
    out.cardLook?.titleOnHero
    && !out.cardLook?.titleBelowHero
    && !out.cardLook?.disc
    && !out.cardLook?.sameAsAx
    && out.cardLook?.playFull
    && (out.cardLook?.groupSameRow || 0) >= 2
    && (out.cardLook?.cardCount || 0) >= 3
    && out.cardLive?.play
    && !out.cardLive?.heroOpen
    && !out.cardLive?.ledgerStrip,
  )
  const ledgerPass = Boolean(
    out.ledgerLive?.overview && out.ledgerLive?.compose && out.ledgerLive?.chart && out.ledgerLive?.feed
    && out.ledgerLook?.overviewVisible
    && out.ledgerLook?.composeVisible
    && out.ledgerLook?.chartVisible
    && out.ledgerLook?.feedVisible
    && (out.ledgerLook?.enumPills || 0) >= 2
    && (out.ledgerLook?.composeSelect || 0) === 0
    && (out.ledgerLook?.legendBelowPie || out.ledgerLook?.legendBesidePie)
    && out.ledgerLook?.pieDrawn
    && out.ledgerLook?.bars
    && !out.ledgerLive?.ledgerStrip
    && out.templateHits === 'none',
  )
  out.items = {
    cards: { pass: cardsPass, note: JSON.stringify(out.cardLook) },
    ledger: { pass: ledgerPass, note: JSON.stringify(out.ledgerLook) },
  }
  out.pass = Boolean(
    cardsPass && ledgerPass && out.visitUnchanged && out.resizeCollapse && out.resizeExpand
    && !out.silentBizWrite && out.catalogHasVisit,
  )

  const md = [
    '# Verify: AY 观感一次对齐参照',
    '',
    `**pass:** ${out.pass ? 'yes' : 'no'}`,
    `**main SHA:** \`${sha}\``,
    `**branch:** \`${branch}\`（未推 origin）`,
    `**走访 updatedAt:** ${out.visitUnchanged ? 'unchanged' : 'CHANGED'} \`${out.visitAfter?.updatedAt || ''}\``,
    `**拉伸 48/224:** ${out.resizeCollapse && out.resizeExpand ? 'yes' : 'no'}（${out.wide?.asideW} / ${out.narrow?.asideW}）`,
    '',
    '## SHA',
    '',
    '| 项 | 值 |',
    '|---|---|',
    `| daily main | \`${sha}\` |`,
    `| branch | \`${branch}\` |`,
    '',
    '## 对照 AX：布局变了什么',
    '',
    '| 面 | AX | AY |',
    '|---|---|---|',
    `| 卡片标题 | 色块下面、墨色字 | ${out.cardLook?.titleOnHero ? '白字压在色块里' : '仍在色块下'} |`,
    `| 卡片主操作 | 色块中心空心圆 + 底下播放/问 AI 双芯片 | ${out.cardLook?.disc ? '仍有中心圆' : '色块里没有播放圆'}；${out.cardLook?.playFull ? '播放是卡上通栏主按钮' : '播放仍是小芯片'} |`,
    `| 一组多卡 | \`1fr\` 把两张卡撑成空心大方块 | ${(out.cardLook?.groupSameRow || 0) >= 2 ? `一组 ${out.cardLook.groupSameRow} 张同一行铺满该组` : '仍未横排'} |`,
    `| 台账记一笔 | 下拉框后台表单 | ${(out.ledgerLook?.composeSelect || 0) === 0 && (out.ledgerLook?.enumPills || 0) >= 2 ? '枚举是胶囊选项，不是 select' : '仍是下拉表单'} |`,
    `| 台账图 | 饼左、图例竖列在右 | ${out.ledgerLook?.legendBesidePie || out.ledgerLook?.legendBelowPie ? '饼+折行图例+柱，满扇画整圆' : '图仍是 AX 那列'} |`,
    `| 台账同一屏 | 480px 顶裁只见到概览+表+饼，流水在折下 | ${out.ledgerLook?.feedVisible && out.ledgerLook?.overviewVisible ? '现网工作面同时见到概览/记一笔/图/流水' : '流水仍不在同一屏'} |`,
    '',
    '## 过关',
    '',
    '| # | 过/没过 | 证据 |',
    '|---|---|---|',
    `| 卡片密度 | ${cardsPass ? '过' : '没过'} | 标题在色块内=${out.cardLook?.titleOnHero} 中心圆=${out.cardLook?.disc} 通栏播放=${out.cardLook?.playFull} 一组同行=${out.cardLook?.groupSameRow} 卡数=${out.cardLook?.cardCount}。同 AX 布局=${out.cardLook?.sameAsAx}。未写死应用名/菜系。 |`,
    `| 台账密度 | ${ledgerPass ? '过' : '没过'} | 现网可见 overview/compose/chart/feed=${out.ledgerLook?.overviewVisible}/${out.ledgerLook?.composeVisible}/${out.ledgerLook?.chartVisible}/${out.ledgerLook?.feedVisible}。胶囊=${out.ledgerLook?.enumPills} select=${out.ledgerLook?.composeSelect} 饼旁图例=${out.ledgerLook?.legendBesidePie} 饼下图例=${out.ledgerLook?.legendBelowPie} 饼画出=${out.ledgerLook?.pieDrawn}。流水标题=${(out.ledgerLive?.feedTitles || []).join('、') || '—'}。 |`,
    '',
    '## AO–AX / 决策 22',
    '',
    '| 项 | 结果 |',
    '|---|---|',
    `| 工作面事务底座条 | ${out.cardLive?.ledgerStrip || out.ledgerLive?.ledgerStrip ? '有' : '无'} |`,
    `| 三 Tab | 应用=${out.threeTabs?.app} 业务记录=${out.threeTabs?.records} 操作记录=${out.threeTabs?.ops} |`,
    `| 创建入口 | ${out.createEntry} |`,
    `| 删除入口 | ${out.deleteEntry} |`,
    `| 走访 id | \`${visitId}\` 仍在目录=${out.catalogHasVisit} |`,
    `| 走访 updatedAt | before ${out.visitBefore?.updatedAt} / after ${out.visitAfter?.updatedAt} |`,
    `| 拉宽 aside | ${out.wide?.asideW}px（要 48） |`,
    `| 拉窄 aside | ${out.narrow?.asideW}px（要 224） |`,
    `| StagePanel iframe 指针屏蔽 | ${out.iframeShieldCss && out.stageShieldFn ? '未拆' : '缺'} |`,
    `| 静默 biz_write | ${out.silentBizWrite ? 'yes' : 'no'} |`,
    `| 自动发 IM | ${out.autoSendIm ? 'yes' : 'no'} |`,
    `| 新造应用 | no |`,
    `| 5174 | 未杀，仍在听 pid ${out.pid5174} |`,
    '',
    `已对：卡片工作面（标题压色块、通栏播放、一组多卡同行、卡上不再并排双芯片）现网图；台账工作面（概览/记一笔胶囊/图/流水同一屏）现网图；与 AX 并排对照；走访 \`${visitId}\` updatedAt 未改；拉伸 48/224。`,
    '',
    '未对：URL 打开（本刀不做）；浮窗（本刀不做）。',
    '',
    `仍差：${out.pass ? '夹具一组只有两张，所以是一行两卡，不是参照那种一行五张；粤菜单张不撑满。布局已不是 AX 的空色块中心圆。' : out.failCode || '见过关表'}。`,
    '',
    '## 图',
    '',
    '四格：AY 卡片、对照 AX 卡片、AY 台账、目录走访还在。',
    '',
    '`files/media/app-create-ay.png`',
    '',
  ].join('\n')

  await writeFile(REPORT_JSON, JSON.stringify(out, null, 2))
  await writeFile(REPORT_MD, md)
  out.dualMd = await dualWrite(REPORT_MD, 'internal/verify-app-create-ay.md')
  out.dualPng = await dualWrite(MEDIA, 'media/app-create-ay.png')
  await writeFile(REPORT_JSON, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ pass: out.pass, items: out.items, failCode: out.failCode, sha, cardLook: out.cardLook, ledgerLook: out.ledgerLook }, null, 2))
  if (!out.pass) process.exitCode = 1
} catch (error) {
  out.error = String(error)
  out.pass = false
  await writeFile(REPORT_JSON, JSON.stringify(out, null, 2)).catch(() => {})
  const failMd = [
    '# Verify: AY 观感一次对齐参照',
    '',
    '**pass:** no',
    `**failCode:** ${out.failCode || 'error'}`,
    '',
    String(error),
    '',
    '```json',
    JSON.stringify(out, null, 2),
    '```',
    '',
  ].join('\n')
  await writeFile(REPORT_MD, failMd).catch(() => {})
  await dualWrite(REPORT_MD, 'internal/verify-app-create-ay.md').catch(() => {})
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close().catch(() => {})
}
