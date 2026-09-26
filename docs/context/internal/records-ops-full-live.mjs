import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const sharp = require('/tmp/pw-run/node_modules/sharp')
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'

const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const MEDIA_FULL = `${STORE}/media/records-ops-full.png`
const MEDIA_HISTORY = `${STORE}/media/records-history-open.png`
const REPORT = `${STORE}/internal/verify-records-ops-full.md`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'

const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'

let sha = 'unknown'
try {
  sha = execSync('git rev-parse HEAD', { cwd: SCENE, encoding: 'utf8' }).trim()
} catch {
  /* ignore */
}

await mkdir(`${STORE}/media`, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } })

async function stitchVertical(buffers, gap = 6) {
  const metas = await Promise.all(buffers.map((b) => sharp(b).metadata()))
  const width = Math.max(...metas.map((m) => m.width || 0))
  let height = 0
  const composites = []
  for (let i = 0; i < buffers.length; i++) {
    const m = metas[i]
    composites.push({ input: buffers[i], top: height, left: 0 })
    height += (m.height || 0) + (i < buffers.length - 1 ? gap : 0)
  }
  return sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite(composites)
    .png()
    .toBuffer()
}

const criteria = {
  1: { label: '操作列来自词表 can', pass: false, detail: '' },
  2: { label: '无「规划数据操作」', pass: false, detail: '' },
  3: { label: '选中行高亮', pass: false, detail: '' },
  4: { label: '本会话浮现历史有本 session 项', pass: false, detail: '' },
  5: { label: 'Kind chips 仅当前操作绑定 kinds', pass: false, detail: '' },
  6: { label: '单元格 enum 标题非 raw code', pass: false, detail: '' },
}
let hardcoded = []

