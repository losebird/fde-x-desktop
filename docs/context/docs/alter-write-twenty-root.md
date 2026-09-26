---
cursor:
  subagentId: "bc-351a5ec9-38ea-54cc-9a75-2c3de694578b"
---

# 同一会话先建后改：过账插了新行，右边变成要改 20

会话 `session-5910c15c-599e-4673-ba7b-cf159e5ea7e3`，工作区 `/Users/zxz/Documents/ai-project/fdex测试`。日志 `~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-5910c15c-599e-4673-ba7b-cf159e5ea7e3/session.v3.jsonl.zstd`。只查因，未改产品。

人口中的 `388468519099904` 是位数记岔了。库里、审计、jsonl 都是 `388468591099904`（591）。新行是 `388469352366080`。

## 两行对上令牌

过账插进了 `388469352366080`，原来那张 `388468591099904` 停在新建当时。

| | 新建当时还在 | 这次「改」插进去的 |
|---|---|---|
| id | `388468591099904` | `388469352366080` |
| createdAt = updatedAt | `2026-09-24 14:30:59.241+00`（本地 22:30:59） | `2026-09-24 14:37:02.215+00`（本地 22:37:02） |
| 库里的值 | title `测试新增功能`，priority `high`，assigneeId `1`（users.nickname `Ace Admin`，username `admin`），ticketNo / category / description / customerId / contactId 空 | ticketNo / title / priority / status / assigneeId 空，category `consulting`，description `测试使用AI会话新增功能是否正常`，customerId `371066454802432`（`武汉光谷生物科技有限公司`，`CUST-019`），contactId `371066469482496`（`马浩然`） |
| 审计 | `bwa_2006cf20e7e64e3c8bd2e2920c361332`，22:30:59.435，action `新建`，record_no `新单`，receipt 这张 id | `bwa_a3f6e55eb8814ad997f184ad6c70b858`，22:37:02.346，action `新建`，record_no `新单`，receipt 新 id |
| 令牌 | `pv_105040b2c42471e7`（seq 65，浮面 22:30:48） | `pv_4cf05f81820e43d2`（账本 22:36:25 铸出，浮面 22:36:44 与 22:37:02，都是 1 行） |
| patch | 标题 `测试新增功能`，优先级 `高`，处理人 Ace Admin | 工单类型 `咨询`，联系人马浩然那条展示串，客户武汉光谷那条展示串，问题描述上面那句 |

`biz_write_audit` 没有 preview_id 列。令牌和回执是靠同一秒对上的：账本 22:36:25「预览令牌 · 工单 388468591099904 · pv_4cf05f81820e43d2」，22:37:02「写口回了 · 库里已改上：工单 388469352366080」。审计 lookup 的 speech 就是 seq 140 那句带旧号的话。HTTP body 字节未证。口语已经收成 id：现网 pending 的 cells 是 `category=consulting`、`contactId=371066469482496`、`customerId=371066454802432`、`description` 那句，和库里新行一致。

更早两张也是闸回的新建，没有进这次回执：seq 126 `pv_274e066d80487733`（no 被收成「类型」），seq 131 `pv_38974751e762434b`。这一会话只有上面两笔 `新建` 审计。

## 1. 改行被收成新建并 insert

根因：人话里问题描述含「新增」，`spokenWriteAction` 按 `WRITE_ACTIONS` 先碰到「新建」，把模型的「改行」盖掉，写口走 `:create`。

证据：

- seq 108 真人原话（`source.kind = user`）：「工单类型改成咨询，联系人是马浩然，客户是光谷生物，问题描述：测试使用AI会话新增功能是否正常」。这句话里没有工单 id。
- seq 125 / 130 / 140 模型参数都是 `action: 改行`、`no: 388468591099904`。三次结果都是 `action: 新建`，speak「将新建工单 新单」。
- `vocab/spoken.json`：「新建」的 say 含「新增」；「改行」的 say 含「改成」。`findClueHit` 是不锚定的正则，`sayIsBounded` 对非 ASCII 直接算成立，所以描述里的「新增」算命中。
- `slots.js` `WRITE_ACTIONS = ['删除','过审','新建','改行']`。`spokenAction` 按这个顺序返回第一个命中的动作。句里先有「改成」、后有「新增」，仍先返回「新建」。
- `recoverWriteIntent` 只在工具动作已是「现查」且工具 `no` 已有时提前返回。改行不走这条，1799–1801 行用口语动作覆盖 `next.action`。
- `write.js` 1137 行「新建」分支发预览令牌，不按旧号去 probe。`looksLikeTicket` 要求字母加数字，纯数字 id 不当票号，牌面 no 写成「新单」。`writeDest` 在动作为「新建」时 URL 是 `/api/${resource}:create`，POST，不带旧号 filter。
- 库：新行 createdAt = updatedAt = 14:37:02.215Z；旧行两枚时间都停在 14:30:59.241Z。

