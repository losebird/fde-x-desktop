---
cursor:
  subagentId: "bc-e8b23ddd-6eb2-56cf-959d-4bbb493f8898"
---

# Verify: BG 业务记录整块收口（带上 BF，跑完 10 条）

**pass:** no
**main SHA:** `2d4bbac`（`98af488` 仍在历史上）
**先前 SHA:** `98af488`
**branch:** `main`（未推 origin）
**failCode:** case-5:empty-sheet
**闸注入:** no
**静默 biz_write:** no
**确认过账:** no
**自动发 IM:** no
**5174 未杀:** yes
**src 写入例字面量:** none
**走访不动:** yes（`updatedAt` 2026-09-19T06:03:58.932Z 未变）

产品只动了一处，对齐已批 L/BD：空的 hop 侧视图不得按住有行的当次 pending。`src/lib/biz-list-query.ts` `shouldHoldSideKindView`：displayed 0 行时不 hold。闸测 13/13。口语原句只在探针，未写入 `src/`。不写死恒通/故障/紧急。

第一趟图：左栏 hop 21 张工单，右表「客户 · 0 行」。按空侧视图 hold 修完后重跑。

## 对照表（图为准）

| 项 | 状态 | 证据 |
|---|---|---|
| 1 停用客户还有哪些没关的工单 | 已对 | 图 `internal/bg-case-01.png`：左栏 hop 客户→未关工单 21；右表 chip 工单21 / 客户14，footer 共 21，首行 `TK20260623126`。不是一家家问。 |
| 2 故障紧急未关是哪家客户的 | 已对 | 图 `internal/bg-case-02.png`：左栏 8 家客户+工单，无「哪一档」；右表 工单8 / 客户8，类型全故障、优先全紧急，含 `TK20260105702`（第 3 行）。首行 `TK20250211633`。不是 0，不是第 1 条 21 行。 |
| 3 待审回款挂已到期合同 | 已对 | 图 `internal/bg-case-03.png`：右表换成 销售回款1 / 销售合同1，`PAY-2026-005` ∩ `HT-2026-005`，不是工单 8。 |
| 4 模糊名多家：先停再选再预览，选完关题 | 已对（本趟命中 1 家） | 图 `internal/bg-case-04.png`：停用∩名称只剩 `CUST2058` 苏州恒通（`CUST2056` 已是成交，不在停用集）。改行预览 1 行，暂停合作→成交客户，有 `preview_id`，未过账。左栏无选择题。不是客户 37，不是两家里默默挑。 |
| 5 待审报销单都过一下 | 仍差 | 图 `internal/bg-case-05.png`：左栏 现查说过 97 条待审，随后 过审 打到词表短名「报销单」0 行；右表 chip 报销单、footer 共 0、「当前暂还没有任何可展示的行」。不是一批过审预览。词表同时有「费用报销」和「报销单」。 |
| 6–10 | 未对 | 第 5 条失败即停，没跑。 |
| 取消预览 | 仍差 | 抽屉关了。图 `internal/bg-cancel.png`：右表是客户 20（目录页），首行 `CUST2056`，不是取消前那 1 行 `CUST2058`。 |
| 浮现历史 | 未对 | 没跑到。 |
| 切会话 | 未对 | 没跑到。 |
| 决策 22 三 Tab / 创建 / 拉伸 48/224 / 问 AI / 走访 | 已对 | 脚本：tabs/create/stretch/askAi/visit 均为 true。wide aside=224，narrow=48。走访 `updatedAt` 未变。 |

## 1–10 最近一趟

| # | 过/没过 | 现网 |
|---|---|---|
| 1 | 过 | 工单 21 · `TK20260623126` · hop 客户→工单 · sameSheet |
| 2 | 过 | 工单 8 · 含 `TK20260105702` · quiz=false · 横幅本句 |
| 3 | 过 | 销售回款 1 · `PAY-2026-005` · 未夹带工单 8 |
| 4 | 过 | 客户改行 1 · `CUST2058` · 预览未过账 · 选择题关 |
| 5 | 没过 | 报销单过审 0 · empty-sheet |
| 6–10 | 没过 | stopped-before |

## 禁区

硬编码进 src=none。闸注入=no。评测集 / 第 9 步 / 决策 20/21 / overlay 收编 / corpus 去留=未做。未推 origin。未杀 pnpm 5174。未点确认过账。未静默 biz_write。未自动发 IM。不往 overlay 加新分叉。

已对：1、2、3、4（本趟停用∩名称只 1 家，预览那一家）、决策22
未对：6、7、8、9、10、浮现历史、切会话
仍差：第 5 条一批过审空表；取消后表倒成客户 20

## 图

十格按序 1–10（6–10 未跑空格）。图和自报不一致以图为准。

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bg.png`
