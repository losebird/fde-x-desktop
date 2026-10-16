---
cursor:
  subagentId: "bc-9b70780b-8cd1-5219-98e8-33b5d43aa708"
---

# Roles ↔ Users 边：连接器与口径（2026-09-24）

## 第一性

「X 的 Y」= 目标对象 **Y** 上，经该已发布边从**现存 X** 能到达的**去重行数**（数 Y，不数 through 关联次数）。

## 连接器（Noco `13000`，lookup token）

| 查询 | 结果 |
|---|---:|
| `rolesUsers` through 全表 `meta.count` | **15** |
| through 行内 `distinct userId` | **14** |
| through 行内 `distinct roleName` | **8** |
| `users` 全表 | **14** |
| `roles` 全表 | **11** |

schema（`collections:list`，不写死业务词，仅记录字段名）：

- `roles.users`：`through=rolesUsers`，`foreignKey=roleName`，`otherKey=userId`，`sourceKey=name`
- `users.roles`：同 through，`foreignKey=userId`，`otherKey=roleName`，`sourceKey=id`

15 ≠ 14：同一用户多角色（多行 through）；15 ≠ 8：多角色挂用户 vs 有用户的角色数。

## 现网 pending / preview（`4318` `/api/v1/biz/preview`，未 reload）

| 话术 | `requestKind` | `hitTotal` |
|---|---|---:|
| `{{t("Roles")}}的{{t("Users")}}` | `{{t("Users")}}` | **14** |
| `{{t("Users")}}的{{t("Roles")}}` | `{{t("Roles")}}` | **8** |

现网已按 **Y 去重** 报数，与 distinct 一致；**未改产品**。

## 闸口径修正

`internal/biz-data-eval-library-count.mjs` 的 `m2mLibraryCount`：

- 从 **from** 侧 `edgeField` 读 `through` / `foreignKey` / `otherKey` / `sourceKey`
- 列出现存 source 键，扫 through，对 **otherKey（目标侧）** 去重计数
- 不再用 through 全表 `meta.count`（此前闸 **15** 导致与现网 **14 / 8** 差 2 条）
- 列表分页 `sort=-updatedAt`（`roles` / `rolesUsers` 无 `id` 列，`sort=id` 会空集）

修正后官方库数：

| 边 | 库 | 右 |
|---|---:|---:|
| `{{t("Roles")}}` → `{{t("Users")}}` | **14** | **14** |
| `{{t("Users")}}` → `{{t("Roles")}}` | **8** | **8** |

另两条 m2m（`Departments`↔`Roles` / `Users`↔`Departments`，through 为 0）仍为 **0 / 0**。

## 重打范围

仅更新 `biz-data-eval.json` 中上述两条边 + `summary.edge.livePass`（85 条边 **85 / 85 / 85**）。未串行重跑 362。
