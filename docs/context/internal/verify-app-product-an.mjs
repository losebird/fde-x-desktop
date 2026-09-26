/**
 * Live AN: declared files/memory/im/briefing/biz entries.
 * Store internal/ only — do not git-add. Never 确认过账 / biz_write / nod.
 * Do not kill pnpm 5174. Do not open-to-edit 走访. Do not create a new app.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const CURSOR_STORE = '/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e'
const MEDIA = `${STORE}/media/app-product-an.png`
const REPORT_JSON = `${STORE}/internal/verify-app-product-an.json`
const REPORT_MD = `${STORE}/internal/verify-app-product-an.md`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const visitName = '本周现场走访记录'
const visitId = 'app_5d1eef0062114901b4797d705e5166b5'
const boardName = '资料卡片板'
const boardId = 'app_6a81181028a64219a373626cb6514921'

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
const memoryPosts = []
page.on('request', (req) => {
  const url = req.url()
  if (/biz\/write|biz_write/i.test(url)) bizWriteUrls.push(url)
  if (/\/api\/v1\/im\/send\b/i.test(url)) imSendUrls.push(url)
})
page.on('response', async (res) => {
  const url = res.url()
  if (res.request().method() === 'POST' && /\/api\/v1\/memory\/cards(?:\?|$)/.test(url) && !/\/nod(?:\?|$)/.test(url)) {
    const body = await res.json().catch(() => ({}))
    memoryPosts.push({ status: res.status(), body })
  }
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
      graphStudio: /图谱工作室/.test(document.body.innerText || ''),
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

async function listMemoryCards() {
  return page.evaluate(async (cwd) => {
    const json = await fetch(`/api/v1/memory/cards?cwd=${encodeURIComponent(cwd)}`).then((r) => r.json())
    const data = json.data || json
    return data.items || data.cards || data.page || []
  }, workspaceCwd)
}

async function openGeneratedApp(name) {
  const row = page.locator('[data-app-row]').filter({ hasText: name }).locator('button').first()
  await row.click({ timeout: 15000 })
  await page.locator('[data-app-workspace]').waitFor({ state: 'visible', timeout: 20000 })
  await page.locator('[data-app-product]').waitFor({ state: 'visible', timeout: 15000 })
}

async function goAppsTab() {
  const overviewBtn = page.getByRole('button', { name: '应用', exact: true })
  if (await overviewBtn.count()) await overviewBtn.click({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(700)
}

async function reopenBoard() {
  const back = page.getByRole('button', { name: '返回列表' })
  if (await back.count()) await back.click({ timeout: 5000 }).catch(() => {})
  await seedState({ panelWidth: 720 })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1800)
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

try {
  await page.goto(`${mainBase}/ai?an=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
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

  const cardsBefore = await listMemoryCards()
  out.cardsBeforeIds = cardsBefore.map((row) => ({ id: row.id, status: row.status }))

  await openGeneratedApp(board.name)
  const uses = await page.locator('[data-app-uses]').getAttribute('data-app-uses')
  out.uses = uses || ''
  out.buttons = await page.locator('[data-app-use]').evaluateAll((els) => els.map((el) => ({ use: el.getAttribute('data-app-use'), text: (el.textContent || '').trim() })))
  out.undeclaredButton = out.buttons.some((row) => !(out.uses || '').split(',').includes(row.use))

  // 2. memory first so screenshot can show work surface + draft card
  await page.locator('[data-app-use="memory"]').click()
  await page.waitForTimeout(1800)
  out.memoryUi = await page.evaluate(() => {
    const card = document.querySelector('[data-memory-draft-card]')
    const body = document.querySelector('[data-memory-draft-body]')
    const status = document.querySelector('[data-memory-card-status]')
    const text = document.body.innerText || ''
    return {
      product: Boolean(document.querySelector('[data-app-product]')),
      cards: document.querySelectorAll('[data-app-card]').length,
      draftCard: Boolean(card),
      draftBody: (body?.textContent || '').trim(),
      draftStatus: status?.getAttribute('data-memory-card-status') || (status?.textContent || '').trim(),
      nodButton: Boolean(document.querySelector('[data-memory-nod]')),
      graphStudio: text.includes('图谱工作室'),
      failedFetch: text.includes('Failed to fetch'),
      memoryPanel: [...document.querySelectorAll('div')].some((el) => el.className.includes('border-l') && /记忆/.test(el.textContent || '') && /图谱工作室/.test(el.textContent || '')),
    }
  })
  const cardsAfterDraft = await listMemoryCards()
  const posted = memoryPosts.at(-1)
  out.memoryPost = posted ? { http: posted.status, id: posted.body?.data?.id, status: posted.body?.data?.status } : null
  out.newCards = cardsAfterDraft.filter((row) => !out.cardsBeforeIds.some((old) => old.id === row.id))
  out.memoryListed = out.newCards.find((row) => row.id === out.memoryPost?.id) || out.newCards[0] || null
  out.memoryIsDraft = Boolean(
    out.memoryUi.draftCard
    && out.memoryUi.draftBody
    && out.memoryUi.draftStatus === '起草'
    && !out.memoryUi.graphStudio
    && out.memoryListed
    && out.memoryListed.status === '起草'
    && out.memoryListed.id !== 'memory:aff12daf'
    && out.memoryPost?.status === '起草',
  )
  out.autoFiled = Boolean(out.memoryListed && out.memoryListed.status === '已入档') || out.memoryPost?.status === '已入档'

  await page.locator('[data-app-product]').scrollIntoViewIfNeeded().catch(() => {})
  await page.screenshot({ path: MEDIA, fullPage: false })
  out.screenshot = MEDIA

  // 1. files
  await page.locator('[data-app-use="files"]').click()
  await page.waitForTimeout(1200)
  out.files = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('.text-sm.font-medium')].map((el) => (el.textContent || '').trim())
    const text = document.body.innerText || ''
    return {
      stageHead: heads.find((h) => h === '文件') || heads[0] || '',
      hasFileTree: /📁|文件库|工作区文件/.test(text),
      titleHint: text.includes('文件'),
    }
  })
  out.filesOk = Boolean(out.files.stageHead === '文件' || out.files.hasFileTree)

  await reopenBoard()

  // 3. im — fill composer, do not send
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
      composer: String(hit || draftHit).slice(0, 240),
      composerFilled: Boolean(hit || draftHit),
      textareaCount: tas.length,
    }
  })
  out.imOk = Boolean(out.im.composerFilled && imSendUrls.length === 0)

  await reopenBoard()

  // 4. briefing — existing briefing page
  await page.locator('[data-app-use="briefing"]').click()
  await page.waitForTimeout(1500)
  out.briefing = await page.evaluate(() => {
    const text = document.body.innerText || ''
    return {
      stageHead: [...document.querySelectorAll('.text-sm.font-medium')].map((el) => (el.textContent || '').trim()).includes('早报'),
      morning: /早上好/.test(text),
      customize: text.includes('自定义'),
      fake: /假早报|演示早报|示例早报/.test(text),
    }
  })
  out.briefingOk = Boolean((out.briefing.stageHead || out.briefing.morning) && !out.briefing.fake)

  await reopenBoard()

  // 5. biz — open records, no confirm write
  await page.locator('[data-app-use="biz"]').click()
  await page.waitForTimeout(1500)
  out.biz = await page.evaluate(() => {
    const text = document.body.innerText || ''
    return {
      recordsTab: [...document.querySelectorAll('button')].some((el) => (el.textContent || '').trim() === '业务记录'),
      preview: /预览|确认后才写入|业务记录/.test(text),
      confirmPost: [...document.querySelectorAll('button')].some((el) => /确认过账/.test(el.textContent || '')),
    }
  })
  out.bizOk = Boolean(out.biz.recordsTab || out.biz.preview)

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

  const banned = execSync("rg -n '健身|记账|库存盘点|运动塑形|家庭药箱|资料卡片板' src/components/apps runtime/apps src/lib/app-spec.ts || true", { cwd: SCENE, encoding: 'utf8' })
  out.templateHits = banned.trim() || 'none'
  out.bizWriteUrls = bizWriteUrls
  out.imSendUrls = imSendUrls
  out.silentBizWrite = bizWriteUrls.length > 0
  out.autoSendIm = imSendUrls.length > 0

  out.pass = Boolean(
    out.filesOk
    && out.memoryIsDraft
    && !out.autoFiled
    && out.imOk
    && out.briefingOk
    && out.bizOk
    && !out.silentBizWrite
    && !out.autoSendIm
    && out.visitUnchanged
    && !out.createdNewApp
    && out.resizeCollapse
    && out.resizeExpand
    && out.iframeShieldCss
    && out.stageShieldFn
    && threeTabs.app && threeTabs.records && threeTabs.ops
    && out.createEntry
    && out.deleteEntry
    && !out.undeclaredButton
    && existsSync(MEDIA)
  )
} catch (error) {
  out.pass = false
  out.failCode = out.failCode || 'script-error'
  out.error = error instanceof Error ? error.message : String(error)
} finally {
  await browser.close().catch(() => undefined)
}

const md = `# Verify: AN 声明能力真入口

**pass:** ${out.pass ? 'yes' : 'no'}
**main SHA:** \`${out.sha}\`
**branch:** \`${out.branch}\`（未推 origin）
**files:** ${out.filesOk ? 'yes' : 'no'}
**memory 起草卡:** ${out.memoryIsDraft ? 'yes' : 'no'}
**自动入档:** ${out.autoFiled ? 'yes' : 'no'}
**im 拟回进输入框:** ${out.imOk ? 'yes' : 'no'}
**briefing 已有早报:** ${out.briefingOk ? 'yes' : 'no'}
**biz 打开记录/闸:** ${out.bizOk ? 'yes' : 'no'}
**静默写:** ${out.silentBizWrite ? 'yes' : 'no'}
**走访 updatedAt:** ${out.visitUnchanged ? 'unchanged' : 'changed/missing'}
**拉伸 48/224:** ${out.resizeCollapse && out.resizeExpand ? 'yes' : 'no'}

## SHA

| 项 | 值 |
|---|---|
| daily main | \`${out.sha}\` |
| branch | \`${out.branch}\` |

## 每个入口点了什么

| 入口 | 点了 | 现网看到 |
|---|---|---|
| files 引用文件 | yes | stage=${out.files?.stageHead || ''} tree=${out.files?.hasFileTree ? 'yes' : 'no'} |
| memory 起草记忆卡片 | yes | 起草卡=${out.memoryUi?.draftCard ? 'yes' : 'no'} 图谱=${out.memoryUi?.graphStudio ? 'yes' : 'no'} id=${out.memoryListed?.id || out.memoryPost?.id || ''} status=${out.memoryListed?.status || out.memoryPost?.status || ''} |
| im 拟回进输入框 | yes | composer=${out.im?.composerFilled ? 'filled' : 'empty'} send=${out.autoSendIm ? 'yes' : 'no'} |
| briefing 打开早报 | yes | 早报=${out.briefing?.stageHead || out.briefing?.morning ? 'yes' : 'no'} 假页=${out.briefing?.fake ? 'yes' : 'no'} |
| biz 打开业务记录 | yes | records=${out.biz?.recordsTab || out.biz?.preview ? 'yes' : 'no'} 确认过账点击=no |

## 记忆

- 正文可见：${(out.memoryUi?.draftBody || '').slice(0, 180)}
- 界面状态：${out.memoryUi?.draftStatus || ''}
- 接口新建：${out.memoryPost?.id || ''} / ${out.memoryPost?.status || ''}
- list_memory_cards：${out.memoryListed?.id || ''} / ${out.memoryListed?.status || ''}
- 不是图谱工作室：${!out.memoryUi?.graphStudio}
- 没有自动入档：${!out.autoFiled}
- 没有点「点头入档」
- 上一张 memory:aff12daf 不当过关证据

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
| 自动发 IM | ${out.autoSendIm ? 'yes' : 'no'} |
| 新造应用 | ${out.createdNewApp ? 'yes' : 'no'} |

## 图

工作面 + 记忆起草卡（不要图谱）。

${MEDIA}

${out.error ? `## 失败\n\n${out.failCode || ''} ${out.error}\n` : ''}
`

await writeFile(REPORT_JSON, `${JSON.stringify(out, null, 2)}\n`)
await writeFile(REPORT_MD, md)
await dualWrite(REPORT_MD, 'internal/verify-app-product-an.md')
await dualWrite(REPORT_JSON, 'internal/verify-app-product-an.json')
if (existsSync(MEDIA)) await dualWrite(MEDIA, 'media/app-product-an.png')

console.log(JSON.stringify({
  pass: out.pass,
  sha: out.sha,
  filesOk: out.filesOk,
  memoryIsDraft: out.memoryIsDraft,
  autoFiled: out.autoFiled,
  imOk: out.imOk,
  briefingOk: out.briefingOk,
  bizOk: out.bizOk,
  visitUnchanged: out.visitUnchanged,
  wide: out.wide?.asideW,
  narrow: out.narrow?.asideW,
  screenshot: existsSync(MEDIA),
  error: out.error || null,
}, null, 2))
if (!out.pass) process.exitCode = 1
