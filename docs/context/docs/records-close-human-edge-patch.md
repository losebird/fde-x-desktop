# 客户↔工单边：人能查、能补、怎么补

**场景：** 口语里同时出现「客户」和「工单」，但 `GET /api/v1/biz/kinds` 的 `data.relations` 里**没有** `{ from: "客户", to: "工单", field: … }` 时，跨对象 hop 起不来（左栏可能只剩「客户 · 现查 · 0」）。  
**工作区示例：** `/Users/zxz/Documents/ai-project/fdex测试`  
**机制说明（只读）：** [internal/records-close-missing-customer-ticket-edge.md](../internal/records-close-missing-customer-ticket-edge.md)

---

## 能查吗？——能

人**不需要**改代码就能判断「边缺了」还是「边有了」。产品里**没有**单独一页叫「relations 列表」；用下面几条对照即可。

| 你要看什么 | 打开哪里 / 用什么 | 缺边时长什么样 | 好边对照（同工作区已存在） |
|------------|-------------------|----------------|---------------------------|
| **发布后的可执行关系（BFF 真值）** | 浏览器或终端：`GET /api/v1/biz/kinds?cwd=<工作区绝对路径>`（运行时端口以本机为准，常见 `4318`） | `data.relations` 里**搜不到**同时含 `客户` 与 `工单` 的一对；`fdex测试` 上曾测到 **0** 条此类 pair，且 **客户** 只连到销售合同/商机/回款，**工单** 只连到工单处理记录 | 同列表里已有 `{ "from": "客户", "to": "销售合同", "field": "customer" }` 等行 |
| **词表概念上的可执行关系** | 侧栏 **记忆** → 首页点 **05 知识分类** → 左侧树选中 **表 = `biz_tickets`** 的概念（名称 **工单**）→ 右侧滚到 **可执行关系** | 区块为空，或没有一行 **父型=客户、子型=工单** | 选中 **表 = `biz_contracts`（销售合同）** 的概念：应能看到 **父型 客户 / 子型 销售合同 / 外键列 customer** |
| **磁盘上的图** | **设置 → 语义记忆** 页会提示备份路径：`{工作区}/.dsh/semantic-os/graph.json`；用编辑器打开，找 `id` 含 `#ticket`、`resource": "biz_tickets"` 的 `skos:Concept` | `properties` 里**没有** `relations` 数组（或 `relations` 为 null） | `#biz-contracts` 等节点内嵌 `relations: [{ "from": "客户", "to": "销售合同", "field": "customer" }, …]` |
| **管理里的「词表」抽屉** | **记忆 → 06 管理** → 顶栏 **词表** | 只读 JSON（`GET /semantic-os/api/ontology/registry`），**不能在这里改关系** | 可核对登记信息，不能当编辑器 |
| **探索里的连线** | **记忆 → 01 探索** → **找可能的连线** | 可能出现「建议连一条图边」；**这不等于** 可执行关系，**不会**自动进 `data.relations` | — |
| **业务记录面板** | **数据 → 记录** 等用 `listBizKinds` 的地方 | 只用 kinds 做型名/别名，**不展示** `data.relations` | — |
| **AI 读的「目录/手册」** | 会话里 AI 可调 **读本工作区业务目录**（`biz_catalog` 类工具）：文案含 **可执行关系** 段 | 目录里列不出 `客户→工单(customer)` | 能列出 `客户→销售合同(customer)` 等 |

**`/api/v1/biz/kinds` 的 relations 会不会在 UI 里直接显示？**  
**不会。** 接口返回 `data.relations`，但记录等前端只消费 `kinds`；**必须**用 API、图谱 **知识分类**、或 `graph.json` 来查。

**快速命令（确认 BFF）：**

```bash
curl -sS 'http://127.0.0.1:4318/api/v1/biz/kinds?cwd=/Users/zxz/Documents/ai-project/fdex测试' \
  | python3 -c "import json,sys; r=json.load(sys.stdin)['data']['relations']; print([x for x in r if set(x.get(k,'') for k in ('from','to'))=={'客户','工单'}])"
```

空列表 `[]` = 仍缺边。再数邻居：

```bash
curl -sS 'http://127.0.0.1:4318/api/v1/biz/kinds?cwd=/Users/zxz/Documents/ai-project/fdex测试' \
  | python3 -c "
import json,sys
rels=json.load(sys.stdin)['data']['relations']
for k in ('客户','工单'):
  n=sorted({(a,b) if a==k else (b,a) for a,b in [(x['from'],x['to']) for x in rels if k in (x['from'],x['to'])]})
  print(k, n)
"
```

