# 「停用客户还有哪些没关的工单？」与 WHERE_UNBOUND

## 结论（Ace 先读）

1. **WHERE_UNBOUND 不是「禁止 hop」**，是 **lookup 在「模型/槽位仍带着 `where`，但绑定后没有任何可执行 `clues.terms`」时拒打带条件的 `:list`**，避免 **整表倒出**（`lookup.js` 原文 hint：「筛选条件没对上词表列名，不能整表现查。」）。
2. **这句会误触闸**，因为槽位 enrich **已经把计划写进 sheet**（`hopWhere` / `where` / `steps`），但 **第一跳「客户 · 停用」在 `bindWhereRelationTerms` 枚举绑定里被整格丢掉** 时，父级 `probe` 直接 `WHERE_UNBOUND`——**计划元数据与可执行条件脱钩**；不是用户没讲清，也不是 connector 掉线。
3. **用户看到的「没连业务」是谎话**：`lookup` 的真实 hint 被丢掉；`write.js` → `missSpeak` → **`speakLookup`（`probe.js`）** 对除 `NOT_FOUND` / `EXPIRED` / `FORBIDDEN` 外的一切错误（含 `WHERE_UNBOUND`）统一套 **「这张单现在查不到。没连业务，不能装成已查待办。」**——与 `NO_CONNECTOR`（「没连业务，不能装成**已查**。」）是不同错误码，文案却像一回事。
4. **`replay: true` 能出 21 行**，因为 **跳过 `enrichStructuredSlots` / `recoverWriteIntent`**，用模型手写的 **`steps` + 枚举 code**（如 `inactive`、`resolved`/`closed`）进 `normalizePlan` → hop 两跳 **`probe` 都能绑上 terms、打出 `:list`**；口语「停用」与现网 label「暂停合作」不一致时，**只有这条旁路能稳定绕过**。

---

## 1. 闸在哪、判什么

`lookup.js` `probeOne` 在 **任何** 带 `where` 的现查（含 hop 第二跳 `related` + `where`）里，走完绑定流水线后：

```695:702:runtime/vendor-overlays/dsh-lan-assist/lookup.js
    if (Array.isArray(where) && where.length && !clues.terms.length && !looksLikeRef(ticket)) {
      return {
        ok: false,
        error: 'WHERE_UNBOUND',
        status: '没有',
        matches: [],
        hint: '筛选条件没对上词表列名，不能整表现查。',
      }
    }
```

**设计意图（代码语义）**：`where.length > 0` 表示用户/模型**声称要筛选**；`clues.terms.length === 0` 表示 **没有一格能安全落到 schema 过滤**；此时 **禁止** 走后面会打 `:list` 的分支（对比 `where-by-cell.test.mjs`「失败外键不得无 filter 整表 list」）。**没有**「跨对象 hop 一律拒绝」的分支。

**误触**：同一句经 `biz_preview` → `enrichStructuredSlots` 后，**sheet 上仍显示** `客户 status=停用`、`工单 status not resolved/closed`、`steps: 客户→工单`（`write.js` `sheetWhereFromPlan` / `packSheet`），但 **第一跳 lookup 已在绑定后 terms=[]**，回执 `ok: false`、`listed: false`、`rows: []`——**像查过了，其实第一跳就没发有效 list**。

---

## 2. 绑定流水线：哪一步把 `clues.terms` 滤空

顺序固定在 `lookup.js` 673–694 行：

| 步骤 | 函数 | 作用 |
|------|------|------|
| 1 | `bindWhereKeys` | 列名/别名 → schema 字段名 |
| 2 | `bindClueEnums` | 枚举 label ↔ code（同字段内） |
| 3 | `bindWhereRelationTerms` | 关系列解析 id；**枚举列必须 `enumHits` 命中** |
| 4 | `expandNegatedClosedValues` | `not` +「没关」→  closed/resolved 等 code |
| 5 | `termFitsCollection` | 去掉列对不上的 term |

**本句最致命的格子**：`relation-bind.js` 290–298 行（`mode === 'enum'`）：

- 对每个 `term.values` 做 `enumHits`；**一个都绑不上且原 values 非空 → `continue`，整段 term 不进 `out`**。
- 现网客户 `status` 常为 **`inactive` →「暂停合作」**，口语/槽位写 **「停用」**；若进入绑定的 values **只有** `['停用']`、**没有** code `inactive`，则 **terms 变 0 → `WHERE_UNBOUND`**（本机用 overlay 复现：`values:['停用']` → terms 0 + `WHERE_UNBOUND`；`values:['inactive','停用']` → terms 1，闸放行）。

词表 `spoken.json` / enrich 测试通常带 **`inactive` + `停用`**（`slots-enrich.test.mjs`），所以 **enrich 路径「看起来对」**；一旦模型 JSON 只留 label、或某条路径只把「停用」送进 `where`（Qwen 第一下错形 `not: ["已关闭"]` 是额外噪音），闸仍可能打中。

