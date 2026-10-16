# 业务记录对齐根因（只查不改）

依据：[五问 §9](records-panel-decisions.md)、[项目上下文](project-context.md) 决策 15、[hop 计划](hop-intersection-plan.md)、现网 [I 验证](../internal/verify-records-hop-intersection.md)、截图 `media/records-hop-intersection.png`。  
仓：scene-39 `main` `635787a`。未改产品、未 commit、未删文件、未杀 pnpm。

对照写法：`已对` = 母体/代码出处 + 现网或截图；`未对` = 没在本机再打一次闸；`仍差` = 已看到的裂口。不宣称整页对齐。

---

## 1. 这次 9 vs 1 是什么

已对（现网 I + 截图同一帧）：

- 左 AI：1 张（PAY-2026-005）。
- `GET /api/v1/biz/pending-sheet`：1 行，hop yes（`from` / `hopWhere` / `steps`）。
- 右 chrome：chip `销售回款 1`、横幅 `AI 刚查了 … · 1 行`、footer `共 1 条`。
- 右 tbody：多行，首行 PAY202407106181 已确认，PAY-2026-005 在表底；探针 `tbodyRows !== footerCount`。
- 无「返回」（`listRestore` 未挂在 UI 上）。横幅是现查，不是拟改抽屉。

仍差：chrome 跟 pending 的 1，表体不是那一张。截图里同一单号出现两次，不是一张干净的半表。

---

## 2. 真 apply / 渲染路径（谁读什么）

一条 AI 现查进来，实际有 **三路写 pending、一路画表**，不是单一快照。

```
lan-assist /state.pendingSheet
        │
        ├─ 1s watch → emit biz.sheet.pending（整张 sheet + 顶层 rows: number）
        ├─ GET /api/v1/biz/pending-sheet（BFF 再读 /state）
        └─ POST /preview 成功 → recordSurfaceFromPreview → SQLite biz_surfaces（无行）+ 再 emit
                │
ensureBizRecordsAutoOpen + IMScreen：只 rememberBizPendingSheet（模块变量 lastPending）
RecordsPanel SSE：remember 再 applyPendingSheet(payload.sheet)
RecordsPanel ai.tool.finished：lastPending，没有则再 GET
                │
        applyPendingSheet 闸 → applySheet → setRows + setPending
                │
画：横幅 pending.rows / chip 池+rows.length / footer filteredRows.length / tbody paginatedRows
```

| 表面 | 读的状态 | 出处 |
|---|---|---|
| 横幅「AI 刚查了 · N 行」 | `pending.rows` | 只在 `applySheet` 里 `setPending`（`RecordsPanel.tsx` applySheet） |
| 对象 chip 数字 | `surfacedKindChips`：先 `peekBizPendingSheet()` 当 anchor，再按 `listQueryFingerprint` 扫 session/内存 sheet，最后 `add(kind, rows.length)` | 同上 + `biz-kind-list-cache` |
| footer「共 N 条」 | `filteredRows.length` ← `tableRows` ← 无写抽屉时就是 `rows` | 同文件 tableRows / footer |
| tbody | `paginatedRows` = `filteredRows.slice(page)` | 同文件；`PAGE_SIZE=10` |
| 「返回」 | `listRestore`，**不画那些行** | `showRecordsBack` |
| 浮现历史 option | SQLite `biz_surfaces`（kind/action/row_count/columns，**没有 rows**）+ 会话缓存补 where 文案 | `db.mjs` insert/list；`resolveSurfaceSheet` |

已对：`applySheet` 同一函数里 `setRows(normalizeSheetRows(sheet.rows))` 和 `setPending({ rows: normalizedRows.length })`。按源码，一次成功的 apply 不能单独改 chrome。

仍差：现网 chrome=1 且 tbody≠1，所以 **1 行 hop 没有成为 tbody 的当前 children**，或 tbody 根本不是这一次 render 的 `paginatedRows`。

---

## 3. 闸：哪个会挡、这次哪个不会

### 3.1 不存在「reject-1-row-over-multi-row」

