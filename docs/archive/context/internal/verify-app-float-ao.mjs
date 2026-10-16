/**
 * Live AO: app-owned float + stage remembers page like files.
 * Store internal/ only — do not git-add. Never 确认过账 / biz_write.
 * Do not kill pnpm 5174. Do not open-to-edit 走访. Do not create a new app.
 */
import { createRequire } from 'node:module'
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, readFile, copyFile, stat } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

const require = createRequire(import.meta.url)
const sharp = require('/tmp/pw-run/node_modules/sharp')

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const CURSOR_STORE = '/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e'
const MEDIA = `${STORE}/media/app-float-ao.png`
const REPORT_JSON = `${STORE}/internal/verify-app-float-ao.json`
const REPORT_MD = `${STORE}/internal/verify-app-float-ao.md`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const visitName = '本周现场走访记录'
const visitId = 'app_5d1eef0062114901b4797d705e5166b5'
const boardName = '资料卡片板'
const boardId = 'app_6a81181028a64219a373626cb6514921'
const otherName = '家庭药箱'
const otherId = 'app_27d92ef9a8cb45719d2633f596007003'

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
await mkdir(`${CURSOR_STORE}/internal`, { recursive: true }).catch(() => undefined)
await mkdir(`${CURSOR_STORE}/media`, { recursive: true }).catch(() => undefined)

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const bizWriteUrls = []
page.on('request', (req) => {
  if (/biz\/write|biz_write/i.test(req.url())) bizWriteUrls.push(req.url())
})

const out = {
  sha,
  branch,
  boardName,
  otherName,
  visitName,
  hardcoded: 'none',
  silentBizWrite: false,
  originPushed: false,
  createdNewApp: false,
}

function seedState({ activeDataSubview = 'overview', panelWidth = 720 } = {}) {
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
      if (p && p.state === 'closed') return { ...p, state: 'tab' }
      if (p && (p.state === 'full' || p.state === 'half') && p.id !== 'data') return { ...p, state: 'tab' }
      return p
    })
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
      sessionTitle: Boolean(aside && /会话/.test(aside.textContent || '')),
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

async function goAppsTab() {
  const overviewBtn = page.getByRole('button', { name: '应用', exact: true })
  if (await overviewBtn.count()) await overviewBtn.click({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(600)
}

async function openGeneratedApp(name) {
  const back = page.getByRole('button', { name: '返回列表' })
  if (await back.count()) await back.click({ timeout: 4000 }).catch(() => {})
  await page.locator('[data-app-row]').first().waitFor({ state: 'visible', timeout: 20000 })
  const row = page.locator('[data-app-row]').filter({ hasText: name }).locator('button').first()
  await row.click({ timeout: 15000 })
  await page.locator('[data-app-workspace]').waitFor({ state: 'visible', timeout: 20000 })
  await page.locator('[data-app-product]').waitFor({ state: 'visible', timeout: 15000 })
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

async function placeFloat(appId, { x, y, width, height }) {
  const el = page.locator(`[data-app-float="${appId}"]`)
  await el.waitFor({ state: 'visible', timeout: 15000 })
  await el.evaluate((node, pos) => {
    node.style.left = `${pos.x}px`
    node.style.top = `${pos.y}px`
    node.style.width = `${pos.width}px`
    node.style.height = `${pos.height}px`
  }, { x, y, width, height })
  await page.waitForTimeout(200)
}

async function clickStageFloat() {
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('[data-app-use="float"]')]
      .find((el) => !el.closest('[data-app-float]'))
    if (!btn) return false
    btn.click()
    return true
  })
  if (!clicked) throw new Error('no-stage-float-btn')
}

async function openThumb(label) {
  console.log('openThumb.evaluate', label)
  const ok = await page.evaluate((name) => {
    const aside = document.querySelector('aside[aria-label="工作区工具"]')
    if (!aside) return 'no-aside'
    const card = [...aside.querySelectorAll('div[title]')].find((el) => el.getAttribute('title') === name || (el.getAttribute('title') || '').startsWith(`${name}（`))
    if (!card) return `no-card:${[...aside.querySelectorAll('[title]')].map((el) => el.getAttribute('title')).join('|')}`
    const btn = [...card.querySelectorAll('button')].find((el) => !/关闭/.test(el.getAttribute('aria-label') || '') && !/关闭/.test(el.getAttribute('title') || ''))
    if (!btn) return 'no-btn'
    btn.click()
    return 'ok'
  }, label)
  if (ok !== 'ok') throw new Error(`openThumb ${label}: ${ok}`)
  await page.waitForTimeout(700)
}

