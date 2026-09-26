---
cursor:
  subagentId: "bc-a68307c8-e09e-506b-8226-745920d49815"
---

# Verify: BN 原 6–10 × 冻结四点（preview only）

**pass:** no  
**main SHA:** `e8ac09f`（chrome `598f8d7`）  
**branch:** `main`（未推 origin）  
**failCode:** `case-6:过审-empty-changes`  
**闸注入:** no  
**静默 biz_write:** no  
**确认过账:** no  
**5174 未杀:** yes  
**现查当过审:** no  
**第 11 条:** no

对照：[收口总因](../docs/records-close-root-cause.md) 四条。左栏 `/api/v1/ai/sessions/:id/prompt`。BM 第 5 条不重开。无第 11 条。

## 因果（第 6 条，一条写完）

人话「过一下请假单 LV-2026-018」进 DSH。闸只收 structured kind。`请假单` 是已连接 `请假申请`（`biz_leave_requests`）的别名，不是第二张表。

第一枪（修前）：闸把「请假」当考勤枚举，where `考勤状态=leave` 并进请假申请过审 → 空表、无令牌；左栏说单不存在；右表按住上一会话费用报销 97。

本刀收了通用洞（不是请假单对照表）：词表 clue say 只是被点名 kind 标签的前缀时不算筛；DSH 塞来的外 kind 列不在本表 schema 上就丢掉。`main` `e8ac09f`。

第二枪现网：pending `请假申请 · 过审 · 1 行 · LV-2026-018 · preview_id=pv_9674f395f7f4cdf9`，where 空。右表同一张，chip `请假申请 1`，横幅「AI 拟改 请假申请 1 行 · 待确认」（不是「AI 刚查了」）。抽屉「操作：过审」，正文「没有可展示的变更内容」。左栏：现在是已过，这是预览，不是过账。

现网这张单状态就是 **已过**（leaveType other / 年假休息）。过审匹配集找到了行，但没有可改字段。契约要过审预览标出改过的字段；空变更不算过。失败即停，7–10 没跑。未点确认过账。

## 对照（图为准）

| 条 | 契约 | 状态 | 证据 |
|---|---|---|---|
| 6 过一下请假单 LV-2026-018 | C1 口语=别名连表；C2 过审落匹配集出令牌且有变更；C3 右表换上且横幅跟这次动作 | 仍差 | 图 `media/records-close-bn-case-06.png`：kind=请假申请 resource 连表；1 行 LV-2026-018；令牌有；抽屉过审空变更；状态已过。不是现查顶过审。 |
| 7–10 | — | 未对 | 第 6 条失败即停。 |

已对：无  
未对：7、8、9、10  
仍差：第 6 条过审空变更（现网已过）。整块 6–10 没过。

## 禁区

未点确认过账。未静默 `biz_write`。未点小区水电抄表「问 AI」。未推 origin。未开旁支。未删探针。未发明第 11 条。未写死报销单/请假单/工单对照表。决策 22：三 Tab 还在图上。评测集 / 第 9 步 / 20/21 / overlay 收编不做。

## 图

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bn.png`  
分图：`media/records-close-bn-case-06.png`（7–10 未跑）
