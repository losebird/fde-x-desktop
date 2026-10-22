import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { pullPeopleUrl, PEOPLE_MAX_RESPONSE_BYTES } from '../people-sync.js'

async function withServer(handler, fn) {
  const server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try { await fn(`http://127.0.0.1:${server.address().port}/people`) } finally { server.close() }
}

test('people sync rejects private network targets by default', async () => {
  const result = await pullPeopleUrl('http://127.0.0.1:8080/people', '')
  assert.equal(result.ok, false)
  assert.equal(result.error, 'PRIVATE_NETWORK_FORBIDDEN')
})

test('people sync rejects oversized responses without replacing data', async () => {
  await withServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ people: [{ id: 'x', displayName: 'x'.repeat(PEOPLE_MAX_RESPONSE_BYTES) }] }))
  }, async (url) => {
    const result = await pullPeopleUrl(url, '', { allowPrivate: true })
    assert.equal(result.ok, false)
    assert.equal(result.error, 'RESPONSE_TOO_LARGE')
  })
})

test('people sync refuses redirects', async () => {
  await withServer((_req, res) => {
    res.writeHead(302, { location: 'http://127.0.0.1:1/private' })
    res.end()
  }, async (url) => {
    const result = await pullPeopleUrl(url, '', { allowPrivate: true })
    assert.equal(result.ok, false)
    assert.equal(result.error, 'FETCH_FAILED')
  })
})
