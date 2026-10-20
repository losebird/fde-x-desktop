import { createServer } from 'node:http'

const sessions = new Map()
let seq = 0

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  res.writeHead(status, { 'content-type': typeof body === 'string' ? 'text/plain' : 'application/json', ...headers })
  res.end(payload)
}

function usageFor(cwd) {
  if (String(cwd).includes('ws-guard-a')) return { cwd, bytes: 3, secret: '用量秘密A' }
  return { cwd, bytes: 9, secret: '用量秘密B' }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '')) {
    send(res, 303, '', { 'set-cookie': 'session=abc; Path=/', location: '/ready', 'content-type': 'text/plain' })
    return
  }
  if (req.method === 'GET' && url.pathname === '/ready') {
    send(res, 200, 'ok')
    return
  }
  if (req.method === 'GET' && url.pathname === '/semantic-os/usage') {
    send(res, 200, usageFor(url.searchParams.get('cwd') || ''))
    return
  }
  if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
    const envelope = await readBody(req)
    const method = decodeURIComponent(url.pathname.slice('/api/'.length))
    const args = envelope?.payload?.args && typeof envelope.payload.args === 'object' ? envelope.payload.args : {}
    const request = args.request && typeof args.request === 'object' ? args.request : args
    let value = { ok: true }
    if (method === 'session/list') {
      value = { items: [...sessions.values()] }
    } else if (method === 'session/create') {
      seq += 1
      const id = String(request.sessionId || `sess_${seq}`)
      const item = {
        sessionId: id,
        cwd: String(request.cwd || ''),
        running: false,
        blank: false,
        archived: false,
        updatedAt: new Date().toISOString(),
        projections: { values: { title: '未命名会话' } },
      }
      sessions.set(id, item)
      value = { sessionId: id, cwd: item.cwd }
    } else if (method === 'session/prompt') {
      const item = sessions.get(String(request.sessionId || ''))
      if (item) item.running = true
      value = { accepted: true }
    } else if (method === 'session/rename') {
      const item = sessions.get(String(request.sessionId || ''))
      if (item) item.projections.values.title = String(request.title || '')
      value = { title: request.title, seq: 1 }
    } else if (method === 'workspace/archiveSession') {
      const item = sessions.get(String(request.sessionId || ''))
      if (item) {
        item.archived = true
        item.running = false
        item.projections.values.title = '已归档'
      }
      value = { archived: true }
    } else if (method === 'session/cancel') {
      const item = sessions.get(String(request.sessionId || ''))
      if (item) {
        item.running = false
        item.projections.values.title = '已取消'
      }
      value = { accepted: true }
    } else if (method === 'workspace/insertSessionBefore') {
      value = { ok: true }
    } else if (method === 'fileUploads/upload') {
      value = { receiptId: 'receipt_foreign' }
    } else if (method === 'agentPresets/select') {
      value = { agentPreset: String(args.agentPreset || 'foreign') }
    } else if (method === 'commands/list' || method === 'commands/execute') {
      value = { items: [{ name: 'foreign-command' }], ran: true }
    }
    send(res, 200, {
      type: 'server-response',
      rpcId: envelope.rpcId,
      result: { ok: true, value },
    })
    return
  }
  send(res, 404, { error: 'missing' })
})

server.listen(0, '127.0.0.1', () => {
  const address = server.address()
  const port = address && typeof address === 'object' ? address.port : 0
  console.log(`dsh web: http://127.0.0.1:${port}/`)
})
