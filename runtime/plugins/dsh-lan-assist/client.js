window.__ModuleLoader__.load({
  id: 'dsh-lan-assist',
  factory: (require) => {
    const React = require('react')
    const { useEffect, useState, useRef } = React
    const h = React.createElement
    let createPortal = null
    try {
      const rd = require('react-dom')
      createPortal = rd && rd.createPortal
    } catch { /* overlay still renders in place */ }

    const PREFIX = '/lan-assist'
    const WITHDRAW_GRACE_MS = 2 * 60 * 1000
    const HANDOFF_MIME = 'application/vnd.dsh.handoff+json'
    const HANDOFF_NAME = 'dsh-handoff.json'
    let sessionsApi = null

    async function api(path, opts) {
      const ac = typeof AbortController !== 'undefined' ? new AbortController() : null
      const timer = ac && setTimeout(() => ac.abort(), 60_000)
      try {
        const res = await fetch(PREFIX + path, ac ? Object.assign({}, opts, { signal: ac.signal }) : opts)
        const text = await res.text()
        try { return JSON.parse(text) } catch { return { ok: false, error: text || res.status } }
      } catch (error) {
        return { ok: false, error: (error && error.name === 'AbortError' && 'TIMEOUT') || 'UNREACHABLE' }
      } finally {
        timer && clearTimeout(timer)
      }
    }
    function get(path) { return api(path) }
    function post(path, body) {
      return api(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {}),
      })
    }

    function useSleepWatch() {
      useEffect(() => {
        function sync() {
          post('/sleep', { on: typeof document !== 'undefined' && document.hidden })
        }
        if (typeof document === 'undefined') return
        document.addEventListener('visibilitychange', sync)
        return () => document.removeEventListener('visibilitychange', sync)
      }, [])
    }

    let noticedInbox = null
    let noticedUnread = null
    let lastNoticeAt = 0
    let noticeCtx = null
    let pendingNotice = false
    let noticeHooked = false

    function canHear() {
      if (typeof document !== 'undefined' && document.hidden) return false
      return !!(noticeCtx && noticeCtx.state === 'running')
    }

    function unlockNotice() {
      if (typeof document === 'undefined') return
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      if (!noticeCtx) noticeCtx = new Ctx()
      if (noticeCtx.state === 'suspended') {
        noticeCtx.resume().then(() => { if (pendingNotice) playNotice() }).catch(() => undefined)
      }
    }

    function playNotice() {
      const now = Date.now()
      if (now - lastNoticeAt < 1600) return
      try {
        unlockNotice()
        if (!canHear()) {
          pendingNotice = true
          return
        }
        lastNoticeAt = now
        pendingNotice = false
        const t = noticeCtx.currentTime
        const osc = noticeCtx.createOscillator()
        const gain = noticeCtx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, t)
        osc.frequency.setValueAtTime(1175, t + 0.07)
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(0.05, t + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
        osc.connect(gain)
        gain.connect(noticeCtx.destination)
        osc.start(t)
        osc.stop(t + 0.24)
      } catch { /* autoplay or missing audio must not blank the shell */ }
    }

    function hookNoticeUnlock() {
      if (noticeHooked || typeof document === 'undefined') return
      noticeHooked = true
      function arm() {
        unlockNotice()
        if (pendingNotice) playNotice()
      }
      document.addEventListener('pointerdown', arm)
      document.addEventListener('keydown', arm)
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && pendingNotice) playNotice()
      })
    }

    let noticedAsk = ''
    function noticePairAsk(ask) {
      const id = ask && String(ask.from || '').trim()
      if (!id) {
        noticedAsk = ''
        return
      }
      if (noticedAsk === id) return
      noticedAsk = id
      playNotice()
      typeof openChatHook === 'function' && openChatHook()
    }
    function noticeInbox(inbox) {
      const ids = (Array.isArray(inbox) ? inbox : [])
        .map((item) => String((item && item.id) || '').trim())
        .filter(Boolean)
      if (!noticedInbox) {
        noticedInbox = {}
        ids.forEach((id) => { noticedInbox[id] = true })
        return
      }
      const fresh = ids.some((id) => !noticedInbox[id])
      noticedInbox = {}
      ids.forEach((id) => { noticedInbox[id] = true })
      if (fresh) playNotice()
    }
    function noticeUnread(state, selfId) {
      const muted = {}
      ;((state && state.peers) || []).forEach((p) => { p && p.mute && p.id && (muted[p.id] = true) })
      const keys = ((state && state.requests) || []).filter((req) => unreadWeight(req, selfId) > 0).map((req) => {
        const who = req.kind === 'incoming' ? req.from : ((req.to || [])[0] || '')
        return muted[who] ? '' : (req.id + ':' + (req.last || '') + ':' + req.replies)
      }).filter(Boolean)
      if (!noticedUnread) {
        noticedUnread = {}
        keys.forEach((id) => { noticedUnread[id] = true })
        return
      }
      const fresh = keys.some((id) => !noticedUnread[id])
      noticedUnread = {}
      keys.forEach((id) => { noticedUnread[id] = true })
      if (fresh) playNotice()
    }

    const mailboxSubs = new Set()
    let mailboxEs = null
    let mailboxTimer = null
    let mailboxEsRetry = null
    let mailboxBusy = false
    let mailboxQueued = false
    let mailboxSnap = null
    let mailboxErr = ''
    let mailboxStamp = ''
    let mailboxStarted = false
    let mailboxLive = false

    function listOf(value) {
      return Array.isArray(value) ? value : []
    }
    function hallStamp(snap) {
      try {
        const row = snap || {}
        const reqs = listOf(row.requests).map((r) => (r && r.id) + ':' + (r && r.updatedAt) + ':' + (r && r.last) + ':' + (r && r.unread) + ':' + (r && r.status)).join('|')
        const peers = listOf(row.peers).map((p) => (p && p.id) + ':' + (p && p.online ? 1 : 0) + ':' + (p && p.unpaired ? 1 : 0)).join('|')
        const inbox = listOf(row.inbox).map((item) => item && item.id).join('|')
        const dock = row.dock ? String(row.dock.mode || '') + ':' + String(row.dock.requestId || '') + ':' + String(row.dock.workspace || '') : ''
        const pair = row.pairCode
          ? String(row.pairCode.code || '') + ':' + (row.pairCode.expired ? 'x' : Math.ceil(Number(row.pairCode.remainMs || 0) / 60000))
          : ''
        const ask = row.pairAsk ? String(row.pairAsk.from || '') + ':' + (row.pairAsk.ready ? 1 : 0) : ''
        const wait = row.pairWait ? String(row.pairWait.id || '') : ''
        const pending = row.pendingSheet
        const sheet = pending
          ? [
            pending.kind || '',
            pending.action || '',
            pending.no || '',
            pending.nextKind || '',
            pending.preview_id || '',
            pending.askRest || '',
            pending.canBack ? '1' : '0',
            String(pending.at || ''),
            listOf(pending.rows).map((item) => item && item.no).join(','),
          ].join(':')
          : ''
        const write = row.pendingWrite
          ? String((row.pendingWrite.preview_id || '') + ':' + (row.pendingWrite.speak || ''))
          : ''
        const lookups = listOf(row.lookups).map((item) => (item && item.id) + ':' + (item && item.configured ? 1 : 0) + ':' + (item && item.hasToken ? 1 : 0)).join('|')
        const ledger = listOf(row.ledger).slice(-8).map((item) => (item && item.at) + ':' + (item && item.text)).join('|')
        return snap ? [reqs, peers, inbox, dock, row.pendingCount, row.briefOff, row.listenGranted, row.relayConfigured ? 1 : 0, row.relayConnected ? 1 : 0, row.relayUrl || '', row.relayCredsSet ? 1 : 0, listOf(row.nudges).length, pair, ask, wait, sheet, write, lookups, ledger].join('/') : ''
      } catch {
        return snap ? 'stamp-err' : ''
      }
    }

    async function pullMailbox() {
      if (mailboxBusy) {
        mailboxQueued = true
        return
      }
      mailboxBusy = true
      try {
        do {
          mailboxQueued = false
          let sid = ''
          let global = false
          mailboxSubs.forEach((sub) => {
            if (!sub.sid) global = true
            else sid = sub.sid
          })
          if (global) sid = ''
          const q = sid ? `?sessionId=${encodeURIComponent(sid)}` : ''
          const next = await get('/state' + q)
          const ok = next && next.ok !== false
          mailboxSnap = ok ? next : mailboxSnap
          mailboxErr = ok ? '' : ((next && next.error) || 'UNREACHABLE')
          ok && noticeInbox(next.inbox)
          ok && noticeUnread(next, next.self && next.self.id)
          ok && noticePairAsk(next.pairAsk)
          const stamp = ok ? hallStamp(next) : mailboxStamp
          const same = ok && stamp === mailboxStamp
          mailboxStamp = ok ? stamp : mailboxStamp
          same || mailboxSubs.forEach((sub) => sub.poke())
        } while (mailboxQueued)
      } finally {
        mailboxBusy = false
      }
    }

    function startPoll() {
      if (mailboxTimer) return
      mailboxTimer = setInterval(() => { pullMailbox() }, 8000)
    }

    function stopPoll() {
      if (!mailboxTimer) return
      clearInterval(mailboxTimer)
      mailboxTimer = null
    }

    function startMailbox() {
      if (mailboxStarted) return
      mailboxStarted = true
      pullMailbox()
      attachMailboxEs()
      if (!mailboxLive) startPoll()
      hookNoticeUnlock()
    }

    function attachMailboxEs() {
      if (mailboxEs || typeof EventSource === 'undefined') return
      try {
        mailboxEs = new EventSource(PREFIX + '/events')
      } catch {
        mailboxEs = null
        mailboxLive = false
        startPoll()
        scheduleMailboxEs()
        return
      }
      mailboxEs.onopen = () => {
        mailboxLive = true
        stopPoll()
      }
      mailboxEs.addEventListener('mailbox', () => { pullMailbox() })
      mailboxEs.onerror = () => {
        mailboxLive = false
        if (mailboxEs) {
          try { mailboxEs.close() } catch { /* ignore */ }
          mailboxEs = null
        }
        startPoll()
        scheduleMailboxEs()
      }
    }

    function scheduleMailboxEs() {
      if (mailboxEsRetry || !mailboxSubs.size) return
      mailboxEsRetry = setTimeout(() => {
        mailboxEsRetry = null
        if (mailboxSubs.size) attachMailboxEs()
      }, 2000)
    }

    function stopMailbox() {
      mailboxStarted = false
      mailboxLive = false
      if (mailboxEs) {
        mailboxEs.onerror = null
        mailboxEs.onopen = null
        mailboxEs.close()
        mailboxEs = null
      }
      stopPoll()
      if (mailboxEsRetry) {
        clearTimeout(mailboxEsRetry)
        mailboxEsRetry = null
      }
    }

    function useMailbox(sessionId, slice) {
      const [view, setView] = useState(() => slice ? slice(mailboxSnap) : mailboxSnap)
      const sliceRef = useRef(slice)
      sliceRef.current = slice
      useEffect(() => {
        const sub = {
          sid: sessionId || '',
          poke: () => {
            try {
              const next = sliceRef.current ? sliceRef.current(mailboxSnap) : mailboxSnap
              setView((prev) => {
                try {
                  return hallStamp(prev) === hallStamp(next) ? prev : next
                } catch {
                  return next
                }
              })
            } catch { /* keep the current face */ }
          },
        }
        mailboxSubs.add(sub)
        startMailbox()
        sub.poke()
        return () => {
          mailboxSubs.delete(sub)
          mailboxSubs.size || stopMailbox()
        }
      }, [sessionId])
      return { state: view, err: mailboxErr, refresh: pullMailbox }
    }

    function pill(text, kind) {
      return h('span', { className: 'dla-pill' + (kind ? ' ' + kind : '') }, text)
    }

    function btn(label, onClick, kind, disabled) {
      const k = kind === 'primary' ? ' dla-btn-primary' : kind === 'danger' ? ' dla-btn-danger' : ' dla-btn-ghost'
      return h('button', { type: 'button', className: 'dla-btn' + k, onClick, disabled: !!disabled }, label)
    }

    function avatar(name) {
      const ch = String(name || '?').slice(0, 1)
      return h('div', { className: 'dla-avatar' }, ch)
    }

    function workspaceOf(session) {
      if (!session) return ''
      const header = session.header || session.session && session.session.header
      const cwd = (header && header.cwd)
        || session.cwd
        || session.workspace
        || (session.meta && session.meta.cwd)
        || (session.project && (session.project.path || session.project.cwd))
        || ''
      return String(cwd || '').trim()
    }

    function liveSessionWorkspace() {
      try {
        const api = sessionsApi
        if (!api) return ''
        const cur = api.current || api.active || api.selected
        const session = typeof cur === 'function' ? cur() : cur
        return workspaceOf(session)
      } catch { return '' }
    }

    function inWorkbenchShell() {
      try {
        if (typeof document !== 'undefined' && document.documentElement.getAttribute('data-fdex') === '1') return true
        return typeof navigator !== 'undefined' && /Electron/i.test(String(navigator.userAgent || ''))
      } catch { return false }
    }

    function folderOf(cwd) {
      const s = String(cwd || '').replace(/[\\/]+$/, '')
      if (!s) return ''
      const parts = s.split(/[\\/]/).filter(Boolean)
      return parts[parts.length - 1] || s
    }

    let openChatHook = null

    function peerNameOf(state, id) {
      const p = ((state && state.peers) || []).find((row) => row.id === id)
      return (p && (p.note || p.displayName)) || String(id || '').slice(0, 8)
    }

    function letterGoneFor(req, peerId) {
      if (!req) return false
      if (req.status === 'withdrawn') return true
      const gone = Array.isArray(req.withdrawn) ? req.withdrawn : []
      return !!(req.kind === 'outgoing' && peerId && gone.indexOf(peerId) >= 0)
    }
    function isDirectChat(req) {
      return !!(req && !req.topic && !req.groupId)
    }
    function isHandoffFile(item) {
      if (!item) return false
      if (String(item.mime || '') === HANDOFF_MIME) return true
      return String(item.name || '') === HANDOFF_NAME
    }
    function sizeLabel(n) {
      const x = Number(n) || 0
      if (x < 1024) return x + 'B'
      if (x < 1024 * 1024) return Math.round(x / 1024) + 'KB'
      return (x / (1024 * 1024)).toFixed(1).replace(/\.0$/, '') + 'MB'
    }
    function groupPicks(picks) {
      const bags = {}
      ;(picks || []).forEach((row) => {
        const path = String((row && row.path) || '').replace(/\\/g, '/')
        if (!path) return
        const cut = path.lastIndexOf('/')
        const dir = cut < 0 ? '' : path.slice(0, cut)
        if (!bags[dir]) bags[dir] = []
        bags[dir].push({
          path: path,
          name: String((row && row.name) || (cut < 0 ? path : path.slice(cut + 1))),
          size: Number((row && row.size) || 0),
        })
      })
      return Object.keys(bags).sort((a, b) => {
        if (!a) return -1
        if (!b) return 1
        return a < b ? -1 : a > b ? 1 : 0
      }).map((dir) => ({
        dir: dir,
        rows: bags[dir].slice().sort((a, b) => String(a.name).localeCompare(String(b.name))),
      }))
    }
    function filesOf(req) {
      return ((req && req.attachments) || []).map((item, fi) => ({
        name: (item && item.name) || '附件',
        index: fi,
        requestId: req.id,
        mime: item && item.mime,
        hasData: !!(item && item.hasData),
        handoff: isHandoffFile(item),
      }))
    }
    function lettersWithPeer(state, peerId, selfId) {
      return ((state && state.requests) || []).filter((req) => {
        if (!req || req.status === 'closed' || !isDirectChat(req)) return false
        const mine = req.from === selfId
        const theirs = req.from === peerId
        const toThem = (req.to || []).indexOf(peerId) >= 0
        return theirs || (mine && toThem)
      })
    }

    function threadForPeer(state, peerId, selfId) {
      const rows = []
      lettersWithPeer(state, peerId, selfId).forEach((req) => {
        const theyWithdrew = req.status === 'withdrawn'
        const weWithdrew = letterGoneFor(req, peerId) && req.kind === 'outgoing'
        theyWithdrew && rows.push({
          id: req.id + ':gone',
          from: 'sys',
          text: '对方撤回了一条消息',
          at: req.updatedAt,
        })
        weWithdrew && rows.push({
          id: req.id + ':gone',
          from: 'sys',
          text: '你撤回了一条消息',
          at: req.updatedAt,
        })
        const unread = !(req.reads && req.reads[peerId])
        const canWithdrawAt = (at) => req.status !== 'failed' && req.status !== 'withdrawn' && (unread || Date.now() - (at || 0) <= WITHDRAW_GRACE_MS)
        const vers = Array.isArray(req.versions) ? req.versions : []
        !theyWithdrew && !weWithdrew && !vers.length && req.excerpt && rows.push({
          id: req.id + ':ex',
          requestId: req.id,
          from: req.from === selfId ? 'me' : 'them',
          text: req.excerpt,
          at: req.createdAt,
          files: filesOf(req).filter((f) => f && !f.handoff),
          handoff: !!(req.handoff || (req.attachments || []).some(isHandoffFile)),
          adopted: !!req.adopted,
          withdrawable: req.from === selfId && canWithdrawAt(req.createdAt),
        })
        vers.forEach((v, vi, all) => {
          if (theyWithdrew && v.from !== selfId) return
          if (weWithdrew && v.from === selfId) return
          rows.push({
            id: req.id + ':' + v.n,
            requestId: req.id,
            from: v.from === selfId ? 'me' : 'them',
            text: v.body || req.excerpt || '',
            at: v.at || req.createdAt,
            failed: req.status === 'failed',
            pending: req.status === 'presend',
            files: vi === all.length - 1 ? filesOf(req).filter((f) => f && !f.handoff) : [],
            handoff: !!(req.handoff || (req.attachments || []).some(isHandoffFile)),
            adopted: !!req.adopted,
            withdrawable: v.from === selfId && canWithdrawAt(v.at || req.createdAt),
          })
        })
        !theyWithdrew && (Array.isArray(req.replies) ? req.replies : []).forEach((rep, i) => {
          const from = rep.from === selfId ? 'me' : 'them'
          const text = rep.body || ''
          const dup = rows.some((row) => row.from === from && row.text === text && Math.abs((row.at || 0) - (rep.at || 0)) < 5000)
          dup || rows.push({
            id: req.id + ':r' + i,
            requestId: req.id,
            from,
            text,
            at: rep.at,
            files: (rep.attachments || []).map((item, fi) => ({
              name: item && item.name,
              index: fi,
              requestId: req.id,
              mime: item && item.mime,
              hasData: !!(item && item.hasData),
            })).filter((item) => item && (item.name = item.name || '附件')),
            withdrawable: from === 'me' && canWithdrawAt(rep.at),
          })
        })
      })
      rows.sort((a, b) => (a.at || 0) - (b.at || 0))
      return rows
    }
    function clockOf(at) {
      if (!at) return ''
      const d = new Date(Number(at))
      if (Number.isNaN(d.getTime())) return ''
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
    }
    function dayClock(at) {
      if (!at) return ''
      const d = new Date(Number(at))
      if (Number.isNaN(d.getTime())) return ''
      const now = new Date()
      const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      const day = d.toDateString() === now.toDateString()
        ? '今天'
        : d.toDateString() === yest.toDateString()
          ? '昨天'
          : (d.getMonth() + 1) + '/' + d.getDate()
      return day + ' ' + clockOf(at)
    }
    function lastLineOf(state, peerId, selfId) {
      const letters = lettersWithPeer(state, peerId, selfId).slice().sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0))
      const last = letters[letters.length - 1]
      const line = last && (last.last || last.excerpt)
      const rows = line ? null : threadForPeer(state, peerId, selfId)
      const row = rows && rows[rows.length - 1]
      return (line && String(line).replace(/\s+/g, ' ').slice(0, 24)) || (row && String(row.text || '').replace(/\s+/g, ' ').slice(0, 24)) || '还没有往来'
    }
    function hayOf() {
      return Array.prototype.slice.call(arguments).join(' ')
    }
    function hitQ(query, text) {
      return !query || String(text || '').toLowerCase().indexOf(query) >= 0
    }
    function chatPeople(p) {
      const q = String(p.peopleQ || '').trim().toLowerCase()
      const nudges = (p.state && p.state.nudges) || []
      const first = nudges[0]
      const dueDot = nudges.some((n) => n && !n.forgotten && n.dueAt && n.dueAt <= Date.now() && n.spokenDay !== new Date().toISOString().slice(0, 10))
      const briefCount = (p.cues || []).filter((c) => c.kind === 'brief').length
      const briefDot = !(p.state && p.state.briefOff) && briefCount > 0 && p.briefSeen !== dayStamp()
      const shownPeers = (p.peers || []).filter((row) => hitQ(q, hayOf(row.note, row.displayName, row.id, row.door, lastLineOf(p.state, row.id, p.selfId))))
      const shownGroups = (p.groups || []).filter((g) => hitQ(q, hayOf(g.name, g.id, (g.members || []).map((id) => peerNameOf(p.state, id)).join(' '))))
      const hitSlip = hitQ(q, hayOf('待办', '条子', first && first.quote))
      const hitBrief = hitQ(q, hayOf('早报', '今早'))
      const emptySearch = q && !shownPeers.length && !shownGroups.length && !hitSlip && !hitBrief
      return h('aside', { className: 'dla-chat-people' },
        h('div', { className: 'dla-chat-people-qwrap' },
          h('input', {
            className: 'dla-chat-people-q',
            value: p.peopleQ,
            placeholder: '搜人、群、待办',
            onChange: (ev) => p.setPeopleQ(ev.target.value),
          }),
          p.peopleQ ? h('button', { type: 'button', className: 'dla-chat-people-qx', title: '清空', onClick: () => p.setPeopleQ('') }, '×') : null,
        ),
        (hitQ(q, hayOf('待办', '条子')) || hitBrief) ? h('div', { className: 'dla-chat-people-h' }, '本机') : null,
        hitSlip ? h('button', {
          type: 'button',
          className: 'dla-chat-p' + (p.pane === 'slip' ? ' on' : ''),
          onClick: () => p.setPane('slip'),
        }, h('span', { className: 'dla-chat-av pin' }, '待'),
          h('div', null, h('span', { className: 'dla-chat-nm' }, '待办'),
            h('span', { className: 'dla-chat-last' }, first ? String(first.quote || '').slice(0, 24) : '记下才留；到点再开口')),
          h('span', { className: 'dla-chat-dot' + (dueDot ? '' : ' off') })) : null,
        hitBrief ? h('button', {
          type: 'button',
          className: 'dla-chat-p' + (p.pane === 'brief' ? ' on' : ''),
          onClick: () => p.setPane('brief'),
        }, h('span', { className: 'dla-chat-av pin' }, '早'),
          h('div', null, h('span', { className: 'dla-chat-nm' }, '早报'),
            h('span', { className: 'dla-chat-last' }, p.state && p.state.briefOff ? '已关' : (briefCount ? ('今早 ' + briefCount + ' 件') : '工作日开口一句'))),
          h('span', { className: 'dla-chat-dot' + (briefDot ? '' : ' off') })) : null,
        h('div', { className: 'dla-chat-people-list' },
          shownPeers.length ? h('div', { className: 'dla-chat-people-h' }, '联系人') : null,
          shownPeers.map((row) => h('button', {
            key: row.id,
            type: 'button',
            className: 'dla-chat-p' + (p.pane === 'chat' && row.id === p.peerId ? ' on' : ''),
            onClick: () => { p.setPane('chat'); p.setWho(row.id); p.setHistOpen(false); p.setEmoOpen(false) },
          },
            h('span', { className: 'dla-chat-av', style: { background: avColor(row.id) } }, String((row.note || row.displayName || '?')).slice(0, 1)),
            h('div', { style: { minWidth: 0, flex: 1 } },
              h('span', { className: 'dla-chat-nm' }, row.note || row.displayName),
              h('span', { className: 'dla-chat-last' }, lastLineOf(p.state, row.id, p.selfId)),
            ),
            peerUnreadCount(p.state, row.id, p.selfId)
              ? h('span', { className: 'dla-chat-unread' }, peerUnreadCount(p.state, row.id, p.selfId) > 99 ? '99+' : String(peerUnreadCount(p.state, row.id, p.selfId)))
              : h('span', { className: 'dla-chat-dot off' }),
            h('span', {
              className: 'dla-chat-more',
              title: '资料',
              onClick: (ev) => { ev.stopPropagation(); p.openPeerCard(row.id) },
            }, '···'),
          )),
          !(p.allPeers || []).length && !q ? h('p', { className: 'dla-hint', style: { padding: '8px 16px' } }, '还没有配对。点下面配置去配对。') : null,
          emptySearch ? h('p', { className: 'dla-hint', style: { padding: '8px 16px' } }, '没有匹配的人、群或待办。') : null,
          shownGroups.length ? h('div', { className: 'dla-chat-people-h' }, '话题群') : null,
          shownGroups.map((g) => h('button', {
            key: g.id,
            type: 'button',
            className: 'dla-chat-p' + (p.pane === 'group' && g.id === p.groupId ? ' on' : ''),
            onClick: () => { p.setPane('group'); p.setGroupId(g.id); p.setTopicId(''); p.setHistOpen(false); p.setEmoOpen(false) },
          }, h('span', { className: 'dla-chat-av grp' }, '群'),
            h('div', { style: { minWidth: 0, flex: 1 } },
              h('span', { className: 'dla-chat-nm' }, g.name),
              h('span', { className: 'dla-chat-last' }, (topicsOfGroup(p.state, g.id, p.selfId)[0] && topicPreview(p.state, topicsOfGroup(p.state, g.id, p.selfId)[0])) || '还没有话题'),
            ),
            h('span', { className: 'dla-chat-dot' + (groupHasUnread(p.state, g.id, p.selfId) ? ' unread' : ' off') }),
            h('span', {
              className: 'dla-chat-more',
              title: '资料',
              onClick: (ev) => { ev.stopPropagation(); p.openGroupCard(g.id) },
            }, '···'),
          )),
        ),
        h('button', { type: 'button', className: 'dla-chat-cfg' + (p.newgOpen ? ' on' : ''), onClick: () => { p.setNewgOpen(true); p.setPickedMembers([]) } }, '建话题群'),
        h('button', { type: 'button', className: 'dla-chat-cfg' + (p.pane === 'local' ? ' on' : ''), onClick: p.openSetup }, '配置'),
      )
    }
    function chatCompose(p) {
      const locked = p.locked
      const draftWhy = p.pane === 'group'
        ? (p.topic && p.topic.kind === 'incoming' ? '' : (p.topic ? '这条不是对方发来的，不能拟回。' : '先点开话题再拟回。'))
        : (p.incoming ? '' : '没有对方消息可拟。')
      const adoptWhy = p.adoptable ? '' : (p.pane === 'group' ? '没有可采纳的跟帖。' : '没有可采纳的回复。')
      const threadWhy = p.pane === 'group' && !p.topic ? '先点开话题再问本机、摘要或先例。' : ''
      const packWhy = !p.sessionId ? '这条对话还没绑上，不能交接。' : threadWhy
      const toolWhy = draftWhy || adoptWhy || threadWhy
      const over = (p.files || []).some((f) => f.over)
      const canSend = !p.sending && !locked && (p.pane === 'group' || p.peerId || p.pending)
        && !over
        && ((p.pane !== 'group' && p.pending) || String(p.text || '').trim() || (p.files || []).some((f) => f.data && !f.over))
      const pickGroups = groupPicks(p.picks)
      const hidePickHead = pickGroups.length === 1 && !(pickGroups[0] && pickGroups[0].dir)
      return locked
        ? h('div', { className: 'dla-chat-sendrow is-local' },
          h('span', { className: 'dla-hint' }, p.placeholder || '本机页不发消息。'),
        )
        : h('div', { className: 'dla-chat-compose' },
          h('div', { className: 'dla-chat-tools-wrap' },
            p.emoOpen ? h('div', { className: 'dla-chat-emo', onClick: (ev) => ev.stopPropagation() }, EMOJI.map((e) => h('button', { key: e, type: 'button', onClick: () => { p.setText((t) => t + e); p.setEmoOpen(false) } }, e))) : null,
            h('div', { className: 'dla-chat-tools' },
              h('span', { className: 'dla-chat-toolg' },
                ico(draftWhy || '拟回', p.draftReply, !!draftWhy, [
                  icoPath('M3 12.5V4.8c0-.7.6-1.3 1.3-1.3h5.4L13 6.8v5.7c0 .7-.6 1.3-1.3 1.3H4.3c-.7 0-1.3-.6-1.3-1.3Z'),
                  icoPath('M9.7 3.5V6.8H13M5 9h6M5 11.2h4'),
                ], false, '拟回'),
                ico(adoptWhy || (p.pane === 'group' ? '采纳 · 要勾几句' : '采纳'), p.adoptHere, !!adoptWhy, icoPath('M3.2 8.2 6.3 11.3 12.8 4.7'), false, '采纳'),
                ico(threadWhy || '问本机', p.askLocal, !!threadWhy, [
                  icoCircle(8, 8, 5.2),
                  icoPath('M8 5.2v.2M6.6 7.1c.3-.8 1-.9 1.4-.9.8 0 1.4.4 1.4 1.2 0 .8-.7 1.1-1.3 1.4-.3.2-.5.4-.5.8V10'),
                ], false, '问本机'),
                ico(threadWhy || '摘要', () => p.summarizeThread(), !!threadWhy,
                  icoPath('M4 4.5h8M4 8h8M4 11.5h5'), false, '摘要'),
              ),
              h('span', { className: 'dla-chat-toolg' },
                ico('表情', () => p.setEmoOpen((v) => !v), false, [
                  icoCircle(8, 8, 5.2),
                  icoPath('M5.6 6.4h.1M10.3 6.4h.1M5.6 9.4c.7 1.2 4 1.2 4.8 0'),
                ], p.emoOpen, '表情'),
                ico('文件', () => p.fileRef.current && p.fileRef.current.click(), false, [
                  icoPath('M5 3.2h4.2L12.8 7v5.8c0 .6-.5 1-1 1H5c-.6 0-1-.4-1-1V4.2c0-.6.4-1 1-1Z'),
                  icoPath('M9.2 3.2V7h3.6'),
                ], false, '文件'),
                ico('聊天记录', () => p.setHistOpen((v) => !v), false, [
                  icoCircle(8, 8, 5.2),
                  icoPath('M8 5.2V8l2 1.4'),
                ], p.histOpen, '记录'),
                ico(threadWhy || '先例', p.onPrecedent, !!threadWhy, [
                  icoPath('M4.2 12.5V4.8c0-.6.5-1.1 1.1-1.1h2.4L10 6v6.5'),
                  icoPath('M7.7 3.7V6H10M5.6 9.2h5.6M5.6 11.2h3.8'),
                ], false, '先例'),
                ico(packWhy || '交接这次会话', p.packHandoff, !!packWhy, [
                  icoPath('M4.2 8h7.6'),
                  icoPath('M8 4.2v7.6'),
                  icoPath('M3.2 12.2 8 14.5l4.8-2.3V5.2L8 3 3.2 5.2v7Z'),
                ], false, '交接'),
              ),
              h('input', { ref: p.fileRef, type: 'file', multiple: true, className: 'hidden', style: { display: 'none' }, onChange: p.pickFiles }),
            ),
          ),
          (p.files || []).length ? h('div', { className: 'dla-chat-pending' }, p.files.map((f, i) => h('span', { key: i, className: 'dla-chat-chip' + (f.over ? ' over' : '') },
            (fileKind(f.name, f.mime) === 'image' && f.data && !f.over)
              ? h('img', {
                className: 'dla-chat-chip-img',
                src: 'data:' + (f.mime || 'image/*') + ';base64,' + f.data,
                alt: f.name || '',
                onClick: () => p.openPending(f),
              })
              : h('button', { type: 'button', className: 'dla-chat-media', onClick: () => p.openPending(f) },
                (isHandoffFile(f) ? '会话全文' : (f.path || f.name)) + (f.over ? ' · 超限，发不出去' : '')),
            h('button', { type: 'button', onClick: () => {
              if (isHandoffFile(f) && p.dropHandoff) {
                p.dropHandoff()
                return
              }
              p.setFiles((prev) => prev.filter((_, j) => j !== i))
              if (f.path && p.unpickPath) p.unpickPath(f.path)
            } }, '×'),
          ))) : null,
          (p.picks || []).length ? h('div', { className: 'dla-chat-picks' },
            h('div', { className: 'dla-chat-pick-bar' },
              h('span', null, '要带的文件'),
              h('button', { type: 'button', className: 'dla-chat-pick-x', title: '不算交接', onClick: () => p.dropHandoff && p.dropHandoff() }, '×'),
            ),
            pickGroups.map((group) => {
              const isRoot = !group.dir
              const open = hidePickHead || isRoot || !!(p.openDirs && p.openDirs[group.dir])
              const n = group.rows.length
              const k = group.rows.filter((row) => p.picked && p.picked[row.path]).length
              return h('div', { key: group.dir || '.', className: 'dla-chat-pick-g' },
                (hidePickHead || isRoot) ? null : h('button', {
                  type: 'button',
                  className: 'dla-chat-pick-dir' + (open ? ' open' : ''),
                  'aria-expanded': open ? 'true' : 'false',
                  onClick: () => p.toggleDir && p.toggleDir(group.dir),
                },
                  h('i', { className: 'dla-chat-pick-caret', 'aria-hidden': 'true' }),
                  h('span', null, group.dir + '/'),
                  h('em', null, k ? (k + '/' + n) : String(n)),
                ),
                open ? group.rows.map((row) => h('label', {
                  key: row.path,
                  className: 'dla-chat-pick-row' + ((p.picked && p.picked[row.path]) ? ' on' : ''),
                  title: row.path,
                },
                  h('input', {
                    type: 'checkbox',
                    checked: !!(p.picked && p.picked[row.path]),
                    onChange: (ev) => p.togglePick && p.togglePick(row, ev.target.checked),
                  }),
                  h('span', null, row.name),
                  h('em', null, sizeLabel(row.size)),
                )) : null,
              )
            }),
          ) : null,
          h('div', { className: 'dla-chat-box-wrap' },
            h('span', { className: 'dla-chat-box-grip', title: '拖这里改输入框高度', onMouseDown: p.startBoxResize }),
            h('textarea', {
              ref: p.boxRef,
              className: 'dla-chat-box',
              style: { height: p.boxH + 'px', minHeight: p.boxH + 'px', maxHeight: p.boxH + 'px' },
              value: p.text,
              placeholder: p.placeholder,
              onChange: (ev) => p.setText(ev.target.value),
              onPaste: p.onPaste,
            }),
          ),
          h('div', { className: 'dla-chat-sendrow' },
            h('span', { className: 'dla-hint' }, toolWhy || (over ? '有附件超限，去掉才能发。' : '回车换行。点发送才发出。右键一条可翻译。')),
            h('button', { type: 'button', className: 'dla-btn dla-btn-primary', disabled: !canSend, onClick: p.sendNow }, p.sendText),
          ),
        )
    }
    function chatSetup(p) {
      const pairCode = p.pairCode
      const state = p.state
      return h('section', { className: 'dla-chat-pane' },
        p.headBar('配置'),
        h('div', { className: 'dla-chat-setup' },
          h('div', { className: 'dla-chat-setup-inner' },
            h('div', { className: 'dla-chat-setup-card' },
              h('h3', null, '身份'),
              h('p', { className: 'dla-hint' }, '对面看到的名字。员工号只给查单用，不随消息走。'),
              h('div', { className: 'dla-chat-grid' },
                setupField('我怎么称呼自己', h('input', {
                  value: p.myName || (state && state.self && state.self.displayName) || '',
                  onChange: (ev) => p.setMyName(ev.target.value),
                })),
                setupField('员工号（查单用）', h('input', {
                  value: p.staffId || (state && state.self && state.self.staffId) || '',
                  onChange: (ev) => p.setStaffId(ev.target.value),
                })),
              ),
              h('label', { className: 'dla-chat-switch-row' },
                h('span', null, '早报 · 工作日开口'),
                tog(!(state && state.briefOff), async (on) => { await p.post('/brief', { off: !on }); p.refresh() }),
              ),
              h('label', { className: 'dla-chat-switch-row' },
                h('span', null, '关掉软件也收消息'),
                tog(!!(state && state.listenGranted), async (on) => { await p.post('/listen', { on }); p.refresh() }),
              ),
            ),
            h('div', { className: 'dla-chat-setup-card' },
              h('h3', null, '配对'),
              h('p', { className: 'dla-hint' }, pairCode && pairCode.code
                ? '这枚码当面报给对面。猜几次作废。'
                : '配对码当面报，猜几次作废。钥匙只在这台电脑。'),
              h('div', { className: 'dla-chat-pair-row' },
                pairCode && pairCode.code
                  ? h('span', { className: 'dla-chat-pair-digits' }, pairCode.code)
                  : h('span', { className: 'dla-chat-pair-empty' }, pairCode && pairCode.expired ? '已过期，再开一枚' : '还没有配对码'),
                pairCode && pairCode.remainMs ? h('span', { className: 'dla-pill warn' }, '还有 ' + Math.ceil(pairCode.remainMs / 60000) + ' 分钟') : null,
                h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', disabled: !(pairCode && pairCode.code), onClick: p.copyPair }, '复制'),
              ),
              h('p', { className: 'dla-chat-key' }, '本机编号 · ' + String((state && state.self && state.self.id) || '').slice(0, 12) + '…'),
              h('button', { type: 'button', className: 'dla-btn dla-btn-primary', onClick: p.mintCode }, '开一枚配对码'),
              state && state.relayConfigured ? h('p', { className: 'dla-hint', style: { marginTop: 14 } }, '中继邀请不含口头配对码。对面仍要点确定。') : null,
              state && state.relayConfigured ? h('button', {
                type: 'button',
                className: 'dla-btn dla-btn-ghost',
                onClick: p.mintRelayInvite,
              }, '开一枚中继邀请') : null,
              state && state.relayConfigured && p.relaySession ? h('button', {
                type: 'button',
                className: 'dla-btn dla-btn-ghost',
                onClick: p.revokeRelayInvite,
              }, '吊销这枚中继邀请') : null,
              h('p', { className: 'dla-hint', style: { marginTop: 14 } }, '填对方配对码和局域网地址，点发起配对。对面要点确定，才会出现联系人。'),
              setupField('本机端口（只读）', h('input', {
                value: String((state && state.doorPort) || p.lanPort || '9527'),
                readOnly: true,
                title: '改端口要重启 DSH',
              })),
              h('div', { className: 'dla-chat-grid' },
                setupField('对方配对码', h('input', { value: p.peerCode, maxLength: 6, placeholder: '六位数字', onChange: (ev) => p.setPeerCode(ev.target.value) })),
                setupField('对方地址（IP:端口）', h('input', { value: p.door, placeholder: '对面「本机端口」，如 127.0.0.1:19022', onChange: (ev) => p.setDoor(ev.target.value) })),
              ),
              h('button', { type: 'button', className: 'dla-btn dla-btn-primary', disabled: !String(p.peerCode || '').trim() || !String(p.door || '').trim(), onClick: p.handshakeNow }, '发起配对'),
              h('p', { className: 'dla-hint', style: { marginTop: 10 } }, '同事重装过机器，必须重新配对，不能沿用旧地址。改端口要重启 DSH。'),
            ),
            p.probeCards,
          ),
          h('div', { className: 'dla-chat-setup-foot' },
            h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: p.exportHere }, '导出流水'),
            h('button', { type: 'button', className: 'dla-btn dla-btn-primary', onClick: async () => { await p.saveSetup(); await p.saveProbe() } }, '保存'),
          ),
        ),
        chatToast(p, 'setup'),
      )
    }
    function chatPeerCard(p) {
      const peer = p.peer
      return h('div', { className: 'dla-chat-modal', onClick: p.closeCard },
        h('div', { className: 'dla-chat-modal-card', onClick: (ev) => ev.stopPropagation() },
          h('h3', null, peer.note || peer.displayName),
          h('p', { className: 'dla-chat-card-meta' },
            h('div', null, h('b', null, '对面名字'), ' ', peer.displayName),
            h('div', null, h('b', null, '稳定 ID'), ' ', String(peer.id).slice(0, 16) + '…'),
            p.wsName ? h('div', null, h('b', null, '工作区'), ' ', p.wsName) : null,
            h('div', null, h('b', null, '在线'), ' ', (peer.mute ? '免打扰 · ' : '') + (peer.online ? '在线 · 局域网' : '离线')),
          ),
          setupField('备注名（对面仍看到自己的名字）', h('input', { value: p.cardNote, onChange: (ev) => p.setCardNote(ev.target.value) })),
          setupField('本机员工引用（对面看不见登录口令）', h('input', { value: p.cardStaff, placeholder: '只存引用，不存登录口令', onChange: (ev) => p.setCardStaff(ev.target.value) })),
          setupField('对方地址（IP:端口）', h('input', { value: p.cardDoor, placeholder: '对面本机端口，如 127.0.0.1:9527', onChange: (ev) => p.setCardDoor(ev.target.value) })),
          h('label', { className: 'dla-chat-switch-row' }, h('span', null, '置顶'), tog(p.cardPin, p.setCardPin)),
          h('label', { className: 'dla-chat-switch-row' }, h('span', null, '免打扰'), tog(p.cardMute, p.setCardMute)),
          h('p', { className: 'dla-hint' }, '解配只删本机这一条。对面重装必须重新配对，不能沿用旧地址。'),
          h('div', { className: 'dla-chat-modal-foot is-split' },
            h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: () => p.setDanger({ kind: 'unpair', id: p.cardId, name: peer.note || peer.displayName }) }, '解配'),
            h('span', { style: { display: 'flex', gap: 8 } },
              h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: p.closeCard }, '取消'),
              h('button', { type: 'button', className: 'dla-btn dla-btn-primary', onClick: p.savePeerCard }, '保存'),
            ),
          ),
        ),
      )
    }
    function chatGroupCard(p) {
      const group = p.group
      return h('div', { className: 'dla-chat-modal', onClick: p.closeCard },
        h('div', { className: 'dla-chat-modal-card', onClick: (ev) => ev.stopPropagation() },
          h('h3', null, group.name),
          h('p', { className: 'dla-chat-card-meta' },
            h('div', null, h('b', null, '成员'), ' 我、' + (group.members || []).map((id) => peerNameOf(p.state, id)).join('、')),
            h('div', null, h('b', null, '话题'), ' ' + topicsOfGroup(p.state, group.id, p.selfId).length + ' 条'),
          ),
          setupField('群名', h('input', { value: p.cardGroupName, onChange: (ev) => p.setCardGroupName(ev.target.value) })),
          h('p', { className: 'dla-hint' }, '勾上的人在群里。自己不能踢。'),
          h('div', { className: 'dla-chat-pick' },
            (p.peers || []).map((row) => h('label', { key: row.id },
              h('input', {
                type: 'checkbox',
                checked: p.cardMembers.indexOf(row.id) >= 0,
                onChange: (ev) => p.setCardMembers(ev.target.checked
                  ? p.cardMembers.concat(row.id)
                  : p.cardMembers.filter((id) => id !== row.id)),
              }),
              ' ' + (row.note || row.displayName),
            )),
          ),
          h('label', { className: 'dla-chat-switch-row' }, h('span', null, '置顶'), tog(p.cardPin, p.setCardPin)),
          h('label', { className: 'dla-chat-switch-row' }, h('span', null, '免打扰'), tog(p.cardMute, p.setCardMute)),
          h('p', { className: 'dla-hint' }, '解散只删本机这一群。话题和跟帖一起走。'),
          h('div', { className: 'dla-chat-modal-foot is-split' },
            h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: () => p.setDanger({ kind: 'dissolve', id: p.cardId, name: group.name }) }, '解散群'),
            h('span', { style: { display: 'flex', gap: 8 } },
              h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: p.closeCard }, '取消'),
              h('button', { type: 'button', className: 'dla-btn dla-btn-primary', onClick: p.saveGroupCard }, '保存'),
            ),
          ),
        ),
      )
    }
    function isEmojiOnly(text) {
      const t = String(text || '').trim()
      return !!(t && t.length <= 24 && !/[0-9A-Za-z\u4e00-\u9fff]/.test(t))
    }
    const CUE_KIND = { asked: '对方消息', reply: '回复', chase: '催一下', cosign: '会签', brief: '早报', nudge: '待办', 'nudge-ask': '待办' }
    function chatBubble(p) {
      const m = p.m
      const tr = shownTr(p.trMap && p.trMap[m.id])
      return h('div', {
        key: m.id,
        id: 'cm-' + m.id,
        className: 'dla-chat-b ' + m.from + (m.failed ? ' fail' : '') + (m.from === 'sys' ? ' gone' : '') + (m.local ? ' local' : '') + (p.jumpId === m.id ? ' jump' : '') + (isEmojiOnly(m.text) ? ' emo' : ''),
        onContextMenu: m.from === 'ai' ? undefined : (ev) => p.openCtx(ev, m),
      },
        m.tag ? h('span', { className: 'tag' }, m.tag) : (m.who ? h('span', { className: 'who' }, m.who) : null),
        m.text,
        tr && tr.out ? h('span', { className: 'dla-chat-tr' }, h('b', null, tr.lang || '译'), ' ', tr.out) : null,
        (m.files && m.files.length) ? h('div', { className: 'dla-chat-files' },
          m.files.map((f, fi) => h('span', { key: fi }, fileThumb(f, () => p.openAttach(f.requestId, f.index)))),
        ) : null,
        m.handoff ? h('div', { className: 'dla-chat-files' },
          h('button', { type: 'button', className: 'dla-chat-media', onClick: () => p.openHandoff && p.openHandoff(m.requestId) }, '打开全文'),
          (m.from === 'them' && !m.adopted)
            ? h('button', { type: 'button', className: 'dla-chat-media', onClick: () => p.continueHandoff && p.continueHandoff(m.requestId) }, '接着聊')
            : null,
        ) : null,
        m.pending ? h('span', { className: 'dla-hint' }, ' · 未发出') : null,
        m.failed ? h('span', { className: 'dla-chat-fail' },
          '没送到。 ',
          h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: () => p.retryFail(m.requestId) }, '再试'),
        ) : null,
        h('span', { className: 'when' }, dayClock(m.at) || clockOf(m.at)),
        m.withdrawable && !m.failed ? h('button', { type: 'button', className: 'dla-chat-un', onClick: () => p.withdrawHere(m.requestId) }, '撤回') : null,
      )
    }
    function chatHist(p) {
      const q = String(p.histQ || '').trim().toLowerCase()
      const list = (p.rows || []).filter((m) => m && m.text && (!q || String(m.text).toLowerCase().indexOf(q) >= 0 || dayClock(m.at).toLowerCase().indexOf(q) >= 0))
      const days = []
      list.forEach((m) => {
        const day = (dayClock(m.at) || '').split(' ')[0] || '往来'
        const last = days[days.length - 1]
        last && last.day === day ? last.items.push(m) : days.push({ day, items: [m] })
      })
      return h('div', { className: 'dla-chat-hist' },
        h('div', { className: 'dla-chat-hist-bar' },
          h('div', { className: 'dla-chat-hist-qwrap' },
            h('input', { className: 'dla-chat-hist-q', value: p.histQ, placeholder: '搜这条聊天', onChange: (ev) => p.setHistQ(ev.target.value) }),
            p.histQ ? h('button', { type: 'button', className: 'dla-chat-people-qx', title: '清空', onClick: () => p.setHistQ('') }, '×') : null,
          ),
          h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: () => { p.setHistOpen(false); p.setHistQ('') } }, '回聊天'),
        ),
        days.length
          ? days.map((g) => h('div', { key: g.day },
            h('div', { className: 'dla-chat-hist-day' }, g.day + ' · ' + g.items.length + ' 条'),
            g.items.map((m) => h('button', {
              key: m.id,
              type: 'button',
              className: 'dla-chat-hist-row',
              onClick: () => {
                p.setHistOpen(false)
                p.setJumpId(m.id)
                setTimeout(() => {
                  const el = typeof document !== 'undefined' && document.getElementById('cm-' + m.id)
                  el && el.scrollIntoView && el.scrollIntoView({ block: 'center' })
                }, 30)
              },
            },
              h('div', { className: 'who' }, (m.from === 'me' ? '我' : (m.who || peerNameOf(p.state, p.peerId))) + ' · ' + dayClock(m.at)),
              h('div', { className: 'tx' }, String(m.text || '').slice(0, 80)),
            )),
          ))
          : h('p', { className: 'dla-hint' }, '这条线程没有匹配的记录。'),
      )
    }
    function chatCue(p) {
      const cue = p.cue
      return cue && h('div', { className: 'dla-chat-dock-line' },
        h('span', { className: 'dla-chat-dock-speak' }, h('b', null, CUE_KIND[cue.kind] || '往来'), ' ', cue.speak),
        h('span', { className: 'dla-chat-dock-acts' },
          h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: p.goCue }, '去看'),
          (p.cues || []).filter((c) => !p.cueIsHere(c)).length > 1 ? h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: p.nextCue }, '下一条') : null,
        ),
      )
    }
    function chatToast(p, place) {
      return p.toast ? h('div', { className: 'dla-inline-toast', style: { bottom: (place === 'setup' ? 56 : (p.boxH + 56)) + 'px' } }, p.toast) : null
    }
    function chatSummary(p) {
      return p.summary && h('div', { className: 'dla-chat-sum' },
        h('span', null, p.summary),
        h('button', { type: 'button', className: 'dla-chat-sum-x', title: '关掉摘要', onClick: p.clearSummary }, '×'),
      )
    }
    function chatSlip(p) {
      const rows = ((p.state && p.state.nudges) || []).filter((row) => row && !row.forgotten)
        .slice()
        .sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0))
      return chatPane({
        head: p.headBar('待办'),
        cue: p.cueBar() || (p.paneCue() ? h('div', { className: 'dla-chat-cue' }, p.paneCue()) : null),
        body: h('div', { ref: p.threadRef, className: 'dla-chat-thread', onScroll: p.onThreadScroll },
          rows.length
            ? rows.map((row) => h('div', { key: row.id, className: 'dla-chat-b them' },
              String(row.quote || ''),
              h('span', { className: 'when' }, clockOf(row.dueAt)),
              h('div', { className: 'dla-chat-slip-acts' },
                h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: async () => { await p.post('/nudge/hold', { requestId: row.id }); p.refresh(); p.say('今早记下。今天不再开口。') } }, '今早记下'),
                h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: async () => { await p.post('/nudge/forget', { requestId: row.id }); p.refresh(); p.say('忘掉这条待办。') } }, '忘掉'),
              ),
            ))
            : h('p', { className: 'dla-chat-empty' }, '还没有待办。右击一句聊天可以摘进来。'),
        ),
        composer: p.composer('本机页不发消息。', p.sendLabel, true),
        toast: chatToast(p),
      })
    }
    function chatTopics(p) {
      const group = p.group
      return chatPane({
        droppable: true, dropping: p.dropping, setDropping: p.setDropping, onDrop: p.onDrop, boxH: p.boxH,
        head: p.headBar(
          h('span', null,
            group.name + (p.histOpen ? ' · 聊天记录' : ''),
            p.wsName ? h('span', { className: 'sub' }, p.wsName) : null,
            h('span', { className: 'sub' }, '话题群 · ' + ((group.members || []).length) + ' 人'),
          ),
          h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: () => p.openGroupCard(group.id) }, '资料'),
        ),
        cue: p.cueBar() || (p.paneCue() ? h('div', { className: 'dla-chat-cue' }, p.paneCue()) : null),
        summary: chatSummary(p),
        body: p.histOpen ? p.histView() : h('div', { ref: p.threadRef, className: 'dla-chat-thread', onScroll: p.onThreadScroll },
          p.topics.length
            ? p.topics.map((t) => h('button', {
              key: t.id,
              type: 'button',
              className: 'dla-chat-topic',
              onClick: () => p.setTopicId(t.id),
            },
              h('span', { className: 'who' }, (t.from === p.selfId ? '我' : peerNameOf(p.state, t.from)) + ' · ' + clockOf(t.updatedAt || t.createdAt)),
              h('span', { className: 'tx' }, topicPreview(p.state, t)),
              h('span', { className: 'meta' }, replyCount(t, p.state && p.state.requests) + ' 条跟帖 · 点开进话题'),
            ))
            : h('p', { className: 'dla-chat-empty' }, '还没有话题。下面输入框发的是新话题，不刷屏。'),
        ),
        composer: p.composer('发一条新话题。点开话题再跟帖。', p.sendLabel),
        toast: chatToast(p),
      })
    }
    function chatCueLine(p) {
      return p.cueBar() || (p.paneCue() ? h('div', { className: 'dla-chat-cue' }, p.paneCue()) : null)
    }
    function chatLatest(p) {
      return !p.pinBottom && !p.histOpen
        ? h('button', { type: 'button', className: 'dla-chat-latest', onClick: p.jumpLatest }, '回到最新')
        : null
    }
    function chatEmptyGroup(p) {
      return chatPane({
        head: p.headBar('话题群'),
        body: h('div', { className: 'dla-chat-thread' },
          h('p', { className: 'dla-chat-empty' }, p.groups.length ? '左边点一个话题群。' : '还没有话题群。点左下角建一个。'),
        ),
      })
    }
    function chatFollow(p) {
      const topic = p.topic
      const group = p.group
      return chatPane({
        droppable: true, dropping: p.dropping, setDropping: p.setDropping, onDrop: p.onDrop, boxH: p.boxH,
        head: p.headBar(
          h('span', null,
            (topic.excerpt || group.name) + (p.histOpen ? ' · 聊天记录' : ''),
            p.wsName ? h('span', { className: 'sub' }, p.wsName) : null,
            h('span', { className: 'sub' }, '话题 · ' + replyCount(topic, p.threadState && p.threadState.requests) + ' 条跟帖'),
          ),
          h('span', { style: { display: 'flex', gap: 8 } },
            h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: () => p.setTopicId('') }, '返回话题'),
            h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: () => p.openGroupCard(group.id) }, '资料'),
          ),
        ),
        cue: chatCueLine(p),
        summary: chatSummary(p),
        body: p.histOpen ? p.histView() : h('div', { ref: p.threadRef, className: 'dla-chat-thread', onScroll: p.onThreadScroll },
          p.rows.length
            ? p.rows.map((m) => p.bubble(m))
            : h('p', { className: 'dla-chat-empty' }, '还没有跟帖。从下面发出。'),
        ),
        latest: chatLatest(p),
        composer: p.composer('跟帖只进这条话题，不刷群。', p.sendLabel),
        toast: chatToast(p),
      })
    }
    function chatPeerPane(p) {
      const peer = p.peer
      return chatPane({
        droppable: true, dropping: p.dropping, setDropping: p.setDropping, onDrop: p.onDrop, boxH: p.boxH,
        head: p.headBar(
          h('span', null,
            (peer ? (peer.note || peer.displayName) : '聊天') + (p.histOpen ? ' · 聊天记录' : ''),
            p.wsName ? h('span', { className: 'sub' }, (p.letterWs ? '这封跟 ' : '本机 · ') + p.wsName) : null,
            peer ? h('span', { className: 'sub' }, (peer.mute ? '免打扰 · ' : '') + (peer.online ? '在线 · 局域网' : '离线')) : null,
          ),
          peer ? h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: () => p.openPeerCard(peer.id) }, '资料') : null,
        ),
        cue: chatCueLine(p),
        pending: p.pending ? h('div', { className: 'dla-chat-dock' },
          h('span', null, '有一条还没发出。再点发送。'),
          h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: async () => {
            await p.post('/presend/cancel', { requestId: p.pending.id })
            p.refresh()
            p.say('稿已撤。没发出。')
          } }, '取消'),
        ) : null,
        summary: chatSummary(p),
        body: p.histOpen ? p.histView() : h('div', { ref: p.threadRef, className: 'dla-chat-thread', onScroll: p.onThreadScroll },
          !peer
            ? h('p', { className: 'dla-chat-empty' }, '还没有聊天对象。左边配对一个人，或点下面配置。')
            : p.rows.length
              ? p.rows.map((m) => p.bubble(m))
              : h('p', { className: 'dla-chat-empty' }, '还没有往来。写下要发的那几句，点发送才发出。'),
        ),
        latest: chatLatest(p),
        composer: peer ? p.composer((p.incoming ? '回给 ' : '发给 ') + (peer.note || peer.displayName) + '。可粘贴 / 拖入。回车换行。', p.sendLabel) : null,
        toast: chatToast(p),
      })
    }
    function chatPane(p) {
      const droppable = p.droppable
      return h('section', droppable ? {
        className: 'dla-chat-pane' + (p.dropping ? ' dla-chat-drop' : ''),
        onDragOver: (ev) => { ev.preventDefault(); p.setDropping(true) },
        onDragLeave: () => p.setDropping(false),
        onDrop: p.onDrop,
      } : { className: 'dla-chat-pane' },
        p.head,
        p.cue,
        p.pending || null,
        p.summary || null,
        h('div', { className: 'dla-chat-stage' }, p.body, p.latest || null),
        p.composer || null,
        p.toast || null,
      )
    }
    function chatAdoptSheet(p) {
      const topic = p.topic
      const group = p.group
      return h('div', { className: 'dla-chat-modal', onClick: () => p.setAdoptOpen(false) },
        h('div', { className: 'dla-chat-modal-card', style: { width: 'min(460px, 94%)' }, onClick: (ev) => ev.stopPropagation() },
          h('h3', null, '让本机接着做'),
          h('p', { className: 'dla-hint' }, '聊过 ≠ 点头。勾上的话才会带进这一轮。'),
          h('div', { className: 'dla-chat-adopt-sec' },
            h('h4', null, '1. 谁要点头'),
            h('label', { className: 'dla-chat-switch-row' },
              h('span', null, '要这几个人都点头'),
              tog(!!(topic.cosign && topic.cosign.on), (on) => p.toggleCosign(on)),
            ),
            topic.cosign && topic.cosign.on
              ? ((group && group.members) || []).map((id) => {
                const done = ((topic.cosign && topic.cosign.nods) || []).indexOf(id) >= 0
                return h('div', { key: id, className: done ? 'ok' : 'wait', style: { fontSize: 13, margin: '6px 0' } },
                  peerNameOf(p.state, id) + (done ? ' 已点头' : ' 未点 '),
                  done ? null : h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: () => p.nodHere(id) }, '代记点头'),
                )
              })
              : h('p', { className: 'dla-hint' }, '不开会签。有人跟帖就能开工。'),
          ),
          h('div', { className: 'dla-chat-adopt-sec' },
            h('h4', null, '2. 带上哪几句'),
            h('div', { className: 'dla-chat-pick' },
              (() => {
                const follows = []
                ;(topic.replies || []).forEach((rep, i) => follows.push({ key: String(i), from: rep.from, fromName: rep.fromName, body: rep.body }))
                topicFollows(p.state && p.state.requests, topic.id).forEach((row) => follows.push({
                  key: row.id,
                  from: row.from,
                  fromName: row.fromName,
                  body: row.excerpt || row.last || row.body,
                }))
                return follows.length
                  ? follows.map((rep) => h('label', { key: rep.key },
                    h('input', {
                      type: 'checkbox',
                      checked: p.pickReplies.indexOf(rep.key) >= 0 || p.pickReplies.indexOf(rep.from) >= 0,
                      onChange: (ev) => p.setPickReplies(ev.target.checked
                        ? p.pickReplies.concat(rep.key)
                        : p.pickReplies.filter((x) => x !== rep.key && x !== rep.from)),
                    }),
                    ' ' + (rep.fromName || peerNameOf(p.state, rep.from)) + ' · ' + String(rep.body || '').slice(0, 40),
                  ))
                  : h('p', { className: 'dla-hint' }, '还没有跟帖可勾。')
              })(),
            ),
          ),
          h('div', { className: 'dla-chat-modal-foot' },
            h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: () => p.setAdoptOpen(false) }, '取消'),
            h('button', { type: 'button', className: 'dla-btn dla-btn-primary', onClick: p.confirmAdoptSheet, disabled: !p.adoptable }, '开工'),
          ),
        ),
      )
    }
    function chatBrief(p) {
      const state = p.state
      return chatPane({
        head: p.headBar('早报'),
        cue: p.cueBar() || (p.paneCue() ? h('div', { className: 'dla-chat-cue' }, p.paneCue()) : null),
        body: h('div', { ref: p.threadRef, className: 'dla-chat-thread', onScroll: p.onThreadScroll },
          h('p', { className: 'dla-hint' }, state && state.briefOff ? '今早已关。' : '工作日开口一句。点关掉今早不再开口。'),
          (p.cues || []).filter((c) => c.kind === 'brief').slice(0, 3).map((c) => h('button', {
            key: c.id,
            type: 'button',
            className: 'dla-chat-topic',
            onClick: () => p.goCue(c),
          }, h('span', { className: 'tx' }, c.speak))),
          h('button', {
            type: 'button',
            className: 'dla-btn dla-btn-ghost',
            onClick: async () => {
              await p.post('/brief', { off: !(state && state.briefOff) })
              p.refresh()
              p.say(state && state.briefOff ? '今早再开口。' : '今早不再开口。')
            },
          }, state && state.briefOff ? '打开早报' : '关掉早报'),
        ),
        composer: p.composer('本机页不发消息。', p.sendLabel, true),
        toast: chatToast(p),
      })
    }
    function chatNewGroup(p) {
      return h('div', { className: 'dla-chat-modal', onClick: () => p.setNewgOpen(false) },
        h('div', { className: 'dla-chat-modal-card', onClick: (ev) => ev.stopPropagation() },
          h('h3', null, '创建话题群'),
          h('p', { className: 'dla-hint' }, '主列表是话题，跟帖进话题里。不是普通刷屏群。'),
          setupField('群名', h('input', { value: p.newGroupName, placeholder: '例如：灰度上线', onChange: (ev) => p.setNewGroupName(ev.target.value) })),
          !p.peers.length ? h('p', { className: 'dla-hint' }, '还没有配对的人。先去配置配对。') : null,
          h('div', { className: 'dla-chat-pick' },
            p.peers.map((row) => h('label', { key: row.id },
              h('input', {
                type: 'checkbox',
                checked: p.pickedMembers.indexOf(row.id) >= 0,
                onChange: (ev) => p.setPickedMembers(ev.target.checked
                  ? p.pickedMembers.concat(row.id)
                  : p.pickedMembers.filter((id) => id !== row.id)),
              }),
              ' ' + (row.note || row.displayName),
            )),
          ),
          h('div', { className: 'dla-chat-modal-foot' },
            h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: () => p.setNewgOpen(false) }, '取消'),
            h('button', { type: 'button', className: 'dla-btn dla-btn-primary', onClick: p.makeGroup, disabled: !p.newGroupName.trim() || !p.pickedMembers.length }, '创建'),
          ),
        ),
      )
    }
    function chatDanger(p) {
      const danger = p.danger
      return h('div', { className: 'dla-chat-modal', onClick: () => p.setDanger(null) },
        h('div', { className: 'dla-chat-modal-card', onClick: (ev) => ev.stopPropagation() },
          h('h3', null, danger.kind === 'dissolve' ? '解散这个群？' : '解配这个人？'),
          h('p', { className: 'dla-hint' }, danger.kind === 'dissolve'
            ? ('解散「' + (danger.name || '') + '」只删本机这一群。话题和跟帖一起走。')
            : ('解配「' + (danger.name || '') + '」只删本机这一条。对面重装必须重新配对。')),
          h('div', { className: 'dla-chat-modal-foot' },
            h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: () => p.setDanger(null) }, '取消'),
            h('button', { type: 'button', className: 'dla-btn dla-btn-primary', onClick: async () => {
              const row = danger
              p.setDanger(null)
              if (!row) return
              if (row.kind === 'dissolve') {
                await p.dissolveHere()
                return
              }
              await p.post('/unpair', { peerId: row.id })
              p.closeCard()
              p.refresh()
              p.say('已解配。只删本机这一条。')
            } }, danger.kind === 'dissolve' ? '解散' : '解配'),
          ),
        ),
      )
    }
    function chatPreview(p) {
      const preview = p.preview
      const kind = preview.kind
      const editable = !!(preview.path && (kind === 'text' || kind === 'md'))
      const univerKind = kind === 'word' || kind === 'excel' || kind === 'ppt' || kind === 'univer'
      const body = (preview.univerUrl && h('iframe', { src: preview.univerUrl, title: preview.name, style: { width: '100%', height: 480, border: 0 } }))
        || (kind === 'image' && h('img', { src: preview.href, alt: preview.name }))
        || (kind === 'video' && h('video', { src: preview.href, controls: true }))
        || (kind === 'audio' && h('audio', { src: preview.href, controls: true, style: { width: '100%', margin: 16 } }))
        || (kind === 'pdf' && h('iframe', { src: preview.href, title: preview.name }))
        || (editable && h('textarea', {
          className: 'dla-chat-office',
          style: { width: '100%', minHeight: 240, border: 0, outline: 'none', resize: 'vertical' },
          value: preview.text || '',
          onChange: (ev) => p.setPreview(Object.assign({}, preview, { text: ev.target.value })),
        }))
        || (kind === 'text' && h('pre', { className: 'dla-chat-office' }, preview.text))
        || (preview.html && h('div', { className: 'dla-chat-office', dangerouslySetInnerHTML: { __html: preview.html } }))
        || h('p', { className: 'dla-hint', style: { padding: 16 } }, '这个格式不能版式预览。仍可下载。')
      return h('div', { className: 'dla-chat-prev', onClick: () => p.setPreview(null) },
        h('div', { className: 'dla-chat-prev-card', onClick: (ev) => ev.stopPropagation() },
          h('div', { className: 'dla-chat-prev-h' },
            h('span', null, preview.name || '附件'),
            h('span', { style: { display: 'flex', gap: 8 } },
              preview.requestId ? h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: () => p.seeNow && p.seeNow(preview.requestId) }, '看看') : null,
              preview.requestId != null && preview.index != null ? h('button', {
                type: 'button',
                className: 'dla-btn dla-btn-ghost',
                onClick: () => p.copyAttach && p.copyAttach(preview),
              }, '另存到工作区') : null,
              preview.path ? h('button', {
                type: 'button',
                className: 'dla-btn dla-btn-ghost',
                onClick: () => p.saveWorkspace && p.saveWorkspace(preview),
              }, '保存到工作区') : null,
              univerKind ? h('button', {
                type: 'button',
                className: 'dla-btn dla-btn-ghost',
                disabled: !preview.path,
                onClick: () => p.openUniver && p.openUniver(preview),
              }, preview.path ? '用 Univer 打开' : '先另存再打开') : null,
              preview.href ? h('a', { href: preview.href, download: preview.name || 'file' }, '下载') : null,
              h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: () => p.setPreview(null) }, '关闭'),
            ),
          ),
          h('div', { className: 'dla-chat-prev-body' }, body),
        ),
      )
    }
    function chatSlipAsk(p) {
      const ask = p.slipAsk
      if (!ask) return null
      return h('div', { className: 'dla-chat-modal', onClick: () => p.setSlipAsk(null) },
        h('div', { className: 'dla-chat-modal-card', onClick: (ev) => ev.stopPropagation() },
          h('h3', null, '摘成待办'),
          h('p', { className: 'dla-hint' }, '记下才留。到点只提醒你自己，不发消息，也不写进系统日历。'),
          h('p', { style: { fontSize: 14, lineHeight: '22px' } }, String(ask.quote || '').slice(0, 200)),
          setupField('提醒时间', h('input', {
            type: 'datetime-local',
            value: ask.due || '',
            onChange: (ev) => p.setSlipAsk(Object.assign({}, ask, { due: ev.target.value })),
          })),
          h('div', { className: 'dla-chat-modal-foot' },
            h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: () => p.setSlipAsk(null) }, '取消'),
            h('button', { type: 'button', className: 'dla-btn dla-btn-primary', onClick: p.confirmSlip }, '记下'),
          ),
        ),
      )
    }
    function chatForwardAsk(p) {
      const ask = p.forwardAsk
      if (!ask) return null
      const peers = (p.peers || []).filter((row) => row && !row.unpaired)
      return h('div', { className: 'dla-chat-modal', onClick: () => p.setForwardAsk(null) },
        h('div', { className: 'dla-chat-modal-card', onClick: (ev) => ev.stopPropagation() },
          h('h3', null, '转发给谁'),
          h('p', { className: 'dla-hint' }, '只转这一句原文。必须已经配对。不带附件。'),
          h('p', { style: { fontSize: 14, lineHeight: '22px' } }, String(ask.quote || '').slice(0, 200)),
          peers.length
            ? peers.map((row) => h('button', {
              key: row.id,
              type: 'button',
              className: 'dla-btn dla-btn-ghost',
              style: { display: 'block', width: '100%', textAlign: 'left', margin: '6px 0' },
              onClick: () => p.confirmForward(row.id),
            }, row.note || row.displayName))
            : h('p', { className: 'dla-hint' }, '还没有配对的人。'),
          h('div', { className: 'dla-chat-modal-foot' },
            h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: () => p.setForwardAsk(null) }, '取消'),
          ),
        ),
      )
    }
    function chatProbe(p) {
      const d = p.draft
      const row = p.row
      return h('div', { key: row.id, className: 'dla-chat-setup-card' },
        h('h3', null, p.index === 0 ? '查单' : ('查单 ' + (p.index + 1))),
        p.index === 0 ? h('p', { className: 'dla-hint' }, '可挂多套只读查单地址。开口会点名用哪一套。登录口令不随消息走，也不进导出。') : null,
        h('div', { className: 'dla-choice' },
          [['nocobase', 'NocoBase'], ['rest', '通用 REST']].map(([value, label]) => h('button', {
            key: value,
            type: 'button',
            className: 'dla-choice-btn' + ((d.dialect || 'nocobase') === value ? ' is-on' : ''),
            onClick: () => p.patchDraft(row.id, { dialect: value }),
          }, label)),
        ),
        h('div', { className: 'dla-chat-grid' },
          setupField('系统名', h('input', {
            value: d.system,
            placeholder: 'NocoBase',
            onChange: (ev) => p.patchDraft(row.id, { system: ev.target.value }),
          })),
          setupField('环境', h('input', {
            value: d.env,
            placeholder: '测试',
            onChange: (ev) => p.patchDraft(row.id, { env: ev.target.value }),
          })),
        ),
        setupField('业务地址（只读）', h('input', {
          value: d.baseUrl,
          placeholder: 'http://127.0.0.1:13000/api',
          onChange: (ev) => p.patchDraft(row.id, { baseUrl: ev.target.value }),
        })),
        d.dialect === 'rest' ? setupField('只读路径（可用 {no} 或 {q}）', h('input', {
          value: d.listPath,
          placeholder: '/tickets?q={q}',
          onChange: (ev) => p.patchDraft(row.id, { listPath: ev.target.value }),
        })) : null,
        setupField('口令', h('input', {
          type: 'password',
          value: d.token || '',
          placeholder: d.hasToken ? '已有口令，留空不改' : '本机口令，不随消息走',
          autoComplete: 'off',
          onChange: (ev) => p.patchDraft(row.id, { token: ev.target.value }),
        })),
        h('div', { style: { display: 'flex', gap: 8, marginTop: 4 } },
          p.last ? h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: p.addProbe }, '再加一套') : null,
          p.many ? h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: () => p.removeProbe(row.id) }, '去掉这套') : null,
        ),
      )
    }
    function chatCtx(p) {
      const m = p.ctxMenu && p.ctxMenu.m
      const item = (act, label) => h('button', {
        type: 'button',
        onMouseDown: (ev) => { ev.preventDefault(); ev.stopPropagation(); p.ctxAct(act) },
      }, label)
      return h('div', {
        className: 'dla-chat-ctx',
        style: { left: p.ctxMenu.x + 'px', top: p.ctxMenu.y + 'px' },
        onMouseDown: (ev) => ev.stopPropagation(),
        onClick: (ev) => ev.stopPropagation(),
      },
        item('ask', '问本机这条'),
        item('draft', '按这条拟回'),
        m && m.from === 'them' ? item('adopt', '采纳这条') : null,
        m && m.from === 'me' && m.withdrawable ? item('withdraw', '撤回这条') : null,
        item('tr', '翻译这条'),
        item('slip', '摘成待办'),
        item('forward', '转发给…'),
        item('board', '能不能记进档案'),
      )
    }
    function dragOn(ev, onMove) {
      if (!ev || ev.button !== 0) return
      ev.preventDefault()
      ev.stopPropagation && ev.stopPropagation()
      function move(next) { onMove(next) }
      function up() {
        document.removeEventListener('mousemove', move)
        document.removeEventListener('mouseup', up)
      }
      document.addEventListener('mousemove', move)
      document.addEventListener('mouseup', up)
    }
    function clampChatWin(next) {
      const vw = (typeof window !== 'undefined' && window.innerWidth) || 1280
      const vh = (typeof window !== 'undefined' && window.innerHeight) || 800
      return {
        w: Math.min(Math.max(360, Number(next.w) || 1000), Math.max(360, vw - 24)),
        h: Math.min(Math.max(280, Number(next.h) || 720), Math.max(280, vh - 80)),
        left: Math.min(Math.max(8, Number(next.left) || 48), Math.max(8, vw - 80)),
        top: Math.min(Math.max(8, Number(next.top) || 56), Math.max(8, vh - 80)),
      }
    }
    function sendFailOf(result, fallback) {
      const err = (result && (result.hint || result.error)) || ''
      return ({
        TIMEOUT: '等太久了。稿还在，再点发送。',
        UNREACHABLE: '本机协助没通。稿还在，再点发送。',
        LOCAL_ONLY: '只能在这台电脑的页面发。',
      })[err] || err || fallback
    }
    function looksChinese(s) { return /[\u4e00-\u9fff]/.test(String(s || '')) }
    function sentBodiesOf(req) {
      const bodies = [...((req && req.versions) || []), ...((req && req.replies) || [])]
        .map((row) => String((row && row.body) || '').trim())
        .filter(Boolean)
      const excerpt = String((req && (req.body || req.excerpt)) || '').trim()
      excerpt && bodies.push(excerpt)
      return bodies
    }
    function threadRootOf(req) {
      return String((req && (req.threadId || req.id)) || '')
    }
    function sameThreadOf(a, b) {
      if (!a || !b) return false
      if (a === b) return true
      if (a.id && a.id === b.id) return true
      const left = threadRootOf(a)
      const right = threadRootOf(b)
      return !!(left && left === right)
    }
    function sameDirectTalkOf(a, b) {
      if (!isDirectChat(a) || !isDirectChat(b)) return false
      const left = [...new Set([a.from, ...(a.to || [])].filter(Boolean))].sort().join('\0')
      const right = [...new Set([b.from, ...(b.to || [])].filter(Boolean))].sort().join('\0')
      return !!(left && left === right)
    }
    function composerDraftOf(text, draft, skip, lastApplied) {
      const next = String(draft || '').trim()
      if (!next || next === String(skip || '').trim()) return null
      if (next === String(lastApplied || '').trim()) return null
      const cur = String(text || '').trim()
      if (cur && cur !== String(lastApplied || '').trim()) return null
      return next
    }
    function liveReplyDraft(req, thread) {
      const draft = String((req && req.replyDraft) || '').trim()
      if (!draft) return ''
      const rows = Array.isArray(thread) && thread.length ? thread : [req]
      return rows.some((row) => (sameThreadOf(row, req) || sameDirectTalkOf(row, req)) && sentBodiesOf(row).includes(draft)) ? '' : draft
    }
    function shownTr(tr) {
      if (!tr || /\[draft EN\]|【试译】|译文在当前会话/.test(String(tr.out || ''))) return null
      return tr
    }
    function demoTranslate(text) {
      const t = String(text || '').trim()
      if (!t) return { lang: '译', out: '' }
      return { lang: looksChinese(t) ? 'EN' : '中', out: '正在译…', pending: true }
    }
    function persistTrMap(next) {
      persistJson('dla-chat-tr', next)
      return next
    }
    function trRowOff(prev, id) {
      const next = Object.assign({}, prev)
      delete next[id]
      return persistTrMap(next)
    }
    function trRowOn(prev, id, row) {
      const next = Object.assign({}, prev)
      next[id] = row
      return persistTrMap(next)
    }
    async function liveTranslateNow(p, id, raw) {
      if (p.trMap && p.trMap[id] && !p.trMap[id].pending) {
        p.setTrMap((prev) => trRowOff(prev, id))
        return
      }
      p.say('正在译…')
      p.setTrMap((prev) => trRowOn(prev, id, demoTranslate(raw)))
      const result = await p.post('/translate', { quote: raw })
      if (!result || result.ok === false || !result.out) {
        p.setTrMap((prev) => trRowOff(prev, id))
        p.say((result && (result.hint || result.error)) || '没译成')
        return
      }
      p.setTrMap((prev) => trRowOn(prev, id, { lang: result.lang || demoTranslate(raw).lang, out: result.out }))
      p.say(trSpeak())
    }
    const SKIN_TITLE = { paper: '纸白', mist: '雾灰', sand: '暖沙', ink: '墨色' }
    function chatSkins(p) {
      return h('span', { className: 'dla-chat-skins' },
        ['paper', 'mist', 'sand', 'ink'].map((name) => h('button', {
          key: name,
          type: 'button',
          className: 'dla-chat-skin' + (p.skin === name ? ' on' : ''),
          'data-skin': name,
          title: SKIN_TITLE[name],
          onMouseDown: (ev) => ev.stopPropagation(),
          onClick: () => p.applySkin(name),
        })),
      )
    }
    function chatHead(p) {
      const shown = p.histOpen && p.pane !== 'local'
        ? (typeof p.title === 'string' ? (p.title + ' · 聊天记录') : p.title)
        : p.title
      return h('header', { className: 'dla-chat-head', onMouseDown: p.startMove },
        h('span', { className: 'dla-chat-head-title' }, shown),
        h('span', { className: 'dla-chat-head-actions', onMouseDown: (ev) => ev.stopPropagation() },
          p.pane === 'local' ? h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: p.backFromSetup }, '返回聊天') : chatSkins(p),
          p.extra || null,
          p.pane === 'local' ? null : h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: p.onClose }, '关闭'),
        ),
      )
    }
    const AV_COLORS = ['#4176e6', '#3d8b6e', '#c07a2a', '#8b5cf6', '#db5a6b', '#0ea5a0', '#2563eb', '#d97706']
    function avColor(id) {
      const s = String(id || '')
      let n = 0
      for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0
      return AV_COLORS[n % AV_COLORS.length]
    }
    function ico(title, onClick, disabled, children, on, label) {
      return h('button', {
        type: 'button',
        className: 'dla-chat-ico' + (on ? ' on' : '') + (label ? ' has-lab' : ''),
        title,
        disabled: !!disabled,
        onClick: (ev) => {
          if (ev && ev.stopPropagation) ev.stopPropagation()
          if (onClick) onClick(ev)
        },
        'aria-label': title,
      },
        h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' }, children),
        label ? h('span', { className: 'dla-chat-ico-lab' }, label) : null,
      )
    }
    function icoPath(d) {
      return h('path', { d, stroke: 'currentColor', strokeWidth: '1.4', strokeLinecap: 'round', strokeLinejoin: 'round' })
    }
    function icoCircle(cx, cy, r) {
      return h('circle', { cx, cy, r, stroke: 'currentColor', strokeWidth: '1.4' })
    }
    function tog(checked, onChange) {
      return h('label', { className: 'dla-chat-switch' },
        h('input', { type: 'checkbox', checked: !!checked, onChange: (ev) => onChange(!!ev.target.checked) }),
        h('span', { className: 'dla-chat-tog' }),
      )
    }
    function setupField(label, input) {
      return h('label', { className: 'dla-chat-field' }, h('span', null, label), input)
    }
    function oversizeNames(list) {
      return (list || []).filter((f) => f.over).map((f) => f.name)
    }
    function listedLookupsOf(state) {
      return (state && state.lookups && state.lookups.length)
        ? state.lookups
        : [{ id: 'default', dialect: 'nocobase', system: '', env: '', baseUrl: '', hasToken: false }]
    }
    function lookupDraftOf(row, drafts) {
      return Object.assign({
        id: row.id,
        dialect: row.dialect || 'nocobase',
        system: row.system || '',
        env: row.env || '',
        baseUrl: row.baseUrl || '',
        listPath: row.listPath || '',
        writePath: row.writePath || '',
        ticketField: row.ticketField || '',
        statusField: row.statusField || '',
        ownerField: row.ownerField || '',
        token: '',
        hasToken: !!row.hasToken,
      }, (drafts && drafts[row.id]) || {})
    }
    function sendLabelOf(p) {
      return p.sending ? '正在发…'
        : (p.pane === 'slip' || p.pane === 'brief' || p.pane === 'local') ? '本机不发消息'
          : p.pane === 'group' ? (p.topic ? '跟帖' : '发新话题')
            : p.pending ? '再发' : '发送'
    }
    function paneCueOf(pane, topic) {
      return ({
        slip: '记下才留。到点再提醒。不发消息。',
        brief: '工作日开口一句。跟待办分开。',
        group: topic ? '跟帖只进这条。采纳按整个群开工。' : '下面发出去是新话题。会签只在话题里。',
      })[pane] || ''
    }
    function peerFromSpeakOf(peers, text) {
      const s = String(text || '').toLowerCase()
      const hit = (peers || []).find((p) => {
        const name = String(p.note || p.displayName || '').toLowerCase()
        return name && s.indexOf(name) >= 0
      })
      return hit ? hit.id : ''
    }
    function cuePeerOfRow(state, peers, row) {
      if (row && row.peerId) return row.peerId
      const req = ((state && state.requests) || []).find((r) => r.id === row.requestId)
      return (req && (req.kind === 'incoming' ? req.from : (req.to || [])[0])) || peerFromSpeakOf(peers, row.speak)
    }
    function cueIsHereOf(p, row) {
      if (!row) return false
      const req = ((p.state && p.state.requests) || []).find((r) => r.id === row.requestId)
      const here = {
        brief: () => p.pane === 'brief',
        nudge: () => p.pane === 'slip',
        'nudge-ask': () => p.pane === 'slip',
      }
      return here[row.kind]
        ? here[row.kind]()
        : (req && req.groupId
          ? p.pane === 'group' && p.groupId === req.groupId && (!req.topic || p.topicId === req.id)
          : !!(cuePeerOfRow(p.state, p.peers, row) && p.pane === 'chat' && p.peerId === cuePeerOfRow(p.state, p.peers, row)))
    }
    function noteKeyOf(p) {
      return (p.pane === 'group' && p.topic && ('t:' + p.topic.id))
        || (p.pane === 'group' && ('g:' + p.groupId))
        || (p.pane === 'slip' && 'slip')
        || (p.pane === 'brief' && 'brief')
        || ('p:' + (p.peerId || p.who || 'chat'))
    }
    function sendPathOf(p) {
      return (p.pane === 'slip' || p.pane === 'brief' || p.pane === 'local') && 'local'
        || (p.pane !== 'group' && p.peerId && p.peerId === p.selfId && 'self')
        || (p.files && p.files.some((f) => f.over) && 'over')
        || (p.pane === 'group' && !p.group && 'noGroup')
        || (p.pane === 'group' && !p.body && 'empty')
        || (p.pane === 'group' && p.topic && 'topicReply')
        || (p.pane === 'group' && 'topicNew')
        || (!p.peerId && 'noPeer')
        || (!p.body && !p.pending && 'empty')
        || (p.pending && 'pending')
        || 'compose'
    }
    const SEND_REFUSE = {
      local: '本机页不发消息。',
      self: '不能发给本机。',
      over: '有附件超限，去掉才能发。',
      noGroup: '先选一个话题群',
      empty: '还没有要发的话',
      noPeer: '还没有聊天对象',
    }
    function shownCueOf(cues, cueIdx, isHere) {
      if (!cues.length) return null
      for (let i = 0; i < cues.length; i++) {
        const row = cues[(cueIdx + i) % cues.length]
        if (!isHere(row)) return row
      }
      return null
    }
    function nextCueIdx(cues, cueIdx, isHere) {
      if (cues.length < 2) return -1
      for (let i = 1; i <= cues.length; i++) {
        const idx = (cueIdx + i) % cues.length
        if (!isHere(cues[idx])) return idx
      }
      return -1
    }
    function goCueJump(p, row) {
      const req = ((p.state && p.state.requests) || []).find((r) => r.id === row.requestId)
      const jump = {
        brief: () => p.setPane('brief'),
        nudge: () => p.setPane('slip'),
        'nudge-ask': () => p.setPane('slip'),
      }
      if (jump[row.kind]) return jump[row.kind]()
      if (req && req.groupId) {
        p.setPane('group')
        p.setGroupId(req.groupId)
        p.setTopicId(req.topic ? req.id : '')
        return
      }
      const who = cuePeerOfRow(p.state, p.peers, row)
      who ? (p.setPane('chat'), p.setWho(who)) : p.say('这条没有可跳的人。')
    }
    function peerCardFields(peer) {
      return peer && {
        kind: 'peer',
        id: peer.id,
        note: peer.note || '',
        staffId: peer.staffId || '',
        door: peer.door || '',
        pin: !!peer.pin,
        mute: !!peer.mute,
      }
    }
    function groupCardFields(group) {
      return group && {
        kind: 'group',
        id: group.id,
        name: group.name || '',
        members: (group.members || []).slice(),
        pin: !!group.pin,
        mute: !!group.mute,
      }
    }
    function lookupSaveBody(d) {
      const body = {
        id: d.id,
        dialect: d.dialect,
        system: d.system,
        env: d.env,
        baseUrl: d.baseUrl,
        listPath: d.listPath,
        writePath: d.writePath,
        ticketField: d.ticketField,
        statusField: d.statusField,
        ownerField: d.ownerField,
      }
      String(d.token || '').trim() && (body.token = d.token)
      return body
    }
    function draftReplyMiss(pane, topic) {
      return pane === 'group' ? (topic ? '这条不是对方发来的，不能拟回' : '先点开话题再拟回') : '这个人没有对方消息可拟'
    }
    function adoptMissSpeak(state, need, nods) {
      const miss = (need || []).filter((id) => (nods || []).indexOf(id) < 0)
      return miss.length ? ('会签还差 ' + miss.map((id) => peerNameOf(state, id)).join('、') + ' 点头。') : ''
    }
    function persistJson(key, value) {
      try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)) } catch { /* quota */ }
    }
    function resultSpeak(result, ok, fail) {
      return result && result.ok === false ? (result.hint || result.error || fail) : ok
    }
    function ctxPos(ev, boxW, boxH) {
      const vw = (typeof window !== 'undefined' && window.innerWidth) || 1280
      const vh = (typeof window !== 'undefined' && window.innerHeight) || 800
      return {
        x: Math.min(Math.max(8, ev.clientX), Math.max(8, vw - boxW)),
        y: Math.min(Math.max(8, ev.clientY), Math.max(8, vh - boxH)),
      }
    }
    function withdrawTargetsOf(pane, req, peerId) {
      return pane === 'group' ? ((req && req.to) || []).slice() : (peerId ? [peerId] : [])
    }
    function withdrawFailSpeak(last) {
      return last && last.error === 'ALREADY_READ' ? '对方已读，不能撤。' : ((last && (last.hint || last.error)) || '没撤成')
    }
    function precedentNote(result) {
      const miss = result && result.error === 'NO_SEMANTIC' ? '没装语义，手写照样能发。' : ((result && result.hint) || '图里没有能当依据的节点。')
      return result && result.ok && result.advice
        ? { text: String(result.advice.speak || '图里查到的依据。不是聊天原文。'), say: '先例进线程。不是自动发出。' }
        : { text: miss, say: miss }
    }
    function pendingFileMiss(f) {
      return (f && f.name ? f.name : '文件') + (f && f.over ? ' 超过 200MB' : ' 没有字节')
    }
    function peerSavedSpeak(pin, mute) {
      return '已保存备注' + (pin ? ' · 置顶' : '') + (mute ? ' · 免打扰' : '') + '。对面名字没改。'
    }
    function downloadJson(name, data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = name
      a.click()
      URL.revokeObjectURL(a.href)
    }
    const CUE_INBOX = { asked: 1, reply: 1, chase: 1, cosign: 1, nudge: 1, 'nudge-ask': 1, brief: 1 }
    function inboxCuesOf(inbox) {
      return (inbox || []).filter((item) => item && item.speak && CUE_INBOX[item.kind])
    }
    function unreadWeight(req, selfId) {
      if (!letterUnread(req, selfId)) return 0
      if (req.kind === 'outgoing') {
        const n = Array.isArray(req.replies) ? req.replies.length : Number(req.replies || 0)
        return Math.max(1, n - Number(req.seenReplies || 0))
      }
      return 1
    }
    function chatBadgeOf(state, selfId) {
      const n = ((state && state.requests) || []).reduce((sum, req) => sum + unreadWeight(req, selfId), 0)
      return n + (state && state.pairAsk ? 1 : 0)
    }
    function peerUnreadCount(state, peerId, selfId) {
      return lettersWithPeer(state, peerId, selfId).reduce((sum, req) => {
        if (req.kind === 'incoming' && req.from !== peerId) return sum
        if (req.kind === 'outgoing' && (req.to || []).indexOf(peerId) < 0) return sum
        return sum + unreadWeight(req, selfId)
      }, 0)
    }
    function sendAttachOf(files) {
      return (files || []).filter((f) => !f.over && f.data)
    }
    function sendBodyOf(text, attach) {
      const excerpt = String(text || '').replace(/^\s+|\s+$/g, '')
      return excerpt || (attach.length ? '(附件)' : '')
    }
    function localNoteRow(tag, text) {
      return { id: 'n' + Date.now(), from: 'ai', tag: (tag || '本机') + ' · 只在这台', text, at: Date.now(), local: true }
    }
    function pushLocalNote(prev, key, row) {
      const list = (prev[key] || []).slice()
      list.push(row)
      const next = Object.assign({}, prev)
      next[key] = list.slice(-20)
      persistJson('dla-chat-notes', next)
      return next
    }
    function draftSeed(text) {
      return '收到。' + String(text || '').replace(/\s+/g, ' ').slice(0, 36)
    }
    function summaryLines(list) {
      return (list || []).filter((m) => m.text).slice(-8).map((m) => String(m.text || '').replace(/\s+/g, ' ').slice(0, 36))
    }
    function lastThreadText(thread) {
      return ((thread || []).filter((m) => m && m.text).slice(-1)[0] || {}).text
    }
    function movedWin(start, dx, dy) {
      return Object.assign({}, start, { left: Math.max(8, start.left + dx), top: Math.max(8, start.top + dy) })
    }
    function resizedWin(start, edge, dx, dy, maxW, maxH) {
      return {
        w: Math.min(maxW, Math.max(360, start.w + (edge.indexOf('e') >= 0 ? dx : 0) + (edge.indexOf('w') >= 0 ? -dx : 0))),
        h: Math.min(maxH, Math.max(280, start.h + (edge.indexOf('s') >= 0 ? dy : 0) + (edge.indexOf('n') >= 0 ? -dy : 0))),
        left: Math.max(8, start.left + (edge.indexOf('w') >= 0 ? dx : 0)),
        top: Math.max(8, start.top + (edge.indexOf('n') >= 0 ? dy : 0)),
      }
    }
    function atThreadBottom(el) {
      return !!(el && el.scrollHeight - el.scrollTop - el.clientHeight < 48)
    }
    function liveThreadOf(p) {
      return p.pane === 'group' && p.topic
        ? topicThread(p.threadState && p.threadState.requests, p.topic, p.selfId)
        : threadForPeer(p.threadState, p.peerId, p.selfId)
    }
    function askQuoteOf(text, thread) {
      return String(text || '').trim() || (thread || []).slice(-3).map((m) => m.text).join(' / ')
    }
    function needTopicFirst(pane, topic, miss) {
      return pane === 'group' && !topic ? miss : ''
    }
    function adoptFollowSpeak(result, okNote, okSay, fail) {
      return result && result.followed
        ? { note: okNote, say: okSay }
        : { note: '', say: (result && (result.hint || result.followError || result.error)) || fail }
    }
    function setMapKey(prev, key, value, store) {
      const next = Object.assign({}, prev)
      value == null ? delete next[key] : (next[key] = value)
      persistJson(store, next)
      return next
    }
    function restorePlace(prev, setPane, setWho, setGroupId, setTopicId) {
      if (!prev) { setPane('chat'); return }
      setPane(prev.pane || 'chat')
      prev.who && setWho(prev.who)
      prev.groupId && setGroupId(prev.groupId)
      prev.topicId && setTopicId(prev.topicId)
    }
    function patchDraftMap(prev, id, patch) {
      const cur = Object.assign({}, prev)
      cur[id] = Object.assign({}, cur[id] || {}, patch)
      return cur
    }
    function composeBody(body, to, attach, sessionId, ws, extra) {
      return Object.assign({ excerpt: body, to, attachments: attach, sessionId, workspace: ws }, extra || {})
    }
    function composeFailPath(result) {
      return result.error === 'DUP' && result.requestId
        ? { sendId: result.requestId, fail: result.hint || '已经在问。' }
        : { speak: result.hint || result.error || '没拟成' }
    }
    function ctxWhoOf(m, fallback) {
      return m.from === 'me' ? '我' : (m.who || fallback)
    }
    function ctxAskQuote(who, text) {
      return who + '：' + text
    }
    function listenSpeak(granted) {
      return granted ? '关掉软件也能收消息。' : '关掉软件就不再收。'
    }
    function retrySpeak(result) {
      return resultSpeak(result, '再发一次。满 7 天仍失败会标在这条上。', '没再试成')
    }
    function parseRelayInvite(text) {
      const parts = String(text || '').trim().split(/\s+/).filter(Boolean)
      if (parts.length === 3 && parts[2].length === 16 && /^[A-Za-z0-9._-]+$/.test(parts[1]) && /^[A-Za-z0-9._-]+$/.test(parts[2])) {
        return { relay: parts[0], device: parts[1], session: parts[2] }
      }
      return null
    }
    function handshakeReady(code, door) {
      return !!(parseRelayInvite(door) || parseRelayInvite(code) || (String(code || '').trim() && String(door || '').trim()))
    }
    function afterOk(result, ok) {
      result && result.ok !== false && ok()
    }
    function sendRunOf(p) {
      return {
        topicReply: () => p.composeThen(p.group.members || [], { groupId: p.group.id, threadId: p.topic.id }),
        topicNew: () => p.composeThen(p.group.members || [], { groupId: p.group.id }, (id) => p.setTopicId(id)),
        pending: () => p.sendId(p.pending.id, '没发出。稿还在，再点发送。'),
        compose: () => p.composeThen([p.peerId], {}),
      }
    }
    function applyCardFields(fields, setKind, setId, extras) {
      if (!fields) return
      setKind(fields.kind)
      setId(fields.id)
      extras(fields)
    }
    function adoptOpenMiss(pane, adoptable, topic) {
      return pane === 'group'
        ? (!adoptable && !topic && '这条话题还没有可采纳的跟帖')
        : (!adoptable && '这个人还没有可采纳的回复')
    }
    function adoptSheetBody(adoptable, pickReplies) {
      const ids = (pickReplies || []).map((id) => String(id || '')).filter(Boolean)
      return {
        ...letterRef(adoptable),
        replyIds: ids.length ? ids : undefined,
      }
    }
    function boxHOf(start, sy, clientY) {
      return Math.min(280, Math.max(48, start + (sy - clientY)))
    }
    function summaryJoin(lines) {
      return (lines || []).join(' · ')
    }
    function askLocalBody(quote, sessionId, ws, kind) {
      const body = { quote, sessionId, workspace: ws || '' }
      kind && (body.kind = kind)
      return body
    }
    function ctxAdoptQuote(m) {
      return m.from === 'them' ? String(m.replyIndex) : undefined
    }
    function exportSpeak(ok) {
      return ok ? '流水已导出。口令不在里面。' : '导出失败。'
    }
    function groupUpdateBody(id, name, members, pin, mute) {
      return { groupId: id, name, members, pin, mute }
    }
    function nodSpeak(result, name) {
      return resultSpeak(result, name + ' 已点头。', '没点成')
    }
    function attachGetPath(requestId, index) {
      return '/attach?requestId=' + encodeURIComponent(requestId) + '&index=' + encodeURIComponent(index)
    }
    function attachMiss(got) {
      return (got && (got.hint || got.error)) || '没有可预览的字节。'
    }
    function clipCodeOf(pairCode) {
      return pairCode && pairCode.code
    }
    function oversizeSpeak(names) {
      return names.length ? names.join('、') + ' 超过 200MB，不能发出。' : ''
    }
    function ctxActRun(p) {
      const m = p.m
      const who = ctxWhoOf(m, p.peerName)
      return {
        ask: () => p.ask(who, m),
        draft: () => p.draft(m),
        adopt: () => p.adopt(ctxAdoptQuote(m)),
        withdraw: () => p.withdraw(m.requestId),
        tr: () => p.tr(m.id, m.text),
        slip: () => p.slip(m),
        forward: () => p.forward && p.forward(m),
        board: () => p.board && p.board(m),
      }
    }
    function peerCardPosts(id, note, staffId, door, pin, mute) {
      const rows = [
        ['/note', { peerId: id, note }],
        ['/staff', { peerId: id, staffId }],
        ['/peer/flags', { peerId: id, pin, mute }],
      ]
      String(door || '').trim() && rows.splice(2, 0, ['/door', { peerId: id, door }])
      return rows
    }
    function canFocusBox(pane) {
      return pane !== 'local' && pane !== 'slip' && pane !== 'brief'
    }
    function pinThreadEl(el) {
      if (!el) return
      el.scrollTop = el.scrollHeight
      typeof requestAnimationFrame === 'function' && requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
    }
    function cardRowOf(kind, id, peers, groups) {
      return kind === 'peer' ? (peers || []).find((p) => p.id === id) || null
        : kind === 'group' ? (groups || []).find((g) => g.id === id) || null
          : null
    }
    function sameOpenGroup(groupId, cardId) {
      return groupId === cardId
    }
    function draftLetterOf(pane, topic, incoming) {
      return pane === 'group' ? topic : incoming
    }
    function isIncomingLetter(letter) {
      return !!(letter && letter.kind === 'incoming')
    }
    function draftFollowedSpeak(followed, result) {
      return followed ? '拟回进本机会话。写成回信会进下面输入框。点发送才发出。' : ((result && (result.hint || result.error)) || '没拟成')
    }
    function probeSavedSpeak(last) {
      return last && last.ok === false ? (last.error || '没记下') : '查单已记下。口令不随消息走。'
    }
    function dropDraftId(prev, id) {
      const next = Object.assign({}, prev)
      delete next[id]
      return next
    }
    function letterKey(id) {
      const raw = String(id || '')
      return /:(v|r)\d+$/.test(raw) ? raw.slice(0, raw.lastIndexOf(':')) : raw
    }
    function reqById(state, id) {
      const key = letterKey(id)
      return ((state && state.requests) || []).find((row) => row && (row.id === id || row.id === key))
    }
    function letterRef(req) {
      const mid = req && Array.isArray(req.messages) && req.messages[0] && req.messages[0].id
      return mid ? { messageId: mid } : { requestId: req && req.id }
    }
    function groupCreateBody(name, members) {
      return { name, members }
    }
    function selfDisplayName(state, myName) {
      return myName || (state && state.self && state.self.displayName)
    }
    function sendPackOf(p) {
      const attach = sendAttachOf(p.files)
      const body = sendBodyOf(p.text, attach)
      return {
        attach,
        body,
        ws: workspaceOf(p.session) || '',
        path: sendPathOf(Object.assign({}, p, { body, files: p.files })),
      }
    }
    function cosignMissOf(state, group, adoptable) {
      return adoptable && adoptable.cosign && adoptable.cosign.on
        ? adoptMissSpeak(state, (group && group.members) || adoptable.to || [], adoptable.cosign.nods || [])
        : ''
    }
    function overlayPaneOf(pane) {
      return ({ slip: 1, brief: 1, local: 1, group: 1 })[pane] ? pane : 'chat'
    }
    function skinClass(skin) {
      return skin !== 'paper' ? ' skin-' + skin : ''
    }
    function handshakeBody(code, door) {
      const invite = parseRelayInvite(door) || parseRelayInvite(code)
      if (invite) return { session: invite.session, device: invite.device }
      return { peerCode: String(code || '').trim(), door: String(door || '').trim() }
    }
    function groupMadeOf(result) {
      return result && result.ok === false
        ? { speak: result.hint || result.error || '没建成' }
        : { groupId: result && result.groupId, speak: '话题群已建。发一条就是新话题。' }
    }
    function withdrawStep(last) {
      return last && last.ok === false ? withdrawFailSpeak(last) : ''
    }
    function applyAdoptSpeak(speak, noteLocal, say) {
      speak.note && noteLocal('采纳 · 本机 DSH + 插件', speak.note)
      say(speak.say)
    }
    function pendingSendSpeak() {
      return '拟好了没发出。再点发送。'
    }
    function winStyleOf(win) {
      return { width: win.w + 'px', height: win.h + 'px', left: win.left + 'px', top: win.top + 'px', bottom: 'auto' }
    }
    function winClassOf(pane, rail) {
      return 'dla-chat-win' + (pane === 'local' ? ' is-setup' : '') + (rail && pane !== 'local' ? ' is-rail' : '')
    }
    function chatRail(p) {
      const sheet = p.sheet
      const write = p.write
      if (!sheet && !write) return null
      const speak = (sheet && (sheet.speak || ((sheet.kind || '') + ' · ' + (sheet.action || ''))))
        || (write && write.speak)
        || '待确认'
      return h('aside', { className: 'dla-chat-rail' },
        h('p', { className: 'dla-sheet-kicker' }, '业务页'),
        h('p', { className: 'dla-sec-row-speak' }, speak),
        h('button', {
          type: 'button',
          className: 'dla-btn dla-btn-primary',
          onClick: () => {
            try { window.dispatchEvent(new CustomEvent('dla-open-biz')) } catch { /* ignore */ }
          },
        }, '打开业务页'),
      )
    }
    const GRIP_EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
    function unreadBadge(n) {
      return n > 0 ? h('span', { className: 'dla-ask-unread' }, n > 9 ? '9+' : String(n)) : null
    }
    function overlayPortal(overlay) {
      return overlay && createPortal && typeof document !== 'undefined' && document.body
        ? createPortal(overlay, document.body)
        : overlay
    }
    function askLocalMiss(quote, sessionId) {
      return !quote ? '还没有要问的' : (!sessionId ? '这条对话还没绑上，不能问本机。' : '')
    }
    function askLocalOkSpeak() {
      return { note: '本机正在查这条线程。工具和已装插件都能用。不自动发出。', say: '已领进本机会话。发送键仍只发给人。' }
    }
    function groupPaneOf(group, topic) {
      return !group ? 'empty' : (!topic ? 'topics' : 'follow')
    }
    function popMenusOff(setCtxMenu, setEmoOpen) {
      setCtxMenu(null)
      setEmoOpen(false)
    }
    function applyAskResult(result, note, sayText, noteLocal, say, fail) {
      result && result.ok === false
        ? say(result.hint || result.error || fail)
        : (noteLocal('问本机 · 本机开工', note), say(sayText))
    }
    function ctxAskOkSpeak() {
      return { note: '这条已领进本机。发送键仍只发给人。', say: '这条已领进本机。' }
    }
    function slipSavedSpeak(result) {
      return result && result.ok === false ? (result.hint || result.error || '没记下') : '已摘进待办。记下才留。'
    }
    function sendPosted(sent, fail, say, sendFail, after, id, clear, refresh) {
      return sent && sent.ok === false
        ? (say(sendFail(sent, fail)), refresh())
        : ((after && after(id)), clear())
    }
    function composeNext(result, sendId, after, say) {
      const fail = result && result.ok === false && composeFailPath(result)
      return fail
        ? (fail.sendId ? sendId(fail.sendId, fail.fail, after) : say(fail.speak))
        : sendId(result.requestId, pendingSendSpeak(), after)
    }
    function draftNoteSpeak(followed, result, noteLocal, say) {
      followed && noteLocal('拟回 · 本机 DSH + 插件', '已调度当前 DSH 会话拟回（工具和已装插件都能用）。写成回信会进下面输入框，还没发出。')
      say(draftFollowedSpeak(followed, result))
    }
    function ctxDraftSpeak() {
      return '稿进了输入框。点发送才发出。'
    }
    function exportFailSpeak(got) {
      return (got && got.error) || '没导出'
    }
    function withSending(setSending, live, run) {
      setSending(true)
      return Promise.resolve(run()).finally(() => live.current && setSending(false))
    }
    const ADOPT_PEER = [
      '已领进当前 DSH 会话。一对一只带眼前这个人。要几个人一起点头，去话题群。',
      '已采纳。本机会话开工，不是发消息。',
    ]
    const ADOPT_GROUP = [
      '已领进当前 DSH 会话。这一轮能用本机工具和已装插件。聊天窗不自动发出。',
      '已开工。不是发消息、不是过账。',
    ]
    function openAdoptSheet(quote, setPickReplies, setAdoptOpen) {
      quote && setPickReplies([quote])
      setAdoptOpen(true)
    }
    function precedentScenario(text, last, fallback) {
      return text || last || fallback
    }
    function clipFilesOf(ev) {
      const clip = ev && ev.clipboardData
      return clip && clip.files && clip.files.length ? clip.files : null
    }
    function focusEl(el) {
      el && (() => { try { el.focus() } catch { /* ignore */ } })()
    }
    function sendBusy(sending) {
      return !!sending
    }
    function applyGroupMade(made, setNewGroupName, setPickedMembers, setNewgOpen, setGroupId, setTopicId, setPane) {
      setNewGroupName('')
      setPickedMembers([])
      setNewgOpen(false)
      setGroupId(made.groupId)
      setTopicId('')
      setPane('group')
    }
    function sessionBoundMiss(sessionId) {
      return sessionId ? '' : '这条对话还没绑上，不能问本机。'
    }
    function resizeMax() {
      return {
        w: Math.max(360, (typeof window !== 'undefined' && window.innerWidth) - 24 || 360),
        h: Math.max(280, (typeof window !== 'undefined' && window.innerHeight) - 80 || 280),
      }
    }
    function canCopyPair(code) {
      return !!(code && typeof navigator !== 'undefined' && navigator.clipboard)
    }
    function dropFilesOf(ev) {
      return ev && ev.dataTransfer && ev.dataTransfer.files
    }
    function refuseSendOf(path, say) {
      return SEND_REFUSE[path] ? (say(SEND_REFUSE[path]), true) : false
    }
    function ctxMenuOf(ev, m) {
      return Object.assign({ m }, ctxPos(ev, 168, 300))
    }
    function lookupAddBody() {
      return { add: true, baseUrl: '', system: '', env: '' }
    }
    function lookupRemoveBody(id) {
      return { id, remove: true }
    }
    function pinLatest(pinRef, setPinBottom, el) {
      pinRef.current = true
      setPinBottom(true)
      pinThreadEl(el)
    }
    function nextCueSpeak(idx, say, setCueIdx) {
      idx < 0 ? say('没有下一条。') : setCueIdx(idx)
    }
    function overlayIfOpen(open, node) {
      return open ? node : null
    }
    function listenToggleBody(state) {
      return { on: !(state && state.listenGranted) }
    }
    function setupPlaceOf(pane, who, groupId, topicId) {
      return { pane, who, groupId, topicId }
    }
    function threadRowsOf(live, notes, key) {
      return live.concat((notes && notes[key]) || []).sort((a, b) => (a.at || 0) - (b.at || 0))
    }
    function attachReady(got) {
      return !!(got && got.ok !== false && got.data)
    }
    function pendingReady(f) {
      return !!(f && !f.over && f.data)
    }
    function adoptPeerSpeak(result) {
      return adoptFollowSpeak(result, ADOPT_PEER[0], ADOPT_PEER[1], '没采纳成')
    }
    function adoptGroupSpeak(result) {
      return adoptFollowSpeak(result, ADOPT_GROUP[0], ADOPT_GROUP[1], '没采纳成')
    }
    function sayMiss(say, miss) {
      return miss ? (say(miss), true) : false
    }
    function summaryMiss(lines) {
      return lines && lines.length ? '' : '还没有可摘要的往来'
    }
    function probeLastOf(last, next) {
      return next && next.ok === false ? next : last
    }
    function goCueNow(row, setHistOpen, setEmoOpen, jump) {
      if (!row) return
      setHistOpen(false)
      setEmoOpen(false)
      jump(row)
    }
    function pinOnScroll(el, pinRef, pinBottom, setPinBottom) {
      if (!el) return
      const atBottom = atThreadBottom(el)
      pinRef.current = atBottom
      atBottom !== pinBottom && setPinBottom(atBottom)
    }
    function clearComposer(setText, setFiles, refresh, skipRef, sent, lastRef) {
      skipRef && (skipRef.current = String(sent || ''))
      lastRef && (lastRef.current = '')
      setText('')
      setFiles([])
      refresh()
    }
    function adoptGroupPane(pane) {
      return pane === 'group'
    }
    function groupMadeMiss(made) {
      return made && made.groupId ? '' : ((made && made.speak) || '没建成')
    }
    function withdrawOkSpeak() {
      return '已撤回。'
    }
    function askFailSpeak(result, fail) {
      return result && result.ok === false ? (result.hint || result.error || fail) : ''
    }
    function slipGoSpeak(result, setPane, say, refresh) {
      const miss = slipSavedSpeak(result)
      return result && result.ok === false
        ? (say(miss), true)
        : (setPane('slip'), say(miss), refresh(), false)
    }
    function exportThen(got, say) {
      const fail = got && got.ok === false && exportFailSpeak(got)
      return fail
        ? (say(fail), true)
        : (downloadJson('lan-assist-ledger.json', got), say(exportSpeak(true)), false)
    }
    function incomingMiss(letter, pane, topic) {
      return isIncomingLetter(letter) ? '' : draftReplyMiss(pane, topic)
    }
    function applyAskOk(noteLocal, say) {
      const ok = askLocalOkSpeak()
      noteLocal('问本机 · 本机开工', ok.note)
      say(ok.say)
    }
    function trSpeak() {
      return '译文贴在原句下。不是另发一条。'
    }
    function sumSpeak() {
      return '摘要在线程上方。已叫醒本机。'
    }
    function attachOpenMiss(got) {
      return attachReady(got) ? '' : attachMiss(got)
    }
    function probeBroke(last) {
      return last && last.ok === false
    }
    function handshakeMiss(code, door) {
      return handshakeReady(code, door) ? '' : '配对码和对方地址都要填。中继邀请整行贴到地址栏。'
    }
    function adoptableMiss(adoptable) {
      return adoptable ? '' : '这条话题还没有可采纳的跟帖'
    }
    function skinNameOf(name) {
      return name || 'paper'
    }
    function ctxRowOf(menu) {
      return menu && menu.m
    }
    function sendOpsOf(p) {
      async function clear() {
        clearComposer(p.setText, p.setFiles, p.refresh, p.skipDraftRef, p.body, p.lastDraftRef)
        p.dropHandoff && p.dropHandoff()
      }
      async function sendId(id, fail, after) {
        const sent = await p.post('/send', { requestId: id })
        await sendPosted(sent, fail, p.say, p.sendFail, after, id, clear, p.refresh)
      }
      async function composeThen(to, extra, after) {
        const result = await p.post('/compose', composeBody(p.body, to, p.attach, p.sessionId, p.ws, extra))
        await composeNext(result, sendId, after, p.say)
      }
      return { composeThen, sendId }
    }
    async function withdrawAll(post, requestId, targets, say, refresh) {
      for (let i = 0; i < targets.length; i++) {
        const fail = withdrawStep(await post('/withdraw', { ...(/:(v|r)\d+$/.test(String(requestId)) ? { messageId: requestId } : { requestId }), peerId: targets[i] }))
        if (fail) { say(fail); refresh(); return }
      }
      say(withdrawOkSpeak())
      refresh()
    }
    function sendReadyOf(p) {
      const pack = sendPackOf(p)
      return refuseSendOf(pack.path, p.say) ? null : pack
    }
    function adoptHereNext(pane, quote, setPickReplies, setAdoptOpen) {
      return adoptGroupPane(pane)
        ? (openAdoptSheet(quote, setPickReplies, setAdoptOpen), true)
        : false
    }
    function writeSummary(setSummaries, key, line) {
      setSummaries((prev) => setMapKey(prev, key, line, 'dla-chat-sum'))
    }
    function wakeSummary(post, sessionId, lines, ws) {
      sessionId && post('/ask-local', askLocalBody(lines.join('\n'), sessionId, ws, 'summary')).catch(() => undefined)
    }
    function applyPrecedent(result, noteLocal, say) {
      const note = precedentNote(result)
      noteLocal('先例 · 图里查到的', note.text)
      say(note.say)
    }
    function mergeFiles(setFiles, next, say) {
      next.length && setFiles((prev) => prev.concat(next))
      const miss = oversizeSpeak(oversizeNames(next))
      miss && say(miss)
    }
    async function saveProbeAll(post, rows, draftOf) {
      let last = { ok: true }
      for (let i = 0; i < rows.length; i++) {
        last = probeLastOf(last, await post('/lookup/config', lookupSaveBody(draftOf(rows[i]))))
        if (probeBroke(last)) break
      }
      return last
    }
    function persistBoxH(setBoxH, h) {
      setBoxH(h)
      persistJson('dla-chat-boxh', String(h))
    }
    function pendingMiss(f) {
      return pendingReady(f) ? '' : pendingFileMiss(f)
    }
    async function ctxAskNow(p, who, row) {
      if (sayMiss(p.say, sessionBoundMiss(p.sessionId))) return
      const result = await p.post('/ask-local', askLocalBody(ctxAskQuote(who, row.text), p.sessionId, p.ws))
      const ok = ctxAskOkSpeak()
      applyAskResult(result, ok.note, ok.say, p.noteLocal, p.say, '没有问成')
    }
    async function ctxDraftNow(p, row) {
      p.setText(draftSeed(row.text))
      p.incoming ? await p.draftReply() : p.say(ctxDraftSpeak())
    }
    async function sendNowRun(p) {
      if (sendBusy(p.sending)) return
      const pack = sendReadyOf(p)
      if (!pack) return
      const ops = sendOpsOf(Object.assign({}, p, pack))
      const run = sendRunOf(Object.assign({}, p, ops))
      await withSending(p.setSending, p.live, () => run[pack.path]())
    }
    function dueInputOf(ms) {
      const n = Number(ms)
      const d = new Date(Number.isFinite(n) && n > 0 ? n : Date.now() + 24 * 60 * 60 * 1000)
      const pad = (n) => String(n).padStart(2, '0')
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes())
    }
    function dueAtFromInput(s) {
      const t = Date.parse(String(s || '').replace('T', ' '))
      return Number.isFinite(t) ? t : 0
    }
    function dueGuessMs(text) {
      const s = String(text || '')
      const now = Date.now()
      if (/半[个]?小时/.test(s)) return now + 30 * 60 * 1000
      const minutes = s.match(/(\d+)\s*分钟/)
      if (minutes) return now + Number(minutes[1]) * 60 * 1000
      const hours = s.match(/(\d+)\s*小时/)
      if (hours) return now + Number(hours[1]) * 60 * 60 * 1000
      if (/明天/.test(s)) return now + 24 * 60 * 60 * 1000
      if (/后天/.test(s)) return now + 2 * 24 * 60 * 60 * 1000
      return now + 24 * 60 * 60 * 1000
    }
    function ctxSlipNow(p, row) {
      p.setSlipAsk({ quote: String((row && row.text) || '').trim(), due: dueInputOf(dueGuessMs(row && row.text)) })
    }
    async function runCtxAct(p, act) {
      const m = ctxRowOf(p.ctxMenu)
      p.setCtxMenu(null)
      const run = m && ctxActRun(Object.assign({ m }, p))
      run && run[act] && await run[act]()
    }
    function dragMove(ev, win, persistWin) {
      const sx = ev.clientX
      const sy = ev.clientY
      const start = { ...win }
      dragOn(ev, (next) => persistWin(movedWin(start, next.clientX - sx, next.clientY - sy)))
    }
    function dragResize(ev, win, edge, persistWin) {
      const sx = ev.clientX
      const sy = ev.clientY
      const start = { ...win }
      dragOn(ev, (next) => {
        const max = resizeMax()
        persistWin(resizedWin(start, edge, next.clientX - sx, next.clientY - sy, max.w, max.h))
      })
    }
    function probeEnds(index, rows) {
      return { last: index === rows.length - 1, many: rows.length > 1 }
    }
    async function confirmAdoptNow(p) {
      if (sayMiss(p.say, adoptableMiss(p.adoptable))) return
      if (sayMiss(p.say, cosignMissOf(p.state, p.group, p.adoptable))) return
      const result = await p.post('/adopt', adoptSheetBody(p.adoptable, p.pickReplies))
      p.setAdoptOpen(false)
      applyAdoptSpeak(adoptGroupSpeak(result), p.noteLocal, p.say)
      p.refresh()
    }
    async function makeGroupNow(p) {
      const result = await p.post('/group/create', groupCreateBody(p.newGroupName, p.pickedMembers))
      const made = groupMadeOf(result)
      if (sayMiss(p.say, groupMadeMiss(made))) return
      applyGroupMade(made, p.setNewGroupName, p.setPickedMembers, p.setNewgOpen, p.setGroupId, p.setTopicId, p.setPane)
      p.say(made.speak)
      p.refresh()
    }
    async function askLocalNow(p) {
      if (sayMiss(p.say, needTopicFirst(p.pane, p.topic, '先点开话题再问本机。'))) return
      const quote = askQuoteOf(p.text, liveThreadOf(p))
      if (sayMiss(p.say, askLocalMiss(quote, p.sessionId))) return
      const result = await p.post('/ask-local', askLocalBody(quote, p.sessionId, workspaceOf(p.session)))
      if (sayMiss(p.say, askFailSpeak(result, '没有问成'))) return
      applyAskOk(p.noteLocal, p.say)
    }
    function summarizeNow(p) {
      if (sayMiss(p.say, needTopicFirst(p.pane, p.topic, '先点开话题再摘要。'))) return
      const lines = summaryLines(liveThreadOf(p))
      if (sayMiss(p.say, summaryMiss(lines))) return
      writeSummary(p.setSummaries, p.noteKey(), summaryJoin(lines))
      wakeSummary(p.post, p.sessionId, lines, workspaceOf(p.session))
      p.say(sumSpeak())
    }
    function openPeerNow(id, peers, setCardKind, setCardId, extras) {
      applyCardFields(peerCardFields(peers.find((row) => row.id === id)), setCardKind, setCardId, extras)
    }
    function openGroupNow(id, groups, setCardKind, setCardId, extras) {
      applyCardFields(groupCardFields(groups.find((row) => row.id === id)), setCardKind, setCardId, extras)
    }
    function peerCardApply(setCardNote, setCardStaff, setCardDoor, setCardPin, setCardMute) {
      return (fields) => {
        setCardNote(fields.note)
        setCardStaff(fields.staffId)
        setCardDoor(fields.door)
        setCardPin(fields.pin)
        setCardMute(fields.mute)
      }
    }
    function groupCardApply(setCardGroupName, setCardMembers, setCardPin, setCardMute) {
      return (fields) => {
        setCardGroupName(fields.name)
        setCardMembers(fields.members)
        setCardPin(fields.pin)
        setCardMute(fields.mute)
      }
    }
    function escapeClose(p) {
      const stop = [
        [p.ctxMenu, () => p.setCtxMenu(null)],
        [p.danger, () => p.setDanger(null)],
        [p.preview, () => p.setPreview(null)],
        [p.slipAsk, () => p.setSlipAsk(null)],
        [p.forwardAsk, () => p.setForwardAsk(null)],
        [p.adoptOpen, () => p.setAdoptOpen(false)],
        [p.newgOpen, () => p.setNewgOpen(false)],
        [p.cardId, p.closeCard],
        [p.emoOpen, () => p.setEmoOpen(false)],
        [p.histOpen, () => p.setHistOpen(false)],
        [p.pane === 'group' && p.topicId, () => p.setTopicId('')],
        [p.pane === 'local', p.backFromSetup],
      ]
      const hit = stop.find((row) => row[0])
      hit ? hit[1]() : p.onToggle && p.onToggle()
    }
    function chatPairAsk(p) {
      const ask = p.state && p.state.pairAsk
      const wait = p.state && p.state.pairWait
      return ask ? h('div', { className: 'dla-chat-pair-ask' },
        h('span', { className: 'dla-chat-pair-ask-tx' }, (ask.fromName || '同事') + ' 要和你配对'),
        btn('拒绝', p.rejectPair, 'ghost'),
        btn(ask.ready ? '确定' : '还在握手', ask.ready ? p.acceptPair : undefined, 'primary', !ask.ready),
      ) : wait ? h('div', { className: 'dla-chat-pair-ask wait' },
        h('span', { className: 'dla-chat-pair-ask-tx' }, '已发给 ' + (wait.displayName || '对面') + '，等对方点确定'),
      ) : null
    }
    async function acceptPairNow(p) {
      const result = await p.post('/pair/accept', {})
      if (sayMiss(p.say, result && result.ok === false ? (result.hint || result.error || '没配上') : '')) return
      result.peerId && (p.setWho(result.peerId), p.setPane('chat'), typeof openChatHook === 'function' && openChatHook(result.peerId))
      p.say('已配对。')
      p.refresh()
    }
    async function rejectPairNow(p) {
      await p.post('/pair/reject', {})
      p.say('已拒绝。')
      p.refresh()
    }
    function overlaySheets(p) {
      return [
        chatPairAsk(p),
        p.adoptOpen && p.topic && chatAdoptSheet({
          topic: p.topic, group: p.group, state: p.state, pickReplies: p.pickReplies, setPickReplies: p.setPickReplies,
          toggleCosign: p.toggleCosign, nodHere: p.nodHere, confirmAdoptSheet: p.confirmAdoptSheet, adoptable: p.adoptable, setAdoptOpen: p.setAdoptOpen,
        }),
        p.ctxMenu && overlayPortal(chatCtx({ ctxMenu: p.ctxMenu, ctxAct: p.ctxAct })),
        p.newgOpen && chatNewGroup({
          peers: p.peers, newGroupName: p.newGroupName, setNewGroupName: p.setNewGroupName,
          pickedMembers: p.pickedMembers, setPickedMembers: p.setPickedMembers, setNewgOpen: p.setNewgOpen, makeGroup: p.makeGroup,
        }),
        p.cardKind === 'peer' && p.cardPeer && chatPeerCard({
          peer: p.cardPeer, wsName: p.wsName, cardNote: p.cardNote, setCardNote: p.setCardNote, cardStaff: p.cardStaff, setCardStaff: p.setCardStaff,
          cardDoor: p.cardDoor, setCardDoor: p.setCardDoor, cardPin: p.cardPin, setCardPin: p.setCardPin, cardMute: p.cardMute, setCardMute: p.setCardMute,
          cardId: p.cardId, closeCard: p.closeCard, setDanger: p.setDanger, savePeerCard: p.savePeerCard,
        }),
        p.cardKind === 'group' && p.cardGroup && chatGroupCard({
          group: p.cardGroup, state: p.state, selfId: p.selfId, peers: p.peers, cardGroupName: p.cardGroupName, setCardGroupName: p.setCardGroupName,
          cardMembers: p.cardMembers, setCardMembers: p.setCardMembers, cardPin: p.cardPin, setCardPin: p.setCardPin, cardMute: p.cardMute, setCardMute: p.setCardMute,
          cardId: p.cardId, closeCard: p.closeCard, setDanger: p.setDanger, saveGroupCard: p.saveGroupCard,
        }),
        p.danger && chatDanger({ danger: p.danger, setDanger: p.setDanger, dissolveHere: p.dissolveHere, post: p.post, closeCard: p.closeCard, refresh: p.refresh, say: p.say }),
        p.preview && chatPreview({ preview: p.preview, setPreview: p.setPreview, seeNow: p.seeNow, copyAttach: p.copyAttach, saveWorkspace: p.saveWorkspace, openUniver: p.openUniver }),
        p.slipAsk && chatSlipAsk({ slipAsk: p.slipAsk, setSlipAsk: p.setSlipAsk, confirmSlip: p.confirmSlip }),
        p.forwardAsk && chatForwardAsk({
          forwardAsk: p.forwardAsk, setForwardAsk: p.setForwardAsk, peers: p.peers, confirmForward: p.confirmForward,
        }),
      ]
    }
    async function savePeerNow(p) {
      const rows = peerCardPosts(p.cardId, p.cardNote, p.cardStaff, p.cardDoor, p.cardPin, p.cardMute)
      for (let i = 0; i < rows.length; i++) await p.post(rows[i][0], rows[i][1])
      p.closeCard()
      p.refresh()
      p.say(peerSavedSpeak(p.cardPin, p.cardMute))
    }
    async function saveGroupNow(p) {
      const result = await p.post('/group/update', groupUpdateBody(p.cardId, p.cardGroupName, p.cardMembers, p.cardPin, p.cardMute))
      if (sayMiss(p.say, result && result.ok === false ? (result.hint || result.error || '没记下') : '')) return
      p.closeCard()
      p.refresh()
      p.say('群资料已保存。')
    }
    async function dissolveNow(p) {
      const result = await p.post('/group/dissolve', { groupId: p.cardId })
      if (sayMiss(p.say, result && result.ok === false ? (result.hint || result.error || '没解散') : '')) return
      sameOpenGroup(p.groupId, p.cardId) && (p.setGroupId(''), p.setTopicId(''), p.setPane('group'))
      p.closeCard()
      p.refresh()
      p.say('已解散。话题和跟帖一起删。')
    }
    async function saveSetupNow(p) {
      p.myName.trim() && await p.post('/name', { name: p.myName })
      await p.post('/seat', { staffId: p.staffId, displayName: selfDisplayName(p.state, p.myName) })
      p.say('配置已保存。口令不随消息走。改端口要重启 DSH。')
      p.refresh()
    }
    function copyPairNow(pairCode, say) {
      const code = clipCodeOf(pairCode)
      if (sayMiss(say, canCopyPair(code) ? '' : '没有可复制的码')) return
      navigator.clipboard.writeText(String(code)).then(() => say('已复制配对码。')).catch(() => say('复制失败。'))
    }
    async function exportNow(post, say) {
      try { exportThen(await post('/export', {}), say) } catch { say(exportSpeak(false)) }
    }
    async function precedentNow(p) {
      if (sayMiss(p.say, needTopicFirst(p.pane, p.topic, '先点开话题再查先例。'))) return
      const last = lastThreadText(liveThreadOf(p))
      const result = await p.post('/precedent', {
        sessionId: p.sessionId,
        scenario: precedentScenario(p.text, last, lastLineOf(p.state, p.peerId, p.selfId)),
        workspace: workspaceOf(p.session) || '',
      })
      applyPrecedent(result, p.noteLocal, p.say)
    }
    async function nodNow(p, peerIdToNod) {
      p.topic && (p.say(nodSpeak(await p.post('/nod', { requestId: p.topic.id, peerId: peerIdToNod }), peerNameOf(p.state, peerIdToNod))), p.refresh())
    }
    async function cosignNow(p, on) {
      p.topic && (await p.post('/cosign', { requestId: p.topic.id, on }), p.refresh())
    }
    function loadJsonMap(key) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || '{}')
        return parsed && typeof parsed === 'object' ? parsed : {}
      } catch { return {} }
    }
    function loadWin() {
      try {
        const parsed = JSON.parse(localStorage.getItem('dla-chat-win') || '')
        return parsed && parsed.w && parsed.h
          ? {
            w: Math.max(360, Number(parsed.w) || 1000),
            h: Math.max(280, Number(parsed.h) || 720),
            left: Math.max(8, Number(parsed.left) || 48),
            top: Math.max(8, Number(parsed.top) || 56),
          }
          : { w: 1000, h: 720, left: 48, top: 56 }
      } catch { return { w: 1000, h: 720, left: 48, top: 56 } }
    }
    function loadSkin() {
      try { return localStorage.getItem('dla-chat-skin') || 'paper' } catch { return 'paper' }
    }
    function loadBoxH() {
      try {
        const n = Number(localStorage.getItem('dla-chat-boxh'))
        return n >= 48 && n <= 280 ? n : 72
      } catch { return 72 }
    }
    function pairedPeersOf(state) {
      const selfId = state && state.self && state.self.id
      return ((state && state.peers) || []).filter((p) => p && !p.unpaired && p.id && p.id !== selfId)
    }
    async function draftReplyNow(p) {
      const letter = draftLetterOf(p.pane, p.topic, p.incoming)
      if (sayMiss(p.say, incomingMiss(letter, p.pane, p.topic))) return
      const result = await p.post('/reply/draft', { ...letterRef(letter), sessionId: p.sessionId, workspace: workspaceOf(p.session) })
      draftNoteSpeak(result.ok && result.followed, result, p.noteLocal, p.say)
      p.refresh()
    }
    async function adoptHereNow(p, quote) {
      if (sayMiss(p.say, adoptOpenMiss(p.pane, p.adoptable, p.topic))) return
      if (adoptHereNext(p.pane, quote, p.setPickReplies, p.setAdoptOpen)) return
      const result = await p.post('/adopt', letterRef(p.adoptable))
      applyAdoptSpeak(adoptPeerSpeak(result), p.noteLocal, p.say)
      p.refresh()
    }
    function pinSort(list) {
      return (list || []).slice().sort((a, b) => Number(!!b.pin) - Number(!!a.pin))
    }
    function pickWho(who, peers) {
      return who && peers.some((p) => p.id === who) ? who : (peers[0] ? peers[0].id : '')
    }
    function dayStamp() {
      const d = new Date()
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    }
    function loadBriefSeen() {
      try { return localStorage.getItem('dla-brief-seen') || '' } catch { return '' }
    }
    function watchingUnreadIds(state, pane, peerId, groupId, topicId, selfId) {
      const reqs = (state && state.requests) || []
      if (pane === 'chat' && peerId) {
        return lettersWithPeer(state, peerId, selfId).filter((row) => unreadWeight(row, selfId) > 0).map((row) => row.id)
      }
      if (pane === 'group' && groupId && topicId) {
        return reqs.filter((row) => row && row.groupId === groupId && (row.id === topicId || row.threadId === topicId) && unreadWeight(row, selfId) > 0).map((row) => row.id)
      }
      return []
    }
    function toastSay(live, toastTimer, setToast, msg) {
      live.current && (setToast(msg), toastTimer.current && clearTimeout(toastTimer.current), toastTimer.current = setTimeout(() => { live.current && setToast('') }, 2200))
    }
    function chatBtn(unread, onToggle, overlay) {
      return h('div', { className: 'dla-ask-wrap' },
        h('button', { type: 'button', className: 'dla-ask-btn', title: '和已配对的人聊天', onClick: () => onToggle && onToggle() }, '聊天', unreadBadge(unread)),
        overlayPortal(overlay),
      )
    }
    async function handshakeRun(p) {
      if (sayMiss(p.say, handshakeMiss(p.peerCode, p.door))) return
      const result = await p.post('/pair/handshake', handshakeBody(p.peerCode, p.door))
      p.say(resultSpeak(result, result && result.awaiting ? '已发给对面，等对方点确定。' : '已配对。', '没配上'))
      afterOk(result, () => { p.setPeerCode(''); p.setDoor('') })
      p.refresh()
    }
    async function withdrawRun(p, requestId) {
      const targets = withdrawTargetsOf(p.pane, reqById(p.state, requestId), p.peerId)
      requestId && targets.length && await withdrawAll(p.post, requestId, targets, p.say, p.refresh)
    }
    function topicOf(threadState, topics, topicId) {
      return ((threadState.requests || []).find((row) => row && row.id === topicId))
        || (topics || []).find((row) => row.id === topicId)
        || null
    }
    function adoptableNow(pane, topic, threadState, peerId, selfId) {
      return pane === 'group' && topic
        ? (topic.kind === 'outgoing' && replyCount(topic, threadState && threadState.requests) && !topic.adopted && !topic.held ? topic : null)
        : adoptableFromPeer(threadState, peerId, selfId)
    }
    function cueHereOf(p) {
      return (row) => cueIsHereOf({ state: p.state, peers: p.peers, pane: p.pane, groupId: p.groupId, topicId: p.topicId, peerId: p.peerId }, row)
    }
    function overlayFrame(p) {
      return h(React.Fragment, null,
        h('div', { className: 'dla-chat-scrim' + skinClass(p.skin), onClick: () => p.onToggle && p.onToggle() }),
        h('div', {
          ref: p.popRef,
          className: 'dla-chat-pop' + skinClass(p.skin),
          style: winStyleOf(p.win),
          onClick: (ev) => { ev.stopPropagation(); popMenusOff(p.setCtxMenu, p.setEmoOpen) },
        },
          GRIP_EDGES.map((edge) => h('span', { key: edge, className: 'dla-chat-grip ' + edge, onMouseDown: p.startResize(edge) })),
          h('div', { className: winClassOf(p.pane, !!(p.sheet || p.write)) },
            chatPeople({
              state: p.state, peopleQ: p.peopleQ, setPeopleQ: p.setPeopleQ, pane: p.pane, setPane: p.setPane, peerId: p.peerId, groupId: p.groupId, selfId: p.selfId,
              peers: p.sortedPeers, allPeers: p.peers, groups: p.groups, cues: p.cues, briefSeen: p.briefSeen,
              setWho: p.setWho, setGroupId: p.setGroupId, setTopicId: p.setTopicId, setHistOpen: p.setHistOpen, setEmoOpen: p.setEmoOpen,
              setNewgOpen: p.setNewgOpen, setPickedMembers: p.setPickedMembers, newgOpen: p.newgOpen,
              openPeerCard: p.openPeerCard, openGroupCard: p.openGroupCard, openSetup: p.openSetup,
            }),
            overlayPaneView(p),
            chatRail(p),
          ),
          ...overlaySheets(p),
        ),
      )
    }
    function overlayPaneView(p) {
      const chrome = {
        composer: p.composer, sendLabel: p.sendLabel, toast: p.toast, boxH: p.boxH,
        headBar: p.headBar, cueBar: p.cueBar, paneCue: p.paneCue, threadRef: p.threadRef, onThreadScroll: p.onThreadScroll,
      }
      const drop = { dropping: p.dropping, setDropping: p.setDropping, onDrop: p.onDrop, boxH: p.boxH, wsName: p.wsName, histOpen: p.histOpen }
      const thread = { summary: p.summary, clearSummary: p.clearSummary, composer: p.composer, sendLabel: p.sendLabel, toast: p.toast, headBar: p.headBar, cueBar: p.cueBar, paneCue: p.paneCue, threadRef: p.threadRef, onThreadScroll: p.onThreadScroll, histView: p.histView }
      return ({
        slip: () => chatSlip(Object.assign({ state: p.state, post: p.post, refresh: p.refresh, say: p.say }, chrome)),
        brief: () => chatBrief(Object.assign({ state: p.state, cues: p.cues, goCue: p.goCue, post: p.post, refresh: p.refresh, say: p.say }, chrome)),
        local: () => chatSetup({
          state: p.state, pairCode: p.pairCode, myName: p.myName, setMyName: p.setMyName, staffId: p.staffId, setStaffId: p.setStaffId,
          peerCode: p.peerCode, setPeerCode: p.setPeerCode, door: p.door, setDoor: p.setDoor, lanPort: p.lanPort, boxH: p.boxH, toast: p.toast,
          post: p.post, refresh: p.refresh, copyPair: p.copyPair, mintCode: p.mintCode, mintRelayInvite: p.mintRelayInvite, relaySession: p.relaySession, revokeRelayInvite: p.revokeRelayInvite, handshakeNow: p.handshakeNow, exportHere: p.exportHere,
          saveSetup: p.saveSetup, saveProbe: p.saveProbe, probeCards: p.probeCards, headBar: p.headBar,
        }),
        group: () => ({
          empty: () => chatEmptyGroup({ groups: p.groups, headBar: p.headBar }),
          topics: () => chatTopics(Object.assign({ group: p.group, state: p.state, selfId: p.selfId, topics: p.topics, openGroupCard: p.openGroupCard, setTopicId: p.setTopicId }, drop, thread)),
          follow: () => chatFollow(Object.assign({ topic: p.topic, group: p.group, rows: p.rows, bubble: p.bubble, openGroupCard: p.openGroupCard, setTopicId: p.setTopicId, pinBottom: p.pinBottom, jumpLatest: p.jumpLatest }, drop, thread)),
        })[groupPaneOf(p.group, p.topic)](),
        chat: () => chatPeerPane(Object.assign({
          peer: p.peer, pending: p.pending, post: p.post, refresh: p.refresh, say: p.say, rows: p.rows, bubble: p.bubble, incoming: p.incoming,
          openPeerCard: p.openPeerCard, pinBottom: p.pinBottom, jumpLatest: p.jumpLatest,
        }, drop, thread)),
      })[overlayPaneOf(p.pane)]()
    }
    const EMOJI = [
      '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆',
      '😉', '😊', '😍', '😘', '😜', '🤔', '🤨', '😐',
      '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐',
      '😯', '😪', '😫', '🥱', '😴', '😌', '😛', '😒',
      '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️', '🙁',
      '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧',
      '😨', '😩', '🤯', '😬', '😰', '😱', '🥵', '🥶',
      '😳', '🤪', '😵', '😡', '😠', '🤬', '😷', '🤒',
      '👍', '👎', '👌', '✌️', '🤞', '👋', '👏', '🙏',
      '💪', '👀', '❤️', '💔', '💯', '✅', '❌', '❗',
      '❓', '💡', '🔥', '⭐', '🎉', '🎊', '📎', '📌',
    ]
    function groupOf(state, groupId) {
      return ((state && state.groups) || []).find((g) => g && g.id === groupId) || null
    }
    function topicsOfGroup(state, groupId, selfId) {
      return ((state && state.requests) || []).filter((req) => (
        req && req.topic && req.groupId === groupId && !req.threadId && req.status !== 'closed'
      )).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    }
    function topicFollows(reqs, rootId) {
      return (reqs || []).filter((row) => row && row.threadId === rootId && row.status !== 'closed' && row.status !== 'withdrawn')
    }
    function topicPreview(state, topic) {
      const last = topicFollows((state && state.requests) || [], topic && topic.id)
        .slice()
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]
      return (last && (last.last || last.excerpt || last.body)) || (topic && (topic.excerpt || topic.body)) || '话题'
    }
    function topicThread(reqs, req, selfId) {
      if (!req) return []
      const rows = []
      if (req.status === 'withdrawn') {
        rows.push({
          id: req.id + ':gone',
          from: 'sys',
          text: req.from === selfId ? '你撤回了一条消息' : '这条话题已撤回',
          at: req.updatedAt,
        })
        return rows
      }
      ;(Array.isArray(req.versions) ? req.versions : []).forEach((v) => {
        rows.push({
          id: req.id + ':' + v.n,
          requestId: req.id,
          from: v.from === selfId ? 'me' : 'them',
          who: v.fromName || '',
          text: v.body || req.excerpt || '',
          at: v.at,
        })
      })
      ;(Array.isArray(req.replies) ? req.replies : []).forEach((rep, i) => {
        rows.push({
          id: req.id + ':r' + i,
          requestId: req.id,
          from: rep.from === selfId ? 'me' : 'them',
          who: rep.fromName || '',
          text: rep.body || '',
          at: rep.at,
          replyIndex: i,
        })
      })
      topicFollows(reqs, req.id).forEach((child) => {
        const vers = Array.isArray(child.versions) && child.versions.length
          ? child.versions
          : [{ n: 1, from: child.from, fromName: child.fromName, body: child.excerpt || child.body, at: child.createdAt }]
        vers.forEach((v) => {
          rows.push({
            id: child.id + ':' + (v.n || 1),
            requestId: child.id,
            from: v.from === selfId ? 'me' : 'them',
            who: v.fromName || child.fromName || '',
            text: v.body || child.excerpt || '',
            at: v.at || child.createdAt,
            files: filesOf(child).filter((f) => f && !f.handoff),
            handoff: !!(child.handoff || (child.attachments || []).some(isHandoffFile)),
            adopted: !!child.adopted,
          })
        })
      })
      rows.sort((a, b) => (a.at || 0) - (b.at || 0))
      return rows
    }
    function readFiles(list) {
      return Promise.all(Array.from(list || []).map((f) => new Promise((resolve) => {
        if (!f || f.size > 200 * 1024 * 1024) {
          resolve({ name: (f && f.name) || 'file', size: (f && f.size) || 0, over: true, data: '' })
          return
        }
        const reader = new FileReader()
        reader.onload = () => {
          const raw = String(reader.result || '')
          const data = raw.indexOf(',') >= 0 ? raw.slice(raw.indexOf(',') + 1) : raw
          resolve({ name: f.name, size: f.size, mime: f.type || '', over: false, data })
        }
        reader.onerror = () => resolve({ name: f.name, size: f.size, over: true, data: '' })
        reader.readAsDataURL(f)
      })))
    }
    function fileKind(name, mime) {
      const n = String(name || '').toLowerCase()
      const m = String(mime || '').toLowerCase()
      if (m === HANDOFF_MIME || n === HANDOFF_NAME) return 'handoff'
      if (m.indexOf('image/') === 0 || /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(n)) return 'image'
      if (m.indexOf('video/') === 0 || /\.(mp4|webm|mov|m4v)$/.test(n)) return 'video'
      if (m.indexOf('audio/') === 0 || /\.(mp3|wav|m4a|ogg)$/.test(n)) return 'audio'
      if (m === 'application/pdf' || n.slice(-4) === '.pdf') return 'pdf'
      if (n.slice(-5) === '.docx') return 'word'
      if (n.slice(-5) === '.xlsx') return 'excel'
      if (n.slice(-5) === '.pptx') return 'ppt'
      if (n.slice(-7) === '.univer') return 'univer'
      if (/\.(doc|xls|ppt)$/.test(n)) return 'oldOffice'
      if (m === 'text/html' || n.slice(-5) === '.html' || n.slice(-4) === '.htm') return 'html'
      if (m === 'text/markdown' || n.slice(-3) === '.md' || n.slice(-9) === '.markdown') return 'md'
      if (m.indexOf('text/') === 0 || /\.(txt|json|csv|log|js|ts|css|xml)$/.test(n)) return 'text'
      return 'file'
    }
    function b64ToBytes(b64) {
      const raw = atob(String(b64 || ''))
      const out = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
      return out
    }
    function decodeText(b64) {
      try { return decodeURIComponent(escape(atob(String(b64 || '')))) } catch { return atob(String(b64 || '')) }
    }
    function escapeHtml(s) {
      return String(s || '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[ch]))
    }
    function sanitizeHtml(raw) {
      let html = String(raw || '')
      html = html.replace(/<script[\s\S]*?<\/script>/gi, '')
      html = html.replace(/<style[\s\S]*?<\/style>/gi, '')
      html = html.replace(/<\/?(iframe|object|embed|link|meta|base|form)[^>]*>/gi, '')
      html = html.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      html = html.replace(/\s(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '')
      return html
    }
    function mdToHtml(src) {
      const lines = String(src || '').replace(/\r\n/g, '\n').split('\n')
      const out = []
      let inCode = false
      let code = []
      let list = []
      function flushList() {
        if (!list.length) return
        out.push('<ul>' + list.map((item) => '<li>' + item + '</li>').join('') + '</ul>')
        list = []
      }
      function inline(s) {
        let t = escapeHtml(s)
        t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
        t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>')
        t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" rel="noreferrer" target="_blank">$1</a>')
        return t
      }
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.slice(0, 3) === '```') {
          if (inCode) {
            out.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>')
            code = []
            inCode = false
          } else {
            flushList()
            inCode = true
          }
          continue
        }
        if (inCode) { code.push(line); continue }
        if (/^\s*[-*]\s+/.test(line)) {
          list.push(inline(line.replace(/^\s*[-*]\s+/, '')))
          continue
        }
        flushList()
        if (!line.trim()) { out.push(''); continue }
        if (/^###\s+/.test(line)) out.push('<h4>' + inline(line.replace(/^###\s+/, '')) + '</h4>')
        else if (/^##\s+/.test(line)) out.push('<h3>' + inline(line.replace(/^##\s+/, '')) + '</h3>')
        else if (/^#\s+/.test(line)) out.push('<h2>' + inline(line.replace(/^#\s+/, '')) + '</h2>')
        else out.push('<p>' + inline(line) + '</p>')
      }
      if (inCode) out.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>')
      flushList()
      return out.join('') || '<p>空文档</p>'
    }
    const scriptLoads = {}
    function loadScript(name) {
      if (scriptLoads[name]) return scriptLoads[name]
      const src = PREFIX + '/vendor/' + name
      scriptLoads[name] = new Promise((resolve, reject) => {
        if (typeof document === 'undefined') { reject(new Error('NO_DOM')); return }
        const hit = Array.from(document.scripts || []).some((s) => {
          const href = s.getAttribute('src') || s.src || ''
          return href === src || href.slice(-name.length) === name
        })
        if (hit) { resolve(); return }
        const tag = document.createElement('script')
        tag.src = src
        tag.onload = () => resolve()
        tag.onerror = () => { delete scriptLoads[name]; reject(new Error('LOAD')) }
        document.head.appendChild(tag)
      })
      return scriptLoads[name]
    }
    function bytesBuffer(bytes) {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    }
    async function officeHtmlFrom(kind, data) {
      const bytes = b64ToBytes(data)
      if (kind === 'oldOffice') return '<p>旧版 .doc / .xls / .ppt 不能在浏览器里还原版式。请另存为 docx / xlsx / pptx。</p>'
      if (kind === 'word') {
        await loadScript('mammoth.browser.min.js')
        if (!window.mammoth) return '<p>Word 解析库没装上。</p>'
        const res = await window.mammoth.convertToHtml({ arrayBuffer: bytesBuffer(bytes) })
        return sanitizeHtml(res.value || '<p>空文档</p>')
      }
      if (kind === 'excel') {
        await loadScript('xlsx.full.min.js')
        if (!window.XLSX) return '<p>Excel 解析库没装上。</p>'
        const wb = window.XLSX.read(bytes, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        return sanitizeHtml(window.XLSX.utils.sheet_to_html(sheet, { header: '', footer: '' }) || '<p>空表</p>')
      }
      if (kind === 'ppt') {
        await loadScript('jszip.min.js')
        if (!window.JSZip) return '<p>PPT 解析库没装上。</p>'
        const zip = await window.JSZip.loadAsync(bytes)
        const names = Object.keys(zip.files).filter((n) => /ppt\/slides\/slide\d+\.xml$/.test(n)).sort()
        const slides = []
        for (let i = 0; i < names.length; i++) {
          const xml = await zip.files[names[i]].async('string')
          const texts = []
          String(xml).replace(/<a:t[^>]*>([^<]*)<\/a:t>/g, (_, t) => { if (t) texts.push(t) })
          slides.push('<p><b>第 ' + (i + 1) + ' 页</b> ' + escapeHtml(texts.join(' ')) + '</p>')
        }
        return slides.join('') || '<p>没有抽出文字</p>'
      }
      return ''
    }
    function handoffHtml(pack) {
      const turns = (pack && pack.turns) || []
      const rows = turns.map((row) => {
        const who = row && row.role === 'assistant' ? '助手' : '人'
        return '<p><b>' + escapeHtml(who) + '</b><br>' + escapeHtml(row && row.text).replace(/\n/g, '<br>') + '</p>'
      })
      const note = '<p>工具卡和对方磁盘不在这封信里。需要的文件看附件。</p>'
      const more = pack && pack.truncated ? '<p>后面还有，已截断。</p>' : ''
      return '<div class="dla-chat-handoff">' + note + rows.join('') + more + '</div>'
    }
    function parseHandoffData(data) {
      const raw = String(data || '')
      let text = raw
      if (raw && raw.trim()[0] !== '{') {
        try { text = decodeText(raw) } catch { text = raw }
      }
      try {
        const row = JSON.parse(text)
        return row && row.kind === 'handoff' && Array.isArray(row.turns) ? row : null
      } catch {
        return null
      }
    }
    async function previewFrom(name, mime, data) {
      const kind = fileKind(name, mime)
      const href = 'data:' + (mime || 'application/octet-stream') + ';base64,' + data
      const next = { name, mime: mime || '', href, kind, html: '', text: '' }
      if (kind === 'handoff') {
        const pack = parseHandoffData(data)
        next.html = pack ? handoffHtml(pack) : '<p>这封交接打不开。</p>'
        next.name = (pack && pack.title) || name
        return next
      }
      if (kind === 'text' || kind === 'md') next.text = decodeText(data)
      if (kind === 'md') next.html = mdToHtml(next.text)
      else if (kind === 'html') next.html = sanitizeHtml(decodeText(data))
      else if (kind === 'word' || kind === 'excel' || kind === 'ppt' || kind === 'oldOffice') {
        try { next.html = await officeHtmlFrom(kind, data) } catch { next.html = '<p>没解析开。仍可下载。</p>' }
      }
      return next
    }
    function fileThumb(f, onOpen) {
      const kind = fileKind(f.name, f.mime)
      const open = () => onOpen && onOpen(f)
      if (kind === 'image' && f.href) return h('img', { className: 'dla-chat-thumb', src: f.href, alt: f.name || '', onClick: open })
      if (kind === 'video' && f.href) return h('video', { className: 'dla-chat-thumb', src: f.href, controls: true, onClick: open })
      if (kind === 'pdf' && f.href) return h('iframe', { className: 'dla-chat-pdf', src: f.href + '#toolbar=0', title: f.name || 'pdf', onClick: open })
      if (f.html) return h('div', { className: 'dla-chat-office', onClick: open, dangerouslySetInnerHTML: { __html: f.html } })
      return h('button', { type: 'button', className: 'dla-chat-media', onClick: open }, f.name || '文件')
    }

    function incomingFromPeer(state, peerId) {
      return lettersWithPeer(state, peerId, '').filter((req) => (
        req.kind === 'incoming'
        && req.from === peerId
        && req.status !== 'failed'
      )).sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0)).slice(-1)[0] || null
    }

    function liveLetterWithPeer(state, peerId, selfId) {
      return incomingFromPeer(state, peerId)
        || lettersWithPeer(state, peerId, selfId)
          .filter((req) => req.status !== 'failed' && req.status !== 'presend')
          .sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0))
          .slice(-1)[0]
        || null
    }

    function presendToPeer(state, peerId, selfId) {
      return lettersWithPeer(state, peerId, selfId).find((req) => (
        req.kind === 'outgoing' && req.status === 'presend' && (req.to || []).indexOf(peerId) >= 0
      )) || null
    }

    function letterUnread(req, selfId) {
      if (!req || req.status === 'withdrawn' || req.status === 'closed' || req.status === 'failed') return false
      if (typeof req.unread === 'boolean') return req.unread
      if (req.kind === 'incoming') return !(req.reads && req.reads[selfId])
      if (req.kind !== 'outgoing') return false
      const n = Array.isArray(req.replies) ? req.replies.length : Number(req.replies || 0)
      return n > Number(req.seenReplies || 0)
    }
    function groupHasUnread(state, groupId, selfId) {
      return ((state && state.requests) || []).some((req) => req && req.groupId === groupId && letterUnread(req, selfId))
    }
    function replyCount(req, list) {
      if (!req) return 0
      const legacy = Array.isArray(req.replies) ? req.replies.length : Number(req.replies || 0)
      const kids = (list || []).filter((row) => row && row.threadId === req.id && row.status !== 'closed' && row.status !== 'withdrawn').length
      return legacy + kids
    }
    function adoptableFromPeer(state, peerId, selfId) {
      const rows = lettersWithPeer(state, peerId, selfId).filter((req) => (
        req.kind === 'incoming'
        && req.from === peerId
        && !req.adopted
        && !req.held
        && (req.excerpt || req.body)
      )).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      return rows[0] || lettersWithPeer(state, peerId, selfId).find((req) => (
        req.kind === 'outgoing'
        && (req.to || []).indexOf(peerId) >= 0
        && replyCount(req, (state && state.requests) || [])
        && !req.adopted
        && !req.held
      )) || null
    }

    function ChatPop(props) {
      useEffect(() => { try { injectStyles() } catch { /* ignore */ } }, [])
      const sessionId = props.sessionId || ''
      const { state, refresh } = useMailbox(sessionId, (snap) => snap && {
        self: snap.self,
        peers: snap.peers,
        requests: snap.requests,
        groups: snap.groups,
        inbox: snap.inbox,
        nudges: snap.nudges,
        briefOff: snap.briefOff,
        listenGranted: snap.listenGranted,
        pairCode: snap.pairCode,
        pairAsk: snap.pairAsk,
        pairWait: snap.pairWait,
        doorPort: snap.doorPort,
        lookups: snap.lookups,
        lookup: snap.lookup,
        relayConfigured: snap.relayConfigured,
        pendingSheet: snap.pendingSheet,
        pendingWrite: snap.pendingWrite,
      })
      const peers = pairedPeersOf(state)
      const selfId = state && state.self && state.self.id
      const place = loadJsonMap('dla-chat-place')
      const [who, setWho] = useState(place.who || '')
      const [text, setText] = useState('')
      const [toast, setToast] = useState('')
      const [briefSeen, setBriefSeen] = useState(loadBriefSeen)
      const [sending, setSending] = useState(false)
      const [files, setFiles] = useState([])
      const [picks, setPicks] = useState([])
      const [picked, setPicked] = useState({})
      const [openDirs, setOpenDirs] = useState({})
      const [pane, setPane] = useState(place.pane || 'chat')
      const [groupId, setGroupId] = useState(place.groupId || '')
      const [topicId, setTopicId] = useState(place.topicId || '')
      const [myName, setMyName] = useState('')
      const [peerCode, setPeerCode] = useState('')
      const [door, setDoor] = useState('')
      const [relaySession, setRelaySession] = useState('')
      const [newGroupName, setNewGroupName] = useState('')
      const [pickedMembers, setPickedMembers] = useState([])
      const [pickReplies, setPickReplies] = useState([])
      const [peopleQ, setPeopleQ] = useState('')
      const [emoOpen, setEmoOpen] = useState(false)
      const [histOpen, setHistOpen] = useState(false)
      const [histQ, setHistQ] = useState('')
      const [cardId, setCardId] = useState('')
      const [dropping, setDropping] = useState(false)
      const [skin, setSkin] = useState(loadSkin)
      const [win, setWin] = useState(loadWin)
      const [preview, setPreview] = useState(null)
      const [slipAsk, setSlipAsk] = useState(null)
      const [forwardAsk, setForwardAsk] = useState(null)
      const [probeDrafts, setProbeDrafts] = useState({})
      const [cardNote, setCardNote] = useState('')
      const [cardStaff, setCardStaff] = useState('')
      const [cardDoor, setCardDoor] = useState('')
      const [cardPin, setCardPin] = useState(false)
      const [cardMute, setCardMute] = useState(false)
      const [cardGroupName, setCardGroupName] = useState('')
      const [cardMembers, setCardMembers] = useState([])
      const [staffId, setStaffId] = useState('')
      const [lanPort, setLanPort] = useState('')
      const [newgOpen, setNewgOpen] = useState(false)
      const [cardKind, setCardKind] = useState('')
      const [cueIdx, setCueIdx] = useState(0)
      const [adoptOpen, setAdoptOpen] = useState(false)
      const [ctxMenu, setCtxMenu] = useState(null)
      const [trMap, setTrMap] = useState(() => loadJsonMap('dla-chat-tr'))
      const [summaries, setSummaries] = useState(() => loadJsonMap('dla-chat-sum'))
      const [jumpId, setJumpId] = useState('')
      const [boxH, setBoxH] = useState(loadBoxH)
      const [danger, setDanger] = useState(null)
      const [backTo, setBackTo] = useState(null)
      const [notes, setNotes] = useState(() => loadJsonMap('dla-chat-notes'))
      const toastTimer = useRef(null)
      const live = useRef(true)
      const waitRef = useRef('')
      const skipDraftRef = useRef('')
      const lastDraftRef = useRef('')
      const fileRef = useRef(null)
      const pickedRef = useRef({})
      const pickLock = useRef({})
      const popRef = useRef(null)
      const threadRef = useRef(null)
      const boxRef = useRef(null)
      const pinRef = useRef(true)
      const [pinBottom, setPinBottom] = useState(true)
      const [openReqs, setOpenReqs] = useState([])
      const threadKeyRef = useRef('')
      const openSig = (() => {
        const reqs = (state && state.requests) || []
        return (pane === 'group' && topicId && reqs.filter((r) => r && (r.id === topicId || r.threadId === topicId)).map((r) => r.id + ':' + r.updatedAt + ':' + r.last + ':' + r.replies).join('|'))
          || (pane === 'chat' && who && lettersWithPeer(state, who, selfId).map((r) => r.id + ':' + r.updatedAt + ':' + r.last + ':' + r.replies).join('|'))
          || ''
      })()
      useEffect(() => {
        const key = pane + ':' + (topicId || who || '')
        const switched = threadKeyRef.current !== key
        threadKeyRef.current = key
        switched && setOpenReqs([])
        let cancelled = false
        const path = (pane === 'group' && topicId && '/thread?requestId=' + encodeURIComponent(topicId))
          || (pane === 'chat' && who && '/thread?peerId=' + encodeURIComponent(who))
          || ''
        props.open && path && get(path).then((got) => {
          cancelled || (got && got.ok !== false && Array.isArray(got.requests) && setOpenReqs(got.requests))
        })
        return () => { cancelled = true }
      }, [props.open, pane, who, topicId, openSig])
      useEffect(() => {
        persistJson('dla-chat-place', { pane, who, groupId, topicId })
      }, [pane, who, groupId, topicId])
      useEffect(() => {
        const waitId = state && state.pairWait && state.pairWait.id
        waitId && (waitRef.current = waitId)
        const done = waitRef.current && !waitId && peers.some((p) => p.id === waitRef.current)
        done && (setWho(waitRef.current), setPane('chat'), typeof openChatHook === 'function' && openChatHook(waitRef.current), waitRef.current = '')
      }, [state && state.pairWait && state.pairWait.id, peers.map((p) => p.id).join(',')])
      const threadState = Object.assign({}, state, { requests: openReqs })
      const groups = pinSort((state && state.groups) || [])
      const sortedPeers = pinSort(peers)
      const group = groupOf(state, groupId)
      const topics = topicsOfGroup(state, groupId, selfId)
      const topic = topicOf(threadState, topics, topicId)
      const peer = peers.find((p) => p.id === who) || null
      const peerId = peer ? peer.id : ''
      const incoming = incomingFromPeer(threadState, peerId)
      const pending = presendToPeer(threadState, peerId, selfId)
      const liveLetter = liveLetterWithPeer(threadState, peerId, selfId)
      const adoptable = adoptableNow(pane, topic, threadState, peerId, selfId)
      useEffect(() => {
        live.current = true
        return () => {
          live.current = false
          if (toastTimer.current) clearTimeout(toastTimer.current)
        }
      }, [])
      useEffect(() => {
        const next = pickWho(who, peers)
        next !== who && setWho(next)
      }, [peers.map((p) => p.id).join(','), who])
      useEffect(() => {
        lastDraftRef.current = ''
        skipDraftRef.current = ''
        setText('')
        setFiles([])
        setEmoOpen(false)
        setHistOpen(false)
        setHistQ('')
        setCtxMenu(null)
      }, [peerId, topicId, groupId])
      useEffect(() => {
        const draft = liveReplyDraft(incoming, openReqs)
        const next = composerDraftOf(text, draft, skipDraftRef.current, lastDraftRef.current)
        if (next == null) return
        lastDraftRef.current = next
        setText(next)
      }, [incoming && incoming.id, incoming && incoming.replyDraft, (openReqs || []).map((row) => row && (row.id + ':' + (row.excerpt || '') + ':' + String((row && row.replyDraft) || '').length)).join('|')])
      useEffect(() => {
        if (!props.open) return
        let t
        function arm() {
          t && clearTimeout(t)
          if (typeof document !== 'undefined' && document.hidden) return
          t = setTimeout(() => {
            const ids = watchingUnreadIds(state, pane, peerId, groupId, topicId, selfId)
            ids.forEach((id) => post('/read', { requestId: id, sessionId }).catch(() => undefined))
            ids.length && refresh()
          }, 1200)
        }
        arm()
        typeof document !== 'undefined' && document.addEventListener('visibilitychange', arm)
        return () => {
          t && clearTimeout(t)
          typeof document !== 'undefined' && document.removeEventListener('visibilitychange', arm)
        }
      }, [props.open, pane, peerId, groupId, topicId, openSig])
      useEffect(() => {
        if (!props.open || pane !== 'brief') return
        const d = dayStamp()
        if (briefSeen === d) return
        try { localStorage.setItem('dla-brief-seen', d) } catch { /* ignore */ }
        setBriefSeen(d)
      }, [props.open, pane, briefSeen])
      useEffect(() => {
        function fit() {
          setWin((prev) => {
            const next = clampChatWin(prev)
            persistJson('dla-chat-win', next)
            return next
          })
        }
        fit()
        if (typeof window === 'undefined') return
        window.addEventListener('resize', fit)
        return () => window.removeEventListener('resize', fit)
      }, [])
      useEffect(() => {
        function onKey(ev) {
          ev.key === 'Escape' && escapeClose({
            ctxMenu, setCtxMenu, danger, setDanger, preview, setPreview, adoptOpen, setAdoptOpen,
            newgOpen, setNewgOpen, cardId, closeCard, emoOpen, setEmoOpen, histOpen, setHistOpen,
            pane, topicId, setTopicId, backFromSetup, onToggle: props.onToggle,
          })
        }
        if (typeof document === 'undefined') return
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [ctxMenu, danger, preview, adoptOpen, newgOpen, cardId, emoOpen, histOpen, pane, topicId, props.onToggle])
      function persistWin(next) {
        const clamped = clampChatWin(next)
        setWin(clamped)
        persistJson('dla-chat-win', clamped)
      }
      function say(msg) {
        toastSay(live, toastTimer, setToast, msg)
      }
      function sendFail(result, fallback) {
        return sendFailOf(result, fallback)
      }
      function noteKey() {
        return noteKeyOf({ pane, topic, groupId, peerId, who })
      }
      function noteLocal(tag, text) {
        const key = noteKey()
        const row = localNoteRow(tag, text)
        setNotes((prev) => pushLocalNote(prev, key, row))
      }
      async function sendNow() {
        await sendNowRun({
          sending, files, text, session: props.session, pane, peerId, selfId, group, topic, pending, liveLetter, say,
          post, sessionId, sendFail, refresh, setText, setFiles, setTopicId, setSending, live, skipDraftRef, lastDraftRef, dropHandoff,
        })
      }
      async function draftReply() {
        skipDraftRef.current = ''
        lastDraftRef.current = ''
        await draftReplyNow({ pane, topic, incoming, say, post, sessionId, session: props.session, noteLocal, refresh })
      }
      async function adoptHere(quote) {
        await adoptHereNow({ pane, adoptable, topic, setPickReplies, setAdoptOpen, post, noteLocal, say, refresh }, quote)
      }
      async function confirmAdoptSheet() {
        await confirmAdoptNow({
          say, adoptable, state, group, post, pickReplies, setAdoptOpen, noteLocal, refresh,
        })
      }
      async function saveName() {
        const result = await post('/name', { name: selfDisplayName(state, myName) })
        say(resultSpeak(result, '称呼已保存。', '没记下'))
        refresh()
      }
      async function mintCode() {
        const result = await post('/pair/mint', {})
        if (result && result.ok === false) say(result.hint || result.error || '没开出码')
        refresh()
      }
      async function mintRelayInvite() {
        const result = await post('/relay/invite', {})
        if (!result || result.ok === false) {
          say((result && (result.hint || result.error)) || '没开出邀请')
          return
        }
        const invite = result.invite || {}
        const line = [invite.relay, invite.device, invite.session].filter(Boolean).join(' ')
        try { await navigator.clipboard.writeText(line) } catch { /* still show */ }
        setRelaySession(String(invite.session || ''))
        say('中继邀请已复制。不含口头配对码。')
      }
      async function revokeRelayInvite() {
        const session = String(relaySession || '').trim()
        if (!session) {
          say('没有可吊销的邀请。')
          return
        }
        const result = await post('/relay/revoke', { session })
        if (!result || result.ok === false) {
          say((result && (result.hint || result.error)) || '没吊销')
          return
        }
        setRelaySession('')
        say('这枚中继邀请已吊销。口头配对码不受影响。')
      }
      async function handshakeNow() {
        await handshakeRun({ say, peerCode, door, post, setPeerCode, setDoor, refresh })
      }
      async function acceptPair() {
        await acceptPairNow({ post, say, setWho, setPane, refresh })
      }
      async function rejectPair() {
        await rejectPairNow({ post, say, refresh })
      }
      async function toggleListen() {
        const result = await post('/listen', listenToggleBody(state))
        say(listenSpeak(result.listenGranted))
        refresh()
      }
      async function makeGroup() {
        await makeGroupNow({
          post, newGroupName, pickedMembers, say, setNewGroupName, setPickedMembers, setNewgOpen, setGroupId, setTopicId, setPane, refresh,
        })
      }
      function openPeerCard(id) {
        openPeerNow(id, peers, setCardKind, setCardId, peerCardApply(setCardNote, setCardStaff, setCardDoor, setCardPin, setCardMute))
      }
      function openGroupCard(id) {
        openGroupNow(id, groups, setCardKind, setCardId, groupCardApply(setCardGroupName, setCardMembers, setCardPin, setCardMute))
      }
      function closeCard() {
        setCardId('')
        setCardKind('')
      }
      async function savePeerCard() {
        await savePeerNow({
          cardId, cardNote, cardStaff, cardDoor, cardPin, cardMute, post, closeCard, refresh, say,
        })
      }
      async function saveGroupCard() {
        await saveGroupNow({
          post, cardId, cardGroupName, cardMembers, cardPin, cardMute, say, closeCard, refresh,
        })
      }
      async function dissolveHere() {
        await dissolveNow({
          post, cardId, say, groupId, setGroupId, setTopicId, setPane, closeCard, refresh,
        })
      }
      async function saveSetup() {
        await saveSetupNow({ myName, post, staffId, state, say, refresh })
      }
      function copyPair() {
        copyPairNow(pairCode, say)
      }
      function composer(placeholder, sendText, locked) {
        return chatCompose({
          placeholder, sendText, locked, pane, topic, incoming, adoptable, emoOpen, histOpen,
          files, text, boxH, sending, peerId, pending, fileRef, boxRef,
          setText, setEmoOpen, setHistOpen, setFiles,
          draftReply, adoptHere, askLocal, summarizeThread, onPrecedent, packHandoff, pickFiles, openPending, startBoxResize, onPaste, sendNow,
          sessionId, picks, picked, openDirs, toggleDir, togglePick, unpickPath, dropHandoff,
        })
      }
      async function nodHere(peerIdToNod) {
        await nodNow({ topic, post, say, state, refresh }, peerIdToNod)
      }
      async function toggleCosign(on) {
        await cosignNow({ topic, post, refresh }, on)
      }
      async function withdrawHere(requestId) {
        await withdrawRun({ pane, state, peerId, post, say, refresh }, requestId)
      }
      async function pickFiles(ev) {
        await takeFiles(ev.target.files)
        ev.target.value = ''
      }
      async function packHandoff() {
        if (sayMiss(say, sessionId ? '' : '这条对话还没绑上，不能交接。')) return
        const got = await post('/handoff/pack', { sessionId })
        if (!got || got.ok === false) {
          say((got && (got.hint || got.error)) || '没交接成')
          return
        }
        const attach = got.attach
        if (!attach || !attach.data) {
          say('没交接成')
          return
        }
        setFiles((prev) => (prev || []).filter((f) => f && f.name !== attach.name && !f.path).concat([attach]))
        const list = Array.isArray(got.picks) ? got.picks : []
        setPicks(list)
        pickedRef.current = {}
        pickLock.current = {}
        setPicked({})
        setOpenDirs({})
        if (!String(text || '').trim()) setText(got.letter || (got.title ? ('交接 · ' + got.title) : '交接这次会话'))
        say(list.length
          ? (got.hint || '已附上全文。勾要带的文件，点发送才寄。')
          : '已附上全文。没有可勾的项目文件，点发送仍可寄。')
      }
      function dropHandoff() {
        pickedRef.current = {}
        pickLock.current = {}
        setPicked({})
        setOpenDirs({})
        setPicks([])
        setFiles((prev) => (prev || []).filter((f) => f && !isHandoffFile(f) && !f.path))
      }
      function toggleDir(dir) {
        const key = String(dir || '')
        if (!key) return
        setOpenDirs((prev) => {
          const next = Object.assign({}, prev)
          if (next[key]) delete next[key]
          else next[key] = true
          return next
        })
      }
      function writePicked(next) {
        pickedRef.current = next
        setPicked(next)
      }
      function unpickPath(path) {
        if (!path) return
        const next = Object.assign({}, pickedRef.current)
        delete next[path]
        writePicked(next)
      }
      async function togglePick(row, want) {
        const path = row && row.path
        if (!path) return
        const on = want === undefined ? !pickedRef.current[path] : !!want
        if (!on) {
          delete pickLock.current[path]
          unpickPath(path)
          setFiles((prev) => (prev || []).filter((f) => f && f.path !== path))
          return
        }
        if (pickedRef.current[path] || pickLock.current[path]) return
        pickLock.current[path] = true
        writePicked(Object.assign({}, pickedRef.current, { [path]: true }))
        const got = await post('/handoff/file', { sessionId, path })
        delete pickLock.current[path]
        if (!got || got.ok === false || !got.attach) {
          unpickPath(path)
          say((got && (got.hint || got.error)) || '没勾上')
          return
        }
        setFiles((prev) => (prev || []).filter((f) => f && f.path !== path).concat([got.attach]))
      }
      async function openHandoff(requestId) {
        if (!requestId) return
        say('正在打开…')
        const got = await get('/handoff?requestId=' + encodeURIComponent(requestId))
        if (got && got.ok && got.pack) {
          setPreview({
            name: got.pack.title || '交接包',
            mime: HANDOFF_MIME,
            kind: 'handoff',
            html: handoffHtml(got.pack),
            href: '',
            text: '',
          })
          setToast('')
          return
        }
        const req = ((state && state.requests) || []).find((row) => row && row.id === requestId)
        const index = ((req && req.attachments) || []).findIndex(isHandoffFile)
        if (index < 0) {
          say((got && (got.hint || got.error)) || '这封不是交接包。')
          return
        }
        await openAttach(requestId, index)
      }
      async function continueHandoff(requestId) {
        const ws = workspaceOf(props.session)
        const result = await post('/handoff/continue', { requestId, workspace: ws, fromSessionId: sessionId })
        const sid = result && result.sessionId
        if (sid) {
          try {
            const api = sessionsApi
            if (api && typeof api.open === 'function') api.open(sid)
          } catch { /* live sessions stay off the React tree */ }
        }
        applyAdoptSpeak(result && result.ok
          ? { note: '已领进新会话。全文在上面，等你开口。', say: '已领进新会话。全文在上面，等你开口。' }
          : { note: '', say: (result && (result.hint || result.error)) || '没接上' }, noteLocal, say)
        refresh()
      }
      async function askLocal() {
        await askLocalNow({
          say, pane, topic, text, selfId, threadState, peerId, sessionId, post, session: props.session, noteLocal,
        })
      }
      async function translateAt(id, raw) {
        await liveTranslateNow({
          trMap, setTrMap, sessionId, post, ws: workspaceOf(props.session), say,
        }, id, raw)
      }
      function summarizeThread() {
        summarizeNow({
          say, pane, topic, selfId, threadState, peerId, setSummaries, noteKey, post, sessionId, session: props.session,
        })
      }
      function clearSummary() {
        const key = noteKey()
        setSummaries((prev) => setMapKey(prev, key, null, 'dla-chat-sum'))
      }
      function startBoxResize(ev) {
        const sy = ev.clientY
        const start = boxH
        dragOn(ev, (next) => persistBoxH(setBoxH, boxHOf(start, sy, next.clientY)))
      }
      function openCtx(ev, m) {
        ev.preventDefault()
        setCtxMenu(ctxMenuOf(ev, m))
      }
      async function ctxAct(act) {
        await runCtxAct({
          ctxMenu, setCtxMenu, peerName: peerNameOf(state, peerId),
          ask: (who, row) => ctxAskNow({
            say, sessionId, post, ws: workspaceOf(props.session), noteLocal,
          }, who, row),
          draft: (row) => ctxDraftNow({ setText, incoming, draftReply, say }, row),
          adopt: adoptHere, withdraw: withdrawHere, tr: translateAt,
          slip: (row) => ctxSlipNow({ setSlipAsk }, row),
          forward: (row) => setForwardAsk({ quote: String((row && row.text) || '').trim() }),
          board: async (row) => {
            const result = await post('/advise', {
              sessionId,
              scenario: String((row && row.text) || ''),
              requestId: row && row.requestId,
            })
            say((result && result.ok)
              ? '可以记。到业务旁确认「按这个记进档案」。'
              : ((result && result.error === 'NO_BECAUSE' && '没有依据，不能记账')
                || (result && (result.hint || result.error))
                || '没有依据，不能记账'))
            refresh()
          },
        }, act)
      }
      async function exportHere() {
        await exportNow(post, say)
      }
      async function onPrecedent() {
        await precedentNow({
          say, pane, topic, selfId, threadState, peerId, post, sessionId, text, state, session: props.session, noteLocal,
        })
      }
      async function takeFiles(list) {
        mergeFiles(setFiles, await readFiles(list), say)
      }
      async function onDrop(ev) {
        ev.preventDefault()
        setDropping(false)
        await takeFiles(dropFilesOf(ev))
      }
      async function onPaste(ev) {
        const files = clipFilesOf(ev)
        if (!files) return
        ev.preventDefault()
        await takeFiles(files)
      }
      function applySkin(name) {
        const next = skinNameOf(name)
        setSkin(next)
        persistJson('dla-chat-skin', next)
      }
      function startMove(ev) {
        dragMove(ev, win, persistWin)
      }
      function startResize(edge) {
        return function onDown(ev) { dragResize(ev, win, edge, persistWin) }
      }
      async function openAttach(requestId, index) {
        say('正在打开…')
        const got = await get(attachGetPath(requestId, index))
        if (sayMiss(say, attachOpenMiss(got))) return
        const next = await previewFrom(got.name, got.mime, got.data)
        next.requestId = requestId
        next.index = index
        setPreview(next)
        setToast('')
      }
      async function openPending(f) {
        if (sayMiss(say, pendingMiss(f))) return
        const next = await previewFrom(f.name, f.mime, f.data)
        next.path = f.path || ''
        setPreview(next)
      }
      async function openUniver(preview) {
        const ws = workspaceOf(props.session)
        if (!preview || !preview.path) {
          say('先另存到工作区。Univer 只改副本。')
          return
        }
        const result = await post('/workspace/univer', { workspace: ws, path: preview.path })
        const raw = result && result.url
        let url = ''
        try {
          const u = new URL(String(raw || ''), window.location.origin)
          if (u.protocol === 'http:' || u.protocol === 'https:') url = u.href
        } catch { url = '' }
        if (result && result.ok && url) {
          setPreview(Object.assign({}, preview, { univerUrl: url }))
          say('已用 Univer 打开副本。')
        } else {
          say((result && (result.hint || result.error)) || 'Univer 没打开。')
        }
      }
      async function saveWorkspace(preview) {
        const ws = workspaceOf(props.session)
        const result = await post('/workspace/save', {
          workspace: ws,
          path: preview && preview.path,
          text: preview && preview.text,
        })
        say((result && result.ok) ? ('已保存 ' + (result.path || (preview && preview.path) || '')) : ((result && (result.hint || result.error)) || '没保存成'))
      }
      async function copyAttach(preview) {
        const ws = workspaceOf(props.session)
        const result = await post('/attach/copy', {
          requestId: preview && preview.requestId,
          index: preview && preview.index,
          workspace: ws,
        })
        if (result && result.ok) {
          say('已另存 ' + (result.path || result.name) + '。改副本，不改原件。')
          if (preview) setPreview(Object.assign({}, preview, { path: result.path }))
        } else {
          say((result && (result.hint || result.error)) || '没另存成')
        }
      }
      async function seeNow(requestId) {
        const result = await post('/see', { requestId })
        say((result && result.ok)
          ? ('眼睛看到：' + String(result.seen || '').slice(0, 80))
          : ((result && result.hint) || '未看见'))
      }
      async function confirmSlip() {
        const ask = slipAsk
        const quote = String((ask && ask.quote) || '').trim()
        const dueAt = dueAtFromInput(ask && ask.due)
        setSlipAsk(null)
        if (!quote) return
        const result = await post('/nudge/add', { quote, sessionId, dueAt: dueAt || undefined })
        slipGoSpeak(result, setPane, say, refresh)
      }
      async function confirmForward(to) {
        const quote = String((forwardAsk && forwardAsk.quote) || '').trim()
        setForwardAsk(null)
        if (!quote || !to) return
        const made = await post('/compose', {
          excerpt: '（转发）' + quote,
          to: [to],
          sessionId,
          workspace: workspaceOf(props.session),
        })
        if (made && made.ok === false) {
          say((made.hint || made.error) || '没转成')
          return
        }
        const id = made && (made.requestId || (made.requests && made.requests[0] && made.requests[0].id))
        if (!id) {
          say('没转成')
          return
        }
        const sent = await post('/send', { requestId: id })
        say((sent && sent.ok === false) ? ((sent.hint || sent.error) || '没送到') : '已转出。')
        refresh()
      }
      function headBar(title, extra) {
        return chatHead({
          title, extra, histOpen, pane, skin, applySkin, startMove, backFromSetup,
          onClose: () => props.onToggle && props.onToggle(),
        })
      }
      function openSetup() {
        setBackTo(setupPlaceOf(pane, who, groupId, topicId))
        setPane('local')
      }
      function backFromSetup() {
        const prev = backTo
        setBackTo(null)
        restorePlace(prev, setPane, setWho, setGroupId, setTopicId)
      }
      function paneCue() {
        return paneCueOf(pane, topic)
      }
      function listedLookups() {
        return listedLookupsOf(state)
      }
      function draftOf(row) {
        return lookupDraftOf(row, probeDrafts)
      }
      function patchDraft(id, patch) {
        setProbeDrafts((prev) => patchDraftMap(prev, id, patch))
      }
      async function saveProbe() {
        const last = await saveProbeAll(post, listedLookups(), draftOf)
        setProbeDrafts({})
        say(probeSavedSpeak(last))
        refresh()
      }
      async function addProbe() {
        await post('/lookup/config', lookupAddBody())
        say('空的一套已加上。填地址才算连上。')
        refresh()
      }
      async function removeProbe(id) {
        await post('/lookup/config', lookupRemoveBody(id))
        setProbeDrafts((prev) => dropDraftId(prev, id))
        say('这套查单已去掉。')
        refresh()
      }
      function probeCard(row, index) {
        const rows = listedLookups()
        return chatProbe(Object.assign({
          row, index, draft: draftOf(row), patchDraft, addProbe, removeProbe,
        }, probeEnds(index, rows)))
      }
      const unread = chatBadgeOf(state, selfId)
      const rows = threadRowsOf(liveThreadOf({ pane, topic, selfId, threadState, peerId }), notes, noteKey())
      const sendLabel = sendLabelOf({ sending, pane, topic, pending })
      const summary = summaries[noteKey()] || ''
      function onThreadScroll(ev) {
        pinOnScroll(ev && ev.currentTarget, pinRef, pinBottom, setPinBottom)
      }
      function jumpLatest() {
        pinLatest(pinRef, setPinBottom, threadRef.current)
      }
      function focusBox() {
        canFocusBox(pane) && focusEl(boxRef.current)
      }
      useEffect(() => {
        pinRef.current = true
        setPinBottom(true)
        focusBox()
      }, [pane, peerId, topicId, groupId])
      useEffect(() => {
        props.open && focusBox()
      }, [props.open])
      useEffect(() => {
        const el = threadRef.current
        el && !jumpId && pinRef.current && pinThreadEl(el)
        const t = el && !jumpId && pinRef.current && setTimeout(() => pinThreadEl(el), 80)
        return () => { t && clearTimeout(t) }
      }, [pane, peerId, topicId, groupId, rows.length, rows.length && rows[rows.length - 1] && rows[rows.length - 1].id, notes[noteKey()] && notes[noteKey()].length])
      useEffect(() => {
        if (!jumpId) return
        const t = setTimeout(() => { if (live.current) setJumpId('') }, 1600)
        return () => clearTimeout(t)
      }, [jumpId])
      const sessionWs = folderOf(workspaceOf(props.session))
      const letterWs = folderOf((liveLetter && liveLetter.workspace) || (incoming && incoming.workspace) || '')
      const wsName = letterWs || sessionWs
      const cardPeer = cardRowOf('peer', cardId, peers, groups)
      const cardGroup = cardRowOf('group', cardId, peers, groups)
      const cues = inboxCuesOf((state && state.inbox) || [])
      const cueIsHere = cueHereOf({ state, peers, pane, groupId, topicId, peerId })
      const cue = shownCueOf(cues, cueIdx, cueIsHere)
      function goCue(item) {
        goCueNow(item || cue, setHistOpen, setEmoOpen, (row) => goCueJump({
          state, peers, setPane, setGroupId, setTopicId, setWho, say,
        }, row))
      }
      function nextCue() {
        nextCueSpeak(nextCueIdx(cues, cueIdx, cueIsHere), say, setCueIdx)
      }
      async function retryFail(requestId) {
        const result = await post('/retry', { requestId })
        say(retrySpeak(result))
        refresh()
      }
      function bubble(m) {
        return chatBubble({ m, trMap, jumpId, openCtx, openAttach, retryFail, withdrawHere, openHandoff, continueHandoff })
      }
      function histView() {
        return chatHist({ histQ, setHistQ, rows, setHistOpen, setJumpId, state, peerId })
      }
      function cueBar() {
        return chatCue({ cue, cues, cueIsHere, goCue, nextCue })
      }
      const pairCode = state && state.pairCode
      const overlay = overlayIfOpen(props.open, overlayFrame({
        skin, onToggle: props.onToggle, popRef, win, setCtxMenu, setEmoOpen, startResize, pane,
        state, peopleQ, setPeopleQ, setPane, peerId, groupId, selfId, sortedPeers, peers, groups, cues, briefSeen,
        setWho, setGroupId, setTopicId, setHistOpen, setNewgOpen, setPickedMembers, newgOpen,
        openPeerCard, openGroupCard, openSetup,
        composer, sendLabel, toast, boxH, headBar, cueBar, paneCue, threadRef, onThreadScroll,
        dropping, setDropping, onDrop, wsName, letterWs, histOpen, summary, clearSummary, histView,
        post, refresh, say, goCue, pairCode, myName, setMyName, staffId, setStaffId,
        peerCode, setPeerCode, door, setDoor, lanPort, copyPair, mintCode, mintRelayInvite, relaySession, revokeRelayInvite, handshakeNow, exportHere, saveSetup, saveProbe,
        probeCards: listedLookups().map((row, i) => probeCard(row, i)),
        group, topics, topic, rows, bubble, pinBottom, jumpLatest, peer, pending, incoming,
        adoptOpen, pickReplies, setPickReplies, toggleCosign, nodHere, confirmAdoptSheet, adoptable, setAdoptOpen,
        ctxMenu, ctxAct, newGroupName, setNewGroupName, pickedMembers, makeGroup,
        cardKind, cardPeer, cardNote, setCardNote, cardStaff, setCardStaff, cardDoor, setCardDoor,
        cardPin, setCardPin, cardMute, setCardMute, cardId, closeCard, setDanger, savePeerCard,
        cardGroup, cardGroupName, setCardGroupName, cardMembers, setCardMembers, saveGroupCard,
        danger, dissolveHere, preview, setPreview, seeNow, copyAttach, saveWorkspace, openUniver,
        slipAsk, setSlipAsk, confirmSlip, forwardAsk, setForwardAsk, confirmForward, peers,
        acceptPair, rejectPair,
        sheet: state && state.pendingSheet,
        write: state && state.pendingWrite,
      }))
      if (inWorkbenchShell()) return overlay
      return chatBtn(unread, props.onToggle, overlay)
    }

    function WorkbenchChat(props) {
      const session = props.session
      const sessionId = (session && session.sessionId) || props.sessionId || ''
      const [open, setOpen] = useState(false)
      useEffect(() => {
        function onOpen() { setOpen(true) }
        window.addEventListener('dla-open-chat', onOpen)
        const prev = openChatHook
        openChatHook = (peerId) => {
          setOpen(true)
          if (typeof prev === 'function') prev(peerId)
        }
        return () => {
          window.removeEventListener('dla-open-chat', onOpen)
          if (openChatHook) openChatHook = prev || null
        }
      }, [])
      return h(ChatPop, {
        sessionId,
        session,
        open,
        onToggle: () => setOpen((v) => !v),
      })
    }

    function AskColleagueButton(props) {
      const session = props.session
      const sessionId = (session && session.sessionId) || props.sessionId || ''
      const [open, setOpen] = useState(false)
      useEffect(() => {
        const prev = openChatHook
        openChatHook = (peerId) => {
          setOpen(true)
          if (typeof prev === 'function') prev(peerId)
        }
        return () => { if (openChatHook) openChatHook = prev || null }
      }, [])
      return h(ChatPop, {
        sessionId,
        session,
        open,
        onToggle: () => setOpen((v) => !v),
      })
    }

    function SecretaryDock(props) {
      useSleepWatch()
      const session = props.session
      const { state, refresh } = useMailbox(session && session.sessionId, (snap) => snap && { dock: snap.dock })
      const [collapsed, setCollapsed] = useState(true)
      const [toast, setToast] = useState('')
      const dock = state && state.dock
      const chatModes = { asked: 1, reply: 1, presend: 1, outbox: 1, other: 1, brief: 1, 'nudge-ask': 1, nudge: 1 }
      if (!dock || chatModes[dock.mode]) return null

      function say(msg) {
        setToast(msg)
        setTimeout(() => setToast(''), 2200)
      }
      if (collapsed) {
        return h('div', { className: 'dla-dock is-collapsed' },
          h('button', {
            type: 'button',
            className: 'dla-dock-bar',
            onClick: () => setCollapsed(false),
          },
            h('span', { className: 'dla-dock-bar-copy' }, dock.speak),
            h('span', { className: 'dla-dock-toggle' }, '展开'),
          ),
        )
      }

      const primary = []
      const secondary = []
      if (dock.mode === 'preview') {
        /* execute / cancel live on the 业务 face; dock only points right */
      } else if (dock.mode === 'biz' || dock.mode === 'receipt' || dock.mode === 'compensate' || dock.mode === 'duty' || dock.mode === 'expired' || dock.mode === 'miss') {
        secondary.push(btn('先记下', async () => {
          await post('/biz/hold', { eventId: dock.requestId })
          say(dock.mode === 'compensate'
            ? '先记下。秘书不执行冲正。'
            : dock.mode === 'receipt'
              ? '先记下。没回执就不算已处理。'
              : dock.mode === 'duty'
                ? '先记下。没按花名册送信。'
                : dock.mode === 'expired'
                  ? '先记下。秘书不自己重登。'
                  : dock.mode === 'miss'
                    ? '先记下。没按岗位群发。'
                    : '先记下。没发消息，也没调度。')
          refresh()
        }, 'ghost'))
      } else if (dock.mode === 'advice') {
        primary.push(btn(dock.primary || '按这个记进档案', async () => {
          const result = await post('/advise/confirm', {})
          if (result.ok) say('已记进语义决策，带因果边')
          else say(result.error === 'NO_BECAUSE' ? '没有依据，不能记账' : (result.error || '没记下'))
          refresh()
        }, 'primary', !dock.adoptEnabled))
        secondary.push(btn('先不记', async () => {
          await post('/advise/dismiss', {})
          say('先不记进档案')
          refresh()
        }, 'ghost'))
      }

      return h('div', { className: 'dla-dock' },
        h('div', { className: 'dla-dock-body' },
          h('div', { className: 'dla-dock-speak-head' },
            h('span', { className: 'dla-dock-sec-label' }, '秘书'),
            dock.sign ? h('span', { className: 'dla-dock-sign' }, dock.sign) : null,
            h('button', { type: 'button', className: 'dla-dock-toggle', onClick: () => setCollapsed(true) }, '收起'),
          ),
          dock.mode === 'preview'
            ? h('p', { className: 'dla-dock-speak' }, dock.prompt || '请到右边确认。确认前不会改库。')
            : (dock.mode === 'receipt' || dock.mode === 'compensate')
              ? h('div', { className: 'dla-dock-speak is-rows' },
                ...((dock.preview && Array.isArray(dock.preview.lines) && dock.preview.lines.length
                  ? dock.preview.lines.map((row) => String(row.speak || '').replace(/。这是预览，不是过账。?$/, ''))
                  : String(dock.speak || '').split('\n')).filter(Boolean).map((line, i) => h('p', {
                    key: 'row-' + i,
                    className: 'dla-dock-row',
                  }, line))),
              )
              : h('p', { className: 'dla-dock-speak' }, dock.speak),
          (dock.nod || dock.lookup || dock.workspace) ? h('div', { className: 'dla-dock-meta' },
            dock.nod ? pill(dock.nod, 'hold') : null,
            dock.lookup ? pill(dock.lookup, /不在你名下|过期|没连/.test(dock.lookup) ? 'warn' : 'ok') : null,
            dock.workspace ? pill('跟 ' + folderOf(dock.workspace)) : null,
          ) : null,
          (primary.length || secondary.length) ? h('div', { className: 'dla-dock-actions' }, ...primary, ...secondary) : null,
          toast ? h('div', { className: 'dla-inline-toast' }, toast) : null,
        ),
      )
    }

    function statusPillKind(text) {
      const s = String(text || '')
      if (/紧急|urgent|高优|fail|失败/i.test(s)) return 'warn'
      if (/已完成|已关闭|已过|已通过|approved|done|resolved|posted|生效/i.test(s)) return 'ok'
      if (/处理中|进行中|processing|in.progress|跟进/i.test(s)) return 'hold'
      if (/停用|过期|到期|expired|作废|取消|void/i.test(s)) return 'bad'
      if (/草稿|draft|待审|pending|潜在/i.test(s)) return 'mute'
      return 'hold'
    }
    function speakSheetCell(col, value) {
      const key = col && typeof col === 'object' ? col.key : col
      const enums = col && typeof col === 'object' ? col.enums : null
      if (value == null || value === '') return ''
      if (typeof value === 'object') return String(value.label || value.title || value.name || value.code || '')
      const text = String(value)
      if (enums && enums[text]) return String(enums[text])
      if (/Date$|At$|Time$|_at$|_date$/i.test(String(key || '')) || /^\d{4}-\d{2}-\d{2}T/.test(text)) {
        const t = Date.parse(text)
        if (Number.isFinite(t)) {
          const d = new Date(t)
          const pad = (n) => String(n).padStart(2, '0')
          return d.getHours() || d.getMinutes()
            ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
            : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        }
      }
      if (/amount|total|price|qty|quantity|金额|数量/i.test(String(key || '')) && /^-?\d+(\.\d+)?$/.test(text)) {
        const n = Number(text)
        if (Number.isFinite(n)) return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
      }
      if (/^(true|false)$/i.test(text)) return /^true$/i.test(text) ? '是' : '否'
      if (/^\d{12,}$/.test(text)) return ''
      if (text === '未知') return ''
      return text
    }

    function chatBizInbox(p) {
      const inbox = p.inbox
      const pillOf = (kind) => ({
        receipt: 'ok', compensate: 'warn', duty: 'hold', expired: 'warn', miss: 'warn', advice: 'hold', biz: 'hold',
      }[kind] || 'hold')
      const nameOf = (kind) => ({
        receipt: '回执', compensate: '写失败', duty: '岗位', expired: '账号过期', miss: '没配对', advice: '档案', biz: '业务',
      }[kind] || '要看的')
      const picked = inbox.find((item) => item && item.id === p.pick) || inbox[0] || null
      if (!inbox.length) return h('div', { className: 'dla-sec-empty' }, '现在没有要你看的。同事消息、待确认的业务会出现在这里。')
      return h('div', { className: 'dla-inbox' },
        h('div', { className: 'dla-inbox-list' }, inbox.map((item) => h('button', {
          key: item.id,
          type: 'button',
          className: 'dla-inbox-item' + (picked && picked.id === item.id ? ' is-on' : ''),
          onClick: () => p.onPick && p.onPick(item.id),
        },
          h('span', { className: 'dla-pill ' + pillOf(item.kind) }, nameOf(item.kind)),
          h('span', { className: 'dla-inbox-item-speak' }, item.speak),
        ))),
        h('div', { className: 'dla-inbox-pane' },
          h('p', { className: 'dla-sheet-kicker' }, nameOf(picked.kind)),
          h('p', { className: 'dla-sec-row-speak' }, picked.speak),
          h('div', { className: 'dla-sec-nudge', style: { display: 'flex', gap: 6, marginTop: 12 } },
            h('button', { type: 'button', className: 'dla-btn dla-btn-primary', onClick: () => p.onItem(picked) }, '去看'),
            h('button', { type: 'button', className: 'dla-btn dla-btn-ghost', onClick: () => p.holdItem && p.holdItem(picked) }, '先记下'),
            picked.kind === 'chase' ? h('button', {
              type: 'button',
              className: 'dla-btn dla-btn-ghost',
              onClick: () => p.post('/chase', { requestId: picked.requestId }).then(p.refresh),
            }, '再催') : null,
          ),
        ),
      )
    }
    function chatLogFace(p) {
      const rows = listOf(p.ledger).slice().reverse()
      if (!rows.length) {
        return h('div', { className: 'dla-sec-empty' }, '还没有操作记录。')
      }
      return h('div', { className: 'dla-sheet-scroll' },
        h('p', { className: 'dla-sheet-kicker' }, '本机操作记录。不是现查，不是账本回执。'),
        h('table', { className: 'dla-sheet-table' },
          h('thead', null, h('tr', null, h('th', null, '时间'), h('th', null, '记录'))),
          h('tbody', null, rows.map((row, i) => h('tr', { key: String(row.at || i) + i },
            h('td', { className: 'dla-sheet-no' }, row.at ? new Date(row.at).toLocaleString() : ''),
            h('td', null, row.text || ''),
          ))),
        ),
      )
    }
    function chatConnFace(p) {
      const rows = listOf(p.lookups)
      const relay = p.relay || {}
      const relaySpeak = !relay.configured ? '未配' : (relay.connected ? '已连接' : '已配未连')
      const env = !!relay.env
      return h('div', { className: 'dla-sheet-scroll' },
        h('p', { className: 'dla-sheet-kicker' }, env
          ? '中继由环境变量固定。令牌路径不回显。'
          : '中继可在这一页保存。令牌路径不回显。'),
        h('table', { className: 'dla-sheet-table' },
          h('thead', null, h('tr', null, h('th', null, '通道'), h('th', null, '状态'))),
          h('tbody', null, h('tr', { key: 'relay' },
            h('td', null, '中继'),
            h('td', null, relaySpeak),
          )),
        ),
        h('div', { className: 'dla-sheet-actions', key: 'relay-form' },
          h('input', {
            className: 'dla-sheet-cell',
            placeholder: 'nats://127.0.0.1:4222',
            value: p.relayDraft || '',
            readOnly: env,
            onChange: (ev) => p.onRelayDraft && p.onRelayDraft(ev.target.value),
          }),
          h('input', {
            className: 'dla-sheet-cell',
            placeholder: relay.credsSet ? '已设置路径，留空则保留' : '本机 .creds 绝对路径',
            value: p.credsDraft || '',
            readOnly: env,
            onChange: (ev) => p.onCredsDraft && p.onCredsDraft(ev.target.value),
          }),
          env ? null : btn('保存中继', () => p.onRelaySave && p.onRelaySave(), 'primary'),
          env || !relay.credsSet ? null : btn('清除令牌路径', () => p.onRelayClear && p.onRelayClear(), 'ghost'),
        ),
        rows.length ? h('table', { className: 'dla-sheet-table' },
          h('thead', null, h('tr', null,
            h('th', null, '系统'),
            h('th', null, '环境'),
            h('th', null, '地址'),
            h('th', null, '令牌'),
          )),
          h('tbody', null, rows.map((row) => h('tr', { key: row.id },
            h('td', null, row.system || row.dialect || row.id),
            h('td', null, row.env || ''),
            h('td', { className: 'dla-sheet-no' }, row.baseUrl || '未配'),
            h('td', null, row.hasToken ? '已在本机' : '没有'),
          ))),
        ) : h('p', { className: 'dla-sec-empty' }, '还没有业务连接。'),
      )
    }
    function chatTraceFace(p) {
      const rows = listOf(p.rows)
      const mail = listOf(p.mailRows)
      if (!p.workspace) {
        return h('div', { className: 'dla-sec-empty' }, '先在左边点一个工作区，才能看账本。')
      }
      return h('div', { className: 'dla-sheet-scroll' },
        h('p', { className: 'dla-sheet-kicker' }, '只看当时记下的回执，不是此刻库存。勾选后才能点头进图。'),
        h('div', { className: 'dla-sheet-actions' },
          h('input', {
            className: 'dla-sheet-cell',
            placeholder: '单号（当时）',
            value: p.no || '',
            onChange: (ev) => p.onNo && p.onNo(ev.target.value),
          }),
          btn('查当时', () => p.onLook && p.onLook(), 'primary', !p.workspace),
        ),
        h('label', { className: 'dla-sheet-kicker', style: { display: 'flex', gap: 8, alignItems: 'center' } },
          h('input', { type: 'checkbox', checked: !!p.nod, onChange: (ev) => p.onNod && p.onNod(!!ev.target.checked) }),
          '我点头把投影 ingest 进图（当时，不是现查）',
        ),
        btn('点头进图', () => p.onIngest && p.onIngest(), 'primary', !p.nod || !p.workspace),
        !rows.length && !mail.length
          ? h('p', { className: 'dla-sec-empty' }, '账本还没有这笔当时记录。')
          : null,
        rows.length ? h('table', { className: 'dla-sheet-table' },
          h('thead', null, h('tr', null,
            h('th', null, '型'),
            h('th', null, '单号'),
            h('th', null, '动作'),
            h('th', null, '回执'),
          )),
          h('tbody', null, rows.map((row) => h('tr', { key: row.id },
            h('td', null, row.kind || ''),
            h('td', { className: 'dla-sheet-no' }, row.no || ''),
            h('td', null, row.action || ''),
            h('td', null, row.receipt_id || ''),
          ))),
        ) : null,
        mail.length ? h('table', { className: 'dla-sheet-table' },
          h('thead', null, h('tr', null,
            h('th', null, '信件'),
            h('th', null, '单号'),
            h('th', null, '摘要'),
          )),
          h('tbody', null, mail.map((row) => h('tr', { key: row.id },
            h('td', { className: 'dla-sheet-no' }, row.messageId || row.id || ''),
            h('td', { className: 'dla-sheet-no' }, row.no || ''),
            h('td', null, row.excerpt || ''),
          ))),
        ) : null,
      )
    }
    function chatCatalogFace(p) {
      const kinds = listOf(p.kinds)
      const relations = listOf(p.relations)
      const canSlots = ['现查', '改行', '删除', '新建', '过审']
      if (!p.workspace) {
        return h('div', { className: 'dla-sec-empty' }, '先在左边点一个工作区，目录才会出现。')
      }
      const versions = listOf(p.catalogVersion).join('、')
      const picked = kinds.find((row) => row && row.kind === p.pick) || null
      function canBar() {
        return h('div', { className: 'dla-choice' }, canSlots.map((name) => h('button', {
          key: name,
          type: 'button',
          className: 'dla-choice-btn' + (listOf(p.can).indexOf(name) >= 0 ? ' is-on' : ''),
          onClick: () => p.onCan && p.onCan(name),
        }, name)))
      }
      function nodBar() {
        return h('label', { className: 'dla-sheet-kicker', style: { display: 'flex', gap: 8, alignItems: 'center' } },
          h('input', { type: 'checkbox', checked: !!p.nod, onChange: (ev) => p.onNod && p.onNod(!!ev.target.checked) }),
          '我点头发布到语义仓',
        )
      }
      const createBar = h('div', { className: 'dla-sheet-actions', key: 'new' },
        h('p', { className: 'dla-sheet-kicker' }, '新型'),
        h('input', {
          className: 'dla-sheet-cell',
          style: { maxWidth: 220 },
          placeholder: '型名',
          value: p.newKind || '',
          onChange: (ev) => p.onNewKind && p.onNewKind(ev.target.value),
        }),
        canBar(),
        nodBar(),
        btn('点头新建', () => p.onCreate && p.onCreate(), 'primary', !p.nod || !String(p.newKind || '').trim()),
      )
      if (!kinds.length) {
        return h('div', { className: 'dla-sheet-scroll' },
          h('p', { className: 'dla-sec-empty' }, '这个工作区还没有登记型。'),
          createBar,
        )
      }
      return h('div', { className: 'dla-sheet-scroll' },
        h('p', { className: 'dla-sheet-kicker' }, versions ? ('目录 · 版本 ' + versions + '。发布要点头。') : '目录。发布要点头，不自动写。'),
        h('table', { className: 'dla-sheet-table' },
          h('thead', null, h('tr', null,
            h('th', null, '型'),
            h('th', null, '能做'),
            h('th', null, '字段'),
            h('th', null, '别名'),
          )),
          h('tbody', null, kinds.map((row) => h('tr', {
            key: row.kind,
            className: p.pick === row.kind ? 'is-on' : '',
            onClick: () => p.onPick && p.onPick(row),
          },
            h('td', { className: 'dla-sheet-no' }, row.kind || ''),
            h('td', null, listOf(row.can).join('、')),
            h('td', null, listOf(row.fields).join('、')),
            h('td', null, listOf(row.aliases).join('、')),
          ))),
        ),
        picked ? h('div', { className: 'dla-sheet-actions', key: 'pub' },
          h('p', { className: 'dla-sheet-kicker' }, '发布 ' + picked.kind),
          canBar(),
          h('input', {
            className: 'dla-sheet-cell',
            style: { maxWidth: 160, marginTop: 8 },
            placeholder: '目录版本',
            value: p.version || '',
            onChange: (ev) => p.onVersion && p.onVersion(ev.target.value),
          }),
          nodBar(),
          btn('点头发布', () => p.onPublish && p.onPublish(picked), 'primary', !p.nod),
        ) : h('p', { className: 'dla-sheet-kicker' }, '勾一型再发布，或在下面新建。'),
        createBar,
        relations.length ? h('p', { className: 'dla-sheet-kicker' }, '已确认关系') : null,
        relations.length ? h('table', { className: 'dla-sheet-table' },
          h('thead', null, h('tr', null, h('th', null, '从'), h('th', null, '到'), h('th', null, '列'))),
          h('tbody', null, relations.map((row, i) => h('tr', { key: (row.from || '') + '>' + (row.to || '') + i },
            h('td', null, row.from || ''),
            h('td', null, row.to || ''),
            h('td', null, row.field || ''),
          ))),
        ) : null,
      )
    }
    function chatSheetTable(p) {
      const sheet = p.sheet
      const rows = p.rows
      const many = p.many
      const pickField = p.pickField
      const fieldChoices = p.fieldChoices
      return pickField
        ? h('div', { className: 'dla-sheet-scroll', key: 'fields' },
          h('p', { className: 'dla-sheet-kicker' }, sheet.speak || '勾一列再改。'),
          h('table', { className: 'dla-sheet-table' },
            h('thead', null, h('tr', null, h('th', { className: 'dla-sheet-pick' }, ''), h('th', null, '列'))),
            h('tbody', null, fieldChoices.map((row, i) => h('tr', {
              key: row.name || i,
              className: p.pickedField === i ? 'is-on' : '',
              onClick: () => p.setPickedField(i),
            },
              h('td', { className: 'dla-sheet-pick' }, h('input', {
                type: 'radio',
                name: 'dla-sheet-field',
                checked: p.pickedField === i,
                onChange: (ev) => { ev.stopPropagation(); p.setPickedField(i) },
              })),
              h('td', null, row.title || row.name),
            ))),
          ),
        )
        : rows.length
          ? h('div', { className: 'dla-sheet-scroll' },
            h('table', { className: 'dla-sheet-table' },
              h('thead', null, h('tr', null,
                many ? h('th', { className: 'dla-sheet-pick' }, '') : null,
                ...(sheet.columns || []).map((col) => h('th', { key: col.key, className: col.key === 'index' ? 'dla-sheet-num' : '' }, col.label || col.key)),
              )),
              h('tbody', null, rows.map((row, i) => h('tr', {
                key: row.no || i,
                className: (!many || p.picked === i) ? 'is-on' : '',
                onClick: () => p.pickRow(i, row),
              },
                many ? h('td', { className: 'dla-sheet-pick' }, h('input', {
                  type: 'radio',
                  name: 'dla-sheet-row',
                  checked: p.picked === i,
                  onChange: (ev) => { ev.stopPropagation(); p.pickRow(i, row) },
                })) : null,
                ...(sheet.columns || []).map((col) => {
                  const raw = col.key === 'status' ? (row.status || (row.fields && row.fields.status)) : (row.fields && row.fields[col.key])
                  const spoken = speakSheetCell(col, raw)
                  const editing = p.editing && (!many || p.picked === i) && col.key !== 'index'
                  return h('td', { key: col.key, className: col.key === 'index' ? 'dla-sheet-num' : (col.key === 'status' ? 'dla-sheet-st' : '') },
                    col.key === 'index' ? String(i + 1)
                      : editing
                        ? h('input', {
                          className: 'dla-sheet-cell',
                          value: p.drafts[col.key] != null ? String(p.drafts[col.key]) : String((col.key === 'no' ? row.no : raw) ?? ''),
                          onClick: (ev) => ev.stopPropagation(),
                          onChange: (ev) => p.setDrafts(Object.assign({}, p.drafts, { [col.key]: ev.target.value })),
                        })
                        : col.key === 'no' ? h('span', { className: 'dla-sheet-no' }, row.no || '')
                          : (col.key === 'status' && spoken ? pill(spoken, statusPillKind(spoken)) : spoken),
                  )
                }),
              ))),
            ),
          )
          : h('div', { className: 'dla-sec-empty' },
            h('p', { className: 'dla-sheet-kicker' }, sheet.speak || '业务系统里没有对上的单。不发写令牌。'),
            sheet.askRest ? h('button', {
              type: 'button',
              className: 'dla-btn dla-btn-primary',
              style: { marginTop: 12 },
              onClick: p.fileAsk,
            }, '这是问句') : null,
          )
    }
    function chatSheetFace(p) {
      const sheet = p.sheet
      const rows = listOf(p.rows)
      if (!sheet) {
        return h('div', { className: 'dla-sec-empty', key: 'empty' }, '现在没有要确认的业务数据。')
      }
      const hopNext = p.hopNext
      const folder = sheet.workspace ? String(sheet.workspace).split(/[\\/]/).filter(Boolean).pop() : ''
      const kicker = (folder ? ('跟 ' + folder + ' · ') : '')
        + (hopNext ? ('勾一家，再看' + sheet.nextKind) : (sheet.action === '现查' ? '现查，不写库' : '确认前不会改库'))
      const title = hopNext
        ? ((sheet.kind || '业务') + ' · 再看' + sheet.nextKind)
        : (sheet.action === '现查' ? ((sheet.kind || '业务') + '查询结果') : ('确认' + (sheet.action || '修改') + '业务数据'))
      const confirm = hopNext
        ? h('p', { className: 'dla-sheet-kicker', key: 'c' }, '对上多条。勾一张，再看这家的' + sheet.nextKind + '。不改' + (sheet.kind || '这一行') + '。')
        : (sheet.action && sheet.action !== '现查')
          ? h('div', { className: 'dla-sheet-confirm', key: 'c' },
            p.batch
              ? h('p', { className: 'dla-sheet-kicker' }, p.batchNod && sheet.action === '删除'
                ? '批量删除要再点一次。点了才写库。'
                : ('将' + (sheet.action || '改') + (listOf(sheet.nos).length || rows.length) + '条。点确认执行才写库。清单以预览时为准。'))
              : p.many && p.picked < 0
              ? h('p', { className: 'dla-sheet-kicker' }, '对上多条。勾一张才能确认执行。')
              : [
                p.chosen ? h('div', { className: 'dla-sheet-meta', key: 'm' },
                  pill((sheet.kind || '') + ' ' + (p.chosen.no || '')),
                  pill(sheet.action),
                  pill('需确认', 'warn'),
                ) : null,
                h('p', { className: 'dla-sheet-kicker', key: 'ck' },
                  p.editing ? '直接改表上的格子。点确认执行才写库。' : (sheet.speak || '点确认执行才写库。')),
              ],
          )
          : h('p', { className: 'dla-sheet-kicker', key: 'lookup' }, rows.length
            ? ('这是现查。没有确认执行。表上 ' + rows.length + ' 条，按更新时间倒序。')
            : '这是现查。没有确认执行。')
      const primary = p.pickField
        ? btn('用这列改', p.continuePicked, 'primary', !(p.chosenField && p.chosenField.name))
        : hopNext
          ? btn('看这家的' + sheet.nextKind, p.continuePicked, 'primary', !(p.chosen && p.chosen.no))
          : (sheet.askRest && !rows.length)
            ? btn('这是问句', p.fileAsk, 'primary')
            : sheet.action === '现查'
              ? null
              : btn(p.batch && p.batchNod && sheet.action === '删除' ? '再确认删除' : '确认执行', p.runWrite, 'primary', !p.canWrite)
      const actionKind = sheet.action === '现查' ? 'look' : (sheet.action === '过审' ? 'pass' : (sheet.action ? 'write' : 'look'))
      return [
        h('p', { className: 'dla-sheet-banner is-' + actionKind, key: 'k' }, kicker),
        h('h2', { className: 'dla-sheet-title', key: 't' },
          h('span', { className: 'dla-sheet-kind' }, sheet.kind || '业务'),
          h('span', { className: 'dla-sheet-action is-' + actionKind }, sheet.action || '现查'),
          hopNext ? (' 再看' + sheet.nextKind) : (sheet.action === '现查' ? ' 查询结果' : ' 待确认'),
        ),
        h('div', { className: 'dla-sheet-block', key: 'tbl' }, chatSheetTable(p)),
        confirm,
        h('div', { className: 'dla-sheet-foot', key: 'foot' },
          p.canBack ? btn('返回', p.backSheet, 'ghost') : null,
          btn('取消', p.cancelWrite, 'ghost'),
          primary,
        ),
        p.toast ? h('div', { className: 'dla-inline-toast', key: 'toast' }, p.toast) : null,
      ]
    }

    function OverlayBadge(props) {
      const [liveSid, setLiveSid] = useState('')
      const { state, refresh } = useMailbox(liveSid, (snap) => snap && {
        pendingCount: snap.pendingCount,
        inbox: snap.inbox,
        pendingSheet: snap.pendingSheet,
        pendingWrite: snap.pendingWrite,
        dock: snap.dock,
        lookups: snap.lookups,
        ledger: snap.ledger,
        relayConfigured: snap.relayConfigured,
        relayConnected: snap.relayConnected,
        relayUrl: snap.relayUrl,
        relayCredsSet: snap.relayCredsSet,
        relayEnv: snap.relayEnv,
      })
      const [open, setOpen] = useState(false)
      const [face, setFace] = useState('inbox')
      const [traceRows, setTraceRows] = useState([])
      const [mailRows, setMailRows] = useState([])
      const [traceNo, setTraceNo] = useState('')
      const [traceNod, setTraceNod] = useState(false)
      const [catalog, setCatalog] = useState({ kinds: [], relations: [], catalogVersion: [] })
      const [catalogPick, setCatalogPick] = useState('')
      const [catalogCan, setCatalogCan] = useState([])
      const [catalogVer, setCatalogVer] = useState('')
      const [catalogNod, setCatalogNod] = useState(false)
      const [catalogNew, setCatalogNew] = useState('')
      const [lastWorkspace, setLastWorkspace] = useState('')
      useEffect(() => {
        function tick() {
          try {
            const api = sessionsApi
            if (!api) return
            const cur = api.current || api.active || api.selected
            const session = typeof cur === 'function' ? cur() : cur
            const id = String((session && (session.id || session.sessionId || (session.session && session.session.id))) || '').trim()
            const ws = workspaceOf(session)
            if (id) setLiveSid((was) => was === id ? was : id)
            if (ws) setLastWorkspace((was) => was === ws ? was : ws)
          } catch { /* sessions stay off the overlay tree */ }
        }
        tick()
        const timer = setInterval(tick, 1500)
        return () => clearInterval(timer)
      }, [])
      const [picked, setPicked] = useState(-1)
      const [pickedField, setPickedField] = useState(-1)
      const [drafts, setDrafts] = useState({})
      const [toast, setToast] = useState('')
      const [batchNod, setBatchNod] = useState(false)
      const [panelSize, setPanelSize] = useState({ w: 720, h: 560, right: 24 })
      const [cmdOpen, setCmdOpen] = useState(false)
      const [cmdQ, setCmdQ] = useState('')
      const [inboxPick, setInboxPick] = useState('')
      const [relayDraft, setRelayDraft] = useState('')
      const [credsDraft, setCredsDraft] = useState('')
      const pickLock = useRef(false)
      const count = state && state.pendingCount || 0
      const inbox = listOf((state && state.inbox) || (mailboxSnap && mailboxSnap.inbox)).filter((item) => item && (
        item.kind === 'biz' || item.kind === 'receipt' || item.kind === 'compensate'
        || item.kind === 'duty' || item.kind === 'expired' || item.kind === 'miss' || item.kind === 'advice'
      ))
      const sheet = (state && state.pendingSheet) || (mailboxSnap && mailboxSnap.pendingSheet)
      const inboxWs = [...new Set(inbox.map((item) => String((item && item.workspace) || '').trim()).filter(Boolean))]
      const liveWs = String(
        liveSessionWorkspace()
        || (sheet && sheet.workspace)
        || (state && state.pendingWrite && state.pendingWrite.workspace)
        || (state && state.dock && state.dock.workspace)
        || (inboxWs.length === 1 ? inboxWs[0] : '')
        || '',
      ).trim()
      const traceWs = liveWs || lastWorkspace
      const openSession = props && props.openSession
      const sheetKey = sheet
        ? [sheet.sessionId || '', sheet.workspace || '', sheet.kind, sheet.no, sheet.preview_id, sheet.action, sheet.batch ? 'batch' : '', listOf(sheet.nos).join(','), sheet.askRest || '', sheet.pickField ? 'field' : '', listOf(sheet.fieldChoices).map((row) => row && row.name).join(','), listOf(sheet.rows).map((row) => row && row.no).join(',')].join('|')
        : ''
      useEffect(() => {
        if (!inWorkbenchShell()) return
        if (sheet && sheet.action && sheet.action !== '现查' && (sheet.preview_id || sheet.batch)) {
          setFace('biz')
          setOpen(true)
        }
      }, [sheetKey])
      useEffect(() => {
        if (!sheetKey) return
        setFace('biz')
        setOpen(true)
        setPicked((sheet.rows && sheet.rows.length === 1) ? 0 : -1)
        setPickedField(-1)
        setBatchNod(false)
        const next = {}
        const row = (sheet.rows && sheet.rows.length === 1) ? sheet.rows[0] : null
        if (row && row.fields) {
          Object.keys(row.fields).forEach((key) => { next[key] = row.fields[key] })
        }
        listOf(sheet.changes).forEach((change) => { if (change && change.field) next[change.field] = change.to })
        setDrafts(next)
      }, [sheetKey])
      useEffect(() => {
        if (liveWs) setLastWorkspace(liveWs)
      }, [liveWs])
      useEffect(() => {
        if (face !== 'conn') return
        setRelayDraft(String((state && state.relayUrl) || ''))
        setCredsDraft('')
      }, [face, state && state.relayUrl])
      useEffect(() => {
        function onKey(ev) {
          const key = String(ev.key || '').toLowerCase()
          if ((ev.metaKey || ev.ctrlKey) && key === 'k') {
            const tag = ev.target && ev.target.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA') return
            ev.preventDefault()
            setOpen(true)
            setCmdOpen(true)
            setCmdQ('')
            return
          }
          if (key === 'escape') setCmdOpen(false)
        }
        window.addEventListener('keydown', onKey)
        function onOpenBiz() {
          setOpen(true)
          setFace('biz')
        }
        function onOpenFace(ev) {
          const next = ev && ev.detail && ev.detail.face
          setOpen(true)
          if (next) setFace(String(next))
        }
        window.addEventListener('dla-open-biz', onOpenBiz)
        window.addEventListener('dla-open-face', onOpenFace)
        return () => {
          window.removeEventListener('keydown', onKey)
          window.removeEventListener('dla-open-biz', onOpenBiz)
          window.removeEventListener('dla-open-face', onOpenFace)
        }
      }, [])
      useEffect(() => {
        if (!open || face !== 'trace') return
        if (!traceWs) {
          setTraceRows([])
          setMailRows([])
          return
        }
        let live = true
        get('/traces?workspace=' + encodeURIComponent(traceWs)).then((got) => {
          if (!live) return
          setTraceRows(listOf(got && got.rows))
          setMailRows(listOf(got && got.mailRows))
        })
        return () => { live = false }
      }, [open, face, traceWs])
      useEffect(() => {
        if (!open || face !== 'catalog') return
        if (!traceWs) {
          setCatalog({ kinds: [], relations: [], catalogVersion: [] })
          return
        }
        let live = true
        get('/catalog?workspace=' + encodeURIComponent(traceWs)).then((got) => {
          if (!live) return
          setCatalog({
            kinds: listOf(got && got.kinds),
            relations: listOf(got && got.relations),
            catalogVersion: listOf(got && got.catalogVersion),
          })
        })
        return () => { live = false }
      }, [open, face, traceWs])
      function startResize(edge) {
        return function onDown(ev) {
          const startX = ev.clientX
          const startY = ev.clientY
          const startW = panelSize.w
          const startH = panelSize.h
          const startRight = panelSize.right
          dragOn(ev, (next) => {
            const maxW = Math.max(360, window.innerWidth - 24)
            const maxH = Math.max(280, window.innerHeight - 80)
            const dx = next.clientX - startX
            const dy = next.clientY - startY
            const w = startW + (edge === 'left' ? -dx : ((edge === 'right' || edge === 'se') ? dx : 0))
            const h = startH + ((edge === 'se' || edge === 'bottom') ? dy : 0)
            const right = (edge === 'right' || edge === 'se') ? Math.max(8, startRight - dx) : startRight
            setPanelSize({
              w: Math.min(Math.max(360, w), maxW),
              h: Math.min(Math.max(280, h), maxH),
              right,
            })
          })
        }
      }
      function say(msg) {
        setToast(msg)
        setTimeout(() => setToast(''), 1800)
      }
      const rows = (sheet && Array.isArray(sheet.rows)) ? sheet.rows : []
      const many = rows.length > 1
      const chosen = many ? rows[picked] : rows[0]
      const fieldChoices = (sheet && Array.isArray(sheet.fieldChoices)) ? sheet.fieldChoices : []
      const pickField = !!(sheet && sheet.pickField && fieldChoices.length)
      const chosenField = pickField ? fieldChoices[pickedField] : null
      const hopNext = !!(sheet && sheet.nextKind && many && !pickField)
      const editing = !!(sheet && (sheet.action === '改行' || sheet.action === '新建') && chosen && chosen.no && !pickField && !hopNext)
      const dirtyPatch = {}
      if (editing) {
        ;(sheet.columns || []).forEach((col) => {
          if (!col || col.key === 'index') return
          const was = col.key === 'no' ? chosen.no : col.key === 'status' ? chosen.status : (chosen.fields && chosen.fields[col.key])
          const now = drafts[col.key] != null ? drafts[col.key] : was
          if (String(now ?? '') !== String(was ?? '')) dirtyPatch[col.key] = now
        })
        ;(sheet.changes || []).forEach((row) => {
          const now = drafts[row.field] != null ? drafts[row.field] : row.to
          if (String(now ?? '') !== String((chosen.fields && chosen.fields[row.field]) ?? '')) dirtyPatch[row.field] = now
        })
      }
      const batchWrite = !!(sheet && sheet.batch && sheet.preview_id && sheet.action && sheet.action !== '现查')
      const canWrite = !!(!hopNext && sheet && sheet.action && sheet.action !== '现查' && (
        batchWrite
        || (chosen && chosen.no && (sheet.action !== '改行' || Object.keys(dirtyPatch).length || (sheet.changes || []).length))
      ))
      function pickRow(i, row) {
        if (!many || !row || !row.no) return
        setPicked(i)
      }
      async function fileAsk() {
        if (pickLock.current) return
        if (!sheet || !sheet.askRest) {
          say('没有要记的问句。')
          return
        }
        pickLock.current = true
        try {
          const result = await post('/sheet/ask', {
            sessionId: sheet.sessionId || sessionId || '',
            workspace: sheet.workspace || '',
            rest: sheet.askRest,
          })
          result && result.ok === false && say(result.hint || result.error || '没记成')
          refresh()
        } finally {
          pickLock.current = false
        }
      }
      async function backSheet() {
        if (!sheet || !sheet.canBack || pickLock.current) return
        pickLock.current = true
        try {
          const result = await post('/sheet/back', {})
          result && result.ok === false && say(result.hint || result.error || '没有上一页。')
          refresh()
        } finally {
          pickLock.current = false
        }
      }
      async function continuePicked() {
        const pick = pickField
          ? { body: { field: chosenField && chosenField.name }, miss: '先勾一列。', ok: !!(chosenField && chosenField.name) }
          : { body: { no: chosen && chosen.no }, miss: '对上多条，先勾一张。', ok: !!(sheet && chosen && chosen.no) }
        if (!pick.ok || pickLock.current) { say(pick.miss); return }
        pickLock.current = true
        try {
          const result = await post('/sheet/pick', Object.assign({
            sessionId: sheet.sessionId || sessionId || '',
            workspace: sheet.workspace || '',
          }, pick.body))
          result && result.ok === false && say(result.hint || result.error || '没选成')
          refresh()
        } finally {
          pickLock.current = false
        }
      }
      async function previewOnce(patch) {
        const preview = await post('/preview', {
          kind: sheet.kind,
          no: chosen.no,
          action: sheet.action,
          patch,
          speech: sheet.speech || '',
          sessionId: sheet.sessionId || sessionId || '',
          workspace: sheet.workspace || '',
        })
        return { preview, id: String((preview && preview.preview_id) || '').trim() }
      }
      async function runWrite() {
        if (hopNext) return continuePicked()
        if (sheet && sheet.batch && sheet.preview_id) {
          if (sheet.action === '删除' && !batchNod) {
            setBatchNod(true)
            say('批量删除要再确认一次。')
            return
          }
          if (pickLock.current) return
          pickLock.current = true
          try {
            const result = await post('/write', {
              preview_id: sheet.preview_id,
              confirm: sheet.action === '删除',
            })
            say(result && result.ok === false
              ? (result.hint || result.speak || result.error || '没写成')
              : (result && result.speak) || '写了但没回执，不能记已处理。')
            refresh()
          } finally {
            pickLock.current = false
          }
          return
        }
        if (!sheet || !chosen || !chosen.no) { say('对上多条，先勾一张。'); return }
        if (pickLock.current) return
        pickLock.current = true
        try {
          const patch = Object.assign({}, dirtyPatch)
          ;(sheet.changes || []).forEach((row) => {
            patch[row.field] == null && (patch[row.field] = drafts[row.field] != null ? drafts[row.field] : row.to)
          })
          let previewId = String(sheet.preview_id || '').trim()
          const dirty = Object.keys(patch).some((key) => {
            const was = ((sheet.changes || []).find((row) => row.field === key) || {}).to
            return String(patch[key]) !== String(was || '')
          })
          if (!previewId || many || dirty) {
            const first = await previewOnce(patch)
            previewId = first.id
            if (!previewId) {
              say((first.preview && (first.preview.hint || first.preview.speak || first.preview.error)) || '没预览成')
              refresh()
              return
            }
          }
          let result = await post('/write', { preview_id: previewId })
          const stale = result && result.ok === false && /EXPIRED|STALE|NEED_PREVIEW/.test(String(result.error || ''))
          if (stale) {
            const again = await previewOnce(patch)
            previewId = again.id
            if (!previewId) {
              say((again.preview && (again.preview.hint || again.preview.speak || again.preview.error)) || (result.hint || result.speak || '没预览成'))
              refresh()
              return
            }
            result = await post('/write', { preview_id: previewId })
          }
          const speak = ({
            USED: result && (result.hint || result.speak || '这张预览已经用过。要写再预览一次。'),
            fail: result && (result.hint || result.speak || result.error || '没写成'),
            ok: result && (result.speak || '写了但没回执，不能记已处理。'),
          })[result && result.error === 'USED' ? 'USED' : result && result.ok === false ? 'fail' : 'ok']
          say(speak)
          result && result.ok && setOpen(false)
          refresh()
        } finally {
          pickLock.current = false
        }
      }
      const badgeCount = inbox.length + (sheet && sheet.canWrite ? 1 : 0)
      const inShell = inWorkbenchShell()
      return h('div', { className: 'dla-overlay' + (inShell ? ' is-shell' : ''), style: { pointerEvents: (inShell && !open) ? 'none' : 'auto' } },
        inShell ? null : h('button', {
          type: 'button',
          className: 'dla-badge',
          onClick: () => {
            const next = !open
            setOpen(next)
            if (next && sheet) setFace('biz')
          },
          title: '工作台 · 待你点的单',
        }, '工作台', badgeCount > 0 ? h('b', null, String(badgeCount)) : null),
        open ? h('div', { className: 'dla-sec-backdrop', onClick: () => setOpen(false) },
          h('div', {
            className: 'dla-sec-panel is-sheet' + (inShell ? ' is-shell' : ''),
            style: { width: panelSize.w + 'px', height: panelSize.h + 'px', right: panelSize.right + 'px', maxHeight: 'none' },
            onClick: (ev) => ev.stopPropagation(),
          },
            h('div', { className: 'dla-sec-panel-head' + (inShell ? ' is-bar' : '') },
              inShell ? null : h('div', { className: 'dla-sec-faces' },
                [['inbox', '要看的', '消息和待确认'], ['biz', '业务', '查改过审'], ['trace', '账本', '当时回执'], ['catalog', '目录', '型怎么叫'], ['conn', '连接', '系统和中继'], ['log', '记录', '本机操作']].map((row) => h('button', {
                  key: row[0],
                  type: 'button',
                  className: 'dla-sec-face' + (face === row[0] ? ' on' : ''),
                  onClick: () => setFace(row[0]),
                },
                  h('span', { className: 'dla-sec-face-t' }, row[1]),
                  h('span', { className: 'dla-sec-face-h' }, row[2]),
                )),
              ),
              btn('关闭', () => setOpen(false), 'ghost'),
            ),
            h('div', { className: 'dla-sec-main' },
            cmdOpen && !inShell ? h('div', { className: 'dla-cmd', key: 'cmd' },
              h('input', {
                className: 'dla-cmd-input',
                autoFocus: true,
                placeholder: '跳到要看的、业务、账本…',
                value: cmdQ,
                onChange: (ev) => setCmdQ(ev.target.value),
                onKeyDown: (ev) => {
                  if (ev.key === 'Escape') setCmdOpen(false)
                },
              }),
              [['inbox', '要看的'], ['biz', '业务'], ['trace', '账本'], ['catalog', '目录'], ['conn', '连接'], ['log', '记录']]
                .filter((row) => !String(cmdQ || '').trim() || row[1].indexOf(String(cmdQ).trim()) >= 0)
                .map((row) => h('button', {
                  key: row[0],
                  type: 'button',
                  className: 'dla-cmd-row' + (face === row[0] ? ' is-on' : ''),
                  onClick: () => { setFace(row[0]); setCmdOpen(false) },
                }, row[1])),
            ) : null,
            (function sheetBody() {
              try {
                return face === 'inbox'
                  ? chatBizInbox({
                    inbox, post, refresh, pick: inboxPick, onPick: setInboxPick,
                    holdItem: async (item) => {
                      if (item.kind === 'advice') await post('/advise/dismiss', {})
                      else await post('/biz/hold', { eventId: item.requestId })
                      say('先记下。没发消息，也没调度。')
                      refresh()
                    },
                    onItem: async (item) => {
                      const sid = String((item && item.sessionId) || '').trim()
                      const run = {
                        session: () => { openSession && openSession(sid); setOpen(false) },
                        chase: async () => { await post('/chase', { requestId: item.requestId }); refresh() },
                        brief: async () => { await post('/brief', { off: true }); refresh() },
                        close: () => setOpen(false),
                      }
                      await (sid && typeof openSession === 'function' ? run.session
                        : run[item.kind] || run.close)()
                    },
                  })
                  : face === 'trace'
                    ? h('div', { className: 'dla-sheet' }, chatTraceFace({
                      workspace: traceWs,
                      rows: traceRows,
                      mailRows,
                      no: traceNo,
                      nod: traceNod,
                      onNod: setTraceNod,
                      onNo: setTraceNo,
                      onIngest: async () => {
                        if (!traceNod || !traceWs) return
                        const result = await post('/traces/ingest', { workspace: traceWs, nodded: true })
                        say((result && result.ok) ? '已点头进图。图里是当时，不是现查。' : ((result && (result.hint || result.error)) || '语义仓没接上，不能 ingest。'))
                        setTraceNod(false)
                      },
                      onLook: () => {
                        if (!traceWs) return
                        const q = '/traces?workspace=' + encodeURIComponent(traceWs)
                          + (String(traceNo || '').trim() ? '&no=' + encodeURIComponent(String(traceNo).trim()) : '')
                        get(q).then((got) => {
                          setTraceRows(listOf(got && got.rows))
                          setMailRows(listOf(got && got.mailRows))
                        })
                      },
                    }))
                  : face === 'conn'
                    ? h('div', { className: 'dla-sheet' }, chatConnFace({
                      lookups: listOf(state && state.lookups),
                      relay: {
                        configured: !!(state && state.relayConfigured),
                        connected: !!(state && state.relayConnected),
                        url: state && state.relayUrl,
                        credsSet: !!(state && state.relayCredsSet),
                        env: !!(state && state.relayEnv),
                      },
                      relayDraft,
                      credsDraft,
                      onRelayDraft: setRelayDraft,
                      onCredsDraft: setCredsDraft,
                      onRelaySave: async () => {
                        const body = { url: relayDraft }
                        if (String(credsDraft || '').trim()) body.credsPath = String(credsDraft).trim()
                        const result = await post('/relay/config', body)
                        say((result && result.ok) ? '中继已保存。' : ((result && (result.hint || result.error)) || '没保存成'))
                        setCredsDraft('')
                        refresh()
                      },
                      onRelayClear: async () => {
                        const result = await post('/relay/config', { url: relayDraft, credsPath: '' })
                        say((result && result.ok) ? '令牌路径已清除。' : ((result && (result.hint || result.error)) || '没清除'))
                        setCredsDraft('')
                        refresh()
                      },
                    }))
                  : face === 'log'
                    ? h('div', { className: 'dla-sheet' }, chatLogFace({ ledger: listOf(state && state.ledger) }))
                  : face === 'catalog'
                    ? h('div', { className: 'dla-sheet' }, chatCatalogFace({
                      workspace: traceWs,
                      kinds: catalog.kinds,
                      relations: catalog.relations,
                      catalogVersion: catalog.catalogVersion,
                      pick: catalogPick,
                      can: catalogCan,
                      version: catalogVer,
                      nod: catalogNod,
                      newKind: catalogNew,
                      onNewKind: setCatalogNew,
                      onPick: (row) => {
                        setCatalogPick(row && row.kind || '')
                        setCatalogCan(listOf(row && row.can))
                        setCatalogVer(String((row && row.catalogVersion) || ''))
                        setCatalogNod(false)
                      },
                      onCan: (name) => {
                        setCatalogCan((prev) => listOf(prev).indexOf(name) >= 0
                          ? listOf(prev).filter((item) => item !== name)
                          : listOf(prev).concat([name]))
                      },
                      onVersion: setCatalogVer,
                      onNod: setCatalogNod,
                      onCreate: async () => {
                        const kind = String(catalogNew || '').trim()
                        const result = await post('/catalog/publish', {
                          workspace: traceWs,
                          kind,
                          can: catalogCan,
                          catalogVersion: catalogVer,
                          confirm: true,
                        })
                        say((result && result.ok) ? ('已发布 ' + kind) : ((result && (result.hint || result.error)) || '没发布成'))
                        if (result && result.ok) {
                          setCatalogNew('')
                          setCatalogNod(false)
                          const got = await get('/catalog?workspace=' + encodeURIComponent(traceWs))
                          setCatalog({
                            kinds: listOf(got && got.kinds),
                            relations: listOf(got && got.relations),
                            catalogVersion: listOf(got && got.catalogVersion),
                          })
                        }
                      },
                      onPublish: async (row) => {
                        const result = await post('/catalog/publish', {
                          workspace: traceWs,
                          kind: row && row.kind,
                          can: catalogCan,
                          fields: listOf(row && row.fields),
                          clues: listOf(row && row.aliases).length ? [{ role: '型', say: listOf(row.aliases) }] : [],
                          relations: listOf(catalog.relations).filter((item) => item && (item.from === row.kind || item.to === row.kind)),
                          catalogVersion: catalogVer,
                          confirm: true,
                        })
                        say((result && result.ok) ? ('已发布 ' + (row && row.kind)) : ((result && (result.hint || result.error)) || '没发布成'))
                        if (result && result.ok) {
                          setCatalogNod(false)
                          const got = await get('/catalog?workspace=' + encodeURIComponent(traceWs))
                          setCatalog({
                            kinds: listOf(got && got.kinds),
                            relations: listOf(got && got.relations),
                            catalogVersion: listOf(got && got.catalogVersion),
                          })
                        }
                      },
                    }))
                  : h('div', { className: 'dla-sheet' }, chatSheetFace({
                    sheet, rows, many, pickField, fieldChoices, pickedField, setPickedField,
                    picked, pickRow, editing, drafts, setDrafts, hopNext, chosen, chosenField,
                    canWrite, continuePicked, backSheet, canBack: !!(sheet && sheet.canBack), fileAsk, runWrite, toast, startResize,
                    batch: !!(sheet && sheet.batch), batchNod,
                    cancelWrite: async () => {
                      await post('/write/cancel', {})
                      say('取消。不写库。')
                      setOpen(false)
                      refresh()
                    },
                  }))
              } catch (err) {
                return h('div', { className: 'dla-sheet' }, h('pre', { className: 'dla-sec-empty' }, String((err && err.stack) || err)))
              }
            })(),
            ),
            face === 'biz' ? h('button', { key: 'resize-l', type: 'button', className: 'dla-sec-resize is-left', title: '向左拉伸', onMouseDown: startResize('left') }) : null,
            face === 'biz' ? h('button', { key: 'resize-r', type: 'button', className: 'dla-sec-resize is-right', title: '向右拉伸', onMouseDown: startResize('right') }) : null,
            face === 'biz' ? h('button', { key: 'resize-se', type: 'button', className: 'dla-sec-resize is-se', title: '拖动调整大小', onMouseDown: startResize('se') }) : null,
          ),
        ) : null,
      )
    }

    function injectStyles() {
      const id = 'dsh-lan-assist-css'
      if (typeof document === 'undefined') return
      try {
      const old = document.getElementById(id)
      if (old) old.remove()
      const tag = document.createElement('style')
      tag.id = id
      tag.textContent = `
.dla-avatar{flex:none;width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:var(--dsw-alias-state-business-tertiary, #e4edfd);color:var(--dsw-alias-state-business-primary, #4176e6);font-weight:600;font-size:14px}
.dla-hint{font-size:12px;color:var(--dsw-alias-label-secondary, #61666b);margin-top:8px}
.dla-btn:focus-visible,.dla-choice-btn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary, #4176e6);outline-offset:2px}
.dla-pill{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:999px;font-size:12px;line-height:18px;background:var(--dsw-static-neutral-bluish-100, #ebeef2);color:var(--dsw-alias-label-secondary, #61666b);white-space:nowrap}
.dla-pill.ok{background:var(--dsw-alias-state-success-tertiary, #e6faed);color:#15803d}
.dla-pill.warn{background:var(--dsw-alias-state-warn-tertiary, #fef5e7);color:#c2410c}
.dla-pill.hold{background:var(--dsw-alias-state-business-tertiary, #dbeafe);color:var(--dsw-alias-state-business-primary, #2563eb)}
.dla-pill.bad{background:#fee2e2;color:#b91c1c}
.dla-pill.mute{background:#f3f4f6;color:#6b7280}
.dla-btn{display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 12px;border-radius:8px;font:500 13px inherit;cursor:pointer;white-space:nowrap;flex-shrink:0}
.dla-btn-ghost{border:1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1));background:var(--dsw-alias-button-elevated-fill, #fff);color:var(--dsw-alias-label-primary, #0f1115)}
.dla-btn-ghost:hover{background:var(--dsw-alias-button-floating-hover, #f1f3f5)}
.dla-btn-primary{border:none;background:var(--dsw-alias-button-primary-fill, #0f1115);color:var(--dsw-alias-label-primary-foreground, #fff)}
.dla-btn-primary:hover{background:var(--dsw-alias-button-primary-hover, #43454a)}
.dla-btn-primary:active,.dla-btn-ghost:active{transform:translateY(1px)}
.dla-btn-danger{border:1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1));background:transparent;color:var(--dsw-alias-state-error-primary, #ec1313)}
.dla-btn-danger:hover{background:var(--dsw-alias-interactive-bg-hover-danger, rgba(236,19,19,.05))}
.dla-btn:disabled{opacity:.45;cursor:default}
.dla-choice{display:flex;flex-wrap:wrap;gap:6px}
.dla-choice-btn{height:28px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1));border-radius:999px;background:var(--dsw-alias-bg-base, #fff);color:var(--dsw-alias-label-secondary, #61666b);font:500 12px inherit;cursor:pointer}
.dla-choice-btn.is-on{border-color:var(--dsw-alias-state-business-primary, #4176e6);background:var(--dsw-alias-state-business-tertiary, #e4edfd);color:var(--dsw-alias-state-business-primary, #4176e6)}
.dla-dock-meta{display:flex;flex-wrap:wrap;gap:6px}
.dla-inline-toast{position:absolute;left:50%;right:auto;bottom:24px;transform:translateX(-50%);z-index:8;width:max-content;max-width:min(360px, calc(100% - 32px));font-size:13px;font-weight:500;line-height:18px;text-align:center;color:var(--dsw-alias-label-primary, #0f1115);margin:0;padding:8px 14px;border-radius:10px;background:var(--dsw-alias-bg-base, #fff);box-shadow:0 8px 28px rgba(15,17,21,.12),0 0 0 1px rgba(15,17,21,.06);pointer-events:none}
.dla-dock{box-sizing:border-box;flex:none;overflow:visible;margin:0 auto;width:calc(100% - 48px);max-width:748px;border:1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.04));border-radius:12px;background:var(--dsw-specific-tip, #f5f6f7);color:var(--dsw-alias-label-primary, #0f1115)}
.dla-dock.is-collapsed{height:36px;overflow:hidden}
.dla-dock-body{display:flex;flex-direction:column;gap:8px;padding:8px 12px 10px;min-height:0}
.dla-dock-speak-head{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.dla-dock-sec-label{font-size:11px;line-height:16px;font-weight:500;color:var(--dsw-alias-label-tertiary, #81858c);letter-spacing:.02em}
.dla-dock-sign{margin:0;font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-secondary, #61666b)}
.dla-dock-speak{margin:0;font-size:15px;line-height:24px;font-weight:500;color:var(--dsw-alias-label-primary, #0f1115);white-space:pre-wrap}
.dla-dock-speak.is-rows{display:flex;flex-direction:column;gap:6px}
.dla-dock-row{margin:0;font-size:15px;line-height:24px;font-weight:500;color:var(--dsw-alias-label-primary, #0f1115)}
.dla-dock-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding-top:2px}
.dla-dock-actions.is-primary{padding-top:6px}
.dla-dock-actions.is-secondary{padding-top:0}
.dla-dock-toggle{display:inline-flex;align-items:center;justify-content:center;flex:none;height:24px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1));border-radius:6px;background:var(--dsw-alias-button-elevated-fill, #fff);color:inherit;font:500 12px/18px inherit;cursor:pointer;margin-left:auto;white-space:nowrap}
.dla-dock-bar{display:flex;align-items:center;gap:8px;box-sizing:border-box;width:100%;height:34px;padding:0 12px;border:none;background:transparent;font:inherit;color:inherit;cursor:pointer;text-align:left}
.dla-dock-bar-copy{flex:1 1 auto;min-width:0;font-size:13px;line-height:20px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dla-overlay{position:fixed;top:56px;right:24px;z-index:80;display:flex;flex-direction:column;align-items:flex-end;pointer-events:auto}
.dla-badge{position:relative;z-index:34;pointer-events:auto;display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:none;border-radius:999px;background:var(--dsw-alias-toast-bg, #353436);color:#fff;font:500 12px inherit;box-shadow:0 4px 12px 0 rgba(0,0,0,.02),0 2px 8px 0 rgba(0,0,0,.04);cursor:pointer}
.dla-badge b{min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--dsw-alias-button-info-fill, #4176e6);color:#fff;display:inline-grid;place-items:center;font-size:11px;font-weight:600}
.dla-sec-backdrop{position:fixed;inset:0;z-index:33;background:rgba(15,17,21,.06)}
.dla-sec-panel{position:absolute;top:92px;right:24px;width:360px;max-height:70vh;overflow:auto;background:var(--dsw-alias-bg-base, #fff);border:1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1));border-radius:12px;box-shadow:0 8px 28px rgba(15,17,21,.12);padding:0}
.dla-sec-panel.is-sheet{top:56px;width:min(720px, calc(100vw - 48px));height:min(560px, calc(100vh - 72px));max-height:none;display:flex;flex-direction:row;overflow:hidden;resize:none;border-radius:16px;box-shadow:0 16px 48px rgba(37,99,235,.12),0 8px 24px rgba(15,17,21,.08);border-color:rgba(37,99,235,.16)}
.dla-sec-panel.is-sheet .dla-sheet{flex:1;min-height:0;overflow:auto}
.dla-sec-panel.is-sheet .dla-sec-panel-head{background:#f8fafc;border-bottom:none;border-right:1px solid var(--dsw-alias-border-l1, rgba(15,17,21,.08));width:132px;flex-shrink:0;flex-direction:column;align-items:stretch;padding:12px 10px}
.dla-sec-panel.is-sheet.is-shell{flex-direction:column}
.dla-sec-panel.is-sheet.is-shell .dla-sec-panel-head.is-bar{width:auto;flex-direction:row;align-items:center;border-right:none;border-bottom:1px solid var(--dsw-alias-border-l1, rgba(15,17,21,.08));padding:8px 12px}
.dla-sec-panel.is-sheet.is-shell .dla-sec-panel-head.is-bar .dla-btn{margin-top:0;margin-left:auto}
.dla-sec-main{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:auto}
.dla-sec-panel.is-sheet .dla-sec-face.on{background:#e8eef4;color:#0f1115}
.dla-sec-resize{position:absolute;padding:0;border:none;background:transparent}
.dla-sec-resize.is-left{left:0;top:28px;bottom:18px;width:8px;cursor:ew-resize}
.dla-sec-resize.is-right{right:0;top:28px;bottom:18px;width:8px;cursor:ew-resize}
.dla-sec-resize.is-se{right:2px;bottom:2px;width:14px;height:14px;cursor:nwse-resize}
.dla-sec-resize.is-se:before{content:'';display:block;width:10px;height:10px;border-right:2px solid var(--dsw-alias-border-l2, rgba(0,0,0,.28));border-bottom:2px solid var(--dsw-alias-border-l2, rgba(0,0,0,.28))}
.dla-sheet-cell{width:100%;min-width:72px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1));border-radius:6px;padding:4px 6px;font:inherit;background:var(--dsw-alias-bg-base, #fff)}
.dla-sec-panel-head{display:flex;align-items:center;gap:8px;padding:10px 12px;margin:0;border-bottom:1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.04))}
.dla-sec-faces{display:flex;flex-direction:column;gap:2px;min-width:0;width:100%}
.dla-sec-face{min-height:40px;height:auto;width:100%;padding:8px 10px;border:none;border-radius:10px;background:transparent;color:var(--dsw-alias-label-secondary, #61666b);font:500 13px inherit;cursor:pointer;text-align:left;display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.dla-sec-face-t{line-height:18px}
.dla-sec-face-h{font-size:11px;font-weight:400;line-height:14px;color:var(--dsw-alias-label-caption, #8b9198)}
.dla-sec-face.on{background:#e8eef4;color:var(--dsw-alias-label-primary, #0f1115)}
.dla-sec-face.on .dla-sec-face-h{color:#5c6570}
.dla-inbox{display:flex;min-height:280px;max-height:100%}
.dla-inbox-list{width:42%;min-width:160px;overflow:auto;border-right:1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.06))}
.dla-inbox-item{display:flex;flex-direction:column;align-items:flex-start;gap:4px;width:100%;padding:10px 12px;border:none;background:transparent;text-align:left;cursor:pointer;font:inherit}
.dla-inbox-item.is-on,.dla-inbox-item:hover{background:var(--dsw-static-neutral-bluish-60, #f5f6f7)}
.dla-inbox-item-speak{font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary, #0f1115);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dla-inbox-pane{flex:1;min-width:0;padding:14px 16px;overflow:auto}
.dla-cmd{padding:8px 12px 12px;border-bottom:1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.04));display:flex;flex-direction:column;gap:6px}
.dla-cmd-input{height:32px;border:1px solid var(--dsw-alias-border-l1, #e5e7eb);border-radius:8px;padding:0 10px;font:13px inherit}
.dla-cmd-row{height:28px;border:none;border-radius:8px;background:transparent;text-align:left;padding:0 10px;font:13px inherit;cursor:pointer}
.dla-cmd-row.is-on,.dla-cmd-row:hover{background:var(--dsw-static-neutral-bluish-60, #f5f6f7)}
.dla-sec-panel-head .dla-btn{margin-left:0;margin-top:auto;height:24px;padding:0 8px;font-size:12px}
.dla-sheet{position:relative;display:flex;flex-direction:column;gap:12px;padding:14px 16px 18px;background:linear-gradient(180deg,#f8fafc 0%,#fff 48px)}
.dla-sheet-kicker{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary, #61666b)}
.dla-sheet-banner{margin:0;padding:8px 12px;border-radius:10px;font-size:12px;line-height:18px;font-weight:500}
.dla-sheet-banner.is-look{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
.dla-sheet-banner.is-write{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa}
.dla-sheet-banner.is-pass{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}
.dla-sheet-title{margin:0;display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:16px;font-weight:650;letter-spacing:-.02em;line-height:24px;color:var(--dsw-alias-label-primary, #0f1115)}
.dla-sheet-kind{font-weight:700}
.dla-sheet-action{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:650;letter-spacing:.02em}
.dla-sheet-action.is-look{background:#dbeafe;color:#1d4ed8}
.dla-sheet-action.is-write{background:#ffedd5;color:#c2410c}
.dla-sheet-action.is-pass{background:#d1fae5;color:#047857}
.dla-sheet-no{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;background:#f1f5f9;color:#0f172a;font:600 12px/22px ui-monospace,SFMono-Regular,Menlo,monospace}
.dla-sheet-block{border:1px solid rgba(37,99,235,.14);border-radius:14px;overflow:hidden;background:var(--dsw-alias-bg-base, #fff);flex:1;min-height:0;display:flex;flex-direction:column;box-shadow:0 1px 0 rgba(37,99,235,.06)}
.dla-sheet-confirm{padding:4px 2px 0;display:flex;flex-direction:column;gap:8px}
.dla-sheet-scroll{overflow:auto;flex:1;min-height:180px}
.dla-sheet-table{width:100%;border-collapse:separate;border-spacing:0;font-size:13px}
.dla-sheet-table th{text-align:left;font-weight:650;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#3b82f6;padding:10px 12px;border-bottom:1px solid #dbeafe;background:#eff6ff;white-space:nowrap}
.dla-sheet-table th.dla-sheet-num,.dla-sheet-table td.dla-sheet-num{width:36px;text-align:right;color:var(--dsw-alias-label-caption, #adb2b8);font-variant-numeric:tabular-nums}
.dla-sheet-table th.dla-sheet-pick,.dla-sheet-table td.dla-sheet-pick{width:32px}
.dla-sheet-table td{padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle;color:var(--dsw-alias-label-primary, #0f1115)}
.dla-sheet-table td.dla-sheet-st{white-space:nowrap}
.dla-sheet-table tr:last-child td{border-bottom:none}
.dla-sheet-table tbody tr:nth-child(even){background:#f8fafc}
.dla-sheet-table tbody tr{cursor:pointer}
.dla-sheet-table tbody tr:hover{background:#f4f7fb}
.dla-sheet-table tbody tr.is-on,.dla-sheet-table tbody tr.is-on:hover{background:#e8eef6}
.dla-sheet-table tbody tr.is-on td{box-shadow:none}
.dla-sheet-table tbody tr.is-on td.dla-sheet-num{color:#475569;font-weight:650}
.dla-sheet-meta{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.dla-sheet-fields{width:100%;border-collapse:collapse;font-size:13px}
.dla-sheet-fields th{text-align:left;font-size:12px;color:var(--dsw-alias-label-caption, #adb2b8);font-weight:560;padding:6px 8px;background:var(--dsw-specific-tip, #f5f6f7);border-bottom:1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.04))}
.dla-sheet-fields td{padding:8px;border-bottom:1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.04))}
.dla-sheet-fields input{width:100%;border:1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1));border-radius:8px;padding:6px 8px;font:inherit;box-sizing:border-box}
.dla-sheet-foot{display:flex;justify-content:flex-end;gap:8px;padding-top:4px}
.dla-sec-whisper{display:flex;flex-direction:column;padding:4px 0 8px}
.dla-sec-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:10px 14px;margin:0 8px 8px;border-radius:12px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary, #0f1115);cursor:pointer;background:#f8fafc;border:1px solid #e2e8f0}
.dla-sec-row:hover{background:#eff6ff;border-color:#bfdbfe}
.dla-sec-row-speak{flex:1;min-width:0}
.dla-sec-nudge{height:22px;padding:0 8px;font-size:12px}
.dla-sec-empty{padding:28px 20px;font-size:14px;line-height:22px;color:var(--dsw-alias-label-secondary, #61666b);max-width:36ch}
.dla-ask-wrap{position:relative;display:inline-flex;align-items:center}
.dla-ask-btn{display:inline-flex;align-items:center;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1));border-radius:8px;background:var(--dsw-alias-button-elevated-fill, #fff);color:var(--dsw-alias-label-primary, #0f1115);font:500 12px inherit;cursor:pointer;white-space:nowrap}
.dla-ask-btn:hover{background:var(--dsw-alias-button-floating-hover, #f1f3f5)}
.dla-ask-unread{display:inline-block;min-width:16px;height:16px;margin-left:6px;padding:0 4px;border-radius:8px;background:var(--dsw-static-red-600, #e24c4c);color:#fff;font-size:10px;line-height:16px;text-align:center}
.dla-chat-pop{position:fixed;left:48px;bottom:auto;z-index:40;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(15,17,21,.08);border-radius:16px;background:var(--dsw-static-neutral-bluish-00, #fff);box-shadow:0 28px 80px rgba(15,17,21,.16),0 2px 8px rgba(15,17,21,.06);min-width:360px;min-height:280px}
.dla-chat-win{display:grid;grid-template-columns:228px minmax(0,1fr);min-height:0;flex:1}
.dla-chat-win.is-rail{grid-template-columns:228px minmax(0,1fr) 260px}
.dla-chat-win.is-setup{grid-template-columns:minmax(0,1fr)}
.dla-chat-rail{border-left:1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.06));padding:14px 14px 16px;display:flex;flex-direction:column;gap:10px;min-width:0;overflow:auto;background:var(--dsw-alias-bg-base,#fff)}
.dla-chat-win.is-setup .dla-chat-people,.dla-chat-win.is-setup .dla-chat-rail{display:none}
.dla-chat-pop.skin-mist{background:#eef2f6;border-color:#c5ced8}
.dla-chat-pop.skin-mist .dla-chat-people{background:#e4eaef}
.dla-chat-pop.skin-mist .dla-chat-thread{background:#e8edf2}
.dla-chat-pop.skin-mist .dla-chat-b.them{background:#f7f9fb}
.dla-chat-pop.skin-ink{background:#2c2c2e;color:#f5f5f7;border-color:#3a3a3c}
.dla-chat-pop.skin-ink .dla-chat-people{background:#1c1c1e;color:#f5f5f7}
.dla-chat-pop.skin-ink .dla-chat-p,.dla-chat-pop.skin-ink .dla-chat-people-h,.dla-chat-pop.skin-ink .dla-chat-head{color:#f5f5f7}
.dla-chat-pop.skin-ink .dla-chat-last,.dla-chat-pop.skin-ink .dla-chat-head .sub{color:#a1a1a6}
.dla-chat-pop.skin-ink .dla-chat-p.on{background:#3a3f4b}
.dla-chat-pop.skin-ink .dla-chat-thread{background:#232326}
.dla-chat-pop.skin-ink .dla-chat-b.them{background:#3a3a3c;color:#f5f5f7}
.dla-chat-pop.skin-ink .dla-chat-b.me{background:#3d4f73;color:#f5f5f7}
.dla-chat-pop.skin-ink .dla-chat-box,.dla-chat-pop.skin-ink .dla-chat-people-q{background:#1c1c1e;color:#f5f5f7;border-color:#4a4a4c}
.dla-chat-pop.skin-ink .dla-chat-tools,.dla-chat-pop.skin-ink .dla-chat-head,.dla-chat-pop.skin-ink .dla-chat-people,.dla-chat-pop.skin-ink .dla-chat-sendrow,.dla-chat-pop.skin-ink .dla-chat-pane,.dla-chat-pop.skin-ink .dla-chat-compose{border-color:#3a3a3c;background:#1c1c1e}
.dla-chat-pop.skin-ink .dla-chat-box{background:#232326;color:#f5f5f7}
.dla-chat-pop.skin-ink .dla-chat-sendrow .dla-hint,.dla-chat-pop.skin-ink .dla-hint{color:#a1a1a6}
.dla-chat-pop.skin-ink .dla-inline-toast{background:#3a3f4b;color:#f5f5f7;box-shadow:0 8px 28px rgba(0,0,0,.35),0 0 0 1px rgba(255,255,255,.06)}
.dla-chat-pop.skin-ink .dla-chat-cfg{color:#d1d1d6}
.dla-chat-pop.skin-ink .dla-chat-cfg.on,.dla-chat-pop.skin-ink .dla-chat-p.on{background:#3a3f4b;color:#f5f5f7}
.dla-chat-pop.skin-ink .dla-chat-cue{color:#a1a1a6}
.dla-chat-pop.skin-ink .dla-chat-dock-line,.dla-chat-pop.skin-ink .dla-chat-sum{background:#3a3f4b;border-color:#4a4a4c;color:#f5f5f7}
.dla-chat-pop.skin-ink .dla-chat-topic{background:#3a3a3c;color:#f5f5f7}
.dla-chat-pop.skin-ink .dla-chat-modal-card{background:#2c2c2e;color:#f5f5f7}
.dla-chat-pop.skin-ink .dla-chat-field input{background:#232326;color:#f5f5f7}
.dla-chat-pop.skin-sand{background:#f7f1e8;border-color:#d9cbb8}
.dla-chat-pop.skin-sand .dla-chat-people{background:#efe6d8}
.dla-chat-pop.skin-sand .dla-chat-thread{background:#f3ece1}
.dla-chat-pop.skin-sand .dla-chat-b.them{background:#fffaf2}
.dla-chat-pop.skin-sand .dla-chat-b.me{background:#e7d7be}
.dla-chat-skins{display:flex;gap:6px;align-items:center;margin-right:8px}
.dla-chat-skin{width:16px;height:16px;border-radius:50%;border:1px solid rgba(15,17,21,.18);cursor:pointer;padding:0}
.dla-chat-skin.on{outline:2px solid var(--dsw-static-deepseek-500,#4176e6);outline-offset:1px}
.dla-chat-skin[data-skin="paper"]{background:#fff}
.dla-chat-skin[data-skin="mist"]{background:#e8eef4}
.dla-chat-skin[data-skin="ink"]{background:#2c2c2e}
.dla-chat-skin[data-skin="sand"]{background:#f4efe6}
.dla-chat-grip{position:absolute;z-index:4;background:transparent}
.dla-chat-grip.n{top:0;left:10px;right:10px;height:6px;cursor:ns-resize}
.dla-chat-grip.s{bottom:0;left:10px;right:10px;height:6px;cursor:ns-resize}
.dla-chat-grip.e{top:10px;right:0;bottom:10px;width:6px;cursor:ew-resize}
.dla-chat-grip.w{top:10px;left:0;bottom:10px;width:6px;cursor:ew-resize}
.dla-chat-grip.ne{top:0;right:0;width:12px;height:12px;cursor:nesw-resize}
.dla-chat-grip.nw{top:0;left:0;width:12px;height:12px;cursor:nwse-resize}
.dla-chat-grip.se{bottom:0;right:0;width:14px;height:14px;cursor:nwse-resize}
.dla-chat-grip.sw{bottom:0;left:0;width:12px;height:12px;cursor:nesw-resize}
.dla-chat-grip.se:after{content:"";position:absolute;right:3px;bottom:3px;width:8px;height:8px;border-right:2px solid var(--dsw-alias-label-caption,#adb2b8);border-bottom:2px solid var(--dsw-alias-label-caption,#adb2b8)}
.dla-chat-people{width:228px;flex:none;border-right:1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.06));background:var(--dsw-specific-sidebar-fill, #f6f7f9);display:flex;flex-direction:column;padding:0;min-width:0;min-height:0;overflow:hidden;position:relative}
.dla-chat-people-list{flex:1;min-height:0;overflow:auto}
.dla-chat-people-h{padding:12px 16px 2px;font-size:11px;font-weight:650;letter-spacing:.02em;color:var(--dsw-alias-label-tertiary, #81858c)}
.dla-chat-people-qwrap{position:relative;margin:6px 12px 8px}
.dla-chat-people-q{height:32px;padding:0 28px 0 10px;border:0;border-radius:10px;background:var(--dsw-alias-bg-base, #fff);outline:none;width:100%;font:inherit;box-sizing:border-box}
.dla-chat-people-qx{position:absolute;right:6px;top:4px;width:24px;height:24px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-caption,#adb2b8);cursor:pointer;font-size:16px;line-height:24px}
.dla-chat-p{display:flex;align-items:center;gap:10px;width:calc(100% - 16px);margin:1px 8px;border:0;background:transparent;padding:8px 12px;border-radius:10px;cursor:pointer;text-align:left;color:inherit;font:inherit;position:relative}
.dla-chat-p:hover{background:var(--dsw-alias-interactive-bg-hover, rgba(38,49,72,.06))}
.dla-chat-p.on{background:var(--dsw-alias-state-business-tertiary, #edf3fe)}
.dla-chat-av{width:32px;height:32px;border-radius:10px;background:#5b6b82;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:650;flex:none}
.dla-chat-av.pin{background:#8a9099}
.dla-chat-av.grp{background:#5b6b82}
.dla-chat-nm{font-size:13px;font-weight:600;line-height:18px}
.dla-chat-last{display:block;font-size:12px;color:var(--dsw-alias-label-caption, #adb2b8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:148px;line-height:16px}
.dla-chat-dot{width:8px;height:8px;border-radius:50%;background:var(--dsw-static-red-600,#e24c4c);flex:none;margin-left:auto}
.dla-chat-dot.unread{background:var(--dsw-static-red-600,#e24c4c)}
.dla-chat-dot.off{display:none}
.dla-chat-unread{min-width:16px;height:16px;margin-left:auto;padding:0 4px;border-radius:8px;background:var(--dsw-static-red-600,#e24c4c);color:#fff;font-size:10px;line-height:16px;text-align:center;flex:none}
.dla-chat-cue{margin:8px 16px 0;padding:0;border:0;background:transparent;font-size:12px;line-height:18px;color:var(--dsw-alias-label-caption,#adb2b8)}
.dla-chat-more{margin-left:4px;flex:none;width:22px;height:22px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-caption, #adb2b8);cursor:pointer;font-size:14px}
.dla-chat-more:hover{background:var(--dsw-alias-interactive-bg-hover, rgba(38,49,72,.06));color:var(--dsw-alias-label-primary, #0f1115)}
.dla-chat-pane{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;background:#fbfcfd;position:relative}
.dla-chat-head{height:52px;padding:0 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.06));font-size:15px;font-weight:650;cursor:move;user-select:none;background:var(--dsw-alias-bg-base, #fff)}
.dla-chat-head-title{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dla-chat-head-actions{display:flex;align-items:center;gap:8px;margin-left:auto;flex:none}
.dla-chat-head .sub{font-size:12px;font-weight:400;color:var(--dsw-alias-label-caption, #adb2b8);margin-left:8px}
.dla-chat-dock{margin:8px 12px 0;padding:8px 12px;border-radius:10px;background:var(--dsw-static-deepseek-50, #edf3fe);font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:8px}
.dla-chat-dock-line{margin:10px 16px 0;padding:8px 12px;border-radius:10px;background:var(--dsw-static-deepseek-50,#edf3fe);font-size:12px;display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.dla-chat-dock-speak{min-width:0;flex:1;line-height:18px}
.dla-chat-dock-acts{display:flex;gap:6px;flex:none;padding-top:1px}
.dla-chat-setup{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;background:#f6f7f9}
.dla-chat-setup-inner{flex:1;min-height:0;overflow:auto;width:100%;max-width:560px;margin:0 auto;padding:20px 28px 16px;display:flex;flex-direction:column;gap:12px}
.dla-chat-setup-card{background:#fff;border-radius:14px;padding:18px 20px 16px;box-shadow:0 1px 0 rgba(15,17,21,.04)}
.dla-chat-setup-card h3{margin:0 0 2px;font-size:15px;font-weight:650}
.dla-chat-setup-card .dla-hint{margin:0 0 14px}
.dla-chat-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.dla-chat-field{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
.dla-chat-field span{font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary,#61666b)}
.dla-chat-field input{height:38px;padding:0 12px;border-radius:10px;border:1px solid transparent;background:var(--dsw-specific-tip,#f5f6f7);font-size:14px;outline:none}
.dla-chat-field input:focus{background:#fff;border-color:var(--dsw-static-deepseek-400,#4176e6);box-shadow:0 0 0 3px rgba(65,118,230,.12)}
.dla-chat-switch-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;font-size:14px;padding:2px 0}
.dla-chat-switch-row + .dla-chat-switch-row{border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06))}
.dla-chat-switch{position:relative;display:inline-flex;align-items:center}
.dla-chat-switch input{position:absolute;opacity:0;width:0;height:0}
.dla-chat-tog{width:40px;height:24px;border-radius:999px;background:#d5d8de;position:relative;transition:background .15s}
.dla-chat-tog:after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(15,17,21,.2);transition:transform .15s}
.dla-chat-switch input:checked + .dla-chat-tog{background:var(--dsw-static-deepseek-500,#4176e6)}
.dla-chat-switch input:checked + .dla-chat-tog:after{transform:translateX(16px)}
.dla-chat-pair-row{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin:8px 0 10px}
.dla-chat-pair-digits{font-family:ui-monospace,Menlo,monospace;font-size:32px;font-weight:600;letter-spacing:.18em;line-height:40px}
.dla-chat-pair-empty{font-size:14px;color:var(--dsw-alias-label-caption,#adb2b8);line-height:40px}
.dla-chat-key{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-caption,#adb2b8);margin:0 0 10px}
.dla-chat-setup-foot{flex:none;display:flex;justify-content:flex-end;gap:8px;padding:10px 20px 12px;border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06));background:var(--dsw-alias-bg-base,#fff)}
.dla-chat-topic{width:100%;text-align:left;border:0;cursor:pointer;background:#fff;border-radius:12px;padding:10px 12px;box-shadow:0 1px 0 rgba(15,17,21,.04)}
.dla-chat-topic .who{display:block;font-size:12px;color:var(--dsw-alias-label-caption,#adb2b8)}
.dla-chat-topic .tx{display:block;font-size:14px;line-height:22px;margin:4px 0}
.dla-chat-topic .meta{display:block;font-size:12px;color:var(--dsw-static-deepseek-500,#4176e6)}
.dla-chat-modal{position:fixed;inset:0;z-index:80;background:rgba(15,17,21,.35);display:flex;align-items:center;justify-content:center;padding:24px}
.dla-chat-modal-card{width:min(420px,92%);max-height:min(86vh,640px);overflow:auto;background:#fff;border-radius:14px;padding:18px 20px 16px;box-shadow:0 24px 64px rgba(15,17,21,.2)}
.dla-chat-modal-card h3{margin:0 0 8px;font-size:16px}
.dla-chat-pick{display:flex;flex-direction:column;gap:8px;margin:12px 0 16px;font-size:14px;max-height:220px;overflow:auto}
.dla-chat-pick label{display:flex;align-items:center;gap:8px}
.dla-chat-card-meta{font-size:12px;color:var(--dsw-alias-label-caption,#adb2b8);line-height:18px;margin:0 0 12px}
.dla-chat-card-meta b{color:var(--dsw-alias-label-secondary,#61666b);font-weight:550}
.dla-chat-modal-foot{display:flex;justify-content:flex-end;gap:8px}
.dla-chat-modal-foot.is-split{justify-content:space-between}
.dla-chat-stage{flex:1;min-height:0;position:relative;display:flex;flex-direction:column}
 .dla-chat-thread{flex:1;min-height:0;overflow:auto;padding:18px 20px 16px;display:flex;flex-direction:column;gap:10px}
.dla-chat-empty{margin:auto;max-width:280px;text-align:center;font-size:13px;line-height:20px;color:var(--dsw-alias-label-caption,#adb2b8)}
.dla-chat-b{max-width:72%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:22px;white-space:pre-wrap}
.dla-chat-b.them{align-self:flex-start;background:#fff;box-shadow:0 1px 0 rgba(15,17,21,.04)}
.dla-chat-b.me{align-self:flex-end;background:var(--dsw-specific-bubble, #dbe7ff)}
.dla-chat-b.ai{align-self:stretch;max-width:100%;background:var(--dsw-alias-state-business-tertiary,#edf3fe);border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1))}
.dla-chat-b .tag{display:block;font-size:11px;color:var(--dsw-static-deepseek-500,#4176e6);font-weight:650;margin-bottom:2px}
.dla-chat-b.fail{border:1px solid var(--dsw-alias-state-error-primary,#ec1313)}
.dla-chat-fail{display:block;margin-top:4px;font-size:11px;color:var(--dsw-alias-state-error-primary,#ec1313)}
.dla-chat-fail .dla-btn{height:24px;padding:0 8px;margin-left:6px;font-size:11px}
.dla-chat-b.sys,.dla-chat-b.gone{align-self:center;max-width:none;background:transparent;box-shadow:none;padding:2px 0;font-size:12px;color:var(--dsw-alias-label-caption, #adb2b8);font-style:italic}
.dla-chat-b.gone .when{display:none}
.dla-chat-p.pin{background:transparent}
.dla-chat-b .when{display:block;font-size:10px;color:var(--dsw-alias-label-caption, #adb2b8);margin-top:2px}
.dla-chat-b .who{display:block;font-size:11px;font-weight:650;color:var(--dsw-alias-label-secondary, #61666b);margin-bottom:2px}
.dla-chat-b.me .dla-chat-un{display:inline-block;margin-top:6px;font-size:11px;color:var(--dsw-alias-label-secondary,#61666b);background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06));border:0;padding:2px 8px;border-radius:6px;cursor:pointer}
.dla-chat-b.me .dla-chat-un:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.1));color:var(--dsw-alias-label-primary,#0f1115)}
.dla-chat-b.local{opacity:.92}
.dla-chat-latest{position:absolute;right:18px;bottom:12px;z-index:6;height:28px;padding:0 12px;border:0;border-radius:999px;background:var(--dsw-static-deepseek-500,#4176e6);color:#fff;font:550 12px inherit;cursor:pointer;box-shadow:0 8px 20px rgba(65,118,230,.28)}
.dla-chat-compose{flex:none;margin:0 12px 12px;padding:4px 0 8px;border:1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.06));border-radius:16px;background:var(--dsw-alias-bg-base, #fff);overflow:visible;position:relative;z-index:8}
.dla-chat-tools-wrap{position:relative;z-index:12;flex:none;overflow:visible;background:transparent}
.dla-chat-tools{display:flex;flex-wrap:nowrap;align-items:center;gap:8px;padding:4px 10px 0;border-top:0;background:transparent;flex:none;overflow-x:auto}
.dla-chat-tools::-webkit-scrollbar{height:4px}
.dla-chat-tools::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2,rgba(0,0,0,.12));border-radius:4px}
.dla-chat-toolg{display:inline-flex;gap:2px;flex:none}
.dla-chat-toolg + .dla-chat-toolg{padding-left:8px;border-left:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08))}
.dla-chat-ico{width:34px;height:34px;padding:0;display:inline-grid;place-items:center;border:0;background:transparent;border-radius:10px;color:var(--dsw-alias-label-secondary, #61666b);cursor:pointer}
.dla-chat-ico.has-lab{width:auto;min-width:34px;height:34px;padding:0 8px;grid-auto-flow:column;gap:4px}
.dla-chat-ico-lab{font-size:11px;line-height:1;font-weight:550;color:inherit}
.dla-chat-ico svg{display:block}
.dla-chat-ico:hover{background:var(--dsw-alias-interactive-bg-hover, rgba(38,49,72,.06))}
.dla-chat-ico:disabled{opacity:.35;cursor:default}
.dla-chat-ico.on{background:var(--dsw-alias-state-business-tertiary,#edf3fe)}
.dla-chat-pair-ask{position:absolute;left:12px;right:12px;top:12px;z-index:6;display:flex;gap:8px;align-items:center;padding:10px 12px;border-radius:10px;background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));box-shadow:0 8px 24px rgba(15,17,21,.16);font-size:13px}
.dla-chat-pair-ask.wait{background:var(--dsw-alias-state-business-tertiary,#edf3fe)}
.dla-chat-pair-ask-tx{flex:1;min-width:0;line-height:18px}
.dla-chat-scrim{position:fixed;inset:0;z-index:38;background:rgba(15,17,21,.28)}
.dla-chat-scrim.skin-mist{background:rgba(70,88,108,.22)}
.dla-chat-scrim.skin-ink{background:rgba(8,8,10,.48)}
.dla-chat-scrim.skin-sand{background:rgba(72,52,28,.22)}
.dla-chat-tr{display:block;margin-top:6px;padding-top:6px;border-top:1px dashed rgba(15,17,21,.12);font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,#61666b)}
.dla-chat-tr b{font-size:11px;font-weight:650;color:var(--dsw-alias-label-caption,#adb2b8);margin-right:6px}
.dla-chat-sum{margin:0 12px 8px;padding:8px 10px;border-radius:8px;background:var(--dsw-alias-state-business-tertiary,#edf3fe);border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));font-size:12px;line-height:18px;display:flex;align-items:flex-start;gap:8px}
.dla-chat-sum span{flex:1;min-width:0}
.dla-chat-sum-x{flex:none;width:22px;height:22px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-caption,#adb2b8);cursor:pointer;font-size:16px;line-height:22px}
.dla-chat-slip-acts{display:flex;gap:6px;margin-top:8px}
.dla-chat-b.jump{outline:2px solid var(--dsw-static-deepseek-400,#4176e6)}
.dla-chat-hist{flex:1;min-height:0;overflow:auto;padding:10px 12px 8px;display:flex;flex-direction:column;gap:8px;background:var(--dsw-specific-sidebar-fill,#f6f7f9)}
.dla-chat-hist-bar{display:flex;gap:6px;align-items:center}
.dla-chat-hist-qwrap{position:relative;flex:1;min-width:0}
.dla-chat-hist-q{width:100%;height:30px;padding:0 28px 0 8px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));border-radius:8px;background:var(--dsw-alias-bg-base,#fff);outline:none;box-sizing:border-box}
.dla-chat-hist-day{font-size:11px;color:var(--dsw-alias-label-caption,#adb2b8);padding:4px 2px 0}
.dla-chat-hist-row{width:100%;text-align:left;cursor:pointer;background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06));border-radius:8px;padding:7px 8px;color:var(--dsw-alias-label-primary,#0f1115)}
.dla-chat-hist-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06))}
.dla-chat-hist-row .who{font-size:11px;color:var(--dsw-alias-label-caption,#adb2b8)}
.dla-chat-hist-row .tx{font-size:13px;line-height:18px;margin-top:2px}
.dla-chat-ctx{position:fixed;z-index:50;min-width:148px;background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));border-radius:10px;padding:4px;box-shadow:0 8px 24px rgba(15,23,42,.12)}
.dla-chat-ctx button{display:block;width:100%;text-align:left;border:0;background:transparent;cursor:pointer;padding:7px 10px;border-radius:8px;font-size:13px;color:var(--dsw-alias-label-primary,#0f1115)}
.dla-chat-ctx button:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06))}
.dla-chat-adopt-sec{margin:0 0 14px}
.dla-chat-adopt-sec h4{margin:0 0 8px;font-size:13px;font-weight:650}
.dla-chat-box-wrap{position:relative;margin:2px 10px 4px;flex:none}
.dla-chat-box-grip{position:absolute;top:-7px;left:12%;right:12%;height:14px;cursor:ns-resize;z-index:2}
.dla-chat-box-grip:before{content:"";display:block;width:36px;height:4px;margin:5px auto 0;border-radius:2px;background:var(--dsw-alias-label-tertiary,#81858c)}
.dla-chat-box-grip:hover:before{background:var(--dsw-static-deepseek-500,#4176e6)}
.dla-chat-box{display:block;width:100%;height:72px;min-height:72px;max-height:72px;resize:none;border:0;border-radius:10px;padding:8px 10px;background:transparent;outline:none;font-size:14px;line-height:22px;box-sizing:border-box;font:inherit}
.dla-chat-sendrow{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 10px 8px;background:transparent;flex:none}
.dla-chat-sendrow.is-local{padding:10px 16px 14px}
.dla-chat-sendrow .dla-hint{color:var(--dsw-alias-label-caption, #adb2b8);font-size:11px}
.dla-chat-sendrow .dla-btn-primary{height:32px;padding:0 16px;border-radius:999px;background:var(--dsw-static-deepseek-500,#4176e6);color:#fff}
.dla-chat-sendrow .dla-btn-primary:hover{background:#3467d4}
.dla-chat-sendrow .dla-btn-primary:disabled{background:var(--dsw-static-neutral-bluish-100,#ebeef2);color:var(--dsw-alias-label-caption,#adb2b8)}
.dla-chat-emo{position:absolute;left:14px;bottom:calc(100% + 6px);top:auto;z-index:12;width:288px;max-height:240px;overflow:auto;padding:8px;background:#fff;border-radius:12px;box-shadow:0 12px 32px rgba(15,17,21,.16);display:grid;grid-template-columns:repeat(8,1fr);gap:2px}
.dla-chat-emo button{height:32px;border:0;background:transparent;cursor:pointer;font-size:18px;border-radius:8px}
.dla-chat-emo button:hover{background:var(--dsw-alias-interactive-bg-hover, rgba(38,49,72,.06))}
.dla-chat-b.emo{font-size:28px;line-height:36px;padding:8px 12px}
.dla-chat-cfg{margin:10px 12px 4px;height:34px;width:calc(100% - 24px);border:0;border-radius:10px;background:transparent;cursor:pointer;text-align:left;padding:0 12px;color:var(--dsw-alias-label-secondary, #61666b);font:550 13px inherit;flex:none}
.dla-chat-cfg + .dla-chat-cfg{margin-top:0;margin-bottom:12px}
.dla-chat-cfg:hover{background:var(--dsw-alias-interactive-bg-hover, rgba(38,49,72,.06))}
.dla-chat-cfg.on{background:var(--dsw-alias-state-business-tertiary, #edf3fe);color:var(--dsw-alias-label-primary, #0f1115)}
.dla-chat-drop{outline:2px dashed var(--dsw-alias-state-business-primary, #4176e6)}
.dla-chat-files{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.dla-chat-handoff{padding:16px;font-size:13px;line-height:20px}
.dla-chat-handoff p{margin:0 0 12px}
.dla-chat-handoff b{display:block;font-size:11px;color:var(--dsw-alias-label-caption,#adb2b8);margin-bottom:4px}
.dla-chat-file{border:1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1));border-radius:8px;background:var(--dsw-alias-bg-base, #fff);padding:4px 8px;font:12px inherit;cursor:pointer}
.dla-chat-media{display:block;margin-top:4px;padding:6px 8px;border-radius:8px;background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06));font-size:12px;cursor:pointer}
.dla-chat-pending{display:flex;flex-wrap:wrap;gap:6px;padding:0 10px 6px}
.dla-chat-picks{margin:0 10px 8px;padding:4px 0 6px;max-height:220px;overflow:auto;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));border-radius:12px;background:var(--dsw-alias-bg-base,#fff)}
.dla-chat-pick-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 12px 8px;font-size:12px;font-weight:650;color:var(--dsw-alias-label-primary,#0f1115)}
.dla-chat-pick-x{flex:none;width:22px;height:22px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#61666b);cursor:pointer;font-size:16px;line-height:20px}
.dla-chat-pick-x:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06));color:var(--dsw-alias-label-primary,#0f1115)}
.dla-chat-pick-g + .dla-chat-pick-g{margin-top:2px}
.dla-chat-pick-dir{display:flex;align-items:center;gap:8px;width:calc(100% - 12px);margin:0 6px;padding:6px 8px;border:0;border-radius:8px;background:transparent;text-align:left;cursor:pointer;font:700 12px inherit;color:var(--dsw-alias-label-primary,#0f1115);letter-spacing:.01em}
.dla-chat-pick-dir:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.05))}
.dla-chat-pick-caret{flex:none;width:0;height:0;border-style:solid;border-width:4px 0 4px 6px;border-color:transparent transparent transparent currentColor}
.dla-chat-pick-dir.open .dla-chat-pick-caret{transform:rotate(90deg)}
.dla-chat-pick-dir span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dla-chat-pick-dir em{flex:none;font-style:normal;font-weight:500;font-size:11px;color:var(--dsw-alias-label-secondary,#61666b)}
.dla-chat-pick-row{display:flex;align-items:center;gap:8px;margin:0 6px;padding:5px 8px 5px 18px;border-radius:8px;font-size:13px;line-height:18px;cursor:pointer;color:var(--dsw-alias-label-primary,#0f1115)}
.dla-chat-pick-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.05))}
.dla-chat-pick-row.on{background:var(--dsw-alias-state-business-tertiary,#edf3fe)}
.dla-chat-pick-row input{flex:none;margin:0;accent-color:var(--dsw-static-deepseek-500,#4176e6)}
.dla-chat-pick-row span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;color:var(--dsw-alias-label-primary,#0f1115)}
.dla-chat-pick-row em{flex:none;font-style:normal;color:var(--dsw-alias-label-secondary,#61666b);font-size:11px}
.dla-chat-chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:3px 8px;border-radius:999px;background:var(--dsw-specific-tip,#f5f6f7);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06))}
.dla-chat-chip.over{border-color:var(--dsw-alias-state-error-primary,#ec1313);color:var(--dsw-alias-state-error-primary,#ec1313)}
.dla-chat-chip-img{display:block;width:56px;height:56px;object-fit:cover;border-radius:8px;cursor:zoom-in}
.dla-chat-chip button{border:0;background:transparent;cursor:pointer;color:var(--dsw-alias-label-caption,#adb2b8)}
.dla-chat-thumb{display:block;max-width:220px;max-height:140px;margin-top:6px;border-radius:10px;cursor:zoom-in}
.dla-chat-pdf{display:block;width:240px;height:180px;margin-top:6px;border:0;border-radius:10px;background:#fff;cursor:zoom-in}
.dla-chat-office{margin-top:6px;max-width:280px;max-height:180px;overflow:auto;padding:8px 10px;border-radius:10px;background:#fff;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary,#0f1115);cursor:zoom-in;white-space:normal}
.dla-chat-office table{border-collapse:collapse;font-size:11px}
.dla-chat-office td,.dla-chat-office th{border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06));padding:2px 6px}
.dla-chat-prev{position:fixed;inset:0;z-index:50;background:rgba(15,17,21,.45);display:flex;align-items:center;justify-content:center;padding:24px}
.dla-chat-prev-card{width:min(920px,94%);height:min(80%,720px);background:#fff;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(15,17,21,.24)}
.dla-chat-prev-h{height:44px;padding:0 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06));font-size:13px;font-weight:600}
.dla-chat-prev-body{flex:1;min-height:0;overflow:auto;background:#f6f7f9}
.dla-chat-prev-body iframe,.dla-chat-prev-body img,.dla-chat-prev-body video{width:100%;height:100%;border:0;object-fit:contain;background:#111}
.dla-chat-prev-body .dla-chat-office{max-width:none;max-height:none;margin:16px}
@media (max-width:720px){.dla-sec-panel{right:12px;width:calc(100vw - 24px)}}
`
      document.head.appendChild(tag)
      } catch { /* style inject must not blank the shell */ }
    }

    class SlotGuard extends React.Component {
      constructor(props) {
        super(props)
        this.state = { err: false }
      }
      static getDerivedStateFromError() {
        return { err: true }
      }
      render() {
        return this.state.err ? (this.props.fallback || null) : this.props.children
      }
    }

    function apply(ctx) {
      try { injectStyles() } catch { /* ignore */ }
      try { sessionsApi = typeof ctx.get === 'function' ? ctx.get('sessions') : null } catch { sessionsApi = null }
      const slots = ctx && ctx.slots
      if (!slots || typeof slots.inject !== 'function') return
      function mount(name, id, order, label, view) {
        try {
          slots.inject(name, () => slots.register({ name, id, order, label: () => label }, view))
        } catch { /* one slot must not blank the shell */ }
      }
      if (!inWorkbenchShell()) {
        mount('conversation.input.left', 'lan-assist-ask', 25, '聊天', function AskSafe(props) {
          return h(SlotGuard, { fallback: h('button', { type: 'button', className: 'dla-ask-btn' }, '聊天') }, h(AskColleagueButton, props))
        })
      } else {
        mount('shell.overlay', 'lan-assist-chat', 41, '聊天', function ChatSafe(props) {
          return h(SlotGuard, { fallback: null }, h(WorkbenchChat, props))
        })
      }
      mount('conversation.input.dock', 'lan-assist-dock', 15, '开口', SecretaryDock)
      mount('shell.overlay', 'lan-assist-badge', 40, '业务', function Overlay() {
        const openSession = function (sid) {
          try {
            const api = typeof ctx.get === 'function' ? ctx.get('sessions') : null
            if (api && typeof api.open === 'function') api.open(sid)
          } catch { /* live sessions stay off the React tree */ }
        }
        return h(OverlayBadge, { openSession })
      })
    }

    return {
      name: 'dsh-lan-assist',
      inject: ['slots'],
      apply,
    }
  },
})
