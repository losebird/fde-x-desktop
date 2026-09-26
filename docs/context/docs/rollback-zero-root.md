---
cursor:
  subagentId: "bc-5c6c2315-6030-5c4c-8557-e0d369e5f5bb"
---

# 回退为什么对不上「回退」

红条里的「回退」就是这次拿去查的词。不是主键，也不是客户号。客户名称包含「回退」是 0 行。行还在，备注仍是「测试修改」，没有写回去。

这一笔是 **CUST2056**（深圳恒通电子有限公司，主键 `371712729939987`）。库里没有 CUST20566。确认条文案是「将恢复 客户 CUST2056 的字段」。

未改产品，未重启 5174 / 4318，未 reload。

## 根本原因

回退预览把口语写成固定的「回退」，闸又把审计里的客户号 CUST2056 换成这个剩下的名字，然后按客户名称包含「回退」去查。

[records-panel-decisions.md](records-panel-decisions.md) §8 要的是当时写入的对象和行主键。审计里主键在 `receipt_id`，回退没用它。就算用客户号 `code = CUST2056` 也能对上——90 秒前的改行就是这么写上的。这次两个都没拿去查。

按列去比（where-by-cell）没有把身份清掉。过账查找键（lookup-key）也没走到：死在预览查行，没有 update。

## 1. 库里这一行还在

`biz_write_audit` `bwa_1b8c0a60369f4e609f2c3876c6bfb958`，2026-09-25 10:19:04：

| 项 | 值 |
|---|---|
| trace | `trace_edd76f4823e14558afd454cf7df1f317` |
| 对象 / 动作 | 客户 / 改行 |
| `record_no` | CUST2056 |
| `receipt_id` | `371712729939987`（就是这行的主键） |
| 变更 | 备注 `active` → `测试修改` |
| `lookup_bind` | 只有 `bizKind`、当时那句口语、session。没有 where，没有主键 |

`biz_customers` 现在仍是这一行：`code = CUST2056`，名称深圳恒通电子有限公司，`notes = 测试修改`。名称里没有「回退」。`code` 或名称等于 CUST20566：0 行。

## 2. 回退发出去的不是主键

点回退时 BFF `POST /api/v1/biz/rollback/preview` 用 `rollbackPreviewBody` 组预览。审计 `record_no` 进 `no`，口语写死成「回退」。`lookup_bind` 里原来那句「改客户 CUST2056 备注改成测试修改」被丢掉。补丁是把备注写回 `active`。没有 where。

闸收到的是：`kind=客户`，`action=改行`，`no=CUST2056`，`speech=回退`。

## 3. 闸把客户号换成「回退」

`attachSpeechIdentity`（`slots.js`）只在两种情况下留着原来的号：人选过的行，或这句口语里含有这个号。「回退」里没有 CUST2056，两种都不是。

剩下的中文是「回退」两个字（`leftoverNameIdentity`）。动作不是现查，于是 `no` 被写成「回退」。

按列去比看的是「列名是「值」」这种引号。这句没有引号，`terms` 空，`unmatched` 假，不会删掉 `no`。词表里也没有「回退」这个动作词可剥。

查空之后，页上的 `no` 被清成空，`clue` 留下「回退」。这是 0 条之后的展示，不是查找键把身份清空。`pendingSheet`（10:20:34）：`speech=回退`，`clue=回退`，`no=""`，`rows=[]`，`speak` 就是那句红条。

## 4. 打到库的滤法，以及 0 条

NocoBase `request_2026-09-25.log`，10:20:34，`reqId` `16597837-8b03-459e-b24a-95cb73fa01df`：

`GET /api/biz_customers:list?pageSize=20&sort=-updatedAt&filter={"name":{"$includes":"回退"}}`

HTTP 200，`bodySize` 67。同一天名称包含「胡文」也是 67 字节的空表；对上 CUST2056 那次是 786 字节。没有按 `id` 查，也没有按 `code` 查。

DSH 预览 `ok: false`，`error=NOT_FOUND`，`hint` 就是「客户这边对不上「回退」，0 条，不是没去查。」这句引号里的词就是查找用的 rest（[按问题描述删为什么对不上](delete-by-description-miss.md) 同一套文案）。

DSH 对 `ok: false` 回 HTTP 400。BFF 的 `lanAssist` 在 400 上直接抛 `hint`，回退路由里「按行主键回查为空」那句没走到。抽屉红条因此就是这句，不是「没去查」。

## 5. 对照：90 秒前的改行打中了同一行

10:19:04 同一张客户，滤法是 `code = CUST2056`（`pageSize=1`，读回 786 字节），然后：

`POST /api/biz_customers:update?filter={"code":"CUST2056"}`，`notes=测试修改`，HTTP 200。

那次是过账查找键：连接上 `ticketField` 空，用词表第一格 `code`。客户号有值，所以打中。回退没有沿用这次滤法，也没有改用主键。
