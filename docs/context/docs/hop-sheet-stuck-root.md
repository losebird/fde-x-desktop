---
cursor:
  subagentId: "bc-1aaf16b4-dfce-5d67-94fe-806187a4c607"
---

# 12:16 右边才换上这 4 张工单

**这 4 张是上一句恒通的官方表，不是「采购订单明细」查出来的。** 人话 12:16:38 进了新回合，左边还在想。右边来源写成「现查 12:16」，画的是 11:41:21 已经交出的那张工单。

新的一句自己的表还没出生。`biz_preview` 回执是 12:17:48（采购订单明细，一页 20 条）。它的回合结束推送是 12:18:17，`evt_0muggaea3_000000005`。12:16 的屏幕用不上这张。

12:16 画上的是 `evt_0mugeyvu4_000000004`。服务器只在 11:41:21.196 发过这一次，来源 `round-end`，工单现查 4 行，话是「恒通电子有哪些工单？」，`surfaceId` 空。表面 `bsurf_4be038774661489fa32e8cee0ad51287` 的 `created_at` 也是 11:41:21。11:41:21 到 12:18:17 之间，outbox 里没有第二张 `biz.sheet.pending`。

所以不是 12:16 又发了一次回合结束。`startRound` 在 12:16:38 把上一张官方表留在 `servedSheet` 上，watch 指纹没变，也不会再推。新回合开着的时候，官方答案仍是这 4 行。

来源钟是 12:16，因为 `applyPendingSheet` 调用 `applySheet` 时不传表面时间，钟用的是画上去那一刻。点历史会带上 `createdAt`（11:41）。下拉里的「恒通电子有哪些工单？」是这张表自己的 speech，画上之后才被选中。

11:41 那条推送没上屏：事件没有 `surfaceId`。浮现历史还钉着时，`shouldBlockIncomingSheetForHistoryPin` 在画之前就返回。全局监听仍会把这 4 行记进会话缓存。钉还在，不带 `surfaceId` 的 hydrate 也直接返回。回合结束时表已经是官方的，屏幕还停在客户改行。

12:16 能画上，是因为这时候去取「当前官方表」（缓存或 GET `/api/v1/biz/pending-sheet`）。GET 从 11:41 起交的就是这 4 行。钉先放开，这条才进得了 `applyPendingSheet`。日志里没有 12:16 的点击。12:20 才有 `focus-kind`，那是后来点芯片。新的一句没有交出自己的表，取官方表就取到了上一句。

下面是 11:41 之前右边为什么还停在改行。

# 恒通电子的工单查到了 4 张，右边仍是客户改行

**查询跑过了，4 张工单都是 CUST2056 的。闸把大厅表换成了这 4 行。右边没换，因为业务记录不画工具回执，只画回合官方表；这张工单在回合结束前不是官方表，屏幕上继续留着 10:18 那张客户改行。**

这不是「待审费用报销」那条。那次是条件被丢掉、`:list` 没打、0 行过不了闸，旧表留下。这一次 `:list` 打了，4 行，闸收下了。

会话 `session-5910c15c-599e-4673-ba7b-cf159e5ea7e3`，turn 25。人话 seq 739，11:40:07：「恒通电子有哪些工单？」。回合 11:41:21 正常结束（`completed`），没有 `session/cancel`，没有 `plugin-leftover`。

DSH **51709**（11:26:29 起），BFF **51660** 听 4318，Vite **42443** 听 5174。只读，没改产品。日志 `~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-5910c15c-599e-4673-ba7b-cf159e5ea7e3/session.v3.jsonl.zstd`。

## 这一下 biz_preview

同一步还有 `biz_describe`（客户）和 `biz_traces`（CUST2056，空，hint 说不是现查）。工单只打了一下。模型参数里没有 `where`，没有 `no`，没有 `hopWhere`。

| | 请求 seq 743 · 11:40:49.624 | 回执 seq 746 · 11:40:49.896 |
|---|---|---|
| kind / action | 工单 / 现查 | 工单 / 现查 |
| speech | `恒通电子有哪些工单` | 表上是整句 `恒通电子有哪些工单？` |
| from | `{kind:客户, no:CUST2056}` | 客户侧 1 行，`no=CUST2056` |
| steps | `客户(CUST2056)` → `工单` | 同这两跳 |
| ok / error | | `ok: true`，没有 error |
| rows | | **4**，`hitTotal=4`，`querySettled=true`，`ambiguous=true`，`listed=true` |
| preview_id | | 空 |
| sheet | | 就是这 4 行，`at=1790307649880` |

四张全是深圳恒通电子有限公司，`customerId=371712729939987`（改行预览里 CUST2056 的主键）：

| 单号 | 标题 | 状态 |
|---|---|---|
| TK20240510286 | 系统无法登录 | resolved |
| TK20250525624 | 报表错误 | closed |
| TK20250710257 | 接口故障 | closed |
| TK20240626910 | 报表错误 | assigned |

`:list` 打到了工单集合 `biz_tickets`。回执指纹是 `工单:related:TK20240510286,TK20250525624,TK20250710257,TK20240626910`，这串只在关系现查打完 list 之后才写（`lookup.js` 880）。路径是 `relatedListPath`（同文件 1678）的 `/api/biz_tickets:list?...&filter=`，滤的是客户这条外键，不是工单目录。账本 11:40:49 写的是「现查进业务页 · 工单」，不是「现查空表未覆盖」。

