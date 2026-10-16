---
cursor:
  subagentId: "bi-records-bind-pipe"
---

# Verify: BI 业务记录 bind 管

**product SHA:** `455e6e58fcc016ef62748ae63c8f7db99884cdf8`  
**branch:** `cursor/records-bind-pipe-bi-d708`；本地 `main` 已快进到同一 SHA（未推 origin）。不在旁支 `cursor/records-bind-pipe-bh-96ba`。  
**闸注入:** no  
**静默 biz_write:** no  
**确认过账:** no  
**自动发 IM:** no  
**5174 未杀:** yes（PID 39206 全程）  
**src / runtime 产品路径活用例字面量:** none（独立 `rg`，不信自报）  
**`(in graph)` 产品判断:** none（只在 `runtime/tests/*.test.mjs` 当夹具 resource）

对照总因：[records-close-root-cause.md](../docs/records-close-root-cause.md)。左栏 `/api/v1/ai/sessions/:id/prompt`，不是只 POST 现查。图和自报不一致以图为准。

## 拣进时独立 grep

```
rg -n "报销单|费用报销|请假单|请假申请|恒通|\(in graph\)" src runtime/biz runtime/routes --glob '!**/tests/**'
→ 空
```

`src/` 无命中。`runtime/biz`、`runtime/routes` 产品判断无活用例对照表、无 `(in graph)` 字符串。无业务表 = `resource` 空/缺，或对不上连接器 collection（`catalogVersion` 资源集，否则 `/^[A-Za-z][A-Za-z0-9._-]*$/`）。同一 `resource` 折到连接器那张；口语进 aliases 走 型槽 / 图 aliases。探针可写活用例。

## 对照表（图为准）

| 项 | 状态 | 证据 |
|---|---|---|
| 待审报销单都过一下 → 已连接表过审预览 | 已对 | 左栏原句（`bi-approve.png`）。pending `kind=费用报销` `action=过审` `rows=97` `first=EXP20251224598` `preview_id=pv_3e81b6c797212f2d`。图右表同批 EXP、footer 共 97 条、抽屉「过审确认」。不是报销单 0，不是只现查。 |
| 取消后仍是那批 | 已对 | `bi-cancel.png`：抽屉关，chip 报销单 97，表首行仍 `EXP20251224598`，footer 共 97 条。不是客户目录 CUST。 |
| 同形短名（请假单） | 已对 pending | pending `kind=请假申请`（catalog alias，不是请假单）`action=过审` `rows=1` `first=LV-2026-018` `preview_id=pv_e2d2a79d16c2e383`。 |
| hop1 停用客户未关工单 | 已对 | pending `工单` 21 `TK20260623126`，左栏原句。 |
| hop2 故障紧急未关 | 已对 | pending `工单` 8，含 `TK20260105702`。 |
| hop3 待审回款∩已到期合同 | 已对 pending | pending `销售回款` 1 `PAY-2026-005`。`bi-hops.png` 拍下时右表仍是工单 8（未等右表跟上）。 |
| 决策22 三Tab/创建/拉伸/问AI/走访 | 已对 | tabs 应用/业务记录/操作记录；创建入口+向导；wide=224 narrow=48；问 AI；走访 `updatedAt=2026-09-19T06:03:58.932Z` 未变。 |

## 仍差

- **选中芯片仍是口语名「报销单 97」**，旁边有未选中「费用报销」。pending.kind 已是费用报销；横幅也仍写「报销单 · 97 行」。图 `bi-approve.png` / `bi-cancel.png`。
- **闸仍接受 `kind=报销单`：** 左栏轨迹 `biz_preview · 费用报销` → NOT_FOUND，再 `biz_preview · 报销单` 打出 97。BFF GET pending-sheet 才折到费用报销。图谱口语名仍能 preview。
- **短名图不是 1 行：** 探针在短名过审后点了取消再拍，`bi-short.png` 右表是请假申请 **210** 行（首行 `Q20240425718`），不是 pending 那张 `LV-2026-018` 1 行。短名取消是否倒目录，本刀未按报销单取消那条收。
- 合成 2-up 曾因 `file://` 未嵌入而全白，已用 `bi-approve.png`+`bi-cancel.png` 重拼。以本文件下图为准。

## 禁区

硬编码进 src / runtime 产品路径 = none。闸注入=no。评测集 / 第 9 步 / 决策 20/21 / overlay 收编 / corpus 去留=未做。未推 origin。未杀 pnpm 5174。未点确认过账。未静默 biz_write。未自动发 IM。leftover「一批 / 都」只收「动作/批量词不当 kind」，无短名对照表。overlay 未新开分叉（只在已有 `spoken.json` 列举/助词槽加通用批量口吻，`slots.js` 一批 leftover 不当行号）。

已对：过审一批（pending 费用报销 97 + 令牌）、取消留批、短名 pending 折到请假申请、hop1/hop2、决策22 拉伸 48/224  
未对：闸侧口语名不得 preview（现网仍能打报销单出 97）  
仍差：芯片/横幅口语名；hop3 图未跟上 pending；短名取消后的 210 行图

## 图

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-bind-pipe-bi.png`

左：过审预览（97 EXP，抽屉开）。右：取消后（仍 97 EXP，抽屉关）。
