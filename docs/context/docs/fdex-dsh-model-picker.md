# FDE-X vs DSH 官方：会话选模型与「推理档」

## 结论（Ace 先读）

| 问题 | 一句话 |
|------|--------|
| **模型管理是不是和 DSH 差很多？** | **会话里选模型：不差。** FDE-X 对话区嵌的是同一套 DSH Client（`/dsh-app/` iframe），同一 RPC `session/modelCatalog` + `session/selectModel`，推理行由 **磁盘上的 `llm-pi-ai.providers.*.models[].reasoningEfforts`** 决定，不是 FDE-X 另写了一个选择器。 |
| **你在 DSH 官方配的硅基 Qwen 为什么没有推理档？** | 本机 `~/.dsh/settings.yaml` 里 `sili` 只有 `{ id, name }`，**没有 `reasoningEfforts`**。对手工声明的 OpenAI-Compatible 模型，省略该字段时 pi-ai 视为 **非推理模型** → `modelCatalog` 不带 `reasoning.efforts` → 菜单里只有模型名。 |
| **FDE-X 里为什么有 Off / Default / High？** | FDE-X 核心读 **`~/.dsh-fde-x/settings.yaml`**（另一套家目录），其中 `Qwen/Qwen3.8-27B` **写了 `reasoningEfforts`**。主要不是 discover 带的（discover 只给 id/名/容量），而是 **早年 FDE-X「添加自定义提供方」保存时 BFF 固定 `reasoning: true`**，给每个新模型注入整表 `reasoningEfforts`；之后编辑卡保存会 **原样保留** 该字段。 |
| **和硅基 `developer` 400 是不是一条缝？** | **同一条链路上的不同症状。** 有 `reasoningEfforts` → 模型被标成「可推理」→ pi-ai 对 `openai-completions` 常把主系统提示走 **`developer` 角色**（除非显式 `compat.supportsDeveloperRole: false`）。硅基只认 `system`。官方只配 id/name 时通常 **不出现推理档，也更容易走 `system`**。界面选 Off **只改 `reasoningEffort` 请求头**，**不能**单独关掉 `developer` wire（见 [siliio-qwen-400.md](siliio-qwen-400.md)）。 |

**关键误区：** 在 **DSH 官方 Client** 里配硅基，写的是 `~/.dsh/`；FDE-X 工作台核心是 **`~/.dsh-fde-x/`**。两边「配了同样的 Qwen」若没手动对齐两份 `settings.yaml`，表现可以完全不同。

---

## 1. DSH 官方这条硅基 Qwen：`reasoningEfforts` 与会话菜单

### 本机证据（2026-09-25）

`~/.dsh/settings.yaml` 片段：

```yaml
sili:
  apiKeyEnv: SILI_API_KEY
  api: openai-completions
  baseURL: https://api.siliconflow.cn/v1
  models: [ { id: Qwen/Qwen3.8-27B, name: Qwen/Qwen3.8-27B } ]
```

- **`reasoningEfforts`：无**（与 Ace 截图「只见 Qwen/Qwen3.8-27B、无推理等级」一致）。
- 官方 **Models 设置页故意不提供推理档控件**（`dsh-client-ui-settings-models`：推理是 **按模型** 的能力，只在 **会话模型选择器** 里展示，不在提供方编辑卡里配）。

### 为什么不画推理档（机制，非 FDE-X 特例）

DSH Host `session/modelCatalog` → 对每个模型 `resolveModelInfo` → 若适配器不报 `reasoning`，目录项就没有 `reasoning.efforts`（`dsh-api-session-controller` `catalog.js`）。

对 pi-ai 手工路由（`dsh-llm-pi-ai`）：

- 模型条目 **省略** `reasoningEfforts` → 解析为 `{ reasoning: false }`（无已安装目录条目时 `base` 也为空）。
- `reasoningInfo()` 对非推理模型返回空 → **选择器不渲染「推理等级」行**（`dsh-client-ui-model-selection` README：无推理元数据则 Effort 行缺席）。

