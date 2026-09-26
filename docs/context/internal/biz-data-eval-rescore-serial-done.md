---
cursor:
  subagentId: "bc-bec3ec81-0e0c-5ba1-ba02-bd63bfdc2300"
---

# 362 串行重打完成

- 脚本：`internal/biz-data-eval-rescore-serial-run.mjs`（`CONCURRENCY=1`）
- 日志：`internal/biz-data-eval-rescore-serial-run.log`
- HEAD：`f1b927585c334bf839192ee3ab6d5f41bd914769`

## 分数（闸 / 现网）

| 类 | 用例 | 闸 | 现网 |
|---|---:|---:|---:|
| 已发布的边 | 85 | 81 | 74 |
| 每个对象上的枚举词 | 220 | 220 | 213 |
| 长对象名盖住短对象名 | 6 | 6 | 6 |
| 同一个枚举词落在多个对象上 | 29 | 29 | 29 |
| 字段指向了对象，图上没有这条边 | 22 | 22 | 22 |

## 抽查（通过）

| 用例 | 库里 | 右边 | 闸 |
|---|---:|---:|:---:|
| 供应商 / C | 16 | 16 | ✓ |
| 出入库流水 / 生产领料 | 1647 | 1647 | ✓ |
| 仓库 / 半成品库 | 1 | 1 | ✓ |

产物：`docs/biz-data-eval.md`、`internal/biz-data-eval.json`。
