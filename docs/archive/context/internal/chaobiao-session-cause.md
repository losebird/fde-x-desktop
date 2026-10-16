# 为何左栏反复出现「小区水电抄表 · 问」

Inquiry only. Product SHA `455e6e5`（scene-39 daily main / 同 SHA 的 `cursor/records-bind-pipe-bi-d708`）。未改产品、未 git。

## 一条因

**函数** `runDeclaredPlatformUse`（`use === 'ai'`）  
**文件** `src/lib/app-platform.ts:163-176`  
**触发** 点应用工作面上的「问 AI」芯片（`data-app-use="ai"`）。

这条路径**每次新建**一条左栏可见会话，标题写成 `` `${spec.name} · 问` ``，**不走** `currentAiTarget` / `loadCurrentAiTarget`。

收口-verify 的 Decision 22 块固定打开夹具 `app_9de6038b186a4e9786e28bc4f48add9d`（现网名「小区水电抄表」，`uses=["ai","plan"]`），再点同一颗芯片。所以每跑完一趟 verify，左栏多一条「小区水电抄表 · 问」。截图里的「小区水电抄表-问…」就是这条标题（中点 ` · `，不是 ASCII `-`）。

**不是** hops 自己去打开抄表。hops 只 prompt 另一条会话。问 AI 是 hops 之后的 D22 步骤。

**verify 脚本不是唯一能写这条标题的代码。** 产品 UI 对任何 `spec.uses` 含 `'ai'` 的应用点「问 AI」都走同一函数。19:08–19:14 那一行的**具体触发**是 BI verify 点了抄表夹具上的芯片。

---

## 1. 所有会写出「应用名 + 问」左栏标题的产品路径

全库字面量 ` · 问` **只有一处**：

```163:176:/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation/src/lib/app-platform.ts
  if (use === 'ai') {
    const cwd = loadCurrentWorkspaceCwd()
    if (!cwd.ok) throw new Error(cwd.error)
    const created = await runtimeApi.createAiSession({ cwd: cwd.cwd })
    const title = `${spec.name} · 问`
    await runtimeApi.renameAiSession(created.sessionId, title).catch(() => undefined)
    state.setActiveAiSessionId(created.sessionId)
    if (state.sidebarCollapsed) state.toggleSidebar()
    window.dispatchEvent(new CustomEvent('fde-x-ai-open', {
      detail: { sessionId: created.sessionId, title },
    }))
    await runtimeApi.promptAi(created.sessionId, {
      text: `我正在用应用「${spec.name}」。${spec.description || ''}请根据这个应用里已有的记录帮我。不要写外部业务系统。`,
    })
```

UI 入口只有 `AppCapabilityBar`：

```36:40:/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation/src/components/apps/AppCapabilityBar.tsx
  const run = async (use: FdePlatformUse) => {
    ...
      const result = await runDeclaredPlatformUse(use, spec, appId, { title, rowId })
```

```77:86:/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation/src/components/apps/AppCapabilityBar.tsx
        {uses.map((use) => (
          <button
            ...
            data-app-use={use}
            onClick={() => { void run(use) }}
          >
            {platformUseLabel(use)}
```

`platformUseLabel('ai')` = `'问 AI'`（`app-platform.ts:20-21`）。芯片在 `AppProductPage` compose/form 块里画出（`spec.uses` 含 `'ai'` 时）。

`renameAiSession` 全库仅两处：上面这一处，以及 `ask-ai.ts:112-114`（`opts.title`，**没有** ` · 问` 字面量）。

其余 Decision 6 / 新建会话，标题**不是**「应用名 · 问」：

| 路径 | 位置 | 标题 | 新建？ |
|---|---|---|---|
| `resolveTarget` 有 `opts.preset` | `src/lib/ask-ai.ts:94-118` | `opts.title` 若传入 | 是 |
| `runAppAgentJobs` | `src/lib/app-agent-action.ts:42-45` | `` `${appName} · ${actionLabel}` `` | 是（preset）；仅当 `action.label === '问'` 才同形；现网 spec 未见该 label |
| `AppCreateWizard` | `src/components/apps/AppCreateWizard.tsx:94-97` | `` `应用构建 · ${description.slice(0, 20)}` `` | 是 |
| `AppRuntime` 修订 | `src/components/apps/AppRuntime.tsx:97-100` | `` `应用修订 · ${spec.name}` `` | 是 |
| `createRemoteSession` | `src/pages/AI.tsx:523-541` | 不 rename | 是 → 左栏默认「未命名会话」 |
| `askAiForResult` 无 preset | `src/lib/ask-ai.ts:120-122` | 不改标题 | **复用** `loadCurrentAiTarget` |
| `askAiForRow` | `src/components/biz/RecordsPanel.tsx:1339-1360` | 不改标题 | **复用** 当前会话 |

决策 6 原文：专用 preset 时新开会话（左栏可见），是 `currentAiTarget` 的扩展（`docs/project-context.md` 决策 6）。应用「问 AI」实现上是 **无专用 preset 也 `createAiSession`**（现网该行 `agentPreset: "standard"`），标题由 rename 写成 ` · 问`。

---

## 2. 小区水电抄表是现网夹具

**库** `scene-39-personal-workstation/runtime/data/fde-workstation.sqlite`（mtime 2026-09-20 **19:14:31**）  
**行** `business_apps.id = app_9de6038b186a4e9786e28bc4f48add9d`

