---
cursor:
  subagentId: "bc-dfca177b-751d-5b3e-bd35-0a8e1e45dc30"
---

# Verify: AP 撕出收回不要闪默认页

**pass:** yes
**main SHA:** `b38b1c3ffac36a73c6d0bd4e212e8b914bb2a431`
**branch:** `main`（未推 origin）
**撕出闪默认页:** no
**收回闪默认页:** no
**收回后仍是原来的应用:** yes
**走访 updatedAt:** unchanged
**拉伸 48/224:** yes

## SHA

| 项 | 值 |
|---|---|
| daily main | `b38b1c3ffac36a73c6d0bd4e212e8b914bb2a431` |
| branch | `main` |

## 撕出 / 收回有没有闪那帧

录法：应用工作面已经出来、健康条不是「正在检查」之后，才挂 MutationObserver + rAF。点「浮窗」和点「—」后**立刻**截图，不等刷新。命中「正在检查事务底座 / 先在设置登记业务连接器」就算闪。

| 项 | 结果 |
|---|---|
| 撕出瞬间检查条 | no |
| 撕出瞬间空连接器 | no |
| 撕出瞬间仍是应用 | workspace=true product=true |
| 撕出观察器命中 | 0 |
| 收回瞬间检查条 | no |
| 收回瞬间空连接器 | no |
| 收回后工作面 | workspace=true product=true catalog=false float=0 |
| 收回观察器命中 | 0 |

## AO 未踩坏

| 项 | 结果 |
|---|---|
| 按钮「浮窗」 | 浮窗 |
| 两窗只收一个 | yes（后=1） |

## 决策 22

| 项 | 结果 |
|---|---|
| 拉宽 aside | 48px（要 48） |
| 拉窄 aside | 224px（要 224） |
| StagePanel iframe 指针屏蔽 | 未拆 |
| 三 Tab | 应用=true 业务记录=true 操作记录=true |
| 创建入口 | yes |
| 删除入口 | yes |
| 走访 updatedAt | before 2026-09-19T06:03:58.932Z / after 2026-09-19T06:03:58.932Z |
| 静默 biz_write | no |
| 新造应用 | no |

## 图

四格：撕出瞬间；撕出后主台仍是应用；「—」收回瞬间；收回后仍是原来的应用。用来证明没有闪默认页（或对照观察器命中）。

/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/app-float-ap.png