---

## 能补吗？——能（四条真路径，一条假路径）

目标：让发布结果里出现（方向与好边一致，**挂在子表概念上**）：

```json
{ "from": "客户", "to": "工单", "field": "customer" }
```

`field` 必须是 **工单表 `biz_tickets` 上指向客户的外键列名**。现网行数据里常见 `customer` / `customerId`；**以 Noco 集合字段 `name` 为准**（生成器写的是列名，不是 `customerId` 除非 schema 就叫这个）。

| 优先级 | 路径 | 是否存在 |
|--------|------|----------|
| 1 | **设置 → 存储与数据 → 业务连接器 → 保存连接**（默认会重新从 Noco 生成词表） | ✅ |
| 2 | 在 **NocoBase** 修好 `biz_tickets` 对客户的多对一/ belongsTo，再执行路径 1 | ✅（在业务系统 UI，非本仓库） |
| 3 | **记忆 → 知识分类** 里给 **工单** 概念手写 **可执行关系** 并 **保存** | ✅ |
| 4 | 手改 **`graph.json`** 里 `#ticket` 概念的 `properties.relations` | ✅（高风险，见下） |
| — | **探索 → 找可能的连线** | ❌ 不能补可执行关系 |
| — | **管理 → 词表** 抽屉 | ❌ 只读 |
| — | 在 **`src/runtime` / overlay 里硬编码客户-工单 map** | ❌ 禁止（见文末） |

**设置里没有**「单独生成词表」按钮；`POST /api/v1/biz/vocab/generate` 存在，但产品 UI **未接**。若要只跑生成、不走整页保存，可用 curl（需有效 token / 账号密码，与工作区 cwd 一致）——仍属「连接器生成」能力，不是新按钮。

---

## 怎么补？——按推荐顺序操作

### 路径 1：保存连接，从 Noco 重新生成词表（首选）

**前提：**

- 本机运行时、语义服务已就绪（记忆画布能打开）。
- **设置 → 存储与数据** 里连接器 **地址 + API Key**（或账号密码能换 token）有效；工单表上指向客户的字段只要 **`target` 能解析到客户集合** 就会发边（适配器用真实列名；不靠写死 `m2o` / 表名名单）。生成入口见 checkout `runtime/biz/adapters/nocobase-vocab.mjs`。
- 当前工作台工作区 cwd 就是你要修的那个（如 `fdex测试`）。

**步骤：**

1. 打开 **设置**（侧栏齿轮）。
2. 左侧选 **存储与数据**。
3. 在 **业务连接器** 核对 **地址**（如 `127.0.0.1:13000`）、填 **API Key** 或 **账号/密码**。
4. 点 **保存连接**。  
   - 后端 `POST /api/v1/biz/lookup` 在 `generateVocab` / `syncVocab` 不为 `false` 时（**默认会生成**）调用 `generateWorkspaceVocabFromConnector`，写入语义图。
5. 看提示是否成功；若响应带 `vocabGenerate`，留意 `relationCount` 是否增加、有无 `ok: false`。

**确认：**

- 再跑上文 **curl**；应能在 `data.relations` 里看到 `客户`↔`工单`。
- **知识分类** 打开 **工单** 概念，**可执行关系** 应出现一行（可能与生成器一并写入 **fields/can**）。
- 口语复测：「停用客户还有哪些没关的工单？」—— hop 相关逻辑需要 `related` 里同时有 **客户** 与 **工单**（见 [internal/records-close-customer-zero-cause.md](../internal/records-close-customer-zero-cause.md)）；边补上后不应再卡在仅 **客户 · 现查 · 0**（仍取决于数据与闸，但 **缺边** 这一层应消失）。

**若保存后仍无边：** 不要重复点保存碰运气，转 **路径 2**（多半是字段没有指向另一张已接入集合的 `target`，或目标集合不在当前连接器目录里）。

---

### 路径 2：在 NocoBase 修关联字段，再走路径 1

**前提：** 能在 Noco 管理端打开 **`biz_tickets`** 集合字段列表。

**步骤（Noco 侧，名称因皮肤而异）：**

1. 打开 **数据表 / Collections → 工单（`biz_tickets`）→ 字段**。
2. 找到指向 **客户（`biz_customers`）** 的字段（现网数据常出现在行里的 `customer` / `customerId`）。
3. 确认字段类型为 **多对一 / belongsTo / m2o**，**目标集合** 为客户表；若只是普通文本/数字，改成关联并迁移数据（按你们 Noco 规范操作）。
4. 回到工作台 **设置 → 存储与数据 → 保存连接**（路径 1）。

