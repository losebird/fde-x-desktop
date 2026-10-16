# FDE-X 现网交接（给下一个 coding agent）

日期：2026-10-16。仓库：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`。远程：`https://github.com/losebird/fde-x-desktop.git`，分支 **`main`**。

**执行合同：** 先读 `AGENTS.md`，再读 `PRODUCTION-SPEC.md` **§0–§3 与 §0.5**。§0.5 覆盖所有更早条款。过程稿在 `docs/archive/`，禁止按归档派工。

下面「交接提示词」可整段贴给新会话当第一条用户消息。

---

## 交接提示词（整段复制）

```
你在 FDE-X Desktop 仓库工作。源码根：
/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation
远程 origin 的 main。先读 HANDOFF.md，再读 AGENTS.md 和 PRODUCTION-SPEC.md §0–§3、§0.5。docs/archive/ 是考古，不要按那里写代码。

产品：本机个人工作台。壳是 FDE-X（React + BFF 4318）。AI = DSH iframe /dsh-app/。IM 和过账 = lan-assist。记忆 = semantic-os。应用自有数据 = 本机 SQLite。不要把官方 DSH/lan-assist/semantic-os 的 client.js 当产品页。

纪律：不要硬编码；不要偷懒；不要打补丁；不要讨好；不要擅自做主；闸只听话不做主。占用方案先用中文复述，等用户点头再改代码。不要 restyle FDE-X。不要给每个应用往 src/pages 加页面。不要发明顶栏模块。不要杀正在跑的 pnpm dev。改 BFF 让用户重载核心。不要 npm i -g 覆盖 Homebrew 的 DSH。pin 是 0.2.0-rc.2。不要 bump ASSET_V。不要 overlay vendor bootstrap.py。打包/安装/公证等用户点头。

会话画布只占 AI iframe 的 chat/trajectory+composer。目录能力 land 到已有页。公开应用 /a/:shareId 是已分享实例的文档口，不是新顶栏。

我的业务应用两种运行时：fde-app/v1 台账（SQLite 表 + AppRuntime）；fde-web/v1 托管 Web 包（cwd apps/<slug>/，iframe live，localStorage/fdeApp 进 app_documents）。禁止把画布/HTML 折成假表。过账走 lan-assist 闸，SQLite 不冒充外部系统。分享是同一份 sqlite；BFF 听 0.0.0.0 但 bffOrigin/iframe 必须是 127.0.0.1；局域网只放行 /a 和 app-share。顶栏显示「连接器/技能」。MCP 已连接保存走 Host HMR，禁止杀 Host。

已活测：户型 HTML 做成托管 Web、数据进库、分享 URL 就是这个网站。还没闭环：只说话不给 HTML 能否交出真 Web 工作台；修订会不会清空库。不要扩平台、不要做征信/ERP 云。先问接下来做什么，等点头。
```

---

## 1. 这是什么

本机个人 AI Native 工作台。浏览器里仍是 FDE-X 壳。引擎不在浏览器里：

| 用户看见 | 权威 |
|---|---|
| AI 对话 / 模型 / 工具 / 轨迹 | DSH Host（iframe `/dsh-app/`） |
| IM、业务过账 | dsh-lan-assist（闸：preview → 人确认 → write） |
| 记忆 | dsh-semantic-os（画布占用已接 Memory 页） |
| 待办、应用自有数据、布局 | 本机 SQLite + Zustand |

身份三缝（禁止第四面）：`sessionId` → AI 画布；`cwd` → 已有 FDE 页；window/OS → `apps/desktop`。

## 2. 开发机约定

| 项 | 值 |
|---|---|
| 前端 | Vite `127.0.0.1:5174`（`pnpm dev` / `npm start` → `scripts/dev.mjs`） |
| BFF | `4318`；对端联调 `5175` / `4319` |
| DSH 家 | `~/.dsh-fde-x` |
| SQLite | `runtime/data/fde-workstation.sqlite` |
| Host pin | `0.2.0-rc.2`（`runtime/generation.mjs`） |
| 启动 | 不要无故杀已有 `pnpm dev`；改 BFF 后请用户 **重载核心** |

会话创建 XOR：`{ cwd, workspaceId }` 二选一。fetch 包装禁止把 Memory DOM cwd 混进 AI session create body。

## 3. 应用占用（当前主线）

同一目录「我的业务应用」，创建口 `fde-app-builder` → `fde_app_spec_submit`。

