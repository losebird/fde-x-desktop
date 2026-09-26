---
cursor:
  subagentId: "bc-e1d0beb7-6588-5ac8-b255-550425b23ee6"
---

# Verify: AM 分组卡片密度

**pass:** yes
**main SHA:** `a41c6307ff373184bb29ba8c4ca676703a11972f`
**branch:** `main`（未推 origin）
**同组是否多卡横排:** yes
**标题是否业务名:** yes
**打开链接是否仍真:** yes
**刷新是否仍在:** yes
**走访是否未改:** yes
**拉伸是否仍好:** yes
**静默写:** no
**硬编码:** none

## SHA

| 项 | 值 |
|---|---|
| daily main | `a41c6307ff373184bb29ba8c4ca676703a11972f` |
| branch | `main` |

## 过关项

| 项 | 结果 | 证据 |
|---|---|---|
| 同组是否多卡横排 | yes | 文档 3 张同一 top=455，lefts=[454,670,886]；网页 2 张同一 top=707，lefts=[454,670] |
| 标题是否业务名 | yes | titles=["接口说明","验收清单","入门手册","设计规范","周报模板","待办备忘"]；serial=no |
| 打开链接是否仍真 | yes | 行动仍是 `<a href="https://example.com/api" target="_blank">`；SQLite 六条 url 都是 http(s) |
| 刷新是否仍在 | yes | reload 后六张还在；SQLite `app_resource-cards__resource` groups={"文档":3,"网页":2,"备忘":1} |
| 问 AI / 浮窗 | ai,float | uses=ai,float；本轮问 AI 开会话、撕浮窗都触发了 |
| 建造后台是否让开 | yes | 日常面无「编辑 spec / 版本回滚」；建造入口 yes |
| 记账整屏还在 | yes | 药箱未改；overview/compose/chart/feed 都在 |
| 走访是否未改 | yes | app_5d1eef0062114901b4797d705e5166b5 updatedAt 2026-09-19T06:03:58.932Z |
| 拉伸是否仍好 | yes | 拉宽 aside 48px；拉窄 224px |
| StagePanel iframe 指针屏蔽 | yes | index.css + StagePanel.iframeDragShield 未拆 |
| 三 Tab / 创建 / 删除 | yes | 应用/业务记录/操作记录；创建应用；删除 |
| 静默写 | no | 无 biz_write |
| 硬编码 | none | src 无应用名/品类模板 |

## 现网

用现网「资料卡片板」，未新造应用，未改走访/药箱。同一组再记 验收清单 / 接口说明 / 设计规范。

已对：分组栅格从视口断点改成 `auto-fill minmax(11.25rem, 12.75rem)`（`SpecCards.tsx`）；卡片是色带装饰 + 业务名标题 + 一句说明 + 打开；色带来自 theme token hash，不是跟练配色字面量。

未对：headless 点「打开」没接到 popup URL（DOM 仍是真链）。药箱流水这屏显示空态，概览仍是 4 / 31；本刀没动药箱代码。

## 图

产品工作面：文档一组三张横排，网页一组两张横排。标题是业务名，卡片有说明和打开。对照跟练密度，不是每组一张竖排。

/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/app-product-am.png
