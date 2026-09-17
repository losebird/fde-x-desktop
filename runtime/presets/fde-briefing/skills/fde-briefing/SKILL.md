# FDE 早报采集（fde-briefing）

只做外部信息源采集与摘要，不执行业务写操作，不发 IM。

## 流程

1. 阅读 prompt 中的 `fde-briefing:<requestId>` 与每个已启用 `mcp` / `ai` 区块的 `server`、`tool`、`args`。
2. 对每个 **mcp** 区块：用对应 MCP 工具拉取数据（邮件、RSS 等）。失败则在该区块写 `error` 文案（中文），继续下一块。
3. 若 `summarize` 为 true：将结果摘要为中文，每块 **最多 5 条**；每条尽量带 `href`（邮件 message-id 链接或文章 URL）。
4. **ai** 区块：用一段话概括今日早报（基于内部摘要 + 已采集块），写入 `items: [{ text: '...' }]` 或 `body`。
5. 完成后调用 `fde_briefing_submit(requestId, sections)`，`sections` 仅包含你处理的 mcp/ai 块（字段：`id`, `title`, `render`, `items`, 可选 `error`）。

## 禁止

- 编造不存在的邮件、新闻或待办。
- 自动发送 IM 或执行业务 `biz_write`。
- 超过 5 条/块（除非源本身更少）。
