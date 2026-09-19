import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cardAction,
  displayTitle,
  looksLikeGeneratedCode,
  workSurfacePages,
} from '../../src/lib/app-spec.ts'

const ledgerSpec = {
  spec: 'fde-app/v1',
  slug: 'item-log',
  name: '台账',
  entities: [{
    name: 'item',
    label: '条目',
    titleField: 'title',
    fields: [
      { name: 'title', label: '名称', type: 'text' },
      { name: 'kind', label: '分类', type: 'enum', options: ['常备', '处方'] },
      { name: 'qty', label: '数量', type: 'number' },
      { name: 'happened_on', label: '日期', type: 'date' },
      { name: 'note', label: '备注', type: 'longtext' },
    ],
  }],
  views: [
    { id: 'form-main', type: 'compose', entity: 'item' },
    { id: 'feed-main', type: 'feed', entity: 'item' },
    { id: 'stat-1', type: 'stat', entity: 'item', metric: { fn: 'count' } },
    { id: 'chart-1', type: 'chart', entity: 'item', groupBy: 'kind' },
  ],
  pages: [{
    id: 'page-item',
    label: '记录',
    blocks: [
      { kind: 'stats', views: ['stat-1'] },
      { kind: 'compose', view: 'form-main' },
      { kind: 'chart', view: 'chart-1' },
      { kind: 'feed', view: 'feed-main' },
    ],
  }],
}

const boardSpec = {
  spec: 'fde-app/v1',
  slug: 'item-board',
  name: '卡片板',
  entities: [{
    name: 'item',
    label: '条目',
    titleField: 'title',
    fields: [
      { name: 'title', label: '标题', type: 'text' },
      { name: 'source', label: '分组', type: 'enum', options: ['甲', '乙'] },
      { name: 'blurb', label: '说明', type: 'longtext' },
      { name: 'url', label: '链接', type: 'text' },
    ],
  }],
  views: [
    { id: 'form-main', type: 'compose', entity: 'item' },
    { id: 'feed-main', type: 'feed', entity: 'item' },
  ],
  pages: [{
    id: 'page-item',
    label: '记录',
    blocks: [{ kind: 'compose', view: 'form-main' }, { kind: 'feed', view: 'feed-main' }],
  }],
}

describe('record titles and grouped card pages', () => {
  test('generated codes are whole-string only', () => {
    assert.equal(looksLikeGeneratedCode('药-mu82l4pf'), true)
    assert.equal(looksLikeGeneratedCode('记-mu83ag8l'), true)
    assert.equal(looksLikeGeneratedCode('备注 药-mu82l4pf'), false)
    assert.equal(looksLikeGeneratedCode('对乙酰氨基酚'), false)
  })

  test('skips serial title and does not use category alone', () => {
    const serial = displayTitle(ledgerSpec, 'item', {
      title: '药-mu82l4pf',
      kind: '常备',
      qty: 12,
      happened_on: '2026-09-19',
      note: '备注 药-mu82l4pf',
    })
    assert.equal(serial, '备注 药-mu82l4pf')
    assert.notEqual(serial, '常备')
    assert.equal(looksLikeGeneratedCode(serial), false)

    const noNote = displayTitle(ledgerSpec, 'item', {
      title: '记-mu83ag8l',
      kind: '常备',
      qty: 3,
      happened_on: '2026-09-19',
      note: '',
    })
    assert.equal(noNote, '2026-09-19')
    assert.notEqual(noNote, '常备')
    assert.notEqual(noNote, '记-mu83ag8l')

    const named = displayTitle(ledgerSpec, 'item', {
      title: '对乙酰氨基酚',
      kind: '常备',
      qty: 8,
      happened_on: '2026-09-19',
      note: '感冒发热备用',
    })
    assert.equal(named, '对乙酰氨基酚')
  })

  test('ledger without link fields keeps one screen', () => {
    const { pages } = workSurfacePages(ledgerSpec)
    assert.equal(pages.length, 1)
    assert.deepEqual(pages[0].blocks.map((block) => block.kind), ['stats', 'compose', 'chart', 'feed'])
  })

  test('link fields add grouped cards without dropping the ledger page', () => {
    const { pages, extraViews } = workSurfacePages(boardSpec)
    assert.equal(pages[0].blocks[0].kind, 'cards')
    const cardsView = extraViews.find((view) => view.type === 'cards') || boardSpec.views.find((view) => view.type === 'cards')
    assert.ok(cardsView)
    assert.equal(cardsView.groupBy, 'source')
    assert.ok(pages.some((page) => page.blocks.some((block) => block.kind === 'feed')))
  })

  test('card action opens url or file ref', () => {
    assert.deepEqual(cardAction(boardSpec, 'item', { url: 'https://example.com/a' }), {
      href: 'https://example.com/a',
      kind: 'url',
    })
    const fileSpec = {
      ...boardSpec,
      entities: [{
        ...boardSpec.entities[0],
        fields: [
          { name: 'title', label: '标题', type: 'text' },
          { name: 'file_path', label: '文件', type: 'text' },
        ],
      }],
    }
    assert.deepEqual(cardAction(fileSpec, 'item', { file_path: 'README.md' }), {
      href: 'README.md',
      kind: 'file',
    })
  })
})
