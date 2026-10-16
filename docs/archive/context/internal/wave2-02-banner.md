---
cursor:
  subagentId: "bc-91e33a87-c0e2-5c90-a7e6-7d86b9855b2e"
---

# Wave 2 · Spec 02 §8 · askAi 超时黄条

## 提交

| 消息 | SHA |
|---|---|
| `fix(web): show askAi timeout on AI banner` | `b9b9b11` |

## 改动

- `src/pages/AI.tsx`：订阅 `subscribeAskAiNotice`，`getAskAiNotice()` 有值时在既有 `statusBanner` 琥珀条展示 `ask-ai.ts` 文案（规格 §8：「AI 没有提交结构化结果，可在 AI 页查看它说了什么」）；`sessionId` 时附 `打开会话`（`btn h-7 px-2`，`selectChat` + `clearAskAiNotice`）。未改顶栏 `className` 三元组。

## 验证

| 步骤 | 结果 |
|---|---|
| `npx tsc -b --pretty false` | 退出 0 |
| 现网 5174 超时黄条 | **未测**（未跑 `__fdeAsk` 超时） |

## 对照（§8）

| 项 | 状态 |
|---|---|
| 超时文案 | **已对**：`ask-ai.ts` L159–162 与 spec §8 一致；`AI.tsx` 经 `askAiNotice.text` 展示 |
| 打开会话 | **已对**：同页左栏 `selectChat` 路径；按钮文案与 `Memory.tsx`「打开会话」一致 |
| 黄条样式 | **已对**：复用 `statusBanner` `warn` → 既有 `bg-amber-50` 分支 |
