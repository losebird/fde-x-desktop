---
cursor:
  subagentId: "bc-b2c308ab-bde3-5d92-9a6c-3e65a1064836"
---

# 这笔新建的三条根因

会话 `session-b1223c3a-e15d-4c0b-9a91-86860bbc6845`。人话：「新增一笔工单，标题是测试新增功能，优先级是高，负责人是ace」。只查因。表上第 1 行是 `388449561542657`，第 2 行是 `388449561542656`。

槽和列按现网 schema（`biz_tickets`，生产 NocoBase `http://127.0.0.1:13000`）：`title` 工单标题，`priority` 优先级（`high` = 高），`assignee` 是 m2o、界面名「处理人」、`target` = `users`、外键列 `assigneeId`（bigInt）。这次 `biz_describe` 的图只露出客户 → 工单 `customer`，没有处理人那条边。

## 1. 处理人 ace 没进库

口语 `ace` 停在展示用的 patch 上，没变成 `users.id`，过账不写 `assigneeId`。

- 预览 `pv_8f8e4a2fff34db81`（seq 67）给人看的 patch 是 `title=测试新增功能`、`priority=high`、`assignee=ace`。这是展示 patch；令牌里真正过账的 patch 被盖住了，原文未证。
- 前一枚 `pv_23993019a2bca0a2`（seq 60）用中文键「标题 / 优先级 / 负责人」，patch 是 `{}`。schema 字段名对不上，这一层没把「负责人」收成 `assignee`。
- `users` 14 人里没有 `username` / `nickname` / `email` 精确等于 `ace`（昵称最接近的是 id 1「Ace Admin」）。按闸同一套 `$or`（还含 users 上不存在的 `name` / `title` / `code`）现打 `GET /api/users:list` 是 400，唯一 id 收不出来。收不出来就不写外键。
- 库行 `388449561542657`：`title=测试新增功能`，`priority=high`，`assigneeId=null`，`assignee=null`。`createdAt=updatedAt=2026-09-24T11:59:45.537Z`。
- 发往 NocoBase 的 POST body 没落日志，字节未证。库列说明 `assigneeId` 没写上。

## 2. 空白第二行是第一枚空令牌写的

同一次确认把开口里两枚新建令牌各 POST 了一次。先写的是空 patch，得到全空行 `…656`；后写的才是有标题的 `…657`。

| | 令牌 | bundle 里的 patch | 回执 | 库 |
|---|---|---|---|---|
| 先写 | `pv_23993019a2bca0a2` | `{}` | `388449561542656` | 业务列全 null。`createdAt=2026-09-24T11:59:45.480Z` |
| 后写 | `pv_8f8e4a2fff34db81` | 标题 / high / ace（展示） | `388449561542657` | 标题 + `high`，处理人空。晚 57ms |

- BFF 审计只有一条：`trace_d45c35f6f6f34dec9ce13e38926c5042`，`receipt_id=388449561542656,388449561542657`，`written_at` 19:59:45.605。回执按两次 `gate.write` 的顺序用逗号拼上。
- 秘书原文两句对得上：第一句只有单号 `…656`、没有「将…改为」（空 patch）；第二句是「工单 标题」加上标题 / high / ace（后一枚令牌的 `no` 仍是「标题」）。
- 右栏现查（20:00:47）按更新时间把 `…657` 排在第 1 行、`…656` 排在第 2 行。不是 NocoBase 自己多插的空行，也不是 hydrate。两行 `createdById=updatedById=1`。
- BFF 请求体只带 `preview_id`，审计没存这枚 id，点的是哪一枚未证。seq 67 顶层令牌是 `pv_8f8e4a2fff34db81`，`lines` 里两枚都在，所以一次确认会两发。两发的 HTTP body 字节未证。

## 3. 写完现查又 aborted：旧 leftover 还在的那一支

`turn/end` 是 `aborted` / `plugin-leftover`。带单号的那下现查没被掐；掐的是随后那张没有 `where`、也没有 `no` 的整表。

- seq 108，20:00:47.403：`{"kind":"aborted","reason":{"kind":"plugin-leftover"}}`。不是 `user`，不是 `records-cancel`。
- 这一轮由过账后的 wrote follow-up 打开（seq 79，plugin `dsh-lan-assist`，「库里已改上」）。
- seq 82 现查带 `no=388449561542656`，seq 85 正常返回（只有 id / 更新时间）。seq 90 带了 title 条件，返回 `WHERE_UNBOUND`，也没 abort。
- 被掐的是 seq 103–106：`biz_preview` 参数只有 `action=现查`、`speech=现查工单标题测试新增功能`，没有 `no`；并行的 `biz_traces` 一起 `AbortError`。
- 这张表现在还在 `pendingSheet`：`at=20:00:47.387`，`speech` 与 seq 103 相同，没有 `where`，`hitTotal=403`，`preview_id` 空。无筛选现查列表会走 leftover cancel。

对照已有结论：以前是「写预览还当候选 + 后面任何现查」都 `cancel({kind:'user'})`，带单号也会掐。这次带 `no` 的现查没掐，记账也改成了 `plugin-leftover`。剩下的是同一套 leftover 里「无 where 的现查列表仍取消」那一支，不是新洞，也不是右栏 `records-cancel`。

上游（哪份契约让这三条生出来）：[create-write-three-upstream.md](create-write-three-upstream.md)。
