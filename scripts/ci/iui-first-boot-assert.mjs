import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const PHASES = new Set(['stage', 'link', 'boot', 'enable'])

export function parseIuiStateLines(text) {
  const rows = []
  for (const line of String(text).split('\n')) {
    const at = line.indexOf('iui-state ')
    if (at < 0) continue
    rows.push(JSON.parse(line.slice(at + 'iui-state '.length)))
  }
  return rows
}

export function isInstallingRecord(row) {
  if (!row || row.state !== 'installing') return false
  if (!PHASES.has(row.phase)) return false
  const progress = row.progress
  if (!progress) return false
  const { completed, total } = progress
  return Number.isInteger(completed)
    && Number.isInteger(total)
    && total === 4
    && completed >= 0
    && completed <= total
}

export function isEnabledRecord(row) {
  return Boolean(row && row.state === 'enabled' && typeof row.version === 'string' && row.version.length > 0)
}

function installingThenEnabled(rows) {
  let seenInstalling = false
  for (const row of rows) {
    if (isInstallingRecord(row)) seenInstalling = true
    if (seenInstalling && isEnabledRecord(row)) return true
  }
  return false
}

export function judgeIuiFirstBoot({ samples, transitions, pageTexts }) {
  const failures = []
  if (!Array.isArray(pageTexts) || pageTexts.length === 0) {
    failures.push('the page produced no text')
  }
  for (const text of pageTexts || []) {
    if (text.includes('IUI 未安装')) failures.push('page showed IUI 未安装')
    if (text.includes('请重新执行')) failures.push('page showed 请重新执行 pnpm dev')
  }
  const pollSawInstalling = (samples || []).some(isInstallingRecord)
  const logSawInstalling = (transitions || []).some(isInstallingRecord)
  const apiSawEnabled = (samples || []).some(isEnabledRecord)
  if (!apiSawEnabled) failures.push('status never reached enabled')
  if (pollSawInstalling) {
    if (!installingThenEnabled(samples)) failures.push('status did not go from installing to enabled')
  } else if (!logSawInstalling) {
    failures.push('installing was missing from status polls and from the transition log')
  } else if ((transitions || []).some(isEnabledRecord) && !installingThenEnabled(transitions)) {
    failures.push('transition log recorded enabled before installing')
  }
  return {
    ok: failures.length === 0,
    failures: [...new Set(failures)],
    evidence: pollSawInstalling ? 'poll' : (logSawInstalling ? 'transition log' : 'none'),
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function connectionCode(error) {
  if (!error || typeof error !== 'object') return ''
  if (typeof error.code === 'string') return error.code
  const cause = error.cause
  if (cause && typeof cause === 'object' && typeof cause.code === 'string') return cause.code
  return ''
}

async function readStatus(runtimeOrigin) {
  const response = await fetch(`${runtimeOrigin}/api/v1/ai/status`)
  if (!response.ok) throw new Error(`GET /api/v1/ai/status returned ${response.status}`)
  const body = await response.json()
  if (!body || !body.data || !body.data.iui) throw new Error('status response has no data.iui')
  return body.data.iui
}

async function openRuntimePanel(page, webOrigin) {
  await page.goto(`${webOrigin}/settings`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForURL(/\/ai/, { timeout: 30_000 })
  const select = page.getByRole('combobox', { name: '分类' })
  if (await select.isVisible()) {
    await select.selectOption({ label: '运行环境' })
    return
  }
  await page.getByRole('navigation', { name: '分类' }).getByRole('button', { name: '运行环境', exact: true }).click()
}

async function samplePage(page, shouldStop, texts) {
  while (!shouldStop()) {
    let text = ''
    try {
      text = await page.locator('body').innerText({ timeout: 1_000 })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!/Timeout|destroyed|navigat|closed|Target page|not attached/i.test(message)) throw error
    }
    if (text) texts.push(text)
    await sleep(250)
  }
}

export async function watchFirstBoot({
  runtimeOrigin,
  webOrigin,
  logPath,
  timeoutMs = 180_000,
  launch,
}) {
  const samples = []
  const pageTexts = []
  let stop = false
  let sampling = Promise.resolve()
  const browser = await launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    sampling = samplePage(page, () => stop, pageTexts)
    const deadline = Date.now() + timeoutMs
    const polling = (async () => {
      while (!stop && Date.now() < deadline) {
        const iui = await readStatus(runtimeOrigin)
        samples.push(iui)
        console.log(`iui-poll ${JSON.stringify({ state: iui.state, phase: iui.phase, progress: iui.progress, version: iui.version })}`)
        if (isEnabledRecord(iui)) return
        await sleep(200)
      }
    })()
    const connecting = fetch(`${runtimeOrigin}/api/v1/ai/connect`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: webOrigin,
      },
      body: '{}',
    })
    const opening = openRuntimePanel(page, webOrigin)
    const connect = await connecting
    const connectText = await connect.text()
    console.log(`ai connect ${connect.status} ${connectText.slice(0, 400)}`)
    if (!connect.ok) throw new Error(`ai connect returned ${connect.status}`)
    await opening
    await polling
    if (!samples.some(isEnabledRecord)) throw new Error('timed out before data.iui.state became enabled')
    const trailing = await page.locator('body').innerText({ timeout: 5_000 })
    if (trailing) pageTexts.push(trailing)
    const transitions = parseIuiStateLines(await readFile(logPath, 'utf8'))
    return { samples, transitions, pageTexts }
  } finally {
    stop = true
    await sampling
    await browser.close()
  }
}

async function main() {
  const runtimeOrigin = process.env.FDE_RUNTIME_ORIGIN || 'http://127.0.0.1:4318'
  const webOrigin = process.env.FDE_WEB_ORIGIN || 'http://127.0.0.1:5174'
  const logPath = process.env.IUI_BOOT_LOG
  if (!logPath) throw new Error('IUI_BOOT_LOG is required')
  const { chromium } = await import('@playwright/test')
  const watched = await watchFirstBoot({
    runtimeOrigin,
    webOrigin,
    logPath,
    launch: () => chromium.launch(),
  })
  const verdict = judgeIuiFirstBoot(watched)
  console.log(`iui evidence ${verdict.evidence}`)
  console.log(`iui polls ${watched.samples.length} log ${watched.transitions.length} page ${watched.pageTexts.length}`)
  if (!verdict.ok) {
    for (const failure of verdict.failures) console.log(`ASSERT fail: IUI first boot ${failure}`)
    process.exit(1)
  }
  const healthResponse = await fetch(`${runtimeOrigin}/health`)
  if (!healthResponse.ok) throw new Error(`GET /health returned ${healthResponse.status}`)
  const health = await healthResponse.json()
  const detail = (Array.isArray(health.adapters) ? health.adapters : []).map((row) => row && row.detail || '').join('\n')
  if (!detail.includes('已启用（标准对话）')) {
    console.log('ASSERT fail: IUI enabled')
    process.exit(1)
  }
  console.log('ASSERT ok: IUI 已启用（标准对话）')
  console.log('ASSERT ok: IUI first boot passes through installing to enabled')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
