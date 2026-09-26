# 02 · FDE Host 工具集（bridge 升级）+ `askAiForResult`

依赖：01（事件）。被依赖：04、05、06、07。协议：`00-agent-protocol.md`。

## 1. 目标

让 AI 能**结构化地**把结果交回 FDE-X，而不是让前端解析自然语言：
- 在 `runtime/fde-x-dsh-bridge`（已是 DSH Host 插件）里注册一组 `fde_*` 工具，AI 在会话内可调；工具通过 loopback 调 BFF。
- 前端一个公共原语 `askAiForResult()`：开/选会话 → 发 prompt → 等待 AI 调 `fde_submit_result` → 拿回 JSON。
- 专用 preset 动作**新开会话**（铁律扩展）。

## 2. 范围与禁区

- 做：Host 工具注册、BFF 「结果邮箱」路由、前端原语、`fde-app-builder` / `fde-briefing` 两个 preset 目录骨架（只放 `preset.yml` + `agent.cordis.yml` + Skill 占位，具体 Skill 内容由 04/06 填）。
- 不做：改 DSH 源码；MCP；bridge 的 `/fde-session/*` 旧路由不动。
- 禁区：`runtime/dsh-core.patch.yml` 只允许加 bridge 的配置项，不加别的插件。

## 3. 现有代码接点

| 接点 | 位置 |
|---|---|
| bridge Host | `runtime/fde-x-dsh-bridge/lib/index.js` L102–141：`handler` + `webServer.register`，`PREFIX='/fde-session'`（`export`、`restore` 400 占位）。包内**无** `tools.js`，需新建 |
| bridge Client | `runtime/fde-x-dsh-bridge/lib/client.js`：iframe `postMessage` op `select/prompt/compose/rename/fork/attach/transcript/readAssistant` |
| **Host 工具注册方式（已核实）** | 按 lan-assist 生产形态：`~/.dsh/vendor/dsh-lan-assist/tools.js` L25–128 `export function registerTools(ctx, { defineTool }, deps) { ctx.tools.register(defineTool({ name, description, parameters, execute })) }`；`biz_describe` 样例 L106–128。`dsh-tool-cordis` 是动态插件 inspect/define 流程，**不用于**本规格 |
| preset 目录 | `~/.dsh-fde-x/.agent-presets/<id>/{preset.yml, agent.cordis.yml}`；随包 `standard` 在 `@deepseek-ai/dsh-agent-presets/presets/standard/` |
| 新建会话带 preset | `server.mjs` L1438–1456 `POST /api/v1/ai/sessions`，`agentPreset` L1450；`runtime-api.ts` `createRemoteSession` |
| IM 现有回流 | `IMWorkspace.tsx` L1008–1020 `promptAi` → `AI.tsx` L411–418 `readAssistant`；`watchAssistant` 条件 `sawRun && !running` |
| BFF 到 DSH RPC | `runtime/dsh-core.mjs` `call()`；BFF 端口 `runtime/config.mjs` |

## 4. Host 工具定义（AI 可见）

工具名前缀 `fde_`。所有工具的 `cwd` 由 Host 从会话上下文取，AI 不传。

| 工具 | 入参 schema | 返回 | 说明 |
|---|---|---|---|
| `fde_submit_result` | `{ requestId: string, kind: 'json'|'text', data: any, summary?: string }` | `{ ok }` | 把结果投递到 BFF 结果邮箱。`requestId` 来自 prompt 里的 `[fde-request:<id>]` 标记 |
| `fde_context_get` | `{ scope: ('workspace'|'tasks'|'im'|'biz'|'apps')[] }` | 上下文包（规格 07 §4） | AI 主动拉上下文 |
| `fde_app_spec_submit` | `{ requestId, spec: object }` | `{ ok, appId, revision, errors?: [] }` | 规格 04；服务端校验，失败返回 errors 让 AI 改 |
| `fde_app_records_query` | `{ slug, entity, filter?, limit? }` | `{ rows, columns }` | 规格 04；只读 |
| `fde_app_records_propose` | `{ slug, entity, op:'insert'|'update'|'delete', rows }` | `{ proposalId }` | 规格 04；进 operations 待人确认，**不直接写** |
| `fde_briefing_submit` | `{ requestId, sections: [] }` | `{ ok, briefingId }` | 规格 06 |
| `fde_memory_draft` | `{ title, body, refs: string[], layer:'project'|'daily'|'user' }` | `{ cardId }` | 规格 07；只起草 |

Host 实现：`runtime/fde-x-dsh-bridge/lib/tools.js`，每个工具 = `fetch('http://127.0.0.1:<FDE_RUNTIME_PORT>/api/v1/bridge/<name>', { headers: { 'x-fde-bridge-token': <token> } })`。token 由 BFF 启动时生成写入 `$FDE_DSH_HOME/run/bridge.token`，bridge 启动读取；BFF 校验该 header 而非 Origin。

## 5. BFF 路由（`runtime/routes/bridge.mjs`）

