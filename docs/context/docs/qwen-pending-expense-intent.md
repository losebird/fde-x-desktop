# Qwen 验收句 2：「待审的费用报销」意图核对

对照：[小模型业务验收](small-model-biz-ops-plan.md) 第 2 条（`biz_expenses:list`、`status=待审`、**现查**待审表，不是过审）。

## 结论（人话）

**对象没打偏，动作打偏了。** 型是已连接的 **费用报销**（`biz_expenses`），匹配集是 **96 条**、状态仍是 **待审**；但 Qwen 在 turn 2 只打了一枪 `biz_preview`，**显式 `action=过审`**，闸回了 **批量过审预览** 并发了写预览令牌 `pv_639e08fa009fe1dc`（抽屉里是状态 **待审 → 过审**）。验收要的是 **`action=现查`** 列出待审报销，**不要**过审预览、**不要**这类令牌。所以不是「当成报销单/工单另一张表」，而是 **把「待审的费用报销」听成「把这批待审报销过审预览」**。

截图路径（协调侧）：`/home/ubuntu/.cursor/projects/workspace/assets/3616b834-1e60-4f99-9091-9e5e64dea7aa.png` — 本机未找到该文件；以下以会话日志与 `lan-assist` 账本为准。

---

## 会话与上下文

| 项 | 值 |
|---|---|
| 家目录 | `~/.dsh-fde-x` |
| 工作区 | `/Users/zxz/Documents/ai-project/fdex测试` |
| 模型 | `sili` · `Qwen/Qwen3.8-27B` |
| 会话 | `session-84613257-63ba-483e-bbc5-3143f9a2c947` |
| 上一句（turn 1） | 「停用客户还有哪些没关的工单？」（hop 交集，见 [qwen-turn-not-end.md](qwen-turn-not-end.md)） |
| 本句（turn 2） | 「待审的费用报销」 |
| 日志 | `~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-84613257-63ba-483e-bbc5-3143f9a2c947/session.v3.jsonl.zstd` |

`projcache`：`turnOutline` turn 2 `prompt` = 「待审的费用报销」；`lastTurn` 已进到 turn 3（后续另有「故障类而且紧急…」）。

---

## 事实核对

### 1. 这句 `biz_preview` 的 action：现查还是过审/写？

| 证据 | 内容 |
|---|---|
| seq 50 `tool/call` | `{"kind":"费用报销","action":"过审","speech":"待审的费用报销"}` |
| seq 51 `tool/result` | `ok: true`，`action":"过审"`，`preview_id":"pv_639e08fa009fe1dc"`，`batch":true`，`canWrite":true` |
| 变更预览 | `changes":[{"field":"status","label":"状态","from":"待审","to":"过审"}]` |
| 闸账本 | `1790354647660`「听出业务动作 · 仍不自动开工 · 待审的费用报销」→ `1790354695246`「**预览令牌 · 费用报销 · pv_639e08fa009fe1dc**」（中间**没有**「现查进业务页 · 费用报销」） |

验收句 2 要求：**现查** + `status=待审` 列表。实际：**过审** 写预览 + 令牌。`listed: true` 只表示回执里带了表行，**不能**当成「按现查过关」。

模型 reasoning（seq 49）里曾考虑 `action=现查` + `where status=待审`，但最终工具参数选了 **`过审`**。

### 2. Sheet 是不是 96 行、且仍是 `status=待审`？

| 字段 | 值 |
|---|---|
| `mapped.resource` | `biz_expenses` |
| `from`（匹配行数） | **96** |
| `nos` | 96 个报销单号（如 `EXP20250404126`、`EXP20251224598`…） |
| 行上状态（库内） | 过审预览语义下，匹配集为待审行；预览 diff 为 **待审 → 过审**，不是已改过账 |

落地文档里同句手验曾写 **97** 行待审（[where-by-cell-land.md](../internal/where-by-cell-land.md)）；本会话闸回 **`from: 96`**，以当时库/过滤为准，与「整表错对象」无关。

本次调用**未带** `where` JSON；待审集合由闸从 `speech` + `action=过审` 的批量过审路径收成，不是验收写的显式 `biz_expenses:list` + `status=待审` 现查形状。

### 3. 有没有发过账令牌？

**有写预览令牌，没有证据表明已 `biz_write` 过账。**

- 已发：`pv_639e08fa009fe1dc`（批量过审预览）。
- 同会话、同账本里**没有**紧接这句的「写口回了 · 费用报销 …」；`pendingWrite` 现为 `null`。
- 会话里另有**别的时段**对 `EXP20251224598` 等的写回执（`1790302147491` 等），属于**其他回合/探测**，不能算作这句验收句已落账。

当前 `state.json` 的 `pendingSheet` 已跟到 **turn 3**（工单 · 现查 · 8 行 urgent incident），`preview_id` 空 — 不能用来否定 turn 2 当时发过令牌。

---

## 与验收句 2 的对照

| 验收要求 | 本会话 turn 2 实际 |
|---|---|
| `biz_expenses` / 费用报销 | 是 |
| `status=待审` 过滤的**现查**表 | 集合语义上是待审报销，但动作是 **过审预览**，不是 `action=现查` |
| 右边是待审行列表、无写令牌 | 有表行，但有 **`preview_id`** 与 **待审→过审** diff |
| 不是上一张工单 | 是费用报销，不是工单（对象对） |

---

## 归类（Ace 问法）

| 问题 | 答案 |
|---|---|
| 对象错了？ | **否** — 费用报销 / `biz_expenses`，不是报销单 0 行、也不是留着工单表。 |
| 动作做成了过审？ | **是** — 模型主动 `action=过审`，闸发批量过审预览令牌。 |
| 意图理解错在哪？ | **把「看待审报销」做成「批量过审预览」**；不是换了一张假表。 |

---

## 证据索引

- `session.v3.jsonl.zstd`：seq 48 用户句；seq 50–51 `biz_preview` 调用与回执。
- `~/.dsh-fde-x/lan-assist/state.json`：`bizline` `2026-09-25:bizline:session-84613257-…` → `1790354647660`；letters `预览令牌 · 费用报销 · pv_639e08fa009fe1dc`。

（本文只陈述事实，不改产品。）
