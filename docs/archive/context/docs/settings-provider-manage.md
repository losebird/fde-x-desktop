# 设置「模型与提供方」· 管理缺口

## 结论（给 Ace）

**缺的不是「能不能加」，而是「加完之后怎么管」。**

| 你现在能做的 | 现在做不到的 |
|-------------|-------------|
| 列出现有提供方 + 「API 密钥已配置 / 缺失」标签 | 在某一行上 **改密钥**（没有「编辑」入口） |
| **添加提供方**（官方目录里选一个 + 填密钥） | **删** 不用的提供方（尤其 grok2api、硅基流动这类自定义） |
| **添加自定义提供方**（网关 + 拉模型 + 勾选写入） | **改** 已写入的自定义网关（地址、协议、模型列表） |
| 只读展示当前核心里的 **模型名胶囊** | 从列表里 **摘掉** 某个模型 |
| **重载核心** | 和 Agent 预设那种 **行内删除/编辑** 对称能力 |

**账在哪（只有这一套，不要另起）：**

- 密钥：`~/.dsh-fde-x/.credentials.yaml` 的 `refs:`（环境变量名如 `QWEN_API_KEY`）
- 自定义网关定义：`~/.dsh-fde-x/settings.yaml` → `llm-pi-ai.providers.<id>`
- 运行时权威：DSH 核心 RPC（`llm/listProviders`、`credentials/*`、`settings/mutate`）
- **不在** SQLite、**不是** DSH 整页嵌进来、**不是** 业务现查/改行/过账

**改/删该打哪：** 一律经本机 BFF `runtime/server.mjs` 扩 API，读写上述 DSH 文件 + 已连上时的 RPC；UI 只在 `CoreSettings.tsx` 加行内动作，**不新页面**。

---

## 1. 设置里现在各有什么入口？

入口：**设置 → 核心**（`CoreSettings.tsx`「模型与提供方」卡片）。

| 能力 | 有没有 UI | 实际怎么走 |
|------|-----------|------------|
| **添加官方提供方** | 有 ·「+ 添加提供方」 | 下拉里选 `listConfigurableProviders` 里的 id，填密钥 → `POST /api/v1/ai/providers` |
| **改官方提供方密钥** | **无行内入口** | 只能再开「+ 添加提供方」，选**同一个** id 填新密钥再保存（和「添加」同表单，容易误以为只能新增） |
| **删官方提供方** | **无** | 无 API、无 UI；目录项来自 DSH 内置清单，最多 **清密钥**，不能从清单抹掉 id |
| **添加自定义提供方** | 有 ·「+ 添加自定义提供方」 | 填 route / baseURL / 协议 / 密钥，可 discover 模型 → `POST /api/v1/ai/providers/custom` |
| **改自定义提供方** | **无** | 后端 `upsertSettingsProvider` 若 `settings.yaml` 里 **已有该 route 会直接 return**，不会更新（二次创建等于 noop） |
| **删自定义提供方** | **无** | 只能手改 `settings.yaml` / 删 credential 行 |
| **改模型列表** | **无** | 创建时勾选；下方模型胶囊来自 `GET /api/v1/ai/models`（`session/modelCatalog`），**只读** |
| **重载核心** | 有 | `POST /api/v1/ai/reload`，改配置后的常规动作 |

对比同页 **Agent 预设**：用户来源有 **垃圾桶删除**；提供方列表 **没有任何行内按钮**（截图里只有名称 + 标签）。

---

## 2. 数据从哪来、写去哪？

```text
CoreSettings.tsx
    │ listAiProviders / addAiProvider / addCustomAiProvider / aiModels / reloadAi
    ▼
runtime/server.mjs  /api/v1/ai/providers[...]
    │
    ├─ GET providers
    │     ├─ RPC llm/listConfigurableProviders  → 官方可配置目录（未配密钥也会出现）
    │     ├─ RPC llm/listProviders              → 已在 settings 里注册的提供方
    │     └─ RPC credentials/describe           → 各 keyRef 是否已配置
    │
    ├─ POST providers（官方）
    │     ├─ RPC credentials/set
    │     └─ upsertCredentialRef → ~/.dsh-fde-x/.credentials.yaml
    │     （不写 settings.yaml 里的 provider 块；靠内置目录 + 密钥启用）
    │
    └─ POST providers/custom
          ├─ 若核心已连：settings/mutate set llm-pi-ai.providers.<route>
          ├─ credentials/set + upsertCredentialRef
          └─ upsertSettingsProvider → settings.yaml（已存在 route 则 **跳过写入**）
```

| 存储 | 路径（默认） | 内容 |
|------|----------------|------|
| DSH Home | `FDE_DSH_HOME` → `~/.dsh-fde-x` | 整棵核心的家目录 |
| 密钥文件 | `<dshHome>/.credentials.yaml` | `refs:` 下 `XXX_API_KEY: <secret>` |
| 提供方 profile | `<dshHome>/settings.yaml` | `llm-pi-ai.providers.<route>`：`api`、`baseURL`、`models[]`… |
| 运行中 | DSH 进程 | 与文件同步靠 reload / 连上时的 mutate |

另有 **`GET/POST /api/v1/ai/credentials`**（按名字读写 refs），client 已封装 `listAiCredentials` / `saveAiCredential`，但 **设置 UI 未使用**；同样 **没有 DELETE**。

---

## 3. 和 Ace 截图的对应

