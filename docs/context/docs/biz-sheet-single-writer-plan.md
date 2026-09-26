---
cursor:
  subagentId: "bc-e0c98ae5-a3ed-5810-b672-0a315c4eb77b"
---

# 业务记录右栏：单发布表符号钉死（只读 @ `07fb1595`）

对照 [biz-app-architecture.md](./biz-app-architecture.md)。**已定收法**：一句合格结果只由闸发布一张表（沿用 `officialRoundSheet` 这一格；合格预览成功即发布，不等 `turn/end` 二次升格）。`ok:false`、`TOO_MANY` 不发布。同一句、同一型、同一页不发布第二次。右栏、SSE、`GET pending` 只读这一张，不再合并。

代码根：`scene-39-personal-workstation`，overlay 在 `runtime/vendor-overlays/dsh-lan-assist/`。家目录 `~/.dsh-fde-x` 已存在。

---

## 发布真值（目标态，不改方案）

| 符号 | 目标职责 |
|---|---|
| 闸内 `publishedSheet`（实现上仍落在 `officialRoundSheet` 字段） | 唯一对外表：合格预览成功写入；取消预览由闸再发布上一张；dedupe 键含句+型+页 |
| `pendingSheet` | 仅闸内过程（命中集、写 bundle、`remainRows` 等）；页面与 `GET` 不读 |
| `listBeforeWrite` | 仅取消写预览时还原列表；取消后由闸再发布，不由页面直读 |
| `writePreview`（`/state` 上的令牌投影） | 仅确认抽屉；不并进右栏列数据 |
| BFF `lastEmittedPendingBySession` | 删除内存权威 |
| 前端 `pendingBySession` | 只缓存已发布那张；刷新以 `GET` 为准 |

---

## 九份副本：现在谁写、谁读、收掉后断在哪

### 1. `pendingSheet`（闸 store，`gate.js`）

**写**

- `gate.js` `previewBiz`：现查 / miss / waitingPick → `s.pendingSheet = incoming`（约 L313–327）；写预览 → `stashListBeforeWrite` 后 `s.pendingSheet = { ...sheetSrc, remainRows }`（约 L407–415）。
- `gate.js` `shouldKeepPopulatedListSheet` 为真时可**拒绝覆盖**仍保留旧 `pendingSheet`（约 L321–323、346–349）。
- `gate.js` `dismissWrite`：从 `listBeforeWrite` / `remainRows` 还原 `s.pendingSheet`（约 L656–675）。
- `gate.js` `backSheet`：`s.pendingSheet = restored`（约 L688–690）。
- 写预览合并、`pickSheetRow` 等仍读写 `state.pendingSheet`（约 L563+、L700+）。

**读**

- `secretary.hall` / `snapshot`：经 `attachOfficial` 返回整包 state，其中仍含原始 `pendingSheet`（`index.js`）。
- `runtime/routes/biz.mjs` `GET /api/v1/biz/pending-sheet`：`official` 为空时回退 `state.pendingSheet ?? state.pendingWrite` → `sheetForPendingGet`（L923–927）。
- 同文件 `POST /api/v1/biz/preview`：`previewHall` 取自 `gateState.pendingSheet`（L983–987），供 `emitBizSheetPending` 的 `hallSheet` / `shouldSkipCoveringPending`（L994–1000、L402）。
- `capturePendingSheet`（L473–484）：`POST /biz/write` 前从 `pendingSheet` 取行快照。
- `POST /api/v1/biz/preview/dismiss`：`hallPreviewIdFromState` 回退读 `pendingSheet`（L1116）。
- AI 工具 `previewBiz` 返回的 `sheet` 字段经常是 hall 里的 `pendingSheet`（`gate.js` L334、349）。

**收掉后断点**

- `sheetForPendingGet`、`peekLastEmitted` 回退链整段失效（`biz.mjs` L923–927、`connected-kind.mjs` `sheetForPendingGet`）。
- `capturePendingSheet` 若仍只读 `pendingSheet`，确认入账会断（L473–476）——须改读发布表或令牌侧，**不在本方案里用 GET 合并圆回去**。
- 闸内 `previewBiz` 仍必须写过程表，但**不得**再有任何 BFF/前端路径把 `pendingSheet` 当右栏真值。

---

### 2. `officialRoundSheet`（非持久字段，投影）

**写（实质是「谁决定这张表的内容」）**

- `runtime/vendor-overlays/dsh-lan-assist/index.js` `attachOfficial`：**每次** `hall` / `snapshot` 写入  
  `officialRoundSheet: sessionRounds.servedSheet(sid)`（L227–231）。
