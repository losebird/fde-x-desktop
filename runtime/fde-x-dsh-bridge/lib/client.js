window.__ModuleLoader__.load({
  id: "fde-x-dsh-bridge",
  factory: () => {
    const inject = ["sessions", "remote", "remote.agentPresets", "workspaces", "conversation"];
    function apply(ctx) {
      const sessions = ctx.sessions;
      window.__fdeXSessions = sessions;
      function bindWorkspace(sessionId, workspaceId) {
        if (!sessionId || !workspaceId) return
        try {
          var workspaces = ctx.workspaces
          if (workspaces && typeof workspaces.insertSessionBefore === "function") {
            var inserted = workspaces.insertSessionBefore(workspaceId, sessionId)
            if (inserted && typeof inserted.then === "function") inserted.catch(function () {})
          }
          var remote = ctx.remote && ctx.remote.workspaces
          if (remote && typeof remote.insertSessionBefore === "function") {
            Promise.resolve(remote.insertSessionBefore({ workspaceId: workspaceId, sessionId: sessionId })).catch(function () {})
          }
        } catch (e) {}
      }
      var pendingSelectId = ""
      try {
        var hash = String(location.hash || "")
        var marker = "fde-session="
        var at = hash.indexOf(marker)
        if (at >= 0) pendingSelectId = decodeURIComponent(hash.slice(at + marker.length).split("&")[0].split("/")[0])
      } catch (e) {}

      function pickExisting(workspaceId) {
        var listed = sessions.list && sessions.list.getSnapshot && sessions.list.getSnapshot()
        var spaces = ctx.workspaces && ctx.workspaces.list && ctx.workspaces.list.getSnapshot && ctx.workspaces.list.getSnapshot()
        if (!listed || !listed.byId) return ""
        var archived = (spaces && spaces.archivedSessionIds) || []
        if (pendingSelectId && listed.byId[pendingSelectId] && archived.indexOf(pendingSelectId) < 0) return pendingSelectId
        var workspace = spaces && spaces.items && spaces.items.find(function (item) { return item.workspaceId === workspaceId })
        if (!workspace) return ""
        var latestId = ""
        var latestTime = -Infinity
        for (var i = 0; i < (workspace.sessionIds || []).length; i++) {
          var sid = workspace.sessionIds[i]
          if (archived.indexOf(sid) >= 0) continue
          var row = listed.byId[sid]
          if (!row) continue
          var t = Number(row.updatedAt) || 0
          if (t >= latestTime) {
            latestTime = t
            latestId = sid
          }
        }
        return latestId
      }

      if (typeof sessions.create === "function") {
        var origCreate = sessions.create.bind(sessions)
        sessions.create = function (opts) {
          var workspaceId = opts && opts.workspaceId
          if (workspaceId) {
            var existing = pickExisting(workspaceId)
            if (existing) return Promise.resolve(existing)
          }
          return origCreate(opts)
        }
      }
      function wrapConnect() {
        var uiWorkspace = ctx.get ? ctx.get("uiWorkspace") : undefined
        if (!uiWorkspace || typeof uiWorkspace.connectWorkspace !== "function" || uiWorkspace.connectWorkspace.__fdeReuse) return
        var origConnect = uiWorkspace.connectWorkspace.bind(uiWorkspace)
        var wrapped = function (workspaceId) {
          var existing = pickExisting(workspaceId)
          if (existing) return Promise.resolve(existing)
          return origConnect(workspaceId)
        }
        wrapped.__fdeReuse = true
        uiWorkspace.connectWorkspace = wrapped
      }
      wrapConnect()
      var wrapTries = 0
      var wrapTimer = setInterval(function () {
        wrapConnect()
        if (wrapTries++ > 40) clearInterval(wrapTimer)
      }, 50)
      ctx.effect(function () { return function () { clearInterval(wrapTimer) } }, "fde-x-dsh-wrap-connect")

      function keepAwake() {
        try {
          fetch("/lan-assist/sleep", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ on: false }),
            credentials: "same-origin",
          }).catch(function () {})
        } catch (e) {}
      }
      keepAwake()
      var awakeTimer = setInterval(keepAwake, 4000)
      document.addEventListener("visibilitychange", keepAwake)
      ctx.effect(function () {
        return function () {
          clearInterval(awakeTimer)
          document.removeEventListener("visibilitychange", keepAwake)
        }
      }, "fde-x-dsh-keep-awake")

      function visibleAssistantText(message) {
        var blocks = message && message.content
        if (!Array.isArray(blocks)) return ""
        return blocks.filter(function (block) { return block && block.type === "text" }).map(function (block) { return String(block.text || "") }).join("").trim()
      }
      var SKIP_TURN = /Current runtime context|system-reminder|available_skills|<goal_round>|<skill_content>|Compactions remaining/
      function userVisibleText(event) {
        if (!event || event.type !== "user/message") return ""
        var data = event.data || {}
        var source = data.source || {}
        if (source.kind && source.kind !== "user") return ""
        if (source.plugin) return ""
        var message = data.message || data
        var t = visibleAssistantText(message)
        if (!t || SKIP_TURN.test(t) || t.charAt(0) === "/") return ""
        return t
      }
      function transcriptOf(session) {
        var src = session && session.eventSource
        if (!src || typeof src.getSnapshot !== "function") return []
        var entries = (src.getSnapshot().entries) || []
        var turns = []
        for (var i = 0; i < entries.length; i++) {
          var ev = entries[i] && entries[i].event
          if (!ev) continue
          var user = userVisibleText(ev)
          if (user) {
            turns.push({ role: "user", text: user.length > 8000 ? user.slice(0, 8000) + "…" : user })
            continue
          }
          if (ev.type !== "assistant/message") continue
          var assist = visibleAssistantText((ev.data || {}).message)
          if (assist) turns.push({ role: "assistant", text: assist.length > 8000 ? assist.slice(0, 8000) + "…" : assist })
        }
        return turns
      }
      function lastAssistantText(session) {
        var src = session && session.eventSource
        if (!src || typeof src.getSnapshot !== "function") return ""
        var entries = (src.getSnapshot().entries) || []
        var best = ""
        var bestSeq = -1
        for (var i = 0; i < entries.length; i++) {
          var ev = entries[i] && entries[i].event
          if (!ev || ev.type !== "assistant/message") continue
          var seq = Number(ev.seq)
          if (!Number.isFinite(seq)) seq = i
          var t = visibleAssistantText((ev.data || {}).message)
          if (t && seq >= bestSeq) {
            bestSeq = seq
            best = t
          }
        }
        return String(best || "").trim()
      }
      function watchAssistant(sid, before) {
        var binding = sessions.binding && sessions.binding(sid)
        var session = binding && binding.session
        var tries = 0
        var sawRun = false
        var poll = function () {
          var nowText = lastAssistantText(session)
          var snap = session && session.getSnapshot ? session.getSnapshot() : null
          var running = !!(snap && snap.running)
          if (running) sawRun = true
          if (sawRun && !running && nowText && nowText !== before) {
            if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-ready", sessionId: sid, op: "assistant", text: nowText }, "*")
            return
          }
          if (tries++ > 180) {
            if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-ready", sessionId: sid, op: "assistant", text: "" }, "*")
            return
          }
          setTimeout(poll, 500)
        }
        setTimeout(poll, 600)
      }

      function run(data) {
        if (!data || data.type !== "fde-x-dsh") return;
        const ui = ctx.get ? ctx.get("uiWorkspace") : undefined;
        if (data.op === "select" && data.sessionId) {
          pendingSelectId = data.sessionId
          var tries = 0
          var open = function () {
            try {
              var listed = sessions.list && sessions.list.getSnapshot && sessions.list.getSnapshot()
              var known = listed && listed.byId && listed.byId[data.sessionId]
              if (!known) {
                if (tries++ < 50) {
                  setTimeout(open, 200)
                  return
                }
                if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-error", message: "DSH 列表里还没有这条会话，无法打开输入框" }, "*")
                return
              }
              var current = listed && listed.current
              if (current !== data.sessionId) {
                if (ui && typeof ui.openSession === "function") ui.openSession(data.sessionId)
                else sessions.open(data.sessionId)
              }
              bindWorkspace(data.sessionId, data.workspaceId)
            } catch (e) {}
          }
          open()
        }
        if (data.op === "rename" && data.sessionId && data.title && typeof sessions.binding === "function") {
          try {
            var bound = sessions.binding(data.sessionId)
            var session = bound && bound.session
            if (session && typeof session.rename === "function") session.rename(data.title)
          } catch (e) {}
        }
        if (data.op === "fork") {
          var timer
          var fail = function (err) {
            if (timer) clearTimeout(timer)
            var msg = err && (err.message || err.code) ? String(err.message || err.code) : "分叉失败"
            if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-error", message: msg }, "*")
          }
          if (!data.sessionId || typeof sessions.fork !== "function") {
            fail(new Error("当前页无法分叉会话"))
            return
          }
          try {
            timer = setTimeout(function () { fail(new Error("DSH fork 超时")) }, 4000)
            Promise.resolve(sessions.fork({ sessionId: data.sessionId, increaseTitle: true })).then((id) => {
              if (timer) clearTimeout(timer)
              var sid = typeof id === "string" ? id : id && id.sessionId
              if (!sid && sessions.list && sessions.list.getSnapshot) {
                var snap = sessions.list.getSnapshot()
                if (snap.current && snap.current !== data.sessionId) sid = snap.current
              }
              if (!sid) {
                fail(new Error("空会话或未结束的一轮不能分叉"))
                return
              }
              sessions.open(sid)
              if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-ready", sessionId: sid }, "*")
            }).catch(fail)
          } catch (err) {
            fail(err)
          }
        }
        if (data.op === "create") {
          var failCreate = function (err) {
            var msg = err && (err.message || err.code) ? String(err.message || err.code) : "新建会话失败"
            if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-error", message: msg }, "*")
          }
          try {
            if (typeof sessions.create !== "function") {
              failCreate(new Error("当前页无法新建会话"))
              return
            }
            var opts = {}
            if (data.workspaceId) opts.workspaceId = data.workspaceId
            else if (data.cwd) opts.cwd = data.cwd
            if (data.agentPreset) opts.agentPreset = data.agentPreset
            var created = sessions.create(opts)
            Promise.resolve(created).then(function (id) {
              var sid = typeof id === "string" ? id : id && id.sessionId
              if (!sid && sessions.list && sessions.list.getSnapshot) {
                var snap = sessions.list.getSnapshot()
                if (snap.current) sid = snap.current
              }
              if (!sid) {
                failCreate(new Error("新建会话没有返回 id"))
                return
              }
              sessions.open(sid)
              bindWorkspace(sid, data.workspaceId)
              if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-ready", sessionId: sid }, "*")
              if (data.agentPreset) {
                try {
                  var presets = ctx.remote.agentPresets
                  if (presets && typeof presets.select === "function") {
                    Promise.resolve(presets.select(sid, data.agentPreset)).catch(function () {})
                  }
                } catch (e) {}
              }
            }).catch(failCreate)
          } catch (err) {
            failCreate(err)
          }
        }
        if (data.op === "prompt") {
          try {
            var conversation = ctx.conversation
            var sid = data.sessionId
            if (!sid && sessions.list && sessions.list.getSnapshot) sid = sessions.list.getSnapshot().current
            var input = conversation && conversation.input
            var shell = input && typeof input.shell === "function" ? input.shell(sid) : undefined
            if (!sid) throw new Error("没有打开的会话，无法发送")
            if (!shell || typeof shell.setDraft !== "function") throw new Error("输入框还没就绪")
            var text = String(data.text || "")
            shell.setDraft(text)
            var tries = 0
            var sendWhenReady = function () {
              var have = shell.snapshot ? String(shell.snapshot.draft || "").trim() : ""
              var want = text.trim()
              var btn = document.querySelector('[data-composer-card] button[aria-label="发送消息"], [data-composer-card] button[aria-label="排队发送"], [data-composer-card] button[aria-label="插话发送"]')
              if (have === want && btn && !btn.disabled) {
                var binding = sessions.binding && sessions.binding(sid)
                var before = lastAssistantText(binding && binding.session)
                btn.click()
                watchAssistant(sid, before)
                if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-ready", sessionId: sid, op: "prompted" }, "*")
                return
              }
              if (tries++ > 40) {
                var binding2 = sessions.binding && sessions.binding(sid)
                var before2 = lastAssistantText(binding2 && binding2.session)
                if (have === want && typeof shell.submit === "function") shell.submit("queue")
                watchAssistant(sid, before2)
                if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-ready", sessionId: sid, op: "prompted" }, "*")
                return
              }
              setTimeout(sendWhenReady, 50)
            }
            sendWhenReady()
          } catch (err) {
            if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-error", message: String(err && err.message ? err.message : err) }, "*")
          }
        }
        if (data.op === "transcript") {
          try {
            var ids = Array.isArray(data.sessionIds) ? data.sessionIds.filter(Boolean) : (data.sessionId ? [data.sessionId] : [])
            var listed = sessions.list && sessions.list.getSnapshot && sessions.list.getSnapshot()
            var current = listed && listed.current
            var rows = []
            var next = function (index) {
              if (index >= ids.length) {
                if (current) {
                  try {
                    if (ui && typeof ui.openSession === "function") ui.openSession(current)
                    else sessions.open(current)
                  } catch (e) {}
                }
                if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-ready", op: "transcript", sessions: rows }, "*")
                return
              }
              var sid = String(ids[index] || "")
              var read = function () {
                var binding = sessions.binding && sessions.binding(sid)
                rows.push({ sessionId: sid, turns: transcriptOf(binding && binding.session) })
                next(index + 1)
              }
              var have = sessions.binding && sessions.binding(sid)
              if (have && have.session && have.session.eventSource) {
                read()
                return
              }
              try {
                if (ui && typeof ui.openSession === "function") ui.openSession(sid)
                else sessions.open(sid)
              } catch (e) {}
              var tries = 0
              var wait = function () {
                var bound = sessions.binding && sessions.binding(sid)
                if (bound && bound.session && bound.session.eventSource) {
                  read()
                  return
                }
                if (tries++ > 50) {
                  rows.push({ sessionId: sid, turns: [] })
                  next(index + 1)
                  return
                }
                setTimeout(wait, 120)
              }
              wait()
            }
            next(0)
          } catch (err) {
            if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-error", message: String(err && err.message ? err.message : err) }, "*")
          }
        }
        if (data.op === "readAssistant") {
          try {
            var sid = data.sessionId
            if (!sid && sessions.list && sessions.list.getSnapshot) sid = sessions.list.getSnapshot().current
            var binding = sessions.binding && sessions.binding(sid)
            var session = binding && binding.session
            if (!sid || !session) throw new Error("左边还没有打开的会话")
            var tries = 0
            var publish = function () {
              var snap = session.getSnapshot ? session.getSnapshot() : null
              if (snap && snap.running && tries++ < 40) {
                setTimeout(publish, 250)
                return
              }
              var text = lastAssistantText(session)
              if (!text) {
                if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-error", message: "左边还没有可采纳的回复" }, "*")
                return
              }
              if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-ready", sessionId: sid, op: "assistant", text: text }, "*")
            }
            publish()
          } catch (err) {
            if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-error", message: String(err && err.message ? err.message : err) }, "*")
          }
        }
        if (data.op === "compose") {
          try {
            var conversation = ctx.conversation
            var sid = data.sessionId
            if (!sid && sessions.list && sessions.list.getSnapshot) sid = sessions.list.getSnapshot().current
            var input = conversation && conversation.input
            var shell = input && typeof input.shell === "function" ? input.shell(sid) : undefined
            if (!sid) throw new Error("没有打开的会话，无法写入输入框")
            if (!shell || typeof shell.setDraft !== "function") throw new Error("输入框还没就绪")
            shell.setDraft(String(data.text || ""))
            if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-ready", sessionId: sid, op: "composed" }, "*")
          } catch (err) {
            if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-error", message: String(err && err.message ? err.message : err) }, "*")
          }
        }
        if (data.op === "attachFiles") {
          try {
            var conversation = ctx.conversation
            var sid = data.sessionId
            if (!sid && sessions.list && sessions.list.getSnapshot) sid = sessions.list.getSnapshot().current
            if (!conversation || typeof conversation.createDrafts !== "function") throw new Error("会话页还不能接收附件")
            if (!sid) throw new Error("没有打开的会话，无法附加文件")
            var items = Array.isArray(data.files) ? data.files : []
            if (items.length === 0) throw new Error("没有可附加的文件")
            var files = items.map(function (item) {
              var raw = atob(String(item.base64 || ""))
              var bytes = new Uint8Array(raw.length)
              for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
              return new File([bytes], String(item.name || "file"), { type: String(item.type || "application/octet-stream") })
            })
            var drafts = conversation.createDrafts(sid, files)
            var input = conversation.input
            var shell = input && typeof input.shell === "function" ? input.shell(sid) : undefined
            if (!shell || typeof shell.addAttachments !== "function") throw new Error("输入框还没就绪，请点一下会话后再拖")
            if (!shell.addAttachments(drafts.map(function (draft) { return draft.id }))) {
              if (typeof conversation.releaseDraftAttachments === "function") conversation.releaseDraftAttachments(drafts)
              throw new Error("附件没有放进输入框")
            }
            if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-ready", sessionId: sid, op: "attached" }, "*")
          } catch (err) {
            if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-error", message: String(err && err.message ? err.message : err) }, "*")
          }
        }
        if (data.op === "archive" && data.sessionId) {
          var space = ctx.get ? ctx.get("uiWorkspace") : ui
          var workspaces = ctx.get ? ctx.get("workspaces") : undefined
          Promise.resolve(
            space && typeof space.archiveSession === "function"
              ? space.archiveSession(data.sessionId)
              : workspaces && workspaces.archiveSession
                ? workspaces.archiveSession(data.sessionId)
                : Promise.reject(new Error("无法归档会话"))
          ).then(() => {
            if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-ready", sessionId: data.sessionId, op: "archived" }, "*");
          }).catch((err) => {
            if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-error", message: String(err && err.message ? err.message : err) }, "*");
          });
        }
      }
      const onMessage = (event) => run(event.data);
      window.addEventListener("message", onMessage);
      ctx.effect(() => () => window.removeEventListener("message", onMessage), "fde-x-dsh-bridge");
    }
    return { inject, apply };
  },
});
