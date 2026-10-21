/**
 * Inbox speak + the one dock card the secretary may open.
 * Priority is a step table, not a nested if chain.
 * @module dsh-lan-assist/dock
 */

import { CHASE_AFTER_MS } from './home.js'
import { isHandoffItem } from './handoff.js'
import { letterGoneFor } from './hall.js'
import { speakNamedRef } from './ref.js'
import { speakGuestNet } from './miss.js'
import { speakNods } from './probe.js'

export function clip(text, n) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  return s.length <= n ? s : `${s.slice(0, n)}…`
}

export function dayKey(t) {
  return new Date(t).toISOString().slice(0, 10)
}

export function folderName(cwd) {
  const s = String(cwd || '').replace(/[\\/]+$/, '')
  const parts = s.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || s
}

export function workspaceSign(cwd) {
  const name = folderName(cwd)
  return name ? `这封跟 ${name}` : ''
}

export function namesOf(state, ids) {
  return (ids || []).map((id) => state.peers[id]?.displayName || id.slice(0, 10)).join('、')
}

export function namedRecipients(state, ids) {
  return (ids || []).map((id) => {
    const peer = state.peers[id]
    return peer ? `${peer.displayName} ${peer.id.slice(0, 12)}…` : id
  })
}

export function lastReply(req) {
  const list = req && req.replies
  return list && list.length ? list[list.length - 1] : null
}

export function latestIncoming(req) {
  const mine = req && req.from
  const versions = (req && req.versions) || []
  for (let i = versions.length - 1; i >= 0; i -= 1) {
    const hit = versions[i] && versions[i].from === mine && versions[i].body
    if (hit) return versions[i].body
  }
  const last = lastReply(req)
  return (last && last.body) || ''
}

export function canAdopt(req, followCount) {
  if (!req) return false
  if ((req.attachments || []).some(isHandoffItem) && !req.adopted) return false
  if (req.cosign && req.cosign.on) {
    const need = (req.visible || []).filter((id) => id !== req.from)
    return need.every((id) => (req.cosign.nods || []).includes(id))
  }
  if ((req.replies || []).length) return true
  if (Number(followCount || 0) > 0) return true
  return req.kind === 'incoming' && !!(req.excerpt || req.body)
}

export function remainingTo(req) {
  return ((req && req.to) || []).filter((id) => !letterGoneFor(req, id))
}

export function overdueUnread(req, t) {
  if (!req || req.kind !== 'outgoing') return false
  if (req.status === 'presend' || req.status === 'queued' || req.status === 'retry' || req.status === 'failed' || req.status === 'withdrawn') return false
  const reads = req.reads || {}
  return remainingTo(req).some((id) => !reads[id] && t - req.createdAt >= CHASE_AFTER_MS)
}

export function outboxSpeak(state, req) {
  const waiting = remainingTo(req)
  const who = namesOf(state, waiting)
  const relayed = req && req.relayed && typeof req.relayed === 'object'
    ? waiting.length > 0 && waiting.every((id) => req.relayed[id])
    : false
  if (relayed) return `已进中继，等${who}落盘。不是已收到。`
  return req.guestNet ? speakGuestNet(who) : `还没送到${who}，我按 30秒/2分/10分再试。满 7 天会标失败。`
}

export function unreadNames(state, req) {
  const reads = req.reads || {}
  const ids = remainingTo(req).filter((id) => !reads[id])
  return namesOf(state, ids) || '同事'
}

export function missingNods(req) {
  const nods = req.cosign && req.cosign.nods || []
  return (req.visible || []).filter((id) => id !== req.from && !nods.includes(id))
}

export function shouldBrief(state, t) {
  const d = new Date(t)
  return d.getDay() !== 0 && d.getDay() !== 6 && d.getHours() >= 9 && state.lastBriefDay !== dayKey(t)
}

export function morningLine(state, caps) {
  const bits = []
  for (const req of Object.values(state.requests || {})) {
    req.kind === 'outgoing' && req.status === 'replied' && !req.adopted && !req.held
      && bits.push(`${lastReply(req)?.fromName || '同事'}的回信你还没点`)
    overdueUnread(req, Date.now()) && bits.push(`${unreadNames(state, req)}还没看`)
  }
  const pending = Object.values(state.requests || {}).filter((req) => req.lookupSpeak && /待审/.test(req.lookupSpeak)).length
  caps && caps.connector && pending && bits.push(`业务里还有 ${pending} 笔待审`)
  const empty = caps && caps.connector
    ? '今早没有要你看的。'
    : '今早没有要你看的信。没连业务，不能装成已查待办。'
  const joined = bits.length ? `今早：${bits.join('，')}。` : empty
  return (caps && caps.connector) || !bits.length ? joined : `今早：${bits.join('，')}。没连业务，不能装成已查待办。`
}

