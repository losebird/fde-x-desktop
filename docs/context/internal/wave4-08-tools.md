---
cursor:
  subagentId: "bc-7326d9dd-81ae-51f2-ba5c-ae206fb0e1a8"
---

# Wave 4 · Spec 08 tail · MCP v2 工具投影

## 改动

| 提交 | 说明 |
|------|------|
| `17a36e2` | `feat(mcp): project live tools onto server cards` |

**`runtime/routes/mcp.mjs`**

- 核心在线时：用 `session/list`（`_request.includeBlank: false`）取首个会话 id，再开 `session/follow` 读首帧 `snapshot`。
- 工具名从 `request/header` 折叠后的 `header.tools`（及 snapshot `header.tools` 若存在）提取 `ToolSchema.name`，不再走 `commands/list`（slash 命令 ≠ 会话 tools 投影）。
- `groupMcpToolsByServer`：按 `mcp__<serverName>__*` 分到各 patch 里的 `serverName`；取不到则 `[]`，无占位 `mcp__name`。
- `mapServerStatus` 不变：`configured` / `live`（有投影工具）/ `needs-reload`（已连但该 server 无工具）。

**`src/pages/MCP.tsx`**

- 卡片工具 Tag 列表（原有）；搜索条件增加匹配 `tools` 字符串（未改 className）。

**`runtime/tests/mcp.test.mjs`**

- 覆盖 `toolNamesFromFollowSnapshot`、`groupMcpToolsByServer`、connected 时 `buildMcpServersV2` 投影与 status。

**未动**：`server.mjs`、`runtime-api.ts`、Briefing / briefing 路由。

## 验证

| 项 | 结果 |
|----|------|
| `node --test runtime/tests/mcp.test.mjs` | 6/6 通过 |
| `npx tsc -b --pretty false` | 退出 0（main 含 06 后） |
| `curl http://127.0.0.1:4319/api/v1/mcp/servers` | 200，`{ mcp: [], connectors: [...] }` |
| `GET /api/v1/ai/status`（4319） | `connected: false`，`state: idle` |
| 5175 MCP 页截图 | **未产出**：本机 Playwright Chromium 未安装（`browserType.launch: Executable doesn't exist`） |

## 规格对照（08 §4 GET /mcp/servers v2）

| 点 | 状态 |
|----|------|
| `tools: string[]` 字段 | **已对**：`buildMcpServersV2` 返回 |
| 在线时从 DSH 会话 tools 投影 `mcp__<serverName>__*` | **已对**：实现为 `session/follow` + `request/header`（代码路径）；**现网未测**真实 MCP patch + 重载后工具名 |
| 取不到 `[]` | **已对**：单测 + 未连接时不调 follow |
| MCP 卡展示工具列表 | **已对**：`MCP.tsx` 已有 Tag；空态「暂无工具投影」 |

## 未做到 / 仍差

- **现网未测**：peer 核心未连接、patch 无 MCP 条目，无法在 5175 上看到「在线 + 工具 Tag」；需 Ace：连接核心 → 配置 MCP → 重载 → 再 curl / 目视卡片。
- **截图**：`media/wave4-08-tail/mcp-page.png` 未生成（Playwright 浏览器缺失）。

## 需要 Ace 决定

- 无。
