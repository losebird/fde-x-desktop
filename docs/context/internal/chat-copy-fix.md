---
cursor:
  subagentId: "bc-3e4ccd3a-59e9-5885-acf0-bdcb31839e4b"
---

# Ace 会话气泡「复制」修复

## 根因

1. **DSH 内置 `writeClipboard`（`dsh-web-frontend` 里的 `Fn`）**：若存在 `navigator.clipboard.writeText`，失败时 `catch` 直接 `return false`，**不会**再走 `document.execCommand('copy')` 回退。在嵌入 iframe（5174 壳 + 4318 `/dsh-app`）或权限受限时，`writeText` 常失败，表现为点击「复制」无任何反馈（`MessageIconActions` 在 `!ok` 时静默返回）。
2. **父页 iframe 未声明剪贴板权限**：`src/pages/AI.tsx` 的 DSH iframe 缺少 `allow="clipboard-read; clipboard-write"`，跨源嵌入时更容易触发上述失败。

## 点击链路（代码）

- UI：`@deepseek-ai/dsh-client-ui-chat` → `MessageIconActions` → `onClick` → `writeClipboard(text)`（`text` 来自 `UserStyleBubble` / 助手行的 `contentParts`，与用户可见正文同源）。
- 无父级 `pointer-events` 拦截；失败原因是剪贴板 API 返回 `false`，不是按钮未触发。

## 修改

| 文件 | 改动 |
|------|------|
| `runtime/fde-x-dsh-bridge/lib/clipboard-patch.js` | 新增：`writeText` 失败后 `execCommand` 回退；空内容/彻底失败时底部 toast |
| `runtime/server.mjs` | 注入 `clipboard-patch.js`；在现有 `FDE_DSH_HEAD_HOOK` 的 `wrapFactory` 里 patch `dsh-client-ui-primitives` / `dsh-web-frontend` 的 `writeClipboard` |
| `src/pages/AI.tsx` | iframe 增加 `allow="clipboard-read; clipboard-write"` |

成功时仍用 DSH 自带约 1s 的「已复制」勾选反馈；失败时 toast 提示。

## 验证建议

1. Vite 热更新后打开 Ace 会话，对用户/助手气泡点「复制」，粘贴应得到该条全文。
2. `server.mjs` 变更需 BFF（4318）进程重载后 `/dsh-app` 才注入补丁；未重启前仅 iframe `allow` 生效。
