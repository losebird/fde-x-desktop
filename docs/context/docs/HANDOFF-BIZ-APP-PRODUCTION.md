# Handoff · 业务应用可生产

日期：2026-09-26。给下一个 agent 接着做。按 `handoff` 技能：不重抄已有方案，只指向路径。

下一会话用来：**确认 scene-39 HEAD 与 overlay，跑回归，请 Ace 重载后打三句。一句不过就停。不要开第二刀。**

## 现在停在哪

本地分支 `cursor/approve-batch-where-9c38`，目标 HEAD `71c43570`，**未推**。`FDE_DSH_HOME` 仍是 `~/.dsh-fde-x`，不要切 `~/.dsh`。

三句现网**没有一次过**。`17a62b30`（刷新空表）和 `71c43570`（记录页自动 apply）**没经过 Ace 重载手打**。不要写成已过。

Ace 的硬约束：不改坏已能用的功能；每刀带回回归；不硬编码；失败的 `TOO_MANY` 不上台；无写动作 role 的「待审+型」是现查。点头之前不改未批的刀。

## 下一会话只做这些

1. scene-39 上 `git rev-parse HEAD` 是否 `71c43570`。overlay `runtime/vendor-overlays/dsh-lan-assist` 与 `~/.dsh-fde-x/vendor/dsh-lan-assist` 是否同一套字节。不是就先对齐，再让他重载核心。
2. 再跑落地说明里的那组 `node --test`（含 `biz-query-settle`、`write-batch-where`、`session-round`、`biz-pending-stage`）。红了先修，不加功能。本刀前就失败的 `write-name-identity`「rewrite 成交…」不要当成这刀回归。
3. 请他同一新会话打：
   - 「停用客户还有哪些没关的工单？」——21 行交集；记录页自己打开；不要两枪全量查；不能只剩 `Error: tool call aborted`。
   - 「待审的费用报销」——现查、待审、右栏换成这张，不要停在工单旧表，刷新不能空表。
   - 「都过一下」——待审过审预览、有令牌；不要 100 行已通过/已付款/草稿。

## 不要做

- 不推远程。不切官方 DSH 家目录。
- 不写死工单、21、待审、停用、费用报销、100。
- 不把「本回合出过任何表」锁死。UNBOUND、翻页、换用户句、换目标型、写令牌、replay 仍可多步。
- 不从上一句现查把 where 灌进「都过一下」。
- 三句没过不要开方案第二刀（右表单一权威）、第三刀（过账回读）、第四刀（规章写库）、第五刀（应用铺面）。
- 不要做独立「业务 Agent」preset。他问过，结论是工具面而不是第二个人格，**没批**。

## 已有产物（去读，不要重写）

- [业务应用可生产方案](biz-app-production-plan.md)
- [业务应用第一刀落地](biz-app-production-land.md)
- [第一刀落地审阅](biz-app-production-land-review.md)
- [业务应用模块缺口](biz-app-module-gaps.md)
- [项目上下文](project-context.md) 决策 15 / 17 / 22
- 只读证据（store `internal/`）：`qwen-settle-abort.md`、`qwen-settle-abort-2.md`、`qwen-records-tab-miss.md`、`qwen-pending-approve-miss.md`、`qwen-refresh-empty.md`

代码只改 scene-39 上 `losebird/fde-x-desktop`。测试 cwd：`/Users/zxz/Documents/ai-project/fdex测试`。界面 5174，BFF 4318。

## Suggested skills

- **handoff**：本文件已经是交接。下一会话不要再 compact 一遍，除非 Ace 又要交出去。
- **claude-handoff**：只有他明确要「立刻丢给一个新的后台 agent 接着干」时再用。这次他要的是文档，不是再开一个 agent。
- 产品代码在他的 scene-39 上。下一手改代码用他这台机器，不要在空的云端仓库里改。
