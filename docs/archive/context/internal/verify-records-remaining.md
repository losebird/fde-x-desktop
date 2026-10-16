# Verify: R + S + U remaining records

**hardcoded:** none
**pass:** yes
**failCode:** —
**origin:** not pushed
**step 9 / eval set / corpus / connector-chip mix:** not done

## SHA

| 项 | 值 |
|---|---|
| daily branch | `main` |
| R | `99deed04950deeab4ad9384d56b7281fd9734e8f` |
| HEAD (R+S) | `4555a3743e7f3b96a8f4798dda08bc6751b19006` |

cwd `/Users/zxz/Documents/ai-project/fdex测试`

产品仓未推 origin。探针未进产品仓。未杀 pnpm 5174。未 git add 探针。未做第 9 步。未出评测集。

## R · 历史 option 第三段

无 speech/where/hop 时，第三段用该次缓存行身份（no/pk），不是空白，也不是钟点。

- option `工单 · 改行 · 371713516372058`（Q 时第三段为空）
- option `工单 · 删除 · TK20260305892`
- option `审批单 · 现查 · QJ20240425718`
- option `工单处理记录 · 现查 · 371713514274894`
- 有 speech/where 的仍走原话或条件（`销售回款 · 现查 · 待审回款 ∩ 已到期合同`）
- clock-only：0
- 点「工单 · 改行 · 371713516372058」后 tbody 1、first `371713516372058`、下拉钉住

`historyOptionLabel` = speech/where/hop，否则 `historySheetRowIdentity`。

截图: `media/records-history-switched.png`

## S · 孤立 leftover 不能当预览/写目标

只在 **resolve 之后** 判断：目标 kind 仍是词表里更长登记名的后缀、且不在连接器目录，则 `NO_CONNECTOR`，不发令牌。不是短标题黑名单。口语片段仍走词表+图+目录绑定到已连接 kind（测里 `Widget` → `AlphaWidget`）。未改字段值模糊搜。

闸：`runtime/tests/leftover-catalog-refuse.test.mjs` + `slots-enrich.test.mjs` 口语绑定仍过。

现网（截图之后，不作为 U 过关）：对不上目录的 leftover 短名 `线索` POST `/biz/preview`（无 speech）→ `NO_CONNECTOR`，「没连业务，不能装成已查。」`preview_id` 空，无 sheet。

## U · 整句一次 hop

闸注入不算过关。现网原句 `待审回款 ∩ 已到期合同`，会话 `session-1705ad85-1715-4f6b-8ceb-4d2b0ec7c39d`。非 429。

| 探针 | 值 |
|---|---|
| pending | 1 · `PAY-2026-005` · hop yes from=销售合同 · hopWhere yes · steps 销售合同→销售回款 · speech=原句 |
| 左 AI | `= 1 张`；「从已到期合同 hop 到待审回款，目前就这一张」 |
| tbody | 1 first=`PAY-2026-005` |
| footer | 共 1 条 |
| chip | 销售回款1 |
| 横幅 | AI 刚查了 销售回款 · 1 行 |
| bash | 对话正文未见 bash |
| gateInjected | no |

截图: `media/records-hop-intersection.png`

## 对照

- 已对：R 现网下拉第三段是缓存行身份，`RecordsPanel` `historyOptionLabel` + `biz-list-query.ts` `historySheetRowIdentity`；图 `records-history-switched.png` 钉着 `工单 · 改行 · 371713516372058`，表首行同一号。`main` `99deed0`。
- 已对：S resolve 后 leftover 不在连接器目录则拒预览/写；口语短名仍绑到已连接登记 kind（词表+图+目录，无短标题黑名单）。闸测过；现网 leftover `线索` → `NO_CONNECTOR` 无令牌。`main` `4555a37`。
- 已对：U 现网原句左 AI 1 张 PAY-2026-005 且口述 hop；右 tbody/footer/chip/横幅都是 1，首行就是那一行；pending hop from=销售合同。不是两次单侧半表。图 `records-hop-intersection.png`。
- 未对：顶栏 / FaceSidebar / Stage / Palette / OfficialConversation hide（本切片没测）。
- 未对：SSE `ai.tool.called` 本轮没带回 tool 名；对话 chrome「8 次工具调用」含上下文注入，没点开轨迹逐条。
- 仍差：第 9 步、评测集、审查 corpus 去留、连接器芯片混排（按批不动）。
