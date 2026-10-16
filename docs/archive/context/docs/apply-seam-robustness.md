# apply 缝：`5e37f0b6` 够壮吗？（给 Ace）

对照 [口语进库后右栏为什么空](spoken-write-empty-panel.md)。只审 `5e37f0b6` 与当前 `RecordsPanel` / `biz-records-auto-open`，未改产品。

## 一句话

对 **18:02 那一类**（闸里有 `pv_*` 写预览、`工单` 型、catalog 只认 `Ticket` 导致映射失败，再叠加 apply 失败后清表、已选 kind 不再拉闸）：**够壮**。

还会再空的主因已换成别条：**会话 id 一刻对不上**、**covering / pin / dismiss** 等其它 `applyPendingSheet` false、或 **GET 失败静默**——不是当初那条 catalog+清表+不 hydrate 三连。

---

## 逐条（够 / 不够 + 行号）

| # | 标准 | 判定 | 位置 |
|---|------|------|------|
| 1 | catalog 对不上「工单」时，有 `preview_id` 且 `rows>0` 的写预览仍能画上 | **够** | `RecordsPanel.tsx` 206–208、962–970；`connected-kind.ts` 150–169 |
| 2 | apply 失败不得 `clearDisplayedForSession` 清成空表 | **够** | `RecordsPanel.tsx` 1118–1129（失败 → `setStaleHint`）；1131 仅无有效 pending 再清 |
| 3 | round-end `biz.sheet.pending` 后再 GET；已选 kind 不跳过 hydrate | **够** | `1165–1184`、`1059–1087`、`1157–1163`；`biz-records-auto-open.ts` 22（无 tool-finish GET） |
| 4 | `sheetBelongsToSession` 不误丢同会话 | **够** | `biz-session-sheet.ts` 51–58；`RecordsPanel.tsx` 973、1064、1176–1181 |
| 5 | 现查 / 问卡 / 历史 pin 不被兜底误伤（决策 22） | **够（代码面，未手测）** | 现查/问卡仍走 catalog 挡（965–967）；pin `978–979`、`1060`、`1171–1172`；删 `ai.tool.finished` 靠 round-end pending |
| 6 | 单测盖住 1–3 | **不够 — 没有** | 无 `gatedWrite` / hydrate GET / 失败不清表 行为测；`records-align.test.mjs` 仅形态断言 |

---

## 仍脆（会再空时先看哪）

1. **`activeAiSessionId` ≠ `sheet.sessionId`** → 事件与 hydrate 直接 return（`973`、`1181`）。
2. **`shouldRejectIncomingCovering` / `shouldSkipCoveringPending` / 历史 pin / dismiss** → apply 仍 false，最多 staleHint，表仍空。
3. **无单测**：上述 1–3 加固靠读码，回归无网。

完整证据：[internal/apply-seam-robustness.md](/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/internal/apply-seam-robustness.md)。
