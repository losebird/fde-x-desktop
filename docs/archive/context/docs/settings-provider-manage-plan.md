# 模型与提供方 · 与 DSH 官方 Models 页对齐（待点头）

对照 [管理缺口说明](settings-provider-manage.md) 与 Ace 截图（grok2api 展开卡：编辑/删除、API 密钥、**自定义设置**、显示名称、API 地址、协议、模型目录、**恢复默认**、**获取可用模型**、**每条模型可删**）。

**本文是方案，不落地**，直到 Ace 点头。  
**先前「薄行换密钥/删自定义」方案与已提交的 `77fc380b` 方向作废**：那条线只补了行内按钮，**达不到**与官方 Models 页同一套字段与语义；点头后应以本文为准 **改写/替换** 该实现，而不是在薄行上继续堆按钮。

---

## 结论（先读）

| 问题 | 答案 |
|------|------|
| **做不做得到？** | **做得到**，且必须做到与官方 **同一账本**（`settings.yaml` 用户层 + `.credentials.yaml` + DSH RPC），不新表、不第二套 provider 状态。 |
| **正路是什么？** | **不能**在 FDE-X 浏览器里打开/嵌入 DSH 官方 Client 或 `@deepseek-ai/dsh-client-ui-settings-models`（`PRODUCTION-SPEC`：官方前端包不得进浏览器；也不嵌整页）。**正路**：在 **设置 → 核心** 用 FDE-X 壳 **按官方同一交互与字段重做**「Models 设置分区」——行为对齐 `@deepseek-ai/dsh-client-ui-settings-models`（README.zh + `ProviderEditor` / `ModelListEditor`），经 BFF 调用与官方 `createModelsOperations` **相同的** Host RPC。 |
| **会不会两套账？** | 不会。官方页与工作台都是 **读** `llm/listProviders` ⨝ `llm/listConfigurableProviders`，**写** `settings/mutate`（带 revision）+ `credentials/set|delete` + `llm/discoverModels`。FDE-X 只换 UI 壳，不换存储。 |
| **`77fc380b` 怎么办？** | 可作为 BFF 草稿（PATCH/DELETE key、custom 块 upsert），但 **UI 与写入语义必须推倒重做到「一张展开编辑卡」**；与官方冲突的部分（例如整段 profile 覆盖丢字段、discover 后全选直写）要改。 |

**规格锚点（实现前再读一遍）：**

- `PRODUCTION-SPEC` §0：FDE-X 壳；**禁止** `dsh-web-frontend` / 官方 Client UI 包进浏览器。
- `CoreSettings` 现有文案：「不要嵌 DSH 整页」——允许 **同卡片内** 复刻官方 **单页 Models 分区** 的交互，不是 iframe、不是另开官方站点当管理入口。

---

## 1. 官方 Models 页在干什么（行为契约）

来源：本机 DSH `0.1.5-rc.1` 依赖 `@deepseek-ai/dsh-client-ui-settings-models`（`README.zh.md`）。

**页面结构（Ace 截图即此）：**

- 提供方 **一行一个**；**同时只展开一张编辑卡**（添加/编辑共用卡形态）。
- 主区：**API 密钥**（只写，不回显明文）；绿/红点表已配置/缺失。
- **自定义设置**（折叠）：按适配器家族不同字段不同，但 grok2api 类 pi-ai 路由至少包含：**显示名称**、**API 地址**、**API 协议**、**模型目录**（可增删行）。
- **获取可用模型**：对 **表单当前值**（含未保存的密钥）调 `llm/discoverModels` → 打开 **可搜索选择器** → 用户点 **添加所选** 才写入草稿行（**禁止** discover 后静默全量勾选进配置）。
- **恢复默认**：仅当用户层 **整体覆盖** 了 `models` 数组时出现；执行后 **unset** 用户层 `models`，回到继承的内置 catalog。
- **删除提供方**：仅当 **用户层单独持有** 该 profile（`removable`）时可删；确认框指名提供方；先清 **本页派生的** `<ROUTE>_API_KEY`（若 profile 的 `apiKeyEnv` 与该派生一致），再 `settings/mutate` unset profile。
- **官方目录行**（qwen 等）：不能删 route id；可改密钥；DeepSeek 家族另有 **模型 id/显示名/context** 等（pi-ai 自定义路由用 ModelListEditor 那一套）。
- **并发**：每次 `settings/mutate` 带 `expectedRevision`；冲突要展示 Host 诊断，不能静默覆盖。
- **外部改 YAML**：官方订阅 `settings/document-updated` 等事件刷新；工作台至少要在 **重载核心 / 保存成功 / 再次进入设置** 时与磁盘一致（可选二期：BFF SSE 或轮询 describe）。

