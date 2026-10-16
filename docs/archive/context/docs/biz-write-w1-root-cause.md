# W1 手测根因（新建工单确认过账 + 现查 abort）

手测集：[增删改审手测集](biz-write-eval.md) **W1** + 你追加的「同句再请求 / 现查 receipt」。  
结论：**只查因，未改产品。** 证据见 [internal/biz-write-w1.md](../internal/biz-write-w1.md)。

## 一句话

右栏点对 **`pv_ac8c1ff15e1938be`** 确认时，闸已是 **`EXPIRED`**，但 BFF 把 lan-assist `/write` 的 HTTP 400 **误报成**「过账失败，请重新预览后再试」；左栏随后用 **新令牌** `pv_3666248f266a5137` 的 **`biz_write` 才真正写入** receipt **`388329877078016`**。右表仍停在新建预览，是因为 **过账失败未收抽屉 + pending 被后续误预览覆盖**；现查 abort 是 leftover 状态机程序 `cancel`，Harness 记成 `user`，不是你停生成，也不是 reload。

---

## 1. 右栏确认时 BFF 真实返回与红条映射

| 层 | 实际内容 |
|---|---|
| **闸（lan-assist `/write`）** | `lines[0].error = EXPIRED`，`lines[0].hint = 预览过期了。要写再预览一次。`（HTTP 400，body 顶层 **没有** `error`/`hint` 字段） |
| **BFF `POST /api/v1/biz/write`** | HTTP 400，`code: ai/im-error`，`message: 过账失败，请重新预览后再试`（与右栏红条一致） |
| **红条文案来源** | `RecordsPanel` → `formatBizPanelError(..., '过账失败，请重新预览后再试')`；BFF catch 里 `bizWriteFailureMessage` 在见到 **`IM 调用失败：HTTP 400`** 时 **丢弃** `lines[].hint`，退回上述 fallback |

**为何是 EXPIRED：** 有效预览 **`pv_ac8c1ff15e1938be`** 在 seq 46 发出，`expiresAt = 1790193636044`（**PREVIEW_TTL_MS = 90s**）。你在 **19:59 预览 → 约 20:00 后点确认**（Turn2 用户话在 20:07），令牌已过期。2026-09-24 用同令牌探测：直连 `/lan-assist/write` 仍为 EXPIRED；经 BFF 则为 generic 红条。

**不是：** preview_id 不一致、409、NocoBase WRITE 失败（那些会出现在 `lines[]` 或 `ok:false` 的其它 error 上；本次写入成功的 receipt 来自 **后一次** 预览令牌）。

---

## 2. 左栏 `biz_write` 与右栏按钮：几次写？库里有吗？

| 次序 | 通道 | preview_id | 结果 |
|---|---|---|---|
| 1 | 右栏 BFF write（手点确认，推断） | `pv_ac8c1ff15e1938be` | 失败（EXPIRED；UI 见 generic 红条） |
| 2 | 左栏工具 `biz_write` Turn2 step2 | `pv_ac8c1ff15e1938be` | 失败 EXPIRED（session 明文） |
| 3 | 左栏 `biz_preview` | `pv_3666248f266a5137` | 新预览 |
| 4 | 左栏工具 `biz_write` Turn2 step4 | `pv_3666248f266a5137` | **成功 receipt `388329877078016`** |

- **不是两次成功写入**：仅 **第 4 步** 进 NocoBase（工具结果 + `state.json` 现查行：`title=手测新建`，`updatedAt=2026-09-23T20:08:35.047Z`）。
- **`biz_write_audit`（BFF SQLite）无此 receipt**：audit 只在 **BFF write 200** 时插入；成功路径是 **DSH 内嵌 `biz_write` 工具**，未走 `/api/v1/biz/write`。
- **`biz_traces` 按单号查空**：`traces.projection.md` / `traces.sqlite` 未 ingest 回执；**不能**据此判「没写库」。

---

## 3. `tool call aborted` 谁掐的？现查参数为何 abort？

- **谁：** DSH session **`turn/end`**，`reason: { kind: "aborted", reason: { kind: "user" } }` — Harness 记账里的 **`user` 是 cancel 请求的 kind**，含 **程序主动 cancel**（`session-round` leftover、`RecordsPanel` → `cancelAi`），**不等于** Ace 点了停止或聊天框又发了一句。
- **不是：** 5174/4318 reload、BFF 写挂起、DSH 4318 僵尸（本次 abort 与 write 已完成后的现查同 turn 并行取消相关）。
- **为何现查 `kind=工单 action=现查 no=388329877078016` 仍 abort：** 同 turn 内 **误落成 `action:"新建"` 的写预览 candidate** + 后续 **按单号现查** 触发 `noteToolSheet` leftover → `cancel({ kind: 'user' })`（及/或右栏 `cancelAi`），并行 read/traces 同毫秒 abort；与「手点停生成」无关。误新建与 abort **同源不同相**（见 `docs/tool-call-abort-root-cause.md`）。

---

## 4. 确认失败后为何右表仍「新建 · 待确认 · 总数未知」

1. **`confirmWrite` 失败只设 `setError`，不关 drawer、不清 pending** → 仍显示「工单 · 新建 · 1 行 · 待确认」。
2. Turn2 后续 **`biz_preview` 误路由** 把 pending 换成 **`pv_be623a9d4d2bf17f`**（仍是 **新建**、**changes: []**、canWrite true），右表 **不会** 切到已写入行的现查。
3. **页脚「总数未知」：** 写预览 `packSheet` **不带 `hitTotalState`**，`RecordsPanel.hitFooterText` 对非现查命中集默认 **总数未知**（不是 connector count 失败）。

---

## 5. 与 W1 手测集的判定

| W1 期望 | 本次 |
|---|---|
| 左：新建预览、有令牌；**未过账** | Turn1 满足；Turn2 模型 **擅自 `biz_write` 过账**（手测集 W1 要求只预览） |
| 右：抽屉「操作：新建」、未过账 | 预览阶段满足；确认失败后 **状态未回收** |
| 失败不得假装成功 | 左栏在 **BFF 已红条失败** 后仍 **写库成功**（第二条路径），右表 **未** 反映已写入 |

---

## 6. 修复方向（记录用，本次未做）

1. **BFF / `lanAssist`：** HTTP 400 的 `/write` 应从 **`lines[0].hint` / `lines[0].error`** 映射到 `sendError`，避免一律 `IM 调用失败` + generic 红条。
2. **产品行为（若要与 W4 一致）：** 过账失败应收抽屉或刷新 pending；写预览页脚应对「1 行新建预览」给出明确 copy 或 `hitTotalState: known, hitTotal: 1`。
3. **闸 / 会话：** 现查带 `no=receipt` 时不应被 **`recoverWriteIntent`** 重判为新建（W1 后续现查 abort 的叠加因）。

详细 seq、HTTP 摘录、SQLite 查询：[internal/biz-write-w1.md](../internal/biz-write-w1.md)。