一列 **qwen / together / vercel / xiaomi / zai / grok2api / 硅基流动**：

- 前几个多半是 **内置目录 + 密钥状态**（缺密钥 → 琥珀「API 密钥缺失」）。
- **grok2api、硅基流动** 多半是 **`settings.yaml` 自定义块 + 同名 credential**；出现在列表是因为已 `listProviders` 注册。
- 每一行 **只有 Tag，没有 ⋮ / 编辑 / 删除** —— 与代码一致，不是 Ace 漏点。

---

## 4. 第一性原理：怎么补管理（方向，未落地）

原则：

1. **不另起一套账** —— 仍改 `settings.yaml` + `.credentials.yaml` + DSH RPC。
2. **不碰现查、改行、过账、业务 SQLite**。
3. **UI 形态对齐 Agent 预设** —— 行内「改密钥 / 编辑 / 删除」，仍在本卡片内展开，不嵌 DSH 设置页。

| 人的意图 | 应动的权威 | 产品动作（概念） |
|----------|------------|------------------|
| 换官方密钥 | `credentials/set` + `.credentials.yaml` | 行内「更换密钥」→ 复用 POST providers 或专用 PATCH |
| 去掉官方密钥 | 同上 unset / 删 ref 行 | 「清除密钥」→ 标签回「缺失」，不是删目录项 |
| 改自定义网关 | `settings/mutate` + **修正** `upsertSettingsProvider` 支持覆盖 | 行内「编辑」→ 同创建表单，带出现有值 |
| 删自定义提供方 | `settings/mutate` delete path + 可选清 credential | 行内删除 + confirm；reload 提示 |
| 增删模型 | mutate `providers.<id>.models` | 编辑态里勾选列表，或「管理模型」子面板 |
| 官方目录项 | 不可删 id | 仅密钥与是否启用（若 DSH 支持 disable） |

BFF  today **只有 POST 创建/写密钥**，缺 **PATCH / DELETE** 与 **settings 块更新**；这是和 UI 缺口 **同源的 backend 缺口**。

详细分期与验收见 [settings-provider-manage-plan.md](settings-provider-manage-plan.md)（点头前方案，不实施）。

---

## 5. 代码锚点（查缺口用）

| 位置 | 作用 |
|------|------|
| `src/components/settings/CoreSettings.tsx` L141–148 | 提供方列表只渲染 Tag，无操作 |
| `src/lib/runtime-api.ts` L732–781 | client 仅有 list / add / discover / addCustom |
| `runtime/server.mjs` L1192–1363 | providers 路由；无 DELETE/PATCH |
| `runtime/server.mjs` L228–264 | `upsertSettingsProvider` 已存在 route 则 **不更新** |
| `runtime/server.mjs` L1370–1398 | credentials GET/POST，无 DELETE |

---

## 6. 你现在若要手改（应急，非产品路径）

1. 密钥：编辑 `~/.dsh-fde-x/.credentials.yaml` 对应 `*_API_KEY` 行。
2. 自定义网关：编辑 `~/.dsh-fde-x/settings.yaml` 里 `llm-pi-ai.providers.<id>` 整段；删提供方则删该段并视情况删 credential。
3. **设置 → 重载核心**，让 DSH 吃到文件变更。

长期应做成设置里行内操作，避免手改 YAML。

---

## 7. Ace 问：会用 DSH 自己的模型管理吗？

**一句结论：** **不会**打开或嵌入 DSH 官方 Client 里那套「模型管理」整页；也 **没有**必须接的、单独的 DSH「提供方 CRUD / 模型管理」RPC——工作台继续用 DSH 已有的 **读清单 + 写密钥 + 写 settings 命名空间** 几条 RPC/文件，**改删界面和 BFF 路由由 FDE-X 自己补**。

| 问题 | 答案 |
|------|------|
| 是 DSH 现成的模型管理功能吗？ | **不是整页/整模块。** 规格与 `CoreSettings` 已写明不要嵌 DSH 整页；浏览器里也不进官方 DSH Client 设置 UI。 |
| DSH 侧实际用到什么？ | **读：** `llm/listConfigurableProviders`、`llm/listProviders`、`session/modelCatalog`（模型胶囊）、`credentials/describe`。**写：** `credentials/set`、`settings/mutate`（`ns: llm-pi-ai`，路径 `providers.<id>`）、`llm/discoverModels`；未连核心时 BFF 还会 **直接改** `~/.dsh-fde-x/settings.yaml` / `.credentials.yaml`（与今天「添加自定义提供方」一致）。 |
| 有没有「必须用」的独立管理 RPC？ | **在本仓库对接面里没出现。** `runtime/server.mjs` 只挂了上述 endpoint；plan 里的改删也是 **扩 BFF** 去调同样的 `credentials/*`、`settings/mutate`（加 delete/unset）和 YAML helper，**不是**改去嵌 DSH 另一套管理 API。 |
| 和 DSH 官方 Client 的关系 | 官方 Client 若有自己的模型/提供方设置，那是 **同一份** `settings.yaml` + credentials **不同壳**；FDE-X 走自己的设置卡片，账不另起。 |

**plan 对齐：** [settings-provider-manage-plan.md](settings-provider-manage-plan.md) 阶段 A/B 仍是 **工作台 BFF + CoreSettings 行内按钮**，底层仍是 DSH 配置与 RPC，**不是**切换到 DSH 内置「模型管理」产品入口。
