---
cursor:
  subagentId: "bc-edc90c96-37e8-5c27-8ace-e045359e874e"
---

# 现网口语写库：PostgreSQL 类型错误（增删改审）

只读审计。对照 [handler-bigint-fix.md](./handler-bigint-fix.md)。数据源：`~/.dsh-fde-x/lan-assist/state.json`（时间线 + `events[]` + `pendingSheet`）、`~/.dsh-fde-x/sessions/**/session.v3.jsonl.zstd`（全量扫 `invalid input` / `bigint`）、`state.letters.bak.json`（交叉确认）。未 reload、未连 5174/4318、未过账、未写业务库。

## 结论摘要

| 类别 | 现网条数 |
|------|----------|
| PostgreSQL `invalid input syntax for type bigint`（口语串打进 FK） | **3 条有 PG 原文** + **1 条同类 WRITE_FAILED（无 compensate 原文）** |
| `invalid input` / `integer` / `uuid` / `enum` 的 PG 类型错误 | **0**（`state.json` 与全部 session zstd 均未命中） |
| `WRITE_FAILED` 但非 PG 类型（回执/冲正/字段未变等） | 多条，**不属本报告「同类」** |

同类根因与 handler 文档一致：**预览 `packSheet` / 令牌 `patch` 保留口语；过账 `postWrite` → NocoBase 把 m2o/belongsTo 列当 bigint 写入**；`bindPatchEnums` 只处理枚举 label→code，**不解析关系**。旧路径上 `assignee` 等未走 `relationSchemaField` + `shapePatch` 时，口语原样进 body。

---

## 事件明细（同类：口语 → bigint FK）

### E1 — 工单新建 · 处理人 `ace`（fdex 测试）

| 项 | 值 |
|----|-----|
| **Session** | `session-0b9d3ea9-00d4-42cc-9fe6-29d8a6651e90` |
| **工作区** | `/Users/zxz/Documents/ai-project/fdex测试` |
| **时刻（state `at`）** | 预览 `1790241007483` → 失败 `1790241091178` / `events[].at` `1790241091210` |
| **动作** | **新建**（预览令牌后过账） |
| **口语 / 预览** | 用户话：`新增一笔工单，标题是测试新增功能，优先级是高，负责人是ace`（session title-llm 同文）。`biz_preview` 成功，令牌 `pv_91f89f9474bcd4fc`；`patch` / `fields.assignee` = **`ace`**（优先级已收成 `high`） |
| **打到的列 / 类型** | 工单 `biz_tickets` · **`assignee`**（m2o → `users`，库侧 bigint FK）。PG：`invalid input syntax for type bigint: "ace"` |
| **关系解析** | **预览未解析**（session `biz_preview` 返回里 `assignee` 仍为字符串）。过账应走 `shapePatch`；未收成 `assigneeId` 时口语直写 FK。**不是** where 过滤路径。 |
| **证据** | `state.json` 时间线；`events[73]` `biz_734b1296`；session zstd `tool/result` seq 49（`pv_91f89f9474bcd4fc`） |

### E2 — 工单新建 · 处理人 `zxz`（fdex 测试，推断同类）

| 项 | 值 |
|----|-----|
| **Session** | 同会话链路；`pendingSheet.speech` 仍为 ace 场景，**当前挂单行**为换人后预览 |
| **工作区** | `/Users/zxz/Documents/ai-project/fdex测试` |
| **时刻** | 预览 `1790241129168` → `WRITE_FAILED` `1790241131295` |
| **动作** | **新建** |
| **口语值** | `pendingSheet`：`fields.assignee` / `changes[].to` = **`zxz`**；`preview_id` **`pv_b2e1a3f239632083`**；`patch` 仅 `{ "assignee": "zxz" }` |
| **列 / 类型** | 同 E1 **`assignee` → bigint**（未在 `events[]` 再落一条 PG 原文，但与 E1 相邻、同槽同模式） |
| **关系解析** | **仍漏**：现网 `pendingSheet` 展示口语名，无 `assigneeId` |

### E3 — 工单新建/改行 · 客户公司名（nocobase-test）

