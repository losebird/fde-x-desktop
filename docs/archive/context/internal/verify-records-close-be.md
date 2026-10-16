---
cursor:
  subagentId: "bc-259bfdbd-9c31-5269-aee8-a3734d416e90"
---

# Verify: BE 业务记录整块收口（人选后关选择题，再跑完 5–10）

**pass:** no
**main SHA:** `aa20391`（`4700fe6` 仍在历史上）
**先前 SHA:** `4700fe6`
**branch:** `main`（未推 origin）
**failCode:** case-2:still-thinking
**闸注入:** no
**静默 biz_write:** no
**确认过账:** no
**自动发 IM:** no
**5174 未杀:** yes（pid 39206）
**src 写入例字面量:** none
**走访不动:** yes

产品改动：人选完命中行并出写预览后，`RecordsPanel` 调已有 `cancelAi` 想关掉左栏 AskUserQuestion。现网没跑到第 4 条，这条没验到。

口语原句只在本店探针，未写入 `src/`。不写死恒通或任何 id。

## 对照表

| 项 | 状态 | 证据 |
|---|---|---|
| 1 停用客户还有哪些没关的工单 | 已对 | 图 `be-case-01.png`：现查 工单 21 行首行 `TK20260623126`，chip 工单21 / 客户14，hop 客户→工单。不是一家家问。footer 共 21 条。BD 当时是 22/15，本趟图是 21/14。 |
| 2 故障紧急未关工单 | 仍差 | 图 `be-case-02.png`：左栏出选择题「没有故障+紧急+未关闭…你要看哪一档？」；右表仍是第 1 条工单 21，横幅还是「停用客户还有哪些没关的工单？」。pending.speech 仍是第 1 条。脚本 `still-thinking`。按失败即停，后面没跑。 |
| 3 待审回款挂已到期合同 | 未对 | 第 2 条没过后没跑。 |
| 4 模糊名多家：先停再选再预览，选完左栏选择题关掉 | 未对 | 没跑到。产品有 `aa20391`，现网未证。 |
| 5 待审报销单都过一下 | 未对 | 没跑。一批过审未现网。 |
| 6–10 | 未对 | 没跑。 |
| 取消预览 | 未对 | 没跑。 |
| 浮现历史 | 未对 | 没跑。 |
| 切会话 | 未对 | 没跑。 |
| 决策 22 三 Tab / 创建 / 拉伸 48/224 / 问 AI / 走访 | 已对 | 本趟脚本：tabs/create/stretch/askAi/visit 均为 true。wide aside=224，narrow=48。走访 `updatedAt` 未变。 |

## 第 2 条（图为准）

- 左 AI：`biz_preview` 对「故障 + 紧急 + 未关闭」NOT_FOUND；又问「低/中/高/紧急，未关最高只到高，你要看哪一档？」；「提问 / 等待回答 / 深度求索中 / 跳过本题」。
- 右表：工单 21，`TK20260623126`，chip 工单21 / 客户14。不是 BD 那张 1 行 `TK20260105702`。
- 没有新 pending。没有闸注入。

## 禁区

硬编码进 src=none。闸注入=no。评测集 / 第 9 步 / 决策 20/21 / overlay 收编 / corpus 去留=未做。未推 origin。未杀 pnpm 5174。未点确认过账。未静默 biz_write。未自动发 IM。不往 overlay 加新分叉。

已对：1、决策22
未对：3、4（人选后关选择题）、5、6、7、8、9、10、取消预览、浮现历史、切会话
仍差：第 2 条右表没换成当次现查，左栏选择题把下一句挡住

## 图

十格 `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-be.png`（1–2 有现网图；3–10 未跑空格）。
