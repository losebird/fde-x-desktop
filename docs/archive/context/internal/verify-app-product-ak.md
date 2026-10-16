---
cursor:
  subagentId: "bc-894f8d42-ac04-5a35-ba3f-8b9337ac4515"
---

# Verify: AK 观感对齐

**pass:** yes
**main SHA:** `f5ee4dad01f27e795aa79b4a814cbb72b50b4f9b`
**branch:** `main`（未推 origin）
**标题是否业务名:** yes
**是否分组卡片或记账整屏:** yes
**刷新是否仍在:** yes
**走访是否未改:** yes
**拉伸是否仍好:** yes
**静默写:** no
**硬编码:** none

## SHA

| 项 | 值 |
|---|---|
| daily main | `f5ee4dad01f27e795aa79b4a814cbb72b50b4f9b` |
| branch | `main` |

## 过关项

| 项 | 结果 | 证据 |
|---|---|---|
| 标题是否业务名 | yes | 记下 `对乙酰氨基酚`；feed=["常备","常备","对乙酰氨基酚","对乙酰氨基酚"]；serialFeed=no serialCard=no |
| 是否分组卡片或记账整屏 | yes | ledger=yes overview/compose/chart/feed=yes/yes/yes/yes；cards=no groups=[]；table=no |
| 刷新是否仍在 | yes | UI=yes SQLite=yes marker=`ak-mu842l76` |
| 问 AI / 浮窗 | ai,float | uses=ai,float |
| 建造后台是否让开 | yes | 日常面无「编辑 spec / 版本回滚」；建造入口 yes |
| 走访是否未改 | yes | app_5d1eef0062114901b4797d705e5166b5 updatedAt 2026-09-19T06:03:58.932Z |
| 拉伸是否仍好 | yes | 拉宽 aside 48px；拉窄 224px |
| StagePanel iframe 指针屏蔽 | yes | index.css + StagePanel.iframeDragShield 未拆 |
| 三 Tab / 创建 / 删除 | yes | 应用/业务记录/操作记录；创建应用；删除 |
| 静默写 | no | 无 biz_write |
| 硬编码 | none | templateHits=none |

## 现网

打开已有应用「家庭药箱」，未改走访，未再走创建。药名用业务名 `对乙酰氨基酚`，marker 只进备注。

## 图

产品工作面：记账整屏（概览 + 记一笔 + 图 + 流水）或分组卡片。标题是业务名，不是生成单号，不是后台宽表，不是走访。

/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/app-product-ak.png