---

## 2. 正路 vs 错路

| 路线 | 结论 |
|------|------|
| 浏览器 iframe / 内嵌 DSH Web Client Models 页 | **禁止**（规格 + 安全边界） |
| 直接 `import @deepseek-ai/dsh-client-ui-settings-models` 进 Vite | **禁止**（官方前端包不得进浏览器；且强依赖 Cordis inject） |
| 让用户去官方 Client 改，工作台只读 | **不行**——两套入口、ADHD 成本高，且与「必须一致」矛盾 |
| FDE-X `CoreSettings` 复刻 **ModelsSection 语义** + BFF 实现 **ModelsOperations** | **正路** |
| 仅在列表行加「换密钥/删除」、编辑仍用底部「添加自定义」面板 | **错路**（即已作废的薄行方案） |

---

## 3. 官方每一项能力 → 工作台现状 → 补什么 → 打哪条 RPC/配置

账本始终：`FDE_DSH_HOME`（默认 `~/.dsh-fde-x`）下 `settings.yaml` + `.credentials.yaml`；运行时经已连接的 DSH 进程 RPC，未连接时 BFF 落盘（与今天添加自定义一致）。

| 官方能力（Ace 截图项） | 工作台今天（含 `77fc380b`） | 缺口 | 落地时打什么 |
|------------------------|----------------------------|------|----------------|
| 列表：显示名 + route + 密钥状态点/标签 | 有列表 + Tag | 状态应改为与官方一致的 **已配置/缺失** 语义（可保留 Tag 样式，但逻辑同 `credentials/describe`） | **读** `credentials/describe`；**读** `llm/listConfigurableProviders` + `llm/listProviders` |
| 行操作：**编辑** | 自定义有「编辑」；目录项只有换钥 | 目录项也要进 **同一张编辑卡**（至少密钥 + 该家族折叠字段） | 编辑卡加载：`settings/describe` → 取 `entry.settingsNs` + `settingsPath` 下 **合并后的 profile 视图** |
| 行操作：**删除** | 仅 `kind=custom` 可删 | 需官方 **`removable`** 规则：仅用户层拥有的 profile 可删；目录内置项 **无删除** | **写** `settings/mutate` `op: delete` path `providers.<id>`（pi-ai）或对应 deepseek path；**写** `credentials/delete`（条件见官方 README） |
| **API 密钥** 字段 | 目录：行内换钥/清除；自定义：表单里 | 密钥应只在 **编辑卡主区** 维护；校验 **可打印 ASCII**（与官方一致） | **写** `credentials/set`；清：**写** `credentials/delete` + `.credentials.yaml` 删 ref |
| **自定义设置** 折叠区 | 无折叠；字段散在「添加自定义」大表单 | 展开卡内 **折叠块**；pi-ai：`displayName` `baseURL` `api` + 模型区 | **写** `settings/mutate` **路径级** set/unset（见 §4），非整段 YAML 手搓覆盖 |
| **显示名称** | 自定义表单有 | 编辑卡内、与官方同位置 | `mutate` set `…displayName` |
| **API 地址** | 有 | 编辑卡内 | `mutate` set `…baseURL` |
| **API 协议** | 下拉有 | 选项须来自 **namespace schema**（`protocolChoices`），不能写死与 schema 漂移 | **读** `settings/describe` 里 `llm-pi-ai` schema；**写** `mutate` set `…api` |
| **模型目录**（行内列表） | 仅 discover 勾选区 + 只读胶囊 | 需要 **可编辑行**（id、name 等）+ **每行删除** | `mutate` set/unset `…models` 数组元素；保存时 **保留未展示字段**（`reasoningEfforts` 等） |
| **恢复默认**（模型） | **无** | 当用户层 override 了 `models` 时显示 | `mutate` **unset** `providers.<route>.models`（或等价 delete path） |
| **获取可用模型** | 有按钮，但结果 **checkbox 全选式** | 改为官方：**搜索 + 添加所选**；失败显示在列表旁，可手填 | **写/探** `llm/discoverModels`（`settingsNs` + request）；BFF 可继续 `POST /api/v1/ai/providers/discover` 但 **响应只供选择器** |
| discover 后写入 | 易 **覆盖** 已有行 | 合并：已存在行 **保留用户改过的值** | 客户端合并规则照抄 `ModelListEditor` 文档 |
| **添加提供方**（目录休眠项） | 「+ 添加提供方」小表单 | 改为官方 **添加卡**：选目录 id + 编辑卡流程 | 同编辑卡；密钥 + 可选折叠字段 |
| **添加自定义提供方** | 有 | 合并进 **添加卡**；校验 route / URL / 至少一模型 | `POST` 创建 = 首次 `mutate` set 整块 profile + `credentials/set` |
| **应用/保存** | 自定义 PATCH；目录 PATCH key | 统一：**先 mutate（带 revision）→ 再 set 密钥**；失败只重试失败阶段 | `settings/mutate` + `expectedRevision`；然后 `credentials/set` |
| 底部 **模型胶囊**（只读总览） | 有 `session/modelCatalog` | **保留**；编辑保存后 `GET /api/v1/ai/models` 刷新 | **读** `session/modelCatalog`（会话选模型 **不改**） |
| **重载核心** | 有 | 保留；保存成功提示与今天一致 | 现有 `POST /api/v1/ai/reload` |

