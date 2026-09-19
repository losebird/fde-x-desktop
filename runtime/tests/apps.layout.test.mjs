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
    assert.ok(Array.isArray(laid.pages) && laid.pages.length >= 2)
    const kinds = laid.pages[0].blocks.map((b) => b.kind)
    assert.deepEqual(kinds, ['stats', 'compose', 'chart', 'feed'])
    const allKinds = laid.pages.flatMap((page) => page.blocks.map((b) => b.kind))
    assert.ok(allKinds.includes('cards'))
    assert.ok(laid.uses.includes('ai'))
    assert.ok(laid.uses.includes('float'))
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
    assert.ok(laid.pages.length >= 2)
    const allKinds = laid.pages.flatMap((page) => page.blocks.map((b) => b.kind))
    assert.ok(allKinds.includes('cards'))
    assert.equal(allKinds.includes('feed'), false)
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
})
