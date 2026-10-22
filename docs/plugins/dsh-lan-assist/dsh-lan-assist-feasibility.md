# DSH LAN 协助：可行性（不做实现）

依据只读源码 `/workspace/deepseek-harness` 与 `/workspace/dsh-ext-dev-guide.md`。不发明 API，不改 DSH。树外插件 = Host + Client；`ctx.webServer.register({kind:'prefix', path})` 只对本实例浏览器同源；树外没有 `ctx.remote`。

## 1. 一句话结论

**部分可行，不能纯插件：必须自建 LAN 传输（sidecar 或 Host 另开的 Node HTTP/WS）+ 产品邮箱 + 双面 UI。** 官方 DSH 是单用户本机 harness，不是两个实例之间的信使。

## 2. 用户故事 → 真实 API（或「我们自己写的产品邮箱」）

| 步骤 | 真实能力 | 不是什么 |
|---|---|---|
| A 发出「需要 B 协助」 | Host `ctx.tools.register(defineTool({name:'ask_colleague'}))`，`execute` 里有 `exec.agent`（当前会话）。或 `ctx.commands.register` 斜杠命令（不经模型）。 | 没有官方「同事」命令。 |
| A 的 DSH → B 的 DSH | **产品邮箱 / 我们写的 LAN HTTP。** 官方 `ctx.webServer` 通常绑 `127.0.0.1`，对面机器打不到。 | 不是 `ctx.remote`，不是官方 mDNS。 |
| B 看到通知 | **没有官方 toast / OS notify。** Client 自绘：`shell.overlay`、`conversation.view` 页、`conversation.input.dock`、`sidebar.footer.action`。 | 不要编 `ctx.notify` / `setView`。 |
| B 在自己的 DSH 回复 | 插件 UI（协助页 / dock）→ 本机 Host → 回打 A 的 LAN 口。也可开一条本机会话当草稿。 | 不是官方群聊。 |
| 注入 A 的原会话 | 仅当该会话 **live**：`ctx.agents.get(sessionId)` + `agent.followup(createUserMessage({source:{kind:'plugin',...}}))`。冷会话先 `ctx.agents.resume`。`inject()` 不唤醒，且 **领取前不进聊天表面**。 | 不能诚实写成 assistant/system；树外不能登记新 SessionEvent。 |
| A 收到通知 | `followup` 之后官方 `/api` WebSocket `session/event` 会刷新打开的 Chat（无需整页 reload）。「提醒」本身仍要插件 overlay/dock。 | 没有官方角标/系统通知。 |

## 3. 源码六问（路径 + 摘录）

### 3.1 绑定地址

`dsh --profile web` 默认 `127.0.0.1:3080`。CLI **拒绝** `--host 0.0.0.0`。`ctx.webServer` 就是这一台 `node:http`。插件可在其上 `register` / `registerUpgrade`（含 SSE），但继承同一 bind。schema 允许 `0.0.0.0`，启动器不让走这条路。插件用 Node `http` / sidecar 另开 LAN 口是进程能力，不是 DSH 产品 API。

```68:79:deepseek-harness/packages/bundle/web-app/src/startup.ts
    if (options.host === '0.0.0.0') {
      program.error('error: --host 0.0.0.0 is intentionally not supported yet for safety: it would expose remote code execution to the network; use 127.0.0.1 instead')
    }
    // ...
    ctx.provide(WEB_STARTUP_SERVICE, {
      ...options.host !== undefined && { host: options.host },
      ...options.port !== undefined && { port: Number(options.port) },
      trustedHosts: options.trustedHost ?? [],
    } satisfies WebStartupValues)
```

```115:120:deepseek-harness/packages/bundle/web-app/cordis.patch.yml
    - id: webserver
      name: '@deepseek-ai/dsh-host-webserver'
      inject: [webStartup]
      config:
        host: !!js ctx.webStartup.host ?? '127.0.0.1'
        port: !!js ctx.webStartup.port ?? 3080
```

```44:49:deepseek-harness/docs/subsystems/web-server.md
`host` accepts only `127.0.0.1` (default posture) and `0.0.0.0` (deliberate network exposure); there is no TLS, auth, or origin policy, so a non-loopback bind exposes the server to that network.
```

semantic-os 先例：Host `child_process.spawn` sidecar，**sidecar 仍绑回环**，浏览器只打同源 `ctx.webServer` 前缀。LAN 协助若要对面机器可达，sidecar/自建 HTTP **必须**绑局域网，这是新攻击面。

### 3.2 通知