**RPC/配置清单（BFF 必须对齐官方 `ModelsOperations`，禁止臆造新方法名）：**

| 操作 | DSH RPC（`typert.host.js` 已存在） |
|------|-------------------------------------|
| 拉整页快照 | `llm/listProviders`、`llm/listConfigurableProviders`、`settings/describe`、`credentials/describe` |
| 改 profile | `settings/mutate`（`ns` + `ops[]` + `expectedRevision`） |
| 密钥 | `credentials/set`、`credentials/delete` |
| 探模型 | `llm/discoverModels` |
| 会话侧模型菜单 | **不动** `session/modelCatalog`、`session/selectModel` |

---

## 4. 推荐架构（点头后实施）

### 4.1 UI：`CoreSettings` 内嵌「Models 分区」

- **替换** 当前「折叠列表 + 行内薄按钮 + 底部双 panel」为：
  - **提供方列表**（与官方同序：`joinProviderDirectory` 语义）
  - **至多一张** `ProviderEditor` 等价卡（新建 / 编辑共用）
  - 保留 **「+ 添加提供方」「+ 添加自定义提供方」** 入口，但点击后进入 **同一编辑卡**，而不是另一套表单布局
- **保留** FDE-X 卡片标题、重载核心按钮、模型胶囊；**不**新增路由、不嵌 Client。
- **按 `settingsNs` 分支**（与官方一致）：
  - `llm-pi-ai`（grok2api、硅基流动）：`ModelListEditor` 等价交互
  - `llm-deepseek`（若目录有 deepseek）：`DeepSeekModelsEditor` 等价字段（id/name/contextWindow/maxTokens）
  - 其他 catalog：以密钥为主 + schema 允许的折叠字段

### 4.2 BFF：从「粗 PATCH」升级到「官方写入序」

在 `runtime/server.mjs` 上 **收敛** 为少量语义化 API（内部仍调上述 RPC）：

| BFF（建议） | 作用 |
|-------------|------|
| `GET /api/v1/ai/models-settings` | 一次返回：directory 行 + `settings/describe` 裁剪 + credential 状态 + `writable` + revisions |
| `POST /api/v1/ai/models-settings/mutate` | body：`{ ns, ops, expectedRevision }` → 转发 `settings/mutate` |
| `POST /api/v1/ai/providers/discover` | 保持；文档明确 **不自动写盘** |
| `POST /api/v1/ai/credentials` / `DELETE ...` | 与 `credentials/set|delete` 对齐；或合入「应用」事务 |

**必须修的技术债（与官方冲突）：**

1. **`buildCustomProviderProfile` 强行给每个模型加 `reasoningEfforts`** → 改为 **pathOps 式最小变更**，未编辑字段从 `settings/describe` 或磁盘 **原样保留**。
2. **`readSettingsProviderProfile` 正则解析** → 点头后优先 **以 `settings/describe` 用户子树为准**；文件解析仅作离线兜底。
3. **`77fc380b` 的整段 PATCH custom** → 改为 **ops 数组**（与 `ProviderEditor.pathOps` 同思路）。

现有 `PATCH/DELETE .../providers/.../key` 与 `.../custom/...` 可 **保留为兼容** 或 **内收** 到新 mutate 端点，避免 UI 双轨。

### 4.3 明确不动的回归面

| 能力 | 要求 |
|------|------|
| **+ 添加提供方**（目录 + 密钥） | 仍可用；交互升级为编辑卡，但 **仍写同一 keyRef** |
| **已配密钥** | `credentials/describe` 为唯一真相；保存后 Tag/点状态更新 |
| **会话右侧选模型** | 仍只读 `modelCatalog`；**不**在输入条加管理入口 |
| Agent 预设、现查/改行/过账、业务 SQLite | 不碰 |
| 嵌 DSH / lan-assist / semantic-os Client | 不碰 |

