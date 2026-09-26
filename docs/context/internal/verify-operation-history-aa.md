---
cursor:
  subagentId: "bc-c1124713-dfff-5289-be51-9795b2c2c557"
---

# 操作历史 AA · 搜索 / 颜色 / 翻页

按 [五问](../docs/records-panel-decisions.md) §11。只改操作记录历史列表。

## 闸上

| 项 | 值 |
|---|---|
| main SHA | `46a44a2617777ddf54ded20db293be07ef2c835c` |
| pass | yes |
| 搜索是否缩小列表 | yes（haystack：对象 / 动作 / 单号 / 变更摘要） |
| 翻页是否停在第 2 页 | yes（45 条 fixture，第 2 页 20 条，再 paginate 仍第 2 页） |
| 颜色是否按动作/记录状态 | yes（词表 `can` ∪ 历史动作 → Tag token；状态 可回退 amber / 已回退 teal / 已完成 green） |
| 有没有静默写 | no |
| 硬编码 | none |

`node --test runtime/tests/operation-history-list.test.mjs` 过。`refresh()` 不 `setPage(1)`；只有搜索词变才回到第 1 页。

## 现网（5174）

cwd `/Users/zxz/Documents/ai-project/fdex测试`。未开业务记录，未点「销售合同 20」。未过账。

| 项 | 值 |
|---|---|
| pass | yes |
| 搜索是否缩小列表 | yes：14 → 5，输入框「回退」（动作取自当时列表，不是写死对象） |
| 翻页是否停在第 2 页 | 现网未达（14 条 < 21，`第 1 / 1 页`，下一页禁用） |
| 颜色是否按动作/记录状态 | yes |
| 有没有静默写 | no（无 `POST /api/v1/biz/write`） |
| 硬编码 | none |

动作 token：改行 `blue` `rgb(61, 111, 200)`；回退 `red` `rgb(200, 85, 61)`。  
记录状态 token：已回退 `teal` `rgb(45, 157, 143)`；已完成 `green` `rgb(47, 107, 58)`。同行动作/状态 token 不撞。不按业务字段值（如「处理中」）上色。

页长 `data-history-page-size=20`。上一页/下一页在。点刷新不写库。

## 对照

- 已对：本工作区历史可按对象、动作、单号/主键、变更摘要搜。`OperationRecordPanel` 搜索框 + `historySearchHaystack`。现网 14→5。图 `media/operation-history-aa.png`。
- 已对：动作色走词表 `can` + 历史里实际有的动作（含回退）映射桌面 Tag token；记录状态 可回退/已回退/已完成 分色。现网 CDP 量到改行蓝 / 回退红 / 已回退青 / 已完成绿。
- 已对：一页 20。闸上 45 条翻到第 2 页后仍停在 2。`HISTORY_PAGE_SIZE = 20`，`refresh` 不回第 1 页。
- 未对：现网第 2 页（本工作区只有 14 条写入历史；未静默写去凑 21）。
- 仍差：现网下一页未点成。决策 20/21、第 9 步、评测集、打包、overlay 收编、审查 corpus 去留：未做。

截图可见：搜索框「回退」、共 5 条、回退红标 / 已完成绿标、底栏「第 1 / 1 页」。

## 未做

未推 origin。探针未进产品仓。未杀 pnpm 5174。未 git add 探针。未删文件。日常树 `main`。
