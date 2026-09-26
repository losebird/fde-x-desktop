# 业务记录 · 真现查 live 验证（2026-09-18T10:40:34.657Z)

## Git

- `scene-39-personal-workstation` @ `db2db6f9c0ff08af3e7f4fcf604c818bfdbd7d89`

## 环境

- Vite `http://127.0.0.1:5174`，runtime 经 proxy；`lan-assist` `GET /api/v1/biz/pending-sheet` → 可达（{"httpOk":true,"status":200}）
- 工作区 cwd：`/Users/zxz/Documents/ai-project/fdex测试`
- 现查路径：页面内 `POST /api/v1/biz/preview` → BFF `lanAssist('/preview')` → SSE `biz.sheet.pending`（无 EventSource 补丁）

## 仍差

- **未对（锁外）**：左侧 DSH 气泡若本轮未走会话内 `biz_preview`，截图里仍可能露出更早现查列表（如 `PAY-2026-*`）；与右侧/lan-assist `pending-sheet` 不同屏。复验时在**同一会话**里发出现查后再截图，或以 `pending-sheet` ↔ 业务记录表为权威对齐。

## 证明

| # | 断言 | 结果 | 说明 |
|---|------|------|------|
| 1 | lan-assist `pending-sheet` 行数 = 右侧「共 N 条」= 横幅 N；表首列 = pending 首单号 | yes | kind=`销售回款` pending=20 lead=`PAY202508027115`（DSH 气泡同屏可见：未测/旧气泡）→ [records-follows-ai-sheet.png](../media/records-follows-ai-sheet.png) |
| 2 | 浮现历史切到较早 surface：有行、无「不在待确认区」、行键含该次现查样本 | yes | 14→14 rows surface `9bcf3c331f78` → [records-history-switched.png](../media/records-history-switched.png) |

```json
{
  "gitSha": "db2db6f9c0ff08af3e7f4fcf604c818bfdbd7d89",
  "lanAssist": {
    "ok": true,
    "note": "{\"httpOk\":true,\"status\":200}"
  },
  "proof1": {
    "ok": true,
    "pendingRows": 20,
    "tableNos": [
      "PAY202508027115",
      "PAY202407106181",
      "PAY202407268807",
      "PAY202408275642",
      "PAY202408033656",
      "PAY202603029478",
      "PAY202601243609",
      "PAY202602256558",
      "PAY202506109675",
      "PAY202507242979"
    ],
    "pendingNos": [
      "PAY202508027115",
      "PAY202407106181",
      "PAY202407268807",
      "PAY202408275642",
      "PAY202408033656",
      "PAY202603029478",
      "PAY202601243609",
      "PAY202602256558",
      "PAY202506109675",
      "PAY202507242979"
    ],
    "bannerRows": 20,
    "kind": "销售回款",
    "bannerText": "AI 刚查了 销售回款 · 20 行 · 刚刚",
    "aiHasLeadNo": false,
    "totalLabel": "共 20 条 · 局域网业务协作适配器 · 现查 18:40",
    "leadNo": "PAY202508027115"
  },
  "proof2": {
    "ok": true,
    "before": {
      "rows": 14,
      "kind": "",
      "surfaceId": "bsurf_7d6d28f51d854f36bd3d5485ff61b6c8"
    },
    "after": {
      "rows": 14,
      "nos": [
        "PAY202407106181",
        "PAY202407268807",
        "PAY202603029478",
        "PAY202506109675",
        "PAY202508027115",
        "PAY202407106181",
        "PAY202407268807",
        "PAY202408275642",
        "PAY202408033656",
        "PAY202603029478",
        "PAY202601243609",
        "PAY202602256558"
      ],
      "surfaceId": "bsurf_652b9dfc2e2f42e6bc1c9bcf3c331f78"
    },
    "staleHint": false,
    "historyOption": "bsurf_652b9dfc2e2f42e6bc1c9bcf3c331f78",
    "paySample": [
      "PAY202508027115",
      "PAY202407106181",
      "PAY202407268807",
      "PAY202408275642",
      "PAY202408033656",
      "PAY202603029478",
      "PAY202601243609",
      "PAY202602256558",
      "PAY202506109675",
      "PAY202507242979"
    ]
  },
  "notes": [
    "preview:{\"ok\":true,\"rows\":20,\"kind\":\"销售回款\"}",
    "preview合同:{\"ok\":true,\"rows\":20}"
  ]
}
```
