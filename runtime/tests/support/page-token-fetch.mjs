const PAGE_TOKEN_HEADER = 'x-fde-ui-token'
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const TOKEN_LINE = /^FDE_UI_TOKEN\s+([0-9a-f]{64})$/u

export function readPageTokenLine(line) {
  const match = TOKEN_LINE.exec(String(line ?? '').trim())
  return match ? match[1] : ''
}

function requestPathname(url) {
  return new URL(url, 'http://127.0.0.1').pathname
}

function needsPageToken(url, init) {
  const method = String(init?.method || 'GET').toUpperCase()
  if (!WRITE_METHODS.has(method)) return false
  const pathname = requestPathname(url)
  if (!pathname.startsWith('/api/v1/')) return false
  if (pathname.startsWith('/api/v1/app-share/')) return false
  return true
}

export function withPageToken(url, init, token) {
  if (!needsPageToken(url, init) || !token) return init
  const headers = new Headers(init?.headers)
  if (!headers.has(PAGE_TOKEN_HEADER)) headers.set(PAGE_TOKEN_HEADER, token)
  return { ...init, headers }
}

export function createPageTokenClient() {
  let token = ''
  let pending = ''
  let waiters = []

  function settle() {
    if (!token) return
    const queued = waiters
    waiters = []
    for (const waiter of queued) waiter.resolve(token)
  }

  return {
    get token() {
      return token
    },
    reset() {
      token = ''
      pending = ''
      const queued = waiters
      waiters = []
      const error = new Error('page token client reset')
      for (const waiter of queued) waiter.reject(error)
    },
    observe(chunk) {
      pending += String(chunk)
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines) {
        const found = readPageTokenLine(line)
        if (found) token = found
      }
      settle()
    },
    tokenReady(timeoutMs = 8000) {
      if (token) return Promise.resolve(token)
      return new Promise((resolve, reject) => {
        const waiter = { resolve, reject }
        const timer = setTimeout(() => {
          waiters = waiters.filter((row) => row !== waiter)
          reject(new Error('page token missing from supervised runtime stdout'))
        }, timeoutMs)
        const finish = (fn, value) => {
          clearTimeout(timer)
          fn(value)
        }
        waiter.resolve = (value) => finish(resolve, value)
        waiter.reject = (error) => finish(reject, error)
        waiters.push(waiter)
        if (token) settle()
      })
    },
    async fetch(url, init) {
      const current = needsPageToken(url, init) ? await this.tokenReady() : token
      return fetch(url, withPageToken(url, init, current))
    },
  }
}
