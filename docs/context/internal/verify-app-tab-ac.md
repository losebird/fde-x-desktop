---
cursor:
  subagentId: "bc-8aef5f9c-8e51-558a-8b23-f31883a365ff"
---

# Verify: 应用 Tab 一条龙

**pass:** yes  
**hardcoded:** none  
**origin:** not pushed  
**silent biz_write:** no  
**confirmed:** no（未点业务系统确认过账）  
**冒充 kind chip:** no  
**step 9 / eval set / packaging / overlay 收编 / 决策 20/21 / 切会话 AB:** not done

## SHA

| 项 | 值 |
|---|---|
| daily main | `345d5708a140dd60b19982c6beb1c424a5a3ade7` |
| branch | `main` |

## 过关项

| 项 | 结果 | 证据 |
|---|---|---|
| 创建 | yes | 现网描述「本周现场走访记录：对方名称、走访日期、要点、状态（计划/已完成/需跟进）」→ AI `fde-app-builder` 提交 spec；`app_5d1eef0062114901b4797d705e5166b5` |
| 预览 | yes | 应用列表点开草稿后出现「采纳并激活」 |
| 采纳并激活 | yes | 状态 `draft` → `active`；列表绿标「运行中」 |
| 新建行 | yes | 对方名称 `走访-mu7vaswd`，走访日期 2026-09-19，状态 计划 |
| 刷新还在 | yes | 刷新后表格仍 1 行；SQLite `app_field-visits__visit` 同值 |
| 应用列表 | yes | 「本周现场走访记录」在「我的业务应用」，不在业务记录 chip |
| 冒充 kind chip | no | 业务记录 chip：销售回款1、销售合同1；无本地应用名 |
| 静默写业务系统 | no | 未点确认过账；AI 会话写「未接外部业务系统」 |
| 硬编码 | none | 产品 `src/` 无应用名/表名/字段名；描述只在现网输入 |

## 现网未测

无（5174 一直在；截图为激活后表格 + 新建行）。

## 图

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/app-tab-ac.png`