| 路由 | 说明 |
|---|---|
| `POST /api/v1/bridge/submit-result` | 校验 token → 写 `ai_results` 表 → `emit('ai.result.ready', {requestId})` |
| `GET /api/v1/ai/results/:requestId` | 前端轮询/或等事件；返回 `{ status:'pending'|'ready'|'expired', kind, data, summary, sessionId }`；ready 后 10 分钟过期 |
| `POST /api/v1/bridge/context` | 转规格 07 的上下文包构造 |
| 其余 `bridge/*` | 由 04/06/07 各自规格定义，统一挂在本文件 |

```sql
-- 005_ai_results.sql
CREATE TABLE IF NOT EXISTS ai_results (
  request_id TEXT PRIMARY KEY,
  workspace_cwd TEXT NOT NULL,
  session_id TEXT,
  kind TEXT NOT NULL,
  data_json TEXT NOT NULL,
  summary TEXT,
  created_at INTEGER NOT NULL
);
```

## 6. 前端原语（`src/lib/ask-ai.ts`）

```ts
export type AskAiOptions = {
  intent: string;                 // 人话意图，进 prompt 首行
  prompt: string;                 // 具体指令
  schema?: object;                // JSON Schema；有则 prompt 追加「用 fde_submit_result 提交符合 schema 的 JSON」
  preset?: string;                // 有 → 新开会话（agentPreset），无 → currentAiTarget 当前会话
  context?: ContextScope[];       // 规格 07；默认 ['workspace']
  timeoutMs?: number;             // 默认 120000
  title?: string;                 // 新开会话时的标题
};
export type AskAiResult<T> = { ok: true; data: T; sessionId: string; summary?: string } | { ok: false; error: string; sessionId?: string };
export async function askAiForResult<T>(opts: AskAiOptions): Promise<AskAiResult<T>>;
```

流程：
1. `requestId = ulid()`；解析目标：`preset` 有 → `createRemoteSession({ cwd, agentPreset: preset, title })` 并 `setActiveAiSessionId`（左栏可见）；无 → `loadCurrentAiTarget()`。
2. 组 prompt：`[fde-request:<id>]\n<intent>\n<context pack 摘要>\n<prompt>\n完成后调用 fde_submit_result(requestId="<id>", …)`。
3. `promptAi(target, prompt)`（现有）。
4. 等待：优先订阅事件 `ai.result.ready`（规格 01），退化为 2s 轮询 `GET /ai/results/:id`，到 `timeoutMs` 报 `timeout`。
5. `schema` 给了则本地再校验一次（ajv 已在依赖？没有则用轻量手写校验器 `src/lib/json-schema-lite.ts`，仅支持 type/required/enum/properties/items）。

## 7. Preset 骨架

`~/.dsh-fde-x/.agent-presets/fde-app-builder/` 与 `fde-briefing/`：由 BFF 在启动时 `ensurePresets()` 从仓库 `runtime/presets/<id>/` 拷贝（不存在才拷，存在不覆盖；`FDE_PRESET_SYNC=force` 时覆盖）。`agent.cordis.yml` = `standard` 的内容 + bridge 工具 + 各自 Skill 目录。`preset.yml`：`name: FDE 应用构建 / FDE 早报`，`order: 90/91`。

## 8. 错误与降级

- bridge token 缺失/不匹配 → 401 `bridge_unauthorized`，Host 工具返回 `{ok:false,error}` 给 AI。
- AI 没调 `fde_submit_result` 就结束 → `askAiForResult` 超时，UI 黄条「AI 没有提交结构化结果，可在 AI 页查看它说了什么」+ 打开该会话的按钮。
- 新开会话失败（DSH 未连）→ 红条「核心未连接」。
- 结果 schema 不符 → `askAiForResult` 返回 `{ok:false,error:'schema_mismatch'}`，data 仍附在 `raw` 供 UI 展示。

## 9. 验收清单

人工（5175）：
1. 设置 → Agent 预设列表出现「FDE 应用构建」「FDE 早报」。
2. 在 AI 会话里对 AI 说「调用 fde_context_get 看看我有哪些待办」→ 轨迹里出现该工具调用并返回 JSON。
3. 在浏览器 console 跑 `window.__fdeAsk({intent:'测试',prompt:'请用 fde_submit_result 提交 {"hello":"world"}',schema:{type:'object',required:['hello']}})`（开发态暴露）→ 30s 内 resolve `{ok:true,data:{hello:'world'}}`；`GET /api/v1/ai/results/<id>` 为 ready。
4. 同样调用带 `preset:'fde-app-builder'` → 左栏出现新会话，标题为 `title`，结果回流。
5. 伪造 token 调 `POST /api/v1/bridge/submit-result` → 401。
6. 5174 回归：IM 拟回/采纳仍走原路径正常。

自动化：`runtime/tests/bridge.test.mjs`：token 校验、结果写读、过期；`node --test`。

## 10. 提交拆分

1. `feat(bridge): fde_* host tools + token handshake`
2. `feat(runtime): bridge routes + ai_results`
3. `feat(runtime): ensure fde-app-builder/fde-briefing presets`
4. `feat(web): askAiForResult primitive`
5. `chore(web): dev-only window.__fdeAsk`

## 11. 开放问题

已关闭：Host 工具注册用 lan-assist 的 `registerTools(ctx, { defineTool })` 形态（见 §3）。bridge 的 `index.js` 需在插件 `apply/setup` 里调用 `registerTools`，与现有 `webServer.register` 并存。
