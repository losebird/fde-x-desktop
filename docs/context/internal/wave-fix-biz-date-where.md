---
cursor:
  subagentId: "bc-88f20ec3-e4f1-5bcc-a0aa-a0565e368923"
---

# wave-fix · biz 现查 where pass-through（generic）

**时间**：2026-09-17  
**验收样例**：Ace「2026 未完成工单」——仅作示例，**实现无任何 2026/工单/ticketNo 硬编码**。

## 根因

| 层 | 问题 |
|----|------|
| BFF | `translateBizIntent` 原样转发 `where`，但早报等路径用 `{ field, op, value }`，闸只认 `{ keys, values, dateBefore, dateAfter }` → 条件被静默丢弃 |
| lan-assist `plan.js` | 同上，未做 alias 归一 |
| lan-assist `lookup.js` | 中文形位（`状态`、`日期`）在 `termFitsCollection` 前未映射到 collection 列名 → term 被滤掉；`dateAfter` 未进 NocoBase filter；`listAll`/`finishStructured` 固定 `PAGE_SIZE=20` |
| lan-assist `resolve.js` | 客户端 `rowMatchesAll` 无 `dateAfter`/显式边界 |

表现：现查拉第一页 ~20 条，AI 在 prose 里按年过滤 → Ace 看到 7 条，全库 2026 未完成远多于 7。

## 修复（generic pass-through）

### BFF

- `runtime/biz/where.mjs` — `normalizePreviewWhere()`：`{ field, op, value }` → gate 术语（含 `gte`→`dateAfter`）
- `runtime/routes/biz.mjs` — 现查/删除/过审走 normalizer
- `runtime/briefing/collectors.mjs` — 直接发 `{ keys, values }`

### lan-assist vendor overlay (`runtime/vendor-overlays/dsh-lan-assist/`)

- **`where-pass.js`**（新）：`bindWhereKeys`（形位 label → schema 列名 / `vocab.dateField`）、年份 `YYYY` → `dateAfter`+`dateBefore` 区间、`termFilterPart`（含 `dateAfter`）、`listLimitForWhere`（有 where 时 cap 5000 并翻页耗尽）
- **`plan.js`** — `normalizeAliasWhere` 在 `normalizeWhere` 入口
- **`lookup.js`** — `bindWhereKeys` 在 `termFitsCollection` 前；有 where 用 `whereLimit`
- **`resolve.js`** — `dateAfter` / 显式 `dateBefore` 边界
- **`write.js`** — `kindsFromGraphNodes` 读 `dateField`；`finishStructured` 有 structured where 时不截 20

**无** RecordsPanel / Data.tsx 改动。

## 示例 where payload（验收用，非硬编码）

对任意 kind，年份 + 状态 + 单号均可组合：

```json
{
  "kind": "工单",
  "action": "现查",
  "speech": "2026 未完成工单",
  "where": [
    { "keys": ["日期"], "values": ["2026"] },
    { "keys": ["状态"], "values": ["open", "pending", "processing"] }
  ]
}
```

闸内 `bindWhereKeys` 解析后（`biz_tickets` schema + `dateField` 若有）等价于：

```json
[
  { "dateAfter": ["createdAt"], "values": ["2026-01-01"] },
  { "dateBefore": ["createdAt"], "values": ["2027-01-01"] },
  { "keys": ["status"], "values": ["open", "pending", "processing"] }
]
```

NocoBase filter（AND）：

```json
{
  "$and": [
    { "createdAt": { "$gte": "2026-01-01" } },
    { "createdAt": { "$lt": "2027-01-01" } },
    { "status": { "$in": ["open", "pending", "processing"] } }
  ]
}
```

也可用 gate 原生写法或 BFF alias：

```json
{ "field": "createdAt", "op": "gte", "value": "2026-01-01" }
```

单号：`{ "keys": ["ticketNo"], "values": ["TK20260101001"] }` 或 `{ "field": "ticketNo", "op": "eq", "value": "…" }`。

## 分页

- **有 `where`**：`listAll` limit = 5000，按 meta 翻页直到耗尽或达 cap；`finishStructured` 不再截 20。
- **无 `where`**：仍 `PAGE_SIZE=20`（未改 RecordsPanel 浏览行为）。

## 测试

```bash
node --test runtime/tests/biz-where.test.mjs
cd ~/.dsh-fde-x/vendor/dsh-lan-assist && node --test test/plan.test.js test/resolve.test.js
```

## 部署

1. 提交：`fix(biz): pass date where on 现查 preview`（`3589272`）
2. 复制 overlay 到 `~/.dsh-fde-x/vendor/dsh-lan-assist/` 或 `FDE_REFRESH_PLUGINS=1` 后重连 DSH
3. **重启 DSH 进程**（或 disconnect/connect）以加载 overlay 模块
4. runtime BFF 子进程需重载 `biz.mjs`（Vite 热更或重启 runtime）

## Ace 补充（本报告已覆盖）

> matching rows for 2026 未完成工单 should be more than 7 … 现查 must not stop at one page when a date/year where applies.

已用 **generic** `where` 翻页与日期区间实现；7 条来自旧行为（第一页 + prose），修复后同 payload 应返回源侧全部匹配行（至 5000 cap）。

## 相关

- [wave-fix-vocab-wire.md](./wave-fix-vocab-wire.md)
- 截图：[ace-records-empty-after-preview.png](../media/ace-records-empty-after-preview.png)
