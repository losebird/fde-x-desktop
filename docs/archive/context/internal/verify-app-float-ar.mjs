/**
 * Live AR: IM tear/dock must keep the same thread and composer.
 * Store internal/ only — do not git-add. Never biz_write. Never auto-send IM.
 * Do not kill pnpm 5174. Do not open-to-edit 走访. Do not create a new app.
 * Chinese cwd only via ?cwd=.
 */
import { createRequire } from 'node:module'
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

const require = createRequire(import.meta.url)
const sharp = require('/tmp/pw-run/node_modules/sharp')

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const CURSOR_STORE = '/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e'
const MEDIA = `${STORE}/media/app-float-ar.png`
const REPORT_JSON = `${STORE}/internal/verify-app-float-ar.json`
const REPORT_MD = `${STORE}/internal/verify-app-float-ar.md`
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
const DRAFT = 'AR未发送稿-不要发出去'
const BLANK = /选择联系人或话题群开始对话/

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
page.on('request', (req) => {
  const url = req.url()
  if (/biz\/write|biz_write/i.test(url)) bizWriteUrls.push(url)
  if (/x-dsh-cwd/i.test(req.headers()['x-dsh-cwd'] || '')) bizWriteUrls.push(`header:${url}`)
  if (/\/api\/v1\/im\/send(?:\?|$)/.test(url) && req.method() !== 'GET') imSendUrls.push(`${req.method()} ${url}`)
})

