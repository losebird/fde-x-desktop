---
cursor:
  subagentId: "bc-c76608d0-e3dc-56d4-abc0-fe67af93102c"
---

# Verify: AG 应用 Tab 里创建

**pass:** yes
**main SHA:** `81232bb7b8a584585eb0081ff9e7918385ad3e8e`
**branch:** `main`（未推 origin）
**wizard in app tab:** yes
**new app name:** 库存盘点
**visit unchanged:** yes
**resize still good:** yes
**silent biz_write:** no
**hardcoded:** none

## SHA

| 项 | 值 |
|---|---|
| daily main | `81232bb7b8a584585eb0081ff9e7918385ad3e8e` |
| branch | `main` |

## 过关项

| 项 | 结果 | 证据 |
|---|---|---|
| 向导是否在应用 Tab | yes | 目录默认「创建应用」；描述→生成→预览 · 库存盘点 仍在应用 Tab，有「采纳并激活」 |
| 新应用名（仅验证文） | 库存盘点 | 现网数据，src/pages/Data.tsx 与 src/components/apps 无此名 |
| 采纳并进入工作面 | yes | {"title":"库存盘点","isVisit":false,"back":true} |
| 走访是否未改 | yes | 未打开走访；列表仍「本周现场走访记录 … 运行中」 |
| 拉伸是否仍好 | yes | 拉宽收起 aside 48px；拉窄展开 aside 224px |
| StagePanel iframe 指针屏蔽 | yes | 未改 StagePanel / index.css 屏蔽 |
| 三 Tab | yes | 应用 / 业务记录 / 操作记录 |
| 打开/删除入口 | yes | 目录「删除」仍在；未点确认 |
| 新应用不进 kind chip | yes | {"chips":["销售回款20"],"hasVisit":false,"hasNew":false} |
| 静默写 | no | 未点确认过账；无 biz_write |
| 硬编码 | none | 产品文案无走访/拜访/邮件/教务/PPT 芯片；新名字未进 src/ |

## 现网描述

库存盘点：货品名称、数量、库位、盘点日期、状态（待盘/已盘/差异）


## 图

应用 Tab 目录里的创建向导（预览 · 库存盘点）和列表里的新应用，走访记录仍在列表，不是走访工作面。

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/app-create-ag.png`
