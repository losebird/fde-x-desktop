---
cursor:
  subagentId: "bc-83103e6c-5a3c-54cc-b112-1a6754ae8192"
---

# 单发布表现场核对

跑着的核心和页面已经是 `3cf7d1ba6d50a0d007b3ec37d99067cd4b9f4c84`。没有仍是旧逻辑的一项。

- 仓库 HEAD：`cursor/approve-batch-where-9c38` 就是这笔，提交时间 2026-09-26 16:39:57 +0800。
- `~/.dsh-fde-x` overlay：`profiles/fde-x/node_modules/dsh-lan-assist` 指向 `vendor/dsh-lan-assist/session-round.js`（16:46:08 拷入，与仓库文件一致）。`closeRound` 只在 `canPublishSheet(next)` 通过时写 `official`。`lastEmittedPendingBySession` 不在。
- 5174：进程 1119 从 9 月 25 日 18:48 起就在，早于这笔提交；当前 `http://127.0.0.1:5174/src/components/biz/RecordsPanel.tsx` 里，`bizFocusKind` 失败后直接 `return`，不再 `applyLocal`。
- 4318 / DSH：`runtime/server.mjs`（90577）16:46:08 启动，`dsh --profile fde-x`（90624，`~/.dsh-fde-x/run/dsh-core-fde-x.pid`）16:46:09 启动，都晚于 16:39:57。
