---
cursor:
  subagentId: "bc-edb5f241-37cb-5d05-b42b-038d75828c12"
---

# 原话定动作：已按方案落地

对照 [原话定动作](speech-action-authority-plan.md)、[待审为什么变成过审](qwen-pending-as-approve.md)。本地分支 `cursor/speech-action-authority-8c12`（`6dcee573`），未推远程。one-bind 的 `enumHits` / hop / hint 和重载那刀都没动。

## 结论

**原话 + 词表现在是动作权威。** 没有写动作 role 的型+条件一律现查；模型填的过审/改/删留不下、不发票。口语命中唯一写动作且该型 `can` 有，仍走过审/改/删预览。又像看又像写先出表，回执问这一格，不静默发票。枚举字只当筛选。

本机 Qwen 新会话 `session-dd2a5aec-f45c-4212-96d8-74863ca4cbbc` 打「待审的费用报销」：`action=现查`，`status=待审`，一页 20 行，**无 `preview_id`**，`canWrite=false`。用 Qwen 旧枪同款 JSON（`action=过审`）打闸，也被收成现查、无令牌。明确「都过一下」仍过审预览并发票。

## 闸怎么收

`recoverWriteIntent` 缺省不再把动作槽交给模型：

1. 口语命中**唯一**写动作 role，且该型 `can` 有 → 该写动作。
2. 对不上任何写动作 role → **现查**，丢掉模型写动作和 patch。
3. 现查动作 role 与写动作 role 同时命中，或 0 个写动作但模型坚持写 → 现查出表，`askAction` 带回执：「这一格是现查还是{该写动作}？人回一句再写。」不发票。
4. 写动作 hit 落在更长的字段枚举 span 里（如「已过审」里的「过审」）不当写。`X的Y` 枚举前缀仍把「新建的工单」收成现查。

删掉了只认「现查/列出」才把错写拉回现查的旧缺省。`spokenListAction` 只留给「又像看又像写」的现查线索。词表补了问句动词进现查 say、补了「过了 / 过审」进过审 say；**没有**把「待审」写进过审 say，没有待审特赦。

## 改了哪些文件

| 文件 | 做什么 |
|---|---|
| `runtime/vendor-overlays/dsh-lan-assist/slots.js` | 原话+词表定动作；无写动作 → 现查 |
| `runtime/vendor-overlays/dsh-lan-assist/write.js` | 现查回执带问句；不重复问；现查不发票 |
| `runtime/vendor-overlays/dsh-lan-assist/vocab/spoken.json` | 现查 say 补问句动词；过审 say 补「过了 / 过审」 |
| `runtime/tests/slots-enrich.test.mjs` | 通用三项：无写→现查；有写口语→过审；两可先现查 |
| `runtime/tests/write-hop-actions.test.mjs` | 写 hop 带口语写动词；无写口语不发票；两可不发票 |
| `runtime/tests/write-name-identity.test.mjs` | 「改客户。」无写 role → 现查、无令牌 |

## 单测

过：`slots-enrich`（含新通用项）、`write-hop-actions`（含决策 22：无写口语的 hop 现查、`过一下` 仍过审预览）、`write-confirm-collapse`、`where-by-cell`、`write-patch-relation`、`column-value-match`。

本刀之前就失败、未纳入：`write-name-identity`「rewrite 成交 still patches when the enum label is longer」（字段名 `状态` 对不上 `status`）；`leftover-catalog-refuse`「spoken leftover still binds…」(`NO_CONNECTOR`)。

## 现网

核心 disconnect/connect 刷 overlay 后灯仍 `connected: true`（pid 对得上正在听的 DSH）。家目录仍是 `~/.dsh-fde-x`。工作区 `/Users/zxz/Documents/ai-project/fdex测试`。

| 句 | 结果 |
|---|---|
| Qwen 新会话「待审的费用报销」 | `费用报销` 现查，where `status=待审`，`EXP20250404126` 待审，无令牌 |
| 闸模拟旧枪 `action=过审` 同句 | 收成现查，无 `preview_id`，回执问现查还是过审（只问一次） |
| 「把待审费用报销都过一下」 | 过审预览，`pv_…`，96 行 |
| 「恒通电子有哪些工单？」 | `action=现查`，无令牌（不是写） |

没有自动 `biz_write`。没有推远程。