**确认：** 同路径 1 的 curl + **知识分类** 对照。

---

### 路径 3：记忆 · 知识分类里手写可执行关系

**前提：**

- **记忆** 面板能加载 **知识分类** 画布（`/semantic-os/ws/ontology/…`）。
- 你知道外键列名（从 Noco 字段 `name` 或样例行推断，优先 **`customer`**）。

**步骤：**

1. 侧栏 **记忆**。
2. 首页选择 **05 知识分类**（模式治理）。
3. 左侧概念树中找到 **工单**（选中后右侧 **表** 应为 `biz_tickets`；若看不到，用 **表** 字段核对，勿改 **id**）。
4. 滚到 **可执行关系**：
   - 点 **加一条关系**（若无行）。
   - **父型** 填 `客户`  
   - **子型** 填 `工单`  
   - **外键列** 填 `customer`（或实测列名）
5. 点 **保存**（成功提示 **已保存。**）。  
   - 写入走 `POST /semantic-os/api/vocabulary/concepts`（与连接器批量写入同一路）。

**对照好边：** 打开 **销售合同** 概念，应看到同样的三列布局，只是子型为 **销售合同**、`customer` 外键。

**确认：** curl `kinds` + 可选让 AI 读目录，看 **可执行关系** 是否出现 `客户→工单(customer)`。

**注意：** 之后若再 **保存连接** 全量生成，**可能覆盖** 该概念上由生成器写回的 `fields` / `relations`；长期仍建议修 Noco + 路径 1。

---

### 路径 4：手改 `graph.json`（最后手段）

**前提：**

- 知道完整路径：`/Users/zxz/Documents/ai-project/fdex测试/.dsh/semantic-os/graph.json`（**设置 → 语义记忆** 亦提示此相对路径）。
- 愿意承担 JSON 语法错误、与语义服务并发写入冲突的风险；**先备份文件**。

**步骤：**

1. 停用手动编辑期间的语义写入（尽量不要在产品里同时 **保存** 词表或 **保存连接**）。
2. 在 `nodes` 中找到 `"id": "…#ticket"` 且 `"resource": "biz_tickets"` 的 `skos:Concept`。
3. 在 `properties` 增加或合并 `relations` 数组，例如：

   ```json
   "relations": [
     { "from": "客户", "to": "工单", "field": "customer" }
   ]
   ```

   形状须与 **销售合同** 概念上已有条目一致；`to` 用型名 **工单**（与 `content` / BFF `kind` 一致）。

4. 保存文件；必要时重启语义服务或重新打开 **知识分类** 触发重载（以你环境为准）。

**确认：** 同路径 1 curl。

---

## 补完之后怎么验 hop（可选）

1. **API：** `data.relations` 含目标三元组。  
2. **口语：** 再问「停用客户还有哪些没关的工单？」—— 不应再仅因 **缺边** 而 `related` 只有 `[客户]`（详见 internal 因果链）。  
3. **不要** 用「探索预测边」当验收标准。

---

## 人不要做什么

| 禁止 | 原因 |
|------|------|
| 在 `runtime/vendor-overlays/dsh-lan-assist/slots.js` 等 **overlay** 里写死 `{ 客户, 工单, customer }` | 决策 15：关系只认词表+图发布结果；换工作区/换连接器应仍走生成或图谱编辑 |
| 在 **`src/runtime`** 加 **客户-工单** 硬编码 map | 同上；Ace 明确要求不做 |
| 指望 **探索 → 找可能的连线** 修 hop | 那是图探索建议，**不写入** `skos:Concept.properties.relations` |
| 在 **管理 → 词表** 抽屉里找保存按钮 | **只读** registry JSON |
| 没确认列名就乱填 **外键列** | 闸按 `field` 名走表；填错会生成「有边但查不动」 |

---

## 相关只读材料

- 缺边测量与发布链：[records-close-missing-customer-ticket-edge.md](../internal/records-close-missing-customer-ticket-edge.md)  
- 缺边导致 case 1 现查 0：[records-close-customer-zero-cause.md](../internal/records-close-customer-zero-cause.md)  
- 连接器生成入口说明：[wave-fix-vocab-relations-gen.md](../internal/wave-fix-vocab-relations-gen.md)