因此：**不是 DSH「藏了」推理档，而是当前这份官方家目录配置下，该模型在协议上就不是「可选推理档」的模型。**

---

## 2. FDE-X 为什么同模型有推理档

### 本机证据

`~/.dsh-fde-x/settings.yaml` 同路由：

```yaml
sili:
  displayName: 硅基流动
  ...
  models:
    - id: Qwen/Qwen3.8-27B
      name: Qwen/Qwen3.8-27B
      reasoningEfforts:
        off: null
        low: low
        medium: medium
        high: high
```

### 来源归因（按可能性）

| 来源 | 是否会把 `reasoningEfforts` 写上 | 说明 |
|------|----------------------------------|------|
| **`llm/discoverModels`** | **否** | 只归一化 id、显示名、上下文/输出上限；**不写**推理表（pi-ai README「发现」节）。 |
| **官方 Models 编辑卡保存** | **否** | 官方 UI 无推理档字段；只能手改 YAML 或继承已有字段。 |
| **FDE-X 编辑卡 `applyModelsSettings` / `patchCustom`** | **仅保留** | 新 UI 从 `settings/describe` 带出已有 `reasoningEfforts` 时，保存会 **带回**（`ModelsProvidersSection`）；**不会**给纯 id/name 新模型自动加表。 |
| **FDE-X 旧「添加自定义提供方」+ BFF** | **是（历史主因）** | 基线 `CoreSettings` 创建时 **`reasoning: true` 写死** → `runtime/server.mjs` `buildCustomProviderProfile` 对新模型注入默认 `reasoningEfforts: { off, low, medium, high, xhigh }`。当前 `AddCustomCard` **已不再传** `reasoning: true`，但 **已落盘配置不会自动回滚**。 |
| **手改 YAML** | 可能 | 与 grok2api 块里推理模型写法对齐时常见。 |

会话里看到的 **Off / Default / High**：Effort 名来自 pi-ai 等级 id 的首字母大写（如 `off`→「Off」），**Default** 对应目录里的 `defaultEffort` 或「提供方默认」文案（`effort.providerDefault`），不是 FDE-X 自造第三套 UI。

### 会话选模型 UI 在哪

- FDE-X：`src/pages/AI.tsx` 加载 **`/dsh-app/`** iframe，模型菜单 = DSH Client 同一实现。
- 与 [settings-provider-manage.md](settings-provider-manage.md) §7 一致：工作台 **不嵌** 官方 Models **设置页**，但 **会话侧模型选择 = 同一 Host 目录**。

---

## 3. 与硅基 `developer` / 20015 的关系

对照 [siliio-qwen-400.md](siliio-qwen-400.md)：

| 层 | 行为 |
|----|------|
| **配置** | `reasoningEfforts` 存在 → 模型按 **推理模型** 物化。 |
| **compat** | `openai-completions` 上，`supportsDeveloperRole` 默认语义：对推理模型系统提示可走 **`developer`**（`dsh-llm-pi-ai` `PiAiCompatProfile` 注释）。硅基网关 **不接受** `developer`。 |
| **会话 Off** | 只影响本轮 **`reasoningEffort: "off"`**（thinking 参数侧）；**不保证** wire 上主 system 变 `system`。本机已证 Off 会话仍 `developer` → 20015。 |
| **官方只配 id/name** | 通常 **无推理档 UI**，且更常落在 **非推理 / `system` 路径**，与 FDE-X 家目录里「带推理表」的配置 **不是同一条运行时路径**。 |

**结论：** 不是「模型管理页多了一个开关导致 400」，而是 **FDE-X 家目录里多出来的 `reasoningEfforts`（多来自历史 BFF/UI）** 与 **硅基角色表** 撞车；和「推理档选 Off」是 **同一缝上的两层表现**（配置 + 单次请求头）。

---

## 4. 除推理档外，模型管理还和官方差什么（仅列 **仍存在的** 差别）

