---
cursor:
  subagentId: "bc-f018dc52-e996-586a-bdf9-33df957006ea"
---

# Wave 1 · Spec 08 · Preset 导入 + MCP 连接器视图

## 改动

### 提交（08 专属；`runtime/server.mjs` 未再改动）

挂载已在 `fdbfae6`（`handlePresetRoutes` / `handleMcpRoutes` import + dispatch）；本次只补 route 实现与前端。

| SHA | 说明 | 文件 |
|-----|------|------|
| `2e8c822` | feat(runtime): preset import (dir/git) + source tagging | `runtime/routes/presets.mjs`, `runtime/tests/presets.test.mjs` |
| `b0427f7` | feat(web): PresetImportDrawer in CoreSettings | `src/components/settings/PresetImportDrawer.tsx`, `src/components/settings/CoreSettings.tsx` |
| `2c2f1f9` | feat(runtime): mcp servers v2 + streamable-http + health | `runtime/routes/mcp.mjs`, `runtime/tests/mcp.test.mjs` |
| `f2586c6` | feat(web): MCP page connectors section + honest reload copy | `src/pages/MCP.tsx` |

### 已在其他提交中的接点（08 未重复改）

| SHA | 内容 |
|-----|------|
| `fdbfae6` | `server.mjs`：`handlePresetRoutes` / `handleMcpRoutes` / `handlePlanRequest` / `handleEventsRoutes` dispatch |
| `f9a66b2` | `src/lib/runtime-api.ts`：preset 导入与 MCP v2 客户端类型/方法（早于 route 文件落地） |

`git diff --stat`（08 四提交合计）：约 +1185 行，5 个新文件 + 3 个改文件。

## 验证

| 步骤 | 命令 / 操作 | 结果 |
|------|-------------|------|
| TS | `npx tsc -b --pretty false` | 退出 0 |
| 语法 | `node --check runtime/routes/presets.mjs` / `mcp.mjs` | 通过 |
| 单元 | `node --test runtime/tests/presets.test.mjs runtime/tests/mcp.test.mjs` | 8/8 通过 |
| 合约 | `node runtime/smoke.mjs` | 通过（`workbenchApiUntouched: true` 等） |
| Peer preset 来源 | `curl -s http://127.0.0.1:4319/api/v1/ai/presets`（核心已连接） | 4 条随包 preset 均带 `source: shipped`，`hasLocalCode: false` |
| import-dir 预览 | `POST /api/v1/ai/presets/import-dir` body `{"path":"/tmp/preset-demo"}` + Origin `5175` | `ok` + preview（含 `hasLocalCode: true` 当 cordis 含 `!!js`） |
| Git 关闭 | `POST /api/v1/ai/presets/import-git` | `501` / `git_import_disabled` |
| MCP v2 | `curl -s http://127.0.0.1:4319/api/v1/mcp/servers` | `{ mcp, connectors }` |

### 规格人工清单（5175 Playwright）

未跑完整 Playwright 逐步截图（`/tmp/fdex-08-*.png`）。5175/5174 Vite 当时均为 up，但**未对**：顶栏/FaceSidebar 对照、导入后会话下拉、streamable-http 保存后重载变在线、5174 回归截图。

## 未做到 / 仍差

- **未对**：验收清单 1–7 的 UI 逐步（Playwright + 截图）；现网未测布局/顶栏 parity。
- **仍差**：列表中尚无 `fde-app-builder` / `fde-briefing`（`source: fde`）— 依赖 spec 02 `ensurePresets()`，当前 peer 仅 DSH 随包四条。
- **仍差**：`FDE_ALLOW_GIT_IMPORT=1` 下真实 `git clone` 导入 `awesome-dsh-presets/minimal-zh` 未在本轮执行。
- **仍差**：`catalogVersion` 在 lan-assist `/state` 无字段时返回空字符串（连接器卡仍展示登记/在线态）。
- **环境**：曾 `kill` 4319 进程后 peer 栈未自动拉起；已在 tmux `peer-runtime-4319` 手动 `node runtime/server.mjs` 恢复验证。**Ace 若用 `pnpm run dev:peer`，需确认 4319 监听正常。**

## 偏离规格

- **提交拆分**：`runtime-api.ts` 的 preset/MCP 客户端 API 落在 `f9a66b2`（plan web），不在上述 08 四提交内；行为与 spec §5/§7 一致，仅 git 历史不按 §8 四条完全对应。
- **`runtime-api.ts`**：`normalizeWorkflowTrigger`（plan 类型收窄）与 08 同文件但非 08 功能；为 `tsc -b` 通过所留。
- **`server.mjs`**：08 本轮 **0 diff**（按协调器要求未回滚/重写）。

## 需要 Ace 决定

- 无（02 补齐 FDE preset 后，可再跑验收清单第 1 条）。
