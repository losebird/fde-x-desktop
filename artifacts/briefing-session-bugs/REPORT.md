# 早报和会话列表的三个根因

结论先写在这里。三条都在 `test/mac-all-next` 的 `e3776ba3706e98587f144f475ba8f66dfd2b7d9d` 上复现了。没有改产品代码，没有开 PR。

1. 早报把「能调用」定义成会话日志里已经写下的工具名。新建的 `fde-briefing` 会话还没有任何一轮模型请求，日志里没有 `request/header`，门在 8 秒后拦住 `mcp__mail__imap_search` 和 `mcp__ai-hot__aihot_get_latest`，两条的条数都是 0，prompt 不会发出。假 MCP 自己能回答 `tools/list` 和 `tools/call`。配置写在 `profiles/fde-x/cordis.patch.yml` 里并且 Host 上这两台是 `loaded`，都改变不了这个门。
2. 早报用 `session/create` 建会话，这条路径不发 `ai.session.changed`。会话页也不订阅这个事件。REST 创建会发事件，列表照样要整页刷新才变。两层都断了。只补一层，用户看到的列表还是不动。
3. 切工作区会清掉 store 里的当前会话，地址栏里的 `chatId` 仍赢。旧会话不在新工作区的可见列表里时，外壳直接 return，不向 iframe 发 `select`。iframe 的 hash 留在旧会话。Host 有能力打开另一条会话，外壳没有请它打开。

`throughput checkpoint: n/a, read-only investigation`

## 问题 1。重要邮件和行业资讯报会话未投影

### 根因

「会话未投影」出在 `runtime/briefing/ask-ai.mjs` 第 62 行。

```61:63:runtime/briefing/ask-ai.mjs
      if (!tool || !projected.includes(tool)) {
        blocked.push({ id: block.id, error: tool ? `会话未投影 ${tool}` : '缺少 tool' })
        continue
```

这里的「会话投影」是 `runtime/routes/mcp.mjs` 第 54 到 66 行和第 87 到 107 行读到的名字。`listSessionProjectedToolNames` 只跟 `session/follow` 的第一帧 snapshot。名字来自 `frame.header.tools`，以及 records 里 `request/header` 的 `header.tools`。`cordis.patch.yml` 里 insert 并且 enable，不在这个集合里。

`runtime/briefing/run.mjs` 第 143 行调用 `resolveBriefingSession`。`runtime/briefing/session.mjs` 第 27 到 35 行复用或新建 `agentPreset` 为 `fde-briefing` 的会话。新会话还没有模型回合。DSH `0.2.0-rc.2` 的会话线头不含 tools。tools 要等 agent loop 组请求时才写成 `request/header`。门在 `ask-ai.mjs` 第 47 到 54 行空等默认 8000 毫秒，第 69 到 71 行在一个 mcp 区块都进不了 prompt 时直接返回。写 header 的那次 `session/prompt` 因此不会发生。下一次早报复用同一条空会话，再次失败。

这是先把「日志里还没有 header」当成「工具不可调用」。空 header 对一条刚建的会话是合法状态。拦住它的那一行才是错的决定。

IUI 门在 `runtime/mode-policy.cjs` 第 2 到 3 行，只拿掉 `iui:fence`、`get_trip_stop_images`、`get_place_images` 和技能 `iui`。它不碰 `mcp__` 名字。实机状态里的 `lastError` 写着 lan-assist、semantic-os、iui 挂载失败，两栏错误仍然是上面这两句。见 `artifacts/briefing-session-bugs/page-repro.json`。

设置抽屉的工具名单走另一条会话。`src/components/briefing/BriefingSettingsDrawer.tsx` 第 95 行调用 `listBriefingMcpSources`，请求是 `GET /api/v1/briefing/sources/mcp`。`runtime/routes/briefing.mjs` 第 228 行带 `project: true`。`runtime/routes/mcp.mjs` 里的 `resolveMcpProjectionSession` 转到 `resolvePrimarySessionForRuntime`，读的是该 cwd 最新的 primary 会话，不是 `fde-briefing`。用户可以在主会话的投影里点到这两个工具名，运行时检查的却是早报会话的 snapshot。

### 引入的提交

用户能点出来的那条空早报会话来自 `c0227143951200e1c6e346dd63cdf2b05c936ee2`，说明是 `feat(briefing): open a dedicated fde-briefing session`。作者时间 2026-10-16，提交时间 2026-10-17。它不在 `origin/main`。`origin/main` 的 `runtime/briefing/run.mjs` 第 142 行仍调用 `resolvePrimarySessionForRuntime`。

