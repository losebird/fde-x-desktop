---
cursor:
  subagentId: "bc-ced362fd-16b0-5905-9623-4ed269a2390f"
---

# W1 手测 — 查询摘录

会话：`session-7eaa79f6-9ce7-4f19-bbf3-e4efc54caa4c`（标题「新建一张工单，标题=手测新建」）  
工作区 cwd：`/Users/zxz/Documents/ai-project/fdex测试`  
会话日志：`/Users/zxz/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-7eaa79f6-9ce7-4f19-bbf3-e4efc54caa4c/session.v3.jsonl.zstd`

## 时间线（seq / 本地时间约 UTC+8）

| 时刻 | 事件 |
|---|---|
| 19:57:50 | 用户 Turn1：「新建一张工单，标题=手测新建」 |
| 19:59:06 | `biz_preview` → 令牌 **`pv_ac8c1ff15e1938be`**（patch.title=手测新建，expiresAt=1790193636044，TTL 90s） |
| 19:59:23 | 模型说明：预览未过账，令牌未用 |
| *约 20:00:36* | **`pv_ac8c1ff15e1938be` 过期**（expiresAt） |
| *20:00–20:07* | **右栏点确认过账**（无 DSH 事件；走 BFF，见下节探测） |
| 20:07:11 | 用户 Turn2：同一句「新建一张工单，标题=手测新建」 |
| 20:08:12 | 左栏 `biz_write` **`pv_ac8c1ff15e1938be`** → **`EXPIRED`** |
| 20:08:28 | 左栏 `biz_preview` → **`pv_3666248f266a5137`** |
| 20:08:34 | 左栏 `biz_write` **`pv_3666248f266a5137`** → **成功 receipt `388329877078016`** |
| 20:08:45+ | 多次 `biz_preview` 现查被闸判成「新建」；`biz_traces` 无行 |
| 20:09:01 | `biz_preview` 现查 `no=388329877078016` → **`Error: tool call aborted`**；`turn/end` **user abort** |

## 1. BFF `POST /api/v1/biz/write`（右栏确认）

**映射链（产品代码，未改）：**

- 红条 fallback：`RecordsPanel.tsx` → `formatBizPanelError(..., '过账失败，请重新预览后再试')`
- BFF：`runtime/routes/biz.mjs` → `bizWriteFailureMessage` 同文案；catch 分支用 `AiRemoteError`
- 闸原文在 lan-assist **`lines[0].hint`**，不在 HTTP body 顶层

**过期令牌 — 直连 lan-assist（原始闸）：**

```http
POST http://127.0.0.1:64388/lan-assist/write
{"preview_id":"pv_ac8c1ff15e1938be"}
→ HTTP 400
{"ok":false,"failed":true,"lines":[{"ok":false,"error":"EXPIRED","hint":"预览过期了。要写再预览一次。","preview_id":"pv_ac8c1ff15e1938be"}]}
```

**同令牌 — 经 BFF（右栏同路径，2026-09-24 探测）：**

```http
POST http://127.0.0.1:4318/api/v1/biz/write
{"preview_id":"pv_ac8c1ff15e1938be","cwd":"/Users/zxz/Documents/ai-project/fdex测试","source":"workstation",...}
→ HTTP 400
{"error":{"code":"ai/im-error","message":"过账失败，请重新预览后再试"}}
```

**机理：** `dsh-core.mjs` 的 `lanAssist` 在 HTTP 4xx 时用 `payload.hint || payload.error || "IM 调用失败：HTTP …"` 抛错；`/write` 失败包只有 **`lines[].hint`**，顶层无 `hint` → 消息变成 `IM 调用失败：HTTP 400` → `bizWriteFailureMessage` 吞掉 → 红条显示 generic 文案。**原始错误是 `EXPIRED` /「预览过期了。要写再预览一次。」**

## 2. 左栏 `biz_write` vs 右栏确认

