---
cursor:
  subagentId: "bc-11670e2d-ae92-523f-9fa8-ddceed995637"
---

# 小模型业务格子落地审阅（`5c8e2230`）

对照：[small-model-biz-ops-plan.md](small-model-biz-ops-plan.md)、[expense-pending-unbound-plan.md](expense-pending-unbound-plan.md)、[small-model-biz-ops-land.md](small-model-biz-ops-land.md)。审阅对象：工作台 `cursor/one-bind-biz-path-1410` @ `5c8e223088f99218d7420ac79e67e4e355bf16d5`（只读 `git show` / 工作区，未改产品）。

## 结论

**实现层：有条件收下。** 现查 / enrich / lookup / write 已共用 `enumHits` 与按格 `bindWhereRelationTerms`；`WHERE_UNBOUND` 闸与外键「只丢一格」仍在；`speakLookup` 先读 `hint`，`NO_CONNECTOR` 才说「没连业务」；`5c8e2230` 补上口语 seed 落到已点名型的 enrich 路径，与 land 最后一刀描述一致。聚焦单测（`where-by-cell`、`slots-enrich`、`write-hop-actions`）在本机 **85/85 通过**。

**不认「方案已过关 / land 可点头验收」。** [small-model-biz-ops-plan.md](small-model-biz-ops-plan.md) 明确：验收句 1「停用客户还有哪些没关的工单？」**Qwen 新会话现网一遍过**；1 不过 = 本篇没过。当前仅有单测与 enrich 夹具，land 自述现网 SIGKILL、4318 未接通——**主验收未打**。此外包内 `spoken.json` 对状态类口语仍用 `keys: ["status","state","stage"]` 宽键，多型同句时误绑风险在方案里已预警，需现网或更贴近生产的夹具继续盯。

---

## 必答六问

### 1. 产品代码有没有写死停用 / 暂停合作 / inactive / 待审 / 客户 / 工单？

**绑定路径（where / enrich / lookup）：没有在 JS 里写死「停用→暂停合作 / inactive」或「待审→某张表」。** 枚举绑定走 `enumHits`（schema code/label + **该字段**词表 clue），包级同义在 `runtime/vendor-overlays/dsh-lan-assist/vocab/spoken.json`（经 `vocab/spoken.js` 并入），符合「词表 + schema、逻辑不写死业务专名」。

**仍存在的非绑定字面量（展示 / 提示 / 字段名本地化，不是 where 特赦）：**

| 位置 | 内容 | 性质 |
|------|------|------|
| `lookup.js` `STATUS_SPEAK` / `pickStatus` | `pending/open/submitted` →「待审」等 | 查回结果状态**口播** |
| `probe.js` `speakLookup` | 成功路径用 `/待审|pending|open/` 组织话术 | 同上 |
| `probe.js` `looksLikeChase` 等 | 含「待审」「过账」等 | 意图探测，非 biz where |
| `write.js` `FIELD_SPEAK` | `customer`↔「客户」等 | 列名展示 |
| `catalog.js` | 提示文案出现「工单」「客户」 | 模型说明，非执行绑定 |

**测试夹具**大量「客户 / 工单 / 停用 / 待审」——允许。

**结论：** 无「写死某业务型 + 某枚举」的捷径；包词表 seed 含「停用 / inactive / 待审」是设计内权威，不是 lookup 里第二套映射。

---

### 2. 口语行 clues 落到「已点名的型」会不会把「停用」绑到不该绑的字段？`enumHits` 是否仍按字段？

**`enumHits` 仍按字段：** 入参是 `field` + `spoken` + `vocab`；词表侧只用 `cluesForField(field, bag)`（clue 的 keys 须落在该字段的 name/title 上）。`bindClueEnums` / `bindWhereRelationTerms` 的 enum 分支、`resolveClueValuesForField` 均对**命中列**调用 `enumHits`。

**`5c8e2230` enrich 新增环**（`clueHitsInSpeech`）：对每个 **已 bound 的 kind**，遍历其 schema 字段；仅当 `fieldMatchesClueKeys(field, clue)` 且口语行 `findClueHit` 命中后，对该 **field** 调 `enumHits`；`hits.length === 1` 才 `pushCandidate(..., kind)`。

**误绑风险（未消除，与方案风险段一致）：** 包 seed 的 clue 键是 `status/state/stage` 通配。同一句里若多个已点名型都有状态列，且各自 schema 上对「停用」都能 **唯一** 落成选项，理论上可各绑一格——靠「唯一才绑」和现场 enum 差异收窄。单测「停用客户…工单」靠客户 enum 有 `inactive`、工单 enum 无对应项，只落在客户；**不能替代现网 Qwen 全句验收**。

---

### 3. 外键未绑是否仍禁止整表 list？`WHERE_UNBOUND` 闸还在吗？

**在。**

