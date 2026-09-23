# 08 · Agent preset 导入与管理（设置 → Agent 预设）+ MCP 页连接器视图

依赖：02（preset 骨架、`ensurePresets`）。协议：`00-agent-protocol.md`。

## 1. 目标

用户能把开源 DSH agent preset 一键装进 FDE-X（`~/.dsh-fde-x/.agent-presets/<id>/`），看清来源与信任等级，删除自己装的；MCP 页能同时看到「MCP 服务器」与「业务连接器」的状态，保存后明确提示重载。

## 2. 范围与禁区

- 做：本地目录导入（校验结构 → 拷入）、Git URL 导入（BFF `git clone --depth 1` 到临时目录 → 校验 → 拷入；Ace 已允许 agent+MCP 路线，此处 BFF 出网仅限 `git clone`，需 `FDE_ALLOW_GIT_IMPORT=1` 显式开启，默认关）、来源标签、删除、信任提示、MCP 页 `GET /mcp/servers` v2 分区、`streamable-http` 表单、重载提示统一。
- 不做：preset 编辑器、市场、自动更新、`agent-presets.config.roots` UI。
- 禁区：随包 preset 目录只读；Skills 页不放导入。

## 3. 现有代码接点

| 接点 | 位置 |
|---|---|
| preset 列表/复制/删除 | `server.mjs` L1253–1282 `GET /api/v1/ai/presets`、`POST …/presets/copy|delete`；`CoreSettings.tsx` L304–352 |
| preset 发现顺序 | 随包 → `config.roots[]` → `<DSH_HOME>/.agent-presets/`；有消息后锁定 |
| 格式 | `<id>/agent.cordis.yml`（必）+ `preset.yml`（`name/description/order`） |
| 信任 | user 根 = shell 级信任（README.zh.md L12）；`!!js` / 本地 `.mjs` 需审查 |
| MCP | `MCP.tsx` L20–36、L57–133、L135–200；`server.mjs` L2198–2248（regex 解析 patch、占位工具名、`needsRestart`）；`dsh-mcp-client` 支持 `stdio` / `streamable-http` |
| 连接器 | `db.mjs` L252–272；lan-assist `/state` |

## 4. API 契约（`runtime/routes/presets.mjs`、`runtime/routes/mcp.mjs`）

| 路由 | 说明 |
|---|---|
| `GET /api/v1/ai/presets` | 现有 + 每项加 `source: 'shipped'|'user'|'root'|'fde'`（fde = 规格 02 的两个）、`path`、`hasLocalCode: boolean`（目录含 `.mjs/.js` 或 yml 含 `!!js`） |
| `POST /api/v1/ai/presets/import-dir` | `{ path }` → 校验：目录存在、含 `agent.cordis.yml`、yml 可解析、`preset.yml` 可选、id = 目录名匹配 `^[a-z0-9][a-z0-9-_]{0,40}$`、不与 shipped 冲突（409 `id_conflict`）→ 返回 `{ ok, preview:{ id, name, description, files:[…], hasLocalCode, warnings } }`（**不拷贝**） |
| `POST /api/v1/ai/presets/import-dir/confirm` | `{ path, id? }` → 拷入 `<DSH_HOME>/.agent-presets/<id>/` → `{ ok, id }` |
| `POST /api/v1/ai/presets/import-git` | `{ url, subdir? }` → 需 `FDE_ALLOW_GIT_IMPORT=1` 否则 501 `git_import_disabled` → `git clone --depth 1` 到 `$FDE_DSH_HOME/tmp/preset-<ulid>` → 同 import-dir 校验 → 返回 preview + `tempPath` |
| `POST /api/v1/ai/presets/import-git/confirm` | `{ tempPath, id? }` → 拷入 → 删临时目录 |
| `DELETE /api/v1/ai/presets/:id` | 只允许 `source==='user'`；`fde`/`shipped` → 403 |
| `GET /api/v1/mcp/servers` v2 | `{ mcp: [{ serverName, transport, command|url, status:'configured'|'live'|'needs-reload', tools: string[] }], connectors: [{ id, name, provider, online, catalogVersion, lookupRegistered }] }`；`tools` 在核心在线时尝试从 DSH 会话 tools 投影取 `mcp__<serverName>__*`（取不到就 `[]`，不再占位 `mcp__name`） |
| `POST /api/v1/mcp/servers` | 现有 + 支持 `{ transport:'streamable-http', url, headers? }`；校验 `serverName` 正则 `[A-Za-z0-9_-]{1,32}` 唯一 |
| `GET /api/v1/mcp/health` | 对 stdio：`command` 是否可执行；对 http：`HEAD url` 2s 超时 |