左边念的就是这 4 张。不是没查。

## 右边为什么还是改行

10:18:04 turn 23：「CUST2056 深圳恒通电子有限公司备注改成测试修改」。11:40:49 之前，屏幕上的表是这次改行。

- seq 711 预览：`preview_id=pv_ba17931f79b88e8d`，客户 1 行，备注 → 测试修改。
- seq 719 `biz_write`：`NEED_WORKSTATION_CONFIRM`，模型没过账。
- 10:19:04 工作台确认写上了。账本：「库里已改上：客户 CUST2056。将备注改为 测试修改。」
- 紧接着 turn 24 是插件交接（「库里已改上…」）。10:19:25 被掐掉，`reason.kind=aborted` / `user`。这一轮没有 `biz_preview`，没有换成写后的现查。
- 11:26:37 `session/end-seed`：DSH/BFF 重启。回合存在内存里，重启后是空的。React 里 10:18 那张改行还在。来源「改行 · 10:18」、历史「客户 · 改行 …测试修改」对得上 surface `bsurf_94b620f97e85`（10:18:39）。

`shouldKeepPopulatedListSheet`（`gate.js` 189）这次没有留旧表。客户改行和工单现查 kind 不同，245 行的「上一张有行、下一张 0 行」也碰不上。321–327 行把 `pendingSheet` 换成了这 4 行。现网大厅表仍是这张工单（`speech` 同一句，`at` 同一毫秒）。

面板不读大厅 `pendingSheet`。它只画 `officialRoundSheet`（`lan-assist-state-watch.mjs` 65–76）。而 `servedSheet`（`session-round.js` 317–321）在回合开着时交的是 `round.official`，不是刚记下的候选。`noteToolSheet` 把这 4 行放进 `round.candidate`（294–299），回的是 `emit: false`。

所以 11:40:49 到 11:41:21：左边已经有 4 张，官方表仍是空（重启清过），watch 没有新表可发，右边继续画 10:18 的改行。

11:41:21 回合结束，`closeRound` 把候选升成官方（224–227）。20 毫秒后 watch 发出 `biz.sheet.pending`，source `round-end`，事件 `evt_0mugeyvu4_000000004`。surface `bsurf_4be038774661` 记下工单现查 4 行（`server.mjs` 2718–2726 只在 emit 成功后才记账，且 `emitEvent: false`）。这次事件的 `surfaceId` 是空的。

用这两张真实表跑过：

- `shouldSkipCoveringPending(改行, 这张工单)` = **false**。不会因为「留旧表」丢掉。
- `sheetForOfficialGet`（`connected-kind.mjs` 441）在「最后交出的仍是带令牌的改行」时 **交回客户改行，不交这 4 张**。注释写的就是：交接之后的 GET，交最后一张人手写预览，不交后面的现查。
- 这一轮的 emit 把「最后交出的」改成了这张现查。现在再 GET `/api/v1/biz/pending-sheet`，已经是工单 4 行。441 行不再挡这一下。

截图里右边仍是改行，说明桌面没有把 `evt_0mugeyvu4_000000004` 画上去。能对上「历史还停在改行、事件又没有 surfaceId」的是 `RecordsPanel.tsx` 1213：浮现历史若钉着上一张，`shouldBlockIncomingSheetForHistoryPin`（`biz-records-history.ts` 11–18）看到进来的 surfaceId 为空就 return，表和历史选择都不换。日志里看不到有没有点过那条历史。没钉的话，这一行不会挡；`applyPendingSheet` 对这两张表也不会跳过。

没有 leftover。`explicitLiveLookupSupersedesWrite`（`session-round.js` 68–76）只替换**同一回合里**还开着的写预览。改行是上一回合，10:18:39 已经收成官方表。这一回合也没有 `cancel: true`。

没有 dismissed。这张现查 `preview_id` 是空的，`sheetAfterDismissedWrite` 原样交回。

交接没有卡在改行模式上。turn 24 被掐掉之后就结束了，没有把改行换成别的表，也没有挡住 turn 25 的查询。

## 和待审费用报销不是同一条

| | 待审费用报销 | 这一句 |
|---|---|---|
| `:list` | 没打。`WHERE_UNBOUND`，条件被关系绑定丢掉 | 打了 `biz_tickets:list`，4 行 |
| 闸 | `shouldKeepPopulatedListSheet` 245 行，0 行留下旧工单 | 换了。账本是「现查进业务页」 |
| 回执 sheet | 仍是上一张工单 | 就是这 4 张工单 |
| 右边 | 旧表留下，因为新表是空的 | 新表有 4 行，但面板等的是回合官方表，不是这张回执 |

新的一条是：**写预览先占住屏幕上的官方表；后面的跨对象现查先写进大厅和工具回执，要等回合结束才变成官方表。** 打开着的改行不会在工具返回的那一拍被这张 hop 现查换掉。`sheetForOfficialGet` 441 行则是另一道：只要「最后交出的」还是带令牌的改行，hydrate 就交回改行，不交后面的现查。这一轮 emit 之后，那道已经让开。
