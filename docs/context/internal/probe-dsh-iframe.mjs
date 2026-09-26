import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'

const mainBase = 'http://127.0.0.1:5174'
const sid = 'session-a10eaa50-f768-42d3-ac55-ce7532853a4a'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } })
await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd, sid: sessionId }) => {
  const key = 'scene-39-workstation'
  const raw = localStorage.getItem(key)
  const state = raw ? JSON.parse(raw) : { state: {} }
  state.state = state.state || {}
  state.state.activeWorkspaceId = wsId
  state.state.activeDataSubview = 'records'
  state.state.activeAiSessionId = sessionId
  const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
  state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, cwd } : r))
  localStorage.setItem(key, JSON.stringify(state))
}, { workspaceId, workspaceCwd, sid })
await page.goto(`${mainBase}/ai/${sid}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(8000)
const info = await page.evaluate(() => {
  const iframe = document.querySelector('iframe')
  const all = [...document.querySelectorAll('iframe')].map((el) => ({
    title: el.getAttribute('title') || '',
    src: el.getAttribute('src') || '',
    w: el.clientWidth,
    h: el.clientHeight,
  }))
  const banner = document.body.innerText.slice(0, 400)
  return {
    iframeCount: all.length,
    iframes: all,
    hasTitle: Boolean(document.querySelector('iframe[title="DSH 会话"]')),
    banner,
    href: location.href,
  }
})
const frames = []
for (const frame of page.frames()) {
  let text = ''
  try {
    text = await frame.evaluate(() => (document.body?.innerText || '').slice(0, 200))
  } catch (error) {
    text = `ERR ${error.message}`
  }
  frames.push({ url: frame.url(), text })
}
console.log(JSON.stringify({ info, frames }, null, 2))
await page.screenshot({
  path: '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bq-iframe-probe.png',
})
await browser.close()
