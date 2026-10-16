# 早报可用且可关联：方案（未开工）

日期：2026-09-29。点头之前不改代码。

对照：[specs/06-briefing.md](./specs/06-briefing.md)（已接线、现网不可用）、PRODUCTION-SPEC 阶段 G / §15.8、闸 overlay 集合令牌 `5fe4d5ba`、CORS/`onOpen`/`cwd` `bc7171ee`。

现网样本：`briefings.id = brf_c66b731228e94facb7dfc3abe196cff2`，`workspace_cwd = /Users/zxz/Documents/ai-project/fdex测试`，`status = partial`。

## 结论

早报不是差几个字段。它自己另搞了一套工作区查找、另开一场 AI、条目没有模块身份。

第一性原理：**早报是当前顶栏工作区这根指针上的只读汇编。人能点的每条都是某个模块已经能打开的身份；「生成」是把这张汇编交给当前 AI 会话写摘要。** 早报不查第二套库，不养第二场会话，不发明第三种跳转。

规格 06 里「`askAiForResult({ preset:'fde-briefing' })` + 模型去调 MCP」这条生成路径作废。内部源直采保留。自定义区块保留。不新造页、不改 className、过账仍走人确认。

## 工作区 cwd 进 metadata（不是绑死唯一工作区）

`metadata.cwd` 是**每一条工作区自己的本机目录**。顶栏仍可建多个、来回切。切到哪条，早报就用哪条的 `{ workspaceId, cwd }`。`briefing_definitions` / `briefings` 本来按 `workspace_cwd` 分，不是全站一份。

要修的是对不上号：计划把待办写在顶栏这条的 id 上（现网 `1985293d-…` 两条「小区水电抄表」）；早报只用目录去 sqlite 找 `metadata.cwd` / `metadata.path`，找不到就落到 `ws_personal`。`fdex测试` 的路径写在 `description` 里，`metadata` 是 `{}`，今日三件事 `items: []`。

把 cwd 写进**当前这条**的 metadata，早报和计划认同一条工作区。换顶栏就是另一份早报。

早报跟的是**当前顶栏工作区**。不做「所有工作区合成一张总早报」。

没有本机目录的工作区：待办仍按它的 id；记忆 / 连接器 / 当前 AI 会话要 cwd，那一块停，并说当前工作区没有本机目录。

同一目录挂了多条工作区记录（现网 `fdex测试` 已有一串重复行）：权威是顶栏选中的那条 id + 它的 cwd，不用目录去唯一化掉其它工作区。`ensureWorkspace` 必须带上 `metadata.cwd`，不能只写 name/description。

## 一根指针，三种身份

| 身份 | 唯一来源 | 早报不许另做 |
|---|---|---|
| 工作区 | `loadCurrentWorkspaceCwd()`：`{ cwd, workspaceId }` | 不许 `cwd → ws_personal` |
| 条目 | 源模块主键（taskId / requestId / kind+no / cardId / viewId） | 不许只写 `{ panel: 'memory' }` |
| AI | `loadCurrentAiTarget()` | 不许新建 `fde-briefing` 会话 |

## 条目契约

采集只准交出：

```
{ source, identity, speak, href }
```

`href` 只走现有 `openRef`。`openRef` 只把 identity 写进目标模块已经在用的 browse（`selectTask`、`openIMPanel`、`memoryBrowse`、业务记录的 kind/no），再 `togglePanel`。模块没有「打开这一条」的 browse 槽，这一源就停，不准点进首页假装关联了。

`stat.value` 只准是数或字符串。现网 `computeStat` 返回 `{ value: 4, label: '试做次数' }`，采集再包一层，页面 `String(m.stat.value)` 即 `[object Object]`。

## 采集和摘要拆开

待办 / 日程 / IM / 业务 / 记忆 / 应用统计 / **已绑定且宿主能直调的** MCP：宿主按槽自己取。模型不负责找「今日三件事」。

`生成新早报`：

1. 用当前 `{ workspaceId, cwd }` 采集全部已启用且槽满的块。
2. `promptAi(当前会话)`，正文是这张汇编；只写 AI 槽。
3. `fde_submit_result` 把摘要填回该工作区这份早报的 AI 块。
4. 人在左栏看见同一场会话。

BFF 不准为早报再 `session/create`，不准 180 秒占死 HTTP。现网 `agentError`：`preset "fde-briefing" failed to mount … filesystem is already registered`。页面不展示这条，AI 卡仍是占位句。修预设来救早报不在本方案里。

