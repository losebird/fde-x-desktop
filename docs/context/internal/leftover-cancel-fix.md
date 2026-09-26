---
cursor:
  subagentId: "bc-197ecf79-6a07-5c40-b4ef-8cc4c9adda2b"
---

# leftover 误掐现查 — 修复证据

## 改了什么

| 文件 | 变更 |
|---|---|
| `runtime/vendor-overlays/dsh-lan-assist/session-round.js` | `closeRound(..., 'wrote')` 清 candidate；同轮 **无 preview_id 的现查** 覆盖 speech 误绑写预览，不 leftover cancel；cancel 结果带 `cancelKind: 'plugin-leftover'` |
| `runtime/vendor-overlays/dsh-lan-assist/slots.js` | `recoverWriteIntent`：工具参数 **`action=现查` + `no` 槽** 时保持现查，不吃秘书 `wrote` userSpeech 里的写词 |
| `runtime/vendor-overlays/dsh-lan-assist/gate.js` | 过账成功 follow-up 带 `roundClose: 'wrote'` |
| `runtime/vendor-overlays/dsh-lan-assist/index.js` | `deliverFollowup` 先 `closeRound` 再 `agent.followup`；`cancelLeftover` 用 `plugin-leftover` |
| `runtime/vendor-overlays/dsh-lan-assist/tools.js` | leftover cancel 用 `outcome.cancelKind`，默认 `plugin-leftover` |
| `runtime/server.mjs` | `POST .../cancel` 转发 body `kind` |
| `src/lib/runtime-api.ts` | `cancelAi(sessionId, { kind })` |
| `src/lib/biz-hit-set-pick-cancel.ts` | `shouldAbortLeftoverAskForWritePreview`（无 changes、非 picked 的误预览不 cancel） |
| `src/components/biz/RecordsPanel.tsx` | `records-cancel`；误预览不 `abortLeftoverAskTurn` |
| `docs/biz-write-w1-root-cause.md` | §3 abort 表述与 tool-call-abort 对齐 |
| 测试 | `session-round.test.mjs`、`slots-enrich.test.mjs`、`biz-hit-set-pick-cancel.test.mjs` |

## 怎么证明 leftover 不再掐现查

1. **`session-round.test.mjs`** — `speech-bound 新建 in-round is superseded by explicit 现查 lookup`：`noteToolSheet` 第二次返回 `cancel: false`，candidate 变为 `action: '现查'`（原「写预览 + 同号现查 → cancel」路径）。
2. **`session-round.test.mjs`** — `write leftover 现查 does not become official` 仍通过：`picked: true` 的改行 + 同号现查 **仍** leftover cancel（真 leftover 未松）。
3. **`session-round.test.mjs`** — `closeRound wrote clears open candidate`：过账后 follow-up 前清掉写轮 candidate。

## 怎么证明现查不再落成新建

**`slots-enrich.test.mjs`** — `recoverWriteIntent keeps tool 现查 when no slot is set despite post-write userSpeech`：参数 `action:现查` + `no:388419542908928`，`userSpeech` 为秘书 `库里已改上…` 文案，输出仍为 `现查`、无 `patch`。

## cancel kind

- 插件 leftover：`plugin-leftover`（`tools.js` / `index.js`）
- 右栏：`records-cancel`（`RecordsPanel` → BFF `session/cancel`）

## 本地验证命令

```bash
node --test runtime/tests/session-round.test.mjs runtime/tests/slots-enrich.test.mjs runtime/tests/biz-hit-set-pick-cancel.test.mjs
```

2026-09-24：77 tests，0 fail。
