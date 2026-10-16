---
cursor:
  subagentId: "bc-5b8e9b63-68f9-5b5d-a5dd-7b59ccd14cbe"
---

# 官方库数口径 + 串行 362 换表

时间：2026-09-24。未 reload；未重启 5174/4318。

## 改了什么

新增 [`biz-data-eval-library-count.mjs`](./biz-data-eval-library-count.mjs)，由：

- [`biz-data-eval-rescore-serial-run.mjs`](./biz-data-eval-rescore-serial-run.mjs)（生成闸 / 串行现网）
- [`biz-data-eval-rescore-run.mjs`](./biz-data-eval-rescore-run.mjs)（8 路版，口径同步）

共同 `import`。

### 口径实现（无写死 kind / 0·12·386）

| 场景 | 旧闸 | 新闸 |
|---|---|---|
| hop 子表 FK 边 | 下游 `{fk}: {$notEmpty}` | 上游 resource 分页 `id` → `relatedIdBatches`（`lookup.js`）→ 下游 `{fk: $in}` 分批 `meta.count` **求和** |
| m2m（`column: m2m` 或 collection `belongsToMany`） | **硬编码 0** | `collections:list` 取 `from` 侧 `edgeField` 的 **`through`** 表全表 `meta.count` |
| Departments→Users 等 | 曾落到 **部门 12** 或 users 全表 | `departmentsUsers` **0** |
| 边类无法解析 | `nocoMeta(下游全表)` | 返回 `null`（禁止把源/上游全表当「X 的 Y」） |

自验（Noco `13000`，与 [`hop-t-count-queries.md`](./hop-t-count-queries.md) 对照）：

```
purchaseOrder 收货 385 | receipts 385 | PO 明细 2085 | 工单日志 798
members 0 | rolesUsers 15
```

## 串行 362

```bash
cd …/files/internal
node biz-data-eval-rescore-serial-run.mjs   # CONCURRENCY=1
```

- 提交：`aee8655ee62df8597193bf901bb24f5ab9f8222a`
- 日志：[`biz-data-eval-rescore-serial-run.log`](./biz-data-eval-rescore-serial-run.log)
- 产物：[`biz-data-eval.json`](./biz-data-eval.json)、[`docs/biz-data-eval.md`](../docs/biz-data-eval.md)

### 分数（换表后）

| 类 | 闸 | 现网 |
|---|---:|---:|
| edge 85 | 85 | **83** |
| enum 220 | 220 | **220** |
| cover 6 | 6 | 6 |
| shared 29 | 29 | 29 |
| schema-gap 22 | 22 | 22 |

边类仍差 2 条（产品预览 total，非库数口径）：`{{t("Roles")}}→{{t("Users")}}` 库 15 / 右 14；`{{t("Users")}}→{{t("Roles")}}` 库 15 / 右 8。

hop 三问与 Departments→Users 在库数上与现网一致（385 / 2085 / 798 / 0）。

## 未改

- `runtime/vendor-overlays/dsh-lan-assist/lookup.js` 现网 hop 产品逻辑
- 5174 / 4318 进程
