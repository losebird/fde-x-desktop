import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const src = resolve(new URL('..', import.meta.url).pathname, 'ui/src/dsh-graph-label.ts')
const { visibleActiveIds } = await import(pathToFileURL(src).href)

test('visibleActiveIds keeps canvas nodes and drops session diary rows', () => {
  const canvas = [
    { id: 'dec-1', type: 'decision', content: '记下' },
  ]
  const active = ['dec-1', 'session:abc:1', 'session:abc:2', 'ghost']
  assert.deepEqual(visibleActiveIds(active, canvas), ['dec-1'])
})
