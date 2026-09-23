# 00 · Coding Agent 执行协议

适用于所有在 FDE-X 仓库上工作的 coding agent。规格包中每一份 `NN-*.md` 都默认包含本协议。违反本协议的提交视为未完成。

## 1. 仓库与环境

- 唯一源码根：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`，git `main`。`/Users/zxz/Documents/ai-project/kimi-project/Agent_FDE_Dev/工作台宣传图` 是 DSH 工作区，不是源码。
- 主栈 5174 / 4318 / `~/.dsh-fde-x` 是 Ace 的工作环境：**不要停、不要重启、不要改它的数据**。改了 `runtime/*.mjs` 只告知「需要重启主栈」。
- 测试床是 peer 栈 5175 / 4319 / `~/.dsh-fde-peer`（`pnpm run dev:peer`，tmux 会话 `fde-peer-dev`）。可以停/起 peer 栈；起停前 `tmux ls` 确认没有别的 agent 正在用它。
- 所有路径、端口、可执行文件从 `runtime/config.mjs` 取（见仓库 `docs/RUNTIME-CONFIG.md`）。**禁止**新增字面量路径/端口。
- Node ≥ 22；`pnpm`；前端 Vite HMR 只覆盖 `src/`。

## 2. 铁律（来自 HANDOFF + Ace 决策，全部有效）

1. `currentAiTarget()` = 顶栏 cwd + 左栏 session。例外：动作声明了专用 preset 时**新开会话**（左栏可见）。**不要**用 `loadCurrentAiTarget()` 做「只需要 cwd」的事，用 `loadCurrentWorkspaceCwd()`。
2. IM 是真信使；附件不进 Files；拟回/采纳结果进输入框，人点发送；**禁止代码路径里出现自动 `imSend`**。
3. 业务系统真值在业务系统内（NocoBase 只是其中一个）；生成应用自有数据在 SQLite；两者只引用不复制。所有对业务系统的写 = `biz_preview → 人确认 → biz_write(preview_id)`，无令牌必拒。
4. 不 restyle：不新增全局样式、不改现有组件的 className 集合与尺寸 token；新组件只能复用现有 className。功能性 class（如 `touch-none`、`pointer-events-none`）允许，提交信息要注明。
5. 不新增路由、不改顶栏模块集合与顺序（`defaultPanels`）。模块内子视图允许。
6. 不硬编码 preset 名、模型名、员工号、工作区路径。
7. 不 `JSON.stringify` Cordis / Session 活对象。
8. 中文 cwd 禁止 `x-dsh-cwd`（用 `?cwd=`）。
9. 记忆：会话原文只读 DSH session 日志；FAISS 只存向量 + id；图是「当时」不是「现在」；卡片先 `draft_memory_card`，人点头才入档。
10. **先核实再声称**：没有实测证据的「已修好」等于没修。

## 3. 工作方式

- **先读**：相关规格全文 → 规格里列出的「现有代码接点」文件 → `docs/project-context.md`。然后在回复里列出准备改的文件，再动手。
- **规格没覆盖的情况**：停下来，把问题连同你倾向的两个选项写出来，不要自己拍板。宁可少做，不要发明。
- **一个提交一个关切**：按规格里的「提交拆分」逐个提交，提交信息用 `type(scope): summary`。每个提交后 `npx tsc -b --pretty false` 必须通过。
- **只 add 你改的文件**。不要 `git add -A`。
- **新代码放新文件**：`runtime/server.mjs` 只允许加 `import` 和一行路由挂载；新路由段写在 `runtime/routes/<name>.mjs`；新前端组件写在 `src/components/<area>/`。
- **不动无关代码**：不顺手重构、不改注释、不改格式。
- **禁区文件**：规格里标注的「其它 agent 正在改」的文件不要碰。
- **完成后**：分支不要留，全部在 `main`（若临时建了分支，验收通过后 `--ff-only` 并回并删除）。
- **报告落盘**：写到 `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/internal/<spec>-report.md`（协调器侧可直接读）；截图放同级 `media/`。回复里只给路径 + 10 行摘要。

## 4. 验证的最低要求

每份规格有自己的验收清单，以下是通用底线：

| 项 | 要求 |
|---|---|
| 类型 | `npx tsc -b --pretty false` 退出 0 |
| 语法 | 改动的 `.mjs` 全部 `node --check` |
| 合约 | `node runtime/smoke.mjs`（默认 `FDE_SMOKE_PORT=4398` 自起 BFF）通过 |
| 单元 | 规格要求的 `runtime/tests/*.test.mjs` 用 `node --test` 通过 |
| 集成 | 改了 `runtime/*.mjs` → 重启 peer 栈 → `curl 4319/health` 200 → 打开一次 `http://127.0.0.1:5175/ai` 触发 connect |
| UI | 用 Playwright（headless chromium，`/tmp/node_modules/playwright` 已装）对 5175 实操规格里的人工口令，每步截图到 `/tmp/fdex-<spec>-<step>.png` |
| 回归 | 打开 `http://127.0.0.1:5174/ai` 截图确认主栈绿条、左栏选中会话未变 |
| 报告 | 逐条「做了什么 → 看到什么」；没做到的如实写「未对」，不要写「应该可以」 |

## 5. 错误处理规范

- 用户可见错误一律走现有黄条/红条机制（IM `imBanner`、AI `statusBanner`、Files `filesError`、Briefing `aiNote`），文案中文、说人话、含下一步（「设置 → AI 核心 → 重载核心」）。
- BFF 路由返回 `{ ok:false, error:'<snake_case_code>', message:'<中文>' }`，HTTP 状态码：400 参数 / 403 Origin / 404 / 409 冲突 / 422 校验 / 501 未实现 / 503 下游未就绪。
- **禁止** `catch {}` 吞错；至少 `console.warn` + 进响应 `warnings[]`。
- 写操作全部校验 Origin 白名单（复用 `server.mjs` 现有闸）。

## 6. 数据与迁移

- SQLite schema 只通过 `runtime/migrations/NNN_*.sql` 变更，编号递增，幂等（`CREATE TABLE IF NOT EXISTS`）。
- 新表第一列语义上是 `workspace_id`（或 `cwd`），所有查询按工作区过滤。
- 破坏性迁移（删列/改类型）用影子表：新建 → 拷贝 → 改名，且要有回滚 SQL 注释。
- Zustand `persist` 改 shape 必须升 `version` + `migrate`。

## 7. 前端约定

- 新 API 调用一律加到 `src/lib/runtime-api.ts`，带类型。
- 模块间通信用事件总线（规格 01），不再新增 `window.dispatchEvent(new CustomEvent('fde-x-*'))`。现有 `fde-x-*` 事件暂不删。
- 所有「交给 AI」经 `askAiForResult` / `promptAi` + `buildContextPack`（规格 07），不要各自拼 prompt。
- 空态用现有 `Empty` 组件；加载态用现有 skeleton/文案；危险操作二次确认沿用现有「再点一次」模式。

## 8. 报告模板

```
## 改动
- 提交列表（hash + 一句话）
- git diff --stat

## 验证
| 步骤 | 做了什么 | 看到什么 | 截图 |

## 未做到 / 偏离规格
- …（为空就写「无」）

## 需要 Ace 决定
- …（为空就写「无」）
```
