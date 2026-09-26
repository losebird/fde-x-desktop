---
cursor:
  subagentId: "bc-93f004e6-77da-5a92-a9fb-dc89f066d73f"
---

# Verify: BL 原 10 条 × 冻结四点（preview only）

**pass:** no  
**product SHA:** `8096470`  
**branch:** `main`（未推 origin）  
**failCode:** `case-5:empty-sheet`  
**闸注入:** no  
**静默 biz_write:** no  
**确认过账:** no  
**5174 未杀:** yes  
**src 写入例字面量:** none（产品未改）

对照：[收口总因](../docs/records-close-root-cause.md) 四条。左栏 `/api/v1/ai/sessions/:id/prompt`，不是只 POST 现查。无第 11 条。取消/空资源/目录倾倒本刀不重开。

## 因果（第 5 条，一条写完）

人话「待审报销单都过一下」进 DSH。闸只收 structured kind。

左栏轨迹（图 `media/records-close-bl-case-05.png`）：

1. `biz_preview · 报销单`：指纹约 97，**行空**。
2. `biz_preview · 费用报销`：97 条待审（现查成功）。右表跟上这张。
3. 再打 `报销单`：指纹有 EXP 号，行仍空。
4. `biz_describe · 费用报销`：再次锁定 97 待审。
5. 批量 `biz_preview · 费用报销 · 过审`：**NOT_FOUND**，没有 `preview_id`。
6. 模型改口：考虑改打 kind 报销单。探针在此停（pending 已是过审 0）。

pending 终态：`kind=费用报销` `action=过审` `rows=0` `preview_id=null` `speech=待审报销单都过一下…`。右表仍是上一次现查 97（chip 费用报销97，首行 `EXP20251224598`，footer 共 97），抽屉没开过审。

不是词表没有费用报销。不是右表按住第 4 条客户。是 **过审没落到已连接表的匹配集、令牌没出**；口语名「报销单」仍能被闸打成空指纹。契约 2 没过。失败即停，6–10 没跑。未改 `src/` `runtime/`。

## 对照（图为准）

| 条 | 契约 | 状态 | 证据 |
|---|---|---|---|
| 1 停用客户没关工单 | C1 连接表；C2 一张 pending；C3 右表换上；hop 必须是工单 | 已对 | 图 `media/records-close-bl-case-01.png`：kind=工单 resource=`biz_tickets`；chip 工单21/客户14；footer 共 21；首行 `TK20260623126`；hop 步骤 客户→工单。不是审批单。 |
| 2 故障紧急未关是哪家客户的 | 同上；一批，不哪一档 | 已对 | 图 `media/records-close-bl-case-02.png`：工单 8，含 `TK20260105702`；不是第 1 条 21；无「哪一档」。 |
| 3 待审回款∩已到期合同 | C3 换掉上一张工单 | 已对 | 图 `media/records-close-bl-case-03.png`：销售回款 1 `PAY-2026-005`；hop 销售合同→销售回款。 |
| 4 停用客户恒通改成成交 | C4 先选再继续；一批不问 | 已对 | 图 `media/records-close-bl-case-04.png`：本趟停用∩恒通 1 家 `CUST2058`；改行抽屉 暂停合作→成交客户；`preview_id=pv_8f7a777c66885cff`；未过账。不是客户目录 37。 |
| 5 待审报销单都过一下 | C1 口语=别名；C2 过审落匹配集出令牌 | 仍差 | 图 `media/records-close-bl-case-05.png`：右表现查费用报销 97；pending 过审 0、无令牌。闸对费用报销批量过审 NOT_FOUND；报销单空指纹仍能打。 |
| 6–10 | — | 未对 | 第 5 条失败即停。 |

已对：1、2、3、4（C1–C4 本趟形状）  
未对：6、7、8、9、10  
仍差：第 5 条过审空表 / 无令牌。整块 10 条没过。

## 禁区

未点确认过账。未静默 `biz_write`。未点小区水电抄表「问 AI」。未推 origin。未开旁支。未删探针。决策 22 取消/空资源本刀不重开（未回潮到目录 20）。评测集 / 第 9 步 / 20/21 / overlay 收编不做。

## 图

十格（6–10 未跑）：`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bl.png`