- `lookup.js`：`where.length && !clues.terms.length` → `error: 'WHERE_UNBOUND'`，`hint: unboundWhereSpeak(...)`（约 697–704 行）。
- 外键：`bindWhereRelationTerms` 对 relation 格解析失败时 `continue`（丢该 term），不清空其它已成形 term（约 287–288 行）。
- 单测：`a failed foreign key does not dump an unfiltered list`（无 list 请求）、`a failed foreign key unbinds only that cell`（保留 status 筛选、去掉失败 FK）。

闸语义仍为「声称要带 where、成形 term 为 0」才拦，不是「任一格外键失败即整句 WHERE_UNBOUND」。

---

### 4. `speakLookup` / overlay `probe.js` 是否真会被运行时加载？

**会，不是孤份拷贝。**

- `write.js`：`import { speakLookup } from './probe.js'`（overlay 内相对路径）。
- `dsh-core.mjs`：`linkReadablePlugin` → `applyVendorOverlay` 把 `runtime/vendor-overlays/dsh-lan-assist` **覆盖复制**到 `~/.dsh-fde-x/vendor/dsh-lan-assist`，再链到 profile `node_modules`（约 466–496、505–507 行）。
- IM 适配读的是 profile 里的 `dsh-lan-assist`（`adapters.mjs`）。

前提：核心按 FDE 路径拉起并完成 profile 链接；未改家目录（仍为 `~/.dsh-fde-x`）。若长期不重启核心，运行中仍是旧 vendor——land 已说明未重载，属运维缺口而非「只改了仓库拷贝」。

---

### 5. 自称删掉的旧否决分支是否还在？有没有第三套猜 terms？

**主路径已收成一套：**

- `bindClueEnums` → 按 term 的 key 找 field → `enumHits`（`lookup.js` 1207–1223）。
- `resolveClueValuesForField` 已去掉「仅 schema 直比 + clue values 第二套」，改为 `enumHits`（`slots.js`）。
- `slots.js` 用 `vocab/spoken.js` 的 `vocabWithSpoken`，不再内联第二份 spoken 副本。

**仍保留、但不是「lookup 再猜 terms」：**

- `lookup.js` 里 `guessTicketFields`：资源字段名启发式，与 where term 绑定无关。
- `enum-clues.js`：`expandNegatedClosedValues` 从 schema 闭集枚举扩 `not`——与 plan 中「没关 / 未关闭」一类一致，不是空 terms 回填。

未发现「待审特赦 / 停用特赦」或「terms 空了再猜一轮」的并行绑定。

**边角：** `probe.js` 在 `hint` 为空且 `error === 'WHERE_UNBOUND'` 时仍有一句通用 fallback「筛选条件没对上词表列名…」（约 92–93 行）；正常 lookup 路径应带 `unboundWhereSpeak` 的 `hint`，fallback 仅兜底。

---

### 6. 有没有走捷径（replay 当正路、特赦某一句、只改 hint）？

| 项 | 结论 |
|----|------|
| replay | `write.js` 仍保留 `spec.replay === true` 调试恢复分支，**未**升为产品说明或 catalog 正路；与 plan「调试口可留」一致。 |
| 特赦 | 未见待审 / 停用 / Qwen 专用 where 旁路。 |
| 只改 hint | `WHERE_UNBOUND` 的 `hint` 来自 `unboundWhereSpeak`（按格）；`speakLookup` 优先返回 `found.hint`。hop 第一跳失败时 `missKind` 在 `WHERE_UNBOUND` 时用 `start.kind`（`write.js` 1223），避免整句冒充子型未绑——属行为修正，不单改文案。 |

---

## 与 land 文档的偏差

1. **提交范围：** `5c8e2230` 仅 `slots.js` + `slots-enrich.test.mjs`；lookup / relation-bind / probe / write 等大块在 `474a4ae0`。land 表「改了哪些文件」描述的是**分支累计**，不是单 commit，叙述易误读为「最后一刀全包」。
2. **验收：** land「结论」写单测过、现网未打——与 plan「1 不过 = 没过」一致；**审阅不认验收过关**。
3. **失败测试：** land 所列 `leftover-catalog-refuse`、`records-align`、`write-name-identity` 未纳入本审复跑；不推翻上述绑定结论。

---

## 建议（不改代码，仅认账）

- **可认：** 分支实现方向与两份 plan 对齐；`5c8e2230` enrich 口语 seed 缺口已补；聚焦单测绿。
- **不认：** plan 级「小模型过关」直至 Qwen 现网验收句 1（及 2–5 抽检）完成。
- **下一验：** 核心恢复后原话 `biz_preview`（禁 replay）；盯多型同句 + 宽 `status` seed 是否误绑工单状态列。

---

*审阅方式：`git show 5c8e2230`、`git log` / `git diff 474a4ae0..5c8e2230`、overlay 源文件只读；`node --test` 上述三文件 85 项。*
