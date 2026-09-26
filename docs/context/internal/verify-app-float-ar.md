---
cursor:
  subagentId: "bc-e84f3e6a-316e-56f1-ba2d-c803cdc05cc4"
---

# Verify: AR IM 撕出收回记住会话

**pass:** yes
**main SHA:** `3d038a104384800ff61c5dbba0ff1ad7fe14a0a1`
**branch:** `main`（未推 origin）
**IM 撕出/收回停在:** xxx:pk_self_ed07358f9ad8e31c（pk_self_ed07358f9ad8e31c）
**输入框在不在:** yes，稿还在
**有没有自动发送:** no
**走访 updatedAt:** unchanged
**拉伸 48/224:** yes

已对：IM 撕出/「—」收回仍停在撕之前那个会话（CDP `data-im-thread` pk_self_ed07358f9ad8e31c → pk_self_ed07358f9ad8e31c，名 xxx；输入框仍有「AR未发送稿-不要发出去」；未发 `/im/send`）。AO 按钮「浮窗」、两窗只收一个；AP 连接器空页未闪；AQ 记忆导入导出、计划日程。走访未改。拉伸 48/224。StagePanel iframe 指针屏蔽仍在。

未对：早报抽屉标题。

仍差：无（锁外创建应用本身还没齐）

## SHA

| 项 | 值 |
|---|---|
| daily main | `3d038a104384800ff61c5dbba0ff1ad7fe14a0a1` |
| branch | `main` |
| 产品提交 | `3d038a104384800ff61c5dbba0ff1ad7fe14a0a1 fix(im): keep thread and composer across float remount` |
| 改动文件 | `src/components/IMWorkspace.tsx` `src/store/app.ts` |

## IM

打开一个非默认空白会话，写入输入框（不点发送），撕出，点「—」收回。

| 项 | 结果 |
|---|---|
| 撕之前 | thread=pk_self_ed07358f9ad8e31c name=xxx draft=true empty=false |
| 撕出瞬间 | thread=pk_self_ed07358f9ad8e31c name=xxx |
| 浮窗停稳 | thread=pk_self_ed07358f9ad8e31c draft=true |
| 「—」瞬间 | thread=pk_self_ed07358f9ad8e31c head=IM |
| 收回后 | thread=pk_self_ed07358f9ad8e31c name=xxx draft=true empty=false floatKeys= |
| IM 记住 | yes |
| 自动发送 | no |

## AO/AP/AQ 未踩坏

| 项 | 结果 |
|---|---|
| 按钮「浮窗」 | 浮窗 |
| 旧文案「撕出浮窗」 | gone |
| 两窗只收一个 | yes（后=1） |
| 业务应用连接器空页 | 未闪（checking=false empty=false） |
| 记忆导入导出 | yes pane=io |
| 计划日程 | yes tab=schedule |

## 决策 22

| 项 | 结果 |
|---|---|
| 拉宽 aside | 48px（要 48） |
| 拉窄 aside | 224px（要 224） |
| StagePanel iframe 指针屏蔽 | 未拆 |
| 三 Tab | 应用=true 业务记录=true 操作记录=true |
| 创建入口 | yes |
| 删除入口 | yes |
| 走访 id | `app_5d1eef0062114901b4797d705e5166b5` |
| 走访 updatedAt | before 2026-09-19T06:03:58.932Z / after 2026-09-19T06:03:58.932Z |
| 静默 biz_write | no |
| 新造应用 | no |
| 5174 | 未杀，仍在听 |

## 图

四格 PNG：1 IM 撕出瞬间；2 浮窗仍是同一会话和输入框；3 「—」收回瞬间；4 收回后同一会话，稿还在。用来证明不是默认空白会话。

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/app-float-ar.png`（540290 bytes，PNG 头 `\x89PNG`，3200×2056）。本机 `/cursor` 只读（`mkdir: /cursor: Read-only file system`），与 AQ 相同，协调器侧读 `files/`。

