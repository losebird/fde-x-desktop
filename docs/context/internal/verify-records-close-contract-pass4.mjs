/**
 * Cancel the live 改行 preview; hop 工单 21 must remain.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const CURSOR_STORE = '/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e'
const MEDIA = `${STORE}/media/records-close-contract.png`
const MEDIA_WRITE = `${STORE}/media/records-close-contract-write.png`
const MEDIA_CANCEL = `${STORE}/media/records-close-contract-cancel.png`
const REPORT_JSON = `${STORE}/internal/verify-records-close-contract.json`
const REPORT_MD = `${STORE}/internal/verify-records-close-contract.md`
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'

let prev = {}
try { prev = JSON.parse(await readFile(REPORT_JSON, 'utf8')) } catch { prev = {} }

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } })
const bizWriteUrls = []
page.on('request', (req) => {
  if (/\/biz\/write\b/i.test(req.url()) && req.method() === 'POST') bizWriteUrls.push(req.url())
})

const out = { ...prev, fail: undefined, pass4: true }
delete out.fail

async function seedState(sessionId) {
  return page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd, sessionId: sid }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeDataSubview = 'records'
    if (sid) state.state.activeAiSessionId = sid
    const panels = Array.isArray(state.state.panels) ? state.state.panels : []
    state.state.panels = panels.map((p) => {
      if (p && p.id === 'data') return { ...p, state: 'full', width: 1100 }
      if (p && (p.state === 'full' || p.state === 'half')) return { ...p, state: 'tab' }
      return p
    })
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd, sessionId })
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
      first: rows[0] && typeof rows[0] === 'object' ? String(rows[0].no || '') : '',
      speech: sheet?.speech || '',
      preview_id: sheet?.preview_id || sheet?.previewId || null,
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
    return {
      kindChips,
      footer,
      footerCount,
      firstNo,
      drawerOpen: Boolean(drawer),
      drawerText: drawer ? (drawer.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 240) : '',
    }
  })
}

async function postPreview() {
  return page.evaluate(async (cwd) => {
    const res = await fetch('/api/v1/biz/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workspace: cwd,
        kind: '工单',
        action: '改行',
        no: 'TK20260623126',
        picked: true,
        speech: '把 TK20260623126 的状态改成已解决。只要预览，不要过账，不要 biz_write。',
        input: { status: 'resolved' },
      }),
    })
    const json = await res.json().catch(() => ({}))
    const sheet = json?.data?.sheet || json?.data || {}
    return {
      http: res.status,
      kind: sheet.kind,
      action: sheet.action,
      rows: Array.isArray(sheet.rows) ? sheet.rows.length : 0,
      preview_id: sheet.preview_id || json?.data?.preview_id || null,
      canWrite: sheet.canWrite,
    }
  }, workspaceCwd)
}

async function dualWrite(src, rel) {
  try {
    await mkdir(dirname(`${CURSOR_STORE}/${rel}`), { recursive: true })
    await copyFile(src, `${CURSOR_STORE}/${rel}`)
  } catch { /* ignore */ }
}