已对：全仓没有这个名字/逻辑。`9972468` 只加了空表拒绝。

真正有的闸：

1. **`shouldRejectEmptyIncomingSheet`**（applyPendingSheet）  
   现表 `displayedRowCountRef > 0` **且** 进来 `rows.length === 0` **且** 动作是现查 → 整次 apply 返回 false。  
   这次进来是 1 行，**未触发**。

2. **`historyPinnedSurfaceIdRef`**  
   选过历史之后：带错 `surfaceId` 的 sheet、或现查但没带 `surfaceId`，直接 false。  
   SSE 入口却先 `historyPinnedSurfaceIdRef.current = ''` 再 apply，钉会被下一条 pending 拆掉。  
   截图下拉仍是占位「本会话浮现历史」，**这次不像钉住旧 surface**。

3. **`sheetRowsFingerprint` / `sameSheet`**（`d2868f4` 为了别把 pager 打回第 1 页）  
   `n` + first + last + query fp。9 行 vs 1 行指纹不同，**不应**因 sameSheet 跳过。  
   applyPendingSheet 里若 query fp 变了会把 `appliedSheetFpRef` 清空，再交给 applySheet。

4. **`maybeSaveListRestore` narrowing**  
   现表 >1 且进来更少（含现查收窄）→ **只存** 大表快照，然后 **照样 applySheet**。成功的话 tbody 应是 1，并出现「返回」。  
   截图无「返回」→ **这次没有挂起 listRestore**。9 行不是「返回」 overlay（overlay 本来也不画行）。

5. **`ensureListRestoreBeforeWritePreview` / hydrate 再 preview 一张更大的现查**  
   只在 **写预览** 且 `surface.rowCount > incomingCount` 时。截图是现查横幅、无抽屉。**这次不像这条。** 仍是别的 mismatch 类（见 §5）。

6. **dismissed 写预览** → `restoreRecordsList()`：`setRows(旧行)` **不** `setPending`。会变成横幅旧、footer/chip 跟大表。这次 footer/chip 都是 1，**不是这条。**

### 3.2 这次最像哪条

已对：

- Server pending 已经是 hop 的 1 行（探针 pendingAfter）。
- chrome 三个数字都读到了 1（横幅=applySheet 写过 pending；chip 最后一笔用 `rows.length`；footer=`filteredRows.length`）。
- 因此 React 侧 `pending.rows` 与 `rows.length` / `filteredRows.length` **都认为是 1**。
- tbody 仍是旧同 kind 列表 + 底下一行 hop 命中；单号重复。

仍差（根因收束，不是方案）：

**不是** 空表闸，**不是** 1-over-N 拒绝（根本没有），**不是** listRestore 回灌，**不是** 写预览抽屉抢 tbody（`tableRows` 只在 `isWritePreviewSheet(drawer.sheet)` 时改读抽屉）。

**是** chrome 已按 hop pending 记成 1，**表体 children 没有换成那一行**。在当前源码里，同一次 render 中 `paginatedRows` 必须是 `filteredRows` 的 slice，按理不能「footer=1 且 tr=9」。现网却就是这样，所以裂口在：

1. **`paginatedRows` 的 useMemo 仍握着旧 slice**（`filteredRows`/`rows` 引用没变、数组被原地改短；footer 读 `.length` 变 1，slice 副本仍是旧 N 行）。`applySheet` 经 `normalizeSheetRows`（`.map` 新数组）按理会换引用；若某处 `setRows(snap.rows)` 复用了后来被改的数组，或 StrictMode 双挂 + 同一 sheet 对象，就能落到这个坑。  
2. **tbody 里多出来的不是这一次 `paginatedRows.map` 的节点**（`sheetRowKey` = `orderId ?? no ?? id ?? index`，同 no 撞 key；截图单号重复 + hop 行贴在表底，像旧 tr 没卸干净、新行追加）。`main.tsx` 开了 `React.StrictMode`。

未对：没有在 5174 上打断点看那一帧的 `rows` vs `paginatedRows` 引用。截图 + 探针足够说明裂口在 **client 画表，不在 hop 闸**。

