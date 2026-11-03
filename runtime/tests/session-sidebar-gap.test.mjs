import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const serverSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'server.mjs'), 'utf8')
const strip = /<style data-fde-dsh-strip>([\s\S]*?)<\/style>/.exec(serverSrc)?.[1] || ''

function frameHtml(style) {
  return `<!doctype html><html data-fde-session-canvas data-platform="darwin"><head><style>
.pI_x6G_frame{display:grid;height:400px;width:800px}
.pI_x6G_sidebarCol{background:#f3f4f6;overflow:hidden}
.pI_x6G_centerCol{background:#fff}
${style}
</style></head><body>
<div class="pI_x6G_frame" style="grid-template-columns:280px minmax(400px,1fr) minmax(0px,0px)">
  <div class="pI_x6G_sidebarCol" id="sidebar"></div>
  <div class="pI_x6G_centerCol" id="center"></div>
  <div class="pI_x6G_rightbarCol"></div>
</div>
</body></html>`
}

test('expanded DSH sidebar column collapses under session-canvas occupancy CSS', async () => {
  assert.ok(strip.includes('[class$="_sidebarCol"]'))
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 500 } })
    await page.setContent(frameHtml(strip), { waitUntil: 'domcontentloaded' })
    const box = await page.evaluate(() => {
      const sidebar = document.getElementById('sidebar').getBoundingClientRect()
      const center = document.getElementById('center').getBoundingClientRect()
      const cols = getComputedStyle(document.querySelector('.pI_x6G_frame')).gridTemplateColumns
      return { sidebar: sidebar.width, center: center.width, cols }
    })
    assert.equal(box.sidebar, 0)
    assert.ok(box.center >= 500, `conversation column collapsed, center=${box.center}`)
    assert.match(box.cols, /^0px /)
  } finally {
    await browser.close()
  }
})

test('display:none on the DSH sidebar column would steal the conversation track', async () => {
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 500 } })
    const bad = 'html[data-fde-session-canvas] [class$="_frame"]:has(> [class$="_sidebarCol"]){grid-template-columns:0 minmax(0,1fr) 0!important}html[data-fde-session-canvas] [class$="_sidebarCol"]{display:none!important}'
    await page.setContent(frameHtml(bad), { waitUntil: 'domcontentloaded' })
    const center = await page.locator('#center').evaluate((el) => el.getBoundingClientRect().width)
    assert.ok(center < 50, `display:none must collapse the conversation; center=${center}`)
  } finally {
    await browser.close()
  }
})

test('old collapsed-only selector leaves the expanded Host sidebar column', async () => {
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 500 } })
    const old = 'html[data-fde-session-canvas] [data-sidebar-collapsed]{grid-template-columns:0 minmax(0,1fr) 0!important}'
    await page.setContent(frameHtml(old), { waitUntil: 'domcontentloaded' })
    const width = await page.locator('#sidebar').evaluate((el) => el.getBoundingClientRect().width)
    assert.ok(width >= 270, `expected leftover sidebar, got ${width}`)
  } finally {
    await browser.close()
  }
})
