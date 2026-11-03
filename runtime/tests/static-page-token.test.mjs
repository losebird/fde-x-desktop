import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { tryServeStatic, workbenchStaticOpts } from '../routes/static.mjs'

const TOKEN = 'ab'.repeat(32)
const STALE = 'cd'.repeat(32)

function start(root, opts) {
  const server = createServer((req, res) => {
    if (tryServeStatic(root, req, res, opts)) return
    res.writeHead(404)
    res.end('miss')
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port })
    })
  })
}

test('workbench HTML gets the live page token', async () => {
  const root = `/tmp/fde-static-token-${Date.now()}`
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, 'index.html'), `<html><head><meta name="fde-ui-token" content="${STALE}" /></head><body>spa</body></html>`)
  const { server, port } = await start(root, workbenchStaticOpts(TOKEN))
  try {
    const hit = await fetch(`http://127.0.0.1:${port}/ai`)
    assert.equal(hit.status, 200)
    const html = await hit.text()
    assert.match(html, new RegExp(`content="${TOKEN}"`))
    assert.equal(html.includes(STALE), false)
    assert.equal(hit.headers.get('cache-control'), 'no-store')
  } finally {
    server.close()
    rmSync(root, { recursive: true, force: true })
  }
})

test('workbench static leaves /a for the public document mouth', async () => {
  const root = `/tmp/fde-static-skip-a-${Date.now()}`
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, 'index.html'), '<html><head></head><body>spa</body></html>')
  const { server, port } = await start(root, workbenchStaticOpts(TOKEN))
  try {
    const hit = await fetch(`http://127.0.0.1:${port}/a/share-id`)
    assert.equal(hit.status, 404)
    assert.equal(await hit.text(), 'miss')
  } finally {
    server.close()
    rmSync(root, { recursive: true, force: true })
  }
})

test('public HTML strips a baked token when no live token is passed', async () => {
  const root = `/tmp/fde-static-public-${Date.now()}`
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, 'index.html'), `<html><head><meta name="fde-ui-token" content="${STALE}" /></head><body>share</body></html>`)
  const { server, port } = await start(root, { spaFallback: true })
  try {
    const hit = await fetch(`http://127.0.0.1:${port}/a/share-id`)
    assert.equal(hit.status, 200)
    const html = await hit.text()
    assert.equal(html.includes('fde-ui-token'), false)
    assert.equal(html.includes(STALE), false)
  } finally {
    server.close()
    rmSync(root, { recursive: true, force: true })
  }
})
