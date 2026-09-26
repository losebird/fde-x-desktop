---
cursor:
  subagentId: "bc-178061c7-87ea-5182-a588-108e38bb9ce9"
---

# 原话定动作：只读审阅

对照 [方案](speech-action-authority-plan.md)、[落地说明](speech-action-authority-land.md)。代码只读：`scene-39-personal-workstation` 分支 `cursor/speech-action-authority-8c12`，HEAD `6dcee573`（`91964350` 主改 + `6dcee573` 问句只问一次）。

## 结论：**收下**

实现与方案一致：`recoverWriteIntent` 以口语写动作 role + 型 `can` 为权威；无写动作 role 时一律收成现查并剥掉模型写动作/patch；明确写口语仍过审预览；两可先现查并 `askAction`，`packSheet` 在 `action=现查` 时不发写令牌。未在闸里写死「待审的费用报销」类整句。one-bind 的 `relation-bind.js` / `lookup.js` 自 `0755e1dc` 至 HEAD 无 diff。

---

## 必答六问

### 1. 有没有写死待审 / 费用报销 / 过审 / 列出？

| 词 | 闸逻辑（`slots.js` `recoverWriteIntent` 等） | 说明 |
|---|---|---|
| 待审、费用报销 | **无** | `slots.js` 内无这两串；业务句靠各型词表 clues / 字段枚举绑定，非整句特赦。 |
| 过审 | **仅有通用动作名** | `WRITE_ACTIONS` 含 `过审`，与方案「`can` + 动作 role」一致，不是「待审报销=过审」类写死。 |
| 列出 | **仅在口语种子** | `vocab/spoken.json` 里作为 `action=现查` 的 say 线索（及「列举」role），不是 recover 里的硬编码分支。 |

测试/fixture（如 `slots-enrich.test.mjs` 里「待审」「单据」）不算产品写死。`lookup.js` 等处 `pending→待审` 为状态展示/枚举归一，早于本刀，不是「待审的费用报销→过审」特判。

### 2. 没有写动作 role 是否一律现查？模型 `action=过审` 是否被丢掉且不发票？

**是。**

```1990:2001:runtime/vendor-overlays/dsh-lan-assist/slots.js
  const writes = spokenWriteActions(speech, vocab, extra)
  const uniqueWrite = writes.length === 1 ? writes[0] : ''
  const look = spokenListAction(speech, vocab, extra) === '现查'
  const canWrite = uniqueWrite && can.includes(uniqueWrite)
  if (canWrite && !look) {
    next.action = uniqueWrite
  } else {
    next.action = '现查'
    delete next.patch
    const modelWrite = WRITE_ACTIONS.includes(toolAction) ? toolAction : ''
    const ask = canWrite ? uniqueWrite : modelWrite
    if (ask) next.askAction = ask
  }
```

- 无唯一写动作 role → 走 `else`：`action=现查`，`delete next.patch`；若模型填了写动作则 `askAction` 保留线索（如 `过审`）。
- `write.js` `packSheet`：`canWrite` 要求有 `preview_id` 且 `action !== '现查'`；`askAction` 只在 `action === '现查'` 时进 sheet 并拼问句，**不 mint 写预览令牌**。

单测：`recoverWriteIntent lists when speech has kind and enum but no write role`；`write-hop-actions`「model write without spoken write role…」无 `preview_id`。

**例外（非本刀主路径）：** `!speech || !kind` 时 `recoverWriteIntent` 早退，不改 `action`（残缺 spec）；正常 preview 路径在 `write.js` 会先 `recoverWriteIntent`。

### 3. 「都过一下」是否仍过审预览？

**是（口语含写动作 say 时）。**

- `spoken.json` 过审 say 含 `过一下`、`过了`、`过审`；`91964350` 有意补全。
- `recoverWriteIntent prefers spoken write action over a mismatched model action`：句「待审单据都过一下…」+ 模型 `改行` → `action=过审`。
- `write-hop-actions` 链式 hop 上带 `过一下` 仍出 `previewId`。

