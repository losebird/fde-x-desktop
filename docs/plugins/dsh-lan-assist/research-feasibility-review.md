# DSH LAN-assist: feasibility review against current DeepSeek Harness

Reviewed 2026-08-22 against **installed** DeepSeek Harness **0.1.0-rc.6**, not the old `/workspace/deepseek-harness` checkout cited by `dsh-lan-assist-feasibility.md`.

## Sources used

| What | Where | Notes |
|---|---|---|
| Current DSH | `/opt/homebrew/lib/node_modules/@deepseek-ai/dsh` (`@deepseek-ai/dsh@0.1.0-rc.6`) | Published CLI + 190+ `@deepseek-ai/dsh-*` packages. This is the live runtime on this machine. |
| Package internals | `/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-*` | Compiled `lib/` + README. Monorepo `packages/.../src/*.ts` paths from the old note are **not** on disk. |
| Local `dsh` folder | `/Users/zxz/Documents/ai-project/dsh` | Plugin **registry / web catalog**, not harness source. |
| Semantic-os precedent | `/Users/zxz/Documents/ai-project/dsh-semantic-os` | Real out-of-tree Host+Client plugin. |
| Product vision | `推广.md` | Full “秘书跟秘书说话” story. |
| Clickable prototype | `demo/README.md`, `demo/index.html` | Static HTML only. |
| Old feasibility | `dsh-lan-assist-feasibility.md` | Written against `/workspace/deepseek-harness`. Claims re-checked below. |
| Fuller PRD | **Not found** | See §3. |

`dsh-ext-dev-guide.md` is not on this machine. Knowledge graph for this cwd was empty.

---

## 1. Verdict

**A thin LAN mailbox can be built as an out-of-tree Host+Client plugin. The product in `推广.md` / `demo/` cannot be built as “just a plugin” and cannot reuse official DSH as the wire.**

Official DSH 0.1.0-rc.6 is still a **single-user loopback harness**. There is still no peer, no mDNS, no human inbox, no official LAN messenger, and no way for a tree-external plugin to invent new durable `SessionEvent` types or a silent colleague bubble.

That matches the old note’s one-line conclusion. Line numbers and some file names have moved (published packages ship `lib/*.js` + `.d.ts`, not the monorepo `src/*.ts`). The **API contracts still hold**.

There is **no plugin package today**. This repo is vision + static demo + the old note.

---

## 2. Claim-by-claim (old note vs current 0.1.0-rc.6)

### 2.1 Official web binds `127.0.0.1` and refuses `0.0.0.0`

**CONFIRMED.**

CLI still rejects all-interfaces bind before publishing `webStartup`:

```39:39:/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-app/lib/startup.js
		if (options.host === "0.0.0.0") program.error("error: --host 0.0.0.0 is intentionally not supported yet for safety: it would expose remote code execution to the network; use 127.0.0.1 instead");
```

Default bind is still loopback `:3080`:

```115:120:/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml
    - id: webserver
      name: '@deepseek-ai/dsh-host-webserver'
      inject: [webStartup]
      config:
        host: !!js ctx.webStartup.host ?? '127.0.0.1'
        port: !!js ctx.webStartup.port ?? 3080
```

Schema still **allows** `0.0.0.0`; the launcher does not:

```37:39:/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-host-webserver/lib/types/index.d.ts
export interface Config {
    /** Listen host; the two supported values are loopback and all-interfaces. */
    host: '127.0.0.1' | '0.0.0.0';
```

The old cite `deepseek-harness/docs/subsystems/web-server.md` is **not in the published install**. The same fact is now in the connection README: “`dsh web --host 0.0.0.0` 在远程访问具备认证层之前有意不受支持” and “Web 载体不提供认证层” (`dsh-client-connection/README.zh.md` §「/api 浏览器信任栅栏」).