---

## 4. SSE vs tool-finished vs fingerprint vs 会话缓存

已对：

- Watch：`pendingSheetWatchFingerprint` = query fp + previewId + rowCount + first/last + speech。query 变了即使行数相同也会 emit（`sheet-fingerprint.test.mjs`）。
- SSE payload 带 **完整 `sheet`**（`emitBizSheetPending`），不只顶层 `rows: number`。
- `ai.tool.finished`：`isBizSurfaceTool` 很宽（preview/write/biz/gate/…）。先 `peekBizPendingSheet()`，没有再 GET。与 SSE **不是同一时刻的同一对象**。
- 全局 `ensureBizRecordsAutoOpen` 在 React 外再记一份 lastPending，tool-finished 还会 **再 GET /state**。面板 hydrate 可能跟到上一张或下一张。
- sessionStorage `fde:biz:kind-list-cache`：现查且 rows>0 才记；按 cwd+kind+`listQueryFingerprint` 覆盖。`peekBizKindListSheet` **不传 fp 就返回 null**（故意不拿同 kind 最新）。但内存 `sheetSnapshots` 仍写 `kind:${k}` 最新一张。
- SQLite **没有 sheet_json / 全量行**。只有 row_count + columns_json。历史选中全靠会话缓存。`GET /api/v1/biz/surfaces/:id/sheet` **当前 main 没有**（旧验证文 `2166d50` 有过，现已不在）。

仍差：lastPending（chrome/chip 的 anchor）可以是 hop 的 1 行，而 `kind:` / 旧 `paginatedRows` 仍是上一张同 kind 多行。

---

## 5. 其它仍可能的错位类（禁止写死对象名/行数）

这些这次不是主因，但同一条路径上还活着。

| 类 | 机制 | 人看到的 |
|---|---|---|
| **stale same-kind cache** | `kind:${k}` 最新一张；`matchSurfaceIdForSheet` 同 kind+action 落到 `candidates[0]`；chip 无 anchor 时 `selectKind` 可吃 `kind:` | 换 chip / 写缓存时拿到「同对象最近一次」，不是这次 hop |
| **model one-sided preview** | 模型拆多次单侧 `biz_preview`；面板跟最后一张半表；pending 无 `from`/hopWhere | 左口述交集，右目录半表。I 这次 pending 已 hop，**不是这类** |
| **isolated leftover kind** | 口语短名绑到未接连接器的孤立 kind；或 hop 链上另一个 kind 的旧 snapshot | chip 上出现这次条件不该还挂着的对象，点进去是另一张表 |
| **empty-reject 留旧表** | 空现查抛掉，旧多行还在 | footer 仍是旧 N，chrome 不跟空 pending |
| **write-preview tbody 分叉** | `tableRows` 改读 `drawer.sheet.rows`；`pending`/`rows` 可以是另一张 | 抽屉 1 行、表 N 行或反过来 |
| **restore 回灌大表** | `restoreRecordsList` 改 rows 不改 pending | 横幅 1、footer/chip 跟大表 |
| **hydrate 为写预览再 preview 大表** | `rowCount <= incomingCount` 才停；更大就 `bizPreview(现查)`，SSE 可能把大表 apply 回来 | 1 行写预览后又摊开 |
| **operationBundlesAlign 过松** | speech 相同或 hopWhere≡where 就算同一操作 | 历史/chip 切到「像同一句」的另一张 |
| **SSE 拆历史钉** | 选历史刚 pin，下一条 `biz.sheet.pending` 清空 pin 再 apply 最新 | 点了历史，表又跳回 pending |

---

## 6. 「本会话浮现历史」为何难用

产品规则（已有，不新编）：历史 = **本会话 AI 浮现过的表**（kind + 动作 + where/hop 身份），不是操作记录。点一条必须换成 **那一次** 缓存行。命不中 → 请人重新浮现。禁止拿同 kind 最新冒充。禁止 SQLite 堆全表。

### 打开

已对：

