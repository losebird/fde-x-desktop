---
cursor:
  subagentId: "bc-829465ca-41a2-5eaf-a50a-5a19f0a02b75"
---

# Verify: AQ 模块撕出收回记住页

**pass:** yes
**main SHA:** `dc0ea9c0a52e5985ab1b360f7c041eb27fc24dc3`
**branch:** `main`（未推 origin）
**记忆撕出/收回停在:** `io` / 导入导出（返回 + 导入 JSON；不是图谱首页 / 打开探索）
**另验模块:** 计划·日程（收回后 `data-plan-tab=schedule`）
**走访 updatedAt:** `2026-09-19T06:03:58.932Z` unchanged
**拉伸 48/224:** yes（拉宽 aside 48px，拉窄 224px）

已对：记忆导入导出撕出/「—」收回仍停 io（CDP `data-memory-pane=io`，撕出/收回观察器 home 命中 0；图 1–3 可见返回、导入导出、导入 JSON）。计划·日程同一套 store 记 tab，收回后仍是日程（图 4 待办/日程/工作流，日程选中，日视图）。AO/AP：按钮「浮窗」、两窗只收一个、走访未改、拉伸 48/224、StagePanel iframe 指针屏蔽仍在。三 Tab / 创建 / 删除仍在。未静默 `biz_write`。未新造应用。

未对：IM 会话撕出（计划已过，没再点 IM）。

仍差：早报 `data-briefing-settings=open` 撕前/收回都在，但 innerText 没扫到抽屉标题「自定义早报」（`BriefingSettingsDrawer` 在 `definition` 为空时 return null）。本机 `/cursor/stores` 只读，md/png 写在 AgentStores `files/`。

## SHA

| 项 | 值 |
|---|---|
| daily main | `dc0ea9c0a52e5985ab1b360f7c041eb27fc24dc3` |
| branch | `main` |
| 产品提交 | `dc0ea9c fix(panels): keep module screens across float remount like files` |
| 改动文件 | `src/store/app.ts` `src/pages/Memory.tsx` `src/pages/Briefing.tsx` `src/pages/Plan.tsx` `src/components/IMWorkspace.tsx` |

## 记忆

打开「导入导出」再撕出、点「—」收回。第一帧起就不是图谱首页。

| 项 | 结果 |
|---|---|
| 撕之前 pane | io return=true io=true 打开探索=false |
| 撕出瞬间 pane | io 打开探索=false float=memory |
| 撕出观察器命中 home | 0 |
| 「—」瞬间 pane | io head=记忆 |
| 收回后 pane | io head=记忆 return=true 打开探索=false floatKeys=[] |
| 记忆记住 | yes |

## 另验

| 项 | 结果 |
|---|---|
| 计划撕前 | head=计划 tab=schedule scheduleOn=true |
| 计划收回 | head=计划 tab=schedule scheduleOn=true floatKeys=[] |
| 计划记住 | yes |
| IM | 未点（计划已过） |
| 早报撕前 | head=早报 settings=open customTitle=false |
| 早报收回 | head=早报 settings=open customTitle=false |
| 早报记住 | settings 属性记住；抽屉标题现网未扫到 |

## AO/AP 未踩坏

| 项 | 结果 |
|---|---|
| 按钮「浮窗」 | 浮窗 |
| 旧文案「撕出浮窗」 | 无 |
| 两窗只收一个 | yes（撕出 2，收资料卡片板后剩 1） |
| 业务应用连接器空页 | 未闪（checking=false connectorEmpty=false） |

## 决策 22

| 项 | 结果 |
|---|---|
| 拉宽 aside | 48px |
| 拉窄 aside | 224px |
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

四格 PNG：1 记忆·导入导出撕出瞬间；2 浮窗仍是导入导出；3 「—」收回仍是导入导出；4 计划·日程收回后仍在日程。用来证明记忆不是默认图谱首页。

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/app-float-aq.png`（600703 bytes）