`--trusted-host` is still a **DNS-rebinding fence**, not peer discovery (`dsh-web-app/lib/startup.js` option text: “extra authority the /api browser-trust fence accepts”).

### 2.2 `ctx.webServer` is that same loopback `node:http`; a plugin can `register` / `registerUpgrade`

**CONFIRMED.**

```5:5:/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-host-webserver/README.md
Web HTTP and upgrade-route registration plugin … a `node:http` server that listens on activation and provides `ctx.webServer`. `register(route)` adds a named `exact`/`prefix` HTTP route; `registerUpgrade(route)` adds an upgrade route for an exact pathname.
```

```72:79:/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-host-webserver/lib/types/index.d.ts
    register(route: WebRoute): () => void;
    …
    registerUpgrade(route: WebUpgradeRoute): () => void;
```

A prefix on `ctx.webServer` is **same-origin to this instance’s browser**. The peer machine cannot hit it while the official server stays on `127.0.0.1`.

HMR still hangs SSE on this server (`dsh-client-hmr/lib/index.js` `ctx.webServer.register({ kind: "exact", path: EVENTS_ENDPOINT, … })`). That is a local-browser channel, not LAN.

### 2.3 No official toast / OS notify / badge / human inbox

**CONFIRMED, with one local nuance.**

`shell.overlay` is still the documented unowned floating layer for a **self-drawn** badge / toast stack:

```67:80:/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/lib/types/client/index.d.ts
        /**
         * Frame-wide floating layer … a badge, a
         * toast stack or a status pill all belong here …
         */
        'shell.overlay': {
            kind: 'list';
            scope: 'root';
        };
```

There is **no** `ctx.notify`, OS notification, or product inbox for humans. The word `inbox` is the **agent queue**. `session/queue` items with `placement: 'context'` stay invisible until claimed:

```38:41:/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-host-apiproxy/lib/types/api/events.d.ts
    /** Agent-resolved FIFO placement; queued and steering items render on different surfaces, context items stay invisible until claimed. */
    placement: 'queued' | 'steering' | 'context';
```

Nuance: `SessionInput.notify(level, text)` exists (`dsh-client-ui-conversation/.../input/contract.d.ts`). It is a **composer-local notice** for that session (“detached command results and business notifications”), not an OS toast, not a frame badge, not a human mailbox.

### 2.4 Client slots: `shell.overlay`, `conversation.view`, `conversation.input.dock`, `sidebar.footer.action`

**CONFIRMED.** All four still exist and are the right seats for the demo’s secretary UI.

| Slot | Kind / scope | Current owner doc |
|---|---|---|
| `shell.overlay` | list / root | layout — badge / toast / pill |
| `conversation.view` | list / session | conversation — whole tab (chat, trajectory, …) |
| `conversation.input.dock` | list / session | conversation — full-width row **above** composer |
| `sidebar.footer.action` | list / root | sidebar — optional actions beside Settings |
| also still there | | `conversation.session.header.actions`, `conversation.composer` |

```78:81:/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts
        'conversation.view': {
            kind: 'list';
            scope: 'session';
```

```190:194:/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts
        'conversation.input.dock': {
            kind: 'list';
            scope: 'session';
            owner: InputZone;
        };
```

```39:43:/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/types/client/contract/slots.d.ts
        'sidebar.footer.action': {
            kind: 'list';
            scope: 'root';
            owner: SidebarFooterActionOwnerProps;
        };
```

Demo mapping still valid: dock = secretary speak + two buttons; view =「协助」tab; overlay =「秘书」pill.

### 2.5 `agents.get` / `followup` / `inject` / `resume`

**CONFIRMED.** Behavior unchanged in substance.

`get` is live-table only:

```688:689:/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-agent/lib/index.js
	get(id) {
		return this.store.get(id)?.agent;
```

```21:43:/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-agent/README.md
- `ctx.agents.get(id: SessionId): Agent | undefined`
…
- `ctx.agents.resume(options: ResumeAgentOptions): Promise<AgentHandle>` — load a persisted session …
```

