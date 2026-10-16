---
cursor:
  subagentId: "bc-a47e7a35-04d1-59c4-84bf-4ceebca26f22"
---

# 口语值 → patch / where / token：写路径绑定审计（只查因）

对照 `docs/biz-write-eval.md`、`docs/biz-write-interaction-audit.md`、`internal/handler-bigint-fix.md`。代码基线：`runtime/vendor-overlays/dsh-lan-assist/`（与现网 vendor 同份）。**未改产品。**

## 写路径总览

| 阶段 | 入口 | patch 绑定 | where / 行定位 | token.patch |
|---|---|---|---|---|
| 左栏 `biz_preview` | `tools.js` → `gate.previewBiz` → `createGate.preview` | `recoverWriteIntent` / 模型 `patch` → `previewStructured`：`bindPatchEnums` + `bindWritePatch`→`shapePatch` | `enrichStructuredSlots` / `attachSpeechIdentity` / 模型 `where` → `lookup.probeOne`：`bindWhereKeys` + `bindClueEnums` | `finishStructured` / 新建：`writePatch`（失败时退回 `displayPatch`） |
| 右栏行内/顶栏 | `RecordsPanel.runPreview` → BFF `translateBizIntent`（`input`→`patch`）→ 同上 | 同上；`speech` 常为 ``${action}${kind}``，不靠 `rewritePatch` | `picked` + `no` 来自行 `sheetRowBusinessNo`；hop 带 `where`/`from` | 同左栏 |
| 过账 | `commitWrite` → `createGate.write` → `createNocoWrite.write` | 改行/新建：再跑 `shapePatch`；**过审**：不走 `shapePatch` | 非新建：`probe(token)` 用 `token.no`；`writeDest` 用 `ticketField` + `look` | 改行/新建/过审 batch 单条：预览时写入的 `token.patch` |

**预览与过账对齐（关系 m2o）**：`write.js` 已在预览侧调用 `bindWritePatch`/`shapePatch`（`handler-bigint-fix.md`）。下列洞是**仍会**把口语送进非文本列，或预览/过账/现查不一致之处。

---

## 1. 关系 m2o / o2o / belongsTo / m2m

| # | 文件:行 | 触发口语 / 条件 | 打到库的键·类型 | 用户可见后果 |
|---|---|---|---|---|
| R1 | `write.js:1394-1419` | 预览时 `resolveConnections` 无 `baseUrl`、无 token、或 `shapePatch` 抛错 | `token.patch` 保留 **displayPatch**（口语字符串）→ 过账 `shapePatch` 再试 | 右栏显示口语名；过账仍可能 `invalid input syntax for type bigint`（与 Ace 处理人同类） |
| R2 | `write.js:1971-1984` | schema `interface` 为 m2o/o2o/belongsTo，但列名 `createdBy` / `updatedBy` | `out[createdBy]=口语用户名`（`relationSchemaField` 故意跳过） | PG bigint / users FK 报错；或静默不写该列 |
| R3 | `write.js:2033-2042` | 列未标 m2o，仅靠词表「关联列」/`kindForFkName` 猜 FK；解析失败 | `out[name]=口语` 或无 `*Id` 键 | 口语进整型 FK；或字段被丢弃用户以为会写上 |
| R4 | `write.js:2013-2023` | m2o 口语；`users:list`（或 target 表）**0 条或多条** | 不写 `assigneeId`（预览 token 可能无该字段） | 预览像填了处理人，过账少字段或改行 `patchApplied` 判失败 |
| R5 | `write.js:2017-2019` | 口语实为 **数字 id 字符串** | 直接 `out[writeKey]=value` | 一般正确；若列实为 snowflake 而口语非纯数字仍走 R4 |
| R6 | （缺口）`relationSchemaField` 不覆盖 **m2m / belongsToMany / o2m** | 模型/行内 `patch` 写 `tags: ['华东']` 等 | 数组或字符串原样进关联列 | NocoBase 校验失败或脏关联 |
| R7 | `lookup.js:1169-1186` + `where-pass.js:430-450` | 现查/写前定位：`where` 的 keys 已 `resolveShapeKey` 到 **m2o 列名**，values 为 **客户名/人名** | `filter` 里 `{ customerId: '恒通' }` 类 | 查不到行；若 DB 把 filter 当 bigint 则直接 SQL 错 |
| R8 | `slots.js:1259-1262` | `attachSpeechIdentity`：无单号、有 leftover 短名 | `plan.no` / `step.no` = 口语公司名 | 走 `nameCluePath` 名称 `$includes`（文本列），**不**进 bigint；但若模型同时把口语塞进 `where` 的 FK 键 → R7 |
| R9 | `gate.js:644-656` | 行内 hop：`related.id` 来自 `relatedHopId` | 若行上 FK 是口语展示、非 id | hop 查不到子表，预览 NOT_FOUND |
| R10 | `src/lib/biz-sheet-display.ts:67-77` | 行内改行：`pickSheetRowPatch` 把 **关联展示对象** 当 patch 值 | `assignee: { id, nickname }` → `shapePatch` 里 `String(value)` | 解析失败则字段不进 patch；或异常字符串 |

