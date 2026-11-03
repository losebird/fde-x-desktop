import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const src = resolve(import.meta.dirname, '../../src/lib/session-pick.ts')
const { sessionIdForWorkspace } = await import(pathToFileURL(src).href)

const sessions = [
  { sessionId: 'briefing', cwd: '/ws', updatedAt: 1 },
  { sessionId: 'blank', cwd: '/ws', updatedAt: 9 },
]

test('clicking a session in the URL beats a stored leftover', () => {
  const id = sessionIdForWorkspace({
    connected: true,
    workspaceCwd: '/ws',
    chatId: 'blank',
    addressed: { cwd: '/ws' },
    storedActiveAiSessionId: 'briefing',
    remoteSessions: sessions,
    workspaceSessions: sessions,
  })
  assert.equal(id, 'blank')
})

test('no URL keeps the stored session in this workspace', () => {
  const id = sessionIdForWorkspace({
    connected: true,
    workspaceCwd: '/ws',
    chatId: '',
    storedActiveAiSessionId: 'briefing',
    remoteSessions: sessions,
    workspaceSessions: sessions,
  })
  assert.equal(id, 'briefing')
})

test('switching workspace drops the other cwd URL', () => {
  const id = sessionIdForWorkspace({
    connected: true,
    workspaceCwd: '/other',
    chatId: 'briefing',
    addressed: { cwd: '/ws' },
    storedActiveAiSessionId: 'briefing',
    remoteSessions: sessions,
    workspaceSessions: [{ sessionId: 'fresh', cwd: '/other', updatedAt: 3 }],
  })
  assert.equal(id, 'fresh')
})
