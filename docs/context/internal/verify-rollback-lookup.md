# 操作历史回退查找验证

## 用了什么 kind / 主键

- trace_id：`trace_30c7ced0dd9b49d388a15599eb341dfe`
- 回退 lookup：kind=`工单`，no=`TK20250211633`（审计 `record_no` + `lookup_bind.bizKind`）
- preview_id：`pv_0623d234e9c33fe1`

## 为什么以前会空

- 审计 `kind` 写成 speakReceipt 的 `receipt`，回退却拿 trace 上的 `项目任务` 或列推断错型去查，`TK20250211633` 在错表 probe 为 NOT_FOUND → 文案「业务系统里没有」。
- 写入时未持久化 `lookup_bind.bizKind` / where-hop，回退 preview 只有裸 no。

## 本次修复

- 写入：`effectiveBizKind(sheet, body)`、`auditRecordNo(sheet, body, written)`、`lookup_bind_json`（含 `bizKind`、where/hop）。
- 回退：`resolveAuditBizKind` 顺序 audit/bind → 词表列匹配 → trace；`rollbackPreviewBody` 重放绑定。

## SHA

`eb55fed5e6bc998accfae836d14e152674ae52fe`

## 硬编码 none

- `rollback_state` 默认 `none`（013）；`lookup_bind_json` 默认 `{}`（014）。

## 实测

- BFF `POST /api/v1/biz/rollback/preview` 命中工单 `TK20250211633`（fields.id=`371713516372048`），无「业务系统里没有」。
- 截图：[rollback-lookup-found.png](../media/rollback-lookup-found.png)
