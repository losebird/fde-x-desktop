---
cursor:
  subagentId: "bc-ad72e771-8154-517d-b860-4e75598a4994"
---

# Verify: AL 分组卡片

**pass:** yes
**main SHA:** `e1367c4e1609ab83a3392e6c4a20c47b8e04914e`
**branch:** `main`（未推 origin）
**是否分组卡片:** yes
**标题是否业务名:** yes
**打开链接是否真的:** yes
**刷新是否仍在:** yes
**走访是否未改:** yes
**拉伸是否仍好:** yes
**静默写:** no
**硬编码:** none

## SHA

| 项 | 值 |
|---|---|
| daily main | `e1367c4e1609ab83a3392e6c4a20c47b8e04914e` |
| branch | `main` |

## 过关项

| 项 | 结果 | 证据 |
|---|---|---|
| 是否分组卡片 | yes | 资料卡片板 cards=yes groups=["文档","网页","备忘"]；不是只拍记账表 |
| 标题是否业务名 | yes | titles=["入门手册","周报模板","待办备忘"]；serial=no |
| 打开链接是否真的 | yes | 点「打开」弹出 `https://example.com/manual` |
| 刷新是否仍在 | yes | reload 后 titles 仍是这三张；SQLite `app_resource-cards__resource` 3 行 |
| 问 AI / 浮窗 | ai,float | uses=ai,float；图上「问 AI」「撕出浮窗」 |
| 建造后台是否让开 | yes | 日常面「建造」入口；无编辑 spec 占主区 |
| 记账整屏还在 | yes | 无链接字段的台账仍走 overview+compose+chart+feed；药箱 spec 未改 |
| 走访是否未改 | yes | app_5d1eef0062114901b4797d705e5166b5 updatedAt 2026-09-19T06:03:58.932Z |
| 拉伸是否仍好 | yes | 拉宽 aside 48px；拉窄 224px |
| StagePanel iframe 指针屏蔽 | yes | index.css + StagePanel.iframeDragShield 未拆 |
| 三 Tab / 创建 / 删除 | yes | 应用/业务记录/操作记录；创建应用；删除 |
| 静默写 | no | 无 biz_write |
| 硬编码 | none | src 无应用名/品类模板 |

## 现网

药箱实体没有链接/文件字段，未改它、未改走访。用新描述走创建：「资料卡片板」（只在数据里，没进 `src/`）。不是走访/库存盘点/拜访。不是健身皮肤。

记下三条：入门手册 / 周报模板 / 待办备忘，按来源分组。刷新还在。打开链接是真 URL。

旧行标题：生成单号整串才跳过，回落到下一个能读的字段，不再只显示分类。

## 图

产品工作面：分组卡片（文档 / 网页 / 备忘），标题是业务名，卡片上有「打开」。不是后台宽表，不是走访，不是只拍记账表。

/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/app-product-al.png
