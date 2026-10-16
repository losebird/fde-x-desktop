# DSH 哪些能力适合放进 FDE-X（建议档）

> **范围：** DSH 官方 Client **设置**里与模型/密钥/推理相关的项 + **会话**里同链能力。  
> **边界：** 会话主体已是 `/dsh-app/` iframe（`session/modelCatalog` / `session/selectModel`）；**不**再嵌官方整页、**不**把 `@deepseek-ai/dsh-client-ui-settings-models` 等官方前端包进浏览器（`PRODUCTION-SPEC`）。  
> **对照：** [fdex-dsh-parity-gaps.md](fdex-dsh-parity-gaps.md)、[settings-provider-manage-plan.md](settings-provider-manage-plan.md)、[fdex-dsh-model-picker.md](fdex-dsh-model-picker.md)。  
> **本文只给取舍建议，不是改造方案。**

---

## 结论（Ace 先读）

| 档 | 一句话 |
|----|--------|
| **该加** | 与官方 **同一账本、同一写盘语义** 还差的几刀；不加就会 **写坏 YAML、硅基类网关发错角色、密钥状态骗人**。 |
| **可加** | 官方 Models 页里 **人会点、工作台仍缺或偏弱** 的交互；不加也能聊，但会在设置里迷路。 |
| **别加** | 官方整页/官方 UI 包、第二套账、会话里再造选择器、和现查/业务无关的 DSH 内页。 |

**会话选模型 / 推理档行：** 继续用 iframe 里 **同一套** DSH Client 即可；差别来自 **`FDE_DSH_HOME` 盘上 `settings.yaml`**，不是再「搬一个 DSH 会话功能」进壳。

---

## 1. 该加（不配错盘、硅基能用）

这些不是「多一个按钮」，而是 **官方 Client 已依赖的 Host 契约**；FDE-X 壳里必须对齐，否则和官方 Client 各写各的盘。

| 能力（官方 Models / RPC 语义） | 为何该加 |
|--------------------------------|----------|
| **全程 `settings/mutate` 路径级写入 + `expectedRevision`** | 避免旧 `POST/PATCH …/providers/custom` **整段替换 profile**，冲掉 `compat`、`headers`、提供方级 `reasoning`、模型上已有字段。 |
| **保存时原样保留未展示字段**（含 `reasoningEfforts`、`compat` 等） | 离线/旧路径解析薄、或 `buildCustomProviderProfile` 注入默认推理表时，会把 **硅基 Qwen** 标成推理模型 → 菜单多推理档、`developer` wire → **20015**（见 [fdex-dsh-model-picker.md](fdex-dsh-model-picker.md)、[siliio-qwen-400.md](siliio-qwen-400.md)）。 |
| **停止「新模型默认灌满 `reasoningEfforts`」的写盘** | 与官方 discover / 手填 id+name 行为一致；否则 FDE-X 家目录 **同路由比 `~/.dsh` 多推理元数据**，会话 iframe 表现必然分叉。 |
| **清除 API 密钥**（`credentials/delete` / 等价 BFF） | BFF 已有、**UI 无** → 用户以为已换钥，盘上仍是旧 ref。 |
| **Discover → 仅「添加所选」** | 禁止 discover 后 **默认全选** 静默进配置；否则模型表被一次盖掉，和官方契约相反。 |
| **删提供方 = 官方 `removable`**（仅用户层持有的 profile） | legacy 回退把 `custom` 当可删会 **误删语义**；保存还可能 **物化整表 models override**。 |
| **删模型行规则与官方一致** | 官方：**仅用户层持有的行**可删；任意 catalog 行可删会把继承 catalog **写成 override**，难恢复。 |
| **所有写密钥入口统一 ASCII 校验** | 与官方一致，避免旧 `POST providers` 绕过校验写脏凭据。 |
| **设置页可读的家目录提示**（当前 `FDE_DSH_HOME`） | 不是 DSH 页面功能，但是 **不配就会以为「官方 Client 配了 = 工作台生效」**；两套 home 是今日最大「假 parity」（[fdex-dsh-model-picker.md](fdex-dsh-model-picker.md) §结论）。 |

**会话侧「该加」只有一条原则：** **不要**在工作台再做模型/推理选择器；把盘上配置和 BFF 写盘收齐，iframe 里的菜单会自己跟 Host 一致。

---

## 2. 可加（官方有、人会来设置里找）

