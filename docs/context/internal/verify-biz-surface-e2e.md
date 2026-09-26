# 业务记录 · AI sheet 链路验证（2026-09-18T10:14:56.762Z)

## Git

- `scene-39-personal-workstation` @ `9972468d898a0704b05d1e726494b863bcfbf708`

## 根因（已修）

1. **空 pending 覆盖有行列表**：lan-assist 轮询偶发 `rows:[]` 的现查 pending，`applyPendingSheet` 仍 apply，把右侧表清空（§9）。
2. **浮现历史点选无效**：`hydrateFromPending` 把 pending 盖回历史；标签用同 kind 最新缓存冒充；SSE 丢 `from/related/hopWhere`。
3. **「同 kind 最新」回退**：`peekBizKindListSheet` / 无 anchor 的 `peekBizKindListSheetForOperation` 已去掉。

## 改动文件

- `runtime/routes/biz.mjs`
- `src/components/biz/RecordsPanel.tsx`
- `src/lib/biz-kind-list-cache.ts`
- `src/lib/biz-session-sheet.ts`

## 证明

| # | 断言 | 结果 | 说明 |
|---|------|------|------|
| 1 | SSE 现查 sheet 行数 = 右侧表行数 | yes | apiRows=3 tableRows=3 kind=`回款单` → [records-follows-ai-sheet.png](../media/records-follows-ai-sheet.png) |
| 2 | 切换历史后来源/行数变化 | yes | before rows=3 after rows=1 → [records-history-switched.png](../media/records-history-switched.png) |

**环境**：本 worker `lan-assist` 为 NOT_READY，证明 1–2 用 Playwright 补丁 `EventSource` 注入 `biz.sheet.pending`（与真 SSE 同 envelope），surface id 来自 SQLite `biz_surfaces`。Ace 机 lan-assist 就绪时请再跑 `node scripts/capture-biz-records-e2e-proof.mjs` 或真 AI 现查复验。

```json
{
  "gitSha": "9972468d898a0704b05d1e726494b863bcfbf708",
  "lanAssistKinds": "skipped",
  "proof1": {
    "ok": true,
    "apiRows": 3,
    "tableRows": 3,
    "kind": "回款单"
  },
  "proof2": {
    "ok": true,
    "beforeLabel": "",
    "afterLabel": "",
    "beforeRows": 3,
    "afterRows": 1
  },
  "notes": [
    "surfaces=6",
    "surfaceA=bsurf_3565fd5d41f24852a25b5c21aa23e59b",
    "surfaceB=bsurf_817becaec9c7413986392e542ee66c45",
    "pending-banner-rows-match"
  ]
}
```