说明：`spoken.json`「列举」role 里仍有 `都过一下`（批量列举线索），与过审 `过一下` 共存；当前闸以 **action role 的写动作命中** 为准，`spokenListAction` 只认 `action=现查`，故「都过一下」不单独把整句打成纯现查。与 land 表一致。

### 4. 两可是否现查 + 问人、不静默发票？

**是。**

- 写动作唯一且 `can` 有，但同时命中现查 action role（`look`）→ 仍 `action=现查`，`askAction=uniqueWrite`。
- 模型坚持写、口语无写 role → `action=现查`，`askAction=modelWrite`（如 `过审`）。
- `speakWithActionAsk`：「…是现查还是{act}？人回一句再写。」`6dcee573` 去掉 `withSheet` 重复包裹，避免问两次。

单测：`lists and asks when look and write roles both hit`；`write-hop-actions`「look and write roles together…」无 `preview_id`。

### 5. one-bind `enumHits` / hop / hint 有没有被回退？

**没有。**

`git diff 0755e1dc..HEAD -- runtime/vendor-overlays/dsh-lan-assist/relation-bind.js runtime/vendor-overlays/dsh-lan-assist/lookup.js` 为空。本支 speech 相关提交只动 `slots.js`、`write.js`、`vocab/spoken.json` 与测试。`slots.js` 仍 `import { enumHits } from './relation-bind.js'`，enrich 绑定路径未在本刀撤销。

### 6. 旧的只认「现查/列出」副本删干净没有？有没有第三套动作猜测？

**旧缺省已删；未见第三套「待审特赦」类动作猜测。**

`91964350` 删除的旧逻辑：仅在 `userSpeech` 命中 `spokenListAction===现查` 且 **无** `spokenWriteAction` 时，才把错填写动作拉回现查——即「必须先口语列出/现查」才纠错。

现逻辑：

- **无写 role 默认现查**（不依赖是否说出「列出」）。
- `spokenListAction` 只用于 `look`，参与「又像看又像写」分支，符合 land「只留给两可线索」。
- 额外机制是 **通用** 的：`actionHitNestedInField`（字段枚举 span 包住「过审」不算写）、`rewritePatch`（改行/新建补 patch），不是按「待审+型名」的第三套动作表。

全仓仅 `recoverWriteIntent` 一处调用 `spokenListAction` / `spokenWriteActions`，无并行「动作猜测」副本。

---

## 与 land 文档核对

| land 声称 | 代码/测试 |
|---|---|
| `6dcee573`、未推远程 | 本机 HEAD 一致（审阅未 push） |
| 无写 → 现查、剥 patch、`askAction` | 见上 |
| 明确过一下 → 过审预览 | 单测 + hop 测试通过 |
| 删旧「只认现查/列出」缺省 | `91964350` diff 可见 |
| one-bind 未动 | diff 为空 |
| `write-name-identity` 部分用例仍失败 | 未在本审重跑；land 已标注，不挡本刀契约 |

## 本机单测（审阅时跑）

`node --test tests/slots-enrich.test.mjs tests/write-hop-actions.test.mjs`：**82 pass，0 fail**（含新增 `recoverWriteIntent` 与 hop 无写口语/两可项）。

## 残留风险（不收下的理由不足，仅备案）

1. **`!speech \|\| !kind` 早退**仍可能留下模型写动作——需上游保证 preview 带 `speech`+`kind`；与方案验收集 Qwen 全路径仍建议偶发回归。
2. **`spoken.json`「列举」含 `都过一下`**与过审 `过一下` 并存；当前测试覆盖「待审单据都过一下」，未在审阅中跑真实「费用报销」型词表 E2E（land 有 session 手测记录，本审未复现）。

---

## 审阅范围

- 未改产品代码。
- 分支未切换；未跑 Qwen 现网会话。
