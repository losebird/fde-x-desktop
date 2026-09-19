import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultSurface,
  resolveSurface,
  cardGridTemplate,
  withProductLayout,
} from '../apps/layout.mjs'
import { SUPPLIER_VISITS_SPEC } from '../apps/fixtures.mjs'

describe('surface layout helpers', () => {
  test('defaultSurface matches contract defaults', () => {
    assert.deepEqual(defaultSurface(), {
      nav: 'tabs',
      density: 'cozy',
      cards: { minWidth: 'regular', hero: 'cover' },
      ledger: { composeChart: 'pair', feed: 'rows' },
      primary: { where: 'card', kind: 'play' },
    })
  })

  test('resolveSurface fills omitted keys', () => {
    const resolved = resolveSurface({ spec: 'fde-app/v1', surface: { density: 'packed' } })
    assert.equal(resolved.density, 'packed')
    assert.equal(resolved.nav, 'tabs')
    assert.deepEqual(resolved.cards, { minWidth: 'regular', hero: 'cover' })
  })

  test('cardGridTemplate fixed columns', () => {
    const surface = { density: 'cozy', cards: { columns: 3 } }
    assert.equal(cardGridTemplate(surface, 4), 'repeat(3, minmax(0, 1fr))')
  })

  test('cardGridTemplate cozy regular uses 13.5rem', () => {
    const surface = defaultSurface()
    assert.equal(
      cardGridTemplate(surface, 1),
      'repeat(auto-fill, minmax(13.5rem, 13.5rem))',
    )
    assert.equal(
      cardGridTemplate(surface, 2),
      'repeat(auto-fit, minmax(13.5rem, 1fr))',
    )
  })

  test('cardGridTemplate packed uses 10rem', () => {
    const surface = { density: 'packed', cards: {} }
    assert.equal(
      cardGridTemplate(surface, 2),
      'repeat(auto-fit, minmax(10rem, 1fr))',
    )
  })

  test('withProductLayout resolves surface on spec', () => {
    const laid = withProductLayout(SUPPLIER_VISITS_SPEC)
    const resolved = resolveSurface(laid)
    assert.equal(resolved.density, laid.surface.density)
    assert.equal(resolved.nav, 'tabs')
  })
})
