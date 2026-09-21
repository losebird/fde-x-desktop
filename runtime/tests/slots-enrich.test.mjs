import test from 'node:test'
import assert from 'node:assert/strict'
import {
  enrichStructuredSlots,
  clueHitsInSpeech,
  kindMentions,
  leftoverKindMissingFromCatalog,
  leftoverNameIdentity,
  pickHopSpeech,
  recoverWriteIntent,
  relatedMentionedKinds,
  rememberUserSpeech,
  recalledUserSpeech,
  spokenWantsBatch,
  dropSpokenBatchRowId,
} from '../vendor-overlays/dsh-lan-assist/slots.js'

test('kindMentions does not count a shorter kind inside a longer kind', () => {
  const hits = kindMentions('ParentA MidB ChildC', ['Parent', 'ParentA', 'MidB', 'ChildC'])
  assert.deepEqual(hits.map((row) => row.kind), ['ParentA', 'MidB', 'ChildC'])
})

test('kindMentions keeps an exact spoken kind that appears in the graph over a longer suffix kind even when they do not share an edge with the other mention', () => {
  const vocab = [
    { kind: 'Customer', resource: 'customers', can: ['现查'] },
    { kind: 'Ticket', resource: 'tickets', can: ['现查'] },
    { kind: 'ShopTicket', resource: 'shop_tickets', can: ['现查'] },
    {
      kind: 'TicketLog',
      resource: 'ticket_logs',
      can: ['现查'],
      relations: [{ from: 'Ticket', to: 'TicketLog', field: 'ticket' }],
    },
  ]
  const extra = {
    vocab,
    relations: [{ from: 'Ticket', to: 'TicketLog', field: 'ticket' }],
  }
  const speech = 'inactive Customer still has open Ticket?'
  const kinds = vocab.map((row) => row.kind)
  const hits = kindMentions(speech, kinds, extra)
  assert.ok(hits.some((row) => row.kind === 'Ticket'))
  assert.ok(!hits.some((row) => row.kind === 'ShopTicket'))
})

test('kindMentions keeps an exact spoken kind over a longer suffix kind when the exact kind is graph-related', () => {
  const vocab = [
    { kind: 'Customer', resource: 'customers', can: ['现查'] },
    {
      kind: 'Ticket',
      resource: 'tickets',
      can: ['现查'],
      relations: [{ from: 'Customer', to: 'Ticket', field: 'customer' }],
    },
    { kind: 'AlphaTicket', resource: 'alpha_tickets', can: ['现查'] },
  ]
  const speech = 'inactive Customer 还有哪些 open Ticket？'
  const hits = kindMentions(speech, vocab.map((row) => row.kind), { vocab })
  assert.ok(hits.some((row) => row.kind === 'Ticket'))
  assert.ok(!hits.some((row) => row.kind === 'AlphaTicket'))
  const { related } = relatedMentionedKinds(speech, vocab)
  assert.ok(related.includes('Customer'))
  assert.ok(related.includes('Ticket'))
  assert.equal(related.includes('AlphaTicket'), false)
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
  assert.equal(out.kind, '工单')
  assert.equal(out.from?.kind, '客户')
  assert.ok(Array.isArray(out.from?.where) && out.from.where.length)
  assert.ok(Array.isArray(out.where) && out.where.some((term) => term.not))
})

test('enrichStructuredSlots retargets DSH ancestor kind to graph leaf when two related kinds are mentioned', () => {
  const speech = '停用客户还有哪些没关的工单？'
  const out = enrichStructuredSlots({
    kind: '客户',
    action: '现查',
    speech,
  }, vocab)
  assert.equal(out.kind, '工单')
  assert.equal(out.from?.kind, '客户')
  assert.ok(Array.isArray(out.from?.where) && out.from.where.length)
  assert.ok(Array.isArray(out.where) && out.where.some((term) => term.not))
})

test('enrichStructuredSlots retargets ParentA to ChildB when both related kinds are mentioned', () => {
  const speech = 'ParentA pending rows tied to ChildB expired — list ChildB hits'
  const out = enrichStructuredSlots({
    kind: 'ParentA',
    action: '现查',
    speech,
  }, hopVocab)
  assert.equal(out.kind, 'ChildB')
  assert.equal(out.from?.kind, 'ParentA')
})