门上的那句文案来自 `b0cbb6b26736cde3785fa630fb00f7c7b754d74e`，2026-10-07，`feat(runtime): occupancy for MCP, skills, briefing, and workspace cwd`。这一笔在 `origin/main` 上。main 上如果主会话也还没有 `request/header`，同一扇门会拦住。这次用户看到的新 `fde-briefing` 会话是 `c02271439` 带来的。

### 红的证据

- `artifacts/briefing-session-bugs/desired-behavior-red.txt`。`node --test scripts/repro/briefing-session-desired.test.mjs` 退出码 1。断言期望错误是空字符串，实际是 `会话未投影 mcp__mail__imap_search`。
- `artifacts/briefing-session-bugs/bug1-inprocess.json`。假 MCP 的 `tools/list` 返回 `imap_search` 和 `aihot_get_latest`，`tools/call` 返回 `fake-mail-item` 和 `fake-news-item`。投影名单是 `[]`。`session/prompt` 没有被调用。事件只有 `briefing.ready`。
- `artifacts/briefing-session-bugs/page-repro.json`。真实 BFF `4318`、Vite `5174`、DSH `0.2.0-rc.2`。两栏错误和条数 0 与用户原文一致。早报会话 `session-c5ec8651-9922-484a-b43b-bb7118123e75`，preset 是 `fde-briefing`。
- `artifacts/briefing-session-bugs/mcp-servers.json`。`mail` 和 `ai-hot` 的 `disabled` 是 false，`status` 是 `loaded`。这个接口的 `tools` 数组是空的，因为 `GET /api/v1/mcp/servers` 调用 `collectBag` 时没有 `project: true`，`runtime/catalog-collect.mjs` 第 546 到 550 行因此把投影名单留成空数组。它不能当成「会话 snapshot 里没有工具」的证据。空 snapshot 的证据是进程内那次 `session/follow`，以及实机早报仍报这两句。
- `artifacts/briefing-session-bugs/cordis.patch.yml`。临时 HOME 里的 insert 配置，没有邮箱凭据。

重跑进程内证据用 Node 22.23.3。

```bash
/home/ubuntu/.nvm/versions/node/v22.23.3/bin/node scripts/repro/reproduce-briefing-session-bugs.mjs
```

脚本在复现到这两句错误时退出码 0。期望行为的测试退出码不是 0。

### 修法

这三条都不删用户的 MCP 配置，也不把 221 个工具常驻进会话前缀。

**按区块直接调用。** 早报对 stdio 走和 `callMcpHttpTool` 同一类的 initialize 加 `tools/call`。参数用区块上的 `params.args`。会话只留下 AI 摘要和 `fde_briefing_submit`。工具不进会话前缀，和按需加载、按对话模式裁剪都顺着。模型不负责填 MCP 参数，参数必须已经写在区块上。

**先发 prompt，再等 header。** 拿掉发 prompt 之前的投影门。一轮模型请求会把 header 写进日志，下次投影能看见。`fde-briefing` 预设是标准编码预设的拷贝，再叠 Host 上已加载的 MCP，这一轮仍会付那份大约 62K token 的前缀。这和要消掉的前缀膨胀对着干。

**只为这一轮组装那两个名字。** 这一轮的工具清单只有区块点名的工具加上 `fde_briefing_submit`，回合结束不留在会话里。这和按需加载、按模式裁剪是同一件事。Host 现在没有「只为这一轮装上这两个工具」的接口，要先有这个接口。用户配置仍留在 patch 里。

## 问题 2。新会话不进列表

### 根因

事件在两层都丢了。

早报创建在 `runtime/briefing/session.mjs` 第 33 到 35 行，`aiRuntime.call('session/create')` 之后没有 `emit`。`runtime/briefing/run.mjs` 第 214 行只发 `briefing.ready`。会发 `ai.session.changed` 的创建口是 REST，`runtime/server.mjs` 第 1993 到 1998 行。

会话页 `src/pages/AI.tsx` 第 414 到 468 行只在进页时拉一次列表。第 492 行的 `useEvents` 只订了 `memory.engine.changed`。没有 `ai.session.changed`。iframe 的 `fde-x-dsh-ready` 会再拉一次，早报创建不走这条消息。外壳列表是侧栏「会话」，Host 侧栏在 `dsh-core.patch.yml` 里关着。这个列表不需要 Host 先收到事件。BFF 没发，外壳就算订了也收不到早报那次。外壳没订，REST 那次发出去了列表也不动。

### 引入的提交

早报这条不发事件的创建是 `c0227143951200e1c6e346dd63cdf2b05c936ee2`。它不在 main。main 的早报不新建这条会话，所以「点生成新早报后列表缺一条」在 main 上没有同一条触发。

