import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { bffPageOrigin, bffTokenHome } = require('../fde-x-dsh-bridge/lib/bff-post.js')

test('packaged Host posts turn-end with the BFF page origin', () => {
  assert.equal(
    bffPageOrigin({ FDE_RUNTIME_PORT: '54765', FDE_ALLOWED_ORIGINS: 'app://fde-x,http://127.0.0.1:54765' }),
    'http://127.0.0.1:54765',
  )
})

test('pnpm Host keeps the Vite origin for turn-end', () => {
  assert.equal(
    bffPageOrigin({ FDE_RUNTIME_PORT: '4318', FDE_ALLOWED_ORIGINS: 'http://127.0.0.1:5174,http://localhost:5174' }),
    'http://127.0.0.1:5174',
  )
})

test('token home prefers FDE_DSH_HOME', () => {
  assert.equal(
    bffTokenHome({ FDE_DSH_HOME: '/tmp/packaged-dsh', DSH_HOME: '/tmp/wrong' }),
    '/tmp/packaged-dsh',
  )
})

test('Host plugin no longer hardcodes Vite origin on turn-end', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../fde-x-dsh-bridge/lib/index.js'), 'utf8')
  assert.match(src, /Origin: bffPageOrigin\(\)/)
  assert.doesNotMatch(src, /Origin: 'http:\/\/127\.0\.0\.1:5174'/)
})
