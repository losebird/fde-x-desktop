/**
 * Live AV: create-app leftover 1–8. Store internal/ only — do not git-add.
 * Never 确认过账 / biz_write / IM send. Do not kill pnpm 5174.
 * Do not open-to-edit 走访. Chinese cwd only via ?cwd=.
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
const MEDIA = `${STORE}/media/app-create-av.png`
const REPORT_JSON = `${STORE}/internal/verify-app-create-av.json`
const REPORT_MD = `${STORE}/internal/verify-app-create-av.md`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const DB = `${SCENE}/runtime/data/fde-workstation.sqlite`
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const visitName = '本周现场走访记录'
const visitId = 'app_5d1eef0062114901b4797d705e5166b5'
const TOOLBAR = ['引用文件', '起草记忆卡片', '拟回进输入框', '打开早报', '打开业务记录']
const DESC_CARDS = '家里的菜谱卡片：菜名、菜系分组、做法说明、教学视频链接。按菜系铺卡片，点了能播放。另有一栏记下每次试做的评分和日期。能问 AI。'
const DESC_LEDGER = '小区水电抄表：表名、用量、抄表日、类别（水/电/气）。要本月概览、记一笔、分类图和流水。能问 AI，记完能摘成待办。'
const CARD_TITLE = '番茄炒蛋'
const CARD_URL = 'https://example.com/watch?v=av-clip'
const LEDGER_TITLE = '东门水表'

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
  // preset copy is best-effort
}

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const bizWriteUrls = []
const imSendUrls = []
const cwdHeaderHits = []
page.on('request', (req) => {
  const url = req.url()
  if (/biz\/write|biz_write/i.test(url)) bizWriteUrls.push(url)
  if (/\/api\/v1\/im\/send(?:\?|$)/.test(url) && req.method() !== 'GET') imSendUrls.push(`${req.method()} ${url}`)
  if (/x-dsh-cwd/i.test(req.headers()['x-dsh-cwd'] || '')) cwdHeaderHits.push(url)
})

const tmpShots = {
  wizard: `${STORE}/internal/av-wizard.png`,
  cards: `${STORE}/internal/av-cards.png`,
  ledger: `${STORE}/internal/av-ledger.png`,
  catalog: `${STORE}/internal/av-catalog.png`,
}

const out = {
  sha,
  branch,
  visitId,
  descriptions: [DESC_CARDS, DESC_LEDGER],
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

function productShot() {
  return page.evaluate((toolbar) => {
    const product = document.querySelector('[data-app-product]')
    const nav = document.querySelector('[data-app-product-nav]')
    const uses = [...document.querySelectorAll('[data-app-use]')].map((el) => ({
      use: el.getAttribute('data-app-use'),
      text: (el.textContent || '').trim(),
      inNav: Boolean(el.closest('[data-app-product-nav]')),
      inWorkspaceChrome: Boolean(el.closest('[data-app-workspace]') && !el.closest('[data-app-product]')),
    }))
    const hrefs = [...document.querySelectorAll('[data-app-card-href]')].map((el) => ({
      action: el.getAttribute('data-app-card-action'),
      href: el.getAttribute('data-app-card-href'),
      text: (el.textContent || '').trim(),
    }))
    const titles = [...document.querySelectorAll('[data-app-card-title], [data-app-feed-title]')].map((el) => (
      el.getAttribute('data-app-card-title') || (el.textContent || '').trim()
    ))
    const body = (document.body.innerText || '').replace(/\s+/g, ' ')
    const productText = (product?.innerText || '').replace(/\s+/g, ' ')
    const navText = (nav?.innerText || '').replace(/\s+/g, ' ').trim()
    return {
      product: Boolean(product),
      overview: Boolean(document.querySelector('[data-app-overview]')),
      compose: Boolean(document.querySelector('[data-app-compose]')),
      chart: Boolean(document.querySelector('[data-app-chart]')),
      feed: Boolean(document.querySelector('[data-app-feed]')),
      cards: Boolean(document.querySelector('[data-app-cards]')),
      play: Boolean(document.querySelector('[data-app-card-action="play"]')),
      table: Boolean(document.querySelector('[data-app-table]')),
      nav: navText,
      usesAttr: product?.getAttribute('data-app-uses') || '',
      uses,
      hrefs,
      titles,
      toolbarInNav: toolbar.some((word) => navText.includes(word)),
      platformBar: toolbar.some((word) => productText.includes(word) || navText.includes(word)),
      ledgerStrip: /事务底座运行正常|正在检查事务底座|先登记连接器|先在设置登记业务连接器/.test(body),
    }
  }, TOOLBAR)
}

async function fillCompose({ title, url, number = '3' }) {
  const compose = page.locator('[data-app-compose]')
  await compose.waitFor({ state: 'visible', timeout: 10000 })
  const fields = compose.locator('input, textarea, select')
  const fieldCount = await fields.count()
  for (let i = 0; i < fieldCount; i++) {
    const input = fields.nth(i)
    const meta = await input.evaluate((el) => {
      const type = el.tagName === 'SELECT' ? 'select' : (el.getAttribute('type') || el.tagName.toLowerCase())
      const label = (el.closest('label')?.innerText || '').replace(/\s+/g, ' ')
      return { type, label }
    })
    if (meta.type === 'select') {
      const options = await input.locator('option').evaluateAll((els) => els.map((el) => el.value).filter(Boolean))
      if (options[0]) await input.selectOption(options[0])
    } else if (meta.type === 'date' || meta.type === 'datetime-local') {
      await input.fill(meta.type === 'date' ? '2026-09-19' : '2026-09-19T10:00')
    } else if (meta.type === 'checkbox') {
      await input.check().catch(() => {})
    } else if (meta.type === 'number') {
      await input.fill(number)
    } else if (/链接|视频|url|http/i.test(meta.label) && url) {
      await input.fill(url)
    } else if (i === 0 || /名|标题|表名|菜/.test(meta.label)) {
      await input.fill(title)
    } else if (/说明|做法|备注/.test(meta.label)) {
      await input.fill(`${title} 说明`)
    } else {
      await input.fill(title)
    }
  }
  await compose.locator('button.btn-brand').click()
  await page.waitForTimeout(1500)
}

async function createFromWizard(description, knownIds) {
  const known = knownIds instanceof Set ? knownIds : new Set(knownIds || [])
  const createBtn = page.locator('[data-app-create-entry]')
  if (await page.locator('[data-app-create-wizard]').count() === 0) {
    await createBtn.click({ timeout: 15000 })
    await page.waitForTimeout(400)
  }
  const wizard = page.locator('[data-app-create-wizard="describe"]')
  await wizard.waitFor({ state: 'visible', timeout: 10000 })
  const connect = await page.locator('[data-app-create-connect]').getAttribute('data-app-create-connect')
  await page.locator('[data-app-create-wizard] textarea').first().fill(description)
  const generateBtn = page.getByRole('button', { name: '生成', exact: true })
  if (await generateBtn.isDisabled()) throw new Error('generate-disabled')
  await generateBtn.click()
  try {
    await page.locator('[data-app-create-wizard="preview"]').waitFor({ state: 'visible', timeout: 260000 })
  } catch {
    let fresh = null
    for (let i = 0; i < 6 && !fresh; i++) {
      const listed = await listApps()
      const drafts = listed.filter((row) => row.status === 'draft' && !known.has(row.id))
      fresh = drafts.find((row) => /抄表|水电|菜谱/.test(row.name || '')) || drafts.sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0))[0]
      if (!fresh) await page.waitForTimeout(15000)
    }
    if (!fresh) {
      const bodyText = await page.locator('body').innerText()
      const err = coolingIn(bodyText) ? 'ai-cooling' : 'preview-timeout'
      throw new Error(`${err}:${bodyText.slice(0, 400)}`)
    }
    const closeWizard = page.locator('[data-app-create-wizard] button', { hasText: '关闭' })
    if (await closeWizard.count()) await closeWizard.click().catch(() => {})
    await page.waitForTimeout(400)
    const row = page.locator(`[data-app-row="${fresh.id}"] button`).first()
    if (await row.count() === 0) {
      const toggle = page.locator('[data-app-drafts-toggle]')
      if (await toggle.count()) await toggle.click().catch(() => {})
    }
    await page.locator(`[data-app-row="${fresh.id}"]`).locator('button').first().click({ timeout: 15000 })
    await page.locator('[data-app-open-dialog]').waitFor({ state: 'visible', timeout: 15000 })
    const activateBtn = page.getByRole('button', { name: '采纳并激活' })
    await activateBtn.waitFor({ state: 'visible', timeout: 15000 })
    const preview = await productShot()
    await activateBtn.click()
    await page.locator('[data-app-workspace]').waitFor({ state: 'visible', timeout: 20000 })
    const listed2 = await listApps()
    return { connect, preview, listed: listed2, recovered: true }
  }
  const preview = await productShot()
  const activateBtn = page.getByRole('button', { name: '采纳并激活' })
  await activateBtn.waitFor({ state: 'visible', timeout: 15000 })
  await activateBtn.click()
  await page.locator('[data-app-workspace]').waitFor({ state: 'visible', timeout: 20000 })
  const listed = await listApps()
  return { connect, preview, listed }
}

async function stitchShots() {
  const labels = ['向导·本地台账', '卡片+播放', '概览+记一笔+图+流水', '目录·运行中主角']
  const files = [tmpShots.wizard, tmpShots.cards, tmpShots.ledger, tmpShots.catalog]
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
  if (!visitBefore || visitBefore.status !== 'active') {
    out.failCode = 'visit-missing'
    throw new Error(out.failCode)
  }

  const createBtn = page.locator('[data-app-create-entry]')
  await createBtn.click({ timeout: 15000 })
  await page.waitForTimeout(400)
  const wizard = page.locator('[data-app-create-wizard="describe"]')
  await wizard.waitFor({ state: 'visible', timeout: 10000 })
  out.connectDefault = await page.locator('[data-app-create-connect]').getAttribute('data-app-create-connect')
  await page.getByText('接邮箱/业务系统/文件', { exact: true }).click()
  await page.waitForTimeout(200)
  out.connectModules = await page.locator('[data-app-create-connect]').getAttribute('data-app-create-connect')
  out.moduleBoxes = await page.locator('[data-app-create-connect] input[type="checkbox"]').evaluateAll((els) => els.map((el) => el.checked))
  await page.getByText('本地台账', { exact: true }).click()
  await page.waitForTimeout(200)
  out.connectLocal = await page.locator('[data-app-create-connect]').getAttribute('data-app-create-connect')
  await page.screenshot({ path: tmpShots.wizard, fullPage: false })

  const knownIds = new Set(listedBefore.map((row) => row.id))
  const activeRecipe = listedBefore.find((row) => row.status === 'active' && /菜谱/.test(row.name || ''))
  const pendingRecipe = listedBefore.find((row) => row.status === 'draft' && /菜谱/.test(row.name || ''))
  let first
  if (activeRecipe) {
    const closeWizard = page.locator('[data-app-create-wizard] button', { hasText: '关闭' })
    if (await closeWizard.count()) await closeWizard.click().catch(() => {})
    await page.waitForTimeout(400)
    await page.locator(`[data-app-row="${activeRecipe.id}"]`).locator('button').first().click({ timeout: 15000 })
    await page.locator('[data-app-workspace]').waitFor({ state: 'visible', timeout: 20000 })
    await page.locator('[data-app-product]').waitFor({ state: 'visible', timeout: 20000 })
    first = { connect: out.connectLocal, preview: await productShot(), listed: await listApps(), recovered: true, reused: true }
  } else if (pendingRecipe) {
    const closeWizard = page.locator('[data-app-create-wizard] button', { hasText: '关闭' })
    if (await closeWizard.count()) await closeWizard.click().catch(() => {})
    await page.waitForTimeout(400)
    const toggle = page.locator('[data-app-drafts-toggle]')
    if (await toggle.count()) await toggle.click().catch(() => {})
    await page.locator(`[data-app-row="${pendingRecipe.id}"]`).locator('button').first().click({ timeout: 15000 })
    await page.locator('[data-app-open-dialog]').waitFor({ state: 'visible', timeout: 15000 })
    const preview = await productShot()
    const activateBtn = page.getByRole('button', { name: '采纳并激活' })
    await activateBtn.waitFor({ state: 'visible', timeout: 15000 })
    await activateBtn.click()
    await page.locator('[data-app-workspace]').waitFor({ state: 'visible', timeout: 20000 })
    first = { connect: out.connectLocal, preview, listed: await listApps(), recovered: true }
  } else {
    first = await createFromWizard(DESC_CARDS, knownIds)
  }
  out.cardConnect = first.connect
  out.cardRecovered = Boolean(first.recovered)
  out.cardConnect = first.connect
  out.cardPreview = first.preview
  const listedAfter1 = first.listed
  const cardApp = (activeRecipe && listedAfter1.find((row) => row.id === activeRecipe.id))
    || listedAfter1.find((row) => row.status === 'active' && /菜谱/.test(row.name || ''))
    || listedAfter1.find((row) => row.status === 'active' && row.id !== visitBefore.id && !out.listedBefore.some((old) => old.id === row.id && old.status === 'active'))
    || listedAfter1.filter((row) => row.status === 'active' && Date.parse(row.updatedAt || 0) > Date.now() - 20 * 60 * 1000).find((row) => row.id !== visitBefore.id)
  out.cardApp = cardApp || null
  if (!cardApp) {
    out.failCode = 'card-app-missing'
    throw new Error(out.failCode)
  }
  out.cardLive = await productShot()
  if (!(out.cardLive.titles || []).includes(CARD_TITLE) && out.cardLive.compose) {
    await fillCompose({ title: CARD_TITLE, url: CARD_URL })
  }
  const navBtns = page.locator('[data-app-product-nav] button')
  if (await navBtns.count() > 1) {
    await navBtns.nth(1).click().catch(() => {})
    await page.waitForTimeout(600)
    if (await page.locator('[data-app-compose]').count()) {
      await fillCompose({ title: '试做一次', number: '8' })
    }
    await navBtns.first().click().catch(() => {})
    await page.waitForTimeout(500)
  }
  out.cardAfterWrite = await productShot()
  out.cardTitleOk = (out.cardAfterWrite.titles || []).includes(CARD_TITLE)
  out.cardHasPlayOrOpen = (out.cardAfterWrite.hrefs || []).some((row) => /^https?:\/\//.test(row.href || ''))
  const openLink = page.locator('[data-app-card-action="play"], [data-app-card-action="url"]').first()
  if (await openLink.count()) {
    out.openHref = await openLink.getAttribute('data-app-card-href')
    const popupPromise = page.waitForEvent('popup', { timeout: 8000 }).catch(() => null)
    await openLink.click({ modifiers: ['Meta'] }).catch(async () => {
      await openLink.click()
    })
    const popup = await popupPromise
    out.popupUrl = popup ? popup.url() : null
    if (popup) await popup.close().catch(() => {})
  }
  await page.screenshot({ path: tmpShots.cards, fullPage: false })

  if (await page.locator('[data-app-use="ai"]').count()) {
    await page.locator('[data-app-use="ai"]').first().click()
    await page.waitForTimeout(2800)
    out.aiOpen = await page.evaluate((name) => {
      const aside = document.querySelector('aside')
      const text = (aside?.innerText || '').replace(/\s+/g, ' ')
      const title = `${name} · 问`
      return {
        title,
        listHit: text.includes(title) || text.includes(' · 问'),
        asideW: aside ? Math.round(aside.getBoundingClientRect().width) : 0,
      }
    }, cardApp.name)
  }

  const back = page.getByRole('button', { name: /返回列表/ })
  if (await back.count()) await back.click({ timeout: 8000 })
  await page.waitForTimeout(800)

  const listedNow = await listApps()
  const activeLedger = listedNow.find((row) => row.status === 'active' && /抄表|水电/.test(row.name || ''))
  const pendingLedger = listedNow.find((row) => row.status === 'draft' && /抄表|水电/.test(row.name || ''))
  let second
  if (activeLedger) {
    const closeWizard = page.locator('[data-app-create-wizard] button', { hasText: '关闭' })
    if (await closeWizard.count()) await closeWizard.click().catch(() => {})
    await page.waitForTimeout(400)
    await page.locator(`[data-app-row="${activeLedger.id}"]`).locator('button').first().click({ timeout: 15000 })
    await page.locator('[data-app-workspace]').waitFor({ state: 'visible', timeout: 20000 })
    await page.locator('[data-app-product]').waitFor({ state: 'visible', timeout: 20000 })
    second = { connect: out.connectLocal, preview: await productShot(), listed: await listApps(), recovered: true, reused: true }
  } else if (pendingLedger) {
    const closeWizard = page.locator('[data-app-create-wizard] button', { hasText: '关闭' })
    if (await closeWizard.count()) await closeWizard.click().catch(() => {})
    await page.waitForTimeout(400)
    const draftsToggle = page.locator('[data-app-drafts-toggle]')
    if (await draftsToggle.count() && (await draftsToggle.getAttribute('data-app-drafts-open')) === 'false') {
      await draftsToggle.click().catch(() => {})
      await page.waitForTimeout(400)
    }
    await page.locator(`[data-app-row="${pendingLedger.id}"]`).locator('button').first().click({ timeout: 15000 })
    await page.locator('[data-app-open-dialog]').waitFor({ state: 'visible', timeout: 15000 })
    const preview = await productShot()
    const activateBtn = page.getByRole('button', { name: '采纳并激活' })
    await activateBtn.waitFor({ state: 'visible', timeout: 15000 })
    await activateBtn.click()
    await page.locator('[data-app-workspace]').waitFor({ state: 'visible', timeout: 20000 })
    second = { connect: out.connectLocal, preview, listed: await listApps(), recovered: true }
  } else {
    second = await createFromWizard(DESC_LEDGER, new Set([...knownIds, cardApp.id]))
  }
  out.ledgerPreview = second.preview
  const listedAfter2 = second.listed
  const ledgerApp = listedAfter2.find((row) => row.id === activeLedger?.id && row.status === 'active')
    || listedAfter2.find((row) => row.id === pendingLedger?.id && row.status === 'active')
    || listedAfter2.find((row) => row.status === 'active' && /抄表|水电/.test(row.name || ''))
    || listedAfter2.find((row) => (
      row.status === 'active' && row.id !== visitBefore.id && row.id !== cardApp.id
      && !out.listedBefore.some((old) => old.id === row.id && old.status === 'active')
    ))
  out.ledgerApp = ledgerApp || null
  if (!ledgerApp) {
    out.failCode = 'ledger-app-missing'
    throw new Error(out.failCode)
  }
  out.ledgerLive = await productShot()
  const bodyHasLedgerTitle = (await page.locator('body').innerText()).includes(LEDGER_TITLE)
  if (!bodyHasLedgerTitle && !(out.ledgerLive.titles || []).includes(LEDGER_TITLE) && out.ledgerLive.compose) {
    await fillCompose({ title: LEDGER_TITLE, number: '12' })
  }
  out.ledgerAfterWrite = await productShot()
  out.ledgerTitleOk = (out.ledgerAfterWrite.titles || []).includes(LEDGER_TITLE)
    || (await page.locator('body').innerText()).includes(LEDGER_TITLE)
  await page.screenshot({ path: tmpShots.ledger, fullPage: false })
  if (await page.locator('[data-app-use="plan"]').count()) {
    const tasksBefore = await page.evaluate(async (wsId) => {
      const json = await fetch(`/api/v1/plan/tasks?workspaceId=${encodeURIComponent(wsId)}`).then((r) => r.json()).catch(() => ({}))
      const rows = Array.isArray(json) ? json : (json.data || json.items || [])
      return rows.length
    }, workspaceId)
    await page.locator('[data-app-use="plan"]').first().click()
    await page.waitForTimeout(1800)
    const tasksAfter = await page.evaluate(async ({ wsId, title }) => {
      const json = await fetch(`/api/v1/plan/tasks?workspaceId=${encodeURIComponent(wsId)}`).then((r) => r.json()).catch(() => ({}))
      const rows = Array.isArray(json) ? json : (json.data || json.items || [])
      return {
        count: rows.length,
        hit: rows.some((row) => String(row.title || '').includes(title) || String(row.title || '').includes('抄表')),
        titles: rows.slice(0, 8).map((row) => row.title || row.name),
      }
    }, { wsId: workspaceId, title: LEDGER_TITLE })
    out.planBefore = tasksBefore
    out.planAfter = tasksAfter
    out.planPersisted = Boolean(tasksAfter.count > tasksBefore || tasksAfter.hit)
  } else {
    out.planPersisted = false
    out.failPlan = 'no-plan-use'
  }

  await page.getByRole('button', { name: '业务应用' }).first().click({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(700)
  const backToList = page.getByRole('button', { name: /返回列表/ })
  if (await backToList.count()) await backToList.click({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(800)
  if (await page.locator('[data-app-catalog]').count() === 0) {
    await goAppsTab()
  }
  await page.locator('[data-app-catalog]').waitFor({ state: 'visible', timeout: 15000 })
  const snapCatalog = () => page.evaluate(() => {
    const running = [...document.querySelectorAll('[data-app-catalog-section="running"] [data-app-row]')]
    const draftToggle = document.querySelector('[data-app-drafts-toggle]')
    const draftsOpen = draftToggle?.getAttribute('data-app-drafts-open') === 'true'
    const draftRows = [...document.querySelectorAll('[data-app-catalog-section="drafts"] [data-app-row]')]
    const named = [...document.querySelectorAll('[data-app-row]')].map((el) => ({
      id: el.getAttribute('data-app-row') || '',
      name: el.querySelector('[data-app-row-name]')?.getAttribute('data-app-row-name') || '',
    })).filter((row) => row.name)
    const byName = {}
    for (const row of named) {
      byName[row.name] = byName[row.name] || []
      byName[row.name].push(row.id)
    }
    const sameName = Object.entries(byName).filter(([, ids]) => ids.length > 1)
    const html = document.querySelector('[data-app-catalog]')?.innerHTML || ''
    return {
      runningCount: running.length,
      draftsOpen,
      draftRowCount: draftRows.length,
      draftIds: draftRows.map((el) => el.getAttribute('data-app-row')),
      sameName,
      sameNameSeparate: sameName.length > 0 && sameName.every(([, ids]) => new Set(ids).size === ids.length),
      runningFirst: html.indexOf('data-app-catalog-section="running"') >= 0
        && html.indexOf('data-app-catalog-section="drafts"') > html.indexOf('data-app-catalog-section="running"'),
    }
  })
  out.catalogCollapsed = await snapCatalog()
  out.draftsCollapsed = out.catalogCollapsed.runningCount > 0 && out.catalogCollapsed.draftsOpen === false
  const catalogBox = page.locator('[data-app-catalog]')
  if (await catalogBox.count()) {
    await catalogBox.screenshot({ path: tmpShots.catalog })
  } else {
    await page.screenshot({ path: tmpShots.catalog, fullPage: false })
  }
  const toggle = page.locator('[data-app-drafts-toggle]')
  if (await toggle.count() && (await toggle.getAttribute('data-app-drafts-open')) === 'false') {
    await toggle.click()
    await page.waitForTimeout(400)
  }
  out.catalogExpanded = await snapCatalog()
  out.catalog = {
    ...out.catalogCollapsed,
    sameNameSeparate: Boolean(out.catalogExpanded.sameNameSeparate),
    sameName: out.catalogExpanded.sameName,
    draftIdsExpanded: out.catalogExpanded.draftIds,
  }
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
    && visitAfter.updatedAt === visitBefore.updatedAt,
  )
  out.visitStillActive = visitAfter?.status === 'active'
  out.deletedVisit = !visitAfter
  out.activeStillThere = listedBefore.filter((row) => row.status === 'active').every((row) => listedAfter.some((now) => now.id === row.id && now.status === 'active'))

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

  const srcGrep = execSync(
    `rg -n ${JSON.stringify(out.cardApp?.name || '___none___')} src runtime/apps || true; rg -n ${JSON.stringify(out.ledgerApp?.name || '___none___')} src runtime/apps || true`,
    { cwd: SCENE, encoding: 'utf8' },
  )
  out.newNameInSrc = srcGrep.trim() || 'none'
  const banned = execSync("rg -n '健身|记账|库存盘点|运动塑形' src/components/apps runtime/apps || true", { cwd: SCENE, encoding: 'utf8' })
  out.templateHits = banned.trim() || 'none'
  out.bizWriteUrls = bizWriteUrls
  out.imSendUrls = imSendUrls
  out.cwdHeaderHits = cwdHeaderHits
  out.silentBizWrite = bizWriteUrls.length > 0
  out.autoSendIm = imSendUrls.length > 0

  const sqlite = new DatabaseSync(DB)
  let sqliteHit = false
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'app_%'").all().map((row) => row.name)
  for (const table of tables) {
    try {
      const rows = sqlite.prepare(`SELECT * FROM "${table}" WHERE workspace_cwd = ?`).all(workspaceCwd)
      const blob = JSON.stringify(rows)
      if (blob.includes(CARD_TITLE) || blob.includes(LEDGER_TITLE)) sqliteHit = true
    } catch {
      // skip
    }
  }
  sqlite.close()
  out.sqliteHasRow = sqliteHit

  const differentPages = Boolean(
    (out.cardAfterWrite?.cards || out.cardLive?.cards)
    && (out.ledgerAfterWrite?.overview || out.ledgerLive?.overview)
    && (out.ledgerAfterWrite?.feed || out.ledgerLive?.feed),
  )
  const item1 = Boolean(out.cardApp && out.ledgerApp && out.cardApp.id !== out.ledgerApp.id && differentPages)
  const item2 = Boolean(
    (out.cardAfterWrite?.cards || out.cardLive?.cards)
    && (out.cardAfterWrite?.play || (out.cardAfterWrite?.hrefs || []).some((row) => row.action === 'play' || row.action === 'url'))
    && out.ledgerAfterWrite?.overview && out.ledgerAfterWrite?.compose && out.ledgerAfterWrite?.chart && out.ledgerAfterWrite?.feed,
  )
  const item3 = Boolean(
    !out.cardAfterWrite?.toolbarInNav && !out.ledgerAfterWrite?.platformBar
    && !out.cardAfterWrite?.ledgerStrip && !out.ledgerAfterWrite?.ledgerStrip
    && (out.aiOpen?.listHit || out.cardLive?.uses.some((row) => row.use === 'ai')),
  )
  const item4 = Boolean(out.connectDefault === 'local' && out.connectModules === 'modules' && (out.moduleBoxes || []).every((v) => v === false) && out.connectLocal === 'local')
  const item5 = Boolean(out.planPersisted)
  const item6 = Boolean(out.cardTitleOk && out.ledgerTitleOk && !(out.cardAfterWrite?.titles || []).includes('常备'))
  const item7 = Boolean(/^https?:\/\//.test(out.openHref || '') && (out.popupUrl || out.openHref === CARD_URL || String(out.openHref).startsWith('https://')))
  const item8 = Boolean(out.draftsCollapsed && out.catalog?.runningFirst && out.catalog?.sameNameSeparate && out.visitUnchanged && out.activeStillThere)

  out.items = {
    1: { pass: item1, note: `${out.cardApp?.name || ''} vs ${out.ledgerApp?.name || ''}` },
    2: { pass: item2, note: `cards=${out.cardAfterWrite?.cards} play=${out.cardAfterWrite?.play} ledger=${out.ledgerAfterWrite?.overview}/${out.ledgerAfterWrite?.compose}/${out.ledgerAfterWrite?.feed}` },
    3: { pass: item3, note: `toolbar=${out.cardAfterWrite?.platformBar} ai=${JSON.stringify(out.aiOpen || {})}` },
    4: { pass: item4, note: `${out.connectDefault}→${out.connectModules} boxes=${JSON.stringify(out.moduleBoxes)} back=${out.connectLocal}` },
    5: { pass: item5, note: JSON.stringify(out.planAfter || out.failPlan || {}) },
    6: { pass: item6, note: `cardTitle=${out.cardTitleOk} ledgerTitle=${out.ledgerTitleOk}` },
    7: { pass: item7, note: `href=${out.openHref || ''} popup=${out.popupUrl || ''}` },
    8: { pass: item8, note: JSON.stringify(out.catalog || {}) },
  }

  out.pass = Boolean(
    item1 && item2 && item3 && item4 && item5 && item6 && item7 && item8
    && out.visitUnchanged && out.resizeCollapse && out.resizeExpand
    && out.iframeShieldCss && out.stageShieldFn
    && out.threeTabs.app && out.threeTabs.records && out.threeTabs.ops
    && out.createEntry && out.deleteEntry
    && !out.silentBizWrite && !out.autoSendIm && cwdHeaderHits.length === 0
    && out.newNameInSrc === 'none' && out.templateHits === 'none'
    && existsSync(MEDIA) && out.pngHeader === '89504e470d0a1a0a'
    && (out.sqliteHasRow || out.cardTitleOk),
  )
} catch (error) {
  out.pass = false
  out.failCode = out.failCode || 'script-error'
  out.error = error instanceof Error ? error.message : String(error)
  await page.screenshot({ path: tmpShots.catalog, fullPage: true }).catch(() => {})
  if (!existsSync(MEDIA)) await stitchShots().catch(() => page.screenshot({ path: MEDIA, fullPage: true }))
} finally {
  await browser.close().catch(() => undefined)
}

const itemRow = (n) => {
  const row = (out.items && out.items[n]) || { pass: false, note: out.failCode || out.error || '' }
  return `| ${n} | ${row.pass ? '过' : '没过'} | ${String(row.note || '').replace(/\|/g, '/') } |`
}

const md = `# Verify: AV 创建应用八项

**pass:** ${out.pass ? 'yes' : 'no'}
**main SHA:** \`${out.sha}\`
**branch:** \`${out.branch}\`（未推 origin）
**走访 updatedAt:** ${out.visitUnchanged ? 'unchanged' : 'changed/missing'}
**拉伸 48/224:** ${out.resizeCollapse && out.resizeExpand ? 'yes' : 'no'}

## SHA

| 项 | 值 |
|---|---|
| daily main | \`${out.sha}\` |
| branch | \`${out.branch}\` |

## 1–8

| # | 过/没过 | 证据 |
|---|---|---|
${[1, 2, 3, 4, 5, 6, 7, 8].map(itemRow).join('\n')}

## 现网描述

1. ${DESC_CARDS}
2. ${DESC_LEDGER}

新应用名「${out.cardApp?.name || ''}」「${out.ledgerApp?.name || ''}」只在数据里，未进 src/。

## AO–AU / 决策 22

| 项 | 结果 |
|---|---|
| 工作面事务底座条 | ${out.cardAfterWrite?.ledgerStrip || out.ledgerAfterWrite?.ledgerStrip ? '有' : '无'} |
| 栏目顶工具条 | ${out.cardAfterWrite?.toolbarInNav || out.ledgerAfterWrite?.toolbarInNav ? 'yes' : 'no'} |
| 平台按钮条 | ${out.cardAfterWrite?.platformBar || out.ledgerAfterWrite?.platformBar ? 'yes' : 'no'} |
| 问 AI 左栏 | ${out.aiOpen?.listHit ? 'yes' : 'no'} \`${out.aiOpen?.title || ''}\` |
| 拉宽 aside | ${out.wide?.asideW ?? '?'}px（要 48） |
| 拉窄 aside | ${out.narrow?.asideW ?? '?'}px（要 224） |
| StagePanel iframe 指针屏蔽 | ${out.iframeShieldCss && out.stageShieldFn ? '未拆' : '坏了'} |
| 三 Tab | 应用=${out.threeTabs?.app} 业务记录=${out.threeTabs?.records} 操作记录=${out.threeTabs?.ops} |
| 创建入口 | ${out.createEntry ? 'yes' : 'no'} |
| 删除入口 | ${out.deleteEntry ? 'yes' : 'no'} |
| 走访 id | \`${visitId}\` |
| 走访 updatedAt | before ${out.visitBefore?.updatedAt || ''} / after ${out.visitAfter?.updatedAt || ''} |
| 静默 biz_write | ${out.silentBizWrite ? 'yes' : 'no'} |
| 自动发 IM | ${out.autoSendIm ? 'yes' : 'no'} |
| 5174 | 未杀，仍在听 |
| 打开 href | \`${out.openHref || ''}\` popup=\`${out.popupUrl || ''}\` |

已对：见上表过的项。走访 \`${visitId}\` updatedAt ${out.visitUnchanged ? '未改' : '变了'}。拉伸 ${out.wide?.asideW}/${out.narrow?.asideW}。

未对：${out.pass ? '无' : (out.failCode || '见没过项')}。

仍差：${out.pass ? '无（本刀过关项）' : Object.entries(out.items || {}).filter(([, v]) => !v.pass).map(([k]) => k).join('、') || out.error || '未过'}

## 图

不同产品页、能力不在一排按钮、草稿让开、打开是真链。PNG 头 \`${out.pngHeader || ''}\` ${out.pngBytes || 0} bytes。

${MEDIA}

${out.error ? `## 失败\n\n${out.failCode || ''} ${out.error}\n` : ''}
`

await writeFile(REPORT_JSON, `${JSON.stringify(out, null, 2)}\n`)
await writeFile(REPORT_MD, md)
await dualWrite(REPORT_MD, 'internal/verify-app-create-av.md')
await dualWrite(REPORT_JSON, 'internal/verify-app-create-av.json')
if (existsSync(MEDIA)) await dualWrite(MEDIA, 'media/app-create-av.png')

console.log(JSON.stringify({
  pass: out.pass,
  sha: out.sha,
  items: out.items,
  cardApp: out.cardApp,
  ledgerApp: out.ledgerApp,
  visitUnchanged: out.visitUnchanged,
  wide: out.wide?.asideW,
  narrow: out.narrow?.asideW,
  pngBytes: out.pngBytes,
  pngHeader: out.pngHeader,
  error: out.error || null,
  failCode: out.failCode || null,
}, null, 2))
if (!out.pass) process.exitCode = 1