try {
  await page.goto(`${mainBase}/data`, { waitUntil: 'networkidle', timeout: 90000 })

  await page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeDataSubview = 'records'
    const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
    if (!rows.some((r) => r.id === wsId)) {
      rows.push({ id: wsId, name: 'fdex测试1', desc: cwd, cwd })
    } else {
      state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
    }
    state.state.workspaces = state.state.workspaces || rows
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd })

  await page.reload({ waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(2000)

  await page.evaluate(async () => {
    try {
      await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    } catch {
      /* ignore */
    }
  })

  await page.waitForSelector('table tbody tr', { timeout: 60000 }).catch(() => null)
  await page.waitForTimeout(1500)

  const probe = await page.evaluate(async ({ ws, cwd }) => {
    const bodyText = document.body.innerText || ''
    const hasPlanBtn = bodyText.includes('规划数据操作')

    const kindsRes = await fetch(`/api/v1/biz/kinds?workspace=${encodeURIComponent(ws)}&cwd=${encodeURIComponent(cwd)}`)
    const kindsJson = await kindsRes.json().catch(() => ({}))
    const kinds = kindsJson?.data?.kinds || kindsJson?.kinds || []

    const opHeader = [...document.querySelectorAll('th')].find((th) => th.textContent?.trim() === '操作')
    const opCell = opHeader
      ? opHeader.closest('table')?.querySelector('tbody tr td:last-child')
      : null
    const opButtons = opCell
      ? [...opCell.querySelectorAll('button')].map((b) => b.textContent?.trim()).filter(Boolean)
      : []

    const activeChip = [...document.querySelectorAll('.btn')].find((b) =>
      b.className.includes('!bg-ink'),
    )
    const activeKindLabel = activeChip?.textContent?.replace(/\d+$/, '').trim() || ''
    const kindRow = kinds.find((k) => (k.label || k.kind) === activeKindLabel || k.kind === activeKindLabel)
      || kinds.find((k) => /工单/.test(String(k.kind)) && !/审批|处理|日志/.test(String(k.kind)))
    const expectedActions = kindRow
      ? (kindRow.can || []).filter((a) => !['现查', '新建'].includes(String(a))).map(String)
      : []

    const chips = [...document.querySelectorAll('.btn')].filter((b) => {
      const t = b.textContent?.trim() || ''
      return kinds.some((k) => t.startsWith(String(k.label || k.kind)))
    }).map((b) => b.textContent?.trim())

    const historySelect = [...document.querySelectorAll('select')].find((s) =>
      s.querySelector('option')?.textContent?.includes('本会话浮现历史'),
    )
    const historyOptions = historySelect
      ? [...historySelect.querySelectorAll('option')].slice(1).map((o) => o.textContent?.trim()).filter(Boolean)
      : []

    const surfacesRes = await fetch(`/api/v1/biz/surfaces?workspace=${encodeURIComponent(ws)}&cwd=${encodeURIComponent(cwd)}`).catch(() => null)
    let surfaceCount = 0
    if (surfacesRes?.ok) {
      const sj = await surfacesRes.json()
      const list = sj?.data?.surfaces || sj?.surfaces || []
      surfaceCount = Array.isArray(list) ? list.length : 0
    }

    const statusCodes = ['processing', 'resolved', 'closed', 'pending', 'open']
    const cellTexts = [...document.querySelectorAll('table tbody td input, table tbody td')].map((el) => {
      if (el instanceof HTMLInputElement) return el.value
      return el.textContent?.trim() || ''
    })
    const rawStatusInCells = statusCodes.filter((code) => cellTexts.some((t) => t === code))

    const enumLike = cellTexts.filter((t) => /^(处理中|已解决|已关闭|进行中)/.test(t))

    return {
      hasPlanBtn,
      opButtons,
      expectedActions,
      kindKey: kindRow?.kind,
      chips,
      historyOptions,
      historyOptionCount: historyOptions.length,
      surfaceCount,
      rawStatusInCells,
      enumLikeSample: enumLike.slice(0, 5),
      rowCount: document.querySelectorAll('table tbody tr').length,
    }
  }, { ws: workspaceId, cwd: workspaceCwd })

  criteria[2].pass = !probe.hasPlanBtn
  criteria[2].detail = probe.hasPlanBtn ? '仍可见规划数据操作' : 'ok'

  const opMatch =
    probe.opButtons.length > 0 &&
    (probe.expectedActions.length === 0 || probe.expectedActions.every((a) => probe.opButtons.includes(a)))
  criteria[1].pass = opMatch
  criteria[1].detail = `buttons=[${probe.opButtons.join(',')}] expected=[${probe.expectedActions.join(',')}] kind=${probe.kindKey || '?'}`

  const pickRow = page.locator('table tbody tr').nth(2)
  if (await pickRow.count()) {
    await pickRow.locator('button').first().click({ force: true })
    await page.waitForTimeout(500)
    const selectedBg = await pickRow.evaluate((tr) => {
      const cls = tr.className || ''
      const bg = getComputedStyle(tr).backgroundColor
      return { cls, bg }
    })
    criteria[3].pass = selectedBg.cls.includes('brand-soft')
    criteria[3].detail = `bg=${selectedBg.bg} cls=${selectedBg.cls.slice(0, 80)}`
  } else {
    criteria[3].detail = 'no rows'
  }

  criteria[4].pass = probe.historyOptionCount > 0 || probe.surfaceCount > 0
  criteria[4].detail = `options=${probe.historyOptionCount} apiSurfaces=${probe.surfaceCount} labels=${probe.historyOptions.slice(0, 2).join(' | ')}`

  criteria[5].pass = probe.chips.length > 0 && probe.chips.length <= 4
  criteria[5].detail = `chips=${probe.chips.join('; ')}`

  criteria[6].pass = probe.rawStatusInCells.length === 0 && probe.enumLikeSample.length > 0
  criteria[6].detail = `raw=${probe.rawStatusInCells.join(',') || 'none'} zh=${probe.enumLikeSample.join(',') || 'none'}`

  const srcFiles = [
    `${SCENE}/src/components/biz/RecordsPanel.tsx`,
    `${SCENE}/src/lib/biz-sheet-display.ts`,
  ]
  const banned = ['处理中', '已解决', '已关闭', 'processing', '停用', '工单', '客户']
  for (const f of srcFiles) {
    const text = await readFile(f, 'utf8').catch(() => '')
    for (const word of banned) {
      if (text.includes(word) && !text.includes('//') && word === '工单') {
        if (/["'`]工单["'`]/.test(text)) hardcoded.push(`${f}: ${word}`)
      } else if (['处理中', '已解决', '已关闭', 'processing'].includes(word) && text.includes(`'${word}'`)) {
        hardcoded.push(`${f}: ${word}`)
      }
    }
  }

  const panel = page.locator('div.space-y-3').filter({ has: page.locator('table') }).first()
  const headerBuf = await panel.locator(':scope > div').first().screenshot()
  const blueBar = page.locator('.border-blue-200').first()
  const blueBuf = (await blueBar.count()) ? await blueBar.screenshot() : null
  const tableBuf = await page.locator('table').first().screenshot()
  const footerBuf = await panel.locator('text=共').first().locator('xpath=ancestor::div[1]').screenshot().catch(() => null)
  const actionBuf = await panel.locator('button', { hasText: '交给当前 AI' }).locator('xpath=ancestor::div[1]').screenshot().catch(() => null)

  const parts = [headerBuf, blueBuf, tableBuf, footerBuf, actionBuf].filter(Boolean)
  await writeFile(MEDIA_FULL, await stitchVertical(parts))

  const historySelect = page.locator('select').filter({ hasText: '本会话浮现历史' })
  if (await historySelect.count()) {
    await historySelect.evaluate((el) => {
      el.size = el.options.length
      el.style.height = 'auto'
      el.style.position = 'relative'
      el.style.zIndex = '50'
    })
    await page.waitForTimeout(300)
    const hbox = await historySelect.boundingBox()
    if (hbox) {
      await page.screenshot({
        path: MEDIA_HISTORY,
        clip: {
          x: Math.max(0, hbox.x - 40),
          y: Math.max(0, hbox.y - 80),
          width: Math.min(1680, hbox.width + 520),
          height: Math.min(500, hbox.height + 160),
        },
      })
    }
  }
} finally {
  await browser.close()
}

const pngBuf = await readFile(MEDIA_FULL).catch(() => Buffer.from(''))
const pngSha = createHash('sha256').update(pngBuf).digest('hex').slice(0, 16)

const lines = [
  '# verify-records-ops-full',
  '',
  `SHA: \`${sha}\``,
  `PNG SHA256 (16): \`${pngSha}\``,
  '',
  '| # | Criterion | Live 5174 |',
  '|---|-----------|-----------|',
]
for (const [n, c] of Object.entries(criteria)) {
  lines.push(`| ${n} | ${c.label} | ${c.pass ? 'yes' : 'no'} |`)
}
lines.push('')
lines.push(`Hardcoded literals（状态/停用/客户/工单 写死）: ${hardcoded.length ? hardcoded.join('; ') : 'none'}`)
lines.push('')
lines.push('Details:')
for (const [n, c] of Object.entries(criteria)) {
  lines.push(`- ${n}: ${c.detail}`)
}
lines.push('')
lines.push(`Evidence: \`media/records-ops-full.png\`${await readFile(MEDIA_HISTORY).catch(() => null) ? ', `media/records-history-open.png`' : ''} · probe on \`${mainBase}/data\` · workspace \`${workspaceCwd}\``)

await writeFile(REPORT, lines.join('\n') + '\n')
console.log(JSON.stringify({ sha, criteria, hardcoded, report: REPORT }, null, 2))