已按 `cursor/models-settings-parity-d9dd` 对齐的（单卡编辑、mutate+revision、discover「添加所选」、模型行删除、恢复默认、自定义删改等）**下面不再复述**。见 [settings-provider-manage-plan.md](settings-provider-manage-plan.md) 与 `internal/settings-provider-models-parity-bc-c558.md`。

| 仍存在的差别 | 说明 |
|--------------|------|
| **两套 DSH Home** | 官方 Client → 默认 `~/.dsh`；FDE-X → `FDE_DSH_HOME` / `~/.dsh-fde-x`。不复制 YAML 则 **列表、推理档、密钥** 均可不一致。 |
| **历史配置债** | 旧创建流写入的 `reasoningEfforts` 仍在磁盘；新 UI 不自动清除。 |
| **BFF 双轨** | `models-settings/*` 与旧 `GET/POST/PATCH providers` 并存；语义应以 mutate 为准，兼容层仍可能走 `buildCustomProviderProfile`（含 `reasoning: true` 分支）。 |
| **离线 / 未连核心** | `readSettingsProviderProfile` 等 YAML 正则兜底 **不完整解析** `reasoningEfforts`；连上后应以 `settings/describe` 为准（plan 技术债 #2）。 |
| **设置页壳** | FDE-X 仍是 `CoreSettings` 卡片，**不是** 官方 `@deepseek-ai/dsh-client-ui-settings-models` 包；字段对齐靠实现，需 Ace 连核心做点验（parity 文档 6.1–6.3 **待验**）。 |
| **外部改盘刷新** | 官方可订阅 `settings/document-updated`；工作台主要靠 **保存成功 / 重载核心 / 再进设置**（plan 二期 SSE 未做）。 |
| **推理能力配置入口** | 官方与 FDE-X **设置 UI 都不提供** `reasoningEfforts` 表单；要关推理档只能 **改 YAML / mutate 删字段 / 去掉历史注入**，与 Client 行为一致但 **对 Ace 不直观**。 |

---

## 5. 对照文件与代码锚点（查案用）

| 主题 | 位置 |
|------|------|
| 硅基 400 / developer | [siliio-qwen-400.md](siliio-qwen-400.md)、[siliio-qwen-400-plan.md](siliio-qwen-400-plan.md) |
| 提供方管理缺口与 DSH 关系 | [settings-provider-manage.md](settings-provider-manage.md) |
| 官方 Models 行为契约 | [settings-provider-manage-plan.md](settings-provider-manage-plan.md) §1 |
| FDE-X 会话嵌 DSH | `src/pages/AI.tsx` `dshAppSrc` |
| 历史 `reasoning: true` 注入 | git `a8449148` `CoreSettings.tsx`；`runtime/server.mjs` `buildCustomProviderProfile` |
| 目录 → 推理 UI | `dsh-llm-pi-ai` `resolveModelReasoning` / `reasoningInfo`；`dsh-api-session-controller` `buildModelCatalog` |

**截图：** 任务附带的 `/home/ubuntu/.cursor/projects/workspace/assets/f3011fa8-31c5-4fb2-bcda-9c76f0cfc142.png` 在本 worker 上不存在；与本机 `~/.dsh/settings.yaml` 无 `reasoningEfforts` 的叙述一致。

---

## 6. 给 Ace 的操作记忆（仍不改产品，仅理解）

1. **要对齐表现**：要么把 `~/.dsh-fde-x` 里硅基 Qwen 改成与 `~/.dsh` 一样 **只有 id/name**，要么反向拷贝；然后 **重载核心**。
2. **要消推理档且减少 developer 风险**：删掉该模型上的 **`reasoningEfforts` 整段**（不是只在会话里选 Off）。临时验证见 [siliio-qwen-400-plan.md](siliio-qwen-400-plan.md) §怎么收。
3. **在 DSH 官方里配 ≠ 在 FDE-X 里生效**，除非两份 home 同步。