- `session-round.js` `servedSheet` 优先级：`round.kindFocus` → 回合未关且 `utteranceSheetPaints(candidate)` → `round.official`（L436–441）。
- `closeRound`（`turn/end` 或 leftover）：`round.candidate` 升格进 `round.official`；`handed` 控制同一 `roundOfficialKey` 是否再对外返回 `emit`（L298–329、L254–265）。
- `noteToolSheet` 只写 `round.candidate` / `weak`，不直接写 `official`（L413–418）。
- **并行发布**：`POST /api/v1/biz/preview` → `recordSurfaceFromPreview` → `emitBizSheetPending`（预览 HTTP 200 即发 SSE，不等回合结束，`biz.mjs` L1002–1006、L402）。
- `lan-assist-state-watch.mjs` 每秒读 `state.officialRoundSheet` → `emitBizSheetPending`（`officialFromState` + `processOfficialSheet`，L66–120）。
- `POST /api/v1/biz/focus-kind` → `emitBizSheetPending(..., force: true)`（`biz.mjs` L863–891）。

**读**

- `lan-assist-state-watch.mjs`（L119–120）。
- `GET /api/v1/biz/pending-sheet`：`state.officialRoundSheet` → `sheetForOfficialGet`（L907–922）。
- 测试 / 文档多处假定「official 面」。

**收掉后断点**

- 必须把「发布」从 `servedSheet`（含 `kindFocus`、开放回合 `candidate`）改为**仅已发布快照**；否则仍会出现过程表/侧栏视图冒充 `officialRoundSheet`。
- 合格预览成功即发布：今天 **AI 路径**主要靠 `turn/end` `closeRound` + watch；**UI 路径**靠 `recordSurfaceFromPreview` 提前 emit——两路时序不一致，收单写后需统一为闸内一次 `publishOfficial`（符号待实现，逻辑锚点：`noteToolSheet` 合格、`gate.preview` 成功、dedupe）。
- `handed` / `roundOfficialKey`  today **不含 `page`**（`session-round.js` L254–264），与「同句同型同页不发第二次」需在发布 dedupe 显式加 `page`（见行为表「翻页」）。

---

### 3. `lastEmitted`（BFF 内存）

**写**

- `runtime/routes/biz.mjs` `lastEmittedPendingBySession`：`emitBizSheetPending` 成功时 `set`（L308、L377）。
- `releaseLastEmittedConfirm`：写成功/ dismiss 时改 `writeToken`（L320–332，写路径 L1237+）。

**读**

- `emitBizSheetPending`：`shouldSkipCoveringPending(lastEmitted, normalized)`（L339–340）；`hallSheet` 第二道闩（L341–342）。
- `GET pending`：`peekLastEmittedPending` + `sheetForOfficialGet` / `sheetForPendingGet`（L920–927）。
- `connected-kind.mjs` `sheetAfterCancelCover`、`sheetForPendingGet`：hall 与 lastEmitted 互盖（L383–420）。

**收掉后断点**

- 删除 Map 后：`sheetForOfficialGet(official, lastEmitted, …)` 的 `namedLast` 分支（L445–457）、`sheetForPendingGet` 整函数（L407–420）失去一半语义。
- **现风险**：`records-align-plan` 已记录 GET 用 lastEmitted 盖住 hall 导致 22 行假满；收法删掉 lastEmitted 会暴露「只剩 official」是否正确发布，不能再用 lastEmitted 补洞。
- `emitBizSheetPending` 内对 `lastEmitted` 的覆盖判断（L339–340）需改为对**当前已发布 official** 的 dedupe，否则要么重复 SSE，要么误杀合法翻页。

---

### 4. `listBeforeWrite`（闸 store，`gate.js`）

**写**

- `stashListBeforeWrite(s, prevSheet)`：写预览前，前一张为「有行的现查」时快照（L158–170），写路径 L407。
- `rememberSheet` / `fresh` 时 `s.listBeforeWrite = null`（L152–154）。
- `dismissWrite` 成功后 `s.listBeforeWrite = null`（L676）。

**读**

- 仅 `dismissWrite` 还原分支（L656–663）。**GET 不读**（与架构页一致）。

**收掉后断点**

- 取消预览后须由闸 **再发布** 上一张 official（来自 `listBeforeWrite` 或上一版 published），不能只改 `pendingSheet` 而不 emit/SSE。
- 前端另有 `displayBeforeWriteRef` / `listRestore`（`RecordsPanel.tsx`），与闸 `listBeforeWrite` 并行；收单写后若只动闸、不动前端 stash，取消预览 UI 可能仍靠本地还原——**可能碰坏「取消预览还原」**（见下表）。

