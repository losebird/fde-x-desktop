---
cursor:
  subagentId: "bc-16301578-a52f-55e9-a5f8-6f1a33d094d2"
---

# Verify: AD 看板 / 加列 / 回滚

**pass:** yes  
**main SHA:** `12aa131e3e01755e85d0b5d2cd9d274bbebbdd0b`  
**branch:** `main`（未推 origin）  
**hardcoded:** none  
**silent biz_write:** no  
**打开方式:** AE（catalog → 独立工作面，未改顶栏）

## AD

| 项 | 结果 | 证据 |
|---|---|---|
| 看板按状态列见到已有行 | yes | 看板三列：计划 / 已完成 / 需跟进；计划列卡片 `走访-mu7vaswd` |
| 改 spec 加字段并激活后多一列 | yes | 保存新修订 →「激活本次修订」；表头多「附加」（`phone`）；旧行仍在 |
| 回滚到加字段前 | yes | 回滚修订 1；「附加」列消失；旧行 `走访-mu7vaswd` / 2026-09-19 / 计划 还在 |
| 用户数据 | 未毁 | 当前 `current_revision=1`，spec 无新字段；SQLite 只增列 `phone`（规格只增不减），行未删 |

现网应用：已激活本地应用「本周现场走访记录」（AC 留下的那条，未新建、未硬删）。

## 决策 22

| 项 | 结果 |
|---|---|
| 拉宽右栏 → 左栏会话列表收起 | yes（aside 48px，无「会话」标题，panel 872px，main 640px） |
| 拉窄右栏 → 展开 | yes（aside 224px，有「会话」标题，panel 360px，main 1152px） |
| StagePanel DSH iframe 指针屏蔽 | yes（`src/index.css` `[data-floating-drag] iframe { pointer-events: none }`；`StagePanel` 仍调 `iframeDragShield`；未改这两处） |
| 应用列表 | yes |
| 打开工作面 | yes（独立工作面 + 返回列表） |
| 删除入口 | yes（列表「删除」仍在，未点确认） |
| 业务记录三 Tab | yes（应用 / 业务记录 / 操作记录） |
| kind chip 不进本地应用名 | yes（业务记录未见「本周现场走访记录」） |
| 静默 biz_write | no |
| 硬编码 | none（产品 `src/` 无该应用名/表名/字段名） |

## 图

左：看板按状态列，计划列有已有行。右：加字段并激活后的表，多「附加」列，旧行还在。

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/app-views-ad.png`