## 2. 要改 20

根因：seq 135 的现查被换成不含单号的人话，`no` 收成「类型」，闸列出最近一页 20 条；下一张新建预览把这 20 条收进 `remainRows`，过账成功后铺回同一张 `action: 新建` 的表，右边按非现查画成拟改。

证据：

- seq 135 参数：`action: 现查`，`no: 388468591099904`，speech「现查工单 388468591099904」。`tools.js` 同时把 `userSpeech` 设成 `lastUserSpeech`，也就是 seq 108 那句（提到工单、联系人、客户，且不含这个 id）。
- `pickHopSpeech`：人话提到的型比「现查工单 …」多，就用人话换掉模型这句。
- `recoverWriteIntent` 1780–1783 行保住「现查」，不把这下改成新建。接着 `attachSpeechIdentity`：speech 里有「改成」，id 不在这句里，`leftoverNameIdentity` 把 `no` 换成「类型」。
- seq 136 结果：`action: 现查`，`no: ""`，`lookupNo: 类型`，speak「这张单最近一页 20 条。第一张 TK20250211633」，`hitTotal: 399`，`pageSize: 20`，steps 是客户 → 工单。第一张是华东远见，不是光谷，也不是两张新 id。账本 22:36:08「现查进业务页 · 工单」。
- `gate.js` 400–410 行：后一张同型预览看见 `prevSheet.rows.length > 1`，把这 20 行放进 `remainRows`。当时浮面仍是 1 行确认（`bsurf_1017…` / `bsurf_bb41…`，`pv_4cf05f81820e43d2`）。
- `gate.js` 565–570 行：写成功且 `remainRows` 还有行，就 `{ ...sheet, rows: left, remainRows: left, no: '', canWrite: false, preview_id: '', changes: [] }`，不改 action。现网 `pendingSheet`：action `新建`，preview_id 空，canWrite false，no 空，changes 空，20 行，remainRows 20，`at` 仍是 22:36:25.096，speech 是 seq 140 那句，speak 仍是「将新建工单 新单」，cells 还是咨询 / 马浩然 / 光谷 / 那句描述。20 行里没有这两个 id。`hitTotal` 不在这张表上。
- 浮面 `bsurf_f624cf60505947ffa9d9f5c596a211b1`：22:37:25，action `新建`，preview_id 空，row_count 20。`sheet_json` 空，只有元数据。
- 右边文案在 `RecordsPanel.tsx` 1821–1824：动作不是现查就写「AI 拟改 ${kind} ${rows} 行 · 待确认」。来源标签 905 行是「连接器名 · ${action} ${HH:mm}」，所以是「新建 22:37」。页脚 94–112 行在没有 known 的 `hitTotal` 时写「总数未知」。

这 20 行不是 20 条改行 patch，也不是把现查页原样标成要改。现查页先进来，过账后被贴到新建牌上，牌的动作还是新建，横幅才写成拟改。

## 3. aborted

根因：22:37:24 整轮被 `session/cancel` 掐掉，DSH 把 kind 记成 `user`。两次现查在闸里已经落成空表，没有盖住那张 20 行。

证据：