---

### 5. SSE `biz.sheet.pending`

**写**

- `emitBizSheetPending`（`biz.mjs` L335–378）→ `events.mjs` `emit('biz.sheet.pending', …)`。
- 来源包括：`recordSurfaceFromPreview`（`source: 'ui'`）、`lan-assist-state-watch`（`source: 'round-end'`）、`focus-kind`（`force: true`）、`server.mjs` `prepareSurface` 路径 `emitEvent: false` 仅插 surface 不 emit（L3193–3197）。

**读**

- `src/components/biz/RecordsPanel.tsx` `useEvents(['biz.sheet.pending'], …)`（L1222–1277）。
- `src/lib/biz-records-auto-open.ts`（自动拉业务记录 Tab）。
- 前端 **忽略** `source === 'lan-assist'`（L1224–1225）；watch 用的是 `round-end`，不是 `lan-assist`。

**收掉后断点**

- 事件体须**等于**发布表全文（已是 `payload.sheet`）；不得再触发 `hydrateFromPending` 去 GET 合并第二套（L1248–1249 在 SSE 后又 hydrate，可能用 GET 合并结果覆盖 SSE）。
- 去掉 `lastEmitted` 后，`emitBizSheetPending` 的 skip 逻辑必须只认 official dedupe，否则 TOO_MANY 后的脏 hall 仍可能通过 UI preview emit（若闸误发）。

---

### 6. `GET /api/v1/biz/pending-sheet`

**写**（无，只读聚合）

**读路径（当前合并）**

1. `officialRaw = state.officialRoundSheet` → dismiss 过滤 → `canonicalizeSheetKind`（L907–917）。
2. `writePreview = state.writePreview` → `projectWriteConfirm(handed, writePreview)`（L919、L921）。
3. `lastEmitted = peekLastEmittedPending` → 再 `projectWriteConfirm`（L920–921）。
4. `served = sheetForOfficialGet(handed, lastEmitted, sessionId)`（L922）。
5. 若空：`pendingSheet` hall → `sheetForPendingGet(hall, lastEmitted, sessionId)`（L923–927）。

**收掉后断点**

- 步骤 3–5 整段删除；响应只能返回发布表 +（可选）**独立** `writePreview` 字段给抽屉，不能把 `projectWriteConfirm` 合并进右栏 `data.sheet`（L919  today 合并进 handed）。
- `capturePendingSheet` / dismiss 仍依赖 hall `pendingSheet` 时，GET 与写路径不一致。

---

### 7. 屏幕 `rows` / `listSheetMeta`（`RecordsPanel.tsx`）

**写**

- `applyPendingSheet` → `applySheet` → `setRows` / `setListSheetMeta`（L998–1097）。
- 本地闩：`shouldStageRoundEndPending`（`biz-pending-stage.ts`）、`shouldSkipCoveringPending`（`connected-kind.ts`）、`shouldRejectIncomingCovering`、`shouldHoldSideKindView`（`biz-list-query.ts` L446+）、`appliedSheetFpRef` 指纹短路（L1057–1082）。
- `bindSheet` 合并：`{ ...pendingSheet, ...listSheetMeta }`（L1292–1295）——**右栏 meta 与 pending 副本拼接**。

**读**

- 用户看见的表格 = `rows` + `listSheetMeta`（分页脚、hitTotal 等）。

**收掉后断点**

- `shouldSkipCoveringPending` / `shouldHoldSideKindView` / `operationKindViewRef` 是为多真值打架设的；只认一张发布表后，侧栏 hop **不能再**靠 `rememberBizPendingSheet` 而不上台（L1032–1033）。
- 去掉 GET 回退后，刷新仅 `hydrateFromPending` → GET（L1110–1138）；若 GET 不合并 lastEmitted/hall，**「刷新后仍是这张」**完全依赖 official 已发布。
- 指纹短路（L1059–1082）在「只应用发布表」下仍可用，但与闸 dedupe 重复，需避免双闩挡掉合法翻页。

---

### 8. `kindFocus`（`session-round.js` + 记录页芯片）

**写**

- `focusKindSheet(sessionId, view)` → `round.kindFocus = view`（L427–433）。
- `/focus-kind`：`focusOperationKind` → `materializeOperationKindSheet` → `focusKindSheet`（`index.js` L383–400）。
- `POST /api/v1/biz/focus-kind` 再 `emitBizSheetPending`（`biz.mjs` L891）。
- 记录页 `selectKind`：`operationKindViewRef`、`applySheet(hit, …, sideView)`、`materializeOperationKindSheet`（L1478–1548），**不经过** `kindFocus` store。

