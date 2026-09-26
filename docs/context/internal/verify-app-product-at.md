---
cursor:
  subagentId: "bc-483e62cb-051b-5218-b864-63a8e53e7df7"
---

# Verify: AT 声明能力入口找得到

**pass:** yes
**main SHA:** `d5e67b4cfd2747163beae3b86e91386e58334483`
**branch:** `main`（未推 origin）
**问 AI 左栏可见会话:** yes
**产品页顶是否工具条:** no（栏目）
**走访 updatedAt:** unchanged
**拉伸 48/224:** yes

## SHA

| 项 | 值 |
|---|---|
| daily main | `d5e67b4cfd2747163beae3b86e91386e58334483` |
| branch | `main` |
| 产品提交 | `d5e67b4cfd2747163beae3b86e91386e58334483` |

## 每条声明入口在哪

| 入口 | 放哪 | 点了 | 现网看到 |
|---|---|---|---|
| float 浮窗 | 工作面顶栏（返回列表旁），不在产品栏目顶 | yes | 应用浮窗=yes 「—」收回=yes |
| ai 问 AI | 记下栏 | yes | inView=true inNav=false |
| files 引用文件 | 记下栏 | yes | inView=true inNav=false |
| memory 起草记忆卡片 | 记下栏 | yes | inView=true inNav=false |
| im 拟回进输入框 | 记下栏 | yes | inView=true inNav=false |
| briefing 打开早报 | 记下栏 | yes | inView=true inNav=false |
| biz 打开业务记录 | 记下栏 | yes | inView=true inNav=false |
| 问 AI 左栏 | 记下栏 → 左栏会话 | yes | list=yes title=`资料卡片板 · 问` aside=224px |
| 产品栏目顶 | 只铺这个应用自己的栏目 | — | nav=`资料板` 工具条=no |

## 问 AI

| 项 | 结果 |
|---|---|
| 点了问 AI | yes |
| 左栏展开 | yes |
| 列表出现「资料卡片板 · 问」 | yes |
| 自动发 IM | no |

## AO–AS / 决策 22

| 项 | 结果 |
|---|---|
| 栏目顶工具条 | no |
| 只藏建造抽屉 | no |
| 按钮「浮窗」 | 浮窗 |
| 「—」收回工作面 | yes |
| 连接器空页 | 未闪 |
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
| 新造应用 | no |
| 5174 | 未杀，仍在听 |

已对：声明入口在记下栏/工作面顶栏「浮窗」，首屏找得到；栏目顶只铺「资料板」；问 AI 左栏会话 可见。走访 `app_5d1eef0062114901b4797d705e5166b5` updatedAt 未改。拉伸 48/224。

未对：早报抽屉标题。

仍差：无（本刀过关项）

## 图

产品页：栏目不是工具条；声明入口在图里。PNG 头 `89504e470d0a1a0a` 225245 bytes。

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/app-product-at.png`

本机 `/cursor` 只读（`mkdir: /cursor: Read-only file system`），与 AS 相同，协调器侧读 `files/`。


