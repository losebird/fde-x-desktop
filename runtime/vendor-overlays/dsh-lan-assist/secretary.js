/**
 * Secretary: pairing, envelopes, hold, inbox speak. Followup is a caller
 * adapter — this module never wakes a model by itself.
 * @module dsh-lan-assist/secretary
 */

import { join } from 'node:path'
import { createFileStore } from './files.js'
import { createAttachStore } from './attach.js'
import { DEFAULT_LAN_PORT, PLUGIN } from './home.js'
import { writeMailSlip } from './slips.js'
import {
  mintPeerId,
  randomHex,
} from './crypto.js'
import { createPairing } from './pair.js'
import { createMailbox, nextRetryWait } from './envelope.js'
import { createAdopt } from './adopt.js'
import { createGroups } from './group.js'
import { createNudges } from './nudge.js'
import { createConns } from './conn.js'
import { createGate } from './gate.js'
import { createDrafts } from './draft.js'
import { createAdvice } from './advice.js'
import { createHear } from './hear.js'
import { createHints } from './hint.js'
import { createTick } from './tick.js'
import { createShout } from './shout.js'
import { createSeat } from './seat.js'
import { createSee } from './see.js'
import { createView, bumpObserve, note, todayObserve } from './view.js'
import { createAsk } from './ask.js'
import { createHandoff, writePick } from './handoff.js'
import { openUniverFile } from './univer-open.js'
import { describeKindCatalog, packKindConcept } from './catalog.js'
import { createTraceLog, PROJECTION_REL } from './traces.js'
import { findMail, MAIL_REL } from './mail-proj.js'
import { inviteLive, mintRelayInvite as issueRelayInvite, packRelayCredsPath, packRelayUrl, relayUrl, setRelayStore } from './nats-relay.js'

/**
 * @param {{
 *   store: { get: Function, update: Function },
 *   now?: () => number,
 *   port?: number,
 *   send?: (door: string, frame: Record<string, unknown>) => Promise<{ ok: boolean, error?: string }>,
 * }} opts
 */