| 项 | 值 |
|----|-----|
| **Session** | `session-7b6915d5-c4f2-4d06-b2bb-02baaca4eec5` |
| **工作区** | `/Users/zxz/Documents/ai-project/nocobase-test` |
| **时刻** | 预览 `1788332989513`（`pv_1b60687af9458789`）→ 失败 `1788332989579` |
| **动作** | **新建**「工单 新单」（电脑故障/胡文联调话术；过账瞬间失败） |
| **口语值** | PG 引号内：**`南京智航交通科技有限公司`**（客户名称/公司名，非纯数字 id） |
| **列 / 类型** | 工单 **`customer`**（m2o → `biz_customers`，bigint FK）。错误形态与 assignee 相同 |
| **关系解析** | **应 list 客户表按 name/code 解析为 id，未发生**；口语进 FK。同工作区稍后一条回执话术含「将客户改为 南京智航…」为**另一笔成功过账的叙述**，不能反证 FK 曾接受字符串；E3 的 PG 原文仍钉死该值曾触发 bigint。 |
| **证据** | `events` `biz_3bc47bed`；时间线 `25757`–`25761` |

### E4 — 工单 · 客户编号 `CUST-016`（nocobase-test）

| 项 | 值 |
|----|-----|
| **Session** | `session-7b6915d5-c4f2-4d06-b2bb-02baaca4eec5` |
| **工作区** | `/Users/zxz/Documents/ai-project/nocobase-test` |
| **时刻** | 预览 `1788333047529`（`pv_d20a65f561732d2b`）→ 失败 `1788333047650` |
| **动作** | **新建/过账**（同「工单 新单」联调） |
| **口语值** | **`CUST-016`**（业务单号/客户编号口语） |
| **列 / 类型** | **`customer` / `customerId` 类 FK → bigint**（PG 原文：`"CUST-016"`） |
| **关系解析** | 编号形态应 `biz_customers:list` + `code` 过滤；**未收成 id**。历史上跨表联调回执曾写 `将customer改为 CUST-016`（成功路径），与本次失败并存 → **解析/写口版本或 patch 键不一致时仍会漏**。 |
| **证据** | `events` `biz_1251863b`；时间线 `25821`–`25825` |

---

## 邻近但「非 PG 类型错误」的 WRITE_FAILED（排除）

- **`1788329990436`** 等：`WRITE_FAILED · 表还在` +「刚才那笔业务侧失败了」/「没写成」——**无** `invalid input syntax`，多为冲正/回执链，非本类。
- **`WRITE_FAILED`** +「业务回了，但字段还是旧的」：补偿/回执校验，**非** FK 类型。
- **`销售回款 … 将method改为 hop-ba-preview`**：口语测试值进枚举/字段，**无** PG bigint 原文；属枚举/业务校验类，未列入上表。

---

## 枚举与其它类型

- **优先级「高」→ `high`**：E1 预览已成功 `bindPatchEnums`，**不是**失败原因。
- **类别 `incident`、状态 `resolved` 等**：联调成功回执中大量出现，**无** enum PG 报错记录。
- **联系人 `c256@client.com` / `胡文`**：成功回执中有「将联系人改为 …」；**现网未出现** contact 的 bigint 报错。可能走 email/name 解析、或该字段非 bigint；**不能**据此认定 contact 已全覆盖。

---

## Session 日志侧

- `session-0b9d3ea9` zstd：**有** `biz_preview` 与 `assignee":"ace"`，**无** agent 侧 `biz_write` / PG 原文（过账走 UI/写口，与 handler 文档一致）。
- 全库 `sessions/**` zstd：**无任何** `invalid input syntax` / `bigint` 行——类型错误只落在 **lan-assist state + Noco 写口返回 → compensate**。

---

## 与 handler 修复的对应关系（仅对照，未改产品）

| 槽位 | 口语示例 | 目标集合 | 应收成 | 现网失败 |
|------|----------|----------|--------|----------|
| `assignee` | `ace` / `zxz` / `acee` | `users` | `assigneeId` | E1、E2 |
| `customer` | 公司全称 | `biz_customers` | `customerId` | E3 |
| `customer` | `CUST-016` | `biz_customers` | `customerId`（按 code） | E4 |

**关系解析是否「已有但仍漏」**：代码路径上 `shapePatch` + `resolveRelatedId` **仅在过账且带 `schemaFields`/连接时**生效；预览令牌长期存口语 → 一旦过账前未 bind 或与 overlay 版本不一致，即复现。E3/E4 说明 **`customer` 与 `assignee` 同属 m2o→bigint 漏解析族**，不限于处理人。

---

## 建议后续（协调方，非本 worker 执行）

1. 用已部署 overlay 对 E1/E2 再跑预览+过账（用户明确授权后）验证 `assigneeId`。
2. 对客户槽补同样 **schema-driven `shapePatch`** 验收（E3/E4 话术）。
3. 保持「预览 displayPatch 口语、token.patch 存 id」与过账一致，避免 `pendingSheet` 仍显示 `zxz` 而库已要求 id。
