---
cursor:
  subagentId: "bc-09ed3bb3-c06d-5f85-a476-52502131c2fb"
---

# lan-assist 闸 / 轮次 / 槽 — 增删改审交互审计（overlay）

**范围：** 只查因，不改产品。对照 `docs/biz-write-eval.md`、`docs/biz-write-w1-root-cause.md`、`docs/tool-call-abort-root-cause.md`、`internal/leftover-cancel-fix.md`。  
**代码：** `runtime/vendor-overlays/dsh-lan-assist/` 与 live `~/.dsh-fde-x/vendor/dsh-lan-assist/` — 2026-09-24 对 `gate.js` / `session-round.js` / `slots.js` / `tools.js` / `write.js` / `catalog.js` / `index.js` **无 diff**（现网即 overlay）。

**三层分工（第一性原理）：**

| 层 | 职责 | 关键状态 |
|---|---|---|
| **槽** `slots.js` + `write.js#preview` | 从 speech / 工具参数恢复 action、where、no；`normalizePlan` 不读 speech 发明 kind | `recoverWriteIntent` → `enrichStructuredSlots` → `plan.action` |
| **闸** `gate.js` | 预览进 `pendingWrite` + `pendingSheet`；写要 `source=workstation`；取消按 `preview_id` | `tokens`（`write.js`）、`openingId`、`mergePreviewLines` |
| **轮次** `session-round.js` + `tools.js#biz_preview` 尾钩 | 同轮 official/candidate；leftover 现查覆盖写轮 → `cancel` | `candidate` / `official` / `closedBy` |

---

## 六条人话路径（意图 → 工具 → 闸 → 轮次 → 下一步）

说明：**闸落成**指 `write.js#preview` → `recognize` → `previewStructured` 的 `action` + `preview_id` + `sheet`；**candidate** 指 `noteToolSheet` 写入的 `round.candidate`（多为 `result.sheet` 快照）。

### 1. 新建预览 → 人点确认 → 过账成功 → 秘书 wrote follow-up → 现查单号

| 步 | 意图 | 工具参数（典型） | 闸 / store | candidate / preview_id | follow-up / cancel | 还能现查 / 再写？ |
|---|---|---|---|---|---|---|
| A | 只要预览新建 | `biz_preview`：`action=新建`，`kind`=词表已连接型，`patch` 填槽，`speech` 原话 | `previewBiz` 非现查支路 → `pendingWrite` + `pendingSheet`，`packSheet` → `canWrite=true` | 本轮 `candidate`=写预览 sheet；`preview_id=pv_*`，TTL 90s | — | 可再预览（新 opening 或 merge，见洞 L6） |
| B | 右侧确认 | BFF `biz/write`，`source=workstation`，`preview_id` | `commitWrite` → `gate.write` → `postWrite`；成功清 `pendingWrite`，`pendingSheet` 可能缩 `remainRows` | — | `gate.js` 509–521：`followup.roundClose='wrote'`，`briefFollowup({ kind:'wrote' })` | 令牌已 USED |
| C | 秘书注入 | （无工具）plugin `user/message` | `deliverFollowup`：`closeRound(sid,'wrote')` 清 candidate | 写轮 candidate 已空 | 开启 **新 turn** | — |
| D | 按回执现查 | `biz_preview`：`action=现查`，`kind`+`no`=回执主键 | **已修：** `recoverWriteIntent` 见 `no` 则保持现查；`explicitLiveLookupSupersedesWrite` 同轮覆盖 speech 误绑写预览 | candidate → 现查 sheet，**无** `preview_id` | 不应再 leftover cancel（相对 W1/abort 文档） | 现查可继续；写需新预览 |

**仍可能复现的偏差（overlay 内）：** 若 D 步 **不传 `no` 槽**、只靠 speech 带数字，或模型 **`action` 填错写动作** 且 speech 仍含「新建/改行」类口语槽，见洞 L1、L2。右栏页脚「总数未知」见洞 L8（`packSheet` 写预览无 `hitTotalState`）。