- `<select value={historySurfaceId}>` 默认 `""`，永远显示占位「本会话浮现历史」。`applySheet` / pending 现查 **不写** `historySurfaceId`。表已经在变，下拉仍像没选。
- option 文案：`kind · action · (briefQueryScopeLabel \|\| 时间)`。scope 只来自 **缓存里的 sheet**。缓存没有 → 只剩 kind·动作·钟点，看不到 hop/where。
- `sessionSurfaces`：有 `pending.sessionId` 才滤本会话；没有就 **整个 workspace 的 surfaces**（`listBizSurfaces` 按 cwd，不按会话）。和「本会话」字面不符。
- SQLite 行没有 where/hop/行，打开时无法预览将切到哪一张。

人无法判断：现在表对应哪一条、两条同 kind 现查有何不同。

### 选中

已对：`onChange` → `loadSurface`：

- 钉 `historyPinnedSurfaceIdRef`，清抽屉、清 listRestore、`setRows([])` 再 `resolveSurfaceSheet`。
- 命中：内存 `surface:{id}` → session `peekBizSurfaceSheet` → kind-list by surfaceId → previewId → 再 by previewId。然后 `applySheet`。现查会 `rememberBizPendingSheet`（用 **那条缓存** 覆盖 lastPending）。
- 写预览未 dismiss 会再打开抽屉。

仍差：

- 下一条 SSE **先清 pin 再 apply 最新 pending**，选中不粘。像「点了没切」或切完又跳回去。
- `matchSurfaceIdForSheet` 把新 sheet 记到 **同 kind+action 的第一条 surface id** 上，会话缓存会冒充。
- 选中不跟 `listQueryFingerprint` / hop 身份对齐，只跟 surface id。id 被写错就换错表。

### 缓存 miss

已对：`resolveSurfaceSheet` 全 miss → 空表 + 「该条浮现的行已不在待确认区；请在 AI 会话里重新现查或改行。」不回源系统拉全表（符合不堆全表）。

仍差：hint 在表上灰条，下拉仍停在那条 id；人以为控件坏了。没有「哪一次（kind/动作/条件）」的复述。空 option 再点占位 `if (!id) return`，什么都不发生。

### 写预览开着

已对：`loadSurface` 先 `setDrawer(null)`，不让抽屉挡住切换。随后若该 surface 自己是未 dismiss 的写预览，会再打开。

仍差：写预览 hydrate 可能再 preview 一张更大现查（§3.1.5）；SSE 清 pin 后最新写预览会回来。看起来像历史切不动。

### chrome 变了、tbody 没有

与 §3.2 同一条缝：

- 历史只换了 SQLite 元数据/chip/横幅（pending 或 surface.rowCount），行还在会话里另一张 id 上。
- 或 pin 拒绝了带 sheet 的 apply，但 `rememberBizPendingSheet` 已在 SSE 里执行（chip anchor 已是新表）。
- 或 miss 把 `setRows([])` 了，footer 0，但旧 tbody 节点还在（与这次 9 vs 1 同类）。

点下拉时人没有「将切换到：对象 / 动作 / 条件 / 行数」的预告，也没有切完后「已是这一次」的选中态（占位还在）。所以不能判断表有没有换。

---

## 7. 给方案的约束（不实施）

- 表体、footer、chip、横幅必须绑 **同一张 sheet 快照**（同一 row 数组身份），禁止 chrome 走 lastPending、tbody 走另一份 memo/旧 tr。
- 收窄现查必须 **整表替换** children，不能依赖 sameSheet/空闸/listRestore 的副作用。
- 不存在的 1-over-N 拒绝不要当已修；若要加闸，那是新方案，且不能写死行数/对象。
- 历史：option 要有 kind+动作+where/hop 身份；选中只 apply **该 surfaceId 的会话缓存**；miss 只提示重浮现；SSE 不得在人还停在历史时偷偷清 pin 用最新 pending 冒充。
- 继续禁止 SQLite 存全表；禁止 `kind:` / `candidates[0]` 当「那一次」。

未对：现网未再打闸、未在运行时打印 `rows === paginatedRows` 引用。现网证据以 I 验证文和截图为准。
