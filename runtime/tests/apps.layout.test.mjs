import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { withProductLayout } from '../apps/layout.mjs'
import { validateAppSpec } from '../apps/spec.mjs'
import { SUPPLIER_VISITS_SPEC } from '../apps/fixtures.mjs'

describe('product layout', () => {
  test('keeps specs without pages valid', () => {
    const r = validateAppSpec(SUPPLIER_VISITS_SPEC)
    assert.equal(r.ok, true)
    assert.equal(r.spec.pages, undefined)
  })

  test('lays out nav, stats, compose, chart, feed from fields', () => {
    const laid = withProductLayout(SUPPLIER_VISITS_SPEC)
    const r = validateAppSpec(laid)
    assert.equal(r.ok, true, JSON.stringify(r.errors))
    assert.ok(Array.isArray(laid.pages) && laid.pages.length >= 1)
    const kinds = laid.pages[0].blocks.map((b) => b.kind)
    assert.deepEqual(kinds, ['stats', 'compose', 'chart', 'feed'])
    const allKinds = laid.pages.flatMap((page) => page.blocks.map((b) => b.kind))
    assert.equal(allKinds.includes('cards'), false)
    assert.equal(laid.uses.includes('ai'), false)
    assert.equal(laid.uses.includes('float'), false)
    assert.equal(JSON.stringify(laid).includes('健身'), false)
    assert.equal(JSON.stringify(laid).includes('记账'), false)
  })

  test('does not override existing pages', () => {
    const spec = {
      ...SUPPLIER_VISITS_SPEC,
      uses: ['files'],
      pages: [{
        id: 'home',
        label: '首页',
        blocks: [{ kind: 'compose', view: 'form-main' }],
      }],
    }
    const laid = withProductLayout(spec)
    assert.deepEqual(laid.uses, ['files'])
    assert.equal(laid.pages.length, 1)
    assert.equal(laid.pages[0].blocks[0].kind, 'compose')
  })

  test('catalog entity gets cards not feed', () => {
    const spec = {
      spec: 'fde-app/v1',
      slug: 'notes-board',
      name: '摘录板',
      entities: [{
        name: 'note',
        label: '摘录',
        titleField: 'title',
        fields: [
          { name: 'title', label: '标题', type: 'text', required: true },
          { name: 'body', label: '内容', type: 'longtext' },
        ],
      }],
      views: [{ id: 'form-1', type: 'form', entity: 'note' }],
    }
    const laid = withProductLayout(spec)
    const r = validateAppSpec(laid)
    assert.equal(r.ok, true, JSON.stringify(r.errors))
    assert.ok(laid.pages.length >= 1)
    const kinds = laid.pages[0].blocks.map((b) => b.kind)
    assert.ok(kinds.includes('cards'))
    assert.ok(kinds.includes('compose'))
    assert.equal(kinds.includes('feed'), false)
  })

  test('resource entity groups cards by enum and keeps a link field', () => {
    const spec = {
      spec: 'fde-app/v1',
      slug: 'clip-board',
      name: '片段板',
      entities: [{
        name: 'clip',
        label: '片段',
        titleField: 'title',
        fields: [
          { name: 'title', label: '标题', type: 'text', required: true },
          { name: 'source', label: '来源', type: 'enum', options: ['甲', '乙'] },
          { name: 'blurb', label: '说明', type: 'longtext' },
          { name: 'url', label: '链接', type: 'text' },
        ],
      }],
      views: [{ id: 'form-1', type: 'form', entity: 'clip' }],
    }
    const laid = withProductLayout(spec)
    const r = validateAppSpec(laid)
    assert.equal(r.ok, true, JSON.stringify(r.errors))
    const cards = laid.views.find((view) => view.type === 'cards')
    assert.equal(cards?.groupBy, 'source')
    const kinds = laid.pages[0].blocks.map((b) => b.kind)
    assert.deepEqual(kinds, ['cards', 'compose'])
    assert.equal(JSON.stringify(laid).includes('健身'), false)
    assert.equal(JSON.stringify(laid).includes('记账'), false)
  })

  test('existing ledger pages stay ledger when there is no link field', () => {
    const spec = {
      ...SUPPLIER_VISITS_SPEC,
      pages: [{
        id: 'home',
        label: '记录',
        blocks: [
          { kind: 'stats', views: ['stat-1'] },
          { kind: 'compose', view: 'form-main' },
          { kind: 'chart', view: 'chart-1' },
          { kind: 'feed', view: 'feed-main' },
        ],
      }],
      views: [
        { id: 'stat-1', type: 'stat', entity: 'visit', metric: { fn: 'count' } },
        { id: 'form-main', type: 'compose', entity: 'visit' },
        { id: 'chart-1', type: 'chart', entity: 'visit', groupBy: 'status' },
        { id: 'feed-main', type: 'feed', entity: 'visit' },
      ],
    }
    const laid = withProductLayout(spec)
    const kinds = laid.pages.flatMap((page) => page.blocks.map((b) => b.kind))
    assert.equal(kinds.includes('cards'), false)
    assert.deepEqual(laid.pages[0].blocks.map((b) => b.kind), ['stats', 'compose', 'chart', 'feed'])
  })

  test('existing pages with a link field get a grouped cards page', () => {
    const spec = {
      spec: 'fde-app/v1',
      slug: 'link-board',
      name: '链接板',
      entities: [{
        name: 'item',
        label: '条目',
        titleField: 'title',
        fields: [
          { name: 'title', label: '标题', type: 'text', required: true },
          { name: 'source', label: '分组', type: 'enum', options: ['甲', '乙'] },
          { name: 'url', label: '链接', type: 'text' },
        ],
      }],
      views: [
        { id: 'form-main', type: 'compose', entity: 'item', label: '记下' },
        { id: 'feed-main', type: 'feed', entity: 'item' },
      ],
      pages: [{
        id: 'home',
        label: '记录',
        blocks: [{ kind: 'compose', view: 'form-main' }, { kind: 'feed', view: 'feed-main' }],
      }],
    }
    const laid = withProductLayout(spec)
    const r = validateAppSpec(laid)
    assert.equal(r.ok, true, JSON.stringify(r.errors))
    const kinds = laid.pages[0].blocks.map((b) => b.kind)
    assert.deepEqual(kinds, ['cards', 'compose'])
    const cards = laid.views.find((view) => view.type === 'cards')
    assert.equal(cards?.groupBy, 'source')
    assert.ok(laid.pages.some((page) => page.blocks.some((block) => block.kind === 'feed')))
  })

  test('file path fields infer files capability', () => {
    const spec = {
      spec: 'fde-app/v1',
      slug: 'file-board',
      name: '稿件板',
      entities: [{
        name: 'item',
        label: '条目',
        titleField: 'title',
        fields: [
          { name: 'title', label: '标题', type: 'text', required: true },
          { name: 'file_path', label: '文件', type: 'text' },
        ],
      }],
      views: [{ id: 'form-1', type: 'form', entity: 'item' }],
    }
    const laid = withProductLayout(spec)
    assert.ok(laid.uses.includes('files'))
  })

  test('rejects unknown uses', () => {
    const r = validateAppSpec({ ...SUPPLIER_VISITS_SPEC, uses: ['magic'] })
    assert.equal(r.ok, false)
  })

  test('rejects page block missing view', () => {
    const spec = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    spec.pages = [{ id: 'p', label: '页', blocks: [{ kind: 'feed', view: 'nope' }] }]
    const r = validateAppSpec(spec)
    assert.equal(r.ok, false)
  })

  test('declared memory drafts cards on write', () => {
    const spec = { ...SUPPLIER_VISITS_SPEC, uses: ['memory'] }
    const laid = withProductLayout(spec)
    assert.deepEqual(laid.uses, ['memory'])
    assert.equal(laid.memory?.onWrite, 'draft-card')
    assert.equal(JSON.stringify(laid.uses).includes('im'), false)
  })

  test('keeps declared im briefing biz without inventing extras', () => {
    const spec = { ...SUPPLIER_VISITS_SPEC, uses: ['im', 'briefing', 'biz'] }
    const laid = withProductLayout(spec)
    assert.deepEqual(laid.uses, ['im', 'briefing', 'biz'])
    assert.equal(laid.uses.includes('files'), false)
  })

  test('two entities get separate pages with different block kinds', () => {
    const spec = {
      spec: 'fde-app/v1',
      slug: 'mixed-board',
      name: '混合板',
      entities: [
        {
          name: 'clip',
          label: '片段',
          titleField: 'title',
          fields: [
            { name: 'title', label: '标题', type: 'text', required: true },
            { name: 'source', label: '来源', type: 'enum', options: ['甲', '乙'] },
            { name: 'url', label: '链接', type: 'text' },
          ],
        },
        {
          name: 'entry',
          label: '流水',
          titleField: 'title',
          fields: [
            { name: 'title', label: '标题', type: 'text', required: true },
            { name: 'amount', label: '数量', type: 'number' },
            { name: 'kind', label: '分类', type: 'enum', options: ['甲', '乙'] },
            { name: 'happened_on', label: '日期', type: 'date' },
          ],
        },
      ],
      views: [
        { id: 'form-clip', type: 'form', entity: 'clip' },
        { id: 'form-entry', type: 'form', entity: 'entry' },
      ],
    }
    const laid = withProductLayout(spec)
    const r = validateAppSpec(laid)
    assert.equal(r.ok, true, JSON.stringify(r.errors))
    assert.equal(laid.pages.length, 2)
    const clipPage = laid.pages.find((p) => p.id === 'page-clip')
    const entryPage = laid.pages.find((p) => p.id === 'page-entry')
    assert.ok(clipPage)
    assert.ok(entryPage)
    assert.deepEqual(clipPage.blocks.map((b) => b.kind), ['cards', 'compose'])
    assert.deepEqual(entryPage.blocks.map((b) => b.kind), ['stats', 'compose', 'chart', 'feed'])
    assert.equal(JSON.stringify(laid).includes('健身'), false)
    assert.equal(JSON.stringify(laid).includes('记账'), false)
  })
})
