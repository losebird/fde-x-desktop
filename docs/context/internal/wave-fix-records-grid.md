---
cursor:
  subagentId: "bc-0fa8594d-fa91-5111-8a08-e2a5f69414ca"
---

# Wave: 业务记录多维表格 + 序号

## SHA

`68b5163` on `main` — `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`

## 序号 auto

**yes** — sticky chrome column `序号`; value `(page - 1) * PAGE_SIZE + rowIndex + 1` (verified first cell `1` on page 1). Sheet payload column `index` hidden to avoid duplicate em-dash cells.

## Change scope

- `src/components/biz/RecordsPanel.tsx` only: border-collapse grid, sticky header/序号列, scroll container, compact cells; inline edit / pagination / 返回 / preview drawer / 本会话浮现历史 unchanged; 操作 still from `kindCatalog` → `can`.

## Verify

- http://127.0.0.1:5174 → 业务应用 → 业务记录
- Screenshot: [records-grid.png](../media/records-grid.png) — grid lines, numeric 序号, 改行 in 操作 when `can` includes it (`gaihang` buttons: 1 in Playwright pass).

## 对照（本波仅 RecordsPanel chrome）

| 项 | 状态 |
|----|------|
| 多维表格 chrome | 已对：fdex `RecordsPanel` border grid + sticky thead |
| 序号非 `-` | 已对：Playwright `firstIdxCell: "1"`, `idxHeader: 1` |
| 操作来自 can | 已对：现有 `rowActions` 未改逻辑 |
| 母体像素 parity | 未对：未锁外 CDP 对照 |