export function namedAsk(req, selfName) {
  const actor = String(selfName || '').replace(/的秘书.*$/, '') || '你'
  const who = req.fromName || '同事'
  return req.ref && req.ref.no
    ? `${speakNamedRef(req.ref, actor)}。要我拟回，还是你打？`
    : `${who}请你看。${clip(latestIncoming(req) || req.excerpt || req.body, 24)}那条，要我先拟一句回，还是你自己打？`
}

export function speakDueNudge(row) {
  const quote = clip(row.quote, 24)
  return row.createdAt && dayKey(row.createdAt) === dayKey(row.dueAt || row.createdAt)
    ? `到点了：${quote}。`
    : `昨天记下的：${quote}。`
}

export function publicNudges(state) {
  return (state.nudges || []).filter((row) => row && !row.forgotten).map((row) => ({
    id: row.id,
    quote: row.quote,
    dueAt: row.dueAt,
    spokenDay: row.spokenDay || '',
  }))
}

function pushInbox(items, row) {
  row && items.push(row)
}

export function inboxOf(state, t, ctx) {
  const items = []
  const selfName = (state.self && state.self.displayName) || state.displayName
  const selfId = state.self && state.self.id
  for (const req of Object.values(state.requests || {})) {
    const live = req && typeof req === 'object' && req.status !== 'closed' && req.status !== 'failed'
    const last = live && lastReply(req)
    live && req.topic && req.kind === 'outgoing' && (req.status === 'replied' || req.status === 'open') && !req.adopted && !req.held && (req.replies || []).length
      && pushInbox(items, {
        id: `reply:${req.id}`,
        requestId: req.id,
        peerId: (req.to || [])[0] || '',
        kind: 'reply',
        counts: true,
        sessionId: req.sessionId || '',
        workspace: req.workspace || '',
        speak: last
          ? `${last.fromName || '同事'}回了：${clip(last.body, 24)}。要接着改吗？`
          : '有回信。要接着改吗？',
      })
    live && req.kind === 'incoming' && req.status !== 'withdrawn' && !req.adopted && !req.held && !req.repliedAt
      && !(selfId && req.reads && req.reads[selfId])
      && pushInbox(items, {
        id: `asked:${req.id}`,
        requestId: req.id,
        peerId: req.from || '',
        kind: 'asked',
        counts: true,
        sessionId: req.sessionId || '',
        workspace: req.workspace || '',
        speak: namedAsk(req, selfName),
      })
    live && req.kind === 'outgoing' && (req.status === 'queued' || req.status === 'retry') && remainingTo(req).length
      && pushInbox(items, {
        id: `outbox:${req.id}`,
        requestId: req.id,
        kind: 'outbox',
        counts: true,
        sessionId: req.sessionId || '',
        speak: outboxSpeak(state, req),
      })
    live && req.kind === 'outgoing' && overdueUnread(req, t) && !req.chaseNoted
      && pushInbox(items, {
        id: `chase:${req.id}`,
        requestId: req.id,
        peerId: (req.to || []).find((id) => !((req.reads || {})[id])) || (req.to || [])[0] || '',
        kind: 'chase',
        counts: false,
        sessionId: req.sessionId || '',
        speak: `${unreadNames(state, req)}那封过了 24 小时还没看。要我再催一封吗？`,
      })
    const missing = live && req.cosign && req.cosign.on && req.status === 'replied' && !req.adopted && missingNods(req)
    missing && missing.length && pushInbox(items, {
      id: `cosign:${req.id}`,
      requestId: req.id,
      kind: 'cosign',
      counts: false,
      sessionId: req.sessionId || '',
      speak: `会签还差${missing.join('、')}点头，还不能 followup。`,
    })
  }
  for (const ev of state.events || []) {
    ev && !ev.held && !ev.silent && pushInbox(items, {
      id: `biz:${ev.id}`,
      requestId: ev.id,
      kind: ev.kind === 'receipt' || ev.kind === 'compensate' || ev.kind === 'duty' || ev.kind === 'expired' || ev.kind === 'miss' ? ev.kind : 'biz',
      counts: ev.kind !== 'receipt',
      sessionId: ev.sessionId || '',
      workspace: ev.workspace || '',
      speak: ev.speak,
    })
  }
  !state.briefOff && shouldBrief(state, t) && pushInbox(items, {
    id: 'brief:today',
    requestId: '',
    kind: 'brief',
    counts: false,
    sessionId: '',
    speak: morningLine(state, ctx.capabilitiesOf(state)),
  })
  const today = dayKey(t)
  for (const row of state.nudges || []) {
    row && !row.forgotten && row.dueAt && row.dueAt <= t && row.spokenDay !== today && pushInbox(items, {
      id: `nudge:${row.id}`,
      requestId: row.id,
      kind: 'nudge',
      counts: false,
      sessionId: row.sessionId || '',
      speak: speakDueNudge(row),
    })
  }
  return items
}

