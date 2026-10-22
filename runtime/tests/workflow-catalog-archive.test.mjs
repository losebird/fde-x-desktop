import assert from 'node:assert/strict'
import { test } from 'node:test'
import { listWorkflowCatalog } from '../plan/workflow-catalog.mjs'

function activeJobRuntime() {
  const created = new Set()
  let seq = 0
  const aiRuntime = {
    origin: 'http://catalog.test',
    cookie: 'sid=1',
    async call(endpoint, args) {
      if (endpoint === 'session/create') {
        const sessionId = `probe_${++seq}`
        created.add(sessionId)
        return { sessionId }
      }
      if (endpoint === 'workspace/archiveSession') {
        const sessionId = args && args.request && args.request.sessionId
        throw new Error(`cannot archive session ${sessionId} active (job)`)
      }
      throw new Error(`unexpected ${endpoint}`)
    },
  }
  const fetchImpl = async (input) => {
    const url = new URL(String(input))
    const sessionId = url.searchParams.get('sessionId') || ''
    if (sessionId && !created.has(sessionId)) return Response.json({ ok: false }, { status: 404 })
    if (url.pathname === '/fde-session/preset-inventory') {
      return Response.json({ ok: true, presets: [{ id: 'standard', name: '标准' }] })
    }
    if (url.pathname === '/fde-session/tool-catalog') {
      return Response.json({
        ok: true,
        tools: [{ name: 'read', readOnly: true, grantable: true }],
      })
    }
    if (url.pathname === '/fde-session/preset-snapshot') {
      return Response.json({
        ok: true,
        tools: [{ name: 'read', readOnly: true }],
        persona: { text: '人设正文', complete: true },
      })
    }
    return Response.json({ ok: false }, { status: 404 })
  }
  return { aiRuntime, fetchImpl }
}

test('会话任务仍活跃时归档被拒绝，工具清单照样返回', async () => {
  const previous = globalThis.fetch
  const { aiRuntime, fetchImpl } = activeJobRuntime()
  globalThis.fetch = fetchImpl
  try {
    const catalog = await listWorkflowCatalog(aiRuntime, '/tmp/fde-x-archive')
    assert.deepEqual(catalog.tools.map((row) => row.name), ['read'])
    const standard = catalog.presets.find((row) => row.id === 'standard')
    assert.ok(standard)
    assert.equal(standard.unavailable, undefined)
    assert.equal(standard.persona.text, '人设正文')
    assert.deepEqual(standard.tools.map((row) => row.name), ['read'])
  } finally {
    globalThis.fetch = previous
  }
})
