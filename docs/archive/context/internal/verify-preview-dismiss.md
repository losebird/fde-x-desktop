# 写预览取消回归 · 验证

## 根因（谁重开）

1. **BFF / SSE 同源 pending**：lan-assist `pendingSheet` 在 `/write/cancel` 后仍可能被 state-watch 每秒读到；`emitBizSheetPending` 与 `GET /pending-sheet` 未过滤已 dismiss 的 `preview_id`，前端 `hydrateFromPending` / `biz.sheet.pending` / `ai.tool.finished` 再次 `applyPendingSheet` → `setDrawer`。
2. **指纹短路在 dismiss 之前**：`applyPendingSheet` 对相同 `sheetRowsFingerprint` 提前 return，部分路径在 dismiss 后仍用「未 dismiss 的 pending 内存」配合 `loadSurface`（surface 仍带 `previewId`）重开抽屉。
3. **restore 误写 pending**：`restoreRecordsList` 对写预览 snapshot 仍 `rememberBizPendingSheet`，取消后返回列表时把写预览 sheet 塞回 pending。
4. **diff 回归（非开关）**：SSE/pending API 未透传 `changes`；`buildPreviewSummary` 在无 `originalRow` 时走全列 `buildPreviewFieldChanges`，未改字段与 `createdById` 等一并展示。

## 修复要点

- BFF：`rememberBizPreviewDismissed` + dismiss 带 `preview_id`；`pending-sheet` / `emitBizSheetPending` / state-watch 过滤 dismissed；payload 含 `changes`。
- 前端：dismiss 先记 id + `sessionStorage`；`applyPendingSheet` 先判 dismissed；hydrate/tab 不再 apply 写预览；restore 不写 write pending。
- diff：优先 `sheet.changes`，无 original 不扫全列。

## 实测（2026-09-18T07:20:07.410Z)

| 步骤 | 结果 |
|---|---|
| 取消后抽屉 | 曾打开，已点取消 |
| dismiss API | HTTP 503 |
| pending-sheet | null |
| 切 tab 后再进业务记录 | 改行确认 不可见（通过） |

## Git

- SHA: `b0bd768`
- 硬编码 kind/动作/字段：**none**（词表驱动 preview API 仅验证脚本入参；产品路径无新增写死）

## 截图

`media/preview-stays-dismissed.png`
