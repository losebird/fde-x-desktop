# 口语进库后，右栏为什么空（给 Ace）

令牌 **`pv_11a0e67b3cf004df`**，会话 `session-0b9d3ea9-00d4-42cc-9fe6-29d8a6651e90`。只讲因果，不改产品。

---

## 闸里到底有没有预览？

有。`GET /api/v1/biz/pending-sheet`、`im/state`、outbox **`18:02:30`** 的 `biz.sheet.pending` 都是：**工单 · 新建 · 1 行 · `canWrite: true` · sessionId 对齐**。SQLite `biz_surfaces` 也记了 `row_count=1`。  
你看见的绿条「事务底座运行正常」、页脚「总数未知」、表体「当前型还没有可展示的行」——是 **RecordsPanel 已打开，但 `rows` 没灌进去**，不是闸没出预览。

---

## 口语进库改坏的是「推给右栏的 sheet」吗？

**基本没有。** 和同会话 **17:10** 的 `pv_91f89f9474bcd4fc` 比：`kind`、`action`、`rows`、`canWrite`、`sessionId`、`speech`、列和变更 **一样**，只差 previewId。

`c184266b`（口语进库）动的是闸里 **过账用的 `token.patch`**（关系 id、`stripRelationKeys` 等）和现查 where；**`packSheet` → 右栏吃的 sheet 形状没变**。处理人仍是展示值 `ace`，不是「进库把行删了」。

---

## 右栏代码上卡在哪？

出事当时：`applyPendingSheet` 在 catalog 非空、`resolveConnectedKind('工单')` 为空时 **整段 false**（本地用 `{kind:'Ticket', aliases:['工单']}` 能复现）。false 之后 session GET 再 **`clearDisplayedForSession`**，表就被清成「当前型还没有可展示的行」。有当前型之后不再拉闸。

`5e37f0b6` 之后映射失败会改用 sheet 自带 kind 画表，失败也不再清表。若只读修完后的代码，会误以为「型映射不会挡写预览」——那是补丁，不是 18:02 的现场。

`stripRelationKeys` / `displayPatch` 不在右栏吃的 emit sheet 里，不是这次空表。

---

## 和 17:57 BFF 重启、口语进库怎么叠？

- **口语进库 `c184266b`：不直接裁表。** 右栏收到的 sheet 和 17:10 那张同形。
- **空表主因：apply 映射失败 + 失败清表。** 你等过 round-end 仍空，对得上这条，对不上「再等几秒」。
- **BFF 重启：叠加。** SSE 断过，hydrate 更脆；这次预览在 17:58 connect 之后，不是重启把预览删了。

---

## 以前好、这刀之后坏——用人话

口语进库改的是闸里过账用的关系 id，**没有改右栏那张表的形状**。左边和闸一直有行。

你看见「一改口语进库右边就没了」，是因为同一段：**挂 overlay、重连 DSH、为复制重启 BFF、你又用同一句话新建第二轮**。右栏那条「catalog 对不上工单就失败、失败就清表」的缝被踩穿了。以前没叠在一起打，所以看起来好好的。

不是进库把 pending 裁成 0 行，也不是再等十几秒就会自己好。

---

*完整证据与代码行号见 Project 内 `internal/spoken-write-empty-panel.md`。*
