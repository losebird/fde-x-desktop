# 增删改审交互：现在实际怎么走、哪里会咬人

对照 [增删改审手测集](biz-write-eval.md)、[五问](records-panel-decisions.md)、[W1 新建过账](biz-write-w1-root-cause.md)、[tool call aborted](tool-call-abort-root-cause.md)。  
四路只查因：闸/轮次、BFF、右栏、现网 jsonl。**未改产品。**

## 现在这台机器上

| 层 | 状态 | 后果 |
|---|---|---|
| DSH lan-assist | vendor 仍是 `20c234fb`；BFF 重启后 connect 成 **PID 11136** | leftover「现查+`no`」按设计不再掐；**现网还没有新的写 turn 证明** |
| BFF 4318 | 已换 **PID 10640**（16:51） | 无 source → 403；`workstation` → 进闸（假令牌 `NEED_PREVIEW`）；不再三种都是「请在右侧确认」 |
| 前端 5174 | 未动（42443） | 确认失败仍会关抽屉、清 pending |

假令牌探测已对上磁盘语义。右栏确认这条路现在能进闸。会话若掉了，工作台里再连一次 AI。

## 人以为的路径 vs 实际

```
人说话 / 行内 / 顶栏
  → biz_preview（槽 recoverWriteIntent → 闸 preview → 轮次 candidate）
  → 右栏 pending + 抽屉（有令牌且有可确认 diff 才开）
  → 人点确认 → BFF /api/v1/biz/write（必须 source=workstation）
  → 闸 commitWrite → 写库
  → 秘书 plugin 跟一句「库里已改上」→ 新 turn 现查回执
```

实际会在这些地方岔开：

1. **槽**把「现查」收成「新建/改行」（speech 里有写词、工具没带 `no`）。
2. **轮次**把后一次现查当成 leftover，整轮 `cancel`（Harness 记成 `user`）。
3. **BFF 旧进程**丢掉 `source`，右栏确认也过不了闸。
4. **右栏**用抽屉、蓝条、页脚、历史，让人以为「待确认 / 已对齐库」，表却不是那张。

过账成功后，写库的那条通道只有 **BFF 200** 才进 `biz_write_audit`。W1 单号 `388329877078016` 是左栏工具写进去的，审计表是空的。

## 现网已经发生过的

| 何时 | session | 事实 |
|---|---|---|
| W1 | `7eaa79f6` seq 68 / 82 | 右栏 EXPIRED（闸原文「预览过期了。要写再预览一次。」）；左栏无 workstation 的 `biz_write` **写成功** `388329877078016` |
| 16:01 | `77396503` seq 95–112 | 秘书 follow-up 后，现查落成 **新建** `pv_c68a88264cf8da07`，四工具同毫秒 abort |
| 16:23 后 | — | 只有 DSH 重连 `session/end-seed`，**没有**新的预览/过账/abort，修没修好不能用现网结案 |

今日 jsonl **没有** `NEED_WORKSTATION_CONFIRM`（闸文案在盘上，还没被现网写路径打到）。

## 会咬人的洞（按人看见的结果）

### 1. 右栏确认写不出去（当前 live）

闸要 workstation，旧 BFF 不带。点确认：红条「请在右侧确认过账」，新 UI 再把抽屉和 pending 清掉。要重新预览，而且在 BFF 换新之前仍然写不出。

### 2. 人只预览，库里却多了一行（W1，闸已挡、现网未再打穿）

旧闸允许模型 `biz_write`。overlay 现在拒无 `source` 的写。16:23 后没有新的 `biz_write`，**不能**说现网已经安全。  
另外：`executeOperationLive`（操作单执行）磁盘代码会自己带 `source: workstation`，**不经过**右栏按钮，成功也不进 `biz_write_audit`。

### 3. 过账后现查被整轮掐掉

已修：`action=现查` + **`no` 槽** + wrote follow-up；过账前 `closeRound`。  
仍会掐：

- 现查 **不带 `no`**，speech 里还有「新建/改行」→ 闸再落成写预览。
- **问卡 picked** 之后同轮再查同一单号 → leftover 仍 `plugin-leftover`。
- 右栏进了「有 diff 的写预览」→ `records-cancel` 掐还在跑的现查。BFF 未重启时 kind 转发不上，会话仍显示 `user` abort。

### 4. 令牌死了，右栏还像能确认

