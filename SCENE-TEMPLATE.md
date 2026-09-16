# scene 模板 — scene#39「个人工作台」(v3 macOS Stage Manager 版)

> scene#39 已经收敛成"IM 是家,所有工作台模块都是窗口"的形态。
> Fork 时 **80% 不动、20% 改数据** 就能产生 scene#40~N。

---

## 1. 核心架构 — Stage Manager 化

**两个形态并存**(用户自由切换):

```
/          ┐
/im        ├─→ IMScreen (主壳,默认入口)
/im/:id    ┘
/briefing  ┐
/plan      ├─→ AppShell + 完整页(13 个模块独立路由)
/files     │   撕出/外链/全屏都走这条
/ai        │
/data      │
/mcp       │
/skills    │
/memory    │
/settings  ┘
```

**IM 主壳的内部布局**(水平 flex):

```
┌─ IMMiniHeader (W logo · 搜索按钮 · 静音 · 通知 · 新建)
│
├ 88px 缩略图栈  │  IM 主体(三段垂直堆叠)
│  (ThumbnailStack) │
│  · 每个 panel item │  ├─ IMTopNav(9 工作台模块按钮 + ⌘K)
│    一张卡片    │  │
│  · 状态色点   │  ├─ 联系人列表(左 64) + 消息流(右 flex)
│  · 钉住/红点  │  │
│  · ⌘K 提示    │  └─ 输入栏(@AI · + · 文件 · 业务数据)
│
└────────────────────┘
          │ (active panel = full/half)
          ▼
       StageModal  (中央舞台)
       · 标题栏(accent 色块 · 标签 · 未保存 · 最小 · 撕出 · 关)
       · 左右 6px 拖拽手柄 → 实时改 width
       · ESC 关闭 / 点遮罩缩到 tab
       · 撕出按钮 → pushState 到对应 /xxx 完整页路由
```

**Panel 4 态系统**(取代了之前的"抽屉可见/隐藏"二元):

```
closed (不在缩略图栈显示)
tab    (缩略图栈里的小卡片,待召回)
half   (中央 60% 宽浮窗,PC 端常见唤起态)
full   (中央 84vh 大窗,聚焦舞台)
```

任何时刻只有一个 full panel;提升任意 panel 到 full 时,所有其它 full 自动 demote 到 tab。

---

## 2. IM 主壳 vs 完整工作台模式(双形态并存)

| 维度 | IM 主壳(默认) | 完整工作台模式 |
|---|---|---|
| 进入方式 | `/`、`/im`、`/im/:contact` | 点舞台 modal 的 ⤢ 撕出按钮 / 直接访问 `/briefing` 等 |
| 触发词或快捷键 | @AI、命令面板 ⌘K | (有完整 sidebar + header) |
| 面板布局 | Stage Manager 缩略图栈 + 舞台 | 传统 sidebar(13 模块) + header + main |
| 用途 | 日常消息往来、随手唤起工作台 | 长时间专注某模块、大屏演示 |

> 这套"双形态"设计是为了不被单一布局绑死 — 在 IM 里随手点开是 80% 用户路径,但完整工作台模式对重度用户依然重要。

---

## 3. 20% 必改项(scene#40+ 改这些就够)

### A. 数据(占整体体验的 80% 价值)
- `src/data/seed.ts` — **唯一要大量改的地方**。改联系人、文件树、Agent、表、通知、新闻、工作流。
- `src/store/app.ts` 里 `KEYWORD_TRIGGERS` — IM 输入栏的关键词触发,新增场景对应的触发词。
- `src/store/app.ts` 里 `mockAssistantReply` — IM/AI 的自动回复模板。
- `src/store/app.ts` 里 `seedWorkflows` — 自动化工作流预设(对应 Plan Tab 3「工作流」)。

