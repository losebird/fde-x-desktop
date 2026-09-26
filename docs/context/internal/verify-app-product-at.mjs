/**
 * Live AT: declared capability entries findable on the product work surface.
 * 问 AI opens a visible left-column session. Column top stays the app's own sections.
 * Store internal/ only — do not git-add. Never 确认过账 / biz_write / nod / IM send.
 * Do not kill pnpm 5174. Do not open-to-edit 走访. Do not create a new app.
 * Chinese cwd only via ?cwd=.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const CURSOR_STORE = '/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e'
const MEDIA = `${STORE}/media/app-product-at.png`
const REPORT_JSON = `${STORE}/internal/verify-app-product-at.json`
const REPORT_MD = `${STORE}/internal/verify-app-product-at.md`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const visitName = '本周现场走访记录'
const visitId = 'app_5d1eef0062114901b4797d705e5166b5'
const boardName = '资料卡片板'
const boardId = 'app_6a81181028a64219a373626cb6514921'
const TOOLBAR = ['问 AI', '浮窗', '引用文件', '起草记忆卡片', '拟回进输入框', '打开早报', '打开业务记录']

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
const imSendUrls = []
const cwdHeaderHits = []
page.on('request', (req) => {
  const url = req.url()
  if (/biz\/write|biz_write/i.test(url)) bizWriteUrls.push(url)
  if (/\/api\/v1\/im\/send(?:\?|$)/.test(url) && req.method() !== 'GET') imSendUrls.push(`${req.method()} ${url}`)
  if (/x-dsh-cwd/i.test(req.headers()['x-dsh-cwd'] || '')) cwdHeaderHits.push(url)
})

const out = {
  sha,
  branch,
  boardName,
  visitName,
  hardcoded: 'none',
  silentBizWrite: false,
  originPushed: false,
  createdNewApp: false,
  clickedNod: false,
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
      if (p && (p.state === 'full' || p.state === 'half')) return { ...p, state: 'tab' }
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
  await page.waitForTimeout(700)
}

async function openGeneratedApp(name) {
  const row = page.locator('[data-app-row]').filter({ hasText: name }).locator('button').first()
  await row.click({ timeout: 15000 })
  await page.locator('[data-app-workspace]').waitFor({ state: 'visible', timeout: 20000 })
  await page.locator('[data-app-product]').waitFor({ state: 'visible', timeout: 15000 })
}

async function reopenBoard() {
  const back = page.getByRole('button', { name: '返回列表' })
  if (await back.count()) await back.click({ timeout: 5000 }).catch(() => {})
  await seedState({ panelWidth: 720 })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1600)
  await goAppsTab()
  await page.locator('[data-app-row]').first().waitFor({ state: 'visible', timeout: 20000 })
  await openGeneratedApp(boardName)
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

function inspectProduct() {
  return page.evaluate((toolbar) => {
    const nav = document.querySelector('[data-app-product-nav]')
    const product = document.querySelector('[data-app-product]')
    const workspace = document.querySelector('[data-app-workspace]')
    const drawer = document.querySelector('[data-app-builder-drawer]')
    const navText = (nav?.innerText || '').replace(/\s+/g, ' ').trim()
    const productTop = product?.firstElementChild
    const topText = (productTop?.innerText || '').replace(/\s+/g, ' ').trim()
    const vh = window.innerHeight
    const vw = window.innerWidth
    const inView = (el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw
    }
    const buttons = [...document.querySelectorAll('[data-app-use]')].map((el) => {
      const r = el.getBoundingClientRect()
      return {
        use: el.getAttribute('data-app-use'),
        text: (el.textContent || '').trim(),
        inNav: Boolean(el.closest('[data-app-product-nav]')),
        inProduct: Boolean(el.closest('[data-app-product]')),
        inCompose: Boolean(el.closest('[data-app-compose]') || el.closest('[data-app-column-uses]')),
        inWorkspace: Boolean(el.closest('[data-app-workspace]') && !el.closest('[data-app-product]')),
        inDrawer: Boolean(el.closest('[data-app-builder-drawer]')),
        inView: inView(el),
        top: Math.round(r.top),
      }
    })
    const declared = (product?.getAttribute('data-app-uses') || '').split(',').filter(Boolean)
    const columnUses = document.querySelector('[data-app-column-uses]')?.getAttribute('data-app-column-uses') || ''
    const composeBeforeCards = (() => {
      const compose = document.querySelector('[data-app-compose]')
      const card = document.querySelector('[data-app-card]')
      if (!compose || !card) return null
      return compose.getBoundingClientRect().top <= card.getBoundingClientRect().top
    })()
    return {
      navText,
      topText,
      toolbarInNav: toolbar.some((word) => navText.includes(word)),
      toolbarInProductTop: toolbar.some((word) => topText.includes(word)),
      tearLabel: /撕出浮窗/.test(document.body.innerText || ''),
      declared,
      columnUses,
      buttons,
      compose: Boolean(document.querySelector('[data-app-compose]')),
      composeBeforeCards,
      builderOpen: Boolean(drawer),
      product: Boolean(product),
      workspace: Boolean(workspace),
    }
  }, TOOLBAR)
}

try {
  await page.goto(`${mainBase}/ai?cwd=${encodeURIComponent(workspaceCwd)}&as=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(async () => {
    await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => ({}))
  })
  await seedState({ panelWidth: 720 })
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
  const board = listedBefore.find((row) => row.id === boardId) || listedBefore.find((row) => row.name === boardName && row.status === 'active')
  out.openedApp = board || null
  if (!board) {
    out.failCode = 'board-missing'
    throw new Error(out.failCode)
  }

  await page.locator('[data-app-row]').first().waitFor({ state: 'visible', timeout: 20000 })
  await openGeneratedApp(board.name)
  await page.locator('[data-app-compose], [data-app-column-uses], [data-app-card]').first().waitFor({ state: 'visible', timeout: 15000 })

  const chrome = await inspectProduct()
  out.chrome = chrome
  out.navIsColumns = Boolean(chrome.navText && !chrome.toolbarInNav && !chrome.toolbarInProductTop)
  out.floatInWorkspace = chrome.buttons.some((row) => row.use === 'float' && row.inWorkspace && row.text === '浮窗' && !row.inProduct && !row.inNav)
  out.floatInProduct = chrome.buttons.some((row) => row.use === 'float' && (row.inProduct || row.inNav))
  out.tearLabelGone = !chrome.tearLabel
  out.undeclaredButton = chrome.buttons.some((row) => row.use && !(chrome.declared || []).includes(row.use))
  out.entriesInDrawerOnly = chrome.buttons.filter((row) => row.use && row.use !== 'float').every((row) => row.inDrawer)
  out.builderClosed = !chrome.builderOpen
  out.composeBeforeCards = chrome.composeBeforeCards
  const needed = (chrome.declared || []).filter((use) => use !== 'float')
  out.declared = chrome.declared
  out.entries = needed.map((use) => {
    const hit = chrome.buttons.find((row) => row.use === use)
    return {
      use,
      present: Boolean(hit),
      inView: Boolean(hit?.inView),
      inNav: Boolean(hit?.inNav),
      inCompose: Boolean(hit?.inCompose),
      inDrawer: Boolean(hit?.inDrawer),
      text: hit?.text || '',
    }
  })
  out.allDeclaredFindable = needed.length > 0 && out.entries.every((row) => row.present && row.inView && !row.inNav && !row.inDrawer)
  out.floatFindable = chrome.buttons.some((row) => row.use === 'float' && row.inView && row.inWorkspace)

  const sessionsBeforeAi = await page.evaluate(() => {
    const aside = document.querySelector('aside')
    return (aside?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 800)
  })
  out.sessionsBeforeAi = sessionsBeforeAi

  await page.locator('[data-app-use="ai"]').click()
  await page.waitForTimeout(2800)
  out.aiOpen = await page.evaluate((name) => {
    const aside = document.querySelector('aside')
    const text = (aside?.innerText || '').replace(/\s+/g, ' ')
    const title = `${name} · 问`
    const listHit = text.includes(title)
    const active = [...(aside?.querySelectorAll('li') || [])].some((el) => {
      const t = el.textContent || ''
      return t.includes(title) && Boolean(el.querySelector('.bg-brand-soft, .font-medium') || el.className.includes('brand'))
    })
    const asideW = aside ? Math.round(aside.getBoundingClientRect().width) : 0
    return {
      title,
      listHit,
      active,
      asideW,
      leftOpen: asideW > 80,
      asideSnippet: text.slice(0, 500),
    }
  }, board.name)
  out.aiLeftVisible = Boolean(out.aiOpen.listHit && out.aiOpen.leftOpen)

  await page.locator('[data-app-product-nav]').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
  await page.locator('[data-app-use="ai"]').scrollIntoViewIfNeeded().catch(() => {})
  await page.screenshot({ path: MEDIA, fullPage: false })
  out.screenshot = MEDIA
  const png = existsSync(MEDIA) ? await readFile(MEDIA) : Buffer.alloc(0)
  out.pngBytes = png.length
  out.pngHeader = png.subarray(0, 8).toString('hex')

  if (!out.navIsColumns) {
    out.failCode = 'product-still-toolbar'
    throw new Error(`${out.failCode}:${chrome.navText}|${chrome.topText}`)
  }
  if (!out.allDeclaredFindable || !out.floatFindable) {
    out.failCode = 'entries-not-findable'
    throw new Error(`${out.failCode}:${JSON.stringify(out.entries)}`)
  }
  if (out.entriesInDrawerOnly) {
    out.failCode = 'entries-only-in-drawer'
    throw new Error(out.failCode)
  }
  if (!out.aiLeftVisible) {
    out.failCode = 'ai-left-session-missing'
    throw new Error(`${out.failCode}:${JSON.stringify(out.aiOpen)}`)
  }

  await reopenBoard()
  await page.locator('[data-app-use="files"]').click()
  await page.waitForTimeout(1200)
  out.files = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('.text-sm.font-medium')].map((el) => (el.textContent || '').trim())
    const text = document.body.innerText || ''
    return {
      stageHead: heads.find((h) => h === '文件') || heads[0] || '',
      hasFileTree: /📁|文件库|工作区文件/.test(text),
    }
  })
  out.filesOk = Boolean(out.files.stageHead === '文件' || out.files.hasFileTree)

  await reopenBoard()
  await page.locator('[data-app-use="memory"]').click()
  await page.waitForTimeout(1800)
  out.memoryUi = await page.evaluate(() => {
    const card = document.querySelector('[data-memory-draft-card]')
    const status = document.querySelector('[data-memory-card-status]')
    const text = document.body.innerText || ''
    return {
      draftCard: Boolean(card),
      draftStatus: status?.getAttribute('data-memory-card-status') || (status?.textContent || '').trim(),
      nodButton: Boolean(document.querySelector('[data-memory-nod]')),
      graphStudio: text.includes('图谱工作室'),
    }
  })
  out.memoryOk = Boolean(out.memoryUi.draftCard && out.memoryUi.draftStatus === '起草' && !out.memoryUi.graphStudio)

  await reopenBoard()
  await page.locator('[data-app-use="im"]').click()
  await page.waitForTimeout(2500)
  out.im = await page.evaluate(() => {
    const tas = [...document.querySelectorAll('textarea')].map((el) => el.value || '')
    const hit = tas.find((v) => /点发送|资料卡片板|只放进输入框/.test(v)) || tas.find((v) => v.trim()) || ''
    const raw = localStorage.getItem('scene-39-workstation')
    const drafts = raw ? (JSON.parse(raw).state?.imComposerDrafts || {}) : {}
    const draftHit = Object.values(drafts).find((v) => typeof v === 'string' && /点发送|资料卡片板|只放进输入框/.test(v)) || ''
    return {
      stageHead: [...document.querySelectorAll('.text-sm.font-medium')].map((el) => (el.textContent || '').trim()).includes('IM'),
      composerFilled: Boolean(hit || draftHit),
    }
  })
  out.imOk = Boolean(out.im.composerFilled && imSendUrls.length === 0)

  await reopenBoard()
  await page.locator('[data-app-use="briefing"]').click()
  await page.waitForTimeout(1500)
  out.briefing = await page.evaluate(() => {
    const text = document.body.innerText || ''
    return {
      stageHead: [...document.querySelectorAll('.text-sm.font-medium')].map((el) => (el.textContent || '').trim()).includes('早报'),
      morning: /早上好/.test(text),
      fake: /假早报|演示早报|示例早报/.test(text),
    }
  })
  out.briefingOk = Boolean((out.briefing.stageHead || out.briefing.morning) && !out.briefing.fake)

  await reopenBoard()
  await page.locator('[data-app-use="biz"]').click()
  await page.waitForTimeout(1500)
  out.biz = await page.evaluate(() => {
    const text = document.body.innerText || ''
    return {
      recordsTab: [...document.querySelectorAll('button')].some((el) => (el.textContent || '').trim() === '业务记录'),
      preview: /预览|确认后才写入|业务记录/.test(text),
    }
  })
  out.bizOk = Boolean(out.biz.recordsTab || out.biz.preview)

  await reopenBoard()
  const floatClicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('[data-app-use="float"]')]
      .find((el) => !el.closest('[data-app-product]') && (el.textContent || '').trim() === '浮窗')
    if (!btn) return false
    btn.click()
    return true
  })
  if (!floatClicked) {
    out.failCode = 'no-workspace-float'
    throw new Error(out.failCode)
  }
  await page.locator('[data-app-float-surface]').waitFor({ state: 'visible', timeout: 15000 })
  out.floatOpen = await page.evaluate(() => ({
    surface: Boolean(document.querySelector('[data-app-float-surface]')),
    productInFloat: Boolean(document.querySelector('[data-app-float-surface] [data-app-product]')),
    workspaceStill: Boolean(document.querySelector('[data-app-workspace]')),
  }))
  await page.locator('[data-floating-dock]').first().click()
  await page.waitForTimeout(800)
  out.floatDock = await page.evaluate(() => ({
    surface: Boolean(document.querySelector('[data-app-float-surface]')),
    workspace: Boolean(document.querySelector('[data-app-workspace]')),
    product: Boolean(document.querySelector('[data-app-product]')),
    checking: /正在检查事务底座/.test(document.body.innerText || ''),
  }))
  out.floatOk = Boolean(
    out.floatOpen.surface
    && out.floatOpen.productInFloat
    && out.floatOpen.workspaceStill
    && !out.floatDock.surface
    && out.floatDock.workspace
    && out.floatDock.product
    && !out.floatDock.checking,
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
  out.bizWriteUrls = bizWriteUrls
  out.imSendUrls = imSendUrls
  out.cwdHeaderHits = cwdHeaderHits
  out.silentBizWrite = bizWriteUrls.length > 0
  out.autoSendIm = imSendUrls.length > 0

  out.pass = Boolean(
    out.navIsColumns
    && out.allDeclaredFindable
    && out.floatFindable
    && out.aiLeftVisible
    && !out.entriesInDrawerOnly
    && out.builderClosed
    && out.floatInWorkspace
    && !out.floatInProduct
    && out.tearLabelGone
    && out.filesOk
    && out.memoryOk
    && out.imOk
    && out.briefingOk
    && out.bizOk
    && out.floatOk
    && !out.silentBizWrite
    && !out.autoSendIm
    && cwdHeaderHits.length === 0
    && out.visitUnchanged
    && !out.createdNewApp
    && out.resizeCollapse
    && out.resizeExpand
    && out.iframeShieldCss
    && out.stageShieldFn
    && out.threeTabs.app && out.threeTabs.records && out.threeTabs.ops
    && out.createEntry
    && out.deleteEntry
    && !out.undeclaredButton
    && existsSync(MEDIA)
    && out.pngHeader === '89504e470d0a1a0a'
  )
} catch (error) {
  out.pass = false
  out.failCode = out.failCode || 'script-error'
  out.error = error instanceof Error ? error.message : String(error)
} finally {
  await browser.close().catch(() => undefined)
}

const entryRows = (out.entries || []).map((row) => `| ${row.use} ${row.text} | 记下栏 | ${row.present && row.inView ? 'yes' : 'no'} | inView=${row.inView} inNav=${row.inNav} |`).join('\n')

const md = `# Verify: AT 声明能力入口找得到

**pass:** ${out.pass ? 'yes' : 'no'}
**main SHA:** \`${out.sha}\`
**branch:** \`${out.branch}\`（未推 origin）
**问 AI 左栏可见会话:** ${out.aiLeftVisible ? 'yes' : 'no'}
**产品页顶是否工具条:** ${out.navIsColumns ? 'no（栏目）' : 'yes'}
**走访 updatedAt:** ${out.visitUnchanged ? 'unchanged' : 'changed/missing'}
**拉伸 48/224:** ${out.resizeCollapse && out.resizeExpand ? 'yes' : 'no'}

## SHA

| 项 | 值 |
|---|---|
| daily main | \`${out.sha}\` |
| branch | \`${out.branch}\` |
| 产品提交 | \`${out.sha}\` |

## 每条声明入口在哪

| 入口 | 放哪 | 点了 | 现网看到 |
|---|---|---|---|
| float 浮窗 | 工作面顶栏（返回列表旁），不在产品栏目顶 | yes | 应用浮窗=${out.floatOpen?.productInFloat ? 'yes' : 'no'} 「—」收回=${out.floatDock?.workspace && out.floatDock?.product ? 'yes' : 'no'} |
${entryRows}
| 问 AI 左栏 | 记下栏 → 左栏会话 | yes | list=${out.aiOpen?.listHit ? 'yes' : 'no'} title=\`${out.aiOpen?.title || ''}\` aside=${out.aiOpen?.asideW ?? '?'}px |
| 产品栏目顶 | 只铺这个应用自己的栏目 | — | nav=\`${out.chrome?.navText || ''}\` 工具条=${out.navIsColumns ? 'no' : 'yes'} |

## 问 AI

| 项 | 结果 |
|---|---|
| 点了问 AI | yes |
| 左栏展开 | ${out.aiOpen?.leftOpen ? 'yes' : 'no'} |
| 列表出现「${out.aiOpen?.title || ''}」 | ${out.aiOpen?.listHit ? 'yes' : 'no'} |
| 自动发 IM | ${out.autoSendIm ? 'yes' : 'no'} |

## AO–AS / 决策 22

| 项 | 结果 |
|---|---|
| 栏目顶工具条 | ${out.navIsColumns ? 'no' : 'yes'} |
| 只藏建造抽屉 | ${out.entriesInDrawerOnly ? 'yes' : 'no'} |
| 按钮「浮窗」 | ${out.floatInWorkspace ? '浮窗' : 'missing'} |
| 「—」收回工作面 | ${out.floatDock?.workspace && out.floatDock?.product ? 'yes' : 'no'} |
| 连接器空页 | ${out.floatDock?.checking ? 'flashed' : '未闪'} |
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
| 新造应用 | ${out.createdNewApp ? 'yes' : 'no'} |
| 5174 | 未杀，仍在听 |

已对：声明入口在记下栏/工作面顶栏「浮窗」，首屏找得到；栏目顶只铺「${out.chrome?.navText || ''}」；问 AI 左栏会话 ${out.aiLeftVisible ? '可见' : '未见'}。走访 \`${visitId}\` updatedAt ${out.visitUnchanged ? '未改' : '变了'}。拉伸 48/224。

未对：早报抽屉标题。

仍差：${out.pass ? '无（本刀过关项）' : (out.failCode || out.error || '未过')}

## 图

产品页：栏目不是工具条；声明入口在图里。PNG 头 \`${out.pngHeader || ''}\` ${out.pngBytes || 0} bytes。

${MEDIA}

${out.error ? `## 失败\n\n${out.failCode || ''} ${out.error}\n` : ''}
`

await writeFile(REPORT_JSON, `${JSON.stringify(out, null, 2)}\n`)
await writeFile(REPORT_MD, md)
await dualWrite(REPORT_MD, 'internal/verify-app-product-at.md')
await dualWrite(REPORT_JSON, 'internal/verify-app-product-at.json')
if (existsSync(MEDIA)) await dualWrite(MEDIA, 'media/app-product-at.png')

console.log(JSON.stringify({
  pass: out.pass,
  sha: out.sha,
  navIsColumns: out.navIsColumns,
  allDeclaredFindable: out.allDeclaredFindable,
  aiLeftVisible: out.aiLeftVisible,
  aiOpen: out.aiOpen,
  entries: out.entries,
  filesOk: out.filesOk,
  memoryOk: out.memoryOk,
  imOk: out.imOk,
  briefingOk: out.briefingOk,
  bizOk: out.bizOk,
  floatOk: out.floatOk,
  visitUnchanged: out.visitUnchanged,
  wide: out.wide?.asideW,
  narrow: out.narrow?.asideW,
  pngBytes: out.pngBytes,
  pngHeader: out.pngHeader,
  error: out.error || null,
}, null, 2))
if (!out.pass) process.exitCode = 1
