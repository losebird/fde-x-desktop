window.__ModuleLoader__.load({
  id: "fde-x-dsh-bridge",
  factory: () => {
    const inject = ["sessions", "remote", "remote.agentPresets", "workspaces", "conversation", "sidebarRight"];
    function apply(ctx) {
      const sessions = ctx.sessions;
      window.__fdeXSessions = sessions;
      document.documentElement.setAttribute("data-fde-session-canvas", "")
      var FILE_ADDRESS_PREFIX = "dsh-resource://file/";
      function isDriveSegment(segment) {
        return segment !== void 0 && /^[A-Za-z]:$/.test(segment);
      }
      function parseFileAddress(address) {
        try {
          if (!address || !address.startsWith(FILE_ADDRESS_PREFIX)) return void 0;
          var end = address.search(/[?#]/);
          var parts = address.slice(20, end === -1 ? void 0 : end).split("/");
          var scope = parts[0];
          var rest = parts.slice(1);
          if (scope === "session") {
            var id = rest[0];
            var segments = rest.slice(1);
            if (id === void 0 || id === "" || segments.length === 0) return void 0;
            return {
              scope: scope,
              sessionId: decodeURIComponent(id),
              path: segments.map(decodeURIComponent).join("/")
            };
          }
          if (scope === "absolute") {
            var unc = rest[0] === "" && rest.length > 1;
            var decoded = (unc ? rest.slice(1) : rest).map(decodeURIComponent);
            if (decoded.length === 0 || decoded[0] === "") return void 0;
            if (unc) return { scope: scope, path: "//" + decoded.join("/") };
            return {
              scope: scope,
              path: isDriveSegment(decoded[0]) ? decoded.join("/") : "/" + decoded.join("/")
            };
          }
          return;
        } catch (e) {
          return;
        }
      }
      function isAbsoluteWorkspacePath(path) {
        return path.startsWith("/") || /^[A-Za-z]:[/\\]/.test(path) || path.startsWith("\\\\");
      }
      function workspaceRelativePath(path, cwd) {
        var normalized = String(path || "").replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
        if (!normalized) return "";
        if (!isAbsoluteWorkspacePath(normalized)) {
          var depth = 0;
          var bits = normalized.split("/");
          for (var i = 0; i < bits.length; i++) {
            var part = bits[i];
            if (!part || part === ".") continue;
            if (part === "..") {
              depth -= 1;
              if (depth < 0) return null;
              continue;
            }
            depth += 1;
          }
          return normalized;
        }
        var root = String(cwd || "").replace(/\\/g, "/").replace(/\/+$/, "");
        if (!root) return null;
        if (normalized === root) return "";
        if (normalized.startsWith(root + "/")) return normalized.slice(root.length + 1);
        return null;
      }
      function sessionCwd(sessionId) {
        var listed = sessions.list && sessions.list.getSnapshot && sessions.list.getSnapshot();
        return listed && listed.byId && listed.byId[sessionId] ? listed.byId[sessionId].cwd : "";
      }
      function land(kind, extra) {
        if (!kind) return false
        if (window.parent === window) return false
        var payload = extra && typeof extra === "object" ? extra : {}
        window.parent.postMessage({
          type: "fde-x-dsh-ready",
          op: "land",
          kind: String(kind),
          sessionId: payload.sessionId || (sessions.list && sessions.list.getSnapshot && sessions.list.getSnapshot().current) || "",
          path: payload.path || "",
          cwd: payload.cwd || "",
          tab: payload.tab || "",
          taskId: payload.taskId || ""
        }, "*")
        return true
      }
      function landSessionPath(sessionId, path) {
        if (!path) return false;
        var cwd = sessionCwd(sessionId);
        var relative = workspaceRelativePath(path, cwd);
        if (relative === null) return false;
        return land("file", { sessionId: sessionId || "", path: relative, cwd: cwd || "" })
      }
      function presentedPath(sessionId, seq, index) {
        var binding = sessions.binding && sessions.binding(sessionId);
        var src = binding && binding.session && binding.session.eventSource;
        if (!src || typeof src.getSnapshot !== "function") return "";
        var entries = (src.getSnapshot().entries) || [];
        var want = Number(seq);
        var at = Number(index);
        if (!Number.isFinite(want) || !Number.isFinite(at) || at < 0) return "";
        for (var i = 0; i < entries.length; i++) {
          var row = entries[i];
          var ev = row && row.event;
          if (!ev || ev.type !== "deliverables/presented") continue;
          var eventSeq = Number(ev.seq);
          if (!Number.isFinite(eventSeq) && row) eventSeq = Number(row.seq);
          if (eventSeq !== want) continue;
          var files = ev.data && ev.data.files;
          var file = Array.isArray(files) ? files[at] : null;
          return file && typeof file.path === "string" ? String(file.path).trim() : "";
        }
        return "";
      }
      function landFile(address, sessionIdHint) {
        var parsed = parseFileAddress(address);
        if (!parsed) return false;
        return landSessionPath(parsed.sessionId || sessionIdHint || "", parsed.path);
      }
      function wrapOfficialSidebar() {
        var sidebar = ctx.sidebarRight
        if (!sidebar || typeof sidebar.openResource !== "function" || sidebar.openResource.__fdeOpenFile) return
        var origOpenResource = sidebar.openResource.bind(sidebar)
        var origOpenResourceIn = typeof sidebar.openResourceIn === "function" ? sidebar.openResourceIn.bind(sidebar) : null
        var origOpenTab = typeof sidebar.openTab === "function" ? sidebar.openTab.bind(sidebar) : null
        var tabKind = typeof window.__fdeLandKindFromTab === "function" ? window.__fdeLandKindFromTab : function (kind) { return kind }
        sidebar.openResource = function (address, options) {
          if (landFile(address, "")) return
          return origOpenResource(address, options)
        }
        sidebar.openResource.__fdeOpenFile = true
        if (origOpenResourceIn) {
          sidebar.openResourceIn = function (sessionId, address, options) {
            if (landFile(address, sessionId)) return
            return origOpenResourceIn(sessionId, address, options)
          }
        }
        if (origOpenTab) {
          sidebar.openTab = function (kind, options) {
            var landed = tabKind(kind)
            if (landed) {
              land(landed, { sessionId: (sessions.list && sessions.list.getSnapshot && sessions.list.getSnapshot().current) || "" })
              return
            }
            return origOpenTab(kind, options)
          }
        }
      }
      wrapOfficialSidebar()
      function wrapPresentOpen() {
        if (typeof window.fetch !== "function" || window.fetch.__fdePresentOpen) return;
        var origFetch = window.fetch.bind(window);
        function presentOpenUrl(input, init) {
          var method = "GET";
          if (init && init.method) method = String(init.method);
          else if (input && typeof input === "object" && input.method) method = String(input.method);
          if (String(method).toUpperCase() !== "POST") return null;
          var raw = typeof input === "string" ? input : (input && input.url) || "";
          if (!raw) return null;
          try {
            var parsed = new URL(raw, location.href);
            if (parsed.pathname !== "/api/present.open") return null;
            return parsed;
          } catch (e) {
            return null;
          }
        }
        var wrapped = function (input, init) {
          var method = "GET";
          if (init && init.method) method = String(init.method);
          else if (input && typeof input === "object" && input.method) method = String(input.method);
          method = String(method).toUpperCase();
          var raw = typeof input === "string" ? input : (input && input.url) || "";
          try {
            var lan = new URL(raw, location.href);
            if (lan.pathname === "/lan-assist/state" && method === "GET") {
              return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { "content-type": "application/json", "cache-control": "no-store" }
              }));
            }
            if (lan.pathname === "/lan-assist/sleep" && method === "POST") {
              return Promise.resolve(new Response(JSON.stringify({ ok: true, asleep: false }), {
                status: 200,
                headers: { "content-type": "application/json", "cache-control": "no-store" }
              }));
            }
          } catch (e) {}
          var parsed = presentOpenUrl(input, init);
          if (!parsed) return origFetch(input, init);
          var sessionId = parsed.searchParams.get("sessionId") || "";
          var path = presentedPath(sessionId, parsed.searchParams.get("seq"), parsed.searchParams.get("index"));
          if (!landSessionPath(sessionId, path)) return origFetch(input, init);
          return Promise.resolve(new Response(null, {
            status: 204,
            headers: { "cache-control": "no-store" }
          }));
        };
        wrapped.__fdePresentOpen = true;
        window.fetch = wrapped;
      }
      wrapPresentOpen();
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
      ctx.effect(function () { return function () { stopTurnWatch() } }, "fde-x-dsh-turn-watch")

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
      var turnWatch = { sid: "", timer: 0, lastText: "", sawRun: false }
      function stopTurnWatch() {
        if (turnWatch.timer) clearTimeout(turnWatch.timer)
        turnWatch.timer = 0
        turnWatch.sid = ""
        turnWatch.sawRun = false
        turnWatch.lastText = ""
      }
      function startTurnWatch(sid) {
        var id = String(sid || "")
        if (!id) return
        if (turnWatch.sid === id && turnWatch.timer) return
        stopTurnWatch()
        var binding = sessions.binding && sessions.binding(id)
        var session = binding && binding.session
        turnWatch.sid = id
        turnWatch.lastText = lastAssistantText(session)
        turnWatch.sawRun = false
        var poll = function () {
          if (turnWatch.sid !== id) return
          var bound = sessions.binding && sessions.binding(id)
          var sess = bound && bound.session
          var nowText = lastAssistantText(sess)
          var snap = sess && sess.getSnapshot ? sess.getSnapshot() : null
          var running = !!(snap && snap.running)
          if (running) turnWatch.sawRun = true
          if (turnWatch.sawRun && !running && nowText && nowText !== turnWatch.lastText) {
            turnWatch.lastText = nowText
            turnWatch.sawRun = false
            if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-ready", sessionId: id, op: "assistant", text: nowText }, "*")
          }
          turnWatch.timer = setTimeout(poll, 500)
        }
        turnWatch.timer = setTimeout(poll, 400)
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
              startTurnWatch(data.sessionId)
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
                startTurnWatch(sid)
                if (window.parent !== window) window.parent.postMessage({ type: "fde-x-dsh-ready", sessionId: sid, op: "prompted" }, "*")
                return
              }
              if (tries++ > 40) {
                var binding2 = sessions.binding && sessions.binding(sid)
                var before2 = lastAssistantText(binding2 && binding2.session)
                if (have === want && typeof shell.submit === "function") shell.submit("queue")
                startTurnWatch(sid)
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