分支 `cursor/models-settings-parity-d9dd` 已落地的（单卡编辑、mutate、discover 添加所选等）**不重复列**；下面仍是 **相对官方 README** 常见会找的功能。

| 能力 | 说明 |
|------|------|
| **409 / revision 冲突的明确提示** | Host 已能 `settings_conflict`；通用报错不够 ADHD 友好。 |
| **手改 YAML 后的自动刷新** | 官方订 `settings/document-updated`；工作台至少 **保存成功 / 重载核心 / 再进页** 已部分覆盖；**轻量订阅或轮询** 属体验加分。 |
| **目录提供方（qwen 等）进同一张编辑卡** | 仅行内换钥不够；人要改 **DeepSeek 家族** 的 id/显示名/context 时会找 Models 页那套。 |
| **密钥状态 = 已配置/缺失**（与 `credentials/describe` 同逻辑） | 样式可保留 FDE-X Tag，语义对齐官方绿/红。 |
| **恢复默认（unset 用户层 `models`）** | 人 override 整表后找不到「回到内置 catalog」会慌（实现若已齐则仅验收）。 |
| **添加自定义时 discover 预选 = 仅新 id** | 与编辑卡一致，避免再一次全选心理负担。 |
| **重载核心 + 保存成功文案** | 官方习惯「应用 → 生效」；已有按钮则强化 **何时必须重载** 即可。 |
| **底部模型胶囊只读总览** | 官方有总览；与会话菜单分工清晰，设置里常用来核对 catalog。 |

**故意不进「可加」：** 在 Models 设置里做 **`reasoningEfforts` / `compat.supportsDeveloperRole` 表单** — **官方也没有**；要收推理/developer 问题应靠 **正确写盘 + YAML/mutate 删字段**，不是 FDE-X 独造第三套表单（[fdex-dsh-parity-gaps.md](fdex-dsh-parity-gaps.md) §5）。

---

## 3. 别加（规格或成本不对）

| 项 | 原因 |
|----|------|
| iframe / 新窗口 **DSH 官方 Web Client**（含 Models 整页） | `PRODUCTION-SPEC` + `CoreSettings`「不嵌 DSH 整页」。 |
| 浏览器 `import` **`dsh-web-frontend` / `@deepseek-ai/dsh-client-ui-settings-models`** | 官方前端包不得进浏览器；依赖 Cordis inject。 |
| **SQLite / 第二套** provider、密钥、模型状态 | 与 Host `settings.yaml` + `.credentials.yaml` 双轨，必分叉。 |
| **会话区自研模型/推理选择器** | 已有 `/dsh-app/`；再造 UI 只增加第三套行为。 |
| **让用户「去官方 Client 改、工作台只读」**当长期方案 | 两套入口 + 两套 home，ADHD 成本最高。 |
| **IM、lan-assist、semantic-os、DSH 内部运维/调试页** | 不在「模型链 + 密钥」范围；规格亦禁止乱挂 Client UI。 |
| **以「再多几个行内按钮」代替** 展开卡 + 模型目录 + discover 选择器 + 恢复默认 | 达不到官方 Models 契约，仍会写坏盘（见 [settings-provider-manage-plan.md](settings-provider-manage-plan.md) §2 错路）。 |
| **业务 Data/Records、Agent 预设、现查 spoken write** 里塞 provider 管理 | 账本应只在 **设置 → 核心**；避免四处改同一 YAML。 |

---

## 4. 一张表：会话 vs 设置分工

| 人在干什么 | 放哪 | FDE-X 策略 |
|------------|------|------------|
| 选模型、选推理档（若有） | DSH Client（iframe） | **保持**；不搬、不重写。 |
| 配提供方、密钥、模型表、discover | FDE-X `CoreSettings` Models 分区 | **复刻官方语义 + 同一 RPC**，换壳不换账。 |
| 硅基 400 / 两 home 表现不一致 | 盘上 `settings.yaml` + BFF 写路径 | **该加** 写盘与字段保留；不是会话里加开关。 |

---

## 5. 与缺口文档的对应

- 仍差的 8 条技术缝 → [fdex-dsh-parity-gaps.md](fdex-dsh-parity-gaps.md)「结论」；本文件 **§1 ≈ 该加、§2 ≈ 可加、§3 ≈ 别加**，不展开实施分期。  
- 官方逐项契约原文 → [settings-provider-manage-plan.md](settings-provider-manage-plan.md) §1、§3。  
- 推理档从哪来、为何官方硅基无档 → [fdex-dsh-model-picker.md](fdex-dsh-model-picker.md)。
