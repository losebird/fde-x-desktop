---
cursor:
  subagentId: "bc-365c5ab7-63cd-5621-9521-ae929f2ef9ee"
---

# wave-fix · where field labels → schema keys

## 状态 binds?

**Unit / contract:** yes — `runtime/tests/where-pass-labels.test.mjs` (enum inference, `fieldLabels`, raw collection titles).

**现网 POST `/api/v1/biz/preview`（workspace `/Users/zxz/Documents/ai-project/fdex测试`，工单，`status=processing`）：**

| where `field` | rows | error |
|---------------|------|-------|
| `status` | **70** | — |
| `状态` | **0** | `NOT_FOUND`（不再是 `WHERE_UNBOUND`） |

**结论：** 词表中文列名 → `status` 的绑定逻辑已进 `where-pass` / `lookup`，但本环境现查 `field: 状态` 仍未得到与 `status` 相同的 ~70 行。建议下一步：对该 workspace 跑一次 `POST /api/v1/biz/vocab/generate` 写入 `fieldLabels`，并 `POST /api/v1/ai/reload` 后再测。

## SHA

`276ead39ac914c7bc30db8798c8e2b0b7c440bc0` (`main`)

## 改动摘要

- `where-pass.js`：`fieldLabelMap` / `bindWhereKeys` / `fieldLabelsFromRawCollection`；词表 `fields` + enum/status 列推断；`enrichVocabHit`
- `lookup.js`：`termFitsCollection` 用 `resolveShapeKey`；`bindWhereKeys` 在 `bindClueEnums` 之前；合并 `vocab`/`kinds` 行
- `nocobase-vocab.mjs`：生成概念时写入 `fieldLabels`
- `biz/where.mjs`：委托 `normalizeAliasWhere`
- `write.js` / `memory-vocab.mjs`：透传 `fieldLabels`

## 测试

`node --test runtime/tests/where-pass-labels.test.mjs runtime/tests/biz-where.test.mjs runtime/tests/vocab-from-connector.test.mjs` — 绿