```68:70:/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-agent/README.md
- `agent.followup(message)` — queue an ordinary `next-turn` message and wake the driver.
- `agent.inject(message)` — queue non-waking `next-step` context. A running driver claims it at the nearest later pre-step boundary; an idle driver leaves it pending until `followup()` or `steer()` wakes the driver.
```

`createUserMessage({ source: { kind: "plugin", plugin } })` still exists (`dsh-agent-loop/lib/index.js`).

Honest write-back is still only:

1. live `followup` of a **user-role** plugin-sourced message → **wakes A’s model**;
2. product mailbox + self-drawn UI → **does not** enter the official transcript.

There is still no official “append a silent assistant/system colleague bubble”.

### 2.6 Cannot persist new `SessionEvent` types out of tree

**CONFIRMED, verbatim.**

```8:16:/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-session/lib/types/known-event-types.d.ts
 * Every `SessionEventMap` member declared in this repository — the event
 * vocabulary this build understands. The persistence read path refuses to
 * interpret a log containing a type outside this set unless the event
 * carries the envelope's `ignorable` marker
 * Downstream (out-of-repo) plugin events are outside this list by
 * construction; a registration surface for them is deferred until such a
 * consumer exists.
```

Mailbox / pairing / hold / circulate **must** live in plugin disk, not the session log.

### 2.7 No peer / mDNS / multi-user identity

**CONFIRMED.**

Anonymous id is still a per-`$DSH_HOME` telemetry UUID, “never derived from the hostname, network address, git remote”:

```7:14:/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-anonymous-user-id/lib/index.js
* Per-harness-home anonymous user id shared by telemetry and feedback.
*
* The id is a random UUID persisted as a bare line in `.anonymous-user-id`
* … never derived from the hostname, network address, git remote, or any
* other identifying source.
```

Search of installed `@deepseek-ai/dsh-*` for `mDNS` / `mdns` / `bonjour` / `zeroconf` / `peer discovery` / `multi-user`: **no hits**. LAN in official docs is the `/api` trust fence, not a discovery protocol.

`/api` still has **no authentication layer** (`dsh-client-connection/README.zh.md`: “这道栅栏是可达性策略，而不是认证；Web 载体不提供认证层”). Do not expose official `/api` on the LAN.

### 2.8 `tools.register` + `commands.register` exist

**CONFIRMED.**

```20:20:/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-tools/README.md
- `ctx.tools.register(definition: ToolDefinition): () => void` Register a trusted typed same-process definition …
```

```9:9:/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-commands/README.md
`ctx.commands.register(definition)` registers one lowercase command name, description, optional unstructured-input hint, optional `recordInput` policy, and abortable handler.
```

`exec.agent` is still the current session’s agent (`dsh-tools/lib/types/index.d.ts`: “The agent on whose behalf the call runs (set by the agent loop).”). A-side “发给林督” can be a tool or a slash command. Commands “never enter model history” unless the handler explicitly schedules work on the Agent.

### 2.9 No `ctx.remote` for out-of-tree plugins

**CONFIRMED in the sense that matters; wording in the old note is slightly too absolute.**

`ctx.remote` **exists** for first-party Client packages. It is an allowlisted BFF (`dsh-api-remotes/README.md`: Client mounts generated `/remote` artifacts). Out-of-tree plugins **cannot add** a Remote or a Settings namespace:

```38:38:/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-plugins/README.md
- **Exposure is a Host allowlist, not a plugin declaration** — a namespace absent from the api-proxy's allowlist answers `settings-not-exposed` even when its owner registered it, so a plugin distributed outside this repository cannot surface its own configuration here without a change in `packages/host/apiproxy`.
```

Honest Host↔Client path for this product is the same as semantic-os: **same-origin prefix on `ctx.webServer`**, then `fetch('/lan-assist/...')`. Do not invent a Remote.