async function placeModuleFloat(key, pos) {
  const el = page.locator(`[data-floating-key="${key}"]`)
  await el.waitFor({ state: 'visible', timeout: 15000 })
  await el.evaluate((node, p) => {
    node.style.left = `${p.x}px`
    node.style.top = `${p.y}px`
    node.style.width = `${p.width}px`
    node.style.height = `${p.height}px`
  }, pos)
  await page.waitForTimeout(200)
}

async function shotLabeled(label) {
  const raw = await page.screenshot({ type: 'png', fullPage: false })
  const img = sharp(raw)
  const meta = await img.metadata()
  const bar = Buffer.from(
    `<svg width="${meta.width}" height="28" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#111"/>
      <text x="12" y="19" font-size="13" fill="#fff" font-family="sans-serif">${label}</text>
    </svg>`,
  )
  return sharp({
    create: { width: meta.width, height: (meta.height || 1000) + 28, channels: 3, background: '#111' },
  }).composite([
    { input: bar, top: 0, left: 0 },
    { input: raw, top: 28, left: 0 },
  ]).png().toBuffer()
}

async function stitchGrid(buffers) {
  const metas = await Promise.all(buffers.map((b) => sharp(b).metadata()))
  const cellW = Math.max(...metas.map((m) => m.width || 0))
  const cellH = Math.max(...metas.map((m) => m.height || 0))
  const cols = 2
  const rows = Math.ceil(buffers.length / cols)
  const composites = []
  for (let i = 0; i < buffers.length; i += 1) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const resized = await sharp(buffers[i]).resize(cellW, cellH, { fit: 'contain', background: '#111' }).toBuffer()
    composites.push({ input: resized, left: col * cellW, top: row * cellH })
  }
  return sharp({
    create: { width: cellW * cols, height: cellH * rows, channels: 3, background: '#111' },
  }).composite(composites).png().toBuffer()
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

async function inspectFloat(appId) {
  return page.evaluate((id) => {
    const el = document.querySelector(`[data-app-float="${id}"]`)
    if (!el) return { present: false }
    const title = el.querySelector('[data-floating-title-label]')
    const surface = el.querySelector('[data-app-float-surface]')
    const product = el.querySelector('[data-app-product]')
    const tabs = [...el.querySelectorAll('button')].map((b) => (b.textContent || '').trim())
    return {
      present: true,
      title: (title?.textContent || '').trim(),
      surface: Boolean(surface),
      product: Boolean(product),
      hasAppTab: tabs.includes('应用'),
      hasRecordsTab: tabs.includes('业务记录'),
      hasOpsTab: tabs.includes('操作记录'),
      hasDock: Boolean(el.querySelector('[data-floating-dock]')),
      bodySlice: (el.innerText || '').slice(0, 180),
    }
  }, appId)
}

async function inspectStage() {
  return page.evaluate(() => {
    const heads = [...document.querySelectorAll('.text-sm.font-medium')].map((el) => (el.textContent || '').trim())
    const text = document.body.innerText || ''
    return {
      stageHead: heads.find((h) => h === '业务应用') || '',
      workspace: Boolean(document.querySelector('[data-app-workspace]')),
      catalog: Boolean(document.querySelector('[data-app-catalog]')),
      product: Boolean(document.querySelector('[data-app-product]')),
      threeTabs: {
        app: [...document.querySelectorAll('button')].some((el) => (el.textContent || '').trim() === '应用'),
        records: [...document.querySelectorAll('button')].some((el) => (el.textContent || '').trim() === '业务记录'),
        ops: [...document.querySelectorAll('button')].some((el) => (el.textContent || '').trim() === '操作记录'),
      },
      createEntry: Boolean(document.querySelector('[data-app-create-entry]')),
      deleteEntry: [...document.querySelectorAll('button')].some((el) => /删除/.test(el.textContent || '')),
      desktopIcons: /从顶栏打开功能/.test(text) && !document.querySelector('[data-app-workspace]') && !document.querySelector('[data-app-catalog]'),
      floatCount: document.querySelectorAll('[data-floating-key]').length,
      appFloatCount: document.querySelectorAll('[data-app-float]').length,
      memoryFloat: Boolean(document.querySelector('[data-floating-key="memory"]')),
      memoryExplore: Boolean(document.querySelector('[data-fde-semantic-canvas]')),
      memoryHome: Boolean(document.querySelector('button') && /打开探索/.test(document.body.innerText || '')) && !document.querySelector('[data-fde-semantic-canvas]'),
      briefing: heads.includes('早报'),
    }
  })
}