### 2. 新建预览 → 令牌过期 → 人再点确认

| 步 | 意图 | 工具 / UI | 闸 | 用户可见 |
|---|---|---|---|---|
| A | 同路径 1 预览 | — | `write.js` 19：`PREVIEW_TTL_MS=90_000`；token 在 `tokens` Map | 右抽屉「待确认」 |
| B | 等 >90s 再点确认 | `commitWrite` / `write()` | `write.js` 1565：`EXPIRED`；`gate.js` 494–497：失败时 **整包** `pendingWrite=null` | 红条应为闸 hint（BFF 透传见 `block-model-write`；与 overlay 无关） |
| C | 不重新预览再点 | 同上 | token 仍 EXPIRED / 已从 `livePendingWrite` 摘掉 | 确认失败 |
| D | 再预览后确认 | 新 `biz_preview` | 新 `pv_*` | 可过账 |

**overlay 洞：** `livePendingWrite` 过期会清 **`pendingWrite`**，但 **`pendingSheet` 仍可能带旧 `preview_id` / `canWrite`**（`gate.js` 85–110 写预览盖表逻辑不校验 token TTL），见洞 L3。用户可能在右栏看到「可确认」而闸已拒写。

### 3. 新建预览 → 模型自己 `biz_write`（无 `source=workstation`）

| 步 | 工具 | 闸 |
|---|---|---|
| 模型 `biz_write(preview_id)` | `gate.js` 422–433：`source !== 'workstation'` → `NEED_WORKSTATION_CONFIRM`，hint「请在右侧确认过账」 | **写库不发生** |

**轮次：** 不改变 candidate；**可复现**为模型侧看到拒写 JSON，不是 silent 成功（W1 历史问题已在闸层挡掉）。  
**注意：** 直连 `POST /lan-assist/write` 无 `source` 同样被拒（`http.js` 326–330 → `commitWrite`）。

### 4. 改行 / 删除 / 过审预览 → 确认 / 取消 / 再预览

| 分支 | 意图 | 闸 | cancel / 下一步 |
|---|---|---|---|
| 确认 | 过账 | `commitWrite` 批量 `lines[]` 同 `preview_id` 或 opening 内多行 | wrote follow-up；可再预览 |
| 取消 | 关抽屉 | `dismissWrite`：`gate.js` 525–589 | 单 `preview_id` 时从 bundle 摘行或恢复 `listBeforeWrite` / `remainRows`；**W25** 依赖 `stashListBeforeWrite` 146–158 |
| 再预览换动作 | 改→删 | `sameWriteAction` false → 新 `openingId`，`replaced=true`（`gate.js` 358–391） | 右栏应跟 **最新** action（W14/W29） |
| 同 opening 同 action 改不同字段 | W9 | `mergePreviewLines`（`gate.js` 14–23）可能 **多枚** `preview_id` 同 bundle | 一次 `commitWrite` 可 **顺序写多 token**（见洞 L6） |

**洞 L4：** 多行命中列表上未 `picked` 就发写预览时，`shouldKeepPopulatedListSheet` 为 true 则 **`previewBiz` 早退不写 store**（`gate.js` 333–337），模型拿到新 `preview_id` 但右栏仍旧 pending。

### 5. 同轮 leftover：写预览 candidate + 随后现查

| 场景 | 条件 | `session-round.js` | cancel |
|---|---|---|---|
| **speech 误绑新建** + 同轮回执现查 | 工具 `action=现查`+`no`，第一轮 candidate 为写预览无 `picked` | `explicitLiveLookupSupersedesWrite` 223–226：**覆盖** candidate，不 cancel | 否（leftover-fix） |
| **picked 命中集** + 同号现查 | 问卡选行后 `picked:true` 改行预览，再 `action=现查` 同一 `no` | `leftoverQueryCoveringWrite` 88–99：`waitingHit` 或 nos 重叠 → **leftover** | **是** `tools.js` 231–235 |
| **多行 ambiguous** + 现查 | `prevRows>1`，无 token，再现查 | 同上 leftover | **是** |
| 右栏写预览进 pending | 有 token 的写预览 | `biz-hit-set-pick-cancel.ts` 7–14：无 changes、非 picked **不** `records-cancel` | 仅 speech 空变更预览不掐 Ask |

