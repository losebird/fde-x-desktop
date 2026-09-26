# Verify: AV 创建应用八项

**pass:** yes
**main SHA:** `b686f9b65e9dd5228e6bcb5d7643f444863c9ab0`
**branch:** `main`（未推 origin）
**走访 updatedAt:** unchanged `2026-09-19T06:03:58.932Z`
**拉伸 48/224:** yes（48 / 224）

## SHA

| 项 | 值 |
|---|---|
| daily main | `b686f9b65e9dd5228e6bcb5d7643f444863c9ab0` |
| branch | `main` |

## 1–8

| # | 过/没过 | 证据 |
|---|---|---|
| 1 | 过 | 两句新描述走成两套产品页。家里的菜谱 `app_4b3607a735ea42d295306f4ab9499d1f`：`pages` 菜谱卡片 cards + 试做台账。小区水电抄表 `app_9de6038b186a4e9786e28bc4f48add9d`：同一栏 stats+compose+chart+feed。不是走访/库存盘点/拜访。 |
| 2 | 过 | 菜谱：按菜系卡片 + 播放。抄表：本月概览 1 / 用量 12、记一笔、分类图、流水「东门水表」。按各自 spec 铺，不是健身/记账模板。 |
| 3 | 过 | 记录动作是「问 AI / 播放 / 摘成待办」，栏目顶没有「引用文件、起草记忆卡片…」平台条。问 AI 左栏可见 `家里的菜谱 · 问`，aside 224。未声明的不画（菜谱 uses=`ai`；抄表 uses=`ai,plan`）。 |
| 4 | 过 | 向导默认 `local`；切「接邮箱/业务系统/文件」后 `modules`，三个 checkbox 全 false；再切回 `local`。未默认铺满 uses，未编假接口。 |
| 5 | 过 | spec `uses` 含 `plan`。点「摘成待办」后 `/api/v1/plan/tasks` 从 1 条到 2 条，标题「小区水电抄表」落库。 |
| 6 | 过 | 卡片标题「番茄炒蛋」来自 `titleField=dish_name`；流水「东门水表」来自 `titleField=meter_name`。没有回落到分类「家常 / 水」，源码无写死「常备」。 |
| 7 | 过 | 播放链 `https://example.com/watch?v=av-clip`（`<a target=_blank data-app-card-href>`）。headless 未截到 popup URL，href 是真 http(s)。 |
| 8 | 过 | 运行中 6 条在前；草稿分组折叠 `草稿 · 3`。同名分开列：小区水电抄表 active+draft、库存盘点 active+draft。走访仍在，未删已激活应用。 |

## 现网描述

1. 家里的菜谱卡片：菜名、菜系分组、做法说明、教学视频链接。按菜系铺卡片，点了能播放。另有一栏记下每次试做的评分和日期。能问 AI。
2. 小区水电抄表：表名、用量、抄表日、类别（水/电/气）。要本月概览、记一笔、分类图和流水。能问 AI，记完能摘成待办。

新应用名「家里的菜谱」「小区水电抄表」只在数据里，未进 `src/`。

## AO–AU / 决策 22

| 项 | 结果 |
|---|---|
| 工作面事务底座条 | 无 |
| 栏目顶工具条 | no |
| 平台按钮条 | no |
| 问 AI 左栏 | yes `家里的菜谱 · 问` |
| 拉宽 aside | 48px（要 48） |
| 拉窄 aside | 224px（要 224） |
| StagePanel iframe 指针屏蔽 | 未拆 |
| 三 Tab | 应用=true 业务记录=true 操作记录=true |
| 创建入口 | yes |
| 删除入口 | yes |
| 走访 id | `app_5d1eef0062114901b4797d705e5166b5` |
| 走访 updatedAt | before 2026-09-19T06:03:58.932Z / after 2026-09-19T06:03:58.932Z |
| 静默 biz_write | no |
| 自动发 IM | no |
| 5174 | 未杀，仍在听 pid 39206 |
| 打开 href | `https://example.com/watch?v=av-clip` popup=（headless 空） |

已对：1–8 现网；走访 `app_5d1eef0062114901b4797d705e5166b5` updatedAt 未改；拉伸 48/224；iframe 指针屏蔽代码未拆。

未对：headless popup 实开（href 已是真链）；`/cursor/stores` 本机无此挂载，只写了 AgentStores `files/`。

仍差：无（本刀过关项）。popup 未截到不算第 7 项红：链是 `https://example.com/watch?v=av-clip`。

## 图

不同产品页、能力不在一排按钮、草稿让开、打开是真链。PNG 头 `89504e470d0a1a0a` 305257 bytes。

`files/media/app-create-av.png`