预览 90s 过期后，闸清 `pendingWrite`，**`pendingSheet` 仍可带着旧 `preview_id` / canWrite**。点下去才 EXPIRED。  
确认时 `token.used=true` **先于** `postWrite` 成功：业务超时后令牌已废，不能原令牌重试。  
同 opening、同动作、改两个字段两次预览：一次确认可能 **顺序写多个 token**（和「一张预览卡」拧着）。

### 5. 左右不是同一张待确认

- 多行表未 picked 再发写预览：模型有新令牌，store 可能不换 pending。
- 抽屉开着点对象 chip：表切了，抽屉还是上一跳令牌。
- 取消后再从浮现历史点回来：已 dismiss 的写预览能再开（W24 不过）。
- `changes: []` 仍有令牌：蓝条「待确认」，抽屉不开。
- 无 `preview_id` 也可能出「待确认」蓝条，无法确认。

### 6. 过账成功，右表仍不是库

确认成功不拉官方现查。琥珀条「表格保留本次预览行供核对」，页脚常是「总数未知」（写预览 `packSheet` 不带 `hitTotalState`）。删除/过审成功后，人仍可能看见将删的那一行。  
轮次正常结束时，没 cancel 的写预览 candidate 会升成 official，下一屏官方表可能还是上一跳预览。

### 7. 失败和进行中的确认

新 UI：确认失败关抽屉、恢复列表，不能在同一张预览上重试。红条仍可能被「IM 调用失败」盖成「过账失败，请重新预览后再试」。  
点确认后下一跳 SSE 还能换抽屉：过账用的是点击瞬间的令牌，眼睛看的是下一跳。

### 8. 审计说谎

BFF 成功且 sheet 带 `sessionId` 时，audit 的 `source` 会写成 **`ai`**。同 `trace_id` 二次写入是 merge，不是追加。工具写成功整单不进审计。

## 和手测集怎么对

| 编号 | 现在怎么判 |
|---|---|
| W1 | 预览主路径在。过账：live BFF 先挡死；即便 BFF 新了，过期幽灵令牌、页脚「总数未知」、空 changes 蓝条还在 |
| W2 | 顶栏预览不写 session pending 缓存，切 Tab / 重水合不稳 |
| W3 / W9 / W29 | 跟最新一跳大体成立；与「确认进行中」打架；同 opening 多 token |
| W4 / W10 / W15 / W20 | 成功文案偏乐观，表不拉库；失败靠红条，pending 被抹掉 |
| W21–W23 | 问卡后再现查仍可能整轮 abort |
| W24 | **不过**：浮现历史能重开已取消令牌 |
| W25 | 「返回」清 pending，「取消」恢复表，两种关法 |
| W28 | chip 不关抽屉，表与令牌可错位 |
| W30 | 闸拒写成立；live 上是「有令牌也写不出」 |

## 左有预览、右空表（18:02 现网）

左栏读工具结果；右栏等 **round-end** 的 `biz.sheet.pending`（本跳 18:02:30）。**不要**在每次 `biz_preview` 当下刷表（一轮多预览会乱）。

Ace 等过 round-end 仍空：outbox 已有完整 sheet，闸 GET 也有 1 行。空的是 **`resolveConnectedKind('工单')` 在 catalog 非空时返回空 → `applyPendingSheet` false → `clearDisplayed`**。`biz_surfaces.row_count=1` 让页有壳、tbody 仍空。不是没预览，也不是复制补丁把表删了。口语进库改的是闸里收关系，不是这条 apply。

## 建议怎么收（先部署，再按类修，不要一把梭）

1. **先让 live 对齐磁盘：** 只重启 BFF，5174 / DSH 不动。用假令牌确认：无 source → 403；有 workstation → 进闸（EXPIRED / NEED_PREVIEW），不再三种都是「请在右侧确认」。
2. **再手测一条过账后现查**（带 `no`）：证明 leftover 现网已死。模型不得自己过账。
3. **然后按人看见的结果修，一次一类：**  
   - 现查不得升写（漏 `no` / speech 写词）  
   - picked 后再查不得整轮 abort  
   - 过期幽灵令牌 + 页脚「共 N 条」  
   - 取消后历史不得重开  
   - 过账成功拉官方表  

不要为了「区分 cancel kind」单独开一轮，那是记账，不是人碰到的洞。