### 2.10 semantic-os sidecar precedent

**CONFIRMED, and it does *not* give you a LAN bind.**

Host registers a prefix + upgrade on the official loopback server, and spawns a sidecar that **also** binds loopback:

```90:100:/Users/zxz/Documents/ai-project/dsh-semantic-os/index.js
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/semantic-os',
    handler,
  }))
  …
    ctx.effect(() => ctx.webServer.registerUpgrade({
      path: '/semantic-os/ws/graph-updates',
```

```1:3:/Users/zxz/Documents/ai-project/dsh-semantic-os/http.js
 * Same-origin /semantic-os prefix: official Explorer HTML transform + reverse proxy.
 * Browser never talks to the sidecar loopback.
```

```3953:3961:/Users/zxz/Documents/ai-project/dsh-semantic-os/python/bootstrap.py
    listener.bind(("127.0.0.1", requested_port))
    …
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning"))
```

Client talks with `fetch('/semantic-os/...')`, not `ctx.remote`.

**Implication for LAN-assist:** copy the *shape* (Host prefix for *this* browser + optional sidecar). Do **not** copy the bind. A peer on another machine cannot reach 127.0.0.1. A LAN-reachable mailbox is a **new** `http.createServer` / sidecar bound to a LAN address, with pairing auth, **never** the official `/api`.

---

## 3. Fuller PRD (demo cites §7.1 / §16.4 / §18)

**Not found on this machine.**

Searched:

- this repo (`dsh-lan-assist`)
- `/Users/zxz/Documents/ai-project/dsh`, `dsh-semantic-os`
- names like `*PRD*`, `*产品需求*`, `dsh-ext-dev-guide.md`

The only hits are the demo citing those section numbers:

- `demo/README.md`: “§16.4 五条开口… §18 只在配对页说一句…”
- `demo/index.html`: “交给 §7.1 命令写日历”

Those sections are **not in** `推广.md` (135 lines, no numbered spec). Treat `推广.md` + `demo/README.md` + `demo/index.html` as the product spec until a numbered PRD appears. Do not implement “§7.1 calendar command” as if a hidden spec file exists.

---

## 4. What exists in *this* repo today

| Artifact | Status |
|---|---|
| `推广.md` | Full product story |
| `demo/index.html` + `demo/shots/` | Clickable static prototype |
| `dsh-lan-assist-feasibility.md` | Old API note (still mostly right) |
| `package.json` / Host+Client / `cordis.patch.yml` | **Absent** |
| LAN server, pairing, mailbox, crypto | **Absent** |
| Tools / commands / slots | **Absent** |

`demo/README.md` already says this: “没有 `package.json` / Host+Client 插件骨架（那是下一刀）。”

---

## 5. Minimum honest v1 vs full product

### Full product (`推广.md` + demo)

Two secretaries on one LAN: face-to-face pairing, display names, untrusted discovery, 1:1 + 1:N + N:1, confirm-before-send, encrypted body, attachments with size cap, unread recall, circulate/hold/versions, countersign, schedule pick → calendar command, nudge, morning brief, boot-time listener when DSH is closed, DHCP doorplate without re-pair, split-LAN honesty, 90-day ledger, export/wipe, write-out command, semantic-os decision slip. **No** group chat, **no** internet relay, **no** phone push.

### Minimum honest v1 (smallest thing that is not a lie)

Two humans, two DSH web instances, **one paired link**, **one request / one reply**, **no silent model wake**.