**可复现洞 L5：** 过审/改行 **picked 后** 秘书或模型 **同轮回执现查**，仍会 `plugin-leftover` cancel 并行 read/traces（手测「过账后查单号」与「问卡后再查」交界）。

### 6. `recoverWriteIntent`：userSpeech 含写词、工具是现查、有/无 `no`

| 工具参数 | userSpeech | 结果（`slots.js` 1763–1805） |
|---|---|---|
| `action=现查` + **`no` 非空** | 秘书 wrote 文案（含「改上/预览/写」等） | **1775–1778 早退**：强制 `action=现查`，删 patch |
| `action=现查`，**无 `no`** | 含写动作口语、**不含** 现查 role 槽 | `spokenWriteAction(speech)` 可能把 action 提成 **新建/改行/…**（1794–1796） |
| `action=现查`，无 `no` | userSpeech 含 **现查** role 槽且不含写动作 | 1781–1790：强制现查 |
| `action=改行` 等 | userSpeech 只有现查 | 1781–1790：可 **压回现查** |

**可复现 L1：** 现查 **不带 `no` 槽**，speech / userSpeech 仍带 **新建/改行** 口语（例如模型把 `speech` 设成用户原句而 `action=现查`），闸可能落成 **写预览** → 同轮再现查时行为依赖是否已有 candidate（误新建 + leftover 或 supersede）。

**可复现 L2：** 工具 **`action=现查` + `no=回执`** 已修；若模型只把单号放在 **`where` / speech** 而不填 **`no` 参数**，早退不触发，仍可能 speech 升 action。

---

## 可复现洞清单（文件 + 行号 + 触发 + 用户可见后果）

