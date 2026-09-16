# 接线现状（不是完成证明）

## 已活测

- `POST /api/v1/ai/connect` 成功
- 会话 / preset / 模型 / Skills（62）
- 文件 list / 上传 / mkdir / 删除（`..` 为 400）
- IM state、开码
- 连接器：API Key 或账密换 token；lookup 路由存在
- **采购单** `现查` 20 条；`改行` `preview_id` → write 成功，回执 `371712924975164`
- `tsc` 与 `runtime/smoke.mjs` 绿；主区 `AI.tsx`
- **语义引擎：** FDE-X 家目录自带一份 runtime（`~/.dsh-fde-x/semantic-os/runtime` 约 1.8GB，0.1.1/darwin-arm64），不再 symlink 官方 `~/.dsh`。活测 semantica 0.6.7。启动时若 FDE-X 还没有这份树，会从官方已装 runtime 或插件 `runtime-dist` **拷贝**进去。
- 中文工作区图搜索 / 扫描冲突 / 会话原文从 session 日志读（无 `texts.json`）；设置有 **重载核心**（须 4318 进程已加载该路由）。

## 未完成（Host / 发布）

1. MCP 新增仍写 patch，需重连（DSH 无 MCP Remote）。
2. 双机配对需对端门牌；本机自握 `NO_RELAY_PAIR`。
3. 当前 FDE-X 目录 `scene-39` 未登记采购单；过账活测用的是有词表的业务工作区。
4. `/health` 的 semantic-memory 适配器要等 4318 重启后才会按 `/ready` 报健康。
5. 一键安装包（dsh + fde-x 档 + 语义 runtime）未做。

## 壳层补缺进度（PRODUCTION-SPEC §15.9）

1. **当前会话指针**：`src/lib/ai-target.ts`。早报 / IM 拟回与问本机 / Skills / ⌘K 文件 / 文件页会话 不再取「第一条非子代理」。cwd 不对则报错。AI 左栏选中写入 `activeAiSessionId`。
2. **aiInboxDraft**：IM 采纳 → iframe `compose`/`setDraft`，成功后清空。
3. **早报 IM**：未读与发往走 `imState` / `imCompose`+`imSend`。记忆搜索「问这条 / 打开会话」。
4. **文件发给 AI**：列表发送钮 → `fde-x-attach-file`（与拖放同一路径）。
5. **业务应用**：`PUT /api/v1/business/apps/:id`（无 Origin 403，修订号 +1）。点应用打开草稿编辑（目标 / 连接器数据源 / 屏幕 / 权限），保存不写外部系统。可把目标再发给当前 AI。
6. **计划**：新建步骤不再冒充 AI；暂停态不能「启用」。MCP 保存后提示重载核心。⌘K 可搜记忆摘录。

指针乱：早报 / IM / Skills / ⌘K 取「第一条非子代理会话」，文件页才按 cwd。  
`aiInboxDraft` 只写不读。  
早报未读 IM、发往 IM 仍走 store。  
记忆不能问摘录、不能跳回 session；⌘K 不搜记忆。  
计划 `memory.add` 是种子。MCP/Skills 不投影当前会话。  

**业务应用「AI 创建应用」：** 只插入 SQLite 空草稿（`screens: []`），不调模型、点卡片只切业务记录 Tab。名不副实。
