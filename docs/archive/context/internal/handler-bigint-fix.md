---
cursor:
  subagentId: "bc-8e7a4f06-3f03-5ccc-bb46-441b888e65a2"
---

# 处理人口语名 → bigint 报错：根因与修复

## 现象（Ace 手测）

- 话：「新增一笔工单，标题是测试新增功能，优先级是高，处理人是 acee」（换人 `zxz` 同样）
- 左栏：新建预览 + 令牌 `pv_91f89f9474bcd4fc`，处理人显示口语名
- 右栏：预览行里处理人也是口语名，页脚「总数未知」
- 红条：`invalid input syntax for type bigint: "zxz"` / `"ace"`（PostgreSQL）

## 钉死：错误出在哪一层

| 层 | 结论 | 证据 |
|---|---|---|
| 预览令牌 / packSheet | **会成功** | `~/.dsh-fde-x/lan-assist/state.json` 时间线：`预览令牌 · 工单 标题 · pv_91f89f9474bcd4fc` 先于失败 |
| 过账 `postWrite` | **会炸** | 同一毫秒：`写口拒了 · WRITE_FAILED · 表还在` → `业务事件开口 · invalid input syntax for type bigint: "ace"`（`events[73]`，`session-0b9d3ea9`） |
| 现查 where 过滤 | **不是本用例主路径** | 新建预览未带 `where`；`pendingSheet` 只有 `fields.assignee` 口语值，无 list filter |
| 右表关联查询 | **未单独打库** | 红条来自 `hearBusinessEvent` 的 compensate 文案，即写口返回的 NocoBase/PG 原文 |

结论：**口语处理人进了 `token.patch` / `postWrite` 的 body，NocoBase 把 `assignee`（或等价 FK 列）当 bigint 写/查。不是预览 UI 自己造 SQL。**

## Schema：处理人槽

- 工单表（连接器 `biz_tickets` 一类）字段 **`assignee`**：`interface: m2o`，**`target: users`**（bigint FK → `users.id`）
- 词表/图：处理人 = 字段标题「处理人」→ schema 名 `assignee`；用户实体在 **`users`** 集合，口语短名应对 `username` / `nickname` 等，收成 **`assigneeId`**（`relationColumn` 规则）

## 为什么 acee/zxz 原样进了 bigint

1. 预览路径只做 **`bindPatchEnums`**（枚举 label→code），**不做关系解析**。
2. **`shapePatch` / `resolveRelatedId` 仅在 `createNocoWrite.write` 过账时调用**；且旧逻辑只靠 `kindForFkName('assignee')` / 词表「关联列」，**认不出 `assignee` → users**。
3. 未解析时 **`out.assignee = 'acee'`** 原样进 NocoBase → PG：`invalid input syntax for type bigint`.

`pendingWrite` 样例（换人后）：

```json
"fields": { "assignee": "zxz" },
"changes": [{ "field": "assignee", "to": "zxz" }]
```

令牌里同样是口语 patch → 一旦写口被调用即失败。

## 修复（第一性原理）

1. **`relationSchemaField` + 扩展 `shapePatch`**：凡 schema 为 `m2o/o2o/belongsTo` 的槽，按 `target` 集合 list 解析口语 → 写成 **`assigneeId`**（`relationColumn`）；解析失败则**不得**把口语字符串写入 FK。
2. **`users` 解析**：`username` / `nickname` / `email` + 通用 name/title/code。
3. **预览与过账一致**：`bindWritePatch` 在预览结构化路径调用 `shapePatch`；**`token.patch` 存 id**，**`displayPatch` 供右栏/抽屉仍显示 acee/zxz**。
4. **`createGate` 注入 `resolveConnections`**，预览阶段能连 4318/NocoBase 做只读 list 解析（不写业务行）。

## 改动文件

- `runtime/vendor-overlays/dsh-lan-assist/write.js` — 关系 patch 解析、预览 bind、users 查找
- `runtime/vendor-overlays/dsh-lan-assist/index.js` — `resolveConnections` 传入 gate
- `runtime/tests/write-patch-relation.test.mjs` — 单测证明
- 已 `cp` overlay → `~/.dsh-fde-x/vendor/dsh-lan-assist/`（现网加载份）

## 证明「acee/zxz → id、不再 bigint」

```bash
cd scene-39-personal-workstation
node --test runtime/tests/write-patch-relation.test.mjs
```

- `assignee: 'acee'` + mock `users:list` → **`assigneeId: '42'`**，无 `assignee` 字符串键
- `assignee: 'zxz'` + 空命中 → **patch 中无 assignee/assigneeId**（不会把 zxz 送进 bigint）

过账路径：`createNocoWrite.write` 现带 **`schemaFields`** 再跑同一 `shapePatch`。

## 未做

- 未点过账、未写业务库、未推远程、未重启 4318/5174（仅 overlay cp）。