**读**

- `servedSheet` **优先**返回 `kindFocus`（L439）→ 进入 `officialRoundSheet` → GET/SSE。
- `shouldHoldSideKindView` 阻止 `applyPendingSheet` 画主表（L1026–1033）。

**收掉后断点**

- 方案：点芯片**不盖住**发布表；换型要走闸再发布。今天 `kindFocus` 嵌在 `officialRoundSheet` 内，**必碰坏**「跨对象 hop 侧栏」若直接删掉 `kindFocus` 优先级而不改为「侧栏只读视图、不写 official」。
- `focus-kind` 的 `emitBizSheetPending(force: true)` 会把侧栏视图当全站 pending 推出去（L891），与单表冲突。

---

### 9. 前端 `pendingBySession`（`biz-session-sheet.ts`）

**写**

- `rememberBizPendingSheet`：SSE、apply、hydrate、`selectKind` 缓存路径（Map `pendingBySession`，L87–107）。
- 内部 `shouldSkipCoveringPending`、现查空表不覆盖（L100–106）。

**读**

- `peekBizPendingSheet` / `RecordsPanel` `peekActivePending`（L410–413）。
- 会话切换：先读 cache 再 GET（L1163–1188）。

**收掉后断点**

- 只能存**已发布**那张；`remember` 在 `shouldHoldSideKindView` 分支仍 `remember` 侧栏表（L1032）会再次引入第二副本。
- 刷新以 GET 为准：删除 lastEmitted 后，若 official 未发布，cache 与 GET 皆空，**不能**再从 `pendingSheet` 回退 hydrate。

---

## 回合内辅助符号（不在九份表，但与发布强相关）

| 符号 | 位置 | 作用 | 收单写后的张力 |
|---|---|---|---|
| `round.candidate` / `round.weak` | `session-round.js` | 回合内合格表候选 | 须停留在闸内，不得经 `servedSheet` 泄漏到 `officialRoundSheet` |
| `round.official` | 同上 | `closeRound` 升格结果 | 应迁移为「已发布快照」或与 `publishedSheet` 合并 |
| `handed` | `session-round.js` L327–328 | 同 key 不重复 `closeRound` emit | 需扩展到闸发布 dedupe（含 page） |
| `writePreview` | `index.js` `gate.previewTokenIndex()` | 令牌开/关/过期 | GET 须与 `data.sheet` 分离 |
| `pendingWrite` | `gate.js` | 写 bundle 行 | 仍闸内；`GET` 今天偶读 `pendingWrite`（L925） |

---

## 必须仍成立的行为：收法下碰坏点（只登记，不改方案）