| 字段 | 现网 |
|---|---|
| name | 小区水电抄表 |
| status | active |
| uses | `["ai","plan"]` |
| slug | `estate-meter-log` |
| description | 记下小区水、电、气表的用量与抄表日，看本月概览、分类构成和流水，可问 AI，记完可摘成待办。 |

`GET http://127.0.0.1:4318/api/v1/business/apps?workspaceId=ws_personal` 同 id / name / uses。  
同名 draft `app_07cd41a…` 存在；**LEDGER_ID 钉的是这条 active。**

`src/` 无「小区水电抄表」字面量。名字只在 SQLite spec。

`loadCurrentAiTarget`（`src/lib/ai-target.ts:58-76`）给业务记录 / IM / ⌘K / 无 preset 的 `askAiForResult`。**产品页问 AI 不用它。**

---

## 3. 收口 verify 的 hops 不会开抄表；D22 会

`verify-records-bind-pipe-bi.mjs`：

1. **19:08:57** `POST /api/v1/ai/sessions`（L349-357）→ `out.sessionId = session-29041d8a-544f-4eed-88ca-c6feaa264778`。无 rename → 左栏先显示 **未命名会话**（`runtime/server.mjs:362`）。
2. hops 对该 id `prompt`（L272-281）。hop1 speech **「停用客户还有哪些没关的工单？」**（L400-401）。footer「现查 **19:09**」。hop2 19:10，过审 19:13，短名过审 19:14。DSH 把该会话标题 fallback 成首句（现网 title `停用客户还有哪些没关的工单`）。
3. **然后** D22（L572-580）：打开 `LEDGER_ID`，点 `[data-app-use="ai"]`。`askAiButton: true`，`aiLeft.sessionTitle: true`。这才进 `runDeclaredPlatformUse('ai')`。

```25:25:/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/internal/verify-records-bind-pipe-bi.mjs
const LEDGER_ID = 'app_9de6038b186a4e9786e28bc4f48add9d'
```

```572:580:/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/internal/verify-records-bind-pipe-bi.mjs
  const ledgerRow = page.locator(`[data-app-row="${LEDGER_ID}"]`)
  ...
  const askBtn = page.locator('[data-app-use="ai"]').first()
  out.askAiButton = await askBtn.count() > 0
  if (out.askAiButton) {
    await askBtn.click({ timeout: 10000 }).catch(() => {})
```

同一 LEDGER_ID → 点问 AI 的脚本还有：`verify-records-bind-pipe-bh.mjs`，`verify-records-close-ba…bg.mjs`，`verify-records-query-miss-bf.mjs`，`verify-app-create-az.mjs`。这就是「每收口一趟，左栏又多一条抄表 · 问」的重复来源。bh 产物 mtime 18:16–18:18，不在 19:08–19:14 窗。

---

## 4. 现网 leftover（2026-09-20 19:08–19:14 +8）

`GET http://127.0.0.1:4318/api/v1/ai/sessions`（host 4318 在）。cwd `/Users/zxz/Documents/ai-project/fdex测试`。磁盘 `~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/`。

该窗内只有两行：

| createdAt / updatedAt | title（现网原文） | sessionId | 首句 | 写入者 |
|---|---|---|---|---|
| **19:08:57** / **19:13:08** | 停用客户还有哪些没关的工单 | `session-29041d8a-544f-4eed-88ca-c6feaa264778` | `停用客户还有哪些没关的工单？` | bi.mjs `POST /api/v1/ai/sessions` L349-357 + `promptWait` L400-401。与 `verify-records-bind-pipe-bi.json` `sessionId` 相同 |
| **19:14:31** / 19:14:31 | **小区水电抄表 · 问** | `session-579c0d28-5782-4a3f-9ad6-9746956d8fae` | `我正在用应用「小区水电抄表」。记下小区水、电、气表的用量与抄表日，看本月概览、分类构成和流水，可问 AI，记完可摘成待办。请根据这个应用里已有的记录帮我。不要写外部业务系统。` | `runDeclaredPlatformUse('ai')` `app-platform.ts:166-176`，由 bi.mjs L577-580 点击触发 |

首句与 `app-platform.ts:174-176` 模板 + 现网 spec.name/description **逐字相合**（描述与「请根据」之间无空格）。json mtime **19:14:40**；sqlite mtime **19:14:31**（与抄表会话 createdAt 同一秒）。

现网该窗 **没有** `blank:true` / 标题仍为「未命名会话」的行。截图里夹着的「未命名会话」是 hops 那条在 rename/fallback 之前的默认标题（`runtime/server.mjs:362`，`runtime/ai-stream.mjs:328`）。

更早 leftover（同一对：先「停用客户…」再「小区水电抄表 · 问」）在 18:55/18:56、18:06–18:17、16:47/16:49… 一路排到当天凌晨，形状与反复跑 D22 一致。19:08–19:14 **新造的抄表行只有 `579c0d28` 这一条**。

---

## 5. 一句收口

- **产品写入函数：** `runDeclaredPlatformUse` / `src/lib/app-platform.ts:163-176`  
- **UI 触发：** `AppCapabilityBar` 点「问 AI」`data-app-use="ai"`  
- **19:14 那一行的触发：** `verify-records-bind-pipe-bi.mjs` L572-580，打开抄表夹具后点同一芯片  
- **hops 不是抄表会话的作者**  
- **产品 UI 对任意带 `uses`⊇`ai` 的应用点问 AI 也会新建**；verify 只是把这颗芯片每次都点在抄表夹具上，所以 leftover 标题总是「小区水电抄表 · 问」
