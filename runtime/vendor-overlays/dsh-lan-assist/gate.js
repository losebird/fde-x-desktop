/**
 * Preview then write. Token is not a post. Same opening merges; another replaces.
 * A later write preview with a different action is another opening: pending / sheet
 * follow that hop. Cancel drops only that preview_id.
 * @module dsh-lan-assist/gate
 */

import { OPENING_TTL_MS, PLUGIN } from './home.js'
import { randomHex } from './crypto.js'
import { packSheet, speakBundlePreview, speakBundleReceipt } from './write.js'
import { relatedFilterField, relatedHopId } from './lookup.js'
import { briefFollowup } from './catalog.js'

export function mergePreviewLines(existing, next) {
  const rows = Array.isArray(existing) ? existing.slice() : []
  if (!next) return rows
  const nextKeys = Object.keys(next.patch || {})
  const same = rows.findIndex((row) => (
    row && row.kind === next.kind && row.no === next.no && row.action === next.action
    && (!nextKeys.length || nextKeys.some((key) => row.patch && Object.prototype.hasOwnProperty.call(row.patch, key)))
  ))
  same >= 0 ? (rows[same] = next) : rows.push(next)
  return rows
}

export function lineAction(row) {
  if (!row || typeof row !== 'object') return ''
  return String(row.action || (row.sheet && row.sheet.action) || '').trim()
}

export function latestLiveLine(lines) {
  const rows = Array.isArray(lines) ? lines : []
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i]
    if (row && row.ok !== false && String(row.preview_id || '').trim()) return row
  }
  return rows.length ? rows[rows.length - 1] : null
}

function sameWriteAction(prev, incoming) {
  const left = lineAction(prev)
  const right = lineAction(incoming)
  return !left || !right || left === right
}

export function livePendingWrite(state, gate, t) {
  const pending = state && state.pendingWrite
  if (!pending || pending.ok === false) return null
  const lines = Array.isArray(pending.lines) && pending.lines.length
    ? pending.lines
    : (pending.preview_id ? [pending] : [])
  const live = []
  const notes = []
  for (const row of lines) {
    const previewId = row && String(row.preview_id || '').trim()
    !previewId && row && notes.push(row)
    previewId && !(row.expiresAt && Number(row.expiresAt) <= t)
      && !(gate && gate.tokens && typeof gate.tokens.get === 'function' && !gate.tokens.get(previewId))
      && live.push(row)
  }
  if (!live.length) {
    state.pendingWrite = null
    return null
  }
  const kept = live.concat(notes)
  const latest = latestLiveLine(live) || live[live.length - 1]
  return {
    ...pending,
    action: latest.action || pending.action,
    kind: latest.kind || pending.kind,
    no: Object.prototype.hasOwnProperty.call(latest, 'no') ? latest.no : pending.no,
    preview_id: latest.preview_id,
    sheet: latest.sheet || pending.sheet,
    lines: kept,
    speak: pending.speak || speakBundlePreview(kept),
  }
}

export function livePendingWriteFor(state, gate, t, sessionId) {
  const pending = livePendingWrite(state, gate, t)
  const sid = String(sessionId || '').trim()
  return pending && !(sid && pending.sessionId && pending.sessionId !== sid) ? pending : null
}

export function livePendingSheet(state, gate, t, sessionId) {
  const sheet = state && state.pendingSheet
  if (!sheet) return null
  if (sheet.expiresAt && Number(sheet.expiresAt) <= t) {
    state.pendingSheet = null
    return null
  }
  const sid = String(sessionId || '').trim()
  if (sid && sheet.sessionId && sheet.sessionId !== sid) return null
  const pending = livePendingWriteFor(state, gate, t, sessionId)
  const writeId = pending ? String(pending.preview_id || '').trim() : ''
  const writeRows = pending && pending.sheet && Array.isArray(pending.sheet.rows) ? pending.sheet.rows.length : 0
  const coverWrite = !!(pending && lineAction(pending) && lineAction(pending) !== '现查' && (writeId || writeRows > 0))
  const raw = (coverWrite && pending.sheet && {
    ...pending.sheet,
    remainRows: sheet.remainRows || pending.sheet.remainRows,
    sessionId: pending.sessionId || sheet.sessionId || '',
    workspace: pending.workspace || sheet.workspace || '',
  }) || (coverWrite && pending.preview_id && packSheet({
    ...pending, clue: pending.no, sessionId: pending.sessionId, workspace: pending.workspace,
  })) || sheet
  if (!raw || typeof raw !== 'object') return raw
  const { vocab, ...view } = raw
  const trail = state && Array.isArray(state.sheetTrail) ? state.sheetTrail : []
  const nextKind = String(view.nextKind || '').trim()
  return { ...view, nextKind, canBack: trail.length > 0 }
}

