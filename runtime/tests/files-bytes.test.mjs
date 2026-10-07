import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeWorkspaceFileText, readWorkspaceFileBytes } from '../files-bytes.mjs'

test('readWorkspaceFileBytes concatenates readBytes windows until eof', async () => {
  const calls = []
  const aiRuntime = {
    async call(endpoint, args) {
      assert.equal(endpoint, 'workspaceFiles/readBytes')
      const offset = args.options?.range?.offset ?? args.range?.offset ?? 0
      calls.push(offset)
      if (offset === 0) {
        return { data: Buffer.from('hel').toString('base64'), offset: 0, eof: false, name: 'a.txt', mime: 'text/plain' }
      }
      return { data: Buffer.from('lo').toString('base64'), offset: 3, eof: true, name: 'a.txt', mime: 'text/plain' }
    },
  }
  const file = await readWorkspaceFileBytes(aiRuntime, { sessionId: 's1', path: 'a.txt' })
  assert.deepEqual(calls, [0, 3])
  assert.equal(file.size, 5)
  assert.equal(file.name, 'a.txt')
  assert.equal(decodeWorkspaceFileText(file).text, 'hello')
})