export function createSecretary(opts) {
  const store = opts.store
  const now = opts.now || (() => Date.now())
  const port = opts.port || DEFAULT_LAN_PORT
  const send = opts.send || (async () => ({ ok: false, error: 'NO_TRANSPORT' }))
  const files = opts.files || createFileStore({ root: store.root || '' })
  const attach = createAttachStore(files)
  const persistList = attach.persistList
  const hydrateList = attach.hydrateList
  let spilled = false

  async function spillOnce() {
    spilled || (await attach.spillOnce(store), spilled = true)
  }

  async function ensureSelf(state) {
    if (!state || typeof state !== 'object') return
    if (state.self && state.self.id && state.self.keySeed) return
    state.self = {
      id: mintPeerId('pk_self'),
      keySeed: randomHex(16),
      displayName: state.displayName || '本机',
      createdAt: now(),
    }
  }

  function doorOf(host, listenPort) {
    return `${host}:${listenPort || port}`
  }

  function selfDoor() {
    if (typeof opts.selfDoor === 'function') return opts.selfDoor()
    return doorOf('127.0.0.1', port)
  }

  const conns = createConns({
    store,
    now,
    snapshot: (sid) => snapshot(sid),
    note,
    bumpObserve,
    opts,
  })
  const loadConnToken = conns.loadConnToken
  const saveConnToken = conns.saveConnToken
  const loadLookupToken = conns.loadLookupToken
  const saveLookupToken = conns.saveLookupToken
  const publicLookups = conns.publicLookups
  const publicLookup = conns.publicLookup
  const lookupReady = conns.lookupReady
  const setLookup = conns.setLookup
  const lookupRef = conns.lookupRef

  const viewing = createView({
    store,
    now,
    port,
    opts,
    spillOnce,
    ensureSelf,
    loadLookupToken,
    loadConnToken,
    publicLookups,
    publicLookup,
    lookupReady,
    relayStatus: opts.relayStatus,
  })
  const snapshot = viewing.snapshot
  const hall = viewing.hall
  const ledger = viewing.ledger
  const threadOf = viewing.threadOf
  const viewOf = viewing.viewOf
  const catalogOf = viewing.catalogOf
  const capabilitiesOf = viewing.capabilitiesOf
  const requestPublic = viewing.requestPublic

  const handing = createHandoff({
    readSession: opts.readSession,
    store,
    now,
    snapshot,
    note,
    attach,
  })
  const packSession = handing.packSession
  const pickFile = handing.pickFile
  const readHandoff = handing.readPack
  const continueHandoff = handing.continueHandoff
  async function saveWorkspaceFile(spec = {}) {
    const cwd = String((spec && spec.workspace) || '').trim()
    if (!cwd) return { ok: false, error: 'NO_CWD', hint: '这封没绑工作区，不能改文件。' }
    return writePick(cwd, spec.path, spec.text)
  }
  async function openUniver(spec = {}) {
    const impl = typeof opts.univer === 'function' ? opts.univer() : opts.univer
    return openUniverFile(impl, spec)
  }
  const dockFor = viewing.dockFor
  const inboxOf = viewing.inboxOf
  const dock = viewing.dock
  const peerList = viewing.peerList

  const pairing = createPairing({
    store,
    now,
    send,
    selfDoor,
    ensureSelf,
    note,
    snapshot,
    inviteLive: async (session) => {
      const state = await store.get()
      return inviteLive(state.relayInvites && state.relayInvites[session], now())
    },
  })
  const mintPairCode = pairing.mintPairCode
  const handshake = pairing.handshake
  const acceptHello = pairing.acceptHello
  const acceptPairFrame = pairing.acceptPairFrame
  const acceptPairAsk = pairing.acceptPairAsk
  const rejectPairAsk = pairing.rejectPairAsk
  const unpair = pairing.unpair
  async function setRelayConfig(spec = {}) {
    const packedUrl = packRelayUrl(spec.url)
    if (!packedUrl.ok) return packedUrl
    let credsPath
    if (Object.prototype.hasOwnProperty.call(spec, 'credsPath')) {
      const packedPath = packRelayCredsPath(spec.credsPath)
      if (!packedPath.ok) return packedPath
      credsPath = packedPath.path
    }
    await store.update((s) => { s.relayUrl = packedUrl.url })
    if (credsPath !== undefined && typeof store.setSecret === 'function') {
      await store.setSecret('natsCredsPath', credsPath)
    }
    const livePath = credsPath !== undefined
      ? credsPath
      : (typeof store.getSecret === 'function' ? await store.getSecret('natsCredsPath') : '')
    setRelayStore({ url: packedUrl.url, credsPath: livePath })
    if (typeof opts.onRelayChange === 'function') {
      try { await opts.onRelayChange() } catch { /* listen restart is best effort */ }
    }
    return { ok: true, ...(await snapshot()) }
  }
  async function mintRelayInvite() {
    await store.update((s) => ensureSelf(s))
    const me = (await store.get()).self
    const issued = issueRelayInvite({ relay: relayUrl(), deviceId: me && me.id, now: now() })
    if (!issued.ok) return issued
    await store.update((s) => {
      s.relayInvites = s.relayInvites && typeof s.relayInvites === 'object' ? s.relayInvites : {}
      s.relayInvites[issued.invite.session] = { ...issued.invite, revoked: false }
    })
    return issued
  }
  async function revokeRelayInvite(session) {
    const id = String(session || '').trim()
    if (!id) return { ok: false, error: 'NO_INVITE', hint: '没有这枚邀请。' }
    let found = false
    await store.update((s) => {
      const row = s.relayInvites && s.relayInvites[id]
      if (!row) return
      row.revoked = true
      found = true
    })
    return found ? { ok: true } : { ok: false, error: 'NO_INVITE', hint: '没有这枚邀请。' }
  }
  async function relayInviteLive(session) {
    const id = String(session || '').trim()
    if (!id) return false
    const state = await store.get()
    return inviteLive(state.relayInvites && state.relayInvites[id], now())
  }

  const groupingBag = {
    store,
    now,
    snapshot,
    note,
    ensureSelf,
    files,
  }
  const grouping = createGroups(groupingBag)
  const createGroup = grouping.createGroup
  const updateGroup = grouping.updateGroup
  const dissolveGroup = grouping.dissolveGroup

  const writeArchive = typeof opts.writeArchive === 'function'
    ? opts.writeArchive
    : (args) => (store.root
      ? writeMailSlip(args, join(store.root, 'slips'))
      : Promise.resolve({ ok: true, skipped: true }))

  const mailbox = createMailbox({
    store,
    now,
    send,
    files,
    persistList,
    hydrateList,
    ensureSelf,
    note,
    snapshot,
    selfDoor,
    bumpObserve,
    refreshLookup: (id) => refreshLookup(id),
    loadVocab: opts.loadVocab,
    writeArchive,
  })
  groupingBag.announceRoster = mailbox.sendRoster
  const compose = mailbox.compose
  const confirmSend = mailbox.confirmSend
  const cancelPresend = mailbox.cancelPresend
  const flushOutbox = mailbox.flushOutbox
  const receiveEnvelope = mailbox.receiveEnvelope
  const reply = mailbox.reply
  const receiveReply = mailbox.receiveReply
  const receiveAck = mailbox.receiveAck
  const withdraw = mailbox.withdraw
  const retrySend = mailbox.retrySend
  const forward = mailbox.forward

  const shouting = createShout({
    store,
    now,
    send,
    selfDoor,
    ensureSelf,
    note,
    snapshot,
    port,
    flushOutbox,
  })
  const shout = shouting.shout
  const hear = shouting.hear
  const setPeerDoor = shouting.setPeerDoor
  const setAsleep = shouting.setAsleep
  const noteSeen = shouting.noteSeen
  const markPeerQuiet = shouting.markPeerQuiet
  const noteSighting = shouting.noteSighting
  const forgetSighting = shouting.forgetSighting
  const ingestListenInbox = (list) => shouting.ingestListenInbox(list, receiveEnvelope, receiveReply, receiveAck, peerFor, acceptPairFrame)

  const seating = createSeat({
    store,
    now,
    snapshot,
    note,
    ensureSelf,
    files,
    flushOutbox,
    publicLookups,
    saveConnToken,
  })
  const setDisplayName = async (name, avatar) => {
    const result = await seating.setDisplayName(name, avatar)
    shouting.shout().catch(() => undefined)
    return result
  }
  const setPeerNote = seating.setPeerNote
  const setPeerFlags = seating.setPeerFlags
  const stopWrites = seating.stopWrites
  const switchSeat = seating.switchSeat
  const holdBusinessEvent = seating.holdBusinessEvent
  const bindStaff = seating.bindStaff
  const applyLeftIds = seating.applyLeftIds
  const chase = seating.chase
  const reclaimHold = seating.reclaimHold
  const closeRequest = seating.closeRequest
  const bindSession = seating.bindSession
  const openHere = seating.openHere
  const exportLedger = seating.exportLedger
  const purgeLedger = seating.purgeLedger
  const wipeRefs = seating.wipeRefs
  const setBriefOff = seating.setBriefOff
  const grantListen = seating.grantListen
  const setSinkCommand = seating.setSinkCommand
  const runSink = seating.runSink

  const seeing = createSee({
    store,
    now,
    snapshot,
    note,
    attach,
    hydrateList,
    opts,
  })
  const getAttachment = seeing.getAttachment
  const copyAttachment = seeing.copyAttachment
  const seeAttachment = seeing.seeAttachment


  const asking = createAsk({
    store,
    now,
    send,
    snapshot,
    note,
    catalogOf,
    lookupRef,
    opts,
  })
  const askLocal = asking.askLocal
  const gatedSpeak = asking.gatedSpeak
  const refreshLookup = asking.refreshLookup
  const markRead = asking.markRead

  const drafting = createDrafts({
    store,
    now,
    snapshot,
    note,
  })
  const takeAssistantText = drafting.takeAssistantText
  const acceptDraftFromSession = drafting.acceptDraftFromSession
  const finalizeDraftFromSession = drafting.finalizeDraftFromSession
  const reopenReplyDraft = drafting.reopenReplyDraft

  const advising = createAdvice({
    store,
    now,
    snapshot,
    note,
    opts,
    dockFor,
  })
  const considerAdvice = advising.considerAdvice
  const maybeAdvise = advising.maybeAdvise
  const dismissAdvice = advising.dismissAdvice
  const confirmAdvice = advising.confirmAdvice
  const maybeBoard = advising.maybeBoard
  const suggestPrecedent = advising.suggestPrecedent
  const proposeSlots = advising.proposeSlots
  const pickSlot = advising.pickSlot
  const writeCalendar = advising.writeCalendar

  const hinting = createHints({
    store,
    now,
    snapshot,
    note,
    ensureSelf,
    catalogOf,
    todayObserve,
  })
  const hearBusinessEvent = hinting.hearBusinessEvent
  const speakDutyHint = hinting.speakDutyHint
  const speakObserveHint = hinting.speakObserveHint
  const speakForbiddenHint = hinting.speakForbiddenHint
  const speakFindMiss = hinting.speakFindMiss
  const speakSlaHint = hinting.speakSlaHint
  const speakDelegateHint = hinting.speakDelegateHint

  const hearing = createHear({
    store,
    now,
    snapshot,
    note,
    opts,
    previewBiz: (spec) => previewBiz(spec),
    considerAdvice,
    gatedSpeak,
  })
  const rememberFocus = hearing.rememberFocus
  const hearUserLine = hearing.hearUserLine

  const adopting = createAdopt({
    store,
    now,
    snapshot,
    note,
    catalogOf,
    lookupRef,
    hearBusinessEvent,
    maybeBoard,
    holdBusinessEvent,
    opts,
  })
  const draftReply = adopting.draftReply
  const hold = adopting.hold
  const previewWrite = adopting.previewWrite
  const adopt = adopting.adopt
  const nod = adopting.nod
  const setCosign = adopting.setCosign
  const addVisible = adopting.addVisible

  const traces = opts.traces || createTraceLog()
  const gating = createGate({
    store,
    now,
    snapshot,
    note,
    opts,
    catalogOf,
    reopenReplyDraft,
    hearBusinessEvent,
    rememberFocus,
  })
  const previewBiz = (spec = {}) => gating.previewBiz(spec)
  async function openTrace(spec = {}) {
    const cwd = String((spec && spec.workspace) || '').trim()
    if (!cwd) return { ok: false, error: 'NO_CWD', hint: '这封没绑工作区，不能打开账本。' }
    const id = String((spec && spec.id) || '').trim()
    const no = String((spec && spec.no) || '').trim()
    if (id) {
      const row = await traces.open(id, cwd)
      const mail = await findMail(cwd, { id })
      if (row) return { ok: true, row, mail: mail[0] || null, live: false }
      if (mail[0]) return { ok: true, row: null, mail: mail[0], live: false }
      return { ok: false, error: 'NOT_FOUND', hint: '账本里没有这笔。不是现查。' }
    }
    if (no) {
      const rows = typeof traces.byNo === 'function' ? await traces.byNo(cwd, no, spec && spec.limit) : []
      const mailRows = await findMail(cwd, { no, limit: spec && spec.limit })
      return {
        ok: true,
        rows,
        mailRows,
        live: false,
        hint: '当时回执和发出的信。不是现查。当前状态要 biz_preview。',
        projection: PROJECTION_REL,
        mail: MAIL_REL,
      }
    }
    const rows = await traces.recent(cwd, spec && spec.limit)
    const mailRows = await findMail(cwd, { limit: spec && spec.limit })
    return { ok: true, rows, mailRows, live: false, projection: PROJECTION_REL, mail: MAIL_REL }
  }
  async function ingestLedger(spec = {}) {
    if (!spec || spec.nodded !== true) {
      return { ok: false, error: 'NOT_NODDED', hint: '进图要点头。图里是当时，不是现查。' }
    }
    const cwd = String((spec && spec.workspace) || '').trim()
    if (!cwd) return { ok: false, error: 'NO_CWD', hint: '这封没绑工作区，不能进图。' }
    if (typeof opts.ingestPaths !== 'function') {
      return { ok: false, error: 'NO_SEMANTIC', hint: '语义仓没接上，不能 ingest。' }
    }
    const paths = [PROJECTION_REL, MAIL_REL]
    const got = await opts.ingestPaths(cwd, paths)
    if (got && got.ok === false) return got
    await store.update((s) => note(s, `点头进图 · 账本投影 · ${cwd}`, now()))
    return { ok: true, paths, live: false, ...(got || {}) }
  }
  async function describeBiz(spec = {}) {
    const cwd = String((spec && spec.workspace) || '').trim()
    if (!cwd) return { ok: false, error: 'NO_CWD', hint: '这封没绑工作区，不能打开目录。' }
    let vocab = []
    if (typeof opts.loadVocab === 'function') {
      try {
        const loaded = await opts.loadVocab(cwd)
        vocab = Array.isArray(loaded) ? loaded : []
      } catch {
        vocab = []
      }
    }
    const catalog = describeKindCatalog(vocab)
    const want = String((spec && spec.kind) || '').trim()
    if (!want) return catalog
    return {
      ...catalog,
      kinds: catalog.kinds.filter((row) => row.kind === want),
      relations: catalog.relations.filter((row) => row.from === want || row.to === want),
    }
  }
  async function publishBiz(spec = {}) {
    if (!spec.confirm) return { ok: false, error: 'NEED_NOD', hint: '改词表要点头。' }
    const cwd = String((spec && spec.workspace) || '').trim()
    if (!cwd) return { ok: false, error: 'NO_CWD', hint: '这封没绑工作区，不能改目录。' }
    const packed = packKindConcept(spec)
    if (!packed.ok) return packed
    if (typeof opts.saveVocab !== 'function') return { ok: false, error: 'NO_SEMANTIC', hint: '这台没接语义仓。' }
    try {
      const written = await opts.saveVocab(cwd, packed.concept)
      if (written && written.ok === false) return written
      return { ok: true, concept: packed.concept }
    } catch {
      return { ok: false, error: 'VOCAB_FAILED', hint: '词表没写下。' }
    }
  }
  const commitWrite = gating.commitWrite
  const dismissWrite = gating.dismissWrite
  const pickSheetRow = gating.pickSheetRow
  const backSheet = gating.backSheet
  const fileAskClue = gating.fileAskClue

  const nudging = createNudges({
    store,
    now,
    snapshot,
    note,
  })
  const confirmNudge = nudging.confirmNudge
  const addNudge = nudging.addNudge
  const dismissNudgeAsk = nudging.dismissNudgeAsk
  const holdNudge = nudging.holdNudge
  const forgetNudge = nudging.forgetNudge

  const ticking = createTick({
    store,
    now,
    note,
    files,
    shout,
    flushOutbox,
  })
  const tick = ticking.tick

  function findPeerById(state, id) {
    return state.peers[id] || null
  }

  async function peerFor(id) {
    const state = await store.get()
    return findPeerById(state, id)
  }

  return {
    snapshot,
    hall,
    ledger,
    threadOf,
    viewOf,
    dock,
    setDisplayName,
    setPeerNote,
    setPeerFlags,
    noteSighting,
    forgetSighting,
    mintPairCode,
    handshake,
    acceptHello,
    acceptPairFrame,
    acceptPairAsk,
    rejectPairAsk,
    unpair,
    mintRelayInvite,
    setRelayConfig,
    revokeRelayInvite,
    relayInviteLive,
    createGroup,
    updateGroup,
    dissolveGroup,
    compose,
    packSession,
    pickFile,
    saveWorkspaceFile,
    openUniver,
    readHandoff,
    continueHandoff,
    askLocal,
    confirmSend,
    previewWrite,
    previewBiz,
    describeBiz,
    publishBiz,
    openTrace,
    ingestLedger,
    commitWrite,
    dismissWrite,
    pickSheetRow,
    backSheet,
    fileAskClue,
    cancelPresend,
    flushOutbox,
    receiveEnvelope,
    receiveReply,
    receiveAck,
    markRead,
    reply,
    draftReply,
    forward,
    hold,
    considerAdvice,
    maybeAdvise,
    hearUserLine,
    confirmNudge,
    addNudge,
    dismissNudgeAsk,
    holdNudge,
    forgetNudge,
    acceptDraftFromSession,
    finalizeDraftFromSession,
    reopenReplyDraft,
    takeAssistantText,
    dismissAdvice,
    confirmAdvice,
    adopt,
    withdraw,
    nod,
    setCosign,
    addVisible,
    proposeSlots,
    pickSlot,
    writeCalendar,
    chase,
    retrySend,
    reclaimHold,
    applyLeftIds,
    hearBusinessEvent,
    speakDutyHint,
    speakFindMiss,
    speakObserveHint,
    speakForbiddenHint,
    speakSlaHint,
    speakDelegateHint,
    refreshLookup,
    getAttachment,
    copyAttachment,
    seeAttachment,
    stopWrites,
    switchSeat,
    holdBusinessEvent,
    bindStaff,
    setLookup,
    wipeRefs,
    suggestPrecedent,
    closeRequest,
    bindSession,
    openHere,
    noteSeen,
    shout,
    setAsleep,
    hear,
    setPeerDoor,
    tick,
    exportLedger,
    purgeLedger,
    setBriefOff,
    ingestListenInbox,
    grantListen,
    setSinkCommand,
    runSink,
    peerFor,
    PLUGIN,
  }
}

export { nextRetryWait }
