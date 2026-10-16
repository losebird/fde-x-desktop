# FDE-X vs DSH 官方 · 模型链仍存在的差别（查案用）

> 范围：**设置 → 模型与提供方** + **会话选模型 / 推理档**。会话 UI 走同一套 DSH Client iframe，不单独列「选模型实现差」。  
> 对照：[fdex-dsh-model-picker.md](fdex-dsh-model-picker.md)、[settings-provider-manage-plan.md](settings-provider-manage-plan.md)、[siliio-qwen-400.md](siliio-qwen-400.md)。  
> 分支 `cursor/models-settings-parity-d9dd` 已落地的单卡编辑 / mutate / discover「添加所选」等 **不再复述**。

---

## 结论（Ace 先读）

**还差这 8 条**（按「你会看见 / 会写坏盘 / 硅基发错角色」排序）：

1. **两套家目录** — 官方 Client 写 `~/.dsh`，工作台核心写 `~/.dsh-fde-x`；不复制 YAML，列表、密钥、推理档、默认模型都可以和官方不一致。  
2. **本机硅基 Qwen 配置仍分叉** — `~/.dsh` 只有 `{ id, name }`；`~/.dsh-fde-x` 同模型带 **`reasoningEfforts`** → FDE-X 会话有 Off/Default/High，官方同路由没有。  
3. **推理档 Off 救不了硅基 400** — 有 `reasoningEfforts` 时 pi-ai 常把主系统提示走 **`developer`**；会话选 Off 只动 thinking 头，**wire 仍可能是 developer**（见 [siliio-qwen-400.md](siliio-qwen-400.md)）。  
4. **设置 UI 两边都不能改 `reasoningEfforts` / `compat.supportsDeveloperRole`** — 和官方 Models 页一致，但 FDE-X 家目录里**历史债**让硅基特别容易踩坑；要收只能 **改 YAML 或 mutate 删字段**，不能指望界面。  
5. **BFF 仍双轨** — 新 `models-settings/*` 用 pathOps；旧 **`POST/PATCH /api/v1/ai/providers/custom` 仍整段 `set` profile**（`buildCustomProviderProfile` 只带 displayName/api/baseURL/models），**会冲掉** `compat`、`headers`、提供方级 `reasoning` 等；且 **`reasoning: true` 仍会给新模型注入默认 `reasoningEfforts`**。  
6. **离线 / 落盘解析仍薄** — `readSettingsProviderProfile` **读不进** `reasoningEfforts`；`formatSettingsProviderBlock` 写回时把 efforts **压成固定五档模板**。未连核心或走旧 custom 保存时，容易 **丢字段或写错形状**。  
7. **设置页仍缺官方几项「人会点」的行为** — **无「清除 API 密钥」**（`clearAiProviderKey` / `DELETE .../key` 未接 UI）；**添加自定义**里 discover **默认勾选全部模型**（编辑卡里只预选「新 id」）；**继承 catalog 的模型行也可点删**（官方仅用户层持有的行可删）；**无 `settings/document-updated` 类自动刷新**（手改 YAML 要靠重载/再进设置）。  
8. **legacy 回退路径语义不对** — `GET models-settings` 失败时退回旧列表：`removable = kind === 'custom'`，**不是**官方的「仅 user 层拥有 profile」；保存走 `patchCustomAiProvider`，仍可能触发 §5 整段写。

**会话选模型本身**：同一 Host 的 `session/modelCatalog` + `session/selectModel`，**无 FDE-X 自造选择器**；差别几乎全来自 **读哪份 `settings.yaml`** 和 **盘上模型元数据**。

---

## 1. 家目录与「同模型不同表现」

| | 官方 DSH Client | FDE-X 工作台 |
|---|----------------|-------------|
| 默认家 | `~/.dsh` | `FDE_DSH_HOME` → `~/.dsh-fde-x` |
| 本机硅基 Qwen（2026-09-25） | `models: [ { id, name } ]`，无 `reasoningEfforts` | 同 id **带** `reasoningEfforts: off/low/medium/high` |

**人会看见：** 官方会话菜单只有模型名；FDE-X 同 id 多一行推理档。  
**不是** discover 或设置页新 UI 单独造的，而是 **两份家目录 + 历史写入**（见 [fdex-dsh-model-picker.md](fdex-dsh-model-picker.md) §2）。

