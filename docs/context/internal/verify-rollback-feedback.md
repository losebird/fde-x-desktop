# 操作记录回退反馈 · 验证

## 根因（第一次无反馈）

| 项 | 结论 |
|----|------|
| 写回有没有发生 | 第一次点「确认回退并写回」会走 `bizRollbackPreview` + `bizWrite`；失败时原先只在确认抽屉内写 `rollbackError`，**列表顶栏无桌面反馈**；成功则直接关抽屉/关 trace **无任何成功文案**。 |
| 为何像「第二次才报错」 | 确认抽屉与 trace 抽屉同屏叠放（同为 `z-40`），首击失败时红字在右侧确认层，用户视线常在列表/trace 上；再次点确认时预览/写回重复，错误再次写入抽屉 + 此时用户更易看到。并非「第一次没请求」。 |
| 「可回退」不更新 | BFF `enrichTraceRows` 仅用 `canRollbackAudit(改行+changes)` 算 `canRollback`；**`rollback_state` 库列存在但 UI 未读**，成功/永久失败后仍显示「可回退」。 |

## 修复要点（`records-panel-decisions.md` §8）

- 打开回退：服务端预览一次，缓存 `preview_id`；确认只写回并带 `rollback_of_trace_id`。
- 成功/失败：抽屉内错误 + **操作历史卡片顶栏** `rollbackFeedback`（绿/红）。
- 持久化：`biz_write_audit.rollback_state` → `rolled_back` / `blocked` / `none`；列表 `rollbackBadge`：可回退 / 已回退 / 无法回退。
- 503 / 不可达：不标 `blocked`，仍可回退。

## 硬编码 `none`

- 迁移默认：`rollback_state TEXT NOT NULL DEFAULT 'none'`（`013_biz_write_audit_rollback_state.sql`）。
- 修复前 API 行对象无状态字段，前端 `Boolean(item.canRollback)` 仅看改行+差异，等价于永远忽略库里的 `none` 以外状态（列尚未接入）。

## 提交 SHA

`2dd7cbb212fc4152749dbcf6c5780f7c0c21d5b3`（`main`）

## 截图

- `files/media/rollback-feedback-success-or-fail.png` — Playwright 点确认后可见失败/成功类文案（本机 5174）。
- `files/media/rollback-badge-updated.png` — 操作历史列表（含状态 tag 或顶栏反馈）。

## 现网未测

未在 Ace 宿主外网复测；本机 `curl /api/v1/biz/traces` 返回含 `rollbackBadge` / `rollbackState` 字段。
