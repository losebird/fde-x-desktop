import test from 'node:test'
import assert from 'node:assert/strict'
import {
  enrichStructuredSlots,
  clueHitsInSpeech,
  kindMentions,
  pickHopSpeech,
  relatedMentionedKinds,
  rememberUserSpeech,
  recalledUserSpeech,
} from '../vendor-overlays/dsh-lan-assist/slots.js'

test('kindMentions does not count a shorter kind inside a longer kind', () => {
  const hits = kindMentions('ParentA MidB ChildC', ['Parent', 'ParentA', 'MidB', 'ChildC'])
  assert.deepEqual(hits.map((row) => row.kind), ['ParentA', 'MidB', 'ChildC'])
})

const vocab = [
  {
    kind: '客户',
    resource: 'biz_customers',
    can: ['现查'],
    clues: [{ say: ['停用', 'inactive'], keys: ['status'], values: ['inactive', '停用'] }],
  },
  {
    kind: '工单',
    resource: 'biz_tickets',
    can: ['现查'],
    relations: [{ from: '客户', to: '工单', field: 'customer' }],
    clues: [{ say: ['停用'], keys: ['status'], values: ['inactive'] }],
  },
  {
    kind: '口语',
    spoken: true,
    clues: [{
      say: ['没关', '未关闭'],
      keys: ['status', 'state'],
      values: ['closed', 'done'],
      not: true,
    }],
  },
]

test('clueHitsInSpeech assigns 停用 to 客户 and 没关 to 工单 by proximity', () => {
  const speech = '停用客户还有哪些没关的工单？'
  const hits = clueHitsInSpeech(speech, vocab)
  const hitStop = hits.find((row) => row.say === '停用')
  const hitOpen = hits.find((row) => row.say === '没关')
  assert.equal(hitStop?.assignKind, '客户')
  assert.equal(hitOpen?.assignKind, '工单')
  assert.equal(hitOpen?.not, true)
})

const hopVocab = [
  {
    kind: 'ParentA',
    resource: 'parent_a',
    can: ['现查'],
    relations: [{ from: 'ParentA', to: 'ChildB', field: 'parentRef' }],
    clues: [{ say: ['pending'], keys: ['status'], values: ['pending'] }],
  },
  {
    kind: 'ChildB',
    resource: 'child_b',
    can: ['现查'],
    clues: [{ say: ['expired'], keys: ['status'], values: ['expired'] }],
  },
]

test('enrichStructuredSlots links two mentioned kinds via graph relation', () => {
  const speech = 'ParentA pending rows tied to ChildB expired — list ChildB hits'
  const out = enrichStructuredSlots({
    kind: 'ChildB',
    action: '现查',
    speech,
    where: [{ keys: ['status'], values: ['expired'] }],
  }, hopVocab)
  assert.equal(out.from?.kind, 'ParentA')
  assert.ok(Array.isArray(out.where) && out.where.length)
})

test('enrichStructuredSlots adds from hop without utterance literals', () => {
  const spec = {
    kind: '工单',
    action: '现查',
    speech: '停用客户还有哪些没关的工单？',
  }
  const out = enrichStructuredSlots(spec, vocab)
  assert.equal(out.from?.kind, '客户')
  assert.ok(Array.isArray(out.from?.where) && out.from.where.length)
  assert.ok(Array.isArray(out.where) && out.where.some((term) => term.not))
})

test('enrichStructuredSlots chains three mentioned related kinds along the graph', () => {
  const chainVocab = [
    {
      kind: 'ParentA',
      resource: 'parent_a',
      can: ['现查'],
      relations: [{ from: 'ParentA', to: 'MidB', field: 'parentRef' }],
      clues: [{ say: ['pending'], keys: ['status'], values: ['pending'] }],
    },
    {
      kind: 'MidB',
      resource: 'mid_b',
      can: ['现查'],
      relations: [{ from: 'MidB', to: 'ChildC', field: 'midRef' }],
      clues: [{ say: ['open'], keys: ['status'], values: ['open'] }],
    },
    {
      kind: 'ChildC',
      resource: 'child_c',
      can: ['现查'],
      clues: [{ say: ['expired'], keys: ['status'], values: ['expired'] }],
    },
  ]
  const speech = 'ParentA pending MidB open ChildC expired — list ChildC hits'
  const out = enrichStructuredSlots({
    kind: 'ChildC',
    action: '现查',
    speech,
  }, chainVocab)
  assert.equal(out.from?.kind, 'ParentA')
  assert.equal(out.from?.from?.kind, 'MidB')
  assert.equal(out.steps?.length, 3)
  assert.deepEqual(out.steps.map((row) => row.kind), ['ParentA', 'MidB', 'ChildC'])
  assert.ok(Array.isArray(out.where) && out.where.length)
})

