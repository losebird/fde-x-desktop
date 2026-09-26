---
cursor:
  subagentId: "bc-76159c26-9692-5155-9364-76a1ef0f770d"
---

# 操作记录 corpus / 回退 · 验证

## 闸上

| 项 | 值 |
|---|---|
| main SHA | `7e6226accca9b1d9766f7254a9c370799eeb2a2d` |
| pass | yes |
| corpus 是否原文 | yes（记下的原话「改行工单」，标题「当时原文」，不是 JSON / 回执） |
| 回退反馈 | 已回退并写回。 |
| 是否又长出可回退 | no |
| 有没有静默写 | no |
| 硬编码 | none |

## 现网（5174）

- 审查 corpus 按钮仍在：yes
- corpus JSON：no
- corpus 摘录：`当时原文 | 改行工单`
- 列表 原值→新值：yes（工单状态 已分派→新建 / 新建→已分派）
- 生成计划表单：no
- 确认后 toast：`已回退并写回。`（顶栏 alert + 列表内条）
- 成功条已回退：yes（改行条 tag「已回退」，抽屉「本条已回退」）
- 回退历史已完成：yes（回退条 tag「已完成」）
- 可回退条数（确认后）：0
- 截图含 toast：yes
- 静默 biz_write：no（改行点「确认过账」，回退点「确认回退并写回」）
- 错误：none

## 截图

- [operation-corpus-rollback.png](../media/operation-corpus-rollback.png)

截图可见：顶栏「已回退并写回。」；列表铺满模块、无生成计划表单；变更「已分派→新建」；回退条「已完成」、原改行「已回退」；抽屉保留「审查 corpus」，corpus 区「当时原文 / 改行工单」，不是裸 JSON。

## 硬编码 none

产品代码未写死 kind / 字段 / 单号。回退用审计里的对象+主键。现网改行从当时操作历史发现型，从预览列发现可切换枚举，再点确认过账。
