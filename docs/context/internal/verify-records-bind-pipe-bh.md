---
cursor:
  subagentId: "bh-records-bind-pipe"
---

# Verify: BH 业务记录 bind 管

**pass:** yes（只验契约现网四项，不是整块 10 条）
**product SHA:** `8d6266c`（其上 `e80c052`）
**branch:** `cursor/records-bind-pipe-bh-96ba`（未进 main，无 origin）
**闸注入:** no
**静默 biz_write:** no
**确认过账:** no
**自动发 IM:** no
**5174 未杀:** yes
**src 写入例字面量:** none
**overlay 当原因:** no
**走访不动:** yes（`updatedAt` 2026-09-19T06:03:58.932Z 未变）

对照总因：[records-close-root-cause.md](../docs/records-close-root-cause.md)。不再另起印证清单。

## 真因（对照那份文档，不是 overlay）

工作台把「闸已经查对的那一次」和「人看见的 / 模型下一步打的」拆成了两套。插件是一句话 → 一次 preview → 人看那一次，没有第二张表、没有 BFF 再写 pending、没有取消回目录，所以 10 条过。

钉死的三处：

1. **报销单是图谱并列概念**，不是当前连接器那张报销表生成的。费用报销（`biz_expenses`）才是有行的表。没有业务表的概念不得 preview。口语短名只能当别名，不写死报销单→费用报销。
2. **第 5 条：** 过审先被 leftover「单都」吃偏（overlay 仍在，未改）；现查 97 成功；批量过审没出 `preview_id`；模型改打报销单空表；工作台把最后一枪 apply 上屏。插件里人看见 97 就停。
3. **取消倒客户目录是 apply 回潮**（目录第 1 页，首行曾是 `CUST2056`），不是短名。

## 按契约改了什么

1. 只有连着业务表的对象能当预览/写目标。同一 `resource` 收到连接器生成的那张；`(in graph)` / 无 resource 不得 preview。口语名进 `aliases`。
2. 一句话一张 pending。`emitBizSheetPending` / `rememberBizPendingSheet` / GET `pending-sheet` 不得用空写、假 kind、目录倾倒盖掉已查对的那次。
3. 右表必须换上这一张。空过审无 `preview_id` 不上屏；取消不把目录第 1 页灌回去，按住取消前那张浮现表。
4. 模糊名多家先选再继续：本趟未重跑第 4 条。

未改 leftover / overlay 分叉。

## 对照表（图为准）

| 项 | 状态 | 证据 |
|---|---|---|
| 待审报销一批上屏 | 已对 | 母体：总因 §2 第 5 条要的是已连接报销表待审集，不是报销单 0。现网 POST 口语短名现查：kind **费用报销** 97，首行 `EXP20251224598`；chip `费用报销97`；footer `共 97 条`。词表 kinds 无「报销单」，口语名只在 aliases。图 `media/records-bind-pipe-bh-batch.png` / 左格 `media/records-bind-pipe-bh.png`。无业务表概念 POST → 400「该对象没有连接业务表」。 |
| 空第二枪不得盖掉 97 | 已对 | 母体：总因下游 `shouldRejectEmptyIncomingSheet` 空过审曾能上屏。现网再打无令牌过审，右表仍 费用报销 97 / `EXP20251224598`。 |
| 取消不倒目录 | 已对 | 母体：总因 §3 / BG `bg-cancel.png` 曾是客户目录约 20、首行 `CUST2056`。现网改行预览 1 行（抽屉「改行确认 · 费用报销」，`状态 待审→待审*`），点取消后 footer `共 97 条 · 现查`，chip `费用报销97`，首行仍 `EXP20251224598`，抽屉关。不是 CUST、不是 20。图 `internal/bh-cancel.png` / 右格 `media/records-bind-pipe-bh.png`。 |
| 同形短名通用 | 已对 | 母体：契约 1，口语短名是别名。现网 kinds 无「请假单」；POST kind=请假单 现查 → **请假申请** 20，首行 `QJ20240425718`，footer `共 20 条`。src 无报销单/费用报销字面量对。 |
| 决策 22 三 Tab / 创建 / 拉伸 48/224 / 问 AI / 走访 | 已对 | tabs/create/stretch/askAi/visit 均为 true。wide aside=224，narrow=48。走访 `updatedAt` 未变。 |
| 模糊名多家先选再继续（契约 4 / §12） | 未对 | 本趟按 Ace 只验上面四项，没跑第 4 条。 |
| 1–4、6–10 整块 | 未对 | 禁止空转 10 条。 |
| leftover「单都」/「一批」吃偏过审 | 仍差（锁：overlay） | 总因写明 overlay 不是根因、禁止当原因改。现网无 speech 的过审仍可能被闸报对不上「过审」；带「一批」的过审报对不上「一批」。未补 overlay 分叉。 |

## 禁区

硬编码进 src=none。闸注入=no。评测集 / 第 9 步 / 决策 20/21 / overlay 收编 / corpus 去留=未做。未推 origin。未杀 pnpm 5174。未点确认过账。未静默 biz_write。未自动发 IM。不往 overlay 加新分叉。

已对：待审报销一批上屏、空第二枪不上屏、取消不倒目录且回到 97、同形短名、决策 22
未对：契约 4 模糊名现网、1–4/6–10
仍差：overlay leftover 吃偏过审（锁，未改）

## 图

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-bind-pipe-bh.png`

左：待审费用报销 97 / `EXP20251224598`。右：取消后同一张 97，不是客户目录。
