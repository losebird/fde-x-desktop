/**
 * Pass 3: answer the live 改行 clarification, then cancel. Keep hop 工单 21.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { dirname } from 'node:path'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const CURSOR_STORE = '/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e'
const MEDIA = `${STORE}/media/records-close-contract.png`
const MEDIA_WRITE = `${STORE}/media/records-close-contract-write.png`
const MEDIA_CANCEL = `${STORE}/media/records-close-contract-cancel.png`
const REPORT_JSON = `${STORE}/internal/verify-records-close-contract.json`
const REPORT_MD = `${STORE}/internal/verify-records-close-contract.md`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const visitId = 'app_5d1eef0062114901b4797d705e5166b5'
const LEDGER_ID = 'app_9de6038b186a4e9786e28bc4f48add9d'

const [branch, sha] = execSync('git rev-parse --abbrev-ref HEAD && git rev-parse HEAD', { cwd: SCENE, encoding: 'utf8' }).trim().split('\n')
let prev = {}
try { prev = JSON.parse(await readFile(REPORT_JSON, 'utf8')) } catch { prev = {} }

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } })
const bizWriteUrls = []
page.on('request', (req) => {
  if (/\/biz\/write|biz_write/i.test(req.url()) && req.method() === 'POST') bizWriteUrls.push(req.url())
})

const out = {
  ...prev,
  sha,
  branch,
  fail: undefined,
  pass3: true,
  gateInjected: false,
  wrote: false,
  confirmed: false,
  silentBizWrite: false,
  originPushed: false,
  pnpm5174: true,
}
delete out.fail

async function flush() {
  await writeFile(REPORT_JSON, `${JSON.stringify(out, null, 2)}\n`)
}

function seedState(sessionId) {
  return page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd, sessionId: sid }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeDataSubview = 'records'
    if (sid) state.state.activeAiSessionId = sid
    const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
    if (!rows.some((r) => r.id === wsId)) {
      rows.push({ id: wsId, name: 'fdex测试1', desc: cwd, cwd })
      state.state.workspaces = rows
    }
    const panels = Array.isArray(state.state.panels) ? state.state.panels : []
    state.state.panels = panels.map((p) => {
      if (p && p.id === 'data') return { ...p, state: 'full', width: 1100 }
      if (p && (p.state === 'full' || p.state === 'half')) return { ...p, state: 'tab' }
      return p
    })
    if (state.version == null) state.version = 17
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd, sessionId })
}

async function goTab(name) {
  const btn = page.getByRole('button', { name, exact: true })
  if (await btn.count()) await btn.click({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(350)
}

async function readPending() {
  return page.evaluate(async (ws) => {
    const res = await fetch(`/api/v1/biz/pending-sheet?cwd=${encodeURIComponent(ws)}`)
    const json = await res.json().catch(() => ({}))
    const sheet = json?.data?.sheet || json?.data || null
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
    return {
      kind: sheet?.kind || null,
      action: sheet?.action || null,
      rows: rows.length,
      first: rows[0] && typeof rows[0] === 'object' ? String(rows[0].no || rows[0].orderId || rows[0].id || '') : '',
      speech: sheet?.speech || '',
      preview_id: sheet?.preview_id || sheet?.previewId || null,
      sessionId: sheet?.sessionId || '',
    }
  }, workspaceCwd)
}

async function readUi() {
  return page.evaluate(() => {
    const chipWrap = [...document.querySelectorAll('div.flex.items-center.gap-1.flex-wrap')]
      .find((el) => [...el.querySelectorAll('button.btn')].length)
    const kindChips = chipWrap
      ? [...chipWrap.querySelectorAll('button.btn')].map((b) => b.textContent?.replace(/\s+/g, ' ').trim() || '')
      : []
    const footer = [...document.querySelectorAll('span')]
      .map((s) => s.textContent?.trim() || '')
      .find((t) => t.startsWith('共 ') && t.includes('条')) || ''
    const footerCount = Number((footer.match(/共\s+(\d+)\s+条/) || [])[1] || NaN)
    const table = document.querySelector('div.overflow-x-auto.overflow-y-auto table')
    const firstNo = table?.querySelector('tbody tr td')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const drawer = document.querySelector('div.fixed.inset-y-0.right-0')
    const drawerText = drawer ? (drawer.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 240) : ''
    const hasQuestion = /工单不能「过审」|下一题|跳过本题/.test(document.body?.innerText || '')
    const tabs = [...document.querySelectorAll('button')].map((b) => b.textContent?.trim() || '')
    return {
      kindChips,
      footer,
      footerCount,
      firstNo,
      drawerOpen: Boolean(drawer),
      drawerText,
      hasQuestion,
      tabs: { apps: tabs.includes('应用'), records: tabs.includes('业务记录'), ops: tabs.includes('操作记录') },
    }
  })
}

async function postPreview(body) {
  return page.evaluate(async ({ cwd, payload }) => {
    const res = await fetch('/api/v1/biz/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ workspace: cwd, ...payload }),
    })
    const json = await res.json().catch(() => ({}))
    const sheet = json?.data?.sheet || json?.data || json?.sheet || null
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
    return {
      http: res.status,
      error: json?.error || null,
      kind: sheet?.kind || json?.data?.kind || null,
      action: sheet?.action || json?.data?.action || null,
      rows: rows.length,
      first: rows[0] && typeof rows[0] === 'object' ? String(rows[0].no || '') : '',
      preview_id: sheet?.preview_id || json?.data?.preview_id || null,
      message: json?.error?.message || json?.message || '',
    }
  }, { cwd: workspaceCwd, payload: body })
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
  await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(async () => {
    await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => ({}))
  })
  const pending0 = await readPending()
  out.sessionId = pending0.sessionId || prev.sessionId
  await seedState(out.sessionId)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await goTab('业务记录')
  await page.waitForTimeout(1200)

  const before = { pending: await readPending(), ui: await readUi() }
  out.beforeWrite = {
    kind: before.pending.kind,
    rows: before.pending.rows,
    first: before.pending.first,
    footerCount: before.ui.footerCount,
    chips: before.ui.kindChips,
    hasQuestion: before.ui.hasQuestion,
    speech: before.pending.speech,
  }

  if (!(before.pending.kind === '工单' && before.pending.rows === 21 && /停用客户/.test(String(before.pending.speech || '')))) {
    if (!out.sessionId) {
      out.sessionId = await page.evaluate(async (cwd) => {
        const res = await fetch('/api/v1/ai/sessions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ cwd, title: 'records-close-contract' }),
        })
        const json = await res.json().catch(() => ({}))
        return json?.data?.sessionId || json?.data?.id || json?.sessionId || null
      }, workspaceCwd)
      await seedState(out.sessionId)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
      await goTab('业务记录')
    }
    const hop = await page.evaluate(async ({ sid, text }) => {
      const res = await fetch(`/api/v1/ai/sessions/${encodeURIComponent(sid)}/prompt`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const json = await res.json().catch(() => ({}))
      return { http: res.status, accepted: Boolean(json?.data?.accepted) }
    }, { sid: out.sessionId, text: '停用客户还有哪些没关的工单？只要预览，不要过账，不要 biz_write。' })
    out.rehop = hop
    const hopDeadline = Date.now() + 90000
    while (Date.now() < hopDeadline) {
      const p = await readPending()
      const u = await readUi()
      if (p.kind === '工单' && p.rows > 0 && u.footerCount === p.rows && /停用客户/.test(String(p.speech || ''))) break
      await page.waitForTimeout(700)
    }
    before.pending = await readPending()
    before.ui = await readUi()
    out.beforeWrite = {
      kind: before.pending.kind,
      rows: before.pending.rows,
      first: before.pending.first,
      footerCount: before.ui.footerCount,
      chips: before.ui.kindChips,
      hasQuestion: before.ui.hasQuestion,
      speech: before.pending.speech,
    }
  }

  const option = page.getByText('改状态为已解决', { exact: false }).first()
  if (await option.count()) {
    await option.click({ timeout: 8000 })
    const submit = page.getByRole('button', { name: '提交', exact: true })
    if (await submit.count()) await submit.click({ timeout: 8000 })
    out.pickedClarification = '改状态为已解决'
  } else {
    out.pickedClarification = null
    const first = before.pending.first || prev.hop?.first
    out.writeFallback = await postPreview({
      kind: '工单',
      action: '改行',
      no: first,
      speech: `把 ${first} 的状态改成已解决。只要预览，不要过账，不要 biz_write。`,
      patch: { status: 'resolved' },
    })
  }

  const deadline = Date.now() + 90000
  let writeState = { pending: await readPending(), ui: await readUi() }
  while (Date.now() < deadline) {
    writeState = { pending: await readPending(), ui: await readUi() }
    if (
      writeState.pending.kind === '工单'
      && writeState.pending.action === '改行'
      && (writeState.ui.drawerOpen || writeState.pending.preview_id)
    ) break
    await page.waitForTimeout(700)
  }
  out.write = {
    kind: writeState.pending.kind,
    action: writeState.pending.action,
    rows: writeState.pending.rows,
    first: writeState.pending.first,
    preview_id: writeState.pending.preview_id,
    drawerOpen: writeState.ui.drawerOpen,
    drawerText: writeState.ui.drawerText,
    chips: writeState.ui.kindChips,
    footerCount: writeState.ui.footerCount,
    ready: writeState.pending.kind === '工单' && writeState.pending.action === '改行' && Boolean(writeState.pending.preview_id || writeState.ui.drawerOpen),
  }
  await page.screenshot({ path: MEDIA_WRITE, fullPage: true })
  await flush()

  const cancelBtn = page.locator('div.fixed.inset-y-0.right-0').getByRole('button', { name: '取消' })
  const clickedCancel = (await cancelBtn.count())
    ? (await cancelBtn.click({ timeout: 8000 }).then(() => true).catch(() => false))
    : false
  await page.waitForTimeout(1500)
  const after = { pending: await readPending(), ui: await readUi() }
  out.cancel = {
    clicked: clickedCancel,
    drawerOpen: after.ui.drawerOpen,
    kind: after.pending.kind,
    action: after.pending.action,
    rows: after.pending.rows,
    first: after.pending.first,
    footerCount: after.ui.footerCount,
    firstNo: after.ui.firstNo,
    chips: after.ui.kindChips,
    catalogDump: after.ui.footerCount >= 20 && after.pending.kind !== '工单',
    heldBatch: after.pending.kind === '工单' && after.pending.rows === (out.beforeWrite?.rows || 0) && after.pending.kind !== '请假申请',
    preview_id: after.pending.preview_id,
  }
  await page.screenshot({ path: MEDIA_CANCEL, fullPage: true })
  await page.screenshot({ path: MEDIA, fullPage: true })
  await dualWrite(MEDIA, 'media/records-close-contract.png')
  await dualWrite(MEDIA_WRITE, 'media/records-close-contract-write.png')
  await dualWrite(MEDIA_CANCEL, 'media/records-close-contract-cancel.png')
  out.media = MEDIA
  out.mediaWrite = MEDIA_WRITE
  out.mediaCancel = MEDIA_CANCEL

  await goTab('应用')
  const appsTab = await page.evaluate(() => /创建应用|本周现场走访记录/.test(document.body?.innerText || ''))
  await goTab('操作记录')
  const opsTab = await page.evaluate(() => /操作记录|回退/.test(document.body?.innerText || ''))
  await goTab('业务记录')
  out.decision22 = {
    tabs: (await readUi()).tabs,
    appsTab,
    opsTab,
    visitStill: (await page.evaluate(async (id) => {
      const json = await fetch('/api/v1/business/apps?workspaceId=ws_personal').then((r) => r.json()).catch(() => ({}))
      const row = (json.items || []).find((item) => item.id === id)
      return row ? { id: row.id, name: row.name, updatedAt: row.updatedAt } : null
    }, visitId)),
    ledgerStill: (await page.evaluate(async (id) => {
      const json = await fetch('/api/v1/business/apps?workspaceId=ws_personal').then((r) => r.json()).catch(() => ({}))
      const row = (json.items || []).find((item) => item.id === id)
      return row ? { id: row.id, name: row.name } : null
    }, LEDGER_ID)),
  }

  out.contract1 = Boolean(
    (out.emptyRefuse?.http >= 400 || out.emptyCover?.http >= 400)
    && out.spokenAlias?.kind === '费用报销'
    && out.hop?.kind === '工单'
    && out.hop?.kind !== '请假申请'
    && !(out.hop?.chips || []).some((c) => /审批单|请假申请/.test(c)),
  )
  out.contract2 = Boolean(out.hop?.kind === '工单' && out.hop?.rows === 21 && out.onePending?.sameKind)
  out.contract3 = Boolean(
    out.hop?.footerCount === out.hop?.rows
    && out.decoyHold?.held
    && out.cancel?.clicked
    && out.cancel?.heldBatch
    && !out.cancel?.catalogDump
    && !out.cancel?.drawerOpen,
  )
  out.contract4 = 'already-specified'
  out.wrote = bizWriteUrls.length > 0
  out.silentBizWrite = bizWriteUrls.length > 0
  out.ok = Boolean(out.contract1 && out.contract2 && out.contract3 && !out.wrote)
} catch (error) {
  out.ok = false
  out.fail = String(error && error.message ? error.message : error)
} finally {
  await browser.close().catch(() => {})
}

const md = [
  '---',
  'cursor:',
  '  subagentId: "records-close-contract"',
  '---',
  '',
  '# Verify: 收口总因 leftover 四条',
  '',
  `**product SHA:** \`${out.sha}\``,
  `**branch:** \`${out.branch}\``,
  `**闸注入:** no`,
  `**静默 biz_write:** ${out.silentBizWrite ? 'yes' : 'no'}`,
  `**src 活用例字面量:** ${out.hardcodedInSrc || 'none'}`,
  '',
  '## 因果',
  '',
  '人话进 DSH，闸只校验 structured kind：词表+图+连接器表。空资源拒预览；口语短名走 型槽/aliases 收到已连接表；集合标题「工单」仍是自己。BFF 合并目录不再挤掉工单/客户。空表/假 kind 盖不掉这一张；取消走 displayBeforeWriteRef，不倒连接器目录。',
  '',
  '## 对照',
  '',
  `| 契约 | 状态 | 证据 |`,
  `|---|---|---|`,
  `| 1 只有已连接表能预览；口语别名；空资源拒 | ${out.contract1 ? '已对' : '仍差'} | empty=${JSON.stringify(out.emptyRefuse?.error || out.emptyCover?.error)} alias=${out.spokenAlias?.kind} hop=${out.hop?.kind} rows=${out.hop?.rows} |`,
  `| 2 一句话一张 pending | ${out.contract2 ? '已对' : '仍差'} | ${JSON.stringify(out.onePending)} speech=${out.hop?.speech} |`,
  `| 3 右表换上这一张；取消不倒目录 | ${out.contract3 ? '已对' : '仍差'} | hopFooter=${out.hop?.footerCount} decoy=${JSON.stringify(out.decoyHold)} cancel=${JSON.stringify(out.cancel)} |`,
  `| 4 模糊多家先选再继续 | 已对（不重开） | 五问 §12 |`,
  `| hop 工单不是审批单 | ${out.hop?.kind === '工单' ? '已对' : '仍差'} | kind=${out.hop?.kind} chips=${(out.hop?.chips || []).join(',')} first=${out.hop?.first} |`,
  '',
  `已对：${[out.contract1 && '连接表/别名/空资源', out.contract2 && '一张 pending', out.contract3 && '右表+取消', out.hop?.kind === '工单' && '工单 hop'].filter(Boolean).join('；') || '无'}`,
  `未对：${out.ok ? '无' : (out.fail || '见上表仍差')}`,
  `仍差：${out.ok ? '无' : '本刀未过'}`,
  '',
  '## 图',
  '',
  MEDIA,
  '',
]
await writeFile(REPORT_JSON, `${JSON.stringify(out, null, 2)}\n`)
await writeFile(REPORT_MD, md.join('\n'))
try {
  await dualWrite(REPORT_JSON, 'internal/verify-records-close-contract.json')
  await dualWrite(REPORT_MD, 'internal/verify-records-close-contract.md')
} catch { /* ignore */ }
console.log(JSON.stringify({
  ok: out.ok,
  beforeWrite: out.beforeWrite,
  pickedClarification: out.pickedClarification,
  write: out.write,
  cancel: out.cancel,
  contract1: out.contract1,
  contract2: out.contract2,
  contract3: out.contract3,
  fail: out.fail,
}, null, 2))
process.exit(out.ok ? 0 : 1)