| 路径 | 调用方 | 成功？ | preview_id | receipt |
|---|---|---|---|---|
| DSH 工具 `biz_write` | 左栏模型 Turn2 step4 | 是 | `pv_3666248f266a5137` | `388329877078016` |
| DSH 工具 `biz_write` | 左栏模型 Turn2 step2 | 否 EXPIRED | `pv_ac8c1ff15e1938be` | — |
| BFF `/api/v1/biz/write` | 右栏「确认过账」 | 否（探测同 EXPIRED 令牌） | `pv_ac8c1ff15e1938be`（抽屉令牌） | — |

**`biz_write` 成功工具结果（session seq 82，节选）：**

```json
{
  "ok": true,
  "receiptId": "388329877078016",
  "preview_id": "pv_3666248f266a5137",
  "lines": [{
    "ok": true,
    "receiptId": "388329877078016",
    "trace_id": "ticket-create-handtest-shouce-xinjian:0",
    "action": "新建",
    "patch": { "title": "手测新建" }
  }]
}
```

**库侧：**

- `runtime/data/fde-workstation.sqlite` **`biz_write_audit` 无 `388329877078016`**（最近一条仍为 2026-09-23 员工档案改行）— BFF 成功过账才会写 audit；本次成功走 DSH 工具，未经过 BFF insert。
- `~/.dsh-fde-x/lan-assist/state.json` **pendingSheet** 曾现查命中：`id/title` **`388329877078016` / `手测新建`**，`updatedAt` **`2026-09-23T20:08:35.047Z`**（与 write 时刻一致）。
- `fdex测试/.dsh/lan-assist/traces.projection.md` 仍空；`traces.sqlite` 无行 — **`biz_traces` 查 receipt 为空是投影未 ingest，不是「没写过」。**

## 3. `tool call aborted`

**session seq 99–103：**

```json
// tool/call seq 99
{"name":"biz_preview","arguments":"{\"kind\":\"工单\",\"action\":\"现查\",\"no\":\"388329877078016\",\"speech\":\"查工单388329877078016现在的值\"}"}

// tool/result seq 101
{"content":[{"type":"text","text":"Error: tool call aborted"}],"error":{"name":"AbortError","code":"ABORTED"}}

// turn/end seq 103
{"turn":2,"reason":{"kind":"aborted","reason":{"kind":"user"}}}
```

**结论：** DSH Harness **用户终止本轮**（`turn/end` reason `user`），在并行/进行中的 `biz_preview` 上表现为 **`AbortError` / tool call aborted**；**不是** BFF reload、不是 4318 探活、不是 write 未完成。同一 turn 前序现查多次被 **`recoverWriteIntent` / 会话 speech** 判成 **`action":"新建"`**（见 seq 87、94 工具结果里 `action":"新建"` 且 `patch:{}`）。

## 4. 右表仍「新建 · 待确认 · 总数未知」

- **失败未关抽屉：** `confirmWrite` catch 只 `setError`，**不** `setDrawer(null)`（`RecordsPanel.tsx`）。
- **pending 仍写预览：** Turn2 误路由的 **`pv_be623a9d4d2bf17f`**（`biz.sheet.pending` event + `/api/v1/biz/pending-sheet`：action **新建**、canWrite true、changes **[]**、speech 被换成现查句）。
- **页脚：** 新建预览 `packSheet` **无 `hitTotalState`** → `RecordsPanel` `hitFooterText` → **「总数未知」**（写预览单行不是现查 hitTotal）。

## 5. 预览令牌序列（state 笔记摘录）

```
预览令牌 · 工单 标题 · pv_ac8c1ff15e1938be
预览令牌 · 工单 标题 · pv_3666248f266a5137
写口回了 · … receipt …
现查进业务页 · 工单 388329877078016
```

（路径：`~/.dsh-fde-x/lan-assist/state.json` dock/notes 区）