`agent-default-model` 等也只落在 FDE-X 家目录时，**新会话默认模型**也会和官方 Client 不同（官方 `~/.dsh` 本机片段里未见同键，FDE-X 有 `provider: sili`）。

---

## 2. 硅基 / 推理档 / `developer`（同一模型链）

| 现象 | 原因 |
|------|------|
| FDE-X 有推理档，官方没有 | FDE-X 盘上该模型有 `reasoningEfforts`；官方只有 id/name → pi-ai 标为非推理模型 |
| 选 Off 仍 400（20015 developer） | 推理模型 + `openai-completions` 默认 compat → 主 system 走 `developer`；硅基不认 |
| 设置里没法「关掉 developer」 | 官方与 FDE-X **都不提供** `compat` 表单；硅基要 `system` 需 YAML（如 `compat.supportsDeveloperRole: false`）或去掉推理模型标记 |

**收法（只理解，非改造方案）：** 要对齐官方表现 → 让 FDE-X 家目录里硅基 Qwen **与 `~/.dsh` 一样去掉 `reasoningEfforts` 整段**，重载核心；要止血 400 → 同上或补 compat，**不是**只在会话里选 Off。

---

## 3. 设置页：已对齐 vs 仍差

### 已对齐（略）

单卡编辑、折叠区、模型目录行删、恢复默认、discover → 搜索 +「添加所选」、`models-settings` + `settings/mutate` + revision、删除 removable 提供方（**新路径**）、协议来自 schema — 见 plan §3 与 `internal/settings-provider-models-parity-bc-c558.md`。

### 仍差（相对官方 `@deepseek-ai/dsh-client-ui-settings-models` README.zh）

| 项 | 官方 | FDE-X 今天 |
|----|------|------------|
| 清除密钥 | 可删凭据，行显示缺失 | BFF 有 `DELETE /providers/:id/key`、`setModelsCredential(delete)`，**UI 无按钮** |
| 添加自定义 · discover | 选择器；谨慎勾选 | **`AddCustomCard` discover 后 `discoverPick` 默认全选**（`ModelsProvidersSection.tsx` ~910） |
| 删模型行 | 仅用户层持有的行 | **任意行可删**；保存后可能 **物化整表 `models` override** |
| 外部改 YAML | 订阅 `settings/document-updated` 等 | **无**；靠重载核心 / 再进设置 |
| revision 冲突 | 展示 Host 诊断 | BFF 可 **409 `settings_conflict`**；UI **无专门冲突态**（通用错误文案） |
| Profile 其它字段 | path 级 mutate 保留 | **旧 custom POST/PATCH** 仍 **整块 profile 替换**（`applyCustomProviderWrite` + `buildCustomProviderProfile`） |
| API 密钥校验 | 可打印 ASCII | **仅** `models-settings/apply` 走 `validateApiKeyInput`；旧 `POST providers` **未统一** |

### 壳与验收

- 仍是 FDE-X `CoreSettings` 卡片，**不是**官方包（规格禁止进浏览器）— 行为应对齐 README，**6.1–6.3 逐步点验仍待 Ace**（parity 实现记录：当时 core 未连）。  
- `models-settings` 不可用（旧 4318）时：**黄条 legacy**，语义见 §结论 8。

---

## 4. 代码锚点（改产品前先查）

| 主题 | 位置 |
|------|------|
| 整段 custom 写盘 / `reasoning: true` | `runtime/server.mjs` `buildCustomProviderProfile`、`applyCustomProviderWrite`、`formatSettingsProviderBlock` |
| 新路径保留字段 | `runtime/models-settings.mjs` `pathOps`；`POST .../models-settings/apply` |
| 设置 UI | `src/components/settings/ModelsProvidersSection.tsx` |
| 会话模型菜单 | `src/pages/AI.tsx` → `/dsh-app/` |
| 硅基 wire | [siliio-qwen-400.md](siliio-qwen-400.md) |

---

## 5. 故意不列为「FDE-X 独有 bug」

- **推理能力不在 Models 设置表单里** — 官方同样；差别是 FDE-X 家目录 **更容易带上** `reasoningEfforts`。  
- **会话选模型 UI** — 与官方同一 Client；不要在工作台另找一套选择器。  
- **IM / 现查 / 业务 SQLite** — 不在本表（除非改同一 `settings.yaml` 链）。
