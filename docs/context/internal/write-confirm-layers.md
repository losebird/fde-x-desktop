---
cursor:
  subagentId: "bc-254e07d5-801d-5286-a758-ac57c7c64f83"
---

# 写路径「确认过账」套件与层级清点（只查因）

**问题**：连弹「确认过账」是不是「套件太多 / 层太多」？  
**范围**：词表/图 → slots → gate/write 令牌 → session-round → overlay follow-up → BFF emit/hydrate → RecordsPanel 抽屉。未改产品、未动 5174/4318。

---

## 1. 路径上实际有多少「套件」

沿 **一次 AI 写预览 → 人在业务记录过账** 的主链，可数的独立模块（各管一段、有明确文件边界）共 **9 个**，不是 9 个并列产品，而是流水线分段：

| # | 套件 | 主要路径 | 对「确认过账」负什么责 |
|---|------|----------|------------------------|
| 1 | **词表 / 图** | `semantic.js`、`lookup.js`、`vocab/spoken.js`；BFF 侧 `loadMemoryWorkspaceVocab` | 决定型、关系、能否「过审/改行」；**不发令牌、不弹确认** |
| 2 | **slots + where** | `slots.js`、`where-pass.js` | 把用户话填进 structured plan；**不写、不确认** |
| 3 | **plan** | `plan.js` | 规范化 plan；注释写明 gate 执行 plan，**speech 仅证据** |
| 4 | **写口 / preview 令牌** | `write.js` `createGate()`：`tokens` Map、`preview()`、`write()`、`packSheet()` | **唯一硬契约**：`preview_id`  mint、`token.used`、`EXPIRED`、`NEED_PREVIEW`；`canWrite` 只在 packSheet 里算（有 live `preview_id`、非现查、行数/过审 diff 等） |
| 5 | **秘书闸 / hall** | `gate.js` `createGate()`：`pendingWrite` + `pendingSheet`、`previewBiz()`、`commitWrite()` | 预览后把 **opening + 令牌 + sheet 视图** 写入 store；`commitWrite` **拒非 workstation**（`NEED_WORKSTATION_CONFIRM` / BFF 403）；成功消费后清 hall |
| 6 | **session-round** | `session-round.js`；`index.js` 把 `officialRoundSheet` 挂到 `/state` | 一轮工具结果选 **official sheet**；回合结束才 **handed**；**无 UI、无 write** |
| 7 | **overlay 工具与 HTTP** | `tools.js`（`biz_preview` / `biz_write`）、`http.js`（`/preview`、`/write`）、`index.js` `deliverFollowup` | 工具只 **previewBiz**；`biz_write` 走同一 `commitWrite`（无 `source: workstation` 会被拒）；过账成功可 **follow-up 文本** 回 AI，**不是第二张确认 UI** |
| 8 | **BFF emit / hydrate** | `runtime/routes/biz.mjs`（`emitBizSheetPending`、`GET …/pending`、`POST …/write`）、`lan-assist-state-watch.mjs` | **SSE `biz.sheet.pending`** + `lastEmittedPendingBySession`；GET pending 从 hall `pendingSheet ?? pendingWrite` 读；write 再验 `source === 'workstation'` |
| 9 | **工作台 UI** | `biz-session-sheet.ts`（内存 pending + `dismissedPreviewIds`）、`RecordsPanel.tsx` + `BizPreviewDrawer.tsx`、`biz-sheet-display.ts` | **唯一标准「确认过账」按钮**；`confirmWrite` → `bizWrite(..., { source: 'workstation' })`；hydrate / 事件 / 本地 preview 决定 **是否再次 `setDrawer`** |

**命名注意**：`write.js` 与 `gate.js` 各导出一个 `createGate`——前者是 **令牌写口**，后者是 **秘书 hall + previewBiz/commitWrite**；index 里 `opts.gate` 指向 write 口，秘书层再包一层（易读成「两层 gate」，但职责不同）。

---

## 2. 实际有多少「层」（逻辑阶段）

若按 **数据形态变化** 数主链阶段（不是 npm 包个数）：

1. 话 → plan（slots/plan）  
2. plan → preview 结果 + **令牌**（write 口）  
3. 令牌 + sheet → **hall 双字段**（`pendingWrite` / `pendingSheet`）  
4. 同轮 sheet → **officialRoundSheet**（可选，与 hall 并行存在）  
5. sheet → **BFF 广播 + lastEmitted 缓存**  
6. 事件/GET → **前端 pending 缓存**  
7. sheet → **抽屉 UI + dismissed 集合**  
8. 点击 → **BFF write → write 口消费 token**

共 **8 个逻辑层**。其中 **真正管「能不能写」的只有第 2 层 tokens**；**管「能不能点确认过账」的 UI 入口主要在 7**；**6–7 没有与 token.used 绑定的单一「未消费写令牌」视图模型**。

---

## 3. 谁能单独再开一张「确认」？谁本不该开？

### 会呈现「确认过账」或等价确认 UI 的入口

