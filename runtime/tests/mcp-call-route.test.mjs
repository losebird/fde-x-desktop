import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'

const require = createRequire(import.meta.url)
const bridge = require(join(dirname(fileURLToPath(import.meta.url)), '..', 'fde-x-dsh-bridge', 'lib', 'index.js'))

function request(method, path, headers, body) {
  const raw = body == null ? '' : JSON.stringify(body)
  const req = Readable.from(raw ? [Buffer.from(raw)] : [])
  req.method = method
  req.url = path
  req.headers = headers
  return req
}

function response() {
  return {
    statusCode: 0,
    writeHead(code) {
      this.statusCode = code
    },
    end(buf) {
      this.raw = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf || '')
    },
  }
}

async function call(handler, method, path, headers, body) {
  const req = request(method, path, headers, body)
  const res = response()
  await handler(req, res)
  return { status: res.statusCode, body: res.raw ? JSON.parse(res.raw) : {} }
}

test('POST /fde-session/mcp/call requires the bridge token and an mcp__ tool', async () => {
  assert.equal(typeof bridge.createFdeSessionHandler, 'function')
  const home = await mkdtemp(join(tmpdir(), 'fde-mcp-call-'))
  const previous = process.env.FDE_DSH_HOME
  process.env.FDE_DSH_HOME = home
  await mkdir(join(home, 'run'), { recursive: true })
  await writeFile(join(home, 'run', 'bridge.token'), 'bridge-token\n')
  const executed = []
  const registered = new Set(['mcp__mail__imap_search'])
  const handler = bridge.createFdeSessionHandler({
    tools: {
      get(name) {
        return registered.has(name) ? { name } : undefined
      },
      async execute(input) {
        executed.push(input)
        if (input.arguments && input.arguments.fail) {
          return { isError: true, error: { message: 'connection reset by peer' }, content: [] }
        }
        return {
          isError: false,
          value: 'fake-mail-item',
          content: [{ type: 'text', text: 'fake-mail-item' }],
        }
      },
    },
  })
  try {
    const missing = await call(handler, 'POST', '/fde-session/mcp/call', { 'content-type': 'application/json' }, {
      name: 'mcp__mail__imap_search',
      args: { mailbox: 'INBOX' },
    })
    assert.equal(missing.status, 401)
    assert.equal(missing.body.ok, false)
    assert.equal(missing.body.error, 'bridge_unauthorized')
    assert.equal(executed.length, 0)

    const wrong = await call(handler, 'POST', '/fde-session/mcp/call', {
      'content-type': 'application/json',
      'x-fde-bridge-token': 'not-the-token',
    }, {
      name: 'mcp__mail__imap_search',
      args: { mailbox: 'INBOX' },
    })
    assert.equal(wrong.status, 401)
    assert.equal(wrong.body.error, 'bridge_unauthorized')
    assert.equal(executed.length, 0)

    const foreign = await call(handler, 'POST', '/fde-session/mcp/call', {
      'content-type': 'application/json',
      'x-fde-bridge-token': 'bridge-token',
    }, {
      name: 'fde_briefing_submit',
      args: {},
    })
    assert.equal(foreign.status, 403)
    assert.equal(foreign.body.error, 'tool_not_allowed')
    assert.equal(executed.length, 0)

    const unknown = await call(handler, 'POST', '/fde-session/mcp/call', {
      'content-type': 'application/json',
      'x-fde-bridge-token': 'bridge-token',
    }, {
      name: 'mcp__ghost__missing',
      args: {},
    })
    assert.equal(unknown.status, 403)
    assert.equal(unknown.body.error, 'tool_not_registered')
    assert.equal(executed.length, 0)

    const ok = await call(handler, 'POST', '/fde-session/mcp/call', {
      'content-type': 'application/json',
      'x-fde-bridge-token': 'bridge-token',
    }, {
      name: 'mcp__mail__imap_search',
      args: { mailbox: 'INBOX' },
    })
    assert.equal(ok.status, 200)
    assert.equal(ok.body.ok, true)
    assert.equal(ok.body.text, 'fake-mail-item')
    assert.equal(executed.length, 1)
    assert.equal(executed[0].name, 'mcp__mail__imap_search')
    assert.deepEqual(executed[0].arguments, { mailbox: 'INBOX' })
    assert.equal(typeof executed[0].callId, 'string')
    assert.ok(executed[0].callId)
    assert.equal(executed[0].signal.aborted, false)

    const failed = await call(handler, 'POST', '/fde-session/mcp/call', {
      'content-type': 'application/json',
      'x-fde-bridge-token': 'bridge-token',
    }, {
      name: 'mcp__mail__imap_search',
      args: { fail: true },
    })
    assert.equal(failed.body.ok, false)
    assert.equal(failed.body.error, 'connection reset by peer')
    const token = await readFile(join(home, 'run', 'bridge.token'), 'utf8')
    assert.equal(token.trim(), 'bridge-token')
  } finally {
    if (previous == null) delete process.env.FDE_DSH_HOME
    else process.env.FDE_DSH_HOME = previous
    await rm(home, { recursive: true, force: true })
  }
})