const out = {
  sha,
  branch,
  boardName,
  otherName,
  visitName,
  hardcoded: 'none',
  silentBizWrite: false,
  autoImSend: false,
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
    state.state.imBrowse = { threadId: null, topicId: null }
    state.state.imComposerDrafts = {}
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

function tearByHead(label) {
  return page.evaluate((name) => {
    const head = [...document.querySelectorAll('.h-11 .text-sm.font-medium')].find((el) => (el.textContent || '').trim() === name)
    const btn = head?.parentElement?.querySelector('[title*="撕出为独立浮窗"]')
    if (!btn) {
      const heads = [...document.querySelectorAll('.h-11 .text-sm.font-medium')].map((el) => (el.textContent || '').trim())
      const any = document.querySelector('[title*="撕出为独立浮窗"]')
      return `no-tear:${heads.join('|')}:any=${Boolean(any)}`
    }
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

async function ensureStage(label) {
  const opened = await openModule(label)
  for (let i = 0; i < 16; i += 1) {
    const heads = await moduleHead()
    if (heads.includes(label)) {
      if (label !== '计划' || await page.evaluate(() => Boolean(document.querySelector('[data-plan-tab]')))) {
        return { ...opened, heads, ensured: i }
      }
    }
    await clickTop(label)
    await page.waitForTimeout(200)
  }
  return { ...opened, heads: await moduleHead(), ensured: 'fail' }
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

function inspectIm() {
  return page.evaluate((blank) => {
    const host = document.querySelector('[data-floating-key="im"]') || document.querySelector('div.border-l')
    const root = (host && host.querySelector('[data-im-thread]')) || document.querySelector('[data-im-thread]')
    const textarea = root?.querySelector('textarea')
    const text = host ? (host.innerText || '') : (document.body.innerText || '')
    return {
      thread: root?.getAttribute('data-im-thread') || '',
      topic: root?.getAttribute('data-im-topic') || '',
      draftAttr: root?.getAttribute('data-im-draft') || '',
      name: root?.getAttribute('data-im-name') || '',
      textarea: textarea?.value || '',
      head: [...document.querySelectorAll('.h-11 .text-sm.font-medium')].map((el) => (el.textContent || '').trim()),
      floatKeys: [...document.querySelectorAll('[data-floating-key]')].map((el) => el.getAttribute('data-floating-key')),
      emptyPick: new RegExp(blank).test(text),
      selectedName: ((host || document).querySelector?.('.bg-brand-soft.border-l-2')?.innerText || '').split('\n')[0] || '',
      slice: text.replace(/\s+/g, ' ').slice(0, 240),
    }
  }, BLANK.source)
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
      ioTitle: /导入导出/.test(text),
      returnBtn: buttons.includes('返回'),
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
      tab,
      scheduleOn: buttons.some((b) => b.text.includes('日程') && b.on),
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
    }
  })
}

const frames = []

try {
  await page.goto(`${mainBase}/ai?cwd=${encodeURIComponent(workspaceCwd)}&ar=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
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

  out.clickIm = await openModule('IM')
  for (let i = 0; i < 20; i += 1) {
    const ready = await page.evaluate(() => Boolean(document.querySelector('[data-im-thread]')))
    if (ready) break
    if (i === 6 || i === 12) await clickTop('IM')
    await page.waitForTimeout(250)
  }
  out.imExpand = await page.evaluate(() => {
    const btn = document.querySelector('div.border-l button[title="展开会话列表"]')
    if (!btn) return 'no-btn'
    btn.click()
    return 'ok'
  })
  for (let i = 0; i < 16; i += 1) {
    const ready = await page.evaluate(() => {
      const list = [...document.querySelectorAll('div.border-l button.w-full.px-3.py-2')]
      const compact = [...document.querySelectorAll('div.border-l button.relative.rounded-full')]
      const empty = /还没有配对同事/.test(document.querySelector('div.border-l')?.innerText || '')
      return { list: list.length, compact: compact.length, empty }
    })
    out.imRoster = ready
    if (ready.list > 0 || ready.compact > 0) break
    await page.waitForTimeout(250)
  }

  out.imPick = await page.evaluate(() => {
    const host = document.querySelector('div.border-l')
    const list = [...(host ? host.querySelectorAll('button.w-full.px-3.py-2') : [])]
    const compact = [...(host ? host.querySelectorAll('button.relative.rounded-full') : [])]
    const buttons = list.length ? list : compact
    if (!buttons.length) {
      return {
        ok: false,
        reason: 'no-people',
        slice: (host?.innerText || '').replace(/\s+/g, ' ').slice(0, 240),
      }
    }
    const current = document.querySelector('[data-im-thread]')?.getAttribute('data-im-thread') || ''
    const otherBtn = list.length
      ? (list.find((el) => !el.className.includes('bg-brand-soft')) || list[list.length > 1 ? 1 : 0])
      : compact[compact.length > 1 ? 1 : 0]
    otherBtn.click()
    return {
      ok: true,
      count: buttons.length,
      mode: list.length ? 'list' : 'compact',
      before: current,
      clicked: (otherBtn.getAttribute('title') || otherBtn.innerText || '').split('\n')[0] || '',
    }
  })
  if (!out.imPick?.ok) {
    out.failCode = 'im-no-thread'
    throw new Error(out.failCode)
  }
  await page.waitForTimeout(600)

  const composer = page.locator('div.border-l [data-im-thread] textarea').first()
  await composer.waitFor({ state: 'visible', timeout: 10000 })
  await composer.click({ timeout: 5000 })
  await composer.fill(DRAFT)
  await page.waitForTimeout(200)

  const beforeTear = await inspectIm()
  out.imBeforeTear = beforeTear
  if (!beforeTear.thread || beforeTear.emptyPick) {
    out.failCode = 'im-blank-before'
    throw new Error(out.failCode)
  }
  const draftOk = beforeTear.draftAttr.includes(DRAFT) || beforeTear.textarea.includes(DRAFT)
  if (!draftOk) {
    out.failCode = 'im-draft-missing-before'
    throw new Error(`${out.failCode}:${beforeTear.draftAttr}|${beforeTear.textarea}`)
  }

  await tearByHead('IM')
  const tearInstant = await inspectIm()
  frames.push(await shotLabeled('1 IM 撕出瞬间仍是该会话'))
  await page.locator('[data-floating-key="im"]').waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('[data-floating-key="im"]').evaluate((node) => {
    node.style.left = '36px'
    node.style.top = '64px'
    node.style.width = '820px'
    node.style.height = '620px'
  })
  await page.waitForTimeout(400)
  const tearSettled = await inspectIm()
  frames.push(await shotLabeled('2 浮窗仍是同一会话和输入框'))
  out.imTearInstant = tearInstant
  out.imTearSettled = tearSettled

  await page.locator('[data-floating-key="im"] [data-floating-dock]').click()
  const dockInstant = await inspectIm()
  frames.push(await shotLabeled('3 「—」收回瞬间仍是该会话'))
  await page.waitForTimeout(700)
  const dockSettled = await inspectIm()
  frames.push(await shotLabeled('4 收回后同一会话，输入框还在'))
  out.imDockInstant = dockInstant
  out.imDockSettled = dockSettled

  const sameThread = Boolean(
    beforeTear.thread
    && dockSettled.thread === beforeTear.thread
    && (dockSettled.name === beforeTear.name || dockSettled.selectedName === beforeTear.selectedName || dockSettled.name),
  )
  const draftAfter = dockSettled.draftAttr.includes(DRAFT) || dockSettled.textarea.includes(DRAFT)
  const notBlank = !dockSettled.emptyPick && Boolean(dockSettled.thread) && dockSettled.head.includes('IM')
  out.imRemembered = Boolean(
    sameThread
    && draftAfter
    && notBlank
    && dockSettled.floatKeys.length === 0
    && tearSettled.thread === beforeTear.thread,
  )
  out.imStoppedAt = {
    before: `${beforeTear.name || beforeTear.selectedName}:${beforeTear.thread}`,
    float: `${tearSettled.name || tearSettled.selectedName}:${tearSettled.thread}`,
    dock: `${dockSettled.name || dockSettled.selectedName}:${dockSettled.thread}`,
  }
  if (!out.imRemembered) {
    out.failCode = 'im-not-remembered'
    throw new Error(out.failCode)
  }

  out.clickMem = await openModule('记忆')
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((el) => {
      const t = (el.innerText || '').replace(/\s+/g, ' ')
      return t.includes('导入导出') && t.includes('知识审计')
    })
    btn?.click()
  })
  await page.waitForTimeout(800)
  const memBefore = await inspectMemory()
  out.memoryTearClick = await tearByHead('记忆')
  if (out.memoryTearClick !== 'ok') throw new Error(`memory-tear:${out.memoryTearClick}`)
  await page.locator('[data-floating-key="memory"]').waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('[data-floating-key="memory"] [data-floating-dock]').click()
  await page.waitForTimeout(600)
  const memAfter = await inspectMemory()
  out.memoryRemembered = Boolean(memAfter.head === '记忆' && memAfter.pane === 'io' && memAfter.returnBtn && !memAfter.openExplore && memAfter.floatKeys.length === 0)
  out.memoryBefore = memBefore
  out.memoryAfter = memAfter

  out.clickPlan = await ensureStage('计划')
  if (out.clickPlan.ensured === 'fail' || !(out.clickPlan.heads || []).includes('计划')) {
    out.failCode = 'plan-not-open'
    throw new Error(`${out.failCode}:${(out.clickPlan.heads || []).join('|')}`)
  }
  await page.evaluate(() => {
    const tab = document.querySelector('[data-plan-tab]')
    const btn = [...(tab ? tab.querySelectorAll('button') : [])].find((el) => (el.textContent || '').includes('日程'))
    btn?.click()
  })
  await page.waitForTimeout(400)
  if (!(await moduleHead()).includes('计划')) {
    await clickTop('计划')
    await page.waitForTimeout(400)
    await page.evaluate(() => {
      const tab = document.querySelector('[data-plan-tab]')
      const btn = [...(tab ? tab.querySelectorAll('button') : [])].find((el) => (el.textContent || '').includes('日程'))
      btn?.click()
    })
    await page.waitForTimeout(300)
  }
  out.planBeforeTear = await inspectPlan()
  out.planTearClick = await tearByHead('计划')
  if (out.planTearClick !== 'ok') {
    out.failCode = 'plan-tear-miss'
    throw new Error(`${out.failCode}:${out.planTearClick}`)
  }
  await page.locator('[data-floating-key="plan"]').waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('[data-floating-key="plan"] [data-floating-dock]').click()
  await page.waitForTimeout(600)
  const planAfter = await inspectPlan()
  out.planRemembered = Boolean(planAfter.head === '计划' && (planAfter.tab === 'schedule' || planAfter.scheduleOn) && planAfter.floatKeys.length === 0)
  out.planAfter = planAfter

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
  out.appNoFlash = Boolean(!appTear.checking && !appTear.connectorEmpty && appTear.workspace)
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
    out.imRemembered
    && draftAfter
    && !imSendUrls.length
    && out.floatButtonOk
    && out.oldLabelGone
    && out.onlyOneDocked
    && out.appNoFlash
    && out.memoryRemembered
    && out.planRemembered
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
out.imSendUrls = imSendUrls
out.autoImSend = imSendUrls.length > 0
if (out.silentBizWrite || out.autoImSend) out.pass = false

const md = `---
cursor:
  subagentId: "bc-e84f3e6a-316e-56f1-ba2d-c803cdc05cc4"
---

# Verify: AR IM 撕出收回记住会话

**pass:** ${out.pass ? 'yes' : 'no'}
**main SHA:** \`${out.sha}\`
**branch:** \`${out.branch}\`（未推 origin）
**IM 撕出/收回停在:** ${out.imStoppedAt?.dock || out.imDockSettled?.name || ''}（${out.imDockSettled?.thread || ''}）
**输入框在不在:** ${(out.imDockSettled?.draftAttr || out.imDockSettled?.textarea || '').includes(DRAFT) ? 'yes，稿还在' : 'no'}
**有没有自动发送:** ${out.autoImSend ? 'yes' : 'no'}
**走访 updatedAt:** ${out.visitUnchanged ? 'unchanged' : 'changed/missing'}
**拉伸 48/224:** ${out.resizeCollapse && out.resizeExpand ? 'yes' : 'no'}

已对：IM 撕出/「—」收回仍停在撕之前那个会话（CDP \`data-im-thread\` ${out.imBeforeTear?.thread || ''} → ${out.imDockSettled?.thread || ''}，名 ${out.imBeforeTear?.name || out.imBeforeTear?.selectedName || ''}；输入框仍有「${DRAFT}」；未发 \`/im/send\`）。AO 按钮「浮窗」、两窗只收一个；AP 连接器空页未闪；AQ 记忆导入导出、计划日程。走访未改。拉伸 48/224。StagePanel iframe 指针屏蔽仍在。

未对：早报抽屉标题。

仍差：${out.pass ? '无（锁外创建应用本身还没齐）' : (out.failCode || out.error || '未过')}

## SHA

| 项 | 值 |
|---|---|
| daily main | \`${out.sha}\` |
| branch | \`${out.branch}\` |
| 产品提交 | \`${out.sha} fix(im): keep thread and composer across float remount\` |
| 改动文件 | \`src/components/IMWorkspace.tsx\` \`src/store/app.ts\` |

## IM

打开一个非默认空白会话，写入输入框（不点发送），撕出，点「—」收回。

| 项 | 结果 |
|---|---|
| 撕之前 | thread=${out.imBeforeTear?.thread || ''} name=${out.imBeforeTear?.name || out.imBeforeTear?.selectedName || ''} draft=${(out.imBeforeTear?.draftAttr || '').includes(DRAFT)} empty=${out.imBeforeTear?.emptyPick} |
| 撕出瞬间 | thread=${out.imTearInstant?.thread || ''} name=${out.imTearInstant?.name || ''} |
| 浮窗停稳 | thread=${out.imTearSettled?.thread || ''} draft=${(out.imTearSettled?.draftAttr || out.imTearSettled?.textarea || '').includes(DRAFT)} |
| 「—」瞬间 | thread=${out.imDockInstant?.thread || ''} head=${(out.imDockInstant?.head || []).join('|')} |
| 收回后 | thread=${out.imDockSettled?.thread || ''} name=${out.imDockSettled?.name || out.imDockSettled?.selectedName || ''} draft=${(out.imDockSettled?.draftAttr || out.imDockSettled?.textarea || '').includes(DRAFT)} empty=${out.imDockSettled?.emptyPick} floatKeys=${(out.imDockSettled?.floatKeys || []).join('|')} |
| IM 记住 | ${out.imRemembered ? 'yes' : 'no'} |
| 自动发送 | ${out.autoImSend ? 'yes' : 'no'} |

## AO/AP/AQ 未踩坏

| 项 | 结果 |
|---|---|
| 按钮「浮窗」 | ${out.floatButtonText || ''} |
| 旧文案「撕出浮窗」 | ${out.oldLabelGone ? 'gone' : 'still there'} |
| 两窗只收一个 | ${out.onlyOneDocked ? 'yes' : 'no'}（后=${out.twoAfter?.appFloatCount}） |
| 业务应用连接器空页 | ${out.appNoFlash ? '未闪' : '闪了'}（checking=${out.appTear?.checking} empty=${out.appTear?.connectorEmpty}） |
| 记忆导入导出 | ${out.memoryRemembered ? 'yes' : 'no'} pane=${out.memoryAfter?.pane || ''} |
| 计划日程 | ${out.planRemembered ? 'yes' : 'no'} tab=${out.planAfter?.tab || ''} |

## 决策 22

| 项 | 结果 |
|---|---|
| 拉宽 aside | ${out.wide?.asideW ?? '?'}px（要 48） |
| 拉窄 aside | ${out.narrow?.asideW ?? '?'}px（要 224） |
| StagePanel iframe 指针屏蔽 | ${out.iframeShieldCss && out.stageShieldFn ? '未拆' : '坏了'} |
| 三 Tab | 应用=${out.threeTabs?.app} 业务记录=${out.threeTabs?.records} 操作记录=${out.threeTabs?.ops} |
| 创建入口 | ${out.createEntry ? 'yes' : 'no'} |
| 删除入口 | ${out.deleteEntry ? 'yes' : 'no'} |
| 走访 id | \`${visitId}\` |
| 走访 updatedAt | before ${out.visitBefore?.updatedAt || ''} / after ${out.visitAfter?.updatedAt || ''} |
| 静默 biz_write | ${out.silentBizWrite ? 'yes' : 'no'} |
| 新造应用 | ${out.createdNewApp ? 'yes' : 'no'} |
| 5174 | 未杀，仍在听 |

## 图

四格 PNG：1 IM 撕出瞬间；2 浮窗仍是同一会话和输入框；3 「—」收回瞬间；4 收回后同一会话，稿还在。用来证明不是默认空白会话。

\`${MEDIA}\`（${out.pngBytes || 0} bytes）
${out.error ? `\n## 失败\n\n\`${out.failCode}\` ${out.error}\n` : ''}
`

await writeFile(REPORT_JSON, JSON.stringify(out, null, 2))
await writeFile(REPORT_MD, md)
out.dualMd = await dualWrite(REPORT_MD, 'internal/verify-app-float-ar.md')
out.dualPng = existsSync(MEDIA) ? await dualWrite(MEDIA, 'media/app-float-ar.png') : 'no-png'
out.dualJson = await dualWrite(REPORT_JSON, 'internal/verify-app-float-ar.json')
await writeFile(REPORT_JSON, JSON.stringify(out, null, 2))

console.log(JSON.stringify({
  pass: out.pass,
  failCode: out.failCode,
  sha: out.sha,
  im: out.imStoppedAt,
  remembered: out.imRemembered,
  autoSend: out.autoImSend,
  visitUnchanged: out.visitUnchanged,
  resize: { wide: out.wide?.asideW, narrow: out.narrow?.asideW },
  pngBytes: out.pngBytes,
  dualPng: out.dualPng,
  dualMd: out.dualMd,
  error: out.error,
}, null, 2))
if (!out.pass) process.exit(1)
