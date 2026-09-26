---
cursor:
  subagentId: "bc-fdeba9f2-5c87-5ada-b470-49da08f7848b"
---

# 第一刀实施记录（worker）

## 删除

- `write.js`：`HOP_XIANCHA_CACHE_*`、`hopXianchaCache`、`hopXianchaCacheKey`、`hopXianchaCacheSet`、`hopSheetHasKindHits` — 只按多型 speech 缓存且有行才返回，与「已绑 hop + querySettled」不一致，属空转旧路。

## 测试命令

```bash
cd runtime && node --test tests/biz-query-settle.test.mjs tests/write-hop-actions.test.mjs tests/slots-enrich.test.mjs tests/where-by-cell.test.mjs tests/write-confirm-collapse.test.mjs
```
