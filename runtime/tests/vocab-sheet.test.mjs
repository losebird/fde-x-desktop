import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadBizVocab,
  mapKindsFromCatalog,
  mergeConnectedKindCatalog,
  vocabCatalogVersion,
  vocabHasKinds,
} from '../biz/vocab-sheet.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')

test('mapKindsFromCatalog reads kinds relations catalogVersion', () => {
  const mapped = mapKindsFromCatalog({
    kinds: [
      { kind: 'KindA', label: 'A', fields: ['no'], resource: 'kind_a', catalogVersion: 'schema:1', can: ['现查'] },
      'KindB',
    ],
    relations: [{ from: 'KindA', to: 'KindB' }],
    catalogVersion: 'schema:1',
  })
  assert.equal(mapped.kinds.length, 2)
  assert.equal(mapped.kinds[0].kind, 'KindA')
  assert.equal(mapped.kinds[0].resource, 'kind_a')
  assert.equal(mapped.kinds[1].kind, 'KindB')
  assert.equal(mapped.catalogVersion, 'schema:1')
  assert.deepEqual(mapped.relations, [{ from: 'KindA', to: 'KindB' }])
})

test('mergeConnectedKindCatalog keeps connector row and memory aliases', () => {
  const merged = mergeConnectedKindCatalog(
    {
      kinds: [{ kind: 'KindA', fields: ['no'], resource: 'kind_a', catalogVersion: 'schema:1' }],
      relations: [],
      catalogVersion: 'schema:1',
    },
    {
      kinds: [{ kind: 'KindA', aliases: ['SpokenA'], resource: 'kind_a' }],
      relations: [{ from: 'KindA', to: 'KindB' }],
      catalogVersion: null,
    },
  )
  assert.equal(merged.kinds[0].kind, 'KindA')
  assert.ok(merged.kinds[0].aliases.includes('SpokenA'))
  assert.equal(merged.catalogVersion, 'schema:1')
  assert.deepEqual(merged.relations, [{ from: 'KindA', to: 'KindB' }])
})

test('vocabHasKinds and vocabCatalogVersion read the sheet', () => {
  assert.equal(vocabHasKinds(null), false)
  assert.equal(vocabHasKinds({ kinds: [] }), false)
  assert.equal(vocabHasKinds({ kinds: [{ kind: 'KindA' }] }), true)
  assert.equal(vocabCatalogVersion({ catalogVersion: ['schema:abc', ''] }), 'schema:abc')
  assert.equal(vocabCatalogVersion({ kinds: [{ kind: 'KindA', catalogVersion: 'schema:1' }] }), 'schema:1')
})

test('loadBizVocab maps /catalog when memory graph fails', async () => {
  const vocab = await loadBizVocab({
    lanAssist: async (path, opts) => {
      assert.equal(path, '/catalog')
      assert.equal(opts.search.workspace, '/tmp/ws')
      return {
        kinds: [{ kind: 'KindA', fields: ['no'], resource: 'kind_a' }],
        relations: [],
        catalogVersion: 'schema:1',
      }
    },
    semanticOs: async () => {
      throw new Error('offline')
    },
  }, '/tmp/ws')
  assert.equal(vocab.kinds[0].kind, 'KindA')
  assert.equal(vocab.catalogVersion, 'schema:1')
  assert.deepEqual(vocab.aliases, {})
})

test('loadBizVocab throws when /catalog reports not ready', async () => {
  await assert.rejects(
    () => loadBizVocab({
      lanAssist: async () => ({ ok: false, error: 'NO_CATALOG', hint: '目录没读成' }),
    }, '/tmp/ws'),
    (error) => {
      assert.equal(error.code, 'NO_CATALOG')
      assert.match(error.message, /目录没读成/)
      return true
    },
  )
})

test('GET kinds and connections read loadBizVocab; GET catalog is gone', () => {
  const biz = readFileSync(join(repoRoot, 'runtime/routes/biz.mjs'), 'utf8')
  const sheet = readFileSync(join(repoRoot, 'runtime/biz/vocab-sheet.mjs'), 'utf8')
  const dataPage = readFileSync(join(repoRoot, 'src/pages/Data.tsx'), 'utf8')
  const records = readFileSync(join(repoRoot, 'src/components/biz/RecordsPanel.tsx'), 'utf8')
  const operations = readFileSync(join(repoRoot, 'src/components/biz/OperationRecordPanel.tsx'), 'utf8')
  const lamp = readFileSync(join(repoRoot, 'runtime/biz/connection-lamp.mjs'), 'utf8')
  assert.match(sheet, /lanAssist\('\/catalog',\s*\{\s*search:\s*\{\s*workspace/)
  assert.match(biz, /loadBizVocab\(/)
  assert.match(biz, /vocabCatalogVersion\(/)
  assert.match(biz, /method === 'POST' && url.pathname === '\/api\/v1\/biz\/catalog'/)
  assert.doesNotMatch(biz, /method === 'GET' && url.pathname === '\/api\/v1\/biz\/catalog'/)
  assert.doesNotMatch(biz, /lanAssist\('\/catalog',\s*\{\s*search:\s*\{\s*workspace/)
  assert.match(dataPage, /listBizKinds/)
  assert.doesNotMatch(dataPage, /imState\(/)
  assert.match(records, /kindRowsFromVocab\(vocab\)/)
  assert.doesNotMatch(records, /listBizKinds/)
  assert.match(operations, /kindRowsFromVocab\(vocab\)/)
  assert.doesNotMatch(operations, /listBizKinds/)
  assert.doesNotMatch(lamp, /businessKindsDescribedInLanAssistState/)
  assert.match(lamp, /vocabHasKinds\(vocab\)/)
})