test('enrichStructuredSlots chains three kinds via schema FK when vocab has no relations', () => {
  const chainVocab = [
    { kind: 'ParentA', resource: 'parent_a', can: ['现查'] },
    { kind: 'MidB', resource: 'mid_b', can: ['现查'] },
    { kind: 'ChildC', resource: 'child_c', can: ['现查'] },
  ]
  const collections = [
    {
      name: 'mid_b',
      fields: [
        { name: 'parent', target: 'parent_a', interface: 'm2o' },
        { name: 'parentId' },
      ],
    },
    {
      name: 'child_c',
      fields: [
        { name: 'mid', target: 'mid_b', interface: 'm2o' },
        { name: 'midId' },
      ],
    },
  ]
  const out = enrichStructuredSlots({
    kind: 'ChildC',
    action: '现查',
    speech: 'ParentA MidB ChildC — list ChildC',
  }, chainVocab, { collections })
  assert.equal(out.from?.kind, 'ParentA')
  assert.equal(out.from?.from?.kind, 'MidB')
  assert.deepEqual(out.steps.map((row) => row.kind), ['ParentA', 'MidB', 'ChildC'])
})

const intersectionKinds = ['AlphaWidget', 'Widget', 'AlphaGadget', 'Gadget']

const intersectionVocab = [
  {
    kind: 'AlphaWidget',
    resource: 'alpha_widget',
    can: ['现查'],
    relations: [{ from: 'AlphaGadget', to: 'AlphaWidget', field: 'gadgetRef' }],
    clues: [
      { say: ['pending'], keys: ['status'], values: ['pending'] },
      { role: '型', say: ['wid'] },
    ],
  },
  { kind: 'Widget', resource: 'widget', can: ['现查'] },
  {
    kind: 'AlphaGadget',
    resource: 'alpha_gadget',
    can: ['现查'],
    aliases: ['gad'],
    clues: [{ say: ['expired'], keys: ['status'], values: ['expired'] }],
  },
  { kind: 'Gadget', resource: 'gadget', can: ['现查'] },
  { kind: 'WidgetSlip', resource: 'widget_slip', can: ['现查'] },
]

const intersectionSpeech = 'pending Widget ∩ expired Gadget'

test('kindMentions prefers vocab kinds over leftover isolated short names', () => {
  const hits = kindMentions(intersectionSpeech, intersectionKinds)
  assert.deepEqual(hits.map((row) => row.kind), ['AlphaWidget', 'AlphaGadget'])
})

test('kindMentions binds spoken slot and graph alias tokens with vocab extra', () => {
  const speech = 'pending wid ∩ expired gad'
  const hits = kindMentions(speech, intersectionKinds, { vocab: intersectionVocab })
  assert.deepEqual(hits.map((row) => row.kind), ['AlphaWidget', 'AlphaGadget'])
})

test('enrichStructuredSlots assigns clues per remapped vocab kind on intersection speech', () => {
  const out = enrichStructuredSlots({
    kind: 'AlphaWidget',
    action: '现查',
    speech: intersectionSpeech,
  }, intersectionVocab)
  assert.equal(out.kind, 'AlphaWidget')
  assert.equal(out.from?.kind, 'AlphaGadget')
  assert.deepEqual(out.steps?.map((row) => row.kind), ['AlphaGadget', 'AlphaWidget'])
  const gadgetStep = out.steps.find((row) => row.kind === 'AlphaGadget')
  const widgetStep = out.steps.find((row) => row.kind === 'AlphaWidget')
  assert.ok(gadgetStep?.where?.some((term) => (term.values || []).includes('expired')))
  assert.ok(widgetStep?.where?.some((term) => (term.values || []).includes('pending')))
  assert.ok(!gadgetStep?.where?.some((term) => (term.values || []).includes('pending')))
  assert.ok(!widgetStep?.where?.some((term) => (term.values || []).includes('expired')))
})

test('enrichStructuredSlots remaps leftover target kind to owning vocab kind', () => {
  const out = enrichStructuredSlots({
    kind: 'Widget',
    action: '现查',
    speech: intersectionSpeech,
  }, intersectionVocab)
  assert.equal(out.kind, 'AlphaWidget')
  assert.equal(out.from?.kind, 'AlphaGadget')
  assert.deepEqual(out.steps?.map((row) => row.kind), ['AlphaGadget', 'AlphaWidget'])
})

test('enrichStructuredSlots remaps kind whose prefix shares suffix of vocab kind', () => {
  const out = enrichStructuredSlots({
    kind: 'WidgetSlip',
    action: '现查',
    speech: intersectionSpeech,
  }, intersectionVocab)
  assert.equal(out.kind, 'AlphaWidget')
  assert.equal(out.from?.kind, 'AlphaGadget')
})

test('relatedMentionedKinds returns largest connected component on intersection speech', () => {
  const { related } = relatedMentionedKinds(intersectionSpeech, intersectionVocab)
  assert.equal(related.length, 2)
  assert.ok(related.includes('AlphaWidget'))
  assert.ok(related.includes('AlphaGadget'))
})

test('pickHopSpeech prefers user utterance when it mentions more related kinds', () => {
  const model = 'list WidgetSlip'
  assert.equal(pickHopSpeech(model, intersectionSpeech, intersectionVocab), intersectionSpeech)
  assert.equal(pickHopSpeech(intersectionSpeech, intersectionSpeech, intersectionVocab), intersectionSpeech)
  assert.equal(pickHopSpeech(intersectionSpeech, model, intersectionVocab), intersectionSpeech)
})

test('rememberUserSpeech recalls the last line for a session', () => {
  rememberUserSpeech('sess-hop', intersectionSpeech)
  assert.equal(recalledUserSpeech('sess-hop'), intersectionSpeech)
  assert.equal(pickHopSpeech('list WidgetSlip', recalledUserSpeech('sess-hop'), intersectionVocab), intersectionSpeech)
})