| 运行时 | 何时 | 数据 | 打开 | 分享 `/a/:shareId` |
|---|---|---|---|---|
| `fde-app/v1` | 对象/字段/记下/看板/统计 | `app_<slug>__<entity>` | `AppRuntime` | FDE `PublicApp` |
| `fde-web/v1` | 任意 Web 页、画布、现成 HTML | `app_documents` + 可选实体表 | iframe `…/apps/:id/live/` | **就是这个网站**（包的 index.html） |

- 包根：工作区 `apps/<slug>/`，`files[{path,content}]` 同一次提交。
- `localStorage` 经注入的 `bridge.js` 同步进文档键 `localStorage`。
- 公开页无建造/过账/问 AI。Web 包默认 **调不了 DSH**。
- 局域网：`FDE_LISTEN_HOST=0.0.0.0`，非 loopback 只放行 `/a/*`、`/api/v1/app-share/`、静态。`bffOrigin` 禁止 `0.0.0.0`（会弄丢 AI iframe）。
- 顶栏显示「连接器 / 技能」（persist overlay）；store key 仍是 `mcp`/`skills`。

关键代码：`runtime/apps/{spec,bundle,web-host,documents,share,repository}.mjs`，`runtime/routes/{apps,app-share,public-app}.mjs`，`src/components/apps/AppWebRuntime.tsx`，`src/pages/PublicApp.tsx`，`docs/APPS.md`，`docs/RUNTIME-CONFIG.md`。

## 4. 已完成 / 未闭环

**已进 `main` 且户型探针活测过：** 现成 HTML → 托管 Web → 刷新数据还在 → 分享 URL 是网站本身。会议室预约看板（台账）保留。文档合同已对齐；无用过程稿在 `docs/archive/`。

**占用未闭环（下一刀活测，先测再写代码）：**

1. 只描述、不贴 HTML，创建一个办公 Web 应用（工位图/排班格子等）。打开必须是那种界面，不能又是表。
2. 在已通过的户型上改一句再采纳，平面数据还在。

**不要当下一刀：** 征信/互联网寻源/全区教务云；给每个应用改 FDE React；把 HTML 折成假表；未点头就打包/安装/公证。

供应链 11 助手、教师工作台：创建应用能做「本机闭环的工作台」；出网寻源、证照识别、校级云账号做不到（没有那些连接器）。教师场景应走 `fde-web`（30 秒批量点名），不要先建 10 张空表当交付。

## 5. 其它现网事实（易踩）

- MCP：已连接保存 = Host HMR，不要杀进程。冷启动 hold 见 `runtime/mcp-archive.mjs`。stdio 是 JSONL。纤维 `active` ≠ `connectedAt`。
- 过账：无连接器必须失败；有则 preview 确认才 write。SQLite 应用表不是外部系统。
- 记忆：六块 Semantica 画布占用；不要改 Memory className / PROV-O。
- 打包：unsigned DMG，`scripts/pack/`。不要 `ELECTRON_RUN_AS_NODE` 跑 DSH。不要把 `resources/`、`dist-pack/`、`promo-direct/` 提交。
- `pnpm tsc -b` 长期可能红，不作为「没做完」的唯一证据。
- 用户机器 `~/.dsh-fde-x` 里的 builder skill **不会自动覆盖**；仓库 `runtime/presets/fde-app-builder/skills/fde-app-spec/SKILL.md` 与 `src/lib/app-builder-prompt.ts` 才是口。

## 6. 文档哪里看

| 要干什么 | 读 |
|---|---|
| 每次改代码 | `PRODUCTION-SPEC.md` §0.5、`AGENTS.md` |
| 应用/分享/Web 包 | `docs/APPS.md`、`docs/RUNTIME-CONFIG.md` |
| 稳定决策 | `docs/project-context.md`（决策 3 已改为台账+托管 Web） |
| 规格 01–09 | `docs/specs/`（接点表大量停在 2026-09，冲突以代码为准） |
| 旧交接/评测/Cursor 拷贝 | `docs/archive/` 只查不跟 |

## 7. Git

不要把这些提交进去：`.playwright-mcp/`、`apps/desktop/package-lock.json`、`occupy-open.txt`、`output/`、`promo-direct/`、vendor `__pycache__`。

近期相关提交：`f9cef45d` 应用分享+Web 宿主；`36f9839f` 合同对齐；`ac563b7a` 过程稿归档。
