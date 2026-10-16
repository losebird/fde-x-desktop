---
cursor:
  subagentId: "bc-f089f80e-88cd-51a9-bf65-6b780479b420"
---

# Verify: BD 业务记录整块收口（第 4 条先选再预览）

**pass:** no
**main SHA:** `4700fe69567dd92a4c53911ad9db9b5db9c7a5c3`
**先前 SHA:** `2322e12`（命中集先停）
**branch:** `main`（未推 origin）
**failCode:** 5–10 未齐；最后一趟 case-1 pending-unchanged
**闸注入:** no
**静默 biz_write:** no
**确认过账:** no
**自动发 IM:** no
**5174 未杀:** yes（pid 39206）
**src 写入例字面量:** none
**走访不动:** yes

口语原句只在本店探针，未写入 `src/`。不写死恒通或任何 id。人选的是这次命中行。

## 对照表

| 项 | 状态 | 证据 |
|---|---|---|
| 1 停用客户还有哪些没关的工单 | 已对 | 现查 工单 22 行 `TK20260623126`，chip 工单22 / 客户15，hop 客户→工单。不是一家家问。第二/三趟现网。 |
| 2 故障紧急未关工单 | 已对 | 现查 工单 1 行 `TK20260105702`，chip 工单1 / 客户1。 |
| 3 待审回款挂已到期合同 | 已对 | 现查 销售回款 1 行 `PAY-2026-005`，chip 销售回款1 / 销售合同1。右表换成当次 pending，不是上一条工单。 |
| 4 模糊名多家 | 已对（命中集 + 人选后预览） | 见下节。不是默默 1 行，不是整集改，不是客户 37。 |
| 5 待审报销单都过一下 | 未对 | 第二趟被第 4 条左栏未关选择题挡住 `still-thinking`；表仍停在客户 2 行。一批过审未现网跑完。 |
| 6–10 | 未对 | 5 没过后按失败即停未跑。 |
| 取消预览 | 已对（第 4 条后） | 第二趟点取消后抽屉关上；`bd-cancel.png` 13:51。 |
| 浮现历史 | 未对 | 10 条未齐，没跑到。 |
| 切会话 | 未对 | 同上。 |
| 决策 22 三 Tab / 创建 / 拉伸 48/224 / 问 AI / 走访 | 已对 | 跑到 D22 的两趟：tabs/create/stretch/askAi/visit 均为 true。走访 `updatedAt` 未变。 |

## 第 4 条（Ace 纠正，现网）

规则：模糊名对上多家必须停，让人从**这次命中**里选，选完再出改行预览。禁止默默挑一行、禁止整集直接改、禁止倒目录。测时真的选出一家，不写死哪一家。

**先停（无 preview_id）：**

- pending / 右表：客户 改行，2 行 `CUST2058`、`CUST2056`，`listed=true` `ambiguous=true`，`preview_id` 空，抽屉关。
- footer 共 2 条，chip 客户2。不是客户 37。
- 左栏同时出选择题「要预览改成成交的是哪一家」，仍只预览、不过账。
- 图：`internal/bd-case-04-hits.png`

**人选一家（脚本取这次命中的最后一行，不是写死恒通/CUST2056）：**

- `pickedNo=CUST2056` `pickIndex=1`，命中集 nos=`CUST2058,CUST2056`。
- 之后才出改行预览：1 行 `CUST2056`，抽屉「操作：改行」，暂停合作 → 成交客户，有 `preview_id`（第二趟 `pv_ddffe11ca2284f20`，changes `status` inactive→成交，`canWrite` true）。
- 图：`internal/bd-case-04.png`（抽屉开着；未点确认过账）。
- 取消后抽屉关上。

第三趟人选后探针把左栏残留「深度求索中」当成还在想，等到预览 TTL，pending 被记成 `action-mismatch(none)`；**当时屏幕上抽屉已经是改行预览**。产品路径以第二趟 API + 第三趟图为准。

## 1–10 最近一趟脚本表

最后一趟 14:21 被 leftover pending 挡住，case-1 `pending-unchanged`，作废。不要拿那一趟当第 4 条结论。

## 禁区

硬编码进 src=none。闸注入=no。评测集 / 第 9 步 / 决策 20/21 / overlay 收编 / corpus 去留=未做。未推 origin。未杀 pnpm 5174。

已对：1、2、3、4（先停命中两家，人选后再出改行预览）、取消预览、决策22
未对：5、6、7、8、9、10、浮现历史、切会话
仍差：5–10 现网未齐

## 图

十格 `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bd.png`（第三趟 1–4；第 4 格是人选后的改行抽屉）。命中集另图 `internal/bd-case-04-hits.png`。
