---
cursor:
  subagentId: "bc-4b898464-0106-550a-93a7-88f01381af4c"
---

# Wave: preview 过账路径 + 取消不关闪

## 根因（已查）

| 现象 | 机制 |
|------|------|
| 红条「IM 调用失败: HTTP 400」 | 前端已走 `POST /api/v1/biz/write` → BFF `lanAssist('/write')`；lan-assist 对 `ok:false` 回 **HTTP 400**；`dsh-core` 抛 `AiRemoteError` 文案带「IM 调用失败」，全局 catch 再 502/原文透到 UI |
| 取消/关闭闪一下又开 | 只 `setDrawer(null)` + 列表恢复；**未**清 lan-assist `pendingSheet`；`biz.sheet.pending` / `getBizPendingSheet` / state-watch 仍推同一 preview，`applyPendingSheet` 再次 `setDrawer` |

确认过账**不是** IM `/send`；是 write 失败文案与 pending 未 dismiss。

## 改动

| 文件 | 内容 |
|------|------|
| `runtime/routes/biz.mjs` | `POST /api/v1/biz/preview/dismiss` → `lanAssist('/write/cancel')`；`/biz/write` try/catch + `ok===false` → `biz_write_failed` + hint；write body 带 `workspace` |
| `src/lib/runtime-api.ts` | `bizDismissPreview()`；`bizWrite` 可选 `workspace`/`cwd` |
| `src/components/biz/RecordsPanel.tsx` | 取消/关闭：`bizDismissPreview` + `clearBizPendingSheet` + `dismissedPreviewIds`；过账：`bizWrite(preview_id, workspace)`；错误去掉 IM 套话 |
| `runtime/tests/biz.test.mjs` | 静态断言 dismiss/write 路由 |

取消路径：**无** `biz_write`。

## 验证

- `pnpm exec tsc --noEmit` 通过
- `node --test runtime/tests/biz.test.mjs` 10/10
- 现网 Ace 改行确认 / 过账 / 取消：未测

## Commit

`fix(web): biz write path and dismiss preview drawer` on `main`
