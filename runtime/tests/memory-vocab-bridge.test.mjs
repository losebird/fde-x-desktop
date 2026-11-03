import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadMemoryWorkspaceVocab, mergePeerVocab, saveMemoryWorkspaceVocab } from '../biz/memory-vocab.mjs'

test('mergePeerVocab keeps local names and tags peer rows with bridgeCwd', () => {
  const merged = mergePeerVocab(
    {
      kinds: [{ kind: '工单', resource: 'tickets', fields: ['本地'] }],
      relations: [{ from: '客户', to: '工单', field: 'customerId' }],
      source: 'memory-graph',
    },
    [{
      cwd: '/Users/zxz/Documents/ai-project/fdex测试',
      kinds: [
        { kind: '工单', resource: 'tickets', fields: ['对端'] },
        { kind: '费用报销', resource: 'expenses', fields: ['报销单号'], can: ['现查'] },
      ],
      relations: [{ from: '员工档案', to: '费用报销', field: 'employee' }],
    }],
  )
  const ticket = merged.kinds.find((row) => row.kind === '工单')
  const expense = merged.kinds.find((row) => row.kind === '费用报销')
  assert.deepEqual(ticket.fields, ['本地'])
  assert.equal(ticket.bridgeCwd, undefined)
  assert.equal(expense.bridgeCwd, '/Users/zxz/Documents/ai-project/fdex测试')
  assert.equal(merged.source, 'memory-graph+bridge')
  assert.equal(merged.relations.length, 2)
})

test('loadMemoryWorkspaceVocab reads the peer graph and does not upsert into cwd', async () => {
  const home = join(tmpdir(), `fde-vocab-bridge-${Date.now()}`)
  await mkdir(join(home, 'semantic-os', 'bridge'), { recursive: true })
  const local = '/Users/zxz/Documents/ai-project/fdex测试2'
  const peer = '/Users/zxz/Documents/ai-project/fdex测试'
  await writeFile(join(home, 'semantic-os', 'bridge', 'index.json'), `${JSON.stringify({
    protocol: 1,
    links: [{ sourceCwd: local, targetCwd: peer }],
  }, null, 2)}\n`)
  const listed = []
  const upserts = []
  const runtime = {
    semanticOs: async (path, body) => {
      listed.push({ op: body.op, cwd: body.cwd })
      if (body.op === 'upsert_workspace_vocab') {
        upserts.push(body)
        return { ok: true }
      }
      if (body.cwd === peer) {
        return {
          nodes: [{
            type: 'skos:Concept',
            properties: {
              prefLabel: '费用报销',
              resource: 'expenses',
              fields: ['报销单号'],
              can: ['现查'],
            },
          }],
        }
      }
      return { nodes: [] }
    },
  }
  const vocab = await loadMemoryWorkspaceVocab(runtime, local, { dshHome: home })
  assert.equal(vocab.kinds[0]?.kind, '费用报销')
  assert.equal(vocab.kinds[0]?.bridgeCwd, peer)
  assert.deepEqual(listed.filter((row) => row.op === 'list_graph_nodes').map((row) => row.cwd), [local, peer])
  assert.equal(upserts.length, 0)
  await saveMemoryWorkspaceVocab(runtime, local, { kind: '本地型' })
  assert.equal(upserts.length, 1)
  assert.equal(upserts[0].cwd, local)
})