| ID | 文件:行 | 触发条件 | 用户可见后果 |
|---|---|---|---|
| **L1** | `slots.js:1775–1796` | `biz_preview`：`action=现查`，**省略 `no`**，speech/userSpeech 仍含词表 **写动作** 口语 | 左栏工具意图是现查，闸落成 **新建/改行/…** 预览 + `preview_id`；右抽屉待确认；同轮再现查可能 supersede 或 leftover cancel（W1/abort 同类） |
| **L2** | `slots.js:1775–1778` + `write.js:1415–1438` | 现查意图但单号只在 **speech** 或 enrich 后才进 plan，**工具 `no` 空** | 同 L1；`recoverWriteIntent` 早退不生效 |
| **L3** | `gate.js:46–63` vs `85–110`；`write.js:19` | 预览后 **>90s**；`livePendingWrite` 清 `pendingWrite`，**未**清 `pendingSheet.preview_id` | 右栏可能仍显示 **待确认 / canWrite**，点击后 **EXPIRED**（W2）；与 W1 过期链一致 |
| **L4** | `gate.js:177–245` `shouldKeepPopulatedListSheet`；`333–337` | 多行命中表上 **未 picked** 再发写预览（或 connector 空表刷入） | SSE/模型结果 **有新令牌**，store **未换 pending**；左右 pending 不一致（W28/W21 边界） |
| **L5** | `session-round.js:78–100` `229–231`；`tools.js:229–235` | 同轮 **picked/问卡改行/过审** candidate 后，`biz_preview` **现查** 且 `picked≠true`、单号与候选集重叠 | **`tool call aborted`**（Harness 记 `user`）；现查/ read 同毫秒失败（`tool-call-abort-root-cause` §2.2） |
| **L6** | `gate.js:14–23` `358–383` `435–464`；`catalog.js:312` | 同一 opening、同一 **action+kind+no**，**不同 patch 字段** 多次预览 | bundle **多枚** `preview_id`；一次右侧确认 **顺序 commit 多 token**，与「同一笔改单一张预览卡」文案冲突（W9） |
| **L7** | `write.js:1635–1668` | 确认写：`token.used=true` **先于** `postWrite` 成功 | 业务 **超时/失败** 后令牌已 USED；需 **全新预览**，不能原令牌重试 |
| **L8** | `write.js:74–225` `packSheet` | 任意 **写** 预览（含新建 1 行） | 右页脚 **「总数未知」**（W1 §4）；非 connector 失败 |
| **L9** | `gate.js:494–497` | 过账失败（EXPIRED / WRITE_FAILED 等）且非 consumed | **整包** `pendingWrite` 清空；右表依赖 BFF/RecordsPanel dismiss（产品层）；overlay  alone 时 drawer 状态可能滞后 |
| **L10** | `session-round.js:173–177` `index.js:307–308` | turn 正常结束 | 未 cancel 的 **写预览 candidate** 升为 **official**；下轮 UI「官方表」可能仍是 **上一跳写预览** 直到新工具覆盖 |
| **L11** | `gate.js:40–44` `358–361` | 连续预览 **不同 action**（改行→删除） | `replaced=true` 清 remain；一般符合 W14；若 **mergeWindow** + 误判 `sameAct` 会并 opening（少见，需同 action 字符串） |
| **L12** | `tools.js:222–223` | 模型不传 `speech`，会话最后一条是 **plugin wrote follow-up** | `speech`/`userSpeech` 同为秘书长文；依赖 `pickHopSpeech` + `recoverWriteIntent` 现查槽；若再叠加 L1（无 `no`）仍误绑 |

**已缓解（leftover-fix，仍属 overlay 行为说明，非新方案）：**

- `action=现查` + **`no` 槽** + wrote userSpeech → 不再升写动作（`slots.js:1775–1778`）。
- 同轮 **显式现查 lookup** 覆盖 speech 误绑写 preview → 不 leftover cancel（`session-round.js:67–76` `223–226`）。
- 过账 follow-up 前 `closeRound('wrote')`（`index.js:90–93` `gate.js:513`）。
- 模型 `biz_write` 无 workstation → 拒写（`gate.js:422–433`）。

---

## 与手测集映射（仅判定锚点）

| 编号 | 主要 overlay 风险 |
|---|---|
| W1/W4 | L3 过期 + 历史双通道写（闸已挡模型写）；follow-up 后查单号 → L1/L2 若模型漏 `no` |
| W3/W9/W29 | L6 多 token；L11 换 action 应用新 opening |
| W14/W19 | dismiss + 新预览；L5 picked 后再查 |
| W21–W23 | L4 keep list；picked leftover L5 |
| W24–W25 | `dismissWrite` + `listBeforeWrite`；L3 过期 ghost pending |
| W30 | 无 token / batch>100 在 `write.js` 预览阶段拒 |

---

## 建议复现顺序（不改产品，仅观测）

1. 路径 3：预览后 DSH 调 `biz_write` → 应只见 `NEED_WORKSTATION_CONFIRM`。  
2. 路径 2：预览后等待 >90s，看 `pendingSheet` 是否仍带 `preview_id`（L3）。  
3. 路径 6 负例：过账 follow-up 后 `biz_preview(现查, kind, no=回执)` → 应不 abort；再去掉 **`no` 参数** 对比 L1。  
4. 路径 5：问卡 **picked 改行** 后同轮回执现查 → 观察 L5 cancel。  
5. W9：同单同 action 改 **两个字段** 两次预览 → 看 bundle 行数与一次确认写几次（L6）。

---

## 目录变更

- **新建** `internal/write-audit-overlay.md`（本文件）。