| 入口 | 路径 | 是否该开 |
|------|------|----------|
| **RecordsPanel `BizPreviewDrawer`** | `applyPendingSheet` / `hydrateFromPending` / `biz.sheet.pending` / 切 session / 点历史 surface | **唯一正当主入口**（AI 预览令牌） |
| **RecordsPanel `runPreview`** | 表格内改行/新建 → `runtimeApi.bizPreview` → 直接 `setDrawer` | **正当但第二条 mint+开抽屉路径**（与 AI 预览共用同一 drawer，可能再发一张 `preview_id`） |
| **OperationRecordPanel 回退抽屉** | `BizRollbackConfirmDrawer` → `bizRollbackPreview` + `bizWrite` | **正当，但是回退域**；文案是「确认回退并写回」，不是主链 duplicate |
| **`buildPreviewSummary` 标题** | 「改行确认 / 过审确认 / 删除确认」 | **只是 drawer 内标题**，不是第二层 modal |

### 不应再开「确认过账」但仍可能让用户感觉「又要确认」的行为

| 行为 | 原因 |
|------|------|
| **同一 `preview_id` 多次 hydrate / emit 后 `setDrawer`** | `applyPendingSheet` 在 fingerprint 相同仍会 `setDrawer`（仅 prevId+action 相同时保留 prev）；session 切换、surfaces effect、`biz.sheet.pending`、state-watch **round-end** 都会再走一遍 |
| **关闭抽屉但未服务端 cancel** | `dismissBizPreviewId` 仅 **sessionStorage**；服务端 token 仍 live，GET pending 仍带 `preview_id` → drawer 可再开 |
| **`isApproveAlreadyAtTarget` 仍 `shouldOpenWritePreviewDrawer === true`** | 过审已达目标时 **仍开 drawer**（`canWrite` 常为 false），用户看到「过审确认」但按钮不可用，像又多一轮确认 |
| **Agent `biz_write` 工具** | 无 workstation source → **写被拒**；不是第二张 drawer，但模型可能反复尝试 |
| **follow-up（`commitWrite` 成功后 `briefFollowup`）** | 只追加 AI 回合文本，**不是过账确认 UI** |

### 明确不应开确认、代码上也未开独立确认 UI 的层

词表/图、slots、plan、session-round（仅 emit sheet）、BFF write 403 分支、write 口 `refuse('USED')`（只返回 hint）。

---

## 4. 对 Ace 问题的结论（必须三选一）

| 假设 | 判断 |
|------|------|
| **主因是套件数量** | **否**。9 段是正常流水线分段，没有 9 套并列「确认产品」。 |
| **主因是层级数量** | **弱否**。8 个逻辑阶段偏深，但深度本身不会自动变成多次点击；问题在于 **若干层各自维护 pending/dismissed/emitted 副本**。 |
| **主因是同一交互多层各做一遍、缺少单一「未使用写令牌」契约** | **是（主因）**。 |

### 主因展开（证据链）

1. **写令牌权威一处**：`write.js` `tokens.get` / `token.used`（`write()` L1619–1623）。  
2. **「待确认」状态多处并行、不同步**：  
   - hall：`pendingWrite` + `pendingSheet`（`gate.js`）  
   - round：`officialRoundSheet`（watch 只 emit 这条，**不读** hall 的 pendingWrite）  
   - BFF：`lastEmittedPendingBySession`（`biz.mjs`）  
   - 浏览器：`pendingBySession` + `dismissedPreviewIds`（`biz-session-sheet.ts`）  
3. **「开抽屉」未绑定「存在且未 used 的 token」**：  
   - `shouldOpenWritePreviewDrawer` 看 sheet + `sheetHasConfirmablePreviewChanges` / dismissed / 过审 alreadyAtTarget（`RecordsPanel.tsx` L219–227）  
   - **不查**服务端 `token.used`；同一 `preview_id` 可被 emit/hydrate **反复推 UI**  
4. **两条预览 mint 路径** 共用同一 drawer：AI `biz_preview` 工具链 vs 表格 `runPreview` → 均可 `setDrawer`，hall 还有 opening merge（`gate.js` L352–402），易出现 **新令牌 + 旧 dismissed/lastEmitted 交错**  
5. **过账强制点唯一**：`commitWrite` / `bizWrite` 要求 `source: 'workstation'`（`gate.js` L422–433，`biz.mjs` L1115–1118）——说明产品意图是 **只在 RecordsPanel 点一次**；但 **开抽屉** 没有同等强度的单点契约。

**一句话**：连弹不是「套件/层数太多」本身，而是 **确认 UI 的打开条件分散在前端 hydrate/emit/hall/dismiss 多套状态里**，而 **写令牌只在 write 口有 used 语义**，两套模型未合并成「全局仅一张未消费 preview_id → 至多一个 drawer」。

---

## 5. 本次交付

- 仅静态代码清点，无 reload、无改 5174/4318、无 overlay/BFF/前端 diff。  
- 相关既有笔记：`internal/double-confirm-stopped.md`（此前已停改，与本报告一致只查因）。
