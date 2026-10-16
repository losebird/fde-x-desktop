---
cursor:
  subagentId: "bc-5daf733e-77b4-50a6-ba8b-6bf33bbaa01d"
---

# Verify: BF 现查漏查（故障紧急未关 → 哪家客户）

**pass:** yes
**SHA:** `98af48853bcb98306b865423e02611976a974aa5`（合进日常树 main 后同 SHA）
**branch:** 日常树 main（从 `cursor/records-query-miss-bf-a01d` 合入，未推 origin）
**failCode:** —
**闸注入:** no
**静默 biz_write:** no
**确认过账:** no
**自动发 IM:** no
**5174 未杀:** yes
**src 写入例字面量:** none
**走访不动:** yes（`updatedAt` 2026-09-19T06:03:58.932Z 未变）

## 真因

先印证再改。三条假设按 BF 顺序查：

1. **下一句沿用上一张 pending/where 当底表？不是这条。** 孤立说第 2 条同样 `NOT_FOUND`。第 1 条能过，是因为客户侧有停用条件。
2. **「没关」把已分派/处理中/新建当成关闭？不是这条。** 关闭态来自该 kind 词表/schema 枚举的否定；那 8 行状态本就未关。
3. **「故障」「紧急」绑错 English code？不是这次报 0 的因。** fdex测试存的是 schema 英文码，口语走词表线索；现网 8 行类型=故障、优先=紧急。

**真因：** 口语提到客户+工单后，`enrichStructuredSlots` hop 成先 `from:{kind:客户}` **空 where**，再工单侧带本句条件。旧 `previewStructured` 从第一步空 where 起探，空 where 走目录页 `PAGE_SIZE=20`。那 8 张故障+紧急未关工单的客户不在这页 → `NOT_FOUND`。空 miss 被闸 `shouldKeepPopulatedListSheet` / 右表 `shouldRejectEmptyIncomingSheet` 按住第 1 条那 21 行；模型在 miss 后问「哪一档」。

**修：** 从第一个有 bind 的 hop 步起探；空祖先用子行 FK 回填。换了口语的空现查必须上屏。不写死故障/紧急/incident/urgent/工单/单号/已关闭。

同类已扫：同一会话下一句不得夹带上一句 where/kind/pending；写预览 opening 不同口语不并进旧 opening；右表不得按住旧 sheet；一批现查不得变成选择题。模糊名多家仍按五问 §12（本刀未跑第 4 条）。

## 对照表（图为准）

| 项 | 状态 | 证据 |
|---|---|---|
| 1 停用客户还有哪些没关的工单 | 已对 | 图 `internal/bf-case-01.png`：左栏 21 张未关 / 14 家停用客户；右表 chip 工单21、客户14，footer 共 21 条，首行 `TK20260623126`，横幅本句。不是一家家问。 |
| 2 故障紧急未关是哪家客户的 | 已对 | 图 `internal/bf-case-02.png`：左栏列出 8 家客户+工单，无「哪一档」；右表 工单8 / 客户8，共 8 条，类型全故障、优先全紧急，状态 新建/已分派/处理中。含 `TK20260105702`（第 5 行）。pending.speech 本句。不是第 1 条那 21 行。行数对上 Ace 业务系统图 8。首行排序与 Ace 业务图不同（现网首行 `TK20250211633`，Ace 业务图首行 `TK20260105702`），集合同一批。 |
| 3 待审回款挂已到期合同 | 已对 | 图 `internal/bf-case-03.png`：右表换成 销售回款1 / 销售合同1，`PAY-2026-005` ∩ `HT-2026-005`，不是工单 8。左栏新答是待审回款∩已到期合同。无夹带第 2 条工单表。 |
| 决策 22 三 Tab / 创建 / 拉伸 48/224 / 问 AI / 走访 | 已对 | 脚本：tabs/create/stretch/askAi/visit 均为 true。wide aside=224，narrow=48。走访 `updatedAt` 未变。 |

## 现网 1→2→3（同一会话）

| # | 过/没过 | 现网 |
|---|---|---|
| 1 | 过 | 工单 21 · `TK20260623126` · hop 客户→工单 · sameSheet |
| 2 | 过 | 工单 8 · 含 `TK20260105702` · quiz=false · 横幅本句 · sameSheet |
| 3 | 过 | 销售回款 1 · `PAY-2026-005` · hop 销售合同→销售回款 · 未夹带工单 8 |

口语原句只当活用例，未写入 `src/`。

## 禁区

硬编码进 src=none。闸注入=no。评测集 / 第 9 步 / 决策 20/21 / overlay 收编 / corpus 去留 / 整块 10 条 / 取消 / 浮现历史 / 切会话=未做。未推 origin。未杀 pnpm 5174。未点确认过账。未静默 biz_write。未自动发 IM。不往 overlay 加新分叉。

已对：1、2、3、决策22
未对：4–10、取消预览、浮现历史、切会话、评测集、第9步、20/21、overlay 收编（本刀不做）
仍差：无（本刀 BF）

## 图

三格按序 1–3。图和自报不一致以图为准。

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-query-miss-bf.png`