### B. 视觉
- `src/index.css` 顶部色板(`--brand` / `--canvas` / `--surface` / `--line` 等 token)。
- `tailwind.config.js` 的 `theme.extend.colors`。
- 推荐保留 Notion 浅色克制风,只动主色一项即可。
- `defaultPanels()` 里的 `accent` 字段决定每个 panel 在缩略图栈/标题栏的色点。改主题时按色系同步调整 9 个 accent。

### C. 路由策略
- 默认进 `/`(IM 主壳)。要把完整工作台设首屏:把 `App.tsx` 里 `<Route path="/" element={<IMScreen />} />` 移到其他路由之后,或换成 `<AppShell>...` 复合首页。

---

## 4. 80% 不动项(直接复用)

| 模块 | 文件 | 状态 |
|---|---|---|
| IM 主壳 | `components/IMScreen.tsx` | 不动 |
| 舞台 | `components/StageModal.tsx` + `lib/css resize-handle-h` | 不动(含双侧拖拽) |
| 缩略图栈 | `components/ThumbnailStack.tsx` | 不动 |
| IM 顶 nav | `components/IMTopNav.tsx` | 不动 |
| IM 迷你头 | `components/IMMiniHeader.tsx` | 不动 |
| 命令面板 | `components/CommandPalette.tsx`(⌘K) | 不动(5 搜索组,可加) |
| AI / 文件 / 数据 抽屉 | `components/AIDrawer.tsx` `FileDrawer.tsx` `DataDrawer.tsx` | 不动(他们仍是 fallback) |
| 完整 13 页 | `pages/*` | 不动(只改 seed) |
| Plan 三 Tab 页 | `pages/Plan.tsx`(待办/日程/工作流) | 不动(只改 store 里 activePlanTab / seedWorkflows) |
| 抽屉外壳 + 拖拽 | `components/ResizablePanel.tsx`、`DrawerShell.tsx` | 不动(Stage 不可用时兜底) |
| 完整的 sidebar/header | `components/Sidebar.tsx`、`AppShell.tsx`、`Header.tsx` | 不动 |
| store | `store/app.ts` | 改 KEYWORD_TRIGGERS + mockAssistantReply + seedWorkflows;其他不动 |
| 类型 | `lib/types.ts` | 加 FileVersion/Workflow 字段,不动其他 |

---

## 5. 关键设计取舍

### 5.1 为什么不是分栏而是 Stage Manager?
- "展开多个面板会拥挤"是分栏的死结,层级叠放能从根本上解决。
- 单 full 约束防止"一个屏幕全是 panel"的信息压垮;其它降到 tab,等用户召回。
- 撕出(ExternalLink)按钮把舞台的工作台模块"撕"成完整工作台模式的真页面,保留深路径体验。

### 5.2 为什么 任务 + 日程 + 工作流 合并到「计划」?
- 用户原话:"任务不应该是自动化工作流那种吗?"
- 三者定位不同:待办(GTD)/ 日程(时间线)/ 工作流(自动化),但是 90% 时都被"我今天要干嘛"驱动,合并能减少 tab 切换。
- Tab 是次级面板切换,3 Tab 远比 3 个顶级面板轻。

### 5.3 为什么文件保留版本历史?
- 任何编辑都先存当前(防误关)+ push 到 `versionHistory` (FIFO 20)。
- 用户可以回到任意历史版本查看/回滚。
- 不直接覆盖,所以即使 Web localStorage 清掉也只是回到当前。

### 5.4 为什么 IM 直接是主页?
- 90% 时间用户从 IM 进入:收消息、@AI、唤助手。完整首页是低频动作。
- IM 主壳已经把 9 个工作台模块挂在顶部,功能性首页是默认的。

---

## 6. Fork 步骤(从 scene#39 → scene#40)