test('enrichStructuredSlots does not retarget a single mentioned kind on rewrite', () => {
  const out = enrichStructuredSlots({
    kind: '客户',
    action: '改行',
    speech: '把停用客户通达改成成交。只要预览，不要过账，不要 biz_write。',
  }, vocab)
  assert.equal(out.kind, '客户')
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

test('relatedMentionedKinds uses collection FK when vocab has no relations', () => {
  const fkVocab = [
    { kind: 'ParentA', resource: 'parent_a', can: ['现查'] },
    { kind: 'ChildB', resource: 'child_b', can: ['现查'] },
  ]
  const collections = [
    { name: 'parent_a', fields: [{ name: 'code' }] },
    {
      name: 'child_b',
      fields: [
        { name: 'parent', target: 'parent_a', interface: 'm2o' },
        { name: 'parentId' },
      ],
    },
  ]
  const speech = 'ParentA ChildB — list ChildB'
  const { related } = relatedMentionedKinds(speech, fkVocab, { collections })
  assert.ok(related.includes('ParentA'))
  assert.ok(related.includes('ChildB'))
})

test('enrichStructuredSlots chains three kinds via schema FK when vocab has no relations', () => {
  const chainVocab = [
    { kind: 'ParentA', resource: 'parent_a', can: ['现查'] },
    { kind: 'MidB', resource: 'mid_b', can: ['现查'] },
    { kind: 'ChildC', resource: 'child_c', can: ['现查'] },
  ]
  const collections = [
    { name: 'parent_a', fields: [{ name: 'code' }] },
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

const catalogExtra = {
  vocab: intersectionVocab,
  collections: [
    { name: 'alpha_widget', title: 'AlphaWidget' },
    { name: 'alpha_gadget', title: 'AlphaGadget' },
  ],
}

test('leftoverKindMissingFromCatalog refuses leftover only after catalog miss', () => {
  assert.equal(leftoverKindMissingFromCatalog('Widget', catalogExtra), true)
  assert.equal(leftoverKindMissingFromCatalog('Gadget', catalogExtra), true)
  assert.equal(leftoverKindMissingFromCatalog('AlphaWidget', catalogExtra), false)
  assert.equal(leftoverKindMissingFromCatalog('AlphaGadget', catalogExtra), false)
  assert.equal(leftoverKindMissingFromCatalog('Widget', { vocab: intersectionVocab }), false)
})

test('spoken fragments still bind to connected vocab kinds with catalog present', () => {
  const hits = kindMentions('pending Widget ∩ expired Gadget', intersectionKinds, catalogExtra)
  assert.deepEqual(hits.map((row) => row.kind), ['AlphaWidget', 'AlphaGadget'])
  const remapped = enrichStructuredSlots({
    kind: 'Widget',
    action: '现查',
    speech: intersectionSpeech,
  }, intersectionVocab, catalogExtra)
  assert.equal(remapped.kind, 'AlphaWidget')
  assert.equal(leftoverKindMissingFromCatalog(remapped.kind, catalogExtra), false)
})

test('hop speech of a collection-title kind does not mention another table\'s spoken alias', () => {
  const vocab = [
    {
      kind: 'LeaveKind',
      resource: 'biz_leave',
      can: ['现查'],
      clues: [{ role: '型', say: ['ApprovalSlip'] }],
    },
    { kind: 'TicketKind', resource: 'biz_tickets', can: ['现查'] },
  ]
  const extra = {
    vocab,
    collections: [
      { name: 'biz_leave', title: 'LeaveKind' },
      { name: 'biz_tickets', title: 'TicketKind' },
    ],
  }
  const hits = kindMentions('which TicketKind are still open', ['LeaveKind', 'TicketKind'], extra)
  assert.deepEqual(hits.map((row) => row.kind), ['TicketKind'])
})

test('pickHopSpeech prefers the user line when the model truncated it', () => {
  const user = '把停用客户通达改成成交。只要预览，不要过账，不要 biz_write。'
  assert.equal(pickHopSpeech('停用客户通达', user, vocab), user)
})

test('recoverWriteIntent upgrades 现查 to 改行 from rewrite speech', () => {
  const speech = '把停用客户通达改成成交。只要预览，不要过账，不要 biz_write。'
  const writeVocab = vocab.map((row) => (
    row && row.kind === '客户' ? { ...row, can: ['现查', '改行'] } : row
  ))
  const out = recoverWriteIntent({
    kind: '客户',
    action: '现查',
    speech,
  }, writeVocab, {
    schemaByKind: {
      客户: [{ name: 'status', title: '客户状态', enums: { inactive: '停用', active: '成交' } }],
    },
  })
  assert.equal(out.action, '改行')
  assert.equal(out.patch?.status, '成交')
})

test('recoverWriteIntent prefers spoken write action over a mismatched model action', () => {
  const speech = '待审单据都过一下。只要预览，不要过账，不要 biz_write。'
  const writeVocab = [
    {
      kind: '单据',
      resource: 'biz_docs',
      can: ['现查', '改行', '过审'],
      clues: [{ say: ['待审'], keys: ['status'], values: ['pending', '待审'] }],
    },
  ]
  const out = recoverWriteIntent({
    kind: '单据',
    action: '改行',
    speech,
  }, writeVocab)
  assert.equal(out.action, '过审')
})

test('model-picked row id not spoken is replaced by leftover name identity', () => {
  const speech = '把停用客户通达改成成交。只要预览，不要过账，不要 biz_write。'
  const writeVocab = vocab.map((row) => (
    row && row.kind === '客户' ? { ...row, can: ['现查', '改行'] } : row
  ))
  const filled = enrichStructuredSlots({
    kind: '客户',
    action: '改行',
    speech,
    no: 'ROW-PICKED',
    patch: { status: 'active' },
  }, writeVocab)
  assert.equal(filled.no, '通达')
})

test('picked row from the hit set is kept', () => {
  const speech = '把停用客户通达改成成交。只要预览，不要过账，不要 biz_write。'
  const writeVocab = vocab.map((row) => (
    row && row.kind === '客户' ? { ...row, can: ['现查', '改行'] } : row
  ))
  const filled = enrichStructuredSlots({
    kind: '客户',
    action: '改行',
    speech,
    no: 'C-1',
    picked: true,
    patch: { status: 'active' },
  }, writeVocab)
  assert.equal(filled.no, 'C-1')
})

test('batch leftover no is dropped; spoken ticket stays', () => {
  const speech = '待审单据都过一下。只要预览，不要过账，不要 biz_write。'
  const docVocab = [
    {
      kind: '单据',
      resource: 'biz_docs',
      can: ['现查', '过审'],
      clues: [{ say: ['待审'], keys: ['status'], values: ['pending'] }],
    },
  ]
  assert.equal(dropSpokenBatchRowId('单都', speech, docVocab), '')
  const filled = enrichStructuredSlots({
    kind: '单据',
    action: '过审',
    speech,
    no: '单都',
  }, docVocab)
  assert.equal(String(filled.no || ''), '')
})

test('spoken ticket in the utterance is kept as identity', () => {
  const speech = '过一下单据 TCK-018。只要预览，不要过账，不要 biz_write。'
  const docVocab = [
    {
      kind: '单据',
      resource: 'biz_docs',
      can: ['现查', '过审'],
      clues: [{ say: ['待审'], keys: ['status'], values: ['pending'] }],
    },
  ]
  const filled = enrichStructuredSlots({
    kind: '单据',
    action: '过审',
    speech,
    no: 'TCK-018',
  }, docVocab)
  assert.equal(filled.no, 'TCK-018')
})

test('enum labels spoken inside a mentioned kind are that kind\'s where; unspoken enum labels stay out', () => {
  const speech = '现查上游关联的单据甲乙。只要预览，不要过账，不要 biz_write。'
  const vocab = [
    {
      kind: '上游',
      resource: 'upstreams',
      can: ['现查'],
      relations: [{ from: '上游', to: '单据甲乙', field: 'up' }],
    },
    {
      kind: '单据甲乙',
      resource: 'docs_ab',
      can: ['现查'],
      relations: [{ from: '上游', to: '单据甲乙', field: 'up' }],
    },
  ]
  const extra = {
    vocab,
    relations: vocab[0].relations,
    schemaByKind: {
      单据甲乙: [{
        name: 'bizType',
        title: '类别',
        enums: { alpha: '甲', beta: '乙', gamma: '丙', delta: '丁' },
      }],
    },
  }
  const filled = enrichStructuredSlots({
    kind: '单据甲乙',
    action: '现查',
    speech,
  }, vocab, extra)
  const steps = Array.isArray(filled.steps) ? filled.steps : []
  const target = steps[steps.length - 1] || filled
  const values = (target.where || []).flatMap((term) => term.values || [])
  assert.deepEqual(values.slice().sort(), ['alpha', 'beta'])
  assert.equal((target.where || []).length, 1)
  assert.equal(values.includes('gamma'), false)
  assert.equal(values.includes('delta'), false)
})

test('clue say that is only a kind-label prefix does not steal another kind\'s where', () => {
  const speech = '过一下单据申请 TCK-018。只要预览，不要过账，不要 biz_write。'
  const vocab = [
    {
      kind: '单据日志',
      resource: 'doc_logs',
      can: ['现查'],
      clues: [{ say: ['单据'], keys: ['logStatus', 'status'], values: ['paper'] }],
    },
    {
      kind: '单据申请',
      resource: 'biz_docs',
      aliases: ['单据单'],
      can: ['现查', '过审'],
    },
  ]
  const hits = clueHitsInSpeech(speech, vocab)
  assert.equal(hits.some((hit) => (hit.values || []).includes('paper')), false)
  const filled = enrichStructuredSlots({
    kind: '单据申请',
    action: '过审',
    speech,
    where: [{ keys: ['logStatus', 'status'], values: ['paper'] }],
  }, vocab, {
    vocab,
    schemaByKind: {
      单据申请: [{ name: 'requestNo' }, { name: 'status', title: '审批状态' }],
    },
  })
  assert.equal(filled.no, 'TCK-018')
  assert.equal((filled.where || []).some((term) => (term.keys || []).includes('logStatus')), false)
  assert.equal((filled.where || []).some((term) => (term.values || []).includes('paper')), false)
})

test('spokenWantsBatch is true for 列举 and 都+write, false for a fuzzy name rewrite', () => {
  const writeVocab = vocab.map((row) => (
    row && row.kind === '客户' ? { ...row, can: ['现查', '改行', '过审'] } : row
  ))
  assert.equal(spokenWantsBatch('停用客户还有哪些没关的工单？', vocab), true)
  assert.equal(spokenWantsBatch('待审单据都过一下。', [
    { kind: '单据', resource: 'biz_docs', can: ['过审'], clues: [{ say: ['待审'], keys: ['status'], values: ['pending'] }] },
  ]), true)
  assert.equal(spokenWantsBatch('把停用客户通达改成成交。', writeVocab), false)
})

test('口语 stub extra.vocab still peels spoken seed so leftover is the name rest', () => {
  const speech = '把停用客户通达改成成交。只要预览，不要过账，不要 biz_write。'
  const stub = { vocab: [...vocab, { kind: '口语', spoken: true, clues: [] }] }
  const name = leftoverNameIdentity(speech, vocab, stub, { patch: { status: 'active' } })
  assert.equal(name, '通达')
})

test('现查 leftover list-verb is not a ticket number', () => {
  const payVocab = [
    {
      kind: '销售回款',
      resource: 'biz_payments',
      can: ['现查'],
      relations: [{ from: '销售合同', to: '销售回款', field: 'contract' }],
      clues: [{ say: ['待审'], keys: ['status'], values: ['pending', '待审'] }],
    },
    {
      kind: '销售合同',
      resource: 'biz_contracts',
      can: ['现查'],
      clues: [{ say: ['已到期', '到期'], keys: ['status'], values: ['expired', '已到期'], dateBefore: ['today'] }],
    },
    { kind: '口语', spoken: true, clues: [] },
  ]
  const speech = '待审回款挂在哪些合同上？把已到期的那些摊出来。'
  const filled = enrichStructuredSlots({
    kind: '销售回款',
    action: '现查',
    speech,
  }, payVocab)
  assert.equal(String(filled.no || ''), '')
  assert.notEqual(leftoverNameIdentity(speech, payVocab, { vocab: payVocab }), '摊出来')
})

test('leftover name identity is connector rest, not a hardcoded company', () => {
  const speech = '把停用客户通达改成成交。只要预览，不要过账，不要 biz_write。'
  const name = leftoverNameIdentity(speech, vocab, {}, { patch: { status: 'active' } })
  assert.equal(name, '通达')
  const filled = enrichStructuredSlots({
    kind: '客户',
    action: '改行',
    speech,
    patch: { status: 'active' },
  }, vocab)
  assert.equal(filled.no, '通达')
  assert.ok(Array.isArray(filled.where) && filled.where.some((term) => (
    (term.values || []).includes('inactive') || (term.values || []).includes('停用')
  )))
})

test('model-omitted where still binds status ∩ leftover name', () => {
  const speech = '把停用客户通达改成成交。只要预览，不要过账，不要 biz_write。'
  const filled = enrichStructuredSlots({
    kind: '客户',
    action: '改行',
    speech,
    patch: { status: 'active' },
    from: { kind: '客户' },
  }, vocab)
  assert.equal(filled.no, '通达')
  assert.ok(Array.isArray(filled.from?.where) && filled.from.where.length)
})