1. **Out-of-tree plugin** (Host + Client), installable like semantic-os. Not a DSH fork.
2. **Manual pair**: type peer `IP:port` + short pairing code → store a stable peer id + shared secret on disk. No mDNS in v1.
3. **Separate LAN HTTP** in the Host process or a sidecar. Auth every request with the shared secret. **Never** rebind official `ctx.webServer` / `/api`.
4. **Disk mailbox** under `$DSH_HOME` or workspace (request id, A `sessionId`, bodies, state). Offline = write local outbox; do not say “已发送”.
5. **A trigger**: `ctx.tools.register(ask_colleague)` and/or `ctx.commands.register` slash command. Confirm recipient by **name**, not “发给他”.
6. **B UI**: `conversation.input.dock` one sentence + reply / draft; `conversation.view`「协助」for pair + mailbox; `shell.overlay` unread count. No official toast.
7. **Write-back**: default **只收下** (mailbox + overlay only). **按他说的做** = if A’s session is live, `createUserMessage({ source:{kind:'plugin'} })` + `followup`, and the copy must say this **wakes the model**. Cold session: say so; `resume` only after the human clicks.
8. **Local refresh**: official mux already refreshes chat after `followup`. Badge/mailbox refresh via plugin SSE/prefix on **loopback** `ctx.webServer` (HMR pattern).

That is a mini encrypted envelope, not Slack.

### Explicitly **not** v1

1:N / N:1, circulate/hold/versions, countersign, calendar, morning brief, boot listener while DSH is closed, DHCP doorplate gossip, attachments, 7-day retry policy, ledger ACL for the model, write-out command, semantic-os slips, “发现在线机器”.

---

## 6. Top gaps (code + platform)

1. **No plugin package.** Nothing to `dsh plugin add`. Next implementation cut is Host+Client skeleton, not more HTML.
2. **No LAN transport.** Official web is loopback-only by design. Need a second, authenticated listener. New attack surface.
3. **No pairing / identity / crypto.** `anonymous-user-id` is telemetry, not a peer. Product must mint stable ids + shared secret.
4. **No disk mailbox.** Cannot hang state on new `SessionEvent` types.
5. **No human notification API.** Overlay / dock / tab must be drawn. `SessionInput.notify` is not a badge.
6. **Cannot paste a silent colleague bubble.** `followup` wakes the model; `inject` is invisible until claimed. “只收下 / 按他说的做” is a product requirement, not an official API.
7. **No presence / discovery / multi-user.** Doorplate + “在线” are product-layer. Official LAN flags are a rebinding fence.
8. **Full story vs empty tree.** Demo already specifies 1:N, hold, boot listener, encryption, 7-day fail, morning brief, calendar. None of that exists. `ctx.remote` / Settings page are closed to out-of-tree plugins (`settings-not-exposed`).

---

## 7. Drift vs the old note (small)

| Old note | Now |
|---|---|
| Cited `/workspace/deepseek-harness` TS + `docs/subsystems/web-server.md` | Published 0.1.0-rc.6 `lib/` + README. Same contracts; those exact files are gone. |
| “树外没有 `ctx.remote`” | `ctx.remote` exists for **first-party allowlisted** remotes. Tree-external still cannot add one. Use prefix HTTP. |
| “没有 toast / notify” | Still no product/OS notify. Composer `SessionInput.notify` is local chrome only. |
| `inject` “领取前不渲染 (`placement: 'context'`)" | Still true; placement lives on `session/queue`, not as a field of `inject()`. |
| semantic-os sidecar “仍绑回环” | Still true (`bootstrap.py` `bind(("127.0.0.1", …))`). |

None of that changes the architecture: **sidecar or Host-owned LAN HTTP + product mailbox + dual UI**.

---

## 8. Short answers

- **Can it be built?** Yes, as a **partial** product: paired LAN mailbox + self-drawn secretary UI + optional live `followup`. Not as a 50-line plugin, and not the whole `推广.md` in one cut.
- **Smallest shippable slice?** Two machines, one manual pair, one encrypted request/reply, dock + overlay, “只收下” by default, “按他说的做” only on an explicit click that may `followup`.
- **Top 8 gaps?** No plugin package; no LAN listener; no pairing/crypto; no mailbox; no human notify API; no silent transcript write; no peer identity/discovery; full demo feature set unimplemented.
