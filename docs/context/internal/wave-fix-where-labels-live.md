---
cursor:
  subagentId: "bc-live-where-labels"
---

# wave-fix · live `field:状态` on fdex测试 工单

## NOT_FOUND 原因

1. **`bindWhereKeys` 在 preview/lookup 路径会跑**（`lookup.js` → `cluesFromWhere` → `bindWhereKeys`），但 **`plan.js` 的 `normalizeTerm` 会给每条 term 带上 `dateBefore: []` / `dateAfter: []`**。在 JS 里空数组为 truthy，`bindWhereKeys` 误判为日期条件，走 `expandYearOnDateSlot` 并 **直接 `continue`，从未把 `keys: ['状态']` 解析成 `status`**。随后 `termFilterPart` 无 ASCII 列、`rowMatchesAll` 用 `row['状态']` 匹配 → 0 行 → **`NOT_FOUND`**（不是 `WHERE_UNBOUND`）。

2. **次要：词表 shape「状态」+ 连接器 title「工单状态」+ 多 enum 列** 时，`inferLabelsFromVocabAndSchema` 曾把「状态」绑到第一个未映射 enum（如 `category`）。已在 `resolveStatusShapeKey` / 推断顺序上优先 `status|state|stage` 与 title 含「状态」。

3. **「状态」不是 collection/kind**：NocoBase `collections:list` 无 title/name 为「状态」的集合；`mapKind('工单')` → `biz_tickets`。词表 工单 `fields: [ticketNo, 单号, 状态]` 无 `fieldLabels` / `resource`（memory graph），绑定靠 connector schema + shape 推断，**未调用 `POST /vocab/generate`**。

## 现网行数（`POST /api/v1/biz/preview`，workspace `/Users/zxz/Documents/ai-project/fdex测试`，`processing`）

| where `field` | matches / 行 |
|---------------|----------------|
| `status` | **70** |
| `状态` | **70** |

（reload + connect 后；`data.matches.length`，与 status 路径一致。）

## 改动

- `runtime/vendor-overlays/dsh-lan-assist/where-pass.js`：`dateBefore`/`dateAfter` 仅在有元素时走日期分支；status shape 标签优先绑定。
- `runtime/tests/where-pass-labels.test.mjs`：空 date 槽 + 工单状态 title 回归。
- 已 overlay 到 `~/.dsh-fde-x/vendor/dsh-lan-assist/where-pass.js` 与 profile `node_modules` 同源副本；`POST /api/v1/ai/reload` + connect（未杀 5174/4318/pnpm）。

## SHA

`f74eb9a92d26179d7fac7a798e3e27ef26ad6987`

## generate

**不需要。** connector 已有 `status`（title 工单状态）与 enum；fix 后无 persisted `fieldLabels` 也能绑。
