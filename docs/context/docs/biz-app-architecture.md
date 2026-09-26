# 业务应用现在的架构

2026-09-26 只读。代码在 scene-39，`cursor/approve-batch-where-9c38` @ `07fb1595`。不改代码。

三页：**应用**、**业务记录**、**操作记录**。依据 [Map utterance to records](bc-9b8e4e07-3b9c-5959-8a40-d733675be2c2)、[Map app shell and audit](bc-3f857a59-c1bc-59e6-a54e-a966b7941fbc)。

## 为什么改来改去是同一圈

业务记录右栏没有一张表。同一句结果要经过 **九份副本**，谁后写谁上屏，规则还互相挡。

| 副本 | 谁写 | 人看见它时 |
|---|---|---|
| `pendingSheet` | 每一次 `previewBiz`，回合还没结束 | 过程表。失败预览若没拦住，会进这里 |
| `officialRoundSheet` | 回合结束，合格的 `candidate` 才升格 | 正式结果。`handed` 为真就不再发 |
| `lastEmitted` | BFF 每次成功 emit | 内存。重载核心就空 |
| `listBeforeWrite` | 写预览前把上一张现查存一份 | 撤预览时用来还原。GET **不读**它 |
| SSE `biz.sheet.pending` | 轮询 `/state` 或手点预览 | 右栏主要入口。`source=lan-assist` 的旧事件被忽略 |
| GET pending | official、写令牌投影、lastEmitted、空了才回退 pendingSheet | 刷新浏览器靠它。合并规则和 SSE 不是同一套 |
| 屏幕 `rows` | `applyPendingSheet` | 还有「不要盖住当前表」的闩 |
| `kindFocus` | 点类型芯片 | 盖住本句 official，直到新回合 |
| 前端 `pendingBySession` | 记住 SSE | 只在浏览器内存。刷新就没了 |

所以：闸里 21 行、对话里 21 行、右栏仍是旧工单或空表，可以同时成立。改「失败不要上台」会挡住第二句 emit；改「第二句再 emit」会把脏过审表推上去；改「先 JSON 再 cancel」会和 DSH 的 `signal.aborted` 抢当前这一枪的回执。不是三件无关的 bug，是一份结果有九个写入口。

## 三套真值（不要混）

| 真值 | 在哪 | 谁可以改 |
|---|---|---|
| 连接器业务行（工单、费用报销） | 源系统 | 只有人确认后的 `POST /api/v1/biz/write` |
| 创建的应用 | 工作台 SQLite：`business_apps` + 物化表 `app_{slug}__{entity}` | 应用自己的 REST，不经 lan-assist |
| 写入审计 | SQLite `biz_write_audit` | 仅上面那条 `/biz/write` 成功之后 |

连接器配置在 `business_connections`。工作台不镜像外部全表。

手册、记忆、`search_text` 不在这三套里。它们进不了写闸。

## 一句到业务记录

```text
用户句
  → rememberUserSpeech + startRound
  → 模型 biz_preview
  → recoverWriteIntent（无写动作 role → 现查）
  → 现查且同句同型同页已结算 → QUERY_SETTLED，不再打库
  → 否则 previewStructured（连接器）
  → previewBiz 写 pendingSheet（写预览另存 listBeforeWrite + 令牌）
  → noteToolSheet（回合里只记 candidate）
  → turn/end：合格 candidate 升成 official；handed 则本句不再 emit
  → 若要停工具环：等 tool/result 写完再 plugin-leftover cancel
  → BFF 每秒看 /state，emit biz.sheet.pending
  → 前端 shouldStage（失败 TOO_MANY 拒）→ applySheet
  → 成功现查还可 focus 到业务记录
```

过审 / 改 / 删 / 新建仍走同一条 `preview`，差别是有 `preview_id`。批量先按 where 再比 100 条；超了 `ok: false`，回合不收进 candidate，前端也不 stage。人点确认才 `biz_write`。模型走 `biz_write` 时，闸内 `commitWrite` 返回 `NEED_WORKSTATION_CONFIRM`，审计不记。HTTP 403 只在 `POST /biz/write` 且 `source` 不是 `workstation`。

结算键在打连接器之前：用户原话 + 目标型 + 页码。同一句、同一型、同一页才不再打库。换句、换型、换页、写令牌、replay、第一次未绑定，都会再打。

## 应用

应用 Tab 是 `activeDataSubview = overview`。