- seq 151 是插件 follow-up「库里已改上…」，不是新的真人消息。turn 4 于 22:37:02 开始。
- seq 153 `biz_describe` 在 22:37:22.631 已成功。seq 154 现查新 id、seq 155 现查旧 id、seq 156 `biz_traces` 新 id，三条参数都带着 `no`。seq 158–160 在 22:37:24.137–138 一起 `Error: tool call aborted`（`AbortError` / `ABORTED`）。seq 162 `turn/end`：`{"kind":"aborted","reason":{"kind":"user"}}`。
- 账本 22:37:22 与 22:37:24 各一条「现查空表未覆盖 · 工单」。`shouldKeepPopulatedListSheet` 在上一张有行、新来的现查 0 行时返回 true，`previewBiz` 不换 `pendingSheet`，工具看到的是留下的那张表。
- `tools.js` 231–235 行 leftover 走 `live.cancel({ kind: cancelKind })`，`cancelKind` 来自 `session-round.js`，是 `plugin-leftover`。jsonl 不是这个 kind。`@deepseek-ai/dsh-api-session-controller` 的 `cancel()` 固定 `agent.cancel({ kind: "user" })`，请求里的 kind 被丢掉。工作台唯一进这条 RPC 的是 `RecordsPanel` 的 `cancelAi`（`runtime/server.mjs` 1807–1818 会把 kind 往下传，DSH 不采用）。
- 已落地的「回执带着身份、无筛选不掐回执」在 `isLeftoverAfterCandidate`：无筛选现查且 `candidate.wroteReceipt` 时不 cancel，并且那条路记账是 `plugin-leftover`。这次 jsonl 的 kind 是 `user`，不是那条路。
- 现网这张 20 行表过不了 `shouldAbortLeftoverAskForWritePreview`：要有 preview_id，还要 picked 或 `changes.length > 0`。这张 preview_id 空、changes 空。20 行浮面的时间是 22:37:25，晚于 abort。哪一次浮面或哪张 preview_id 在 22:37:24 穿过了这个闸，jsonl 和终端都没有 cancel 请求记录。未证。没有新人话，也不能记成有人按了停止。

## 上一层：先新建、再改刚才那张，两件事怎么叠上

同一句 seq 108 干了两件套在一起的事。

描述「测试使用AI会话新增功能是否正常」里的「新增」让三次改行预览都收成新建，人点的那张 `pv_4cf05f81820e43d2` 于 22:37:02 POST `:create`，插出 `388469352366080`。旧号 `388468591099904` 不动。

同一句又不含旧号，还同时提到工单、联系人、客户。seq 135 想现查焦点号时，`pickHopSpeech` 用它换掉「现查工单 388468591099904」，「改成」再把 `no` 收成「类型」，现查变成最近一页 20 条。这 20 条在下一张新建预览上被收成 `remainRows`，过账成功后铺回，动作仍是新建，右边就写成要改 20，页脚总数未知。

过账后的秘书句再开一轮现查。那两下在闸里已是空表（「现查空表未覆盖」），没有把 20 行换掉；整轮在 22:37:24 被记成 `user` 的 cancel 掐掉。20 行浮面比这次 abort 晚一秒。

## 重发后字段还是旧的

人点了确认。红条是这次改行写口在 HTTP 回 200 之后，拿旧单 `388468591099904` 读回对不上 patch。右边 20 行是点确认之前就在的那张新建列表，确认失败后被面板铺回去，不是这次写成功铺上的。

时序（同一会话，jsonl 在 23:22 之后又写过）：

- 23:12:10 seq 168 真人又发 seq 108 那句（仍含「新增」，仍不含旧号）。
- 23:13:54 `pv_9a9a04fba22a91ce`、23:19:12 `pv_80cd58ca0a204f55`、23:19:35 `pv_629717b58234f8a2` 三次模型参数是现查或改行，闸回的都是新建。没有审计，没有进库。
- 23:19:24 现查旧号成功，speak「不在你名下」，字段只有 title `测试新增功能`、priority `high`、assignee `Ace Admin`、`updatedAt` `2026-09-24T14:30:59.241Z`。没有工单类型、联系人、客户、问题描述。
- 23:20:38 turn 6 `turn/end` `OpenAI API error (502)` `upstream_network_error`。这轮在改行预览之后、确认之前断掉。
- 23:22:05 seq 283 真人「继续」。
- 23:22:33 seq 287 参数 `action: 改行`、`no: 388468591099904`、speech「继续改工单 388468591099904」（这句没有「新增」）。seq 288 结果 `action: 改行`、`preview_id: pv_946fff00b6b5e8d5`，changes 四格都是 from「未知」到咨询 / 马浩然 / 武汉光谷 / 那句描述。账本同时「预览令牌 · 工单 388468591099904 · pv_946fff00b6b5e8d5」。浮面 `bsurf_8f72d9773d734b2f8616f2172d25512d` 23:22:48，action 改行，1 行。
- seq 292 `biz_write` 这枚令牌，seq 293 `NEED_WORKSTATION_CONFIRM` /「请在右侧确认过账」。模型回合 23:22:48 结束，没有自己过账。
- 23:24:01 账本「写口拒了 · WRITE_FAILED · 表还在」，紧接着「业务事件开口 · 业务回了，但字段还是旧的。不能记已处理。」

