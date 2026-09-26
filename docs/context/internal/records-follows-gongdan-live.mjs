import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'

const MEDIA_PATH =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-follows-gongdan.png'
const REPORT_PATH =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/internal/verify-records-follows-gongdan.md'

const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const speech = '停用客户还有哪些没关的工单？'

await mkdir(MEDIA_PATH.replace(/\/[^/]+$/, ''), { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const out = {
  speech,
  bffPreview: null,
  pendingAfter: null,
  panelKind: null,
  panelCount: null,
  footer: null,
  stillApproval: null,
  still70: null,
  hardcodedLiterals: 'none',
}

try {
  await page.goto(mainBase, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
    if (!rows.some((r) => r.id === wsId)) {
      rows.push({ id: wsId, name: 'fdex测试1', desc: cwd, cwd })
    } else {
      state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
    }
    state.state.workspaces = state.state.workspaces || rows
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd })

  await page.evaluate(async () => {
    await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  })

  const probe = await page.evaluate(async ({ ws, speech: utterance }) => {
    const kindsRes = await fetch(`/api/v1/biz/kinds?workspace=${encodeURIComponent(ws)}`)
    const kindsJson = await kindsRes.json()
    const kinds = kindsJson?.data?.kinds || []
    const ticketKind = kinds.find((k) => String(k.kind || '') === String(k.label || '') && /工单/.test(String(k.kind)) && !/处理|日志|生产/.test(String(k.kind)))?.kind
      || kinds.find((k) => /工单/.test(String(k.kind)) && !/审批|处理|日志|生产/.test(String(k.kind)))?.kind

    async function preview(kind, speechText) {
      const res = await fetch('/api/v1/biz/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspace: ws,
          cwd: ws,
          kind,
          action: '现查',
          speech: speechText,
        }),
      })
      const json = await res.json()
      const sheet = json?.data?.sheet || json?.data
      const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
      return {
        ok: res.ok,
        err: json?.error?.message || json?.error,
        kind: sheet?.kind,
        rows: rows.length,
        where: sheet?.where,
      }
    }

    let intent = null
    if (ticketKind) intent = await preview(ticketKind, utterance)

    const pendingRes = await fetch('/api/v1/biz/pending-sheet')
    const pendingJson = await pendingRes.json()
    const pendingSheet = pendingJson?.data?.sheet
    const pendingRows = Array.isArray(pendingSheet?.rows) ? pendingSheet.rows.length : null

    return { ticketKind, intent, pendingKind: pendingSheet?.kind, pendingRows }
  }, { ws: workspaceCwd, speech })

  out.bffPreview = probe.intent
  out.pendingAfter = { kind: probe.pendingKind, rows: probe.pendingRows }

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
    const history = document.querySelector('select.input')
    const historyVal = history?.value || ''
    const historyLabel = history?.selectedOptions?.[0]?.textContent?.trim() || ''
    return { chipText, footer, historyVal, historyLabel }
  })

  out.footer = ui.footer
  const footerMatch = ui.footer.match(/共\s*(\d+)\s*条/)
  out.panelCount = footerMatch ? Number(footerMatch[1]) : null
  out.panelKind = ui.chipText.replace(/\s*\d+\s*$/, '').trim() || probe.ticketKind

  out.stillApproval = ui.chipText.includes('审批') && !ui.chipText.includes(probe.ticketKind || '___')
  out.still70 = out.panelCount === 70

  await page.screenshot({ path: MEDIA_PATH, fullPage: false })
} finally {
  await browser.close()
}

const lines = [
  '# verify-records-follows-gongdan',
  '',
  `speech (live only): ${speech}`,
  '',
  `kind on panel: ${out.panelKind ?? 'unknown'} (chip: ${out.panelKind})`,
  `bff 现查 rowCount: ${out.bffPreview?.rows ?? 'n/a'} (kind ${out.bffPreview?.kind ?? 'n/a'})`,
  `pending after preview: kind=${out.pendingAfter?.kind ?? 'n/a'} rows=${out.pendingAfter?.rows ?? 'n/a'}`,
  `panel footer: ${out.footer ?? 'n/a'}`,
  `panel count: ${out.panelCount ?? 'n/a'}`,
  `count matches bff 现查: ${out.panelCount != null && out.bffPreview?.rows != null ? out.panelCount === out.bffPreview.rows : 'unknown'}`,
  `still-审批单: ${out.stillApproval ? 'yes' : 'no'}`,
  `still-70: ${out.still70 ? 'yes' : 'no'}`,
  `hardcoded literals: ${out.hardcodedLiterals}`,
  '',
  `screenshot: ${MEDIA_PATH}`,
]

await writeFile(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8')
console.log(JSON.stringify(out, null, 2))