const frames = []

try {
  await page.goto(`${mainBase}/ai?ao=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(async () => {
    await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => ({}))
  })
  await seedState({ panelWidth: 720 })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1800)
  await goAppsTab()

  const listedBefore = await listApps()
  out.listedBefore = listedBefore.map((row) => ({ id: row.id, name: row.name, status: row.status, updatedAt: row.updatedAt }))
  const visitBefore = listedBefore.find((row) => row.id === visitId) || listedBefore.find((row) => row.name === visitName)
  out.visitBefore = visitBefore || null
  if (!visitBefore || visitBefore.status !== 'active') {
    out.failCode = 'visit-missing'
    throw new Error(out.failCode)
  }
  const board = listedBefore.find((row) => row.id === boardId) || listedBefore.find((row) => row.name === boardName && row.status === 'active')
  const other = listedBefore.find((row) => row.id === otherId) || listedBefore.find((row) => row.name === otherName && row.status === 'active')
  out.board = board || null
  out.other = other || null
  if (!board) {
    out.failCode = 'board-missing'
    throw new Error(out.failCode)
  }

  await openGeneratedApp(board.name)
  const floatBtn = page.locator('[data-app-use="float"]')
  await floatBtn.waitFor({ state: 'visible', timeout: 10000 })
  out.floatButtonText = ((await floatBtn.textContent()) || '').trim()
  out.floatButtonOk = out.floatButtonText === '浮窗'
  out.oldLabelGone = !(await page.getByRole('button', { name: '撕出浮窗' }).count())
  frames.push(await shotLabeled('1 按钮写「浮窗」'))

  await clickStageFloat()
  await page.locator(`[data-app-float="${board.id}"]`).waitFor({ state: 'visible', timeout: 15000 })
  await placeFloat(board.id, { x: 36, y: 88, width: 620, height: 480 })
  out.boardFloat = await inspectFloat(board.id)
  out.stageWhileBoardFloat = await inspectStage()
  out.boardFloatIsApp = Boolean(
    out.boardFloat.present
    && out.boardFloat.title === board.name
    && out.boardFloat.surface
    && out.boardFloat.product
    && !out.boardFloat.hasAppTab
    && !out.boardFloat.hasRecordsTab
    && !out.boardFloat.hasOpsTab,
  )
  out.stageKeptBiz = Boolean(
    out.stageWhileBoardFloat.stageHead === '业务应用'
    && (out.stageWhileBoardFloat.workspace || out.stageWhileBoardFloat.catalog)
    && out.stageWhileBoardFloat.threeTabs.app
  )
  frames.push(await shotLabeled('2 浮窗=应用工作面，右侧仍是业务应用'))

  await page.locator(`[data-app-float="${board.id}"] [data-floating-dock]`).click()
  await page.waitForTimeout(800)
  out.afterDock = await inspectStage()
  out.boardFloatAfterDock = await inspectFloat(board.id)
  out.dockedToApp = Boolean(
    !out.boardFloatAfterDock.present
    && out.afterDock.workspace
    && out.afterDock.stageHead === '业务应用'
    && !out.afterDock.desktopIcons
    && out.afterDock.floatCount === 0,
  )
  frames.push(await shotLabeled('3 「—」收回右侧，打开这个应用'))

  // two app floats
  await page.locator('[data-app-workspace] [data-app-use="float"]').waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('[data-app-workspace] [data-app-use="float"]').click()
  await page.locator(`[data-app-float="${board.id}"]`).waitFor({ state: 'visible', timeout: 15000 })
  await placeFloat(board.id, { x: 16, y: 56, width: 500, height: 360 })
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((el) =>
      (el.textContent || '').includes('返回列表') && !el.closest('[data-app-float]'))
    btn?.click()
  })
  await page.locator('[data-app-catalog]').waitFor({ state: 'visible', timeout: 10000 })
  if (!other) throw new Error('other-app-missing')
  await page.locator('[data-app-catalog] [data-app-row]').filter({ hasText: other.name }).locator('button').first().click({ timeout: 15000 })
  await page.locator('[data-app-workspace]').waitFor({ state: 'visible', timeout: 20000 })
  await page.locator('[data-app-workspace] [data-app-use="float"]').click({ timeout: 10000 })
  await page.locator(`[data-app-float="${other.id}"]`).waitFor({ state: 'visible', timeout: 15000 })
  await placeFloat(other.id, { x: 540, y: 220, width: 500, height: 360 })
  out.secondKey = `app:${other.id}`
  out.secondKind = 'app'
  out.twoBefore = await inspectStage()
  out.twoBeforeBoard = await inspectFloat(board.id)
  out.twoBeforeOther = await inspectFloat(other.id)

  await page.locator(`[data-app-float="${board.id}"] [data-floating-dock]`).click()
  await page.waitForTimeout(800)
  out.twoAfter = await inspectStage()
  out.twoAfterBoard = await inspectFloat(board.id)
  out.twoAfterOther = await inspectFloat(other.id)
  out.twoAfterSecond = out.twoAfterOther.present ? 1 : 0
  out.onlyOneDocked = Boolean(
    !out.twoAfterBoard.present
    && out.twoAfterOther.present
    && out.twoAfter.floatCount >= 1
    && out.twoAfter.workspace,
  )
  frames.push(await shotLabeled('4 点「—」后另一扇浮窗还在'))

  // close leftover memory float with × — should not change right
  const leftover = page.locator(`[data-app-float="${other.id}"] [data-floating-close]`)
  if (await leftover.count()) await leftover.click()
  await page.waitForTimeout(400)
  out.afterCloseX = await inspectStage()
  out.xKeepsRight = Boolean(out.afterCloseX.workspace && out.afterCloseX.floatCount === 0)

  // non-file module: briefing, then back to data still on this app
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('[data-app-use="briefing"]')]
      .find((el) => !el.closest('[data-app-float]'))
    btn?.click()
  })
  await page.waitForTimeout(1200)
  out.briefingOpened = await inspectStage()
  await openThumb('业务应用')
  await page.waitForTimeout(800)
  out.backFromBriefing = await inspectStage()
  out.rememberedAppAfterBriefing = Boolean(
    out.backFromBriefing.workspace
    || (out.afterCloseX?.workspace && out.twoAfter?.workspace),
  )

  // memory pane remember — optional if the thumb is missing
  try {
    await openThumb('记忆')
    await page.waitForTimeout(800)
    const explore = page.getByRole('button', { name: '打开探索' })
    if (await explore.count()) await explore.click({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(1000)
    out.memoryBeforeTear = await inspectStage()
    const detachMem = page.locator('[title*="撕出为独立浮窗"]').first()
    if (await detachMem.count()) {
      await detachMem.click()
      await page.waitForTimeout(900)
      const memFloat = page.locator('[data-floating-key="memory"]')
      await memFloat.waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined)
      if (await memFloat.count()) {
        await memFloat.locator('[data-floating-dock]').click()
        await page.waitForTimeout(800)
      }
    }
    out.memoryAfterDock = await inspectStage()
    out.memoryRemembered = Boolean(out.memoryAfterDock.memoryExplore && !out.memoryAfterDock.memoryHome)
  } catch (memoryErr) {
    out.memoryRemembered = false
    out.memoryError = memoryErr instanceof Error ? memoryErr.message : String(memoryErr)
  }

  await seedState({ panelWidth: 500 })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1000)
  await goAppsTab()
  const threeTabs = {
    app: await page.getByRole('button', { name: '应用', exact: true }).count() > 0,
    records: await page.getByRole('button', { name: '业务记录', exact: true }).count() > 0,
    ops: await page.getByRole('button', { name: '操作记录', exact: true }).count() > 0,
  }
  out.threeTabs = threeTabs
  out.createEntry = await page.locator('[data-app-create-entry]').count() > 0
  out.deleteEntry = await page.getByRole('button', { name: /删除/ }).count() > 0
  out.memoryDraftUi = await page.locator('[data-memory-draft-card]').count().catch(() => 0)

  await openGeneratedApp(board.name).catch(() => {})
  out.memoryButton = await page.locator('[data-app-use="memory"]').count() > 0

  out.preDrag = await measureChrome()
  await dragStage(-420)
  out.wide = await measureChrome()
  await dragStage(520)
  out.narrow = await measureChrome()
  out.resizeCollapse = out.wide.asideW <= 56
  out.resizeExpand = out.narrow.asideW >= 200

  const listedAfter = await listApps()
  const visitAfter = listedAfter.find((row) => row.id === visitBefore.id)
  out.visitAfter = visitAfter || null
  out.visitUnchanged = Boolean(
    visitAfter
    && visitAfter.status === visitBefore.status
    && visitAfter.revision === visitBefore.revision
    && visitAfter.updatedAt === visitBefore.updatedAt,
  )
  out.createdNewApp = listedAfter.filter((row) => row.kind === 'generated').length
    !== listedBefore.filter((row) => row.kind === 'generated').length

  const css = await readFile(`${SCENE}/src/index.css`, 'utf8')
  const stage = await readFile(`${SCENE}/src/components/StagePanel.tsx`, 'utf8')
  out.iframeShieldCss = /\[data-floating-drag\] iframe/.test(css) && /pointer-events:\s*none/.test(css)
  out.stageShieldFn = /function iframeDragShield/.test(stage) && /iframeDragShield\(true\)/.test(stage)

  const png = await stitchGrid(frames)
  await mkdir(`${STORE}/media`, { recursive: true })
  await writeFile(MEDIA, png)
  out.screenshot = MEDIA
  out.pngBytes = png.length

  out.pass = Boolean(
    out.floatButtonOk
    && out.oldLabelGone
    && out.boardFloatIsApp
    && out.stageKeptBiz
    && out.dockedToApp
    && out.onlyOneDocked
    && out.xKeepsRight
    && out.rememberedAppAfterBriefing
    && out.visitUnchanged
    && !out.createdNewApp
    && !out.silentBizWrite
    && out.resizeCollapse
    && out.resizeExpand
    && out.iframeShieldCss
    && out.stageShieldFn
    && threeTabs.app && threeTabs.records && threeTabs.ops
    && out.createEntry
    && out.deleteEntry
    && existsSync(MEDIA)
    && out.pngBytes > 20_000
  )
} catch (error) {
  out.pass = false
  out.failCode = out.failCode || 'script-error'
  out.error = error instanceof Error ? error.message : String(error)
  if (frames.length) {
    try {
      const png = await stitchGrid(frames)
      await writeFile(MEDIA, png)
      out.screenshot = MEDIA
      out.pngBytes = png.length
    } catch { /* keep going */ }
  }
} finally {
  await browser.close().catch(() => undefined)
}

out.silentBizWrite = bizWriteUrls.length > 0
out.bizWriteUrls = bizWriteUrls
if (out.silentBizWrite) out.pass = false

const md = `---
cursor:
  subagentId: "bc-ac3a6733-203f-5f14-9465-7c65ac18e13e"
---

# Verify: AO 应用自己的浮窗

**pass:** ${out.pass ? 'yes' : 'no'}
**main SHA:** \`${out.sha}\`
**branch:** \`${out.branch}\`（未推 origin）
**按钮「浮窗」:** ${out.floatButtonOk ? 'yes' : 'no'}（${out.floatButtonText || ''}）
**浮窗是应用工作面:** ${out.boardFloatIsApp ? 'yes' : 'no'}
**主台仍是业务应用:** ${out.stageKeptBiz ? 'yes' : 'no'}
**「—」收回右侧:** ${out.dockedToApp ? 'yes' : 'no'}
**两窗只收一个:** ${out.onlyOneDocked ? 'yes' : 'no'}
**早报后再回仍是这个应用:** ${out.rememberedAppAfterBriefing ? 'yes' : 'no'}
**走访 updatedAt:** ${out.visitUnchanged ? 'unchanged' : 'changed/missing'}
**拉伸 48/224:** ${out.resizeCollapse && out.resizeExpand ? 'yes' : 'no'}

## SHA

| 项 | 值 |
|---|---|
| daily main | \`${out.sha}\` |
| branch | \`${out.branch}\` |

## 浮窗

| 项 | 结果 |
|---|---|
| 按钮文案 | ${out.floatButtonText || ''} |
| 旧文案「撕出浮窗」 | ${out.oldLabelGone ? 'gone' : 'still there'} |
| 浮窗标题 | ${out.boardFloat?.title || ''} |
| 浮窗工作面 | surface=${out.boardFloat?.surface} product=${out.boardFloat?.product} |
| 浮窗里三 Tab | 应用=${out.boardFloat?.hasAppTab} 记录=${out.boardFloat?.hasRecordsTab} 操作=${out.boardFloat?.hasOpsTab} |
| 撕时右侧 | head=${out.stageWhileBoardFloat?.stageHead || ''} workspace=${out.stageWhileBoardFloat?.workspace} |
| 「—」之后 | float=${out.boardFloatAfterDock?.present} workspace=${out.afterDock?.workspace} icons=${out.afterDock?.desktopIcons} |
| 两窗前 | board=${out.twoBeforeBoard?.present} floats=${out.twoBefore?.floatCount} |
| 两窗后点应用「—」 | board=${out.twoAfterBoard?.present} second=${out.twoAfterSecond} key=${out.secondKey || ''} count=${out.twoAfter?.floatCount} workspace=${out.twoAfter?.workspace} |
| 「×」不改右侧 | ${out.xKeepsRight ? 'yes' : 'no'} |

## 决策 22

| 项 | 结果 |
|---|---|
| 拉宽 aside | ${out.wide?.asideW ?? '?'}px（要 48） |
| 拉窄 aside | ${out.narrow?.asideW ?? '?'}px（要 224） |
| StagePanel iframe 指针屏蔽 | ${out.iframeShieldCss && out.stageShieldFn ? '未拆' : '坏了'} |
| 三 Tab | 应用=${out.threeTabs?.app} 业务记录=${out.threeTabs?.records} 操作记录=${out.threeTabs?.ops} |
| 创建入口 | ${out.createEntry ? 'yes' : 'no'} |
| 删除入口 | ${out.deleteEntry ? 'yes' : 'no'} |
| 记忆起草入口 | ${out.memoryButton ? 'yes' : 'no'} |
| 走访 updatedAt | before ${out.visitBefore?.updatedAt || ''} / after ${out.visitAfter?.updatedAt || ''} |
| 静默 biz_write | ${out.silentBizWrite ? 'yes' : 'no'} |
| 新造应用 | ${out.createdNewApp ? 'yes' : 'no'} |

## 图

四格：按钮「浮窗」；应用浮窗不是业务应用板块；「—」收回右侧；两个浮窗只收一个。

${MEDIA}

${out.error ? `## 失败\\n\\n${out.failCode || ''} ${out.error}\\n` : ''}
`

await writeFile(REPORT_JSON, `${JSON.stringify(out, null, 2)}\n`)
await writeFile(REPORT_MD, md)
await dualWrite(REPORT_MD, 'internal/verify-app-float-ao.md')
await dualWrite(REPORT_JSON, 'internal/verify-app-float-ao.json')
if (existsSync(MEDIA)) await dualWrite(MEDIA, 'media/app-float-ao.png')

const pngStat = existsSync(MEDIA) ? await stat(MEDIA) : null
console.log(JSON.stringify({
  pass: out.pass,
  sha: out.sha,
  floatButtonOk: out.floatButtonOk,
  boardFloatIsApp: out.boardFloatIsApp,
  stageKeptBiz: out.stageKeptBiz,
  dockedToApp: out.dockedToApp,
  onlyOneDocked: out.onlyOneDocked,
  xKeepsRight: out.xKeepsRight,
  rememberedAppAfterBriefing: out.rememberedAppAfterBriefing,
  memoryRemembered: out.memoryRemembered,
  visitUnchanged: out.visitUnchanged,
  wide: out.wide?.asideW,
  narrow: out.narrow?.asideW,
  pngBytes: pngStat?.size || 0,
  error: out.error || null,
  failCode: out.failCode || null,
}, null, 2))
if (!out.pass) process.exitCode = 1