搜过 `toast` / `notify` / `badge` / `inbox` / `ctx.effect`：**没有**插件可调的官方 toast / 系统通知 / 角标 / 收件箱。`ctx.effect` 是 Cordis 卸载 disposer。InputBar toast 是输入栏私有 state。`inbox` 是 **Agent 待处理队列**，不是人的消息箱。

插件能用的可见面（Client slot）：

```73:83:deepseek-harness/packages/client/ui-layout/src/client/index.ts
    /**
     * Frame-wide floating layer, above every column and outside their scroll
     * containers. Deliberately generic and unowned by any feature: a badge, a
     * toast stack or a status pill all belong here, and entries order among
     * themselves.
     */
    'shell.overlay': { kind: 'list'; scope: 'root' }
```

另有 `conversation.view`（整页 tab）、`conversation.input.dock`、`conversation.session.header.actions`、`sidebar.footer.action`、`conversation.composer`（接管输入栏）。这些都要自己画。

### 3.3 注入指定会话

有 live Agent 就能写 **用户角色** 入队，没有「往任意会话追加一条 assistant/system 同事回复」的官方方法。

```583:605:deepseek-harness/packages/core/agent/src/index.ts
  get(id: SessionId): Agent | undefined {
    return this.store.get(id)?.agent
  }
  // ...
  list(): Agent[] {
    return [...this.store.values()].map(entry => entry.agent)
  }
```

```122:132:deepseek-harness/packages/core/agent-loop/src/agent.ts
  followup(input: UserMessage): void {
    this.send(input, 'next-turn', true)
  }
  steer(input: UserMessage): void {
    this.send(input, 'next-step', true)
  }
  inject(input: UserMessage): void {
    this.send(input, 'next-step', false)
  }
```

```67:70:deepseek-harness/packages/core/agent/README.md
- `agent.followup(message)` — queue an ordinary `next-turn` message and wake the driver.
- `agent.inject(message)` — queue non-waking `next-step` context. ... idle driver leaves it pending until `followup()` or `steer()` wakes the driver.
```

- `get` 只看 **本进程 live** 表。冷会话：`ctx.agents.resume`（真实 API），不能对磁盘日志直接改。
- `followup` 会 **唤醒** A 的模型，把 B 的话当成又一轮 user。
- `inject` 的 context **领取前不渲染**（`placement: 'context'`）。
- `session.append('assistant/message')` 需要 turn/step，那是 loop 的账，插件硬写等于伪造历史。
- 树外新事件类型：**登记面官方推迟**；persistence 不认 `KNOWN_SESSION_EVENT_TYPES` 以外的类型（除非 `ignorable`）。

```8:17:deepseek-harness/packages/core/session/src/known-event-types.ts
 * Every `SessionEventMap` member declared in this repository — the event
 * vocabulary this build understands. The persistence read path refuses to
 * interpret a log containing a type outside this set unless the event
 * carries the envelope's `ignorable` marker
 * Downstream (out-of-repo) plugin events are outside this list by
 * construction; a registration surface for them is deferred until such a
 * consumer exists.
```

诚实路径只有两条：live `followup`（插件来源的 user 消息），或 **产品邮箱 + 自绘节点/页**（不进官方 transcript）。

### 3.4 身份 / 在场

每个 DSH **严格单用户本机**。`anonymous-user-id` 是 `~/.dsh` 里一颗随机 UUID，给遥测用，不是局域网同伴。没有 multi-user、peer、mDNS、「另一台 DSH」。文档里的 LAN 是浏览器 DNS rebinding 栅栏（`--trusted-host`），不是发现协议。`/api` **没有认证层**。

```1:9:deepseek-harness/packages/identity/anonymous-user-id/src/index.ts
 * Per-harness-home anonymous user id shared by telemetry and feedback.
 * The id is a random UUID persisted as a bare line in `.anonymous-user-id`
 * ... never derived from the hostname, network address, git remote
```

### 3.5 工具当 A 侧触发

可以。Host 平面 `insert` 的工具对所有会话可见。`exec.agent` 就是 A 的当前会话。斜杠命令走 `ctx.commands.register`，不经模型。

```17:34:deepseek-harness/docs/cookbook/adding-a-tool.zh.md
export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'read_file',
    // ...
    async execute(args, exec) {
      return readFile(args.path, { encoding: 'utf8', signal: exec.signal })
    },
  }))
}
```

```49:49:deepseek-harness/docs/cookbook/adding-a-tool.zh.md
- **使用 `exec.agent` 发送异步通知。** `agent.inject({ content, source: { kind: 'plugin', plugin: '<name>' } })` 追加持久化上下文
```

### 3.6 Client 不刷新能否更新