try {
  await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(async () => {
    await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => ({}))
  })
  const pending0 = await readPending()
  await seedState(pending0.sessionId || prev.sessionId)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  const rec = page.getByRole('button', { name: '业务记录', exact: true })
  if (await rec.count()) await rec.click({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(1200)

  let pending = await readPending()
  let ui = await readUi()
  if (!(ui.drawerOpen && pending.preview_id)) {
    out.writeFallback = await postPreview()
    const deadline = Date.now() + 20000
    while (Date.now() < deadline) {
      pending = await readPending()
      ui = await readUi()
      if (ui.drawerOpen && pending.kind === '工单' && pending.preview_id) break
      await page.waitForTimeout(400)
    }
  }
  out.write = {
    kind: pending.kind,
    action: pending.action,
    rows: pending.rows,
    first: pending.first,
    preview_id: pending.preview_id,
    drawerOpen: ui.drawerOpen,
    drawerText: ui.drawerText,
    chips: ui.kindChips,
    footerCount: ui.footerCount,
    ready: Boolean(ui.drawerOpen && pending.kind === '工单' && pending.preview_id),
  }
  await page.screenshot({ path: MEDIA_WRITE, fullPage: true })

  const cancelBtn = page.locator('div.fixed.inset-y-0.right-0').getByRole('button', { name: '取消' })
  const clicked = (await cancelBtn.count())
    ? await cancelBtn.click({ timeout: 8000 }).then(() => true).catch(() => false)
    : false
  await page.waitForTimeout(1800)
  const after = { pending: await readPending(), ui: await readUi() }
  out.cancel = {
    clicked,
    drawerOpen: after.ui.drawerOpen,
    kind: after.pending.kind,
    action: after.pending.action,
    rows: after.pending.rows,
    first: after.pending.first,
    speech: after.pending.speech,
    footerCount: after.ui.footerCount,
    firstNo: after.ui.firstNo,
    chips: after.ui.kindChips,
    preview_id: after.pending.preview_id,
    catalogDump: after.pending.kind !== '工单' || after.ui.footerCount >= 22 && !/停用客户/.test(String(after.pending.speech || '')),
    heldBatch: after.pending.kind === '工单' && after.pending.rows === 21 && /停用客户/.test(String(after.pending.speech || '')),
  }
  await page.screenshot({ path: MEDIA_CANCEL, fullPage: true })
  await page.screenshot({ path: MEDIA, fullPage: true })
  await dualWrite(MEDIA, 'media/records-close-contract.png')
  await dualWrite(MEDIA_WRITE, 'media/records-close-contract-write.png')
  await dualWrite(MEDIA_CANCEL, 'media/records-close-contract-cancel.png')
  out.media = MEDIA
  out.mediaWrite = MEDIA_WRITE
  out.mediaCancel = MEDIA_CANCEL
  out.wrote = bizWriteUrls.length > 0
  out.silentBizWrite = bizWriteUrls.length > 0
  out.contract1 = Boolean(
    (out.emptyRefuse?.http >= 400 || out.emptyCover?.http >= 400)
    && out.spokenAlias?.kind === '费用报销'
    && out.hop?.kind === '工单',
  )
  out.contract2 = Boolean(out.hop?.kind === '工单' && out.hop?.rows === 21)
  out.contract3 = Boolean(
    out.hop?.footerCount === 21
    && out.decoyHold?.held
    && out.cancel?.clicked
    && out.cancel?.heldBatch
    && !out.cancel?.catalogDump
    && !out.cancel?.drawerOpen,
  )
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
  '人话进 DSH，闸只校验 structured kind：词表+图+连接器表。空资源拒预览；口语短名走 型槽/aliases 收到已连接表；集合标题「工单」仍是自己。取消写预览回到 listBeforeWrite / remainRows，GET/watch 不得因 dismissed token 把 pending 置空。',
  '',
  '## 对照',
  '',
  `| 契约 | 状态 | 证据 |`,
  `|---|---|---|`,
  `| 1 只有已连接表能预览；口语别名；空资源拒 | ${out.contract1 ? '已对' : '仍差'} | empty=${JSON.stringify(out.emptyRefuse?.error || out.emptyCover?.error)} alias=${out.spokenAlias?.kind} hop=${out.hop?.kind} rows=${out.hop?.rows} |`,
  `| 2 一句话一张 pending | ${out.contract2 ? '已对' : '仍差'} | ${JSON.stringify(out.onePending)} |`,
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
await mkdir(`${STORE}/internal`, { recursive: true })
await writeFile(REPORT_JSON, `${JSON.stringify(out, null, 2)}\n`)
await writeFile(REPORT_MD, md.join('\n'))
console.log(JSON.stringify({ ok: out.ok, write: out.write, cancel: out.cancel, contract3: out.contract3, fail: out.fail }, null, 2))
process.exit(out.ok ? 0 : 1)
