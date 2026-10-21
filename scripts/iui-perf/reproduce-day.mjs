import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const iuiSrc = resolve(process.env.IUI_SRC || '/tmp/iui-src')
const outDir = resolve(process.env.IUI_PERF_OUT || join(repoRoot, 'artifacts', 'iui-perf', 'day'))

const { splitAuthorJsChunks, buildAuthorJsRuntimeSource } = await import(join(iuiSrc, 'src/shared/author-js-runtime.ts'))
const { buildHtmlSandboxSrcdoc, HTML_SANDBOX_MAX_AUTHOR_BYTES, prepareAuthorJs } = await import(join(iuiSrc, 'src/shared/html-sandbox.ts'))

const playwrightRoot = process.env.PLAYWRIGHT_ROOT || '/tmp/pw'
const require = createRequire(join(playwrightRoot, 'package.json'))
const { chromium } = require('playwright')

function padSpot(index) {
  return `{day:${index},name:'西湖${index}',detail:'${'细'.repeat(80)}',cost:${100 + index}}`
}

function hugeIife(callAtEnd) {
  const spots = []
  for (let i = 0; i < 400; i += 1) spots.push(padSpot(i))
  const body = [
    '(function(){',
    'function show(i){ var row = days[i]; document.getElementById("sheet").textContent = String(row.day); }',
    `var days = [${spots.join(',')}];`,
    callAtEnd ? 'show(0);' : 'show(9999);',
    '})();',
  ].join('\n')
  return body
}

const fixtures = [
  {
    id: 'iife-empty-days',
    why: 'One IIFE reads days[0].day while days is empty. The host reports that as author chunk 1/1.',
    js: '(function(){ var days = []; var row = days[0]; document.getElementById("sheet").textContent = String(row.day); })();',
    html: '<div id="sheet"></div>',
  },
  {
    id: 'find-miss',
    why: 'days.find returns undefined, then the script reads .day on load.',
    js: '(function(){ var days = [{id:"a",day:1}]; var selected = "missing"; var row = days.find(function(d){ return d.id === selected; }); document.getElementById("sheet").textContent = String(row.day); })();',
    html: '<div id="sheet"></div>',
  },
  {
    id: 'null-node-day',
    why: 'A missing node is NULL_NODE. Reading .day on that stub must not throw.',
    js: '(function(){ var node = document.getElementById("missing"); document.getElementById("sheet").textContent = String(node.day); })();',
    html: '<div id="sheet"></div>',
  },
  {
    id: 'field-mismatch-no-throw',
    why: 'An existing object with field d, read as .day, yields undefined and does not throw.',
    js: '(function(){ var days=[{d:"今日",hi:26}]; var row=days[0]; document.getElementById("sheet").textContent = String(row.day); })();',
    html: '<div id="sheet"></div>',
  },
  {
    id: 'two-statements',
    why: 'A top-level throw in the second statement is chunk 2, not 1/1.',
    js: 'var days = [{day:1}];\nvar row = days[1];\ndocument.getElementById("sheet").textContent = String(row.day);',
    html: '<div id="sheet"></div>',
  },
  {
    id: 'truncated-show-missing-index',
    why: 'JS longer than the 48000 byte cut. show(9999) stays before the cut and reads a missing row.',
    js: hugeIife(false),
    html: '<div id="sheet"></div>',
  },
  {
    id: 'truncated-show-zero',
    why: 'Same oversized script, but show(0) runs on a row that still exists before the cut.',
    js: hugeIife(true),
    html: '<div id="sheet"></div>',
  },
]

function chunkNote(js) {
  const prepared = prepareAuthorJs(js)
  const limit = HTML_SANDBOX_MAX_AUTHOR_BYTES
  const truncated = prepared.length > limit
  const kept = truncated ? `${prepared.slice(0, limit)}\n/* js truncated */` : prepared
  let syntax = 'parses'
  try {
    new Function(kept)
  } catch (error) {
    syntax = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  }
  return {
    preparedBytes: prepared.length,
    limit,
    truncated,
    chunks: splitAuthorJsChunks(kept).length,
    syntax,
  }
}

async function render(browser, fixture) {
  const spec = {
    title: fixture.id,
    css: '',
    html: fixture.html,
    js: fixture.js,
    height: 240,
  }
  const doc = buildHtmlSandboxSrcdoc(spec)
  const page = await browser.newPage()
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (error) => pageErrors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await page.setContent(doc, { waitUntil: 'load' })
  await page.waitForTimeout(400)
  const strip = await page.locator('[data-iui-author-fail]').first().innerText().catch(() => '')
  const hostStrip = await page.locator('[data-iui-host-fail]').count()
  const sheet = await page.locator('#sheet').innerText().catch(() => '')
  await page.close()
  return {
    id: fixture.id,
    why: fixture.why,
    prep: chunkNote(fixture.js),
    strip,
    hostFailStrips: hostStrip,
    sheet,
    pageErrors,
    consoleErrors,
  }
}

await mkdir(outDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []
for (const fixture of fixtures) {
  results.push(await render(browser, fixture))
}
await browser.close()

const runtime = buildAuthorJsRuntimeSource()
const report = {
  iuiCommit: 'c5b5a4b7b9b5d39f541a796b9bb5e495f61c6c37',
  iuiVersion: '0.13.0-iui.26',
  hostReadsDay: runtime.includes('.day'),
  authorLimitBytes: HTML_SANDBOX_MAX_AUTHOR_BYTES,
  lines: {
    split: 'src/shared/author-js-runtime.ts:11',
    failureTitle: 'src/shared/author-js-runtime.ts:451',
    evalChunk: 'src/shared/author-js-runtime.ts:596',
    nullNode: 'src/shared/author-js-runtime.ts:532',
    prepareThenTruncate: 'src/shared/html-sandbox.ts:2591',
    truncateSlice: 'src/shared/html-sandbox.ts:1013',
  },
  results,
}
await writeFile(join(outDir, 'reproduce-day.json'), `${JSON.stringify(report, null, 2)}\n`)
for (const row of results) {
  console.log(JSON.stringify({
    id: row.id,
    chunks: row.prep.chunks,
    truncated: row.prep.truncated,
    syntax: row.prep.syntax,
    strip: row.strip.replace(/\s+/g, ' ').slice(0, 180),
    sheet: row.sheet,
    pageErrors: row.pageErrors,
  }))
}
console.log(`wrote ${join(outDir, 'reproduce-day.json')}`)
