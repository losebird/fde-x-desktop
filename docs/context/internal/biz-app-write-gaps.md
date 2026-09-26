---
cursor:
  subagentId: "bc-4f0ddf01-acc7-5ae3-b12d-d2dfef82622e"
---

# 业务应用 · 增删改查审缺口（只读盘点）

范围：`scene-39-personal-workstation`（`losebird/fde-x-desktop`）+ Project Store 所列文档；对照 `docs/biz-write-eval.md`（写手测 W1–W30b）、`docs/biz-data-eval.md`（现查 362）、overlay（`runtime/vendor-overlays/dsh-lan-assist` + `runtime/biz/write-confirm.mjs` + `src/components/biz/RecordsPanel.tsx`）。家目录 `~/.dsh-fde-x`。未改代码。

手册/知识库：会话可连用；闸不认手册作写权威（一句）。

---

## 1. 结论（现网 vs 手测集）

| 类 | 现网大体能用 | 仍算没搞好 |
|---|---|---|
| **查** | 362 串行评测五类闸/现网条数全对齐；单跳枚举、已发布边、假边拒绝等主路径在评测集上已收。 | 自环/peer chip 页脚与库数不一致；复杂 hop（如「停用客户…未关工单」）只在单测过、未按小模型标准句重打现网；Qwen 出表后长工具环（`qwen-slow-runtime-plan`）未收。 |
| **增** | 左栏/口语 **预览** 能出令牌（闸 `preview`）；无 `source=workstation` 的写会被 `gate.js` `NEED_WORKSTATION_CONFIRM` 拒；无写动作 role 时 `recoverWriteIntent` 收成现查、不静默新建发票（`slots.js` + `write-hop-actions` 单测）。 | 右栏常 **有 pending 无 tbody**（`resolveConnectedKind`）；顶栏新建 pending 不稳（W2）；口语格绑定/空 patch/多令牌确认 **契约在盘、浏览器未手证**；历史上有 **无右栏确认仍写库**（W1）与 **操作单 `executeOperationLive` 带 workstation 绕过审计**；过账成功不拉官方表。 |
| **改** | 单行改行 **预览** 在评测设计内可走；闸 >100 行拒批量写（W30）在 `write.js` 有；`writeDest` 已与 `matchedWriteIdentity` 对齐（`write-lookup-key.test.mjs` 8/8）。 | 左右待确认错位、过期幽灵令牌、`changes:[]` 仍蓝条；取消后浮现历史可重开（W24）；picked 后再查仍可能 `plugin-leftover`；过账 0 行/假成功 **未浏览器手证**；成功后右表仍是预览行。 |
| **删** | 与改行同闸：预览令牌、批量上限、写需 workstation。 | 同改行：身份键落地未手证、成功后行仍可见、与改行预览切换时页脚/抽屉跟最新一跳不稳定（W14/W29 类）。 |
| **审** | 明确写口语（「都过一下」）可过审预览；「待审的费用报销」无写 role → 现查已在分支手打通过（`speech-action-authority-land`）。 | 批量待审页脚 N>100（W16）；短名打空 kind（W18/W27）；过账后状态与右表不一致；与改/删共用的确认栈问题未按 W 集结案。 |

**写路径总判：** 预览（查准后）在多数场景能到令牌；**人点右栏确认 → 库 → 表与审计一致** 这一整条，手测集 W1–W30b **没有一条在「重载核心 + 新 BFF 语义」下整包标过**；磁盘上多刀（三刀新建、`write-confirm` 投影、`write-lookup-key`、原话定动作）单测过，**现网手验缺口集中在增/改/删/审的确认与回读**。

---

## 2. 没搞好的条目

现象 / 证据 / 归类（四选一）。

### 查