能。官方两条只下行 WebSocket：`/api/events.mux`、`/api/events.host`。Host 对 live session `followup` 后，打开页走 `session/event` / `session/queue`，不必 reload。插件也可在 `ctx.webServer` 上自挂 SSE（HMR 就是这样），只服务 **本实例** 浏览器。

```11:13:deepseek-harness/packages/client/connection/README.zh.md
`/api/events.mux` 与 `/api/events.host` 各接受一条 WebSocket upgrade，并只向浏览器发送对应的 `ServerRequest` 文本消息；客户端不会在这些 socket 上发送业务数据。
```

```69:79:deepseek-harness/packages/host/apiproxy/src/api/events.ts
export type MuxFrame =
  | { type: 'session/event'; sessionId: SessionId; event: SessionEvent; view?: ToolEventView }
  | { type: 'session/subscribed'; sessionId: SessionId; lastSeq: number }
  // ...
  /**
   * Complete transient inbox state after every enqueue, mutation, claim, or
   * discard.
```

```165:178:deepseek-harness/packages/client/hmr/src/index.ts
    const disposeRoute = ctx.webServer.register({
      kind: 'exact',
      path: EVENTS_ENDPOINT,
      handler: (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.writeHead(405)
          res.end()
          return
        }
        connect(res)
      },
    })
```

树外没有 `ctx.remote`；本机 Host↔Client 用同源前缀 HTTP/SSE，不要伪造 Remote 白名单。

## 4. DSH 做不到的（产品约束）

- 官方 web **钉回环是功能**，不是疏忽。把 `ctx.webServer` 改绑 `0.0.0.0` = 把无认证 RCE 面暴露到局域网。
- 没有官方 notify / toast / OS 通知。
- 不能把「B 的话」写成 assistant/system 塞进 A 的原线程；树外也不能加新持久事件类型。
- 没有「另一台 DSH」、没有在场、没有 mDNS。
- B 的 DSH 必须在跑且插件已加载，否则只能落 **磁盘邮箱**，B 上线再读。
- LAN 不可信：必须配对 / 共享密钥。不要建议无认证开放端口。

## 5. 若要做：最小诚实架构

这是 **迷你 Slack**，不是 50 行插件。

```
A 浏览器 ──同源── A Host ──配对+密钥── LAN ── B Host ──同源── B 浏览器
                │                              │
                └── 磁盘邮箱 ~/.dsh/...  ───────┘
```

1. **配对**：手输 IP:port + 一次性配对码，派生共享密钥（HMAC/Bearer）。不做默认 mDNS；若以后做发现，也只是产品层，DSH 不提供。
2. **LAN 口**：Host 用 `child_process.spawn` sidecar，或 Host 自己 `http.createServer` 绑局域网。只接配对过的对端。**不要**把官方 `/api` 暴露出去。
3. **邮箱**：请求/回复落本机磁盘（A 的 `sessionId`、正文、状态）。对端离线可投，上线再投递。
4. **A 触发**：`ask_colleague` 工具或 `/ask-b` 命令；记下 `exec.agent.id`。
5. **B 提醒**：Client `shell.overlay` + 一颗 `conversation.view`「协助」页。
6. **写回 A**：A 会话仍 live → `followup`（并在文案里写明「这会唤醒你的 agent」）；否则邮箱 + overlay，用户点开再 `resume`+`followup`。不要伪造 assistant 行。
7. **本机刷新**：写回走官方 mux；邮箱角标走插件 SSE（HMR 同款，挂在本机 `ctx.webServer`）。

## 6. 代价

- 安全：新 LAN 监听 = 新攻击面；密钥、重放、配对过期都要自己做。官方 web 无认证，绝不能复用。
- 双方都要在线才实时；离线只剩磁盘邮箱。
- 不是群聊、不是 Slack：两人、一条请求/回复链、单用户 DSH 各守各的会话。
- `followup` 会叫醒 A 的模型；若只要「把字贴进线程」，官方做不到不唤醒又立刻可见。
- rc 会破兼容；树外 Remote/设置页白名单走不通（`settings-not-exposed`）。

## 7. 判定对照

| 用户原话 | 判定 |
|---|---|
| A 发指令要 B 帮忙 | 可以（工具或斜杠命令） |
| A 的 DSH 发到 LAN 上 B 的 DSH | 官方通道没有；sidecar/自建 HTTP 可以 |
| B 收到通知 | 无官方 notify；自绘 overlay/tab |
| B 在 DSH 里回 | 插件 UI，可以 |
| 回写 A 原会话 + A 通知 | 仅 live user-role `followup` + 自绘提醒；不能当同事气泡静默贴上 |