外壳不订阅是更早的缺口。`src/pages/AI.tsx` 第 492 行从 `b0cbb6b26736cde3785fa630fb00f7c7b754d74e` 起就只订记忆事件。REST 发事件从 `bdacd5ada95ebc2849cbbe1885f4789aae1b480e`，2026-10-07，`feat(runtime): occupy current-turn, letter home, restore, and origin land`。这两笔都在 main。实机里 REST 创建已经把事件写进出站表，侧栏条数仍不变，刷新后才加一。main 上同样的外壳缺口还在。

`GET /api/v1/ai/sessions` 在 `runtime/server.mjs` 第 1929 行调用 `session/list` 时没有把 `includeBlank` 放进 `_request`。实机列表仍返回了 `blank: true` 的会话，刷新后侧栏条数也增加了。这一处参数没传下去，不是这次「不刷新就看不到」的原因。

### 红的证据

- `artifacts/briefing-session-bugs/desired-behavior-red.txt` 第二条。期望出站里有 `ai.session.changed`，实际没有。
- `artifacts/briefing-session-bugs/outbox-events.json`。早报会话 `session-c5ec8651-9922-484a-b43b-bb7118123e75` 不在任何 `ai.session.changed` 行里。`briefing.ready` 有两行。REST 创建的会话 id 都有 `kind` 为 `created` 的行。
- `artifacts/briefing-session-bugs/page-repro.json` 的 `list`。工作区 repro-a 上，创建前 5 条，创建后仍是 5 条，SSE 看到了这次 REST 创建，刷新后是 6 条。
- `artifacts/briefing-session-bugs/page-list-follow.json`。另一轮是 6、6、7。
- 截图 `list-on-workspace-a.png`、`list-after-create-no-reload.png`、`list-after-reload.png`。刷新前侧栏是 3 条或 6 条的那一帧，刷新后多一条。具体张数以同目录的 json 为准，后一次脚本覆盖了截图。

### 修法

禁止用整页刷新捎过去。只加监听不够，早报今天不发这个事件。只在早报路径上 emit 也不够，页面不听。

**创建和监听一起补。** `resolveBriefingSession` 在建成新 id 后发 `ai.session.changed`，载荷沿用 REST 的 `kind: created`。`AI.tsx` 订阅这个类型，把这条插进 `remoteSessions` 或再拉一次列表。两处都要有。已有会话被复用时不发 created。

**早报改走 REST 创建口。** `POST /api/v1/ai/sessions` 已经会 emit。早报改为调用这一个口，创建只有一处。页面监听仍然要加，否则实机里已经证明 REST 事件到不了侧栏。

**让 Host 再通知外壳一次。** iframe 里看到新会话再 `postMessage`。外壳列表的数据源是 BFF，Host 侧栏又是关的。这条多一条通道，早报创建仍要先让 BFF 知道。前两条更短。

## 问题 3。切工作区后会话页不跟着切

### 根因

丢在外壳，发生在任何消息发给 iframe 之前。

`src/store/app.ts` 第 370 到 382 行的 `setActiveWorkspace` 把 `activeAiSessionId` 置空。`src/pages/AI.tsx` 第 137 到 145 行的 `wantedSessionId` 先用地址栏 `chatId`。第 470 到 472 行又把这个 id 写回路由。第 120 到 126 行按 cwd 过滤 `visibleSessions`，旧会话不在新工作区的列表里。第 569 到 572 行找不到 row 就 return，`tellDsh('select')` 不会发。第 518 到 533 行在 iframe 的源地址没变时保留原来的 hash，hash 仍是旧会话。

Host 的 `select` 在 `runtime/fde-x-dsh-bridge/lib/client.js` 第 387 到 411 行可以 `ui.openSession`。外壳没有发。第二道闩在同一文件第 222 到 251 行和第 265 到 275 行。hash 里的旧 id 放进 `pendingSelectId`，`pickExisting` 先返回它，`connectWorkspace` 因此不会去选新工作区里更新的那条。BFF 不保存「当前工作区」，切换是浏览器里的 store。

实机截图里 Host 卡片一直是 “Choose a workspace to start”。这次会话只用 cwd 创建，没有挂进 DSH workspace 的 sessionIds，所以我不用这块卡片证明「正在看会话 A」。证明是外壳自己的数。切到 repro-b 之后，按钮标题是「当前工作区: repro-b」，侧栏条数从 6 变成 2，地址仍是 `/ai/<会话 A>`，iframe `src` 的 hash 仍是会话 A，不含会话 B。见 `page-list-follow.json` 和 `workspace-switch.png`。

### 引入的提交