**工单侧「没关」**：enrich 产出 `not: true` + `resolved`/`closed`（或经 `expandNegatedClosedValues` 从 schema 闭集补 code）。**若第一跳客户已 `WHERE_UNBOUND`，根本不会进入 hop 第二跳**（`write.js` 1202–1230：父级 `probe` 失败且 `error !== 'NOT_FOUND'` → `refuse`，不是 `settledList`）。

**第二跳若单独失败**：`write.js` 1267–1271 对现查走 `settledList`（`ok: true`、0 行、`querySettled`），**错误码通常不是 `WHERE_UNBOUND`**。日志里 **`ok: false` + `WHERE_UNBOUND`** 与 **第一跳父级 `probe(start.where)` 失败** 一致（与 [qwen-ticket-unbound-loop.md](qwen-ticket-unbound-loop.md) 同构回执）。

**`hopWhere` / `where` 为何还在 sheet 上**：失败时 `previewStructured` 仍 `sheet(refuse(...), { ...sheetWhereFromPlan(plan, spec) })`（`write.js` 1226–1229）。**计划来自 `normalizePlan(enriched)`，与 lookup 是否绑上无关**——所以 Ace 会看到「系统听懂了，但查不到」。

**不是** `relation-bind` 把 hop 第二跳的 `where` 在「关系列」上吃掉（那是 [expense-pending-miss-root.md](expense-pending-miss-root.md) 一类：**纯枚举 status** 在旧路径上的故事）；本句核心是 **枚举 oral「停用」↔ 库表「暂停合作」+ 绑定严格丢格**。

---

## 3. hint「没连业务」从哪来

| 层 | 内容 |
|----|------|
| **lookup 原文** | `hint: '筛选条件没对上词表列名，不能整表现查。'`（`lookup.js` 701） |
| **write 失败路径** | 父级失败：`missSpeak` → `speakLookup`（`write.js` 1099–1108、1223–1225）；`refuse(error, missedSpeak.speak)` 的 **`hint` 字段其实是 speak 文案**，不是 lookup.hint |
| **用户可见套话** | `probe.js` `speakLookup` 89 行：`return \`${label}现在查不到。没连业务，不能装成已查待办。\`` —— **凡 `found.ok === false` 且 error 不是 `NOT_FOUND`/`EXPIRED`/`FORBIDDEN` 都落这里**，**不读 `found.hint`** |

真·没连上是 **`NO_CONNECTOR`**（`write.js` 1671–1677：`${resolvedKind}：没连业务，不能装成已查。`），错误码不同，**界面却都叫「没连业务」**。

---

## 4. `replay: true` 为何能 21 行（绕开哪段）

`write.js` `preview` 入口：

```1561:1586:runtime/vendor-overlays/dsh-lan-assist/write.js
    const replaying = spec.replay === true && Array.isArray(spec.steps) && spec.steps.length
    if (!replaying) {
      const picked = pickHopSpeech(...)
      ...
    }
    const recovered = replaying ? { ...spec } : recoverWriteIntent(spec, loaded.vocab, enrichExtra)
    let enriched = replaying
      ? { ...spec, speech: String(spec.speech || '').trim() }
      : enrichStructuredSlots(recovered, loaded.vocab, enrichExtra)
```

**绕过**：`pickHopSpeech`、`recoverWriteIntent`、**`enrichStructuredSlots`（口语→停用/inactive、没关→not closed）** 整条槽位 enrich。

**保留**：`normalizePlan` → `previewStructured` → 第一跳 `probe(客户, where: [{ status: inactive }])` → 第二跳 `probe(工单, related + where: status not resolved/closed)` → `finishStructured` 打 `:list`、算 `hitTotal`（grok 会话 seq 491–493：**21 行**）。

模型在 `steps` 里直接写 **code**，不依赖「停用」能否对上「暂停合作」label，**`bindWhereRelationTerms` 不再丢客户那一格**，闸不触发，hop 交集能算出来。

---

## 5. 和 Qwen / grok 对照（不重讲故事）

与 [qwen-vs-grok-same-query.md](qwen-vs-grok-same-query.md)、[qwen-ticket-unbound-loop.md](qwen-ticket-unbound-loop.md) 一致：

- **同闸、同误导 hint**；默认 `biz_preview` + speech enrich → **易在第一跳 `WHERE_UNBOUND`**。
- **grok 21 行** = **`replay: true` + 显式 `steps`**，不是 hop 免闸。
- **Qwen 同句 preview 两遍** = 同一 enrich 结果 → **同一确定性 `WHERE_UNBOUND`**。

[hop-sheet-stuck-root.md](hop-sheet-stuck-root.md) 讲的是 **「查到了但右边不画回执」**（恒通 4 张工单 vs 改行预览）；**本句**是 **「条件绑空 → 不打 list → `WHERE_UNBOUND`」**，别混。

---

## 6. 一句话给 Ace

**闸是防「有条件的 where 却绑不出任何 term 就整表 list」；这句是「停用」枚举格在绑定层被扔掉，第一跳就 `WHERE_UNBOUND`，sheet 却还挂着 enrich 出来的 hop 计划；界面把 `WHERE_UNBOUND` 说成「没连业务」；`replay` 跳过 enrich，用 `inactive` 等 code 手写 steps 才把 21 行打出来。**

（只定位，未改产品。）
