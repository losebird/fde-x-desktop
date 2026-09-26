---
cursor:
  subagentId: "bc-filter-page-worker"
---

# wave-fix · 业务记录现查 where + 分页

## SHA

`d2868f406dd379e48e154f8a6a4e3d30fa706763` on `main`

## 根因 · 未过滤 / 1665 条

| 层 | 原因 |
|----|------|
| **RecordsPanel** | `kind:${kind}` 快照与 `biz-kind-list-cache` 只按型缓存，后到的无 where 全表或 list-restore 用的 `bizPreview({ 现查 })` **不带 where**，把全量行写回 `kind` 缓存；SSE/`hydrateFromPending` 再次 `applySheet` 时展示全表。 |
| **BFF** | `translateBizIntent` 只读 `body.where`，操作控制/部分调用把条件放在 `input.where` / `input.filter` 时 **where 未进 lan-assist**，`structured` 为 false，仍按 20 条/无筛选路径。 |
| **lan-assist lookup** | `termFitsCollection` 因枚举表不含中文状态值等原因 **丢掉 where term**，条件未参与 `rowMatchesAll` / NocoBase filter；有 where 但 term 全丢时应拒绝整表现查（`WHERE_UNBOUND`）。 |
| **sheet 载荷** | `packSheet` 未带 `where`，前端无法区分同型不同筛选的列表。 |

## 根因 · 下一页闪回第 1 页

| 层 | 原因 |
|----|------|
| **RecordsPanel** | `applySheet` / `applyPendingSheet` 在 **同一张 sheet 重复浮现**（`biz.sheet.pending` 轮询、hydrate、surfaces 刷新）时仍 `setPage(1)`，翻页后立刻被重置。 |

## 修复摘要

- `src/lib/biz-list-query.ts`：where / sheet 指纹；缓存键 `kind:…:q:…`
- `RecordsPanel`：同指纹跳过重复 apply；list-restore hydrate 带 `extractSheetListWhere`；`setPage(1)` 仅在新 sheet 时
- `biz.mjs` + `lan-assist-state-watch.mjs`：pending/SSE sheet 带 `where`/`hopWhere`；`input.where`/`input.filter` 归一
- `write.js`：`packSheet.where`；现查 `finishStructured` 写入 plan where
- `lookup.js`：`WHERE_UNBOUND`；`termFitsCollection` 不再因枚举别名丢 term；`listLimitForWhere` 与有效 term 对齐

## 验证

- `node --test runtime/tests/biz-where.test.mjs` — 绿
- 5174 业务记录：**现网未测**（本机重启 runtime:4318 后 DSH 未连，`biz/preview` 返回 `ai/not-connected`）。需 DSH 重连 + 复制 overlay 到 `~/.dsh-fde-x/vendor/dsh-lan-assist/` 并 reload lan-assist 后再测：带 `where` 的现查条数 ≠ 全表 1665；点两次「下一页」停留第 2 页、序号 11…
- 截图路径（脚本尝试）：`files/media/records-filter-page.png` — 表为空时仅占位

## 已摸过

- Playwright 探针：无 where 现查 20 条；`status=__fde_proof_missing__` 在 **旧 runtime** 上仍 20 条（印证 where 未进闸）