/**
 * @param {object} bag
 */
export function createGate(bag) {
  const {
    store, now, snapshot, note, opts, catalogOf, reopenReplyDraft, hearBusinessEvent, rememberFocus,
  } = bag
  let pickingNo = ''

  async function vocabOf(workspace) {
    if (typeof opts.loadVocab !== 'function') return []
    try {
      const loaded = await opts.loadVocab(String(workspace || '').trim())
      return Array.isArray(loaded) ? loaded : []
    } catch {
      return []
    }
  }

  function rememberSheet(s, spec, fresh) {
    const prev = s.pendingSheet
    if (spec && spec.related && prev && Array.isArray(prev.rows) && prev.rows.length > 1) {
      const trail = Array.isArray(s.sheetTrail) ? s.sheetTrail.slice() : []
      trail.push(prev)
      s.sheetTrail = trail.length > 8 ? trail.slice(-8) : trail
      return
    }
    if (fresh && !(spec && spec.related)) {
      s.sheetTrail = []
      s.listBeforeWrite = null
    }
  }

  function stashListBeforeWrite(s, prevSheet) {
    if (s.listBeforeWrite && Array.isArray(s.listBeforeWrite.rows) && s.listBeforeWrite.rows.length) return
    if (!prevSheet || typeof prevSheet !== 'object') return
    const prevAct = String(prevSheet.action || '现查')
    const prevRows = Array.isArray(prevSheet.rows) ? prevSheet.rows : []
    if (prevAct !== '现查' || !prevRows.length) return
    s.listBeforeWrite = {
      ...prevSheet,
      rows: prevRows.slice(),
      preview_id: '',
      previewId: '',
      canWrite: false,
    }
  }

  function isConnectorCatalogDump(sheet) {
    if (!sheet || typeof sheet !== 'object') return false
    if (String(sheet.action || '').trim() !== '现查') return false
    if (String((sheet.preview_id || sheet.previewId) || '').trim()) return false
    if (String(sheet.speech || '').trim()) return false
    const where = sheet.where ?? sheet.listWhere
    if (Array.isArray(where) && where.length) return false
    if (Array.isArray(sheet.hopWhere) && sheet.hopWhere.length) return false
    const from = sheet.from
    if (from && typeof from === 'object' && !Array.isArray(from) && String(from.kind || '').trim()) {
      return false
    }
    if (Array.isArray(sheet.steps) && sheet.steps.length) return false
    return true
  }

  function shouldKeepPopulatedListSheet(prev, incoming) {
    const prevRows = prev && Array.isArray(prev.rows) ? prev.rows.length : 0
    const nextRows = incoming && Array.isArray(incoming.rows) ? incoming.rows.length : 0
    if (prevRows > 0 && nextRows === 0) return true
    const prevPid = String((prev && (prev.preview_id || prev.previewId)) || '').trim()
    const nextPid = String((incoming && (incoming.preview_id || incoming.previewId)) || '').trim()
    const prevSpeech = String((prev && prev.speech) || '').trim()
    const nextSpeech = String((incoming && incoming.speech) || '').trim()
    const prevAct = String((prev && prev.action) || '').trim()
    const nextAct = String((incoming && incoming.action) || '').trim()
    const prevKind = String((prev && prev.kind) || '').trim()
    const nextKind = String((incoming && incoming.kind) || '').trim()
    const waitingHit = Boolean(
      prev
      && prevRows > 1
      && !prevPid
      && prevAct
      && prevAct !== '现查'
      && (prev.ambiguous || prev.listed),
    )
    const leftoverQuery = Boolean(
      prevAct
      && prevAct !== '现查'
      && nextAct === '现查'
      && incoming
      && incoming.picked !== true
      && (!prevKind || !nextKind || prevKind === nextKind),
    )
    const prevNos = (prev && Array.isArray(prev.rows) ? prev.rows : [])
      .map((row) => String((row && row.no) || '').trim())
      .filter(Boolean)
    const incomingNos = (incoming && Array.isArray(incoming.rows) ? incoming.rows : [])
      .map((row) => String((row && row.no) || '').trim())
      .filter(Boolean)
    const pointsAtPrev = prevNos.some((no) => incomingNos.includes(no) || (no && nextSpeech.includes(no)))
    if (leftoverQuery && (waitingHit || pointsAtPrev)) return true
    if (prev && prev.picked === true && prevPid && incoming && incoming.picked !== true) {
      if (!nextSpeech || (prevSpeech && prevSpeech === nextSpeech)) return true
    }
    if (waitingHit && nextPid && incoming && incoming.picked !== true) return true
    if (prevRows <= 0) return false
    if (nextRows > 0) {
      return isConnectorCatalogDump(incoming) && !nextSpeech
    }
    if (prevSpeech && nextSpeech && prevSpeech === nextSpeech) return true
    if (isConnectorCatalogDump(incoming)) return true
    if (nextAct && nextAct !== '现查' && !nextPid) return true
    return false
  }

  async function draftSessionId(given) {
    const sid = String(given || '').trim()
    const state = await store.get()
    const pending = Object.values(state.requests || {}).find((req) => (
      req && req.kind === 'incoming' && req.replyDraftPending && req.sessionId
    ))
    return (pending && pending.sessionId && String(pending.sessionId)) || sid
  }

  async function previewBiz(spec = {}) {
    if (!opts.gate || typeof opts.gate.preview !== 'function') {
      return { ok: false, error: 'NO_CONNECTOR', hint: '没连业务，不能装成已过账。' }
    }
    const pending = (await store.get()).pendingSheet
    const pickNo = String(spec.no || spec.ticket || '').trim()
    const waiting = pending
      && (pending.ambiguous || pending.listed)
      && !String(pending.preview_id || pending.previewId || '').trim()
    const onHits = waiting && pickNo && (Array.isArray(pending.rows) ? pending.rows : [])
      .some((row) => String((row && row.no) || '') === pickNo)
    let incoming = spec
    if (onHits) {
      const fromChanges = {}
      for (const row of Array.isArray(pending.changes) ? pending.changes : []) {
        if (row && row.field) fromChanges[row.field] = row.to
      }
      const patch = spec.patch && typeof spec.patch === 'object' && Object.keys(spec.patch).length
        ? spec.patch
        : (pending.patch && typeof pending.patch === 'object' && Object.keys(pending.patch).length
          ? pending.patch
          : fromChanges)
      incoming = {
        ...spec,
        picked: true,
        speech: pending.speech || spec.speech,
        patch,
      }
    }
    const preview = await opts.gate.preview(incoming)
    const given = String(spec.sessionId || '').trim()
    const letterSid = await draftSessionId(given)
    const cwd = String(spec.workspace || '').trim()
    const act = String((preview && preview.action) || (preview && preview.sheet && preview.sheet.action) || spec.action || '').trim()
    const missSheet = !!(preview && preview.error === 'NOT_FOUND' && preview.sheet)
    const waitingPick = !!(preview && (
      preview.ambiguous
      || (preview.sheet && (preview.sheet.ambiguous || preview.sheet.listed))
    ) && !String(preview.preview_id || (preview.sheet && (preview.sheet.preview_id || preview.sheet.previewId)) || '').trim())
    if (act === '现查' || missSheet || waitingPick) {
      const sheetSrc = (preview && preview.sheet)
        ? preview.sheet
        : packSheet({ ...preview, clue: spec.no, action: '现查' })
      const sheetSid = given || letterSid
      await store.update((s) => {
        const incoming = {
          ...sheetSrc,
          at: now(),
          sessionId: sheetSid,
          workspace: cwd,
          speech: String((sheetSrc && sheetSrc.speech) || spec.speech || spec.quote || '').trim(),
        }
        if (shouldKeepPopulatedListSheet(s.pendingSheet, incoming)) {
          note(s, `现查空表未覆盖 · ${incoming.kind || ''} ${incoming.no || ''}`, now())
          return
        }
        rememberSheet(s, spec, true)
        s.pendingWrite = null
        s.pendingSheet = incoming
        note(s, preview && preview.ok
          ? `现查进业务页 · ${preview.kind || ''} ${preview.no || ''}`
          : `现查未对上 · ${(preview && preview.hint) || (preview && preview.error) || ''}`, now())
      })
      typeof opts.onPreview === 'function' && (() => { try { opts.onPreview(preview) } catch { /* card refresh is best-effort */ } })()
      const hall = await snapshot(sheetSid)
      return { ...preview, sessionId: sheetSid, workspace: cwd, sheet: (hall && hall.pendingSheet) || preview.sheet }
    }
    const writeIncoming = {
      ...(preview && preview.sheet && typeof preview.sheet === 'object' ? preview.sheet : {}),
      action: act,
      kind: String((preview && (preview.kind || (preview.sheet && preview.sheet.kind))) || spec.kind || ''),
      preview_id: String((preview && (preview.preview_id || (preview.sheet && (preview.sheet.preview_id || preview.sheet.previewId)))) || '').trim(),
      rows: (preview && preview.sheet && Array.isArray(preview.sheet.rows)) ? preview.sheet.rows : [],
      speech: String((preview && preview.sheet && preview.sheet.speech) || spec.speech || spec.quote || '').trim(),
      ...(incoming.picked === true || spec.picked === true ? { picked: true } : {}),
    }
    const hallPrev = (await store.get()).pendingSheet
    if (shouldKeepPopulatedListSheet(hallPrev, writeIncoming)) {
      typeof opts.onPreview === 'function' && (() => { try { opts.onPreview(preview) } catch { /* card refresh is best-effort */ } })()
      const hall = await snapshot(given || letterSid)
      return { ...preview, sessionId: given || letterSid, workspace: cwd, sheet: (hall && hall.pendingSheet) || preview.sheet }
    }
    const namedOpening = String(spec.openingId || spec.trace_id || spec.traceId || '').trim()
    const mergeWindow = spec.merge !== false
    const live = (await store.get()).liveOpening
    const liveOpening = live && live.id
      && (!letterSid || !live.sessionId || live.sessionId === letterSid)
      && (now() - Number(live.at || 0)) < OPENING_TTL_MS
      ? String(live.id)
      : ''
    const line = preview && {
      ...preview,
      sessionId: letterSid || given,
      workspace: cwd,
    }
    let packed = preview
    await store.update((s) => {
      const prev = s.pendingWrite
      const sid = letterSid || given
      const recent = prev && (now() - Number(prev.at || 0)) < OPENING_TTL_MS
      const sameSession = prev && sid && prev.sessionId === sid
      const sameAct = sameWriteAction(prev, line || preview)
      const openingId = namedOpening
        || (sameAct && liveOpening)
        || (mergeWindow && recent && sameSession && sameAct && prev.openingId)
        || `${sid || 'open'}:${now()}:${randomHex(4)}`
      const sameOpening = !!(prev && prev.openingId && prev.openingId === openingId)
      const hadLive = !!(prev && ((prev.lines && prev.lines.length) || prev.preview_id))
      if (!line && !sameOpening) {
        packed = preview
        return
      }
      const replaced = !!(hadLive && !sameOpening)
      const lines = sameOpening ? mergePreviewLines(prev.lines, line) : (line ? [line] : [])
      const speak = speakBundlePreview(lines, { replaced })
      const lead = (line && line.ok !== false && line.preview_id)
        ? line
        : (latestLiveLine(lines) || lines[lines.length - 1] || preview)
      s.pendingWrite = {
        ...lead,
        ok: lines.some((row) => row && row.ok !== false && row.preview_id),
        speak,
        sessionId: letterSid || given,
        workspace: cwd,
        openingId,
        replaced,
        lines,
        at: now(),
      }
      packed = s.pendingWrite
      const sheetSrc = packed && packed.sheet ? packed.sheet : packSheet({ ...packed, clue: spec.no })
      const prevSheet = s.pendingSheet
      const sameKind = prevSheet && String(prevSheet.kind || '') === String(sheetSrc.kind || '')
      const remain = replaced
        ? null
        : (sameKind && Array.isArray(prevSheet.rows) && prevSheet.rows.length > 1
          ? prevSheet.rows
          : (sameKind && Array.isArray(prevSheet.remainRows) ? prevSheet.remainRows : null))
      stashListBeforeWrite(s, prevSheet)
      rememberSheet(s, spec, false)
      s.pendingSheet = {
        ...sheetSrc,
        remainRows: remain,
        at: now(),
        sessionId: letterSid || given,
        workspace: cwd,
      }
      note(s, preview.ok
        ? `预览令牌 · ${preview.kind || ''} ${preview.no || ''} · ${preview.preview_id}`
        : `预览未发令牌 · ${(preview && preview.hint) || preview.error || ''}`, now())
    })
    typeof opts.onPreview === 'function' && (() => { try { opts.onPreview(packed) } catch { /* card refresh is best-effort */ } })()
    return packed
  }

  async function commitWrite(spec = {}) {
    if (!opts.gate || typeof opts.gate.write !== 'function') {
      return { ok: false, error: 'NEED_PREVIEW', hint: '先预览。旧画面不能拿去写。' }
    }
    const state = await store.get()
    const pending = state.pendingWrite || {}
    const lines = Array.isArray(pending.lines) && pending.lines.length
      ? pending.lines
      : (pending.preview_id ? [pending] : [])
    const wanted = String(spec.preview_id || spec.previewId || '').trim()
    if (!wanted) return { ok: false, error: 'NEED_PREVIEW', hint: '先预览。旧画面不能拿去写。' }
    const inBundle = lines.some((row) => String(row.preview_id || '') === wanted)
    const jobs = inBundle && lines.length ? lines : [{ preview_id: wanted }]
    const results = []
    for (const [index, row] of jobs.entries()) {
      if (!row.preview_id) {
        results.push({
          ok: false,
          kind: row.kind,
          no: row.no,
          action: row.action,
          patch: row.patch,
          speak: row.speak || row.hint,
          error: row.error,
        })
        continue
      }
      const written = await opts.gate.write({
        ...spec,
        preview_id: row.preview_id,
        trace_id: spec.trace_id || spec.traceId ? `${spec.trace_id || spec.traceId}:${index}` : '',
      })
      results.push({
        ...written,
        kind: row.kind || written.kind,
        no: row.no || written.no,
        action: row.action,
        patch: row.patch,
        preview_id: row.preview_id,
      })
    }
    const ok = results.some((row) => row && row.ok && !row.failed)
    const failed = results.every((row) => row && (row.failed || row.ok === false))
    const speak = speakBundleReceipt(results)
    const result = {
      ok,
      failed,
      speak,
      kind: failed ? 'compensate' : 'receipt',
      receiptId: results.map((row) => row && row.receiptId).filter(Boolean).join(','),
      preview_id: wanted || (jobs[0] && jobs[0].preview_id) || '',
      lines: results,
    }
    const consumed = results.some((row) => row && (row.error === 'USED' || row.error === 'DUP_TRACE'))
    ;(ok || consumed) && await store.update((s) => {
      if (s.pendingWrite && (s.pendingWrite.openingId === pending.openingId || String(s.pendingWrite.preview_id || '') === wanted)) {
        s.pendingWrite = null
        const sheet = s.pendingSheet
        const writtenKind = String((results.find((row) => row && row.ok && !row.failed) || {}).kind || sheet && sheet.kind || '')
        const writtenNos = new Set(results.filter((row) => row && row.ok && !row.failed).map((row) => String(row.no || '')))
        const pool = (sheet && String(sheet.kind || '') === writtenKind && Array.isArray(sheet.remainRows) && sheet.remainRows.length)
          ? sheet.remainRows
          : ((sheet && String(sheet.kind || '') === writtenKind && Array.isArray(sheet.rows) && sheet.rows.length > 1) ? sheet.rows : [])
        const left = pool.filter((row) => !writtenNos.has(String(row.no || '')))
        s.pendingSheet = left.length
          ? { ...sheet, rows: left, remainRows: left, no: '', canWrite: false, preview_id: '', changes: [] }
          : null
      }
      note(s, ok ? `写口回了 · ${speak}` : `写口拒了 · ${results.map((row) => row && row.error).filter(Boolean).join('、')}`, now())
    })
    failed && !ok && !consumed && await store.update((s) => {
      s.pendingWrite && (s.pendingWrite.openingId === pending.openingId || String(s.pendingWrite.preview_id || '') === wanted)
        && (s.pendingWrite = null)
      note(s, `写口拒了 · ${results.map((row) => row && row.error).filter(Boolean).join('、')} · 表还在`, now())
    })
    ;(ok || failed) && await hearBusinessEvent({
      kind: failed ? 'compensate' : 'receipt',
      no: pending.no || spec.no,
      receiptId: result.receiptId,
      failed,
      speak,
      sessionId: pending.sessionId || spec.sessionId || '',
      workspace: pending.workspace || spec.workspace || '',
    })
    const sid = ok && !failed && String(pending.sessionId || spec.sessionId || '').trim()
    sid && await reopenReplyDraft(sid) && (result.followup = {
      sessionId: sid,
      plugin: PLUGIN,
      workspace: pending.workspace || '',
      text: briefFollowup({
        quote: [result.speak, '库里已改上。回信要用现在的值，不要沿用预览前的旧号。'].filter(Boolean).join('\n'),
        catalog: catalogOf(),
        vocab: await vocabOf(pending.workspace || spec.workspace || ''),
        workspace: pending.workspace || '',
        kind: 'wrote',
      }),
    })
    return result
  }

  async function dismissWrite(spec = {}) {
    const wanted = String((spec && (spec.preview_id || spec.previewId)) || '').trim()
    await store.update((s) => {
      const pending = s.pendingWrite
      const lines = pending && Array.isArray(pending.lines) ? pending.lines : []
      const liveWrite = String((pending && pending.preview_id) || '').trim()
      const liveSheet = String((s.pendingSheet && (s.pendingSheet.preview_id || s.pendingSheet.previewId)) || '').trim()
      const ids = new Set(
        [liveWrite, liveSheet, ...lines.map((row) => String((row && row.preview_id) || '').trim())].filter(Boolean),
      )
      if (wanted && ids.size && !ids.has(wanted)) return
      if (wanted) {
        const kept = lines.filter((row) => String((row && row.preview_id) || '').trim() !== wanted)
        const leftover = latestLiveLine(kept)
        if (leftover) {
          s.pendingWrite = {
            ...pending,
            ...leftover,
            ok: kept.some((row) => row && row.ok !== false && row.preview_id),
            speak: speakBundlePreview(kept),
            sessionId: pending.sessionId,
            workspace: pending.workspace,
            openingId: pending.openingId,
            replaced: false,
            lines: kept,
            at: pending.at,
          }
          const sheetSrc = leftover.sheet ? leftover.sheet : packSheet({ ...leftover, clue: leftover.no })
          s.pendingSheet = {
            ...sheetSrc,
            remainRows: s.pendingSheet && s.pendingSheet.remainRows,
            at: now(),
            sessionId: leftover.sessionId || pending.sessionId || (s.pendingSheet && s.pendingSheet.sessionId) || '',
            workspace: leftover.workspace || pending.workspace || (s.pendingSheet && s.pendingSheet.workspace) || '',
          }
          note(s, '算了。没写。', now())
          return
        }
      }
      s.pendingWrite = null
      if (!wanted || liveSheet === wanted) {
        const saved = s.listBeforeWrite
        const savedRows = saved && Array.isArray(saved.rows) ? saved.rows : []
        const keep = s.pendingSheet
        const remain = keep && Array.isArray(keep.remainRows) ? keep.remainRows : []
        const keepRows = keep && Array.isArray(keep.rows) ? keep.rows : []
        const restored = savedRows.length
          ? saved
          : (remain.length ? { ...keep, rows: remain } : (keepRows.length ? keep : null))
        const restoredRows = restored && Array.isArray(restored.rows) ? restored.rows : []
        s.pendingSheet = restoredRows.length
          ? {
            ...restored,
            rows: restoredRows,
            action: String(restored.action || '现查') === '现查' ? restored.action : '现查',
            preview_id: '',
            previewId: '',
            canWrite: false,
            changes: [],
          }
          : null
        s.listBeforeWrite = null
      }
      note(s, '算了。没写。', now())
    })
    return { ok: true, ...(await snapshot()) }
  }

  async function backSheet() {
    let restored = null
    await store.update((s) => {
      const trail = Array.isArray(s.sheetTrail) ? s.sheetTrail.slice() : []
      if (!trail.length) return
      restored = trail.pop()
      s.sheetTrail = trail
      s.pendingSheet = restored
      s.pendingWrite = null
      note(s, `业务页回到 ${restored && restored.kind || ''}`, now())
    })
    if (!restored) return { ok: false, error: 'NO_BACK', hint: '没有上一页。' }
    return { ok: true, ...(await snapshot()) }
  }

  async function pickSheetRow(spec = {}) {
    const state = await store.get()
    const sheet = state.pendingSheet
    if (!sheet) return { ok: false, error: 'NO_SHEET', hint: '没有打开的业务页。' }
    const no = String(spec.no || '').trim()
    const field = String(spec.field || spec.fieldName || '').trim()
    if (pickingNo) return { ok: false, error: 'BUSY', hint: '正在打开这一行。' }
    const sid = sheet.sessionId || spec.sessionId || ''
    const cwd = sheet.workspace || spec.workspace || ''
    if (sheet.pickField) {
      if (!field) return { ok: false, error: 'NO_FIELD', hint: '先勾一列。' }
      pickingNo = field
      try {
        return await previewBiz({
          kind: sheet.kind,
          no: sheet.no || no,
          action: sheet.action || '改行',
          speech: sheet.speech || spec.speech || '',
          field,
          pendingValue: sheet.pendingValue,
          patch: spec.patch || {},
          sessionId: sid,
          workspace: cwd,
          merge: false,
        })
      } finally {
        pickingNo = ''
      }
    }
    const row = (Array.isArray(sheet.rows) ? sheet.rows : []).find((item) => String(item.no || '') === no)
    if (!row) return { ok: false, error: 'NO_ROW', hint: '先勾表上的一行。' }
    pickingNo = no
    const nextKind = String(sheet.nextKind || spec.nextKind || '').trim()
    const action = String(spec.action || sheet.action || '现查').trim() || '现查'
    const vocab = await vocabOf(cwd)
    const extra = { vocab }
    const hopId = nextKind ? relatedHopId(sheet.kind, nextKind, row.fields, extra) : ''
    const hop = nextKind && hopId && {
      kind: nextKind,
      no: '',
      action: action === '现查' ? '现查' : action,
      speech: sheet.speech || spec.speech || nextKind,
      where: sheet.hopWhere || spec.where,
      patch: spec.patch || {},
      related: {
        kind: sheet.kind,
        no,
        id: hopId,
        field: relatedFilterField(sheet.kind, nextKind, row.fields, extra),
      },
      sessionId: sid,
      workspace: cwd,
      merge: false,
    }
    const viaParent = nextKind && !hopId && {
      kind: sheet.kind, no, action: action === '现查' ? '现查' : action,
      speech: sheet.speech || spec.speech || '', patch: spec.patch || {},
      sessionId: sid, workspace: cwd, merge: false,
    }
    const lookup = !nextKind && action === '现查' && {
      kind: sheet.kind, no, action: '现查', speech: sheet.speech || spec.speech || '', sessionId: sid, workspace: cwd, merge: false,
    }
    const write = {
      kind: sheet.kind, no, action, patch: spec.patch || {}, speech: sheet.speech || spec.speech || '', sessionId: sid, workspace: cwd, merge: false,
    }
    try {
      const result = await previewBiz(hop || viaParent || lookup || write)
      result && result.ok && await rememberFocus(sid, cwd, { kind: sheet.kind, no }, { ok: true, no })
      return result
    } finally {
      pickingNo = ''
    }
  }

  async function fileAskClue(spec = {}) {
    const state = await store.get()
    const sheet = state.pendingSheet
    if (!sheet) return { ok: false, error: 'NO_SHEET', hint: '没有打开的业务页。' }
    const rest = String(spec.rest || sheet.askRest || '').trim()
    if (!rest) return { ok: false, error: 'NO_REF', hint: '没有要记的问句。' }
    return previewBiz({
      kind: sheet.kind,
      no: '',
      action: sheet.action || spec.action || '现查',
      speech: sheet.speech || spec.speech || '',
      patch: sheet.changes
        ? Object.fromEntries((sheet.changes || []).map((row) => [row.field, row.to]))
        : spec.patch,
      sessionId: sheet.sessionId || spec.sessionId || '',
      workspace: sheet.workspace || spec.workspace || '',
      asAsk: true,
      saveAsk: true,
      askRest: rest,
      rest,
    })
  }

  return { previewBiz, commitWrite, dismissWrite, pickSheetRow, backSheet, fileAskClue }
}
