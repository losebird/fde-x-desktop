---
cursor:
  subagentId: "bc-4b8b26f8-d45d-5e6b-b98a-887476c61512"
---

# 口语进库收口（按钉审计）

## 改了什么

| 项 | 做法 |
|---|---|
| m2o/o2o/belongsTo | 新模块 `relation-bind.js`：`shapePatch` 只认 schema `interface`+`target`，口语 list 收成 `relationColumn`（`fkColumnForRelation`）；失败不写 FK |
| R1 预览退回口语 | `bindWritePatch` 失败/无连接时 `stripRelationKeys`，`token.patch` 不带口语 FK |
| 词表「关联列」 | 删除 `relationStemOf` / `kindForFkName` 猜 FK 路径 |
| 过审 E1/E2 | `approveNextStatusCode` 从 schema 枚举 + spoken clues 收 code；过账读 `token.patch`，无 `'已过'` 字面量 |
| where R7 | `lookup.probeOne` 在 `bindClueEnums` 后 `bindWhereRelationTerms`，关系 filter 值与 patch 同套 id |
| 展示 | 预览响应仍 `displayPatch` 口语；`token.patch` / 过账 body 仅机器值 |

## 文件

- `runtime/vendor-overlays/dsh-lan-assist/relation-bind.js`（新）
- `runtime/vendor-overlays/dsh-lan-assist/write.js`
- `runtime/vendor-overlays/dsh-lan-assist/lookup.js`
- `runtime/tests/write-patch-relation.test.mjs`

已 `cp` 到 `~/.dsh-fde-x/vendor/dsh-lan-assist/`。请在本机 **disconnect → connect** DSH（约 16002）加载 overlay；未 reload、未动 4318/5174、未过账、未推远程。

## 证明

```bash
cd scene-39-personal-workstation
node --test runtime/tests/write-patch-relation.test.mjs
```

覆盖：客户公司名、`CUST-016`、处理人 `acee`、where 客户名、过审 `approved`（非「已过」）。