```text
描述 → fde-app-builder → fde_app_spec_submit
  → SQLite 草稿 business_apps
  → 人激活 → 物化 app_* 表，status=active
  → 工作面 AppRuntime；声明了 float 才能撕浮窗
```

有 `spec.pages` 走产品页。没有的存量脚手架是 table / form / kanban / stat。浮窗里是这一个应用，不是整块业务应用。台账表 `SpecTable.startBizPreviews` 可以另起一条业务预览，仍进同一条写闸。

刷新浏览器后 Tab 回到应用目录，工作面 id 不进 localStorage。已经撕开的应用浮窗在 `floating` 里，刷新后还会回来。

## 操作记录

列表是 `GET /biz/traces`：lan-assist 轨迹和 `biz_write_audit` 按 `trace_id` 合并。

业务记录点确认、操作记录点回退，都是 `bizWrite` → `/biz/write` → 成功才 `insertBizWriteAudit`。这是同一条账。

顶栏没有执行按钮。`POST /operations/:id/execute` 仍在，live 时直接 `/write`，**不**进 `biz_write_audit`。`src/` 里没有调用它的界面。应用目录上的「待审批」数字读的是另一张 operations 列表，不是操作记录。

## 重载核心和刷新浏览器

| 动作 | 换掉什么 | 留着什么 |
|---|---|---|
| 重载核心 | BFF、DSH、把 overlay 拷进 `~/.dsh-fde-x`。闸内 store、回合、`lastEmitted` 清空 | SQLite、磁盘上的会话。**不**加载 `src/` |
| 刷新浏览器（5174） | 前端内存里的表、当前 Tab、工作面 | 闸和 SQLite。已发出的表靠 GET pending 拉回 |

只重载核心，设置页让出记录页的前端不会变。两件都要做，右栏才同时吃到新闸和新焦点。

## 三页怎么摆

`src/pages/Data.tsx`：`overview` 应用，`records` 业务记录，`operations` 操作记录。设置是另一块面板，不在这三个 Tab 里。`focusBizRecordsPanel` 把 `data` 面板拉满并切到 `records`；设置若仍是全屏，人眼可以继续停在设置。

点头之前不改。下一刀若要动，只能收「一份结果一个写入口」，不能再给九份副本各补一条例外。

## 对抗审查补上

2026-09-26 对着 `07fb1595` 再核了一遍。主链、三套真值、九份副本成立。下面是页上原先没写清的用户入口。

### 操作业务数据

| 入口 | 实际怎么走 |
|---|---|
| 翻页 | 业务记录底栏上一页/下一页，`turnHitPage` 再 `bizPreview({ page })`。结算键含 `page`，换页会再打库 |
| 跨对象 hop | `steps` / `from` / `hopWhere`。同一回合可以多跳。侧栏型视图用 `shouldHoldSideKindView`，芯片可以盖住本句 official |
| 回退 | 先 `POST /biz/rollback/preview`，再带 `rollback_of_trace_id` 走 `/biz/write`。不是点一下就入账 |
| 取消预览 | `POST /biz/preview/dismiss` → `dismissWrite`。前端 `dismissBizPreviewId`，并 `cancelAi({ kind: 'records-cancel' })` |
| 类型芯片 | `selectKind`。`shouldSkipCoveringPending` 与「不要盖住当前表」是两道闩 |
| 空表 | 现查 `querySettled` 且 0 行仍可上台。失败 sheet（含 `TOO_MANY`）不 stage |
| 手册只读 | `biz_describe` 只描述，不写。`search_text` 在结算之后会 `notePostSettledHopTool`，工具环按 leftover 停 |
| 应用里的业务预览 | 产品页台账 `SpecTable.startBizPreviews`、表单字段级查找，进同一条 preview，不另开一套真值 |

### 三页壳（不另开写入口）

应用目录有四格指标（含待审批、异常）、连接器只读列表、草稿折叠/删除、创建向导（本地台账或接模块）。工作面能激活、修订、版本回滚、编辑 spec。产品页块有 tab、stack、stats、compose、chart、feed、cards、table、kanban。业务记录顶上有事务底座条。操作记录一次最多拉 200 条，页内再筛、每页 20，行上能开 trace，另有「审查 corpus」。三 Tab 只有 `/data`，没有子路由。设置是另一块面板，分区含 AI 核心、语义记忆、运行环境、存储与数据。
