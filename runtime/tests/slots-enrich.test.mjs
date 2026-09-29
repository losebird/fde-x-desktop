import test from 'node:test'
import assert from 'node:assert/strict'
import {
  leftoverKindMissingFromCatalog,
  unpreviewablePlanKind,
  speechHoldsWorkstationWrite,
  rememberUserSpeech,
  recalledUserSpeech,
} from '../vendor-overlays/dsh-lan-assist/slots.js'

const intersectionVocab = [
  {
    kind: 'AlphaWidget',
    resource: 'alpha_widget',
    can: ['现查', '改行'],
    relations: [{ from: 'AlphaGadget', to: 'AlphaWidget', field: 'gadgetRef' }],
    clues: [{ say: ['pending'], keys: ['status'], values: ['pending'] }],
  },
  { kind: 'Widget', resource: 'widget', can: ['现查', '改行'] },
  {
    kind: 'AlphaGadget',
    resource: 'alpha_gadget',
    can: ['现查'],
    aliases: ['gad'],
    clues: [{ say: ['expired'], keys: ['status'], values: ['expired'] }],
  },
  { kind: 'Gadget', resource: 'gadget', can: ['现查'] },
]

const catalogExtra = {
  vocab: intersectionVocab,
  collections: [
    { name: 'alpha_widget', title: 'AlphaWidget' },
    { name: 'alpha_gadget', title: 'AlphaGadget' },
  ],
}

test('rememberUserSpeech recalls the last line for a session', () => {
  const user = 'pending wid ∩ expired gad'
  rememberUserSpeech('sess-hop', user)
  assert.equal(recalledUserSpeech('sess-hop'), user)
})

test('unpreviewablePlanKind refuses any hop kind missing from the catalog', () => {
  const extra = {
    vocab: [
      { kind: 'AlphaWidget', resource: 'alpha_widget', can: ['现查'] },
      { kind: 'AlphaGadget', resource: 'alpha_gadget', can: ['现查'] },
    ],
    collections: [{ name: 'alpha_widget' }, { name: 'alpha_gadget' }],
  }
  assert.equal(unpreviewablePlanKind({
    kind: 'AlphaWidget',
    steps: [{ kind: 'AlphaGadget' }, { kind: 'AlphaWidget' }],
  }, extra), '')
  assert.equal(unpreviewablePlanKind({
    kind: 'AlphaWidget',
    steps: [{ kind: 'GhostKind' }, { kind: 'AlphaWidget' }],
  }, extra), 'GhostKind')
})

test('leftoverKindMissingFromCatalog refuses leftover only after catalog miss', () => {
  assert.equal(leftoverKindMissingFromCatalog('Widget', catalogExtra), true)
  assert.equal(leftoverKindMissingFromCatalog('Gadget', catalogExtra), true)
  assert.equal(leftoverKindMissingFromCatalog('AlphaWidget', catalogExtra), false)
  assert.equal(leftoverKindMissingFromCatalog('AlphaGadget', catalogExtra), false)
  assert.equal(leftoverKindMissingFromCatalog('Widget', { vocab: intersectionVocab }), false)
})

test('speechHoldsWorkstationWrite uses write action slots and 改写 spans', () => {
  assert.equal(speechHoldsWorkstationWrite('把停用客户改成成交'), true)
  assert.equal(speechHoldsWorkstationWrite('把状态写成成交'), true)
  assert.equal(speechHoldsWorkstationWrite('随便看看目录'), false)
  assert.equal(speechHoldsWorkstationWrite('这个项目里上次怎么定的'), false)
  assert.equal(speechHoldsWorkstationWrite(''), false)
})
