import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'

const ws = '/Users/zxz/Documents/ai-project/fdex测试'
const speech = '停用客户还有哪些没关的工单？'
const mainBase = 'http://127.0.0.1:5174'
const mediaPath =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/disabled-open-tickets.png'

await mkdir(mediaPath.replace(/\/[^/]+$/, ''), { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const out = { speech, rows: null, where: null, from: null, counts: {} }

try {
  await page.goto(mainBase, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.evaluate(async () => {
    await fetch('/api/v1/ai/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  })

  const probe = await page.evaluate(async ({ ws, speech }) => {
    async function preview(body) {
      const res = await fetch('/api/v1/biz/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspace: ws, cwd: ws, action: '现查', ...body }),
      })
      const json = await res.json()
      const sheet = json?.data?.sheet || json?.data
      return {
        err: json?.error?.message || json?.error,
        rows: Array.isArray(sheet?.rows) ? sheet.rows.length : 0,
        where: sheet?.where,
        kind: sheet?.kind,
        hopWhere: sheet?.hopWhere,
      }
    }

    const all = await preview({ kind: '工单', speech: 'probe-all' })
    const customers = await preview({
      kind: '客户',
      speech: 'probe-customers',
      where: [{ keys: ['status'], values: ['inactive', '停用'] }],
    })
    const intent = await preview({ kind: '工单', speech })
    return { all, customers, intent }
  }, { ws, speech })

  out.counts = probe
  out.rows = probe.intent.rows
  out.where = probe.intent.where
  out.kind = probe.intent.kind

  await page.goto(`${mainBase}/data`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.getByRole('button', { name: '业务记录' }).click({ timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1200)
  await page.screenshot({ path: mediaPath, fullPage: false })
} finally {
  await browser.close()
}

console.log(JSON.stringify(out, null, 2))
