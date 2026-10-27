import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { tryServeStatic } from '../routes/static.mjs'

test('brand files do not fall back to index.html', async () => {
  const root = `/tmp/fde-brand-${Date.now()}`
  mkdirSync(join(root, 'brand'), { recursive: true })
  writeFileSync(join(root, 'brand', 'icon.png'), 'png')
  writeFileSync(join(root, 'index.html'), '<html>spa</html>')
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    if (tryServeStatic(root, req, res, { spaFallback: false })) return
    res.writeHead(404)
    res.end('missing')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const hit = await fetch(`http://127.0.0.1:${port}/brand/icon.png`)
  assert.equal(hit.status, 200)
  assert.equal(hit.headers.get('content-type'), 'image/png')
  assert.equal(await hit.text(), 'png')
  const miss = await fetch(`http://127.0.0.1:${port}/brand/missing.png`)
  assert.equal(miss.status, 404)
  assert.equal(await miss.text(), 'missing')
  server.close()
  rmSync(root, { recursive: true, force: true })
})