## 自定义是槽表

区块能勾选，前提是槽能从活目录填满：业务 kind 来自闸 catalog（过审型），应用 slug/view 来自已激活应用的 stat 视图，MCP 来自已配置服务器。槽空则区块保持 disabled，错误写在该块上。重试只重采这一块，不准所有「重试」都 `runFull`。

现网待审批：`params.kind` 空，错误写「请在自定义里选择业务型」；抽屉没有 kind 控件。

## 失败停在块上

缺槽、核心未连、MCP 没有、会话没有：具名 error。不准用空列表 + 「点右上角生成」顶上去。根上 `agentError` 必须出现在 AI 卡。

关掉：`fde-briefing` 旁路会话、采集里 `ws_personal` 兜底、把 `runFull` 当所有重试、MCP 空着还 enabled 等模型去调。

## 人能走通的关联

1. 打开早报 = 用当前 cwd+id 采集；AI 槽空着也可以，内部块先可见。
2. 点待办 → 计划待办 Tab 选中那条。点 IM → 打开那封信所在会话。点业务 → 业务记录落到该 kind+no 的官方表。点记忆 → 记忆抽屉打开那张卡。点统计 → 打开该应用。
3. 「生成新早报」→ 当前会话收到汇编，摘要写回 AI 卡；问 AI 打开同一 `sessionId`。
4. 「发往 IM」走当前联系人；没有联系人就停。
5. 「保存到记忆」走 `draftMemoryCard`，回执带 card id，再 `openRef` 到那张卡。

## 条件不够先停

1. **工作区 cwd 必须进 SQLite metadata**（每条自己的目录，见上）。不先收这一刀，待办还会空。总闸。
2. **生成只走当前会话。** 废弃 `fde-briefing` 旁路。要保留「每早另开一场早报会话」，本方案不成立。和 AI 关联的总闸。
3. **MCP 宿主没有按 server+tool 直调的稳定入口。** 没有服务器或 BFF 不能直调时，邮件/资讯保持停用。不准再派模型去 `list_unread`。
4. **IM 只能 `openIMPanel(threadId)`，不能按 `requestId` 打开那封信。** 未加「打开这封信」browse 之前，早报只能停在打开该 peer，或 IM 块先不宣称可点进正文。
5. **记忆 `memoryBrowse` 没有 cardId。** 不把 cardId 交给现有 find/抽屉，记忆条目只能停在打开记忆模块。
6. **业务记录没有按 kind+no 对焦的 store 槽。** `openRef` 现在只 `togglePanel('data')`。没有对焦槽，待审批不能说到行。kind 可从闸 catalog 来。
7. **核心未连接或没有当前会话时，「生成」必须停。** 内部块仍可刷新；AI 槽写明原因。

1 是总闸。2 是和 AI 关联的总闸。3–6 按源分期；点那条之前必须先有 browse 槽。

## 点头后落地顺序

1. 工作区身份：`ensureWorkspace` 写入 `metadata.cwd`；采集只认这根 id。
2. 条目契约 + `openRef` 唯一跳转；stat value 收成标量。
3. 自定义槽：缺槽不能启用；待审批 kind 来自 catalog。
4. 生成：当前会话 + 已采集汇编 + `fde_submit_result` 填 AI 槽；拆掉 `fde-briefing` 等待。
5. 分源深链：计划（已有 `selectTask`）→ 业务对焦 → IM 信 → 记忆卡。哪源 browse 还没有，哪源先停。

## 现网五处与本方案的对应

| 人看见 | 根因 | 收在哪一步 |
|---|---|---|
| 今日三件事空 | cwd 对不上 workspace id | 1 |
| 本周拜访 `[object Object]` | stat.value 包了对象 | 2 |
| 待审批「重试」仍要 kind | 抽屉无 kind；重试是整份 `runFull` | 3 |
| 昨日记忆进记忆首页 | href 无 cardId；browse 无槽 | 5，槽不够先停 |
| 生成新早报像没反应 | `fde-briefing` 挂载失败；`agentError` 不展示 | 4、失败展示 |

## 对规格 06 的覆盖

仍有效：区块闭集、内部源直采、定义驱动渲染、自定义抽屉、调度、发往 IM / 保存到记忆用真内容。

作废：`preset:'fde-briefing'` 作为生成路径；模型替宿主采集 MCP；BFF 为早报 `session/create` 并阻塞到 `fde_briefing_submit`。