function noteCard(item, extra) {
  return item && Object.assign({
    mode: item.kind,
    requestId: item.requestId,
    speak: item.speak,
    sourceQuote: '',
    workspace: item.workspace || '',
    primary: '先记下',
    secondary: '',
    adoptEnabled: false,
    details: null,
  }, extra)
}

const DOCK_STEPS = [
  (b) => {
    const pending = b.ctx.livePendingWrite(b.state, b.ctx.gate, b.t)
    const here = pending && (!b.sessionId || !pending.sessionId || pending.sessionId === b.sessionId)
    const ok = here && pending.ok !== false && !!pending.preview_id
    const label = here && [pending.kind, pending.no].filter(Boolean).join(' ')
    return here && {
      mode: 'preview',
      requestId: pending.preview_id || '',
      speak: ok
        ? (pending.speak || `将改${label}。这是预览，不是过账。`)
        : (pending.speak || pending.hint || '先预览。'),
      prompt: ok ? '请到右边确认。确认前不会改库。' : '请到右边看。确认前不会改库。',
      sign: speakNods('post'),
      nod: speakNods('post'),
      sourceQuote: '',
      workspace: pending.workspace || '',
      preview: pending,
      primary: '执行',
      secondary: '算了',
      adoptEnabled: ok,
      details: pending,
    }
  },
  (b) => {
    const item = b.inbox.find((row) => (
      (row.kind === 'receipt' || row.kind === 'compensate')
      && b.sessionId && row.sessionId === b.sessionId
    ))
    return noteCard(item, {
      sign: item && item.kind === 'compensate' ? '秘书不执行冲正' : '有回执才算写上了',
    })
  },
  (b) => {
    const here = b.inbox.find((item) => item.kind === 'reply' && item.sessionId === b.sessionId)
    const req = here && b.state.requests[here.requestId]
    const last = req && lastReply(req)
    const previewSpeak = req && req.preview && req.preview.speak ? ` ${req.preview.speak}` : ''
    return here && {
      mode: 'reply',
      requestId: here.requestId,
      speak: last
        ? `${last.fromName || '同事'}回了。他说${clip(last.body, 40)}。要我按这个接着改方案，还是只收下？${previewSpeak}`
        : here.speak,
      sign: workspaceSign(req.workspace),
      sourceQuote: last ? last.body : '',
      workspace: req.workspace || '',
      preview: req.preview || null,
      primary: req.ref && req.ref.no && !req.preview ? '先预览' : '采纳并让模型接着做',
      secondary: '只收下',
      nod: speakNods(req.ref && req.ref.no ? 'schedule' : 'secretary'),
      canReply: true,
      adoptEnabled: canAdopt(req),
      details: b.ctx.requestPublic(req),
    }
  },
  (b) => {
    const askedList = b.inbox.filter((item) => item.kind === 'asked' && (!b.sessionId || item.sessionId === b.sessionId || !item.sessionId))
    const asked = askedList.find((item) => b.state.requests[item.requestId] && b.state.requests[item.requestId].replyDraftPending)
      || askedList[askedList.length - 1]
    const req = asked && b.state.requests[asked.requestId]
    const selfName = (b.state.self && b.state.self.displayName) || b.state.displayName
    return asked && {
      mode: 'asked',
      requestId: asked.requestId,
      speak: [namedAsk(req, selfName), req.lookupSpeak].filter(Boolean).join(' '),
      sign: [workspaceSign(req.workspace), `${req.fromName || '同事'}的秘书代送，${req.fromName || '同事'}点了才发`].filter(Boolean).join(' · '),
      sourceQuote: latestIncoming(req) || req.excerpt || req.body,
      workspace: req.workspace || '',
      replyDraft: typeof b.ctx.liveReplyDraft === 'function'
        ? b.ctx.liveReplyDraft(req, Object.values(b.state.requests || {}))
        : (req.replyDraft || ''),
      replyDraftPending: !!req.replyDraftPending,
      primary: '回给对方',
      secondary: '让秘书拟回',
      nod: speakNods('secretary'),
      lookup: req.lookupSpeak || '',
      canReply: true,
      adoptEnabled: false,
      details: b.ctx.requestPublic(req),
    }
  },
  (b) => {
    const other = b.inbox.find((item) => item.kind === 'reply' && item.sessionId && item.sessionId !== b.sessionId)
    return other && {
      mode: 'other',
      requestId: other.requestId,
      speak: '另一会话有回信',
      sign: '',
      sourceQuote: '',
      primary: '回那条',
      secondary: '',
      adoptEnabled: false,
      details: null,
    }
  },
  (b) => {
    const out = b.inbox.find((item) => item.kind === 'outbox')
    return out && {
      mode: 'outbox',
      requestId: out.requestId,
      speak: out.speak,
      sign: '',
      sourceQuote: '',
      primary: '',
      secondary: '先记下',
      adoptEnabled: false,
      details: b.ctx.requestPublic(b.state.requests[out.requestId]),
    }
  },
  (b) => {
    const presend = Object.values(b.state.requests || {}).find((req) => req.kind === 'outgoing' && req.status === 'presend')
    const names = presend && namedRecipients(b.state, presend.to)
    const who = names && names.length ? String(names[0]).split(' ')[0] : ''
    const selfName = (b.state.self && b.state.self.displayName) || '我'
    return presend && {
      mode: 'presend',
      requestId: presend.id,
      speak: names.length
        ? (presend.ref && presend.ref.no
          ? `发给 ${names.join('、')}。${speakNamedRef(presend.ref, who)}。你点了才发。`
          : `发给 ${names.join('、')}。信封里写${clip(presend.excerpt, 16)}。你点了才发。`)
        : '还没勾人。勾了再点发。禁止只说发给他。',
      sign: [workspaceSign(presend.workspace), `${selfName}的秘书代送，${selfName}点了才发`].filter(Boolean).join(' · '),
      sourceQuote: presend.excerpt,
      workspace: presend.workspace || '',
      primary: '发出去',
      secondary: '先不发',
      adoptEnabled: names.length > 0,
      details: b.ctx.requestPublic(presend),
    }
  },
  (b) => noteCard(b.inbox.find((item) => item.kind === 'expired'), { sign: '秘书不自己重登' }),
  (b) => {
    const item = b.inbox.find((row) => (
      (row.kind === 'receipt' || row.kind === 'compensate')
      && (!b.sessionId || !row.sessionId || row.sessionId === b.sessionId)
    ))
    return noteCard(item, {
      sign: item && item.kind === 'compensate' ? '秘书不执行冲正' : '有回执才算写上了',
    })
  },
  (b) => noteCard(b.inbox.find((item) => item.kind === 'miss'), { sign: '只说缺什么。不按岗位群发。' }),
  (b) => noteCard(b.inbox.find((item) => item.kind === 'duty'), { sign: '只开口。花名册不能代替配对。' }),
  (b) => noteCard(b.inbox.find((item) => item.kind === 'biz'), { sign: '只开口，不自动寄信，也不调度' }),
  (b) => {
    const ad = b.state.advice
    const ready = ad && ad.ready && !ad.recordedId && (!b.sessionId || !ad.sessionId || ad.sessionId === b.sessionId)
    return ready && {
      mode: 'advice',
      requestId: ad.requestId || '',
      speak: ad.speak || '图里有依据。你点了才记进决策台账。',
      sign: '依据来自语义图，不是秘书编的',
      sourceQuote: (ad.evidence || []).map((row) => row.snippet || row.id).filter(Boolean).join('\n'),
      primary: '按这个记进档案',
      secondary: '先不记',
      adoptEnabled: (ad.because || []).length > 0,
      details: { because: ad.because || [], evidence: ad.evidence || [], precedents: ad.precedents || [] },
    }
  },
  (b) => b.state.nudgeAsk && b.state.nudgeAsk.quote && {
    mode: 'nudge-ask',
    requestId: '',
    speak: `要我记下「${clip(b.state.nudgeAsk.quote, 24)}」？到点单独开口，不寄信，也不开工。`,
    sign: '点了才留条。不是待办中心。',
    sourceQuote: b.state.nudgeAsk.speech || b.state.nudgeAsk.quote,
    primary: '记下',
    secondary: '先不记',
    adoptEnabled: true,
    details: null,
  },
  (b) => {
    const brief = b.inbox.find((item) => item.kind === 'brief')
    return brief && {
      mode: 'brief',
      requestId: '',
      speak: brief.speak,
      sign: b.ctx.capabilitiesOf(b.state).connector ? '' : '没连业务，不能装成已查待办',
      sourceQuote: '',
      primary: '先记下',
      secondary: '关掉早报',
      adoptEnabled: false,
      details: null,
    }
  },
  (b) => {
    const due = b.inbox.find((item) => item.kind === 'nudge')
    return due && {
      mode: 'nudge',
      requestId: due.requestId,
      speak: due.speak,
      sign: '单独开口。不寄信，也不开工。',
      sourceQuote: '',
      primary: '先记下',
      secondary: '忘掉',
      adoptEnabled: false,
      details: null,
    }
  },
]

export function dockFor(state, sessionId, t, ctx) {
  const bag = { state, sessionId, t, ctx, inbox: inboxOf(state, t, ctx) }
  return DOCK_STEPS.map((step) => step(bag)).find(Boolean) || null
}