| 现象 | 证据 | 归类 |
|---|---|---|
| 自环边：主侧行数对，点 peer chip 页脚仍像主侧或「总数未知」 | `close-remaining-eval-evidence.md` 员工 15 vs peer 80、部门 parent/children；`biz-data-eval.md` 自环备注 | **现网坏了**（展示层/peer total） |
| 「停用客户还有哪些没关的工单？」未作为现网过关句 | `small-model-biz-ops-plan.md` 验收 1；`enumHits`/`write-hop-actions` 单测过；land 写明当时核心未接通 | **落地未手验** |
| 表已出仍多轮 `biz_preview`、回合不收口 | `qwen-slow-runtime-plan.md`；与写无关但占「查」体验 | **待批未改**（方案已写，未点头落地） |

### 增

| 现象 | 证据 | 归类 |
|---|---|---|
| 左有新建预览，右 `biz_surfaces.row_count=1` 但 tbody 空 | `spoken-write-empty-panel.md`：`resolveConnectedKind('工单')` 在 catalog 非空时失败 → `applyPendingSheet` false | **现网坏了** |
| 一次新建连弹确认 / USED 后仍 hydrate 开抽屉 | `write-confirm-root-cause.md`、`write-confirm-live.md` session `0b9d3ea9`；`write-confirm-collapse.test.mjs` 过、文档标 **未现网手证** | **落地未手验**（曾 **现网坏了**） |
| 右栏点确认曾全红「请在右侧确认」 | `biz-write-interaction-audit.md` 旧 BFF 无 `source`；`gate.js` L441–451 与 `server.mjs` 现带 `workstation` | **落地未手验**（BFF 换新后无新过账 jsonl） |
| 预览过期/已取消仍像能点确认 | 闸清 `pendingWrite` 但 `pendingSheet` 可留 `preview_id`；`projectWriteConfirm` 依赖 GET 时 token 索引 | **现网坏了** |
| 顶栏「新建」预览切 Tab/重水合不稳 | `biz-write-interaction-audit.md` W2 | **现网坏了** |
| 口语外键/枚举一格：静默丢键、空 patch 仍发牌 | `create-write-fix-plan.md` 契约；`create-write-land.md` **未浏览器点过** | **落地未手验** |
| 无右栏确认仍 `biz_write` 成功、审计空 | W1 `7eaa79f6`：`biz-write-interaction-audit.md`；overlay 现拒无 source，**16:23 后无新穿透记录** | **现网坏了**（历史）+ **落地未手验**（修后） |
| 操作记录顶栏执行写带 `workstation`、不进 `biz_write_audit` | 同 audit §2 `executeOperationLive` | **没做**（产品路径仍在） |

### 改

| 现象 | 证据 | 归类 |
|---|---|---|
| 业务号列空、令牌为主键时，过账曾 0 行仍「成功」 | `write-lookup-key-plan.md` 根因；`write.js` `writeDest` 已 `if (!picked) return null` + 0 行失败；land **未手证** | **落地未手验** |
| 多行未 picked 发写预览：左有新令牌、右 pending 不换 | `biz-write-interaction-audit.md` §5 | **现网坏了** |
| 抽屉开时点对象 chip：表换、令牌仍上一跳 | W28c；audit §5 | **现网坏了** |
| 确认成功不拉库，琥珀条保留预览行 | audit §6；W4/W10 可选过账 | **现网坏了** |
| 现查 speech 带写词、无 `no` → 又落成改行预览 | audit §3；`recoverWriteIntent` 有写 role 仍会写 | **现网坏了**（边界） |

### 删

| 现象 | 证据 | 归类 |
|---|---|---|
| 删预览后业务系统行仍在（仅预览） | 设计如此；W12 过关前提是「未过账」— **预览路径未整包手测** | **落地未手验** |
| 删/改预览切换同会话 pending 跟不住最新（W14/W29） | `biz-write-eval.md`；audit W3/W9 部分成立 | **现网坏了**（部分场景） |
| 与改行共用 writeDest/确认栈问题 | 同上 | **落地未手验** |