---

## 5. 实施分期（点头后）

| 阶段 | 内容 | 验收门槛 |
|------|------|----------|
| **P0 契约** | 从本机 DSH 包导出 RPC 列表截图/清单进 `internal/`；BFF `GET models-settings` 与官方 store 字段对照表 | Ace 确认字段表与截图一致 |
| **P1 BFF** | `settings/describe` + `mutate`+revision；credentials；discover 不写盘；保留字段 merge | 单测/脚本：改 grok2api 一个 model 行不丢 `reasoningEfforts` |
| **P2 UI 卡** | 列表 + 单卡编辑 + 折叠区 + ModelList（含每行删、恢复默认、discover 选择器） | 对照官方 Client 同一条 grok2api **逐步操作** 一致 |
| **P3 目录行** | qwen 等：仅密钥 + 家族允许的折叠字段；无删除 | 清密钥后行仍在 |
| **P4 回归** | 添加流、会话选模型、重载 | §6 全过 |

**PR 建议（实施时）：**

1. `feat(runtime): models-settings snapshot + mutate ops`
2. `feat(web): CoreSettings provider editor parity with DSH Models`

BFF 变更后 **新 4318 进程**（仓库铁律）。

---

## 6. 你怎么验（点头前不落地；点头后按此验收）

**环境：** 本机 DSH 已连接；`~/.dsh-fde-x` 含 grok2api + 至少一个目录项（如 qwen）；浏览器只连 FDE-X。

### 6.1 与 Ace 截图逐条对齐（grok2api）

1. 点 **编辑** → 展开 **一张卡**（非行内小条）。
2. **API 密钥**：保存后绿/已配置；清除后缺失；界面 **不回显** 明文。
3. 打开 **自定义设置** → 改 **显示名称 / API 地址 / 协议** → 应用 → **重载核心** → `settings.yaml` 对应块已变，且 **未改字段**（如某模型 `reasoningEfforts`）仍在。
4. **模型目录**：删其中 **一行** → 保存 → `session/modelCatalog` 少该模型；会话菜单同步。
5. **获取可用模型** → 弹出 **可搜索列表** → 只 **添加所选** 若干条 → 已有行不被静默覆盖。
6. 若曾整表覆盖 models：**恢复默认** → unset 后回到继承 catalog（或官方文档描述行为）。
7. **删除** grok2api（若 removable）→ 行消失 + 胶囊无其模型 + 相关 `GROK2API_API_KEY` 按规则清除。

### 6.2 目录提供方（qwen）

1. **编辑** 仅密钥（+ 若 deepseek 家族则有模型区）→ **无删除**。
2. 换钥 / 清钥 后列表行仍在。

### 6.3 回归（防改坏）

1. **+ 添加提供方**、**+ 添加自定义提供方** 仍能完成首次配置。
2. AI 页：**选 preset、选模型、发消息** 正常；模型菜单仍来自 catalog。
3. Agent 预设删改；业务 spoken write 四条；现查改行 — **无 diff**。
4. 手改 `settings.yaml` 后 **重载核心**，设置页快照与磁盘一致。

### 6.4 对照官方 Client（可选但推荐）

同一 `FDE_DSH_HOME`，在 DSH 官方 Web Client Models 页做 **步骤 6.1 同一序列**，再在工作台做一遍 → `settings.yaml` / `.credentials.yaml` **diff 为空**（或仅 UI 无关字段）。

---

## 7. 明确不做

- iframe / 新窗口 **官方 Client** 作为长期管理入口。
- 浏览器加载 `@deepseek-ai/dsh-client-ui-settings-models` 或 `dsh-web-frontend`。
- SQLite 存 provider/密钥。
- 在 Data/Records 链路里改 provider。
- 以「再多几个行内按钮」代替 **展开编辑卡 + 模型目录 + 恢复默认 + discover 选择器**。

---

## 8. 与旧文档关系

- [settings-provider-manage.md](settings-provider-manage.md) 第 7 节「不会用 DSH 模型管理」需 **点头后改写**：不是「不用官方能力」，而是 **不用官方前端包**；**能力与 RPC 与官方 Models 页一致**。
- 本文件替代原「阶段 A/B 薄行」叙述；`77fc380b` 仅作 **部分 BFF 预研**，**不能**作为验收终点。
