import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir } from 'node:fs/promises'

const shotPath =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/gongdan-hop-bound.png'
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const speech = '停用客户还有哪些没关的工单？'

await mkdir(shotPath.replace(/\/[^/]+$/, ''), { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

try {
  await page.goto(mainBase, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.evaluate(async () => {
    await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  })
  await page.waitForTimeout(3000)

  await page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
    if (!rows.some((r) => r.id === wsId)) rows.push({ id: wsId, name: 'fdex测试1', desc: cwd, cwd })
    else state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
    state.state.workspaces = state.state.workspaces || rows
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd })

  const drive = await page.evaluate(async ({ cwd, utterance }) => {
    const res = await fetch('/api/v1/biz/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workspace: cwd,
        cwd,
        kind: '工单',
        action: '现查',
        speech: utterance,
      }),
    })
    const json = await res.json()
    const sheet = json?.data?.sheet || json?.data
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
    const closed = rows.filter((r) => /^(closed|resolved|done)$/i.test(String(r.status || '')))
    const pendingRes = await fetch('/api/v1/biz/pending-sheet')
    const pendingJson = await pendingRes.json()
    const pendingSheet = pendingJson?.data?.sheet
    const pendingRows = Array.isArray(pendingSheet?.rows) ? pendingSheet.rows.length : null
    return {
      ok: sheet?.ok ?? json?.data?.ok,
      err: json?.error?.message || json?.data?.error,
      kind: sheet?.kind,
      rows: rows.length,
      closed: closed.length,
      hopWhere: !!(sheet?.hopWhere && sheet.hopWhere.length),
      pendingKind: pendingSheet?.kind,
      pendingRows,
    }
  }, { cwd: workspaceCwd, utterance: speech })

  await page.goto(`${mainBase}/data?_=${Date.now()}`, { waitUntil: 'networkidle', timeout: 90000 })
  await page.getByRole('button', { name: '业务记录' }).click({ timeout: 30000 })
  await page.waitForTimeout(2500)

  const ui = await page.evaluate(() => {
    const kindWrap = [...document.querySelectorAll('div.flex.items-center.gap-1.flex-wrap')].find((el) =>
      [...el.querySelectorAll('button.btn')].some((b) => /工单|审批|客户/.test(b.textContent || '')),
    )
    const selectedChip = kindWrap
      ? [...kindWrap.querySelectorAll('button.btn')].find((b) => b.className.includes('bg-ink'))
      : null
    const chipText = selectedChip?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const footer = [...document.querySelectorAll('span')].map((s) => s.textContent?.trim() || '')
      .find((t) => t.startsWith('共 ') && t.includes('条')) || ''
    return { chipText, footer }
  })

  await page.screenshot({ path: shotPath, fullPage: false })
  console.log(JSON.stringify({ shotPath, drive, ui }, null, 2))
} finally {
  await browser.close()
}