**预览 vs 过账（关系）**：改行/新建在连接正常时两侧都走 `shapePatch`（预览 `bindWritePatch`，过账 `createNocoWrite.write`）。R1/R4 会导致 **token 与过账输入不一致**（token 已口语或缺键）。

---

## 2. 枚举 / 状态 / 优先级

| # | 文件:行 | 触发口语 / 条件 | 打到库的键·类型 | 用户可见后果 |
|---|---|---|---|---|
| E1 | `write.js:711-713` + `1358-1368` + `2174-2181` | 动作 **过审**（单条/批量） | `status`/`stage` 等列 ← **`'已过'` 硬编码中文**（非 schema code） | 库若存 `approved`/`1` 等 code：过账失败或状态未变；抽屉仍显示「待审→已过」 |
| E2 | `write.js:1932-1933` | 过账 `createNocoWrite` | 同上，`spec.to \|\| '已过'` | 与 E1 同 |
| E3 | `plan.js:173-191` | **改行/新建** `bindPatchEnums` | 仅 **全等** `label===want` 或 `code===want` | 口语「高优」「待审」等略说法不进 code，原样进枚举列 |
| E4 | `slots.js:1721-1757` vs `plan.js:184-188` | 左栏 `rewritePatch` 从「…改成 **高**」抽值 | patch 先带 **前缀匹配的口语**；`bindPatchEnums` 不认前缀 | 预览 token 可能是 label 串；过账 enum 列报错或无效值 |
| E5 | `write.js:1068-1070` | **过审/删除** 预览 | **不调用** `bindPatchEnums` / `bindWritePatch` | 过审不经过 patch 枚举绑定（见 E1）；删除无 patch |
| E6 | `lookup.js:1169-1186` | 现查 `where`：`bindClueEnums` | 枚举列 **label→code**（按 term.keys 命中 field） | 现查过滤较稳；与 E1 过审写入 code 不一致 |
| E7 | `write.js:156-164` `packSheet` | 过审预览 `changePatch` 用 `spec.to` / `nextStatus` | 抽屉 **原值→新值** 展示中文「已过」 | UI 与真实 code 脱节；不等于库已改 |
| E8 | 批量过审 `write.js:1332-1344` | `token.patch` 为 **undefined** | 过账靠每行 `probe` + E1/E2 写状态 | 批量与单条同一套硬编码「已过」 |

---

## 3. 数字 / bigint / 百分比 / 金额

| # | 文件:行 | 触发口语 / 条件 | 打到库的键·类型 | 用户可见后果 |
|---|---|---|---|---|
| N1 | `write.js:2042` | 任意非关系、非 `*Id` 键 | `out[name]=value` **无 interface 分支** | 「三千」「10%」「一百块」等字符串进 `integer`/`double`/`percent` → PG 报错 |
| N2 | `write.js:2017-2018` | 纯数字字符串进 m2o | 当 **id** 写入 FK | 口语本是单号/工号但落在 m2o 列 → 错绑或 FK 不存在 |
| N3 | `lookup.js:1716-1720` | `identityFilterKeys` 跳过 number/percent 等 | 口语数字 **不会**作为 ticket 等号过滤 | 定位走名称路径；不直接 bigint 查 id 列（偏安全） |
| N4 | `write.js:509` `hideDisplayKey` | 展示层隐藏长数字 id | 与绑定无关 | 用户看不见 id，仍可能在 patch 里口语填人名（R1） |

---

## 4. 日期 / 布尔

| # | 文件:行 | 触发口语 / 条件 | 打到库的键·类型 | 用户可见后果 |
|---|---|---|---|---|
| D1 | `write.js:2042` | patch 里「明天」「下周五」「是/否」 | `date`/`boolean` 列原样字符串 | 类型错误或写入失败 |
| D2 | `where-pass.js:315-364` | where 仅 **四位年** 展开为 `dateAfter`/`dateBefore` | 日期列范围查询 | 口语「上个月」不进 unless 词表 clue；**现查**侧 |
| D3 | `src/lib/biz-sheet-display.ts:169-171` | 行内展示布尔为「是/否」 | 若用户改单元格为中文再 `pickSheetRowPatch` | patch 带「是」→ D1 |

---

## 5. 删除 / 过审的 where 与行键

