import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  externalUrlForTarget,
  isSafeExternalUrl,
  resolveAppOpenTarget,
} from '../../src/lib/app-open.ts'

describe('app open targets', () => {
  test('accepts http(s) and rejects unsafe schemes', () => {
    assert.deepEqual(resolveAppOpenTarget('https://127.0.0.1:48721/ax-open'), {
      href: 'https://127.0.0.1:48721/ax-open',
      kind: 'http',
    })
    assert.equal(resolveAppOpenTarget('http://127.0.0.1:5174/ai')?.kind, 'http')
    assert.equal(resolveAppOpenTarget('javascript:alert(1)'), null)
    assert.equal(resolveAppOpenTarget('data:text/html,hi'), null)
    assert.equal(resolveAppOpenTarget('ftp://files.local/a'), null)
    assert.equal(resolveAppOpenTarget(''), null)
  })

  test('file refs stay files, relative paths do not become fake http', () => {
    const abs = resolveAppOpenTarget('file:///tmp/clip.mp4')
    assert.equal(abs?.kind, 'file')
    assert.equal(abs?.href, 'file:///tmp/clip.mp4')
    assert.equal(abs?.path, '/tmp/clip.mp4')
    const relative = resolveAppOpenTarget('notes/week.md')
    assert.deepEqual(relative, {
      href: 'notes/week.md',
      kind: 'file',
      path: 'notes/week.md',
    })
    assert.equal(externalUrlForTarget(relative), null)
    const unix = resolveAppOpenTarget('/tmp/clip.mp4')
    assert.ok(unix)
    assert.equal(externalUrlForTarget(unix), 'file:///tmp/clip.mp4')
  })

  test('only http(s) and file are safe to hand to the desktop shell', () => {
    assert.equal(isSafeExternalUrl('https://127.0.0.1:48721/'), true)
    assert.equal(isSafeExternalUrl('file:///tmp/a.pdf'), true)
    assert.equal(isSafeExternalUrl('javascript:alert(1)'), false)
  })
})

describe('desktop shell wiring', () => {
  test('main window denies window.open and opens http(s)/file outside', async () => {
    const mainPath = fileURLToPath(new URL('../../apps/desktop/src/main.ts', import.meta.url))
    const src = await readFile(mainPath, 'utf8')
    assert.match(src, /setWindowOpenHandler/)
    assert.match(src, /shell\.openExternal/)
    assert.match(src, /action: 'deny'/)
    assert.match(src, /fde:open-external/)
    assert.doesNotMatch(src, /example\.com/)
  })
})
