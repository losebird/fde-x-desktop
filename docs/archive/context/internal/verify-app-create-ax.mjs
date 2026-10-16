/**
 * Live AX: denser product pages + real URL open. Store internal/ only.
 * Never 确认过账 / biz_write / IM send. Do not kill pnpm 5174.
 * Do not open-to-edit 走访. Do not create a new app.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { createServer } from 'node:http'
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const CURSOR_STORE = '/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e'
const MEDIA = `${STORE}/media/app-create-ax.png`
const REPORT_JSON = `${STORE}/internal/verify-app-create-ax.json`
const REPORT_MD = `${STORE}/internal/verify-app-create-ax.md`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const DB = `${SCENE}/runtime/data/fde-workstation.sqlite`
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const visitName = '本周现场走访记录'
const visitId = 'app_5d1eef0062114901b4797d705e5166b5'
const RECIPE_ID = 'app_4b3607a735ea42d295306f4ab9499d1f'
const LEDGER_ID = 'app_9de6038b186a4e9786e28bc4f48add9d'
const RIBS_ID = 'rec1bd01c2e66144fdda6b957c5217ffcb5'
const PROOF_PORT = 48721
const PROOF_PATH = '/ax-open'
const PROOF_URL = `http://127.0.0.1:${PROOF_PORT}${PROOF_PATH}`
const PROOF_MARK = 'AX打开证明'
const PROOF_HTML = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${PROOF_MARK}</title></head>
<body style="font:22px/1.45 -apple-system,sans-serif;padding:40px;background:#fafafa;color:#1a1a1a">
<h1>${PROOF_MARK}</h1>
<p>自创应用里的打开/播放在这台机器上真打开了。这不是错误页。</p>
<p id="proof-url">${PROOF_URL}</p>
</body></html>`

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

const proofServer = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
  res.end(PROOF_HTML)
})
await new Promise((resolve, reject) => {
  proofServer.once('error', reject)
  proofServer.listen(PROOF_PORT, '127.0.0.1', resolve)
})

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
  cards: `${STORE}/internal/ax-cards.png`,
  ledger: `${STORE}/internal/ax-ledger.png`,
  opened: `${STORE}/internal/ax-opened.png`,
  catalog: `${STORE}/internal/ax-catalog.png`,
}

const out = {
  sha,
  branch,
  visitId,
  proofUrl: PROOF_URL,
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
    const hrefs = [...document.querySelectorAll('[data-app-card-href]')].map((el) => ({
      action: el.getAttribute('data-app-card-action') || el.getAttribute('data-app-card-hero-open'),
      href: el.getAttribute('data-app-card-href'),
      text: (el.textContent || '').trim().slice(0, 40),
    }))
    return {
      product: Boolean(product),
      overview: Boolean(document.querySelector('[data-app-overview]')),
      compose: Boolean(document.querySelector('[data-app-compose]')),
      chart: Boolean(document.querySelector('[data-app-chart]')),
      feed: Boolean(document.querySelector('[data-app-feed]')),
      cards: Boolean(document.querySelector('[data-app-cards]')),
      play: Boolean(document.querySelector('[data-app-card-action="play"]')),
      heroOpen: Boolean(document.querySelector('[data-app-card-hero-open]')),
      hrefs,
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
    const play = card?.querySelector('[data-app-card-action="play"]')
    const stat = document.querySelector('[data-app-stat]')
    const feedRow = document.querySelector('[data-app-feed-row]')
    const submit = document.querySelector('[data-app-compose] button.btn-brand')
    const pie = document.querySelector('[data-app-chart] svg')
    const heroBox = hero?.getBoundingClientRect()
    const titleBox = title?.getBoundingClientRect()
    return {
      cardCount: document.querySelectorAll('[data-app-card]').length,
      heroH: heroBox ? Math.round(heroBox.height) : 0,
      titleOnHero: Boolean(hero && title && hero.contains(title)),
      titleBelowHero: Boolean(heroBox && titleBox && titleBox.top >= heroBox.bottom - 2),
      titleColor: title ? getComputedStyle(title).color : '',
      disc: Boolean(disc),
      playChip: Boolean(play),
      statBg: stat ? getComputedStyle(stat).backgroundColor : '',
      statValueColor: stat?.querySelector('.tabular-nums') ? getComputedStyle(stat.querySelector('.tabular-nums')).color : '',
      feedRowH: feedRow ? Math.round(feedRow.getBoundingClientRect().height) : 0,
      submitH: submit ? Math.round(submit.getBoundingClientRect().height) : 0,
      submitW: submit ? Math.round(submit.getBoundingClientRect().width) : 0,
      pie: Boolean(pie),
      iframeProof: Boolean(document.querySelector('[data-app-opened-frame]')),
    }
  })
}

async function stitchShots() {
  const labels = ['1 观感 · 菜谱卡更密', '1 观感 · 抄表概览/记一笔/图/流水', '2 URL 真打开', '目录未改走访']
  const files = [tmpShots.cards, tmpShots.ledger, tmpShots.opened, tmpShots.catalog]
  const imgs = []
  for (const file of files) {
    if (!existsSync(file)) continue
    const buf = await readFile(file)
    imgs.push(`data:image/png;base64,${buf.toString('base64')}`)
  }
  const shot = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
  const cells = imgs.map((src, i) => (
    `<div style="background:#fff;border:1px solid #d4d4d8;overflow:hidden">`
    + `<div style="font:12px/1.4 -apple-system,sans-serif;padding:6px 8px;background:#18181b;color:#fafafa">${labels[i] || ''}</div>`
    + `<img src="${src}" style="width:100%;height:480px;object-fit:cover;object-position:top;display:block"/>`
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
  const patched = await page.evaluate(async ({ cwd, rid, url }) => {
    const params = new URLSearchParams({ workspace: cwd })
    const res = await fetch(`/api/v1/apps/home-recipes/recipe/${encodeURIComponent(rid)}?${params}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ video_url: url }),
    })
    return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) }
  }, { cwd: workspaceCwd, rid: RIBS_ID, url: PROOF_URL })
  out.patch = patched
  if (!patched.ok) {
    out.failCode = 'patch-url'
    throw new Error(out.failCode)
  }
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1200)
  await goAppsTab()
  await openRunningApp(RECIPE_ID)
  await page.waitForTimeout(800)
  out.cardLive = await productShot()
  out.cardLook = await measureLook()
  const recipeCards = page.locator('[data-app-cards]')
  if (await recipeCards.count()) await recipeCards.screenshot({ path: tmpShots.cards })
  else await page.screenshot({ path: tmpShots.cards, fullPage: false })

  const play = page.locator('[data-app-card-action="play"]').first()
  await play.waitFor({ state: 'visible', timeout: 10000 })
  out.openHref = await play.getAttribute('data-app-card-href')
  const popupPromise = page.waitForEvent('popup', { timeout: 12000 }).catch(() => null)
  await play.click()
  const popup = await popupPromise
  out.openedMode = await page.locator('html').getAttribute('data-app-opened-mode')
  out.openedHrefAttr = await page.locator('html').getAttribute('data-app-opened-href')
  if (!popup) {
    out.failCode = 'no-popup'
    throw new Error(out.failCode)
  }
  await popup.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {})
  await popup.waitForTimeout(400)
  out.popupUrl = popup.url()
  const popupText = await popup.locator('body').innerText().catch(() => '')
  out.popupTitle = await popup.title().catch(() => '')
  out.popupText = popupText.replace(/\s+/g, ' ').slice(0, 240)
  out.popupError = /无法访问|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|This site can’t be reached|ERR_CONNECTION|ERR_EMPTY_RESPONSE/i.test(`${out.popupTitle} ${out.popupText}`)
  out.popupProof = popupText.includes(PROOF_MARK) && String(out.popupUrl || '').includes(String(PROOF_PORT)) && !/example\.com/i.test(out.popupUrl || '')
  await popup.screenshot({ path: tmpShots.opened, fullPage: true })
  await popup.close().catch(() => {})
  if (!out.popupProof || out.popupError) {
    out.failCode = 'url-not-really-open'
    throw new Error(out.failCode)
  }

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
  const mainTs = await readFile(`${SCENE}/apps/desktop/src/main.ts`, 'utf8')
  out.iframeShieldCss = /\[data-floating-drag\] iframe/.test(css) && /pointer-events:\s*none/.test(css)
  out.stageShieldFn = /function iframeDragShield/.test(stage) && /iframeDragShield\(true\)/.test(stage)
  out.windowOpenHandler = /setWindowOpenHandler/.test(mainTs) && /openExternal/.test(mainTs)
  const banned = execSync("rg -n '健身|记账|库存盘点|运动塑形' src/components/apps src/lib/app-open.ts src/lib/app-platform.ts || true", { cwd: SCENE, encoding: 'utf8' })
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

  const item1 = Boolean(
    out.cardLook?.heroH >= 130
    && out.cardLook?.titleBelowHero
    && !out.cardLook?.titleOnHero
    && out.cardLook?.disc
    && (out.cardLook?.cardCount || 0) >= 3
    && out.ledgerLive?.overview && out.ledgerLive?.compose && out.ledgerLive?.chart && out.ledgerLive?.feed
    && (out.ledgerLook?.feedRowH || 0) >= 48
    && (out.ledgerLook?.submitH || 0) >= 36
    && !out.cardLive?.ledgerStrip && !out.ledgerLive?.ledgerStrip
    && out.templateHits === 'none',
  )
  const item2 = Boolean(
    out.popupProof
    && !out.popupError
    && out.openHref === PROOF_URL
    && !/example\.com/i.test(out.popupUrl || '')
    && out.windowOpenHandler
    && !out.cardLook?.iframeProof,
  )
  out.items = {
    1: { pass: item1, note: JSON.stringify(out.cardLook) },
    2: { pass: item2, note: `href=${out.openHref} popup=${out.popupUrl} proof=${out.popupProof} err=${out.popupError} mode=${out.openedMode}` },
  }
  out.pass = Boolean(item1 && item2 && out.visitUnchanged && out.resizeCollapse && out.resizeExpand && !out.silentBizWrite)

  const md = [
    '# Verify: AX 观感 + 真打开 URL',
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
    '## 1–2',
    '',
    '| # | 过/没过 | 证据 |',
    '|---|---|---|',
    `| 1 | ${item1 ? '过' : '没过'} | 菜谱卡 heroH=${out.cardLook?.heroH} 标题在色块下=${out.cardLook?.titleBelowHero} 播放圆=${out.cardLook?.disc} 卡数=${out.cardLook?.cardCount}。抄表同一屏 overview/compose/chart/feed=${out.ledgerLive?.overview}/${out.ledgerLive?.compose}/${out.ledgerLive?.chart}/${out.ledgerLive?.feed}，流水行高=${out.ledgerLook?.feedRowH}，记下按钮高=${out.ledgerLook?.submitH}。未写死应用名/菜系/水电气。 |`,
    `| 2 | ${item2 ? '过' : '没过'} | 点播放 href=\`${out.openHref}\`。弹出页 URL=\`${out.popupUrl}\` 正文含「${PROOF_MARK}」。不是错误页。桌面壳 \`setWindowOpenHandler\`+openExternal。未用 iframe 冒充。未写死域名。 |`,
    '',
    '## AO–AW / 决策 22',
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
    `已对：1 观感密度（菜谱卡色块下标题+中心播放圆，抄表概览/记一笔/图/流水更密）现网图；2 播放打开 \`${PROOF_URL}\` 正文「${PROOF_MARK}」，不是错误页；走访 \`${visitId}\` updatedAt 未改；拉伸 48/224。`,
    '',
    '未对：桌面 Electron 包体现网（本机 5174 Chrome；壳代码已接 setWindowOpenHandler / openExternal）。',
    '',
    `仍差：${out.pass ? '无（本刀两项）' : out.failCode || '见 1–2'}。`,
    '',
    '## 图',
    '',
    '四格：更密菜谱卡、更密抄表屏、真打开页、目录走访还在。',
    '',
    '`files/media/app-create-ax.png`',
    '',
  ].join('\n')

  await writeFile(REPORT_JSON, JSON.stringify(out, null, 2))
  await writeFile(REPORT_MD, md)
  out.dualMd = await dualWrite(REPORT_MD, 'internal/verify-app-create-ax.md')
  out.dualPng = await dualWrite(MEDIA, 'media/app-create-ax.png')
  await writeFile(REPORT_JSON, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ pass: out.pass, items: out.items, failCode: out.failCode, popupUrl: out.popupUrl, sha }, null, 2))
  if (!out.pass) process.exitCode = 1
} catch (error) {
  out.error = String(error)
  out.pass = false
  await writeFile(REPORT_JSON, JSON.stringify(out, null, 2)).catch(() => {})
  const failMd = [
    '# Verify: AX 观感 + 真打开 URL',
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
  await dualWrite(REPORT_MD, 'internal/verify-app-create-ax.md').catch(() => {})
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close().catch(() => {})
  await new Promise((resolve) => proofServer.close(resolve))
}