| # | 文件:行 | 触发口语 / 条件 | 打到库的键·类型 | 用户可见后果 |
|---|---|---|---|---|
| W1 | `write.js:2199-2224` `writeDest` | 删除/改行/过账定位：`look = spec.line \|\| spec.no` | `filter: { [ticketField]: look }` | `look` 为 **口语短名**（`attachSpeechIdentity` 写入 `plan.no`）且 `looksLikeRef` 为 false 时，**不会**走 `nocobasePath` 等号；依赖先前 `probe` 指纹。token.no 若仍是口语 → 更新 0 行或错行 |
| W2 | `slots.js:1259-1262` | 写动作 + leftover 名、无 ticket | `packed.no = name` | 与 W1 联动：单号槽当 **名称** 用 |
| W3 | `lookup.js:1759-1761` | `looksLikeRef(look)` 为 false | 列清单路径，不用口语当 id filter | 删除预览若已命中一行且 `token.no` 来自 `row.no` 则安全；**仅口语未命中行**时危险 |
| W4 | `where-pass.js:397-417` | 模型 `where` keys 中文→schema；**values 不解析 FK** | 见 R7 | 批量过审「待审的费用报销」：枚举 values 有 `bindClueEnums`；**客户 id 类**无 |
| W5 | `write.js:1673-1676` | 非新建过账前 `probe(token)` | 用 token 内 `no`/`kind` | token.no 错误则 STALE/NOT_FOUND，或误删/误审 |

---

## 6. 行内预览 vs 左栏说话（shapePatch / 枚举 / patch 来源）

| # | 路径 | 是否走 `shapePatch` | 洞 |
|---|---|---|---|
| P1 | 左栏：`speech` 完整 + `recoverWriteIntent` + `rewritePatch` | 是（`bindWritePatch`） | E4；模型 `patch` 中文键被 `schemaHasField` 滤掉 → `NO_PATCH` |
| P2 | 右栏：`speech: \`${action}${kind}\``（`RecordsPanel.tsx:1297`） | **是**（靠 `input`/`patch`，不靠 speech） | 枚举/关系取决于 `pickSheetRowPatch` 原始值（R10、D3） |
| P3 | `gate.js:268-283` 问卡选中行合并 `pending.patch` / `changes` | 是 | 合并的是 **展示 patch**；若当时预览未 `shapePatch` 成功，口语进 token |
| P4 | BFF `biz.mjs:286-288` | `改行/新建`：`patch: input` | 与闸一致；**过审/删除**不带 input patch |
| P5 | `tools.js:207` 说明键为列名 | 模型常填中文标题 | 键被 `write.js:1071-1072` 丢弃 → 无字段可改 |

---

## 7. 与「处理人 bigint」修复的关系

| 项 | 状态 |
|---|---|
| `relationSchemaField` + `shapePatch` + 预览 `bindWritePatch`（`write.js:1068-1077, 1394-1416, 1995-2044`） | 磁盘已做；`assignee`+`target:users` → `assigneeId` |
| 仍可能复现 Ace 场景 | **R1**（预览未连上 NocoBase）、**R2**（`createdBy`）、**R4**（用户不存在/重名）、行内 **R10** |
| `handler-bigint-fix.md` 称仅 cp overlay | 本审计不验证现网进程是否加载新 overlay |

---

## 8. 按动作速查

| 动作 | 口语进 patch 的主通道 | 最危险的非文本列洞 |
|---|---|---|
| **新建** | 模型/`input`/`rewritePatch` → `bindPatchEnums` → `bindWritePatch` | R1 R2 R6 N1 D1 |
| **改行** | 同上 + 行内 `input` | R1 R4 R10 E3 E4 |
| **删除** | 无 patch；`token.no` + `writeDest` filter | W1 W2（no 槽口语） |
| **过审** | **无** `shapePatch`；`status`←`已过` 中文 | **E1 E2**（枚举 code 列） |
| **批量** 删/过审 | `nos[]`；过审无 patch | E8 W5 |

---

## 9. 建议手测锚点（对应 biz-write-eval）

- **W6/W7**：改枚举/关系字段，左栏与行内各预览一次，看 `token.patch` 是否为 code/id（需日志或 trace，本报告未跑 live）。
- **W16/W20**：过审后 DB 状态 code 是否与「已过」一致。
- **W21**：短名进 `plan.no` 与 `where` FK 混用时是否 R7。
- Ace 复现：新建工单「处理人是 acee」→ 若仍 bigint，先判 R1（预览阶段 `bindWritePatch` 是否退回 display）。

---

*子 agent `bc-a47e7a35-04d1-59c4-84bf-4ceebca26f22` · 只读代码审计，无产品/进程改动。*