### 红条

根因：`write.js` 1780–1789 行在改行令牌的 `postWrite` 已经 `res.ok` 之后，`patchApplied(token.patch, probe(token).fields)` 为假，固定写出这句。

证据：这句只在这个分支。`probe` 用的是令牌自己的 `no`，这张牌的 no 是 `388468591099904`，不是 `388469352366080`。牌上 cells 的写值是 `category=consulting`、`contactId=371066469482496`、`customerId=371066454802432`、`description` 那句。`patchApplied` 要求读回字段里有同名键且值相等；23:19:24 对这张旧单的读回没有这四个键。写前 `previewStillHolds` 只对指纹 `388468591099904:未知:2026-09-24T14:30:59.241Z`，对得上就放行，不看这四格。左边「未知 → 咨询」是预览 changes：`write.js` 190 行字段空就用状态「未知」当 from。闸 `speakBundleReceipt` 把这句送进业务事件。BFF `POST /api/v1/biz/write` 见 `written.ok === false` 就 400，正文用 `hint`/`speak`，`RecordsPanel.confirmWrite` 的 catch 用 `formatBizPanelError` 显示它。`insertBizWriteAudit` 在这之前就 return，所以没有新审计行。

写口去向：连接 `ticketField` 空，令牌 `mapped.fields` 是 `["ticketNo"]`，`writeDest` 对非新建是 `POST /api/biz_tickets:update?filter={"ticketNo":"<look>"}`，look 是旧号。这行 `ticketNo` 为空。请求字节未证。库：`388468591099904` 的 `updatedAt` 仍是 `14:30:59.241+00`。HTTP 被当成回了，行没有改。

`388469352366080` 现在 `biz_tickets` 里没有。这次读回和 filter 都没用它。谁删的，本会话 jsonl 和 `biz_write_audit` 里没有。未证。

### 点的是改行，库没有 update

根因：确认过账打的是 `pv_946fff00b6b5e8d5`，动作留在改行；写口没有改到旧单，也没有再插一行。

证据：23:24:01 的拒写紧挨这枚令牌铸出之后，中间没有别的预览令牌。speech「继续改工单 …」不含「新增」，`spokenWriteAction` 盖不掉改行。两张票：旧单时间停在 22:30:59；错建那张已不在表里，22:37 之后没有第三张 `createdAt`。审计仍只有 22:30:59 和 22:37:02 那两笔新建。

### 右边 20 行

根因：这 20 行在点确认之前就在面板上；确认失败后 `restoreRecordsList` 把那份快照铺回去。这次写没有成功，闸不会把 `remainRows` 铺上来。

证据：唯一的 20 行浮面仍是 22:37:25 的 `bsurf_f624cf60505947ffa9d9f5c596a211b1`（action 新建，preview 空）。23:11 没有新浮面，也没有账本换表；来源钟点是 `applySheet` 不带 `surfacedAt` 时用当时钟点，所以会写成「新建 23:11」。哪一次重画落在 23:11，未证，但它早于 23:22:33 的改行预览和 23:24:01 的确认。改行牌自己是 1 行，`remainRows` 空。`gate.js` 565–570 行只在 `ok` 时把 `remainRows` 铺回；这次走 575–578 行「写口拒了 · WRITE_FAILED · 表还在」，pending 留着这张 1 行改行。`confirmWrite` 的 catch 调 `restoreRecordsList`，把打开确认前 `ensureListRestoreBeforeWritePreview` 存下的列表和它的来源标签铺回。现网 `GET /api/v1/biz/pending-sheet` 仍是这张改行、1 行、`pv_946fff00b6b5e8d5`、`canWrite false`。表上那 20 笔和这句红条不是同一张 pending。

查找键打在哪一类写上：[write-lookup-key-scope.md](write-lookup-key-scope.md)。
