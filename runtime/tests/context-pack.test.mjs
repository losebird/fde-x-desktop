import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildContextPack, renderContextForPrompt } from '../context-pack.mjs'
import { openDatabase } from '../db.mjs'
import { mkdir, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const dbPath = '/tmp/fde-x-context-pack-test.sqlite'

test('renderContextForPrompt respects 1500 char cap', () => {
  const pack = {
    generatedAt: Date.now(),
    workspace: { cwd: '/tmp/ws', name: '测试' },
    memory: {
      hits: Array.from({ length: 40 }, (_, i) => ({
        id: `hit_${i}`,
        excerpt: '这是一段很长的记忆摘录内容，用于测试长度上限。',
        sourceRef: `hit_${i}`,
      })),
      precedents: [],
    },
  }
  const text = renderContextForPrompt(pack)
  assert.ok(text.length <= 1500)
  assert.match(text, /【相关记忆】/)
})

test('memory scope failure does not break other scopes', async () => {
  await rm(dbPath, { force: true }).catch(() => undefined)
  await mkdir('/tmp/fde-x-context-pack-ws', { recursive: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  const aiRuntime = {
    status: () => ({ connected: false }),
    lanAssist: async () => ({ unreadTotal: 0, requests: [] }),
    semanticOs: async () => {
      throw new Error('down')
    },
  }
  const { pack, warnings } = await buildContextPack(
    { db, aiRuntime },
    {
      workspaceCwd: '/tmp/fde-x-context-pack-ws',
      scopes: ['workspace', 'tasks', 'memory'],
      query: '采购',
    },
  )
  assert.ok(pack.workspace)
  assert.ok(warnings.includes('memory_engine_not_ready') || warnings.includes('memory_find_failed'))
})

test('scope timeout is reported in warnings', async () => {
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  const aiRuntime = {
    status: () => ({ connected: true }),
    lanAssist: async () => new Promise(() => {}),
    semanticOs: async () => ({ ready: true }),
  }
  const { warnings } = await buildContextPack(
    { db, aiRuntime },
    {
      workspaceCwd: '/tmp/fde-x-context-pack-ws',
      scopes: ['im'],
      query: 'x',
    },
  )
  assert.ok(warnings.some((w) => w.endsWith('_timeout')))
})