```bash
# 1. 复制目录
cp -r scene-39-personal-workstation scene-40-XXX

# 2. 修改 package.json 里的 name + version
# 3. 修改 src/data/seed.ts(联系人、文件、Agent、表、新闻、工作流)
# 4. 修改 src/store/app.ts 里的 KEYWORD_TRIGGERS + mockAssistantReply + seedWorkflows
# 5. (可选)改 src/index.css 顶部色板 + defaultPanels accent
# 6. npm install
# 7. npm run dev -- --port 5174
# 8. present_files 给你用户
```

---

## 7. 已知边界(不打算解决,留给后续)

- **PDF** 文件只显示占位(没接 pdf.js)。
- **PPT** 渲染只支持编辑/导出(pptxgenjs),不支持预览。
- **IM 自动回复**是关键词 matcher,不是真 LLM。
- **拖拽日程**只能新建/删除,不能从时间轴拖动改时间(用 modal 改)。
- **业务数据没有后端**,所有 CRUD 走 localStorage。
- **mammoth** 只读取 .docx 的文本流(不解析样式);如要保留 Word 样式,需要 docx-preview 这类库。
- **Stage modal 拖拽**:目前双侧手柄都从 modal 中心对称缩放(乘 2),后续可以做"以哪边为锚点固定不动"。
- **工作流执行**:Workflow 实体已建模(trigger/step/lastRunStatus),但运行效果靠 store 占位,真定时器要走 backend。

---

## 8. 升级到生产的关键路径

```
当前 (demo)
  ↓ 接入真后端
  ├ API: 把 store 的 set 函数全部改成 fetch
  ├ WebSocket: 把 IM sendIM 走 WS 推拉
  ├ 鉴权: 在 store init 时拿 token
  ↓ 接入 LLM
  ├ AI 抽屉: sendMessage 改调 chat completion
  ├ IM 输入: parseIMInput 改成 LLM function-calling
  ↓ 接入 Office
  ├ PDF 预览: pdf.js / pdfjs-dist
  ├ 代码高亮: shiki / prism
  ├ .docx 真预览: docx-preview(保持样式)
  ↓ 接入工作流执行
  ├ cron trigger: cron-parser + 定时器
  ├ keyword trigger: 接入 IM 输入监听
  ├ event trigger: 接入文件系统变更 / 表单提交 webhook
  ↓ 接入多端
  ├ 命令面板 ⌘+K 改成 raycast 风格 UI
  ├ 文件/数据抽屉支持标签页、嵌套
  ├ IM 支持语音/视频
```

---

## 9. 包大小

| chunk | gzip |
|---|---|
| index.js | 102 KB |
| index.css | 7.6 KB |

主要贡献:`xlsx`(100+ KB)、`mammoth`(50+ KB)、`pptxgenjs`(50+ KB)。如果不需要某种格式,可以从 `FileDrawer.tsx` 移除对应 viewer + 删除 import,体积能砍一半。

---

## 10. 验证清单(写新场景前必看)

1. ✅ 直接打开 `/` —— IM 主壳渲染,**左缩略图栈只剩 briefing 红色高亮**(默认 pinned half)
2. ✅ 点 IM 顶部「计划」 —— 出现舞台 modal,显示 plan 三 tab
3. ✅ 点关闭按钮 / ESC —— modal 消失,缩略图栈里出现 plan 小卡片
4. ✅ 再点 plan 小卡片 —— 重新打开 modal
5. ✅ 拖 modal 左右边缘 —— 宽度变化(420~1280),松开保持
6. ✅ 点 modal 标题栏的 ⤢ ExternalLink —— 跳 `/plan` 完整工作台页
7. ✅ 在 IM 联系人搜索框输入关键词 —— 立刻过滤
8. ✅ IM 输入栏输入 `@AI 我今天要做什么` —— 自动打开 plan 面板
9. ✅ ⌘+K —— 弹出命令面板,搜"流程"或"早报"能命中
10. ✅ 文件管理里编辑 .md —— 内容立刻保存,版本历史出现快照
11. ✅ (可选)Browser DevTools Application → LocalStorage → 看 `app-state` 持久化的 JSON 是不是有人话
