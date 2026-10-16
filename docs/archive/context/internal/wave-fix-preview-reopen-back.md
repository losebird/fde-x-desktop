---
cursor:
  subagentId: "bc-1beba752-1f16-5536-b048-aea6afeb9886"
---

# Wave: 取消预览后抽屉重开 + 返回消失

## 症状（Ace / 截图 `ace-preview-reopens-no-back.png`）

1. 业务记录单行改行预览态下顶栏无「返回」。
2. 用户点「取消」关闭改行确认抽屉后，抽屉仍被 pending hydrate / SSE / auto-open 再次打开。

## 根因

1. **listRestore 未捕获**：`shouldSaveListRestore` 在 `rows.length === 0` 时直接放弃，而 AI pending 首次 hydrate 常在此态；多行列表只在 `kind:` sheet 快照里，未写入 `listRestore`。
2. **取消后 pending 仍被记住**：`rememberBizPendingSheet` 与 `peekBizPendingSheet` 不感知已取消的 `preview_id`；`biz.sheet.pending` / `ai.tool.finished` 路径会再次把同一 sheet 写回内存并触发 `applyPendingSheet` → `setDrawer`。
3. **dismiss 仅挂在 drawer state**：取消时若 `drawer.previewId` 未及时带上，dismiss 集合未命中，后续 hydrate 仍开抽屉。

## 修复

| 区域 | 行为 |
|------|------|
| `biz-session-sheet.ts` | 模块级 `dismissedPreviewIds`；`dismissBizPreviewId` / `clearBizPreviewDismissed` / `isBizPreviewDismissed`；`remember`/`peek` 跳过已 dismiss 的写预览 sheet |
| `captureListRestore` | `rows` 为空时从 `kind:` 快照补多行 rows/columns |
| `shouldSaveListRestore` | `rows` 为空时用快照行数判断变窄/post-action，允许首次捕获 |
| `applyPendingSheet` | 已 dismiss 的写预览：有 `listRestoreRef` 则不改 UI、不 `remember`、不开抽屉；否则只 `applySheet` 不开抽屉 |
| `hydrateFromPending` | 缓存/服务端 sheet 若已 dismiss，有 listRestore 则短路，避免重开 |
| `handleRecordsBack` | `previewId` 取自 drawer 或 `peekBizPendingSheet`；先 dismiss id + `clearBizPendingSheet`，再 `restoreRecordsList`；`bizDismissPreview`（非 biz_write） |
| UI | `showRecordsBack` 绑定 `listRestore`（与 ref 同步）；抽屉开/历史下拉不清快照 |

## 明确未做

- 未恢复 `Data.tsx` force-tab-to-records（1452e52 保持）。
- 未打包、未杀 pnpm、未 `git add -A`。

## 验证

- `pnpm exec tsc --noEmit`：通过。
- 现网 UI：未测。

## 提交

- repo: `scene-39-personal-workstation`
- branch: `main`
- commit: `a6cac0c` — `fix(web): keep 返回 and stop reopening cancelled preview`
