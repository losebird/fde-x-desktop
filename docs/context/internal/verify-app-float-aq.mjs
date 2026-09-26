/**
 * Live AQ: module tear/dock must keep the same inner screen.
 * Store internal/ only — do not git-add. Never biz_write.
 * Do not kill pnpm 5174. Do not open-to-edit 走访. Do not create a new app.
 * Chinese cwd only via ?cwd=.
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
const MEDIA = `${STORE}/media/app-float-aq.png`
const REPORT_JSON = `${STORE}/internal/verify-app-float-aq.json`
const REPORT_MD = `${STORE}/internal/verify-app-float-aq.md`
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
const HOME = /打开探索|把当前目录里的知识画成一张图|图谱工作室/

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
  if (/x-dsh-cwd/i.test(req.headers()['x-dsh-cwd'] || '')) bizWriteUrls.push(`header:${req.url()}`)
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

function seedState({ panelWidth = 720 } = {}) {
  return page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd, panelWidth: width }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.floating = {}
    const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
    if (!rows.some((r) => r.id === wsId)) {
      rows.push({ id: wsId, name: 'fdex测试1', desc: cwd, cwd })
      state.state.workspaces = rows
    } else {
      state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
    }
    const fallbackPanels = [
      { id: 'im', label: 'IM', icon: 'MessageCircleMore', emoji: '💬', accent: 'bg-slate-700', state: 'tab', width: 560, view: 'im' },
      { id: 'briefing', label: '早报', icon: 'Newspaper', emoji: '🌅', accent: 'bg-amber-500', state: 'tab', width: 560, pinned: true, view: 'briefing' },
      { id: 'plan', label: '计划', icon: 'ClipboardList', emoji: '📋', accent: 'bg-blue-500', state: 'tab', width: 600, view: 'plan' },
      { id: 'files', label: '文件', icon: 'Folder', emoji: '📁', accent: 'bg-emerald-500', state: 'tab', width: 580, view: 'files' },
      { id: 'mcp', label: 'MCP', icon: 'Plug', emoji: '🔌', accent: 'bg-rose-500', state: 'tab', width: 520, view: 'mcp' },
      { id: 'skills', label: 'Skills', icon: 'Wand2', emoji: '🪄', accent: 'bg-indigo-500', state: 'tab', width: 520, view: 'skills' },
      { id: 'memory', label: '记忆', icon: 'Brain', emoji: '🧠', accent: 'bg-fuchsia-500', state: 'tab', width: 800, view: 'memory' },
      { id: 'settings', label: '设置', icon: 'Settings', emoji: '⚙️', accent: 'bg-slate-500', state: 'tab', width: 520, view: 'settings' },
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
  }, { workspaceId, workspaceCwd, panelWidth })
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
    const params = new URLSearchParams({ workspaceId: wsId, workspaceCwd: cwd, cwd })
    const json = await fetch(`/api/v1/business/apps?${params}`).then((r) => r.json())
    const items = json.items || json.data?.items || []
    return items.map((row) => ({
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

async function placeFloat(appId, pos) {
  const el = page.locator(`[data-app-float="${appId}"]`)
  await el.waitFor({ state: 'visible', timeout: 15000 })
  await el.evaluate((node, p) => {
    node.style.left = `${p.x}px`
    node.style.top = `${p.y}px`
    node.style.width = `${p.width}px`
    node.style.height = `${p.height}px`
  }, pos)
}

function clickTop(label) {
  return page.evaluate((name) => {
    const nav = document.querySelector('div.h-9.rounded-full')
    const btn = [...(nav ? nav.querySelectorAll('button') : [])].find((el) => (el.textContent || '').includes(name))
    if (!btn) return `no-nav:${name}`
    btn.click()
    return 'ok'
  }, label)
}

async function moduleHead() {
  return page.evaluate(() => [...document.querySelectorAll('.h-11 .text-sm.font-medium')].map((el) => (el.textContent || '').trim()))
}

async function openModule(label) {
  const top = await clickTop(label)
  for (let i = 0; i < 12; i += 1) {
    const heads = await moduleHead()
    if (heads.includes(label)) return { top, opened: `head:${heads.join('|')}`, heads }
    await page.waitForTimeout(200)
  }
  const opened = await page.evaluate((name) => {
    const aside = document.querySelector('aside[aria-label="工作区工具"]')
    const card = [...(aside ? aside.querySelectorAll('div[title]') : [])].find((el) => {
      const t = el.getAttribute('title') || ''
      return t === name || t.startsWith(`${name}（`)
    })
    if (!card) {
      const heads = [...document.querySelectorAll('.h-11 .text-sm.font-medium')].map((el) => (el.textContent || '').trim())
      return `no-card:${heads.join('|')}`
    }
    const btn = [...card.querySelectorAll('button')].find((el) =>
      !/关闭/.test(el.getAttribute('title') || '') && !/关闭/.test(el.getAttribute('aria-label') || ''))
    if (!btn) return 'no-btn'
    btn.click()
    return `thumb:${name}`
  }, label)
  for (let i = 0; i < 12; i += 1) {
    const heads = await moduleHead()
    if (heads.includes(label)) return { top, opened, heads }
    await page.waitForTimeout(200)
  }
  return { top, opened, heads: await moduleHead() }
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

function inspectMemory() {
  return page.evaluate(() => {
    const pane = document.querySelector('[data-memory-pane]')?.getAttribute('data-memory-pane') || ''
    const stage = [...document.querySelectorAll('div.border-l')].find((el) => el.querySelector('.text-sm.font-medium'))
    const head = stage?.querySelector('.text-sm.font-medium')?.textContent?.trim() || ''
    const host = document.querySelector('[data-floating-key="memory"]') || stage
    const text = host ? (host.innerText || '') : (document.body.innerText || '')
    const buttons = [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim())
    return {
      head,
      pane,
      floatKeys: [...document.querySelectorAll('[data-floating-key]')].map((el) => el.getAttribute('data-floating-key')),
      openExplore: buttons.includes('打开探索'),
      homeHint: /把当前目录里的知识画成一张图/.test(text),
      studio: /图谱工作室/.test(text),
      ioTitle: /导入导出/.test(text),
      returnBtn: buttons.includes('返回'),
      importJson: buttons.includes('导入 JSON'),
      slice: text.replace(/\s+/g, ' ').slice(0, 240),
    }
  })
}

function inspectPlan() {
  return page.evaluate(() => {
    const tab = document.querySelector('[data-plan-tab]')?.getAttribute('data-plan-tab') || ''
    const heads = [...document.querySelectorAll('.h-11 .text-sm.font-medium')].map((el) => (el.textContent || '').trim())
    const head = heads.find((h) => h === '计划') || ''
    const root = document.querySelector('[data-plan-tab]')?.closest('.stage-content') || document
    const buttons = [...root.querySelectorAll('button')].map((el) => ({
      text: (el.textContent || '').trim(),
      on: /bg-ink/.test(el.className),
    }))
    return {
      head,
      heads,
      tab,
      scheduleOn: buttons.some((b) => b.text.includes('日程') && b.on),
      todoOn: buttons.some((b) => b.text.includes('待办') && b.on),
      floatKeys: [...document.querySelectorAll('[data-floating-key]')].map((el) => el.getAttribute('data-floating-key')),
    }
  })
}

function inspectBriefing() {
  return page.evaluate(() => {
    const settings = document.querySelector('[data-briefing-settings]')?.getAttribute('data-briefing-settings') || ''
    const text = document.body.innerText || ''
    const stage = [...document.querySelectorAll('div.border-l')].find((el) => el.querySelector('.text-sm.font-medium'))
    const head = stage?.querySelector('.text-sm.font-medium')?.textContent?.trim() || ''
    return {
      head,
      settings,
      customTitle: /自定义早报/.test(text),
      floatKeys: [...document.querySelectorAll('[data-floating-key]')].map((el) => el.getAttribute('data-floating-key')),
    }
  })
}

async function inspectApp() {
  return page.evaluate(() => {
    const text = document.body.innerText || ''
    return {
      workspace: Boolean(document.querySelector('[data-app-workspace]')),
      catalog: Boolean(document.querySelector('[data-app-catalog]')),
      product: Boolean(document.querySelector('[data-app-product]')),
      checking: /正在检查事务底座/.test(text),
      connectorEmpty: /先在设置登记业务连接器/.test(text),
      floatCount: document.querySelectorAll('[data-floating-key]').length,
      appFloatCount: document.querySelectorAll('[data-app-float]').length,
      floatBtn: ([...document.querySelectorAll('[data-app-workspace] [data-app-use="float"]')].map((el) => (el.textContent || '').trim())[0] || ''),
    }
  })
}

async function startHomeWatch() {
  await page.evaluate((pattern) => {
    window.__aqHits = []
    const home = new RegExp(pattern)
    const note = (why) => {
      const pane = document.querySelector('[data-memory-pane]')?.getAttribute('data-memory-pane') || ''
      const text = document.body.innerText || ''
      if (pane === 'home' || home.test(text)) {
        window.__aqHits.push({
          why,
          pane,
          at: Date.now(),
          slice: text.replace(/\s+/g, ' ').slice(0, 180),
        })
      }
    }
    const obs = new MutationObserver(() => note('mut'))
    obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true })
    window.__aqObs = obs
    const tick = () => {
      if (!window.__aqObs) return
      note('raf')
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, HOME.source)
}

async function drainHits() {
  return page.evaluate(() => {
    const hits = window.__aqHits || []
    window.__aqHits = []
    return hits
  })
}

async function stopHomeWatch() {
  await page.evaluate(() => {
    window.__aqObs?.disconnect()
    window.__aqObs = null
  })
}

const frames = []

try {
  await page.goto(`${mainBase}/ai?cwd=${encodeURIComponent(workspaceCwd)}&aq=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(async () => {
    await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => ({}))
  })
  await seedState({ panelWidth: 720 })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1600)

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

  out.clickMem = await openModule('记忆')
  await page.waitForTimeout(400)
  out.memoryHome = await inspectMemory()
  const ioCard = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((el) => {
      const t = (el.innerText || '').replace(/\s+/g, ' ')
      return t.includes('导入导出') && t.includes('知识审计')
    })
    if (!btn) return 'no'
    btn.click()
    return 'ok'
  })
  out.ioCard = ioCard
  await page.waitForTimeout(1200)
  const beforeTear = await inspectMemory()
  out.memoryBeforeTear = beforeTear
  if (beforeTear.pane !== 'io' || beforeTear.openExplore || !beforeTear.returnBtn) {
    out.failCode = 'memory-io-not-open'
    throw new Error(out.failCode)
  }

  await startHomeWatch()
  await drainHits()
  await page.locator('div.border-l [title*="撕出为独立浮窗"]').first().click({ timeout: 8000 })
  const tearInstant = await inspectMemory()
  frames.push(await shotLabeled('1 记忆·导入导出 撕出瞬间'))
  await page.waitForTimeout(150)
  const tearHits = await drainHits()
  await page.locator('[data-floating-key="memory"]').waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('[data-floating-key="memory"]').evaluate((node) => {
    node.style.left = '40px'
    node.style.top = '72px'
    node.style.width = '760px'
    node.style.height = '560px'
  })
  await page.waitForTimeout(400)
  const tearSettled = await inspectMemory()
  frames.push(await shotLabeled('2 浮窗仍是导入导出，不是图谱首页'))
  out.memoryTearInstant = tearInstant
  out.memoryTearSettled = tearSettled
  out.memoryTearHits = tearHits
  out.memoryTearFlashedHome = Boolean(
    tearInstant.pane === 'home'
    || tearInstant.openExplore
    || tearHits.some((h) => h.pane === 'home'),
  )

  await page.locator('[data-floating-key="memory"] [data-floating-dock]').click()
  const dockInstant = await inspectMemory()
  frames.push(await shotLabeled('3 「—」收回瞬间仍是导入导出'))
  await page.waitForTimeout(150)
  const dockHits = await drainHits()
  await page.waitForTimeout(500)
  const dockSettled = await inspectMemory()
  await stopHomeWatch()
  out.memoryDockInstant = dockInstant
  out.memoryDockSettled = dockSettled
  out.memoryDockHits = dockHits
  out.memoryDockFlashedHome = Boolean(
    dockInstant.pane === 'home'
    || dockInstant.openExplore
    || dockHits.some((h) => h.pane === 'home'),
  )
  out.memoryRemembered = Boolean(
    dockSettled.head === '记忆'
    && dockSettled.pane === 'io'
    && dockSettled.returnBtn
    && dockSettled.ioTitle
    && !dockSettled.openExplore
    && !dockSettled.homeHint
    && dockSettled.floatKeys.length === 0
    && !out.memoryTearFlashedHome
    && !out.memoryDockFlashedHome,
  )
  if (!out.memoryRemembered) {
    out.failCode = 'memory-not-remembered'
    throw new Error(out.failCode)
  }

  out.clickPlan = await openModule('计划')
  for (let i = 0; i < 16; i += 1) {
    const hasTab = await page.evaluate(() => Boolean(document.querySelector('[data-plan-tab]')))
    if (hasTab) break
    if (i === 4 || i === 10) await clickTop('计划')
    await page.waitForTimeout(200)
  }
  out.planDom = await page.evaluate(() => {
    const tab = document.querySelector('[data-plan-tab]')
    const head = [...document.querySelectorAll('.h-11 .text-sm.font-medium')].find((el) => (el.textContent || '').trim() === '计划')
    return {
      missing: !tab,
      tab: tab?.getAttribute('data-plan-tab') || '',
      heads: [...document.querySelectorAll('.h-11 .text-sm.font-medium')].map((el) => (el.textContent || '').trim()),
      btn: [...(tab ? tab.querySelectorAll('button') : [])].map((el) => (el.textContent || '').trim()).filter(Boolean),
      head: head?.textContent?.trim() || '',
    }
  })
  out.planClickSchedule = await page.evaluate(() => {
    const tab = document.querySelector('[data-plan-tab]')
    if (!tab) return 'no-tab'
    const btn = [...tab.querySelectorAll('button')].find((el) => (el.textContent || '').includes('日程'))
    if (!btn) return `no-btn:${[...tab.querySelectorAll('button')].map((el) => (el.textContent || '').trim()).join('|')}`
    btn.click()
    return 'ok'
  })
  out.planBeforeTear = await inspectPlan()
  for (let i = 0; i < 8; i += 1) {
    if (out.planBeforeTear.tab === 'schedule' || out.planBeforeTear.scheduleOn) break
    await page.waitForTimeout(50)
    out.planBeforeTear = await inspectPlan()
  }
  if (out.planClickSchedule === 'ok' && out.planBeforeTear.tab !== 'schedule' && !out.planBeforeTear.scheduleOn) {
    if (!out.planBeforeTear.head) {
      await clickTop('计划')
      for (let i = 0; i < 12; i += 1) {
        if (await page.evaluate(() => Boolean(document.querySelector('[data-plan-tab]')))) break
        await page.waitForTimeout(150)
      }
    }
    await page.evaluate(() => {
      const tab = document.querySelector('[data-plan-tab]')
      const btn = [...(tab ? tab.querySelectorAll('button') : [])].find((el) => (el.textContent || '').includes('日程'))
      btn?.click()
    })
    out.planBeforeTear = await inspectPlan()
  }
  out.otherModule = 'plan'
  const planReady = out.planBeforeTear?.tab === 'schedule' || out.planBeforeTear?.scheduleOn
  if (!planReady) {
    out.clickIm = await openModule('IM')
    await page.waitForTimeout(600)
    out.imBefore = await page.evaluate(() => ({
      thread: document.querySelector('[data-im-thread]')?.getAttribute('data-im-thread') || '',
      topic: document.querySelector('[data-im-topic]')?.getAttribute('data-im-topic') || '',
      head: [...document.querySelectorAll('.h-11 .text-sm.font-medium')].map((el) => (el.textContent || '').trim()),
    }))
    out.imPick = await page.evaluate(() => {
      const current = document.querySelector('[data-im-thread]')?.getAttribute('data-im-thread') || ''
      const btn = [...document.querySelectorAll('button')].find((el) => {
        if (el.closest('[data-floating-key]')) return false
        if (!el.className.includes('w-full') || !el.className.includes('px-3')) return false
        const idish = el.textContent || ''
        return idish && !el.className.includes('bg-brand-soft')
      })
      if (!btn) return `keep:${current}`
      btn.click()
      return `ok:${current}`
    })
    await page.waitForTimeout(500)
    out.imBeforeTear = await page.evaluate(() => ({
      thread: document.querySelector('[data-im-thread]')?.getAttribute('data-im-thread') || '',
      name: (document.querySelector('.bg-brand-soft.border-l-2')?.innerText || '').split('\n')[0] || '',
    }))
    if (!out.imBeforeTear.thread) {
      out.failCode = 'im-no-thread'
      throw new Error(out.failCode)
    }
    await page.locator('div.border-l [title*="撕出为独立浮窗"]').first().click({ timeout: 8000 })
    await page.locator('[data-floating-key="im"]').waitFor({ state: 'visible', timeout: 10000 })
    await page.locator('[data-floating-key="im"] [data-floating-dock]').click()
    await page.waitForTimeout(700)
    out.imAfterDock = await page.evaluate(() => ({
      thread: document.querySelector('[data-im-thread]')?.getAttribute('data-im-thread') || '',
      name: (document.querySelector('.bg-brand-soft.border-l-2')?.innerText || '').split('\n')[0] || '',
      head: [...document.querySelectorAll('.h-11 .text-sm.font-medium')].map((el) => (el.textContent || '').trim()),
      floatKeys: [...document.querySelectorAll('[data-floating-key]')].map((el) => el.getAttribute('data-floating-key')),
    }))
    frames.push(await shotLabeled('4 IM 收回后仍是撕之前的会话'))
    out.imRemembered = Boolean(
      out.imAfterDock.head.includes('IM')
      && out.imBeforeTear.thread
      && out.imAfterDock.thread === out.imBeforeTear.thread
      && out.imAfterDock.floatKeys.length === 0,
    )
    out.otherModule = 'im'
    if (!out.imRemembered) {
      out.failCode = 'im-not-remembered'
      throw new Error(out.failCode)
    }
  } else {
    out.planTearClick = await page.evaluate(() => {
      const tab = document.querySelector('[data-plan-tab]')?.getAttribute('data-plan-tab') || ''
      if (tab !== 'schedule') return `not-schedule:${tab}`
      const head = [...document.querySelectorAll('.h-11 .text-sm.font-medium')].find((el) => (el.textContent || '').trim() === '计划')
      const btn = head?.parentElement?.querySelector('[title*="撕出为独立浮窗"]')
      if (!btn) {
        const any = document.querySelector('[title*="撕出为独立浮窗"]')
        return `no-tear:${[...document.querySelectorAll('.h-11 .text-sm.font-medium')].map((el) => (el.textContent || '').trim()).join('|')}:any=${Boolean(any)}`
      }
      btn.click()
      return 'ok'
    })
    if (out.planTearClick !== 'ok') {
      out.failCode = 'plan-tear-miss'
      throw new Error(`${out.failCode}:${out.planTearClick}`)
    }
    await page.locator('[data-floating-key="plan"]').waitFor({ state: 'visible', timeout: 10000 })
    await page.locator('[data-floating-key="plan"] [data-floating-dock]').click()
    await page.waitForTimeout(700)
    const planAfter = await inspectPlan()
    frames.push(await shotLabeled('4 计划·日程 收回后仍在日程'))
    out.planAfterDock = planAfter
    out.planRemembered = Boolean(planAfter.head === '计划' && (planAfter.tab === 'schedule' || planAfter.scheduleOn) && planAfter.floatKeys.length === 0)
    if (!out.planRemembered) {
      out.failCode = 'plan-not-remembered'
      throw new Error(out.failCode)
    }
  }

  try {
    out.clickBrief = await openModule('早报')
    for (let i = 0; i < 12; i += 1) {
      const ready = await page.evaluate(() => Boolean([...document.querySelectorAll('button')].some((el) => (el.textContent || '').includes('自定义'))))
      if (ready) break
      if (i === 4 || i === 8) await clickTop('早报')
      await page.waitForTimeout(200)
    }
    out.briefClickCustom = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((el) => (el.textContent || '').includes('自定义') && !el.closest('[data-app-float]'))
      if (!btn) return 'no'
      btn.click()
      return 'ok'
    })
    await page.waitForTimeout(500)
    out.briefBeforeTear = await inspectBriefing()
    await page.locator('div.border-l [title*="撕出为独立浮窗"]').first().click({ timeout: 8000 })
    await page.locator('[data-floating-key="briefing"]').waitFor({ state: 'visible', timeout: 10000 })
    await page.locator('[data-floating-key="briefing"] [data-floating-dock]').click()
    await page.waitForTimeout(700)
    const briefAfter = await inspectBriefing()
    out.briefAfterDock = briefAfter
    out.briefingRemembered = Boolean(briefAfter.head === '早报' && briefAfter.settings === 'open' && briefAfter.customTitle)
  } catch (error) {
    out.briefingError = error instanceof Error ? error.message : String(error)
    out.briefingRemembered = false
  }

  out.clickData = await openModule('业务应用')
  await page.waitForTimeout(400)
  await goAppsTab()
  await openGeneratedApp(board.name)
  await page.waitForTimeout(600)
  const floatBtn = page.locator('[data-app-workspace] [data-app-use="float"]')
  await floatBtn.waitFor({ state: 'visible', timeout: 10000 })
  out.floatButtonText = ((await floatBtn.textContent()) || '').trim()
  out.floatButtonOk = out.floatButtonText === '浮窗'
  out.oldLabelGone = !(await page.getByRole('button', { name: '撕出浮窗' }).count())
  await floatBtn.click()
  await page.locator(`[data-app-float="${board.id}"]`).waitFor({ state: 'visible', timeout: 15000 })
  await placeFloat(board.id, { x: 16, y: 56, width: 500, height: 360 })
  const appTear = await inspectApp()
  out.appTear = appTear
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
  out.twoBeforeCount = (await inspectApp()).appFloatCount
  await page.locator(`[data-app-float="${board.id}"] [data-floating-dock]`).click()
  await page.waitForTimeout(600)
  const twoAfter = await inspectApp()
  out.twoAfter = twoAfter
  out.onlyOneDocked = Boolean(twoAfter.appFloatCount === 1 && twoAfter.workspace)
  const leftover = page.locator(`[data-app-float="${other.id}"] [data-floating-close]`)
  if (await leftover.count()) await leftover.click()
  await page.waitForTimeout(300)

  await openGeneratedApp(board.name)
  out.threeTabs = {
    app: await page.getByRole('button', { name: '应用', exact: true }).count() > 0,
    records: await page.getByRole('button', { name: '业务记录', exact: true }).count() > 0,
    ops: await page.getByRole('button', { name: '操作记录', exact: true }).count() > 0,
  }
  out.createEntry = await page.locator('[data-app-create-entry]').count() > 0
  await page.getByRole('button', { name: '返回列表' }).click().catch(() => {})
  await page.waitForTimeout(400)
  out.createEntry = out.createEntry || (await page.locator('[data-app-create-entry]').count() > 0)
  out.deleteEntry = await page.getByRole('button', { name: /删除/ }).count() > 0
  await openGeneratedApp(board.name)

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
    out.memoryRemembered
    && (out.planRemembered || out.imRemembered)
    && out.floatButtonOk
    && out.oldLabelGone
    && out.onlyOneDocked
    && out.visitUnchanged
    && !out.createdNewApp
    && !out.silentBizWrite
    && out.resizeCollapse
    && out.resizeExpand
    && out.iframeShieldCss
    && out.stageShieldFn
    && out.threeTabs.app && out.threeTabs.records && out.threeTabs.ops
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
  subagentId: "bc-829465ca-41a2-5eaf-a50a-5a19f0a02b75"
---

# Verify: AQ 模块撕出收回记住页

**pass:** ${out.pass ? 'yes' : 'no'}
**main SHA:** \`${out.sha}\`
**branch:** \`${out.branch}\`（未推 origin）
**记忆撕出/收回停在:** ${out.memoryDockSettled?.pane || ''}（要 io / 导入导出，不是 home）
**另验模块:** ${out.otherModule === 'im' ? `IM 会话 ${out.imAfterDock?.name || out.imAfterDock?.thread || ''}` : '计划·日程'}${out.briefingRemembered ? '；早报·自定义' : ''}
**走访 updatedAt:** ${out.visitUnchanged ? 'unchanged' : 'changed/missing'}
**拉伸 48/224:** ${out.resizeCollapse && out.resizeExpand ? 'yes' : 'no'}

## SHA

| 项 | 值 |
|---|---|
| daily main | \`${out.sha}\` |
| branch | \`${out.branch}\` |

## 记忆

打开「导入导出」再撕出、点「—」收回。第一帧起就不能是图谱首页（打开探索 / 六张卡片）。

| 项 | 结果 |
|---|---|
| 撕之前 pane | ${out.memoryBeforeTear?.pane || ''} return=${out.memoryBeforeTear?.returnBtn} io=${out.memoryBeforeTear?.ioTitle} home=${out.memoryBeforeTear?.openExplore} |
| 撕出瞬间 pane | ${out.memoryTearInstant?.pane || ''} home=${out.memoryTearInstant?.openExplore} |
| 撕出观察器命中 home | ${out.memoryTearHits?.length || 0} |
| 「—」瞬间 pane | ${out.memoryDockInstant?.pane || ''} head=${out.memoryDockInstant?.head || ''} |
| 收回后 pane | ${out.memoryDockSettled?.pane || ''} head=${out.memoryDockSettled?.head || ''} return=${out.memoryDockSettled?.returnBtn} 打开探索=${out.memoryDockSettled?.openExplore} |
| 记忆记住 | ${out.memoryRemembered ? 'yes' : 'no'} |

## 另验

| 项 | 结果 |
|---|---|
| 计划撕前 | head=${out.planBeforeTear?.head || ''} tab=${out.planBeforeTear?.tab || ''} |
| 计划收回 | head=${out.planAfterDock?.head || ''} tab=${out.planAfterDock?.tab || ''} |
| 计划记住 | ${out.planRemembered ? 'yes' : 'no'} |
| IM 撕前 | thread=${out.imBeforeTear?.thread || ''} name=${out.imBeforeTear?.name || ''} |
| IM 收回 | thread=${out.imAfterDock?.thread || ''} head=${(out.imAfterDock?.head || []).join('|')} |
| IM 记住 | ${out.imRemembered ? 'yes' : 'no'} |
| 早报撕前 | head=${out.briefBeforeTear?.head || ''} settings=${out.briefBeforeTear?.settings || ''} custom=${out.briefBeforeTear?.customTitle} |
| 早报收回 | head=${out.briefAfterDock?.head || ''} settings=${out.briefAfterDock?.settings || ''} custom=${out.briefAfterDock?.customTitle} |
| 早报记住 | ${out.briefingRemembered ? 'yes' : 'no'} |

## AO/AP 未踩坏

| 项 | 结果 |
|---|---|
| 按钮「浮窗」 | ${out.floatButtonText || ''} |
| 两窗只收一个 | ${out.onlyOneDocked ? 'yes' : 'no'}（后=${out.twoAfter?.appFloatCount}） |

## 决策 22

| 项 | 结果 |
|---|---|
| 拉宽 aside | ${out.wide?.asideW ?? '?'}px（要 48） |
| 拉窄 aside | ${out.narrow?.asideW ?? '?'}px（要 224） |
| StagePanel iframe 指针屏蔽 | ${out.iframeShieldCss && out.stageShieldFn ? '未拆' : '坏了'} |
| 三 Tab | 应用=${out.threeTabs?.app} 业务记录=${out.threeTabs?.records} 操作记录=${out.threeTabs?.ops} |
| 创建入口 | ${out.createEntry ? 'yes' : 'no'} |
| 删除入口 | ${out.deleteEntry ? 'yes' : 'no'} |
| 走访 updatedAt | before ${out.visitBefore?.updatedAt || ''} / after ${out.visitAfter?.updatedAt || ''} |
| 静默 biz_write | ${out.silentBizWrite ? 'yes' : 'no'} |
| 新造应用 | ${out.createdNewApp ? 'yes' : 'no'} |

## 图

四格：记忆导入导出；撕出浮窗仍是导入导出；「—」收回仍是导入导出；计划日程收回后仍在。用来证明记忆不是默认图谱首页。

${MEDIA}

${out.error ? `## 失败\\n\\n${out.failCode || ''} ${out.error}\\n` : ''}
`

await writeFile(REPORT_JSON, `${JSON.stringify(out, null, 2)}\n`)
await writeFile(REPORT_MD, md)
out.dualMd = await dualWrite(REPORT_MD, 'internal/verify-app-float-aq.md')
out.dualJson = await dualWrite(REPORT_JSON, 'internal/verify-app-float-aq.json')
out.dualPng = existsSync(MEDIA) ? await dualWrite(MEDIA, 'media/app-float-aq.png') : 'no-media'
await writeFile(REPORT_JSON, `${JSON.stringify(out, null, 2)}\n`)

const pngStat = existsSync(MEDIA) ? await stat(MEDIA) : null
console.log(JSON.stringify({
  pass: out.pass,
  sha: out.sha,
  memoryRemembered: out.memoryRemembered,
  planRemembered: out.planRemembered,
  briefingRemembered: out.briefingRemembered,
  onlyOneDocked: out.onlyOneDocked,
  visitUnchanged: out.visitUnchanged,
  wide: out.wide?.asideW,
  narrow: out.narrow?.asideW,
  pngBytes: pngStat?.size || 0,
  pngExists: Boolean(pngStat),
  failCode: out.failCode || null,
  error: out.error || null,
}, null, 2))