## 5. 前端契约

**设置 → Agent 预设**（`CoreSettings.tsx` L304–352 区域内扩展，不新增页）：
- 列表每行加来源标签（随包 / 用户 / FDE / 根）+ 「含本地代码」小标；用户来源有「删除」。
- 「导入」按钮 → 抽屉（`src/components/settings/PresetImportDrawer.tsx`）：两个 Tab「本地目录」「Git 地址」（Git Tab 在 `git_import_disabled` 时显示如何开启）。流程：填路径/URL → 「检查」→ 预览（id、名称、文件清单、警告：含本地代码需信任）→ 勾「我了解此 preset 将以 shell 级信任运行」→ 「导入」→ 成功后列表刷新，新会话下拉可选。
- 现有「复制」「删除」不变。

**MCP 页**（`MCP.tsx`，布局不变）：
- 列表分两区「MCP 服务器」「业务连接器」（复用现有分组样式）。
- 每张 MCP 卡：transport、状态 Tag（已配置 / 在线 / 需重载）、工具列表（有则展示）、「健康检查」。
- 添加弹窗：transport 单选 stdio / streamable-http，后者显示 url + headers；去掉 `@example/mcp-server` 默认值。
- 保存后：统一文案「已写入配置，需重载核心生效」+ 按钮跳设置重载（删掉「自动拉起」措辞）；`catch→[]` 改为错误条。
- 连接器卡：在线态、catalogVersion、「去设置登记」链接；无写能力按钮。

## 6. 错误与降级

- 目录校验失败 422 逐条；id 冲突 409 允许改 id 后重试。
- git 不可用/超时（30s）→ 502 `git_clone_failed` 含 stderr 摘要。
- 导入成功但 DSH 列表未刷新（缓存）→ 提示「新会话时可见；若未出现请重载核心」。

## 7. 验收清单

人工（5175）：
1. 设置 → Agent 预设 → 列表显示来源标签；`fde-app-builder` 标 FDE，不可删。
2. 导入本地目录：准备 `/tmp/preset-demo/agent.cordis.yml`（复制 standard）+ `preset.yml` → 检查 → 预览 → 勾信任 → 导入 → 列表出现 → 新建会话下拉可选 → 用它开会话能聊。
3. 含 `.mjs` 的目录 → 预览标「含本地代码」。
4. Git 导入未开启 → 提示开启方式；`FDE_ALLOW_GIT_IMPORT=1` 重启 peer 后导入 `https://github.com/hackerFish/awesome-dsh-presets` 的 `minimal-zh` 子目录 → 成功。
5. 删除用户 preset → 目录消失；删 shipped → 403 按钮禁用。
6. MCP 页：两区显示；添加一个 `streamable-http` server → 保存 → 文案「需重载核心」→ 重载 → 状态变在线且工具列表出现（用一个可用的公开 MCP http server 或本地起 `rss-reader-mcp`）。
7. 5174 回归：设置页与 MCP 页原状可用。

自动化：`runtime/tests/presets.test.mjs`（校验规则、id 冲突、shipped 保护、git 关闭 501）、`mcp.test.mjs`（v2 结构、serverName 校验、health）。

## 8. 提交拆分

1. `feat(runtime): preset import (dir/git) + source tagging`
2. `feat(web): PresetImportDrawer in CoreSettings`
3. `feat(runtime): mcp servers v2 + streamable-http + health`
4. `feat(web): MCP page connectors section + honest reload copy`

## 9. 开放问题

无。