| 行为 | 现在靠谁 | 收单写后风险 / 断点符号 |
|---|---|---|
| **翻页再查** | `RecordsPanel` `turnHitPage` → `bizPreview({ page })`；结算在 `write.js` 带 `page`；`roundOfficialKey` **无 page** | 若 dedupe 只用 `roundOfficialKey`，翻页可能被「同句同型不发第二次」误杀；若去掉 `lastEmitted`/hall 回退，翻页间隙 GET 可能空窗。符号：`roundOfficialKey`、`sheetForPendingGet`、`emitBizSheetPending` L339–342 |
| **第二句换表** | `isNewSpokenUtterance`（前端）、`closeRound` 换 key 清 `handed`（`session-round.js` L319–322） | 单表后仍依赖闸发布新句；`shouldSkipCoveringPending` 双闩可能挡第二句。符号：`shouldSkipCoveringPending`（`biz.mjs` + `biz-session-sheet.ts` + `RecordsPanel`） |
| **TOO_MANY 不上台** | `isEligibleRoundSheet` false（`ok:false`）；`shouldStageRoundEndPending` / `isFailedRoundEndSheet`（`biz-pending-stage.ts`）；`write-batch-where.test` candidate 为空 | 闸仍可能写失败态进 `pendingSheet`；若 UI 仍 `recordSurfaceFromPreview` 且闸未拦，会违反「不发布」。符号：`gate.js` `previewBiz`、`recordSurfaceFromPreview`、`shouldStageRoundEndPending` |
| **确认入账** | `POST /biz/write` + `capturePendingSheet(pendingSheet)` + `commitWrite` | 发布表与过程表分离后，`capturePendingSheet` 读 `pendingSheet`（L473–476）可能对不上令牌行。符号：`capturePendingSheet`、`projectWriteConfirm` |
| **回退两步** | rollback preview + `rollback_of_trace_id` 写 | 不直接依赖九副本，但若右栏表不是发布表，回退预览会对错行。符号：`applyPendingSheet` / `listSheetMeta` |
| **取消预览还原** | 闸 `dismissWrite` + `listBeforeWrite`；前端 `displayBeforeWriteRef`、`restoreRecordsList`、`dismissBizPreviewId` | 须闸 **再发布** 上一张 official；仅清 `pendingSheet` 不够。前端本地 restore 与闸双轨。符号：`gate.dismissWrite`、`listBeforeWrite`、`releaseLastEmittedConfirm`、`RecordsPanel` L814–872 |
| **现查 0 行上台** | `querySettled === true` → `shouldStageRoundEndPending` 允许 0 行（`biz-pending-stage.ts` L18） | 单表后须闸发布 0 行 settled；`rememberBizPendingSheet` 会拒绝 0 行覆盖有行（L101–106），与 0 行上台冲突。符号：`rememberBizPendingSheet`、`shouldStageRoundEndPending` |
| **刷新后仍是这张** | GET 合并 `official` + `lastEmitted` + `pendingSheet`（`biz.mjs` L907–927）；cache `pendingBySession` | 去掉合并后只靠 official；未发布或 BFF 重启无 lastEmitted → 空表。符号：`peekLastEmittedPending`、`sheetForPendingGet`、`pendingBySession` |
| **写令牌抽屉** | `projectWriteConfirm` 写入 GET 的 `handed`；`setDrawer`（`RecordsPanel`） | 方案要求令牌不并进右栏：须拆 `GET` 响应字段；今天 L919 把令牌投影进 `sheet`。符号：`projectWriteConfirm`、`GET pending` L919–921 |
| **跨对象 hop 侧栏** | `shouldHoldSideKindView`、`kindFocus`/`servedSheet`、`selectKind` → `applySheet(..., sideView)`、`peekBizKindListSheetForOperation` | 禁止 `kindFocus` 覆盖 official 后，侧栏只能靠**不覆盖主表**的本地视图或二次发布；`focus-kind` emit 与方案冲突。符号：`kindFocus`、`servedSheet`、`shouldHoldSideKindView`、`emitBizSheetPending` focus-kind |

---

## 合格 / 不合格与发布时机（代码锚点）

**合格（应发布）**

- `session-round.js` `isEligibleRoundSheet`（L67–78）：非 `ok:false`、非 unfiltered dump；现查 0 行要 `querySettled`；写要有 `previewId` 或行。
- 前端镜像：`shouldStageRoundEndPending`（`biz-pending-stage.ts`）。

**不合格（不发布）**

- `ok === false`、`error === 'TOO_MANY'`（`biz-pending-stage.ts` L3–8；`write.js` refuse TOO_MANY）。
- `noteToolSheet` 对不合格表不升格 candidate（`isEligibleRoundSheet` gate）。

**今天与方案的时间差**

| 路径 | 何时推右栏 |
|---|---|
| AI `biz_preview` | 多数字在 `turn/end` `closeRound` 升格 → watch 读 `officialRoundSheet`；回合内 `servedSheet` 可能已含 `candidate` |
| UI `POST /biz/preview` | `recordSurfaceFromPreview` 立即 `emitBizSheetPending`（可 skip：`previewHall` + `shouldSkipCoveringPending`） |
| 手点型 | `focus-kind` 强制 emit 侧栏视图 |

方案要求：**合格预览成功即发布一次** → 实现锚点应在闸 `previewBiz` 成功返回前/后 + `noteToolSheet` 判定合格，而不是 `servedSheet` 杂糅。

---

## 文件索引（便于下刀）

| 区域 | 路径 |
|---|---|
| 闸过程表 | `runtime/vendor-overlays/dsh-lan-assist/gate.js` |
| 回合候选 / official / kindFocus | `runtime/vendor-overlays/dsh-lan-assist/session-round.js` |
| /state 投影 | `runtime/vendor-overlays/dsh-lan-assist/index.js` `attachOfficial` |
| BFF emit / GET / preview | `runtime/routes/biz.mjs` |
| 轮询 emit | `runtime/lan-assist-state-watch.mjs` |
| GET 合并纯函数 | `runtime/biz/connected-kind.mjs` |
| 令牌投影 | `runtime/biz/write-confirm.mjs` |
| 记录页 | `src/components/biz/RecordsPanel.tsx` |
| 前端缓存 | `src/lib/biz-session-sheet.ts` |
| stage 规则 | `src/lib/biz-pending-stage.ts` |

---

*只读钉死；未改产品代码。若某条行为在上表标为「碰坏」，实现时应停在本清单内改符号，勿新增 GET/SSE 合并例外。*