### 审

| 现象 | 证据 | 归类 |
|---|---|---|
| 「待审的费用报销」曾被模型填成过审 | `speech-action-authority-plan.md`；**当前 `slots.js` L1994–2001 无写 role → 现查**；land 现网 Qwen 已打 | **落地未手验**（换核/换会话需复打） |
| 「待审报销单」等无 `biz_*` 概念 | W16/W18；图谱短名 | **现网坏了**（易空表/假 kind） |
| 批量过审 >100 未收窄 | W30/W16；闸逻辑在 `write.js` | **查+审边界**：闸应拒，**未现网手证** |
| 过审抽屉须原值→新值；空变更仍可能有令牌 | W16；audit §5 `changes:[]` | **现网坏了** |

### 横切（五类共用）

| 现象 | 证据 | 归类 |
|---|---|---|
| 取消预览后浮现历史可再开（W24） | `biz-session-sheet.ts` dismissed 仅 sessionStorage；GET pending 仍可推同一 `preview_id` | **现网坏了** |
| 确认失败关抽屉清 pending，不能同卡重试 | audit §7 | **现网坏了** |
| 审计 `source` 写成 `ai`、工具写不进审计 | audit §8 | **现网坏了** |
| leftover：问卡 picked 后再查同单号仍 `plugin-leftover` | audit §3；`session-round.js` leftover 分支仍在 | **现网坏了** |
| 过账后现查带 `no` 的设计已 landing；**16:23 后无新写回合 jsonl** | audit「现网还没有新的写 turn 证明」 | **落地未手验** |

---

## 3. 已能用的（各一句）

- **查：** 362 条结构化现查在 `biz-data-eval.md` 记下闸与现网全过；枚举/边/长名遮盖/无图边拒绝不靠手抄 notes。
- **增：** 口语或左栏 `biz_preview` 新建在闸能 `mint` 令牌，且 `commitWrite` 无 `workstation` 必拒（`gate.js`）。
- **改：** 带唯一单号/主键的改行预览能绑一行，`write-hop-actions` 与 `where-by-cell` 覆盖关系链改行而非父表倾倒。
- **删：** 单行删除预览与改行共用令牌与 `NEED_WORKSTATION_CONFIRM` 闸，批量 >100 设计为拒写。
- **审：** 口语命中唯一写动作且 `can` 含过审时仍走过审预览；无写动作的「待审+型」在现行 `recoverWriteIntent` 下默认现查（单测 + land 一次现网）。

---

## 4. 闸与评测「打假」摘要

| 对照 | 说明 |
|---|---|
| `biz-data-eval` vs 盘 | 362 分数来自 `biz-data-eval-rescore-serial-run.mjs` + `library-count`；与 `lookup.js`/`probe.js` hint 链一致；**不**代表写手测过。 |
| `biz-write-eval` vs 盘 | W 集要求预览令牌、左右同表、取消不复活、过账拉库；**多数 FAIL 点仍在 UI/BFF 投影层**（`RecordsPanel.applyPendingSheet`、`write-confirm.mjs`、`lastEmitted`），而非「闸完全不能 preview」。 |
| overlay 五块 | **preview/write**：`write.js` + `gate.js`；**slots/spoken**：`slots.js` `recoverWriteIntent`、`vocab/spoken.json`；**one-bind**：`relation-bind.js` `enumHits`；**原话定动作**：已在工作区 `slots.js` L1994–2001；**leftover**：`session-round.js` `plugin-leftover` 仍在，仅「wrote + `no`」路径在盘上有修。 |
| 现网手验状态 | `reload-recheck.md`（2026-09-26）：`connected: true`，overlay SHA 与 vendor 一致；**不等于** W 集或 create/write/lookup 三刀已点过确认。 |

---

*本文件路径：`internal/biz-app-write-gaps.md`（写入前不存在，已新建）。*
