/**
 * Same-origin /lan-assist prefix for this instance's browser.
 * Browser never talks to the LAN port.
 * @module dsh-lan-assist/http
 */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BODY_MAX_BYTES } from './home.js'
import { speakNoSession } from './handoff.js'
import { requestIdOf } from './conversation.js'

function letterId(b) {
  return requestIdOf((b && (b.messageId || b.requestId)) || '')
}

const PREFIX = '/lan-assist'
const VENDOR_DIR = join(dirname(fileURLToPath(import.meta.url)), 'vendor', 'office')
const VENDOR_FILES = {
  'mammoth.browser.min.js': 'text/javascript; charset=utf-8',
  'xlsx.full.min.js': 'text/javascript; charset=utf-8',
  'jszip.min.js': 'text/javascript; charset=utf-8',
}

/**
 * @param {{
 *   secretary: any,
 *   lan: { doors: Function, port: number },
 *   sse: { add: Function, remove: Function },
 *   followup?: (spec: { sessionId: string, text: string, plugin: string }) => Promise<{ ok: boolean, error?: string }>,
 *   translate?: (quote: string) => Promise<{ ok: boolean, lang?: string, out?: string, error?: string, hint?: string }>,
 * }} opts
 */
export function createLocalHandler(opts) {
  const secretary = opts.secretary
  const lan = opts.lan
  const sse = opts.sse
  const followup = opts.followup
  const translate = opts.translate
  const restoreHandoff = opts.restoreHandoff

  return async function handler(req, res) {
    if (!isLocalClient(req)) {
      json(res, 403, { ok: false, error: 'LOCAL_ONLY' })
      return
    }
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const path = url.pathname.slice(PREFIX.length) || '/'
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    if (req.method === 'GET' && path === '/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      })
      res.write(':\n\n')
      sse.add(res)
      req.on('close', () => sse.remove(res))
      return
    }
    try {
      if (req.method === 'GET' && path === '/state') {
        const sessionId = url.searchParams.get('sessionId') || ''
        const view = typeof secretary.hall === 'function'
          ? await secretary.hall(sessionId)
          : await secretary.snapshot(sessionId)
        const dock = await secretary.dock(sessionId)
        const doors = lan && typeof lan.doors === 'function' ? lan.doors() : []
        const ledger = typeof secretary.ledger === 'function'
          ? await secretary.ledger()
          : []
        json(res, 200, { ok: true, ...view, dock, doors, ledger })
        return
      }
      if (req.method === 'GET' && path === '/thread') {
        if (typeof secretary.threadOf !== 'function') {
          json(res, 400, { ok: false, error: 'NO_THREAD' })
          return
        }
        const got = await secretary.threadOf({
          peerId: url.searchParams.get('peerId') || '',
          requestId: requestIdOf(url.searchParams.get('messageId') || url.searchParams.get('requestId') || ''),
          groupId: url.searchParams.get('groupId') || '',
        })
        json(res, got && got.ok === false ? 400 : 200, got)
        return
      }
      if (req.method === 'GET' && path === '/catalog') {
        if (typeof secretary.describeBiz !== 'function') {
          json(res, 400, { ok: false, error: 'NO_CATALOG' })
          return
        }
        const got = await secretary.describeBiz({
          workspace: url.searchParams.get('workspace') || '',
          kind: url.searchParams.get('kind') || '',
        })
        json(res, got && got.ok === false ? 400 : 200, got)
        return
      }
      if (req.method === 'GET' && path === '/traces') {
        if (typeof secretary.openTrace !== 'function') {
          json(res, 400, { ok: false, error: 'NO_TRACE' })
          return
        }
        const got = await secretary.openTrace({
          workspace: url.searchParams.get('workspace') || '',
          id: url.searchParams.get('id') || '',
          no: url.searchParams.get('no') || '',
        })
        json(res, got && got.ok === false ? 400 : 200, got)
        return
      }
      if (req.method === 'GET' && path === '/handoff') {
        if (typeof secretary.readHandoff !== 'function') {
          json(res, 400, { ok: false, error: 'NO_HANDOFF' })
          return
        }
        const got = await secretary.readHandoff(url.searchParams.get('requestId') || '')
        json(res, got && got.ok === false ? 400 : 200, got)
        return
      }
      if (req.method === 'GET' && path === '/attach') {
        if (typeof secretary.getAttachment !== 'function') {
          json(res, 400, { ok: false, error: 'NO_FILE' })
          return
        }
        const got = await secretary.getAttachment(url.searchParams.get('requestId') || '', url.searchParams.get('index'))
        json(res, got && got.ok === false ? 400 : 200, got)
        return
      }
      if (req.method === 'GET' && path.startsWith('/vendor/')) {
        await serveVendor(path.slice('/vendor/'.length), res)
        return
      }
      if (req.method !== 'POST') {
        json(res, 405, { ok: false, error: 'METHOD' })
        return
      }
      const body = await readJson(req)
      const result = await dispatch(secretary, path, body, followup, { translate, restoreHandoff })
      if (!QUIET_POST[path]) sse.emit('mailbox', { type: path.slice(1) || 'post' })
      json(res, result && result.ok === false ? 400 : 200, result)
    } catch (error) {
      json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }
}

/**
 * @param {any} secretary
 * @param {string} path
 * @param {Record<string, unknown>} body
 */
export async function dispatch(secretary, path, body, followup, extra) {
  const b = body || {}
  const translate = extra && extra.translate
  const restoreHandoff = extra && extra.restoreHandoff
  switch (path) {
    case '/name':
      return secretary.setDisplayName(b.name, b.avatar)
    case '/shout':
      return typeof secretary.shout === 'function' ? secretary.shout() : { ok: false, error: 'NO_SHOUT' }
    case '/note':
      return secretary.setPeerNote(b.peerId, b.note)
    case '/peer/flags':
      return typeof secretary.setPeerFlags === 'function'
        ? secretary.setPeerFlags(b.peerId, b)
        : { ok: false, error: 'NO_FLAGS' }
    case '/door':
      return secretary.setPeerDoor(b.peerId, b.door)
    case '/pair/mint':
      return secretary.mintPairCode()
    case '/relay/invite':
      return typeof secretary.mintRelayInvite === 'function'
        ? secretary.mintRelayInvite()
        : { ok: false, error: 'NO_RELAY' }
    case '/relay/revoke':
      return typeof secretary.revokeRelayInvite === 'function'
        ? secretary.revokeRelayInvite(b.session)
        : { ok: false, error: 'NO_INVITE' }
    case '/relay/config':
      return typeof secretary.setRelayConfig === 'function'
        ? secretary.setRelayConfig(b)
        : { ok: false, error: 'NO_RELAY' }
    case '/traces/ingest':
      return typeof secretary.ingestLedger === 'function'
        ? secretary.ingestLedger(b)
        : { ok: false, error: 'NO_TRACE' }
    case '/catalog/publish':
      return typeof secretary.publishBiz === 'function'
        ? secretary.publishBiz(b)
        : { ok: false, error: 'NO_SEMANTIC' }
    case '/pair/handshake':
      return secretary.handshake({
        peerCode: b.peerCode,
        door: b.door,
        peerName: b.peerName,
        session: b.session,
        device: b.device,
      })
    case '/pair/accept':
      return typeof secretary.acceptPairAsk === 'function'
        ? secretary.acceptPairAsk()
        : { ok: false, error: 'NO_ASK', hint: '还没有待确定的配对请求。' }
    case '/pair/reject':
      return typeof secretary.rejectPairAsk === 'function'
        ? secretary.rejectPairAsk()
        : { ok: false, error: 'NO_ASK' }
    case '/unpair':
      return secretary.unpair(b.peerId)
    case '/group/create':
      return typeof secretary.createGroup === 'function'
        ? secretary.createGroup(b)
        : { ok: false, error: 'NO_GROUP' }
    case '/group/update':
      return typeof secretary.updateGroup === 'function'
        ? secretary.updateGroup(b)
        : { ok: false, error: 'NO_GROUP' }
    case '/group/dissolve':
      return typeof secretary.dissolveGroup === 'function'
        ? secretary.dissolveGroup(b.groupId)
        : { ok: false, error: 'NO_GROUP' }
    case '/compose':
      return secretary.compose(b)
    case '/handoff/pack':
      return typeof secretary.packSession === 'function'
        ? secretary.packSession(b.sessionId)
        : { ok: false, error: 'NO_SESSION', hint: speakNoSession() }
    case '/handoff/file':
      return typeof secretary.pickFile === 'function'
        ? secretary.pickFile(b.sessionId, b.path)
        : { ok: false, error: 'NO_SESSION', hint: speakNoSession() }
    case '/workspace/save':
      return typeof secretary.saveWorkspaceFile === 'function'
        ? secretary.saveWorkspaceFile(b)
        : { ok: false, error: 'NO_CWD' }
    case '/workspace/univer':
      return typeof secretary.openUniver === 'function'
        ? secretary.openUniver(b)
        : { ok: false, error: 'NO_UNIVER', hint: '没装 dsh-univer-office。' }
    case '/handoff/continue': {
      if (typeof secretary.continueHandoff !== 'function') {
        return { ok: false, error: 'NO_HANDOFF' }
      }
      let sid = String(b.sessionId || '').trim()
      if (!sid && typeof restoreHandoff === 'function') {
        const preview = typeof secretary.readHandoff === 'function'
          ? await secretary.readHandoff(letterId(b))
          : null
        if (!preview || !preview.ok) {
          return preview || { ok: false, error: 'NO_HANDOFF' }
        }
        if (preview.adopted) {
          return { ok: false, error: 'ALREADY_ADOPTED', hint: '已经调度进会话。点过头不是过账。' }
        }
        const restored = await restoreHandoff({
          pack: preview.pack,
          cwd: b.workspace,
          fromSessionId: b.fromSessionId,
        })
        if (!restored || !restored.ok || !restored.sessionId) {
          return restored && restored.ok === false
            ? restored
            : { ok: false, error: 'NO_SESSION', hint: '没开成新会话。' }
        }
        sid = restored.sessionId
      }
      const result = await secretary.continueHandoff({
        requestId: letterId(b),
        sessionId: sid,
        workspace: b.workspace,
      })
      if (result && result.ok) result.sessionId = sid
      return result
    }
    case '/translate': {
      if (typeof translate !== 'function') {
        return { ok: false, error: 'NO_LLM', hint: '本机没有模型，不能译。' }
      }
      return translate(String(b.quote || b.text || ''))
    }
    case '/ask-local': {
      if (typeof secretary.askLocal !== 'function') {
        return { ok: false, error: 'NO_ASK', hint: '这版还不能问本机。' }
      }
      const asked = await secretary.askLocal(b)
      if (asked && asked.ok && asked.followup) {
        if (!asked.followup.sessionId) {
          return { ok: false, error: 'NO_SESSION', hint: '这条对话还没绑上，不能问本机。' }
        }
        if (typeof followup === 'function') {
          const followed = await followup(asked.followup)
          asked.followed = !!(followed && followed.ok)
          asked.followError = (followed && followed.error) || ''
          if (!asked.followed) {
            return { ok: false, error: asked.followError || 'NO_FOLLOWUP', hint: '本机会话没接上，没有问成。' }
          }
        } else {
          return { ok: false, error: 'NO_FOLLOWUP', hint: '本机会话没接上，没有问成。' }
        }
      }
      return asked
    }
    case '/staff':
      return secretary.bindStaff(b.peerId, b.staffId)
    case '/biz/hold':
      return secretary.holdBusinessEvent(b.eventId || b.requestId)
    case '/precedent':
      return secretary.suggestPrecedent(b.sessionId, b.scenario || b.excerpt, b.workspace)
    case '/send':
      return secretary.confirmSend(letterId(b))
    case '/preview':
      if (b.kind || b.no || b.action) {
        return typeof secretary.previewBiz === 'function'
          ? secretary.previewBiz(b)
          : { ok: false, error: 'NO_CONNECTOR', hint: '没连业务，不能装成已过账。' }
      }
      return secretary.previewWrite(letterId(b))
    case '/write': {
      if (typeof secretary.commitWrite !== 'function') {
        return { ok: false, error: 'NEED_PREVIEW', hint: '先预览。旧画面不能拿去写。' }
      }
      const written = await secretary.commitWrite(b)
      if (written && written.ok && written.followup && typeof followup === 'function' && written.followup.sessionId) {
        const followed = await followup(written.followup)
        written.followed = !!followed.ok
        written.followError = followed.error || ''
      }
      return written
    }
    case '/write/cancel':
      return typeof secretary.dismissWrite === 'function'
        ? secretary.dismissWrite(b)
        : { ok: true }
    case '/sheet/pick':
      return typeof secretary.pickSheetRow === 'function'
        ? secretary.pickSheetRow(b)
        : { ok: false, error: 'NO_SHEET' }
    case '/sheet/back':
      return typeof secretary.backSheet === 'function'
        ? secretary.backSheet()
        : { ok: false, error: 'NO_BACK' }
    case '/sheet/ask':
      return typeof secretary.fileAskClue === 'function'
        ? secretary.fileAskClue(b)
        : { ok: false, error: 'NO_SHEET' }
    case '/seat':
      return secretary.switchSeat(b.staffId, b.displayName)
    case '/lookup/config':
      return secretary.setLookup(b)
    case '/see':
      return secretary.seeAttachment(letterId(b))
    case '/attach/copy':
      return typeof secretary.copyAttachment === 'function'
        ? secretary.copyAttachment(b)
        : { ok: false, error: 'NO_FILE' }
    case '/presend/cancel':
      return secretary.cancelPresend(letterId(b))
    case '/hold':
      return secretary.hold(letterId(b))
    case '/advise':
      return secretary.considerAdvice({
        sessionId: b.sessionId,
        scenario: b.scenario,
        requestId: letterId(b),
      })
    case '/advise/dismiss':
      return secretary.dismissAdvice()
    case '/advise/confirm':
      return secretary.confirmAdvice()
    case '/nudge/confirm':
      return secretary.confirmNudge()
    case '/nudge/add':
      return typeof secretary.addNudge === 'function'
        ? secretary.addNudge(b)
        : secretary.confirmNudge()
    case '/nudge/dismiss':
      return secretary.dismissNudgeAsk()
    case '/nudge/hold':
      return secretary.holdNudge(b.nudgeId || b.requestId)
    case '/nudge/forget':
      return secretary.forgetNudge(b.nudgeId || b.requestId)
    case '/adopt': {
      const result = await secretary.adopt(letterId(b), b.replyIds)
      if (result.ok && result.followup) {
        if (!result.followup.sessionId) {
          result.followed = false
          result.followError = 'NO_SESSION'
        } else if (typeof followup === 'function') {
          const followed = await followup(result.followup)
          result.followed = !!followed.ok
          result.followError = followed.error || ''
        } else {
          result.followed = false
          result.followError = 'NO_FOLLOWUP'
        }
      }
      return result
    }
    case '/reply':
      return secretary.reply(b)
    case '/reply/draft': {
      const drafted = await secretary.draftReply(letterId(b), b.sessionId, b.workspace)
      if (drafted.ok && drafted.followup && typeof followup === 'function') {
        if (!drafted.followup.sessionId) {
          return { ok: false, error: 'NO_SESSION', hint: '这条对话还没绑上，不能用当前模型拟回。' }
        }
        const followed = await followup(drafted.followup)
        if (!followed || !followed.ok) {
          return { ok: false, error: followed && followed.error ? followed.error : 'NO_FOLLOWUP' }
        }
        return { ...drafted, followed: true, draft: '', via: 'session' }
      }
      return drafted
    }
    case '/read':
      return secretary.markRead(letterId(b), b.sessionId)
    case '/withdraw':
      return secretary.withdraw(letterId(b), b.peerId)
    case '/nod':
      return secretary.nod(letterId(b), b.peerId)
    case '/cosign':
      return secretary.setCosign(letterId(b), b.on)
    case '/chase':
      return secretary.chase(letterId(b))
    case '/retry':
      return typeof secretary.retrySend === 'function'
        ? secretary.retrySend(letterId(b))
        : secretary.chase(letterId(b))
    case '/brief':
      return secretary.setBriefOff(b.off)
    case '/listen':
      return secretary.grantListen(b.on)
    case '/sleep':
      return secretary.setAsleep(b.on)
    case '/export':
      return secretary.exportLedger()
    default:
      return { ok: false, error: 'NOT_FOUND' }
  }
}

export async function serveVendor(name, res) {
  const type = VENDOR_FILES[String(name || '')]
  if (!type) {
    json(res, 404, { ok: false, error: 'NO_VENDOR' })
    return { ok: false, error: 'NO_VENDOR' }
  }
  try {
    const buf = await readFile(join(VENDOR_DIR, name))
    res.writeHead(200, {
      'content-type': type,
      'content-length': buf.length,
      'cache-control': 'public, max-age=31536000, immutable',
    })
    res.end(buf)
    return { ok: true, bytes: buf.length, name }
  } catch {
    json(res, 404, { ok: false, error: 'NO_VENDOR' })
    return { ok: false, error: 'NO_VENDOR' }
  }
}

const QUIET_POST = {
  '/sleep': true,
  '/export': true,
  '/precedent': true,
  '/ask-local': true,
  '/translate': true,
  '/handoff/pack': true,
  '/handoff/file': true,
  '/attach/copy': true,
  '/workspace/save': true,
  '/workspace/univer': true,
  '/relay/invite': true,
  '/relay/revoke': true,
  '/relay/config': true,
  '/catalog/publish': true,
  '/traces/ingest': true,
}

export function isLocalClient(req) {
  const remote = String((req && req.socket && req.socket.remoteAddress) || '').replace(/^::ffff:/, '')
  if (remote && remote !== '127.0.0.1' && remote !== '::1') return false
  const host = String((req && req.headers && req.headers.host) || '').split(':')[0].toLowerCase()
  if (host && host !== '127.0.0.1' && host !== 'localhost' && host !== '[::1]' && host !== '::1') return false
  const origin = String((req && req.headers && req.headers.origin) || '')
  if (origin) {
    try {
      const name = new URL(origin).hostname
      if (name !== '127.0.0.1' && name !== 'localhost' && name !== '[::1]') return false
    } catch {
      return false
    }
  }
  return true
}

function json(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

function readJson(req, maxBytes = BODY_MAX_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let n = 0
    req.on('data', (chunk) => {
      n += chunk.length
      if (n > maxBytes) {
        reject(new Error('TOO_LARGE'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!chunks.length) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

export function createSseHub() {
  /** @type {Set<import('node:http').ServerResponse>} */
  const clients = new Set()
  return {
    add(res) { clients.add(res) },
    remove(res) { clients.delete(res) },
    emit(event, data) {
      const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
      for (const res of clients) {
        try { res.write(line) } catch { clients.delete(res) }
      }
    },
    close() {
      for (const res of clients) {
        try { res.end() } catch { /* ignore */ }
      }
      clients.clear()
    },
  }
}