`src/pages/AI.tsx` 第 569 到 579 行的提前 return，以及 `client.js` 里的 `pendingSelectId`，都从 `a8449148526f393219d9d66bdfd24e16f86a3416` 起就在，2026-09-17，`baseline: FDE-X workstation as of 2026-09-16`。`activeAiSessionId` 置空也在这一笔。cwd 过滤和 `chatId` 优先在 `b0cbb6b26736cde3785fa630fb00f7c7b754d74e`。main 的 `src/pages/AI.tsx` 第 572 行仍是 `if (!row) return`，第 137 行仍是同一个 `wantedSessionId`。问题 3 在 main 上就有。

### 红的证据

- `artifacts/briefing-session-bugs/page-list-follow.json`
- `artifacts/briefing-session-bugs/page-repro.json` 的 `workspace`
- `artifacts/briefing-session-bugs/workspace-switch.png`

页面脚本要 BFF 4318 和 Vite 5174 已经起来，并且 `/api/v1/ai/status` 的 `connected` 为 true。

```bash
/home/ubuntu/.nvm/versions/node/v22.23.3/bin/node scripts/repro/page-list-follow.mjs
```

工作区切过去了、地址和 iframe hash 还留在旧会话时，脚本退出码 0。

### 修法

同样不能整页刷新。也不能把旧会话 id 配上新的 workspaceId 再发 select，那会把旧会话绑到新工作区。

**cwd 对不上就改路由。** 当前工作区的 cwd 变了，而地址栏这条会话的 cwd 不是它，就改去这个工作区最新的一条 primary 会话，并 `tellDsh('select')` 那个 id。列表、地址、iframe 三处用同一个 id。

**清掉待选 id，让 Host 自己挑最新一条。** 切工作区时清 `pendingSelectId`，让 `pickExisting` 走到工作区 sessionIds 里最新的那条。外壳仍要改路由。hash 不改的话，第 518 到 533 行会把旧 hash 留住，Host 下次加载又把它写回 `pendingSelectId`。

**只放行原来的 connectWorkspace。** 拿掉 `pickExisting` 那个短路，把新 workspaceId 交给 Host。Host 可以连上新工作区。外壳地址栏仍指向旧会话，侧栏过滤和 iframe hash 还是旧的。这一条单独做不完。

## 这条链路怎么走

早报全量运行先 `resolveBriefingSession`，再 `runBriefingAgent`。MCP 区块的工具名要先出现在会话 snapshot 里，才会写进 prompt。prompt 要求模型调用这些工具，并在结束时调用 `fde_briefing_submit`。AI 摘要区块不经过这扇门。页面上的失败文案在 `src/pages/Briefing.tsx` 第 268 行，按钮文字是「生成新早报」。

会话列表的数据来自 `GET /api/v1/ai/sessions`。事件流是 `GET /api/v1/events`。外壳用 `postMessage` 类型 `fde-x-dsh` 跟 `/dsh-app/` iframe 说话。

## 取舍

| 问题 | 方向 | 和现有结构的关系 | 留下的缺口 |
| --- | --- | --- | --- |
| 早报 MCP | 按区块直接 `tools/call` | 工具不进会话前缀 | 参数必须在区块上 |
| 早报 MCP | 先 prompt 再读 header | 会付整份预设加已加载 MCP 的前缀 | 和 62K 前缀那件事对着干 |
| 早报 MCP | 只为这一轮装点名的工具 | 和按需加载是同一件事 | Host 还没有这个接口 |
| 列表 | emit 加订阅 | 复用已有事件名 | 两处都要改 |
| 列表 | 早报走 REST 创建 | 创建只留一个口 | 页面订阅仍要加 |
| 列表 | Host 再通知外壳 | 多一条通道 | 早报创建仍要先过 BFF |
| 切工作区 | 改路由到新 cwd 的最新会话 | 列表、地址、iframe 用同一个 id | 要定「最新」用 `updatedAt` |
| 切工作区 | 清 `pendingSelectId` | Host 现成的挑选能生效 | 外壳路由不改则 hash 还是旧的 |
| 切工作区 | 只放行 `connectWorkspace` | Host 能连上新工作区 | 地址栏和侧栏仍是旧会话 |

这次用了五条原则。Fix Root Causes 把第一处错决定定在投影门和「找到 row 就 return」，没有用吞掉错误来换一条绿的早报。Prove It Works 用真实 `runBriefing`、真实 BFF 和页面侧栏条数，不用编译通过当结果。Build the Lever 把复现收成 `scripts/repro`，复查的人可以再跑。Attack the Premise 先写下「不在会话投影里就不能调用」，再用一个能回答 `tools/list` 的假服务和一个没有 header 的新会话去测，门仍然拦住。Guard the Context Window 把 blame 和出站表留在 `artifacts/briefing-session-bugs/`，正文只留结论和行号。
