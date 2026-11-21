# FDE-X Desktop 完整改造方案（Coding Agent 执行件）

# 项目背景与执行环境（来自 HANDOFF.md）

> Coding Agent 开始任何工作前必须先读完本节。本节内容来自仓库根目录 `HANDOFF.md`，权威性高于一切注释和旧文档。
> 

## 仓库与本地环境

| 项目 | 值 |
| --- | --- |
| 本地源码目录 | `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation` |
| 远程仓库 | `https://github.com/losebird/fde-x-desktop.git`，主分支 `main` |
| 前端开发服务 | `pnpm dev` / `npm start` → `scripts/dev.mjs`，监听 `127.0.0.1:5174` |
| BFF 端口 | `4318`；对端联调 `5175` / `4319` |
| DSH Home | `~/.dsh-fde-x` |
| SQLite 数据库 | `runtime/data/fde-workstation.sqlite` |
| Host pin | `0.2.0-rc.2`（`runtime/generation.mjs`） |

## 产品架构速览

- **壳**：FDE-X（React + BFF 4318）
- **AI**：DSH iframe，挂在 `/dsh-app/` 路径下
- **IM & 过账**：lan-assist
- **记忆**：semantic-os
- **应用自有数据**：本机 SQLite

## 执行纪律（违反即停）

1. **不硬编码**任何路径或端口，统一走 `config.mjs` 环境变量。
2. **不偷懒**：不打补丁修 bug，从根因改起。
3. **不无故杀 `pnpm dev`**：调试时用 `node runtime/server.mjs` 单独启动 BFF。
4. **不 `npm i -g`**：不覆盖 Homebrew 安装的 DSH；依赖变更走 `pnpm add`。
5. **pin 是 `0.2.0-rc.2`**：`runtime/generation.mjs` 里不改 host pin。

## 权威文件读取顺序

1. `HANDOFF.md`（本节来源，最高优先级）
2. `AGENTS.md`
3. `PRODUCTION-SPEC.md` §0–§3、§0.5

> **§0.5 覆盖所有冲突**。`docs/archive/` 是考古资料，不按那里写代码。
> 

## 应用占用（已活测）

现成 HTML → 托管 Web → 刷新数据还在 → 分享 URL 是网站本身。

## 关键代码路径

| 层 | 文件 |
| --- | --- |
| BFF Runtime | `runtime/apps/{spec,bundle,web-host,documents,share,repository}.mjs` |
| BFF Routes | `runtime/routes/{apps,app-share,public-app}.mjs` |
| 前端运行时 | `src/components/apps/AppWebRuntime.tsx` |
| 公开分享页 | `src/pages/PublicApp.tsx` |

---

# 执行前必读

本文件是 FDE-X Desktop 项目的**唯一执行件**，基于对 `preview/mac-all-2026-10-19` 分支的三轮深度分析生成：架构稳定性评估、Code Review、功能缺陷分析。

**执行原则（优先级高于一切）：**

1. 每个阶段做完必须跑：`npx tsc -b --pretty false`（无新增错误）+ 对应 smoke/check 命令。
2. 不借「顺便」改动 `PRODUCTION-SPEC.md §0.1` 锁定的 className、组件树结构。
3. 每个 Issue 修完立刻 commit，commit message 格式：`fix(编号): 一句话`。
4. 遇到规格与代码冲突：**停下来补文档，不要自行判断**。
5. 本文件按 Phase 顺序执行，Phase 内按 Issue 编号顺序执行。
6. TypeScript 新增代码必须无类型错误；存量错误不计，但不得新增。

---

# Phase 0 — 基础安全加固（必须最先完成）

> **验收**：`node runtime/smoke.mjs` 全绿；`node runtime/check.mjs` 全绿；浏览器打开工作台主页无 console error。
> 

## S-01 补全 security-headers.mjs 的 CSP

**文件**：`runtime/security-headers.mjs`

**问题**：当前只有 3 个响应头，缺 `Content-Security-Policy`，XSS 一旦发生 iframe 和本地资源全在攻击面。

**改法**：

```jsx
export function workbenchApiHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self' http://127.0.0.1:* http://localhost:*; object-src 'none';",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  }
}
```

> `frame-src` 必须放行 loopback（DSH iframe `/dsh-app/`），其余来源不放行。部署后验证 AI iframe 仍能加载。
> 

---

## S-02 删除 vite.config.ts 中的硬编码开发机路径

**文件**：`vite.config.ts`

**问题**：`'/Users/zxz/Documents/ai-project/IUI'` 写死了开发者路径，他人环境静默降级为 stub。

**改法**：删除 `resolveIuiSrc()` candidates 数组中该路径，只保留：

```tsx
const candidates = [
  process.env.FDE_IUI_SRC,
  join(FDE_DSH_HOME, 'iui-src', IUI_PIN.commit),
]
```

---

## S-03 补全 stripSecrets 的脱敏字段

**文件**：`runtime/server.mjs`（约第 230 行的 `stripSecrets` 函数）

**问题**：只过滤 `token / password / authorization / cookie`，遗漏 `api_key / secret / private_key / credential`。

**改法**：

```jsx
const STRIP_KEYS = new Set(['token', 'password', 'authorization', 'cookie', 'api_key', 'apikey', 'secret', 'private_key', 'credential', 'access_token', 'refresh_token'])

function stripSecrets(value) {
  if (Array.isArray(value)) return value.map(stripSecrets)
  if (value && typeof value === 'object') {
    const next = {}
    for (const [key, child] of Object.entries(value)) {
      if (STRIP_KEYS.has(key.toLowerCase())) continue
      next[key] = stripSecrets(child)
    }
    return next
  }
  return value
}
```

> `runtime/routes/biz.mjs` 里有同名函数，**同步修改**。
> 

---

## S-04 修复 yamlScalar 缺少 `{}[]` 转义

**文件**：`runtime/server.mjs`（`yamlScalar` 函数）

**问题**：缺对 `{`、`}`、`[`、`]` 的处理，含这些字符的用户输入会被 YAML 解析器当作内联结构。

**改法**：在正则中补充这四个字符：

```jsx
function yamlScalar(value) {
  const text = String(value ?? '')
  if (
    text === ''
    || /[:#\n&*?|>!%@`{}\[\]]/.test(text)
    || /^(true|false|null|yes|no)$/i.test(text)
  ) return JSON.stringify(text)
  return text
}
```

---

## S-05 修复 tokenEquals timing-safe 比较顺序

**文件**：`runtime/routes/bridge.mjs`（`tokenEquals` 函数）

**问题**：先 `timingSafeEqual` 后检查 `length`，短路求值仍泄露时序。

**改法**：先检查长度再比较：

```jsx
function tokenEquals(value, expected) {
  const expectedText = typeof expected === 'string' ? expected : ''
  const valueBytes = Buffer.from(value)
  const expectedBytes = Buffer.from(expectedText)
  if (valueBytes.length !== 64 || expectedBytes.length !== 64) return false
  const left = Buffer.alloc(64)
  const right = Buffer.alloc(64)
  valueBytes.copy(left)
  expectedBytes.copy(right)
  return timingSafeEqual(left, right)
}
```

---

## S-06 修复默认 CORS origin 白名单含对端端口

**文件**：`runtime/config.mjs`（`parseAllowedOrigins` 函数）

**问题**：未配置 `FDE_ALLOWED_ORIGINS` 时，默认包含对端端口 `4319/5175`，使对端实例可对本机发起跨 origin 写操作。

**改法**：默认白名单只含当前实例端口：

```jsx
export function parseAllowedOrigins(raw) {
  if (raw && String(raw).trim()) {
    return String(raw).split(',').map((v) => v.trim()).filter(Boolean)
  }
  const hosts = ['127.0.0.1', 'localhost']
  const webPorts = [4173, 5173, FDE_WEB_PORT]  // 移除 5175
  const runtimePorts = [FDE_RUNTIME_PORT, 4318]  // 移除 4319
  const origins = new Set()
  for (const host of hosts) {
    for (const p of webPorts) origins.add(`http://${host}:${p}`)
    for (const p of runtimePorts) origins.add(`http://${host}:${p}`)
  }
  return [...origins]
}
```

> 对端联调场景（`npm run dev:peer`）需要用户自行通过 `FDE_ALLOWED_ORIGINS` 环境变量添加对端 origin。在 README 补充说明。
> 

---

# Phase 1 — BFF 层 Bug 修复

> **验收**：`node runtime/smoke.mjs` 全绿；`node runtime/mcp-probe.check.mjs` 全绿；手动测 `/api/v1/biz/preview` 和 `/api/v1/biz/write` 正常返回。
> 

## B-01 消除 server.mjs 中 workspaceCwdOf 函数名遮蔽

**文件**：`runtime/server.mjs`

**问题**：顶部从 `session-bind.mjs` 导入的 `workspaceCwdOf` 被本地同名函数覆盖，造成隐蔽的命名遮蔽 bug。

**改法**：将本地函数重命名为 `resolveOperationCwd`，并更新所有调用处：

```jsx
// 原：
function workspaceCwdOf(operation) { ... }

// 改为：
function resolveOperationCwd(operation) { ... }
```

搜索 `server.mjs` 中所有 `workspaceCwdOf(` 调用，确认来自导入的调用不受影响，本地逻辑调用改为 `resolveOperationCwd(`。

---

## B-02 用 js-yaml 替换手写 YAML 正则解析

**文件**：`runtime/server.mjs`（`readSettingsProviderProfile`、`findSettingsProviderBlockRange`、`formatSettingsProviderBlock` 三个函数）

**问题**：手写 20+ 个正则提取 YAML 字段，无法处理多行值、锚点、特殊字符，已经出现嵌套 fallback。

**改法**：

1. 检查 DSH 进程的 `createRequire` 是否能 resolve `js-yaml`；若不行，在 `package.json` devDependencies 加 `"js-yaml": "^4.1.0"`，同时加 `"@types/js-yaml": "^4.0.9"`。
2. 重写 `readSettingsProviderProfile`：

```jsx
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'

function readSettingsProviderProfile(filePath, route) {
  let doc
  try {
    const text = readFileSync(filePath, 'utf8')
    doc = yaml.load(text)
  } catch { return null }
  const providers = doc?.providers
  if (!providers || typeof providers !== 'object') return null
  const profile = providers[route]
  if (!profile) return null
  return {
    displayName: String(profile.displayName || ''),
    api: String(profile.api || 'openai-completions'),
    baseURL: String(profile.baseURL || ''),
    apiKeyEnv: String(profile.apiKeyEnv || ''),
    models: Array.isArray(profile.models) ? profile.models : [],
  }
}
```

1. `formatSettingsProviderBlock` 和 `findSettingsProviderBlockRange` 对应改为用 `yaml.dump` 生成片段后做字符串替换，或直接重写整个文件（读→改 doc→dump→写）。

> 这是本次改动中风险最高的一个，改完后必须手动测试「设置 → AI 核心 → 添加/修改模型提供商」的完整流程。
> 

---

## B-03 修复 listHostSessions 缓存并发不安全

**文件**：`runtime/session-primary.mjs`

**问题**：多个并发调用进来时，每次都覆盖 `hostListHold.inflight`，导致前一个 Promise 被丢弃。

**改法**：

```jsx
let hostListHold = { at: 0, items: null, inflight: null }

export async function listHostSessions(aiRuntime, { force = false } = {}) {
  if (!aiRuntime || typeof aiRuntime.call !== 'function') return []
  const now = Date.now()
  if (!force && hostListHold.items && now - hostListHold.at < 1500) {
    return hostListHold.items
  }
  // 有 in-flight 时直接复用，不重复发请求
  if (hostListHold.inflight) return hostListHold.inflight
  const promise = aiRuntime.call('session/list', { _request: {} })
    .then((result) => {
      hostListHold = { at: Date.now(), items: Array.isArray(result) ? result : [], inflight: null }
      return hostListHold.items
    })
    .catch((error) => {
      hostListHold = { ...hostListHold, inflight: null }
      throw error
    })
  hostListHold = { ...hostListHold, inflight: promise }
  return promise
}
```

---

## B-04 合并重复的 exchangeNocoBaseToken 实现

**文件**：`runtime/server.mjs` 和 `runtime/routes/biz.mjs`

**问题**：两个文件各有一份完全相同的 `exchangeNocoBaseToken`，安全修复（如 S-03 脱敏）无法同步。

**改法**：

1. 新建 `runtime/nocobase-auth.mjs`，导出 `exchangeNocoBaseToken`。
2. `server.mjs` 和 `routes/biz.mjs` 各自改为 `import { exchangeNocoBaseToken } from '../nocobase-auth.mjs'`，删除本地定义。

---

## B-05 修复 WebSocket stream signal 监听器泄露

**文件**：`runtime/dsh-core.mjs`（`stream` 方法，约生成器函数体末尾）

**问题**：`signal?.addEventListener('abort', onAbort, { once: true })` 在 stream 正常结束时不会被移除，持有 closure 引用造成内存泄露。

**改法**：在 generator 的 `finally` 块中显式移除：

```jsx
try {
  // ... 原有 yield 循环
} finally {
  signal?.removeEventListener('abort', onAbort)
  closeSocket()
}
```

> 注意 generator 的 `return` 和 `throw` 路径都会走 `finally`，确保 `closeSocket` 不重复调用（已有 guard 则保留）。
> 

---

## B-06 修复 vite.config.ts 中多余的 /api 兜底代理

**文件**：`vite.config.ts`（`runtimeProxy` 对象末尾）

**问题**：`'/api': { target: runtimeUrl, ... }` 是宽泛兜底，与 PRODUCTION-SPEC §0.5「删 `/api` catch-all」矛盾，且覆盖范围超过 `/api/v1`。

**改法**：直接删除 `runtimeProxy` 中的 `'/api'` 条目。验证现有功能路由（`/api/v1`、`/health`、`/live`、`/dsh-app` 等）仍正常。

---

# Phase 2 — 前端 Store 重构（高影响，需谨慎）

> **前提**：Phase 0 和 Phase 1 全部完成并通过验收。
**验收**：`npx tsc -b --pretty false` 无新增错误；所有面板（AI / 计划 / 文件 / 记忆 / 早报 / 业务应用）正常渲染；localStorage 数据在刷新后正确恢复。
> 

## F-01 拆分单体 Store

**文件**：`src/store/app.ts`（当前 ~1473 行）

**问题**：所有前端状态全在一个 `persist` store，任何子模块 `set()` 都会触发全局重渲染，localStorage 序列化负担重。

**改法**（渐进式，不要一次全改）：

**步骤 1**：从 `app.ts` 中抽取 UI 面板状态，新建 `src/store/panels.ts`：

```tsx
// src/store/panels.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
// 迁移：panels / floating / floatingZTop / drawers 相关的 state + actions
// partialize 只保留 panels / floating / floatingZTop / drawers
export const usePanels = create(persist(...))
```

**步骤 2**：抽取 IM 相关状态，新建 `src/store/im.ts`：

```tsx
// src/store/im.ts
// 迁移：imContacts / imMessages / imTopics / imComposerDrafts / imBrowse / activeThreadId
// imFillBind / imMuted / muteBlocksIm
// partialize: imComposerDrafts / imMuted / muteBlocksIm
export const useIM = create(persist(...))
```

**步骤 3**：`app.ts` 中保留原有导出（`useApp`），但内部通过 selector 转发到新 store，保证现有调用点无需同步修改。迁移稳定后再逐步更新调用点。

**步骤 4**：在 `app.ts` 的 `persist` 配置中，把已迁移到独立 store 的字段从 `partialize` 中移除，避免双重持久化。

> **禁止**：不要一次性把所有 state 迁移，每个 store 迁移后单独验收。
> 

---

## F-02 移除生产 store 中的 mock 数据和假逻辑

**文件**：`src/store/app.ts`

**问题**：`sendMessage` 调用 `mockAssistantReply`（本地假回复），`parseIMInput` 是完全 mock 的关键词匹配，`mockTranslation` 假翻译，初始值 `activeChatId: 'c1'`、`activeAgentId: 'a_main'`、`activeBusinessTable: 'bt_orders'` 是 seed 数据。

**改法**：

1. `sendMessage`：保留本地追加用户消息的逻辑，删除 `setTimeout` 里的假回复。真实 AI 回复由 DSH iframe 通过 postMessage 驱动，不在 store 里模拟。
2. `parseIMInput`：删除整个函数体，改为直接 return `''`（由调用方检查空值后决定是否展示）。
3. `mockTranslation`：删除函数，`translateIMMessage` 改为调用 `runtimeApi` 实际翻译接口（若接口未实现则 return，不 mock）。
4. 初始值：`activeChatId: null`、`activeAgentId: null`、`activeBusinessTable: null`。

---

## F-03 修复 workflowRunLockRef 不随 store 重置的问题

**文件**：`src/store/app.ts`

**问题**：`workflowRunLockRef` 在 store 外部声明，`resetDemo()` 不清理它，热重载后也不清理，工作流 run 卡住后永远无法再次触发。

**改法**：将锁移入 store state（不持久化）：

```tsx
// 在 State interface 添加：
workflowRunLocks: Set<ID>

// buildInitial() 中：
workflowRunLocks: new Set(),

// resetDemo() 中：
workflowRunLocks: new Set(),

// runWorkflow 中改为：
if (get().workflowRunLocks.has(id)) return
set((s) => ({ workflowRunLocks: new Set([...s.workflowRunLocks, id]) }))
// ... 完成后：
set((s) => { const next = new Set(s.workflowRunLocks); next.delete(id); return { workflowRunLocks: next } })
```

> `partialize` 中不包含 `workflowRunLocks`，不持久化到 localStorage。
> 

---

## F-04 修复浮窗 z-index 无上界

**文件**：`src/store/app.ts`

**问题**：`nextZ` 单调递增，长时间使用后超出浏览器安全范围。

**改法**：关闭所有浮窗时重置计数器：

```tsx
closeFloating: (view) =>
  set((s) => {
    const target = view ?? getTopFloatingView(s.floating)
    if (!target || !s.floating[target]) return {}
    const nextFloating = omitFloating(s.floating, target)
    const isEmpty = Object.keys(nextFloating).length === 0
    return {
      floating: nextFloating,
      ...(isEmpty ? { floatingZTop: FLOATING_BASE_Z } : {}),
    }
  }),
```

---

## F-05 补全 store 迁移注释（v10–v18）

**文件**：`src/store/app.ts`（`migrate` 函数上方的注释）

**问题**：注释止于 v9，v10–v18 完全无文档，`migrate` 函数里只有 `if (from < 13)` 一个分支。

**改法**：补充每个版本的迁移说明（通过 git log 追溯或询问人工确认），并在 `migrate` 函数中补充 v13–v19 的具体迁移逻辑（至少注明「无 schema 变更，升级静默通过」）。

---

# Phase 3 — 功能闭环（核心体验补全）

> **验收**：每个 Issue 有对应的手动验证步骤，做完后在此文档的「验收记录」section 追加。
> 

## FN-01 AI 会话列表改为 SSE 事件驱动

**文件**：`src/pages/AI.tsx`

**问题**：每 2 秒全量轮询会话列表，每分钟 30 次请求。BFF 已有完整 SSE 事件总线和 `ai.session.changed` 事件。

**改法**：

1. 保留首次加载的全量拉取（`reloadRemoteSessions`）。
2. 删除 `setInterval` 轮询（已有的 2000ms 定时器）。
3. 在 `useEvents` 中订阅 `ai.session.changed` 事件，收到后调用 `reloadRemoteSessionsRef.current()` 增量更新：

```tsx
useEvents(
  ['ai.session.changed'],
  () => { void reloadRemoteSessionsRef.current().catch(() => undefined) },
  workspaceCwd ? { workspace: workspaceCwd } : undefined,
)
```

1. 保留一个 30 秒的兜底轮询（SSE 断线保护），替换原来的 2 秒轮询：

```tsx
useEffect(() => {
  if (!runtimeConnected) return
  const timer = window.setInterval(() => {
    void reloadRemoteSessionsRef.current().catch(() => undefined)
  }, 30_000)  // 从 2000 改为 30000
  return () => window.clearInterval(timer)
}, [runtimeConnected, sessionLane, activeWorkspaceId])
```

---

## FN-02 AI 会话列表增加搜索框

**文件**：`src/pages/AI.tsx`

**问题**：会话积累后只能靠眼睛扫，没有搜索入口。

**改法**：在左侧会话列表顶部添加搜索输入框，本地过滤 `visibleSessions`：

```tsx
const [sessionSearch, setSessionSearch] = useState('')

const displaySessions = useMemo(() => {
  if (!sessionSearch.trim()) return visibleSessions
  const q = sessionSearch.trim().toLowerCase()
  return visibleSessions.filter((s) =>
    (s.title || '').toLowerCase().includes(q)
  )
}, [visibleSessions, sessionSearch])
```

在会话列表 DOM 顶部插入（符合 §0.5 输入条规范，不改 className）：

```tsx
<input
  className="input h-7 text-sm w-full mb-2"
  placeholder="搜索会话"
  value={sessionSearch}
  onChange={(e) => setSessionSearch(e.target.value)}
/>
```

> 只插入 input，不改任何现有 className 或布局。
> 

---

## FN-03 AI 整理待办：绑定 AbortController 传递到后端

**文件**：`src/pages/Plan.tsx`（`runOrganizeTodos` 函数）

**问题**：用户关闭面板后 `flight.cancelActive()` 只影响前端状态，DSH 仍在消耗 tokens。

**改法**：`ticket` 中的 `signal` 已经存在，确保它被正确传递并在面板卸载时 abort：

```tsx
useEffect(() => {
  const flight = organizeFlight.current
  return () => {
    flight.cancelActive()  // 确保调用已存在的 cancelActive
  }
}, [])
```

检查 `createAskFlight` 的实现（`runtime/plan/ask-flight.mjs`），确认 `cancelActive()` 内部确实调用了 `controller.abort()`；若没有，补全该调用。

---

## FN-04 文件编辑离开确认替换为 modal

**文件**：`src/pages/Files.tsx`

**问题**：`window.confirm` 是阻塞式原生弹窗，在 Electron 壳行为不一致。

**改法**：

1. 新增一个简单的确认 modal 组件（inline 在 Files.tsx 底部，不新建文件）：

```tsx
function ConfirmLeaveModal({ open, onConfirm, onCancel }: { open: boolean; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-ink/30 flex items-center justify-center">
      <div className="bg-surface border border-line rounded-xl p-6 shadow-2xl max-w-sm w-full">
        <p className="text-sm mb-4">有未保存的修改，离开将丢失。继续？</p>
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onCancel}>取消</button>
          <button className="btn-primary" onClick={onConfirm}>继续离开</button>
        </div>
      </div>
    </div>
  )
}
```

1. 将所有 `window.confirm(...)` 调用替换为展示该 modal + 回调。

---

## FN-05 早报各 section 支持单独重试

**文件**：`src/pages/Briefing.tsx` + `src/lib/runtime-api.ts`（或 `.ts`）+ `runtime/routes/briefing.mjs`

**问题**：某个 section 失败时，重试触发 `runFull`，重跑整份早报浪费大量 token。

**改法**：

1. BFF 在 `runtime/routes/briefing.mjs` 中确认（或添加）`POST /api/v1/briefing/run` 支持 `{ mode: 'section', sectionId: string }` 参数，只重跑指定 section。
2. `runtimeApi` 中添加：

```tsx
runBriefingSection(sectionId: string, opts: { workspaceCwd?: string }): Promise<...>
```

1. `Briefing.tsx` 中将 section 失败时的「重试」按钮改为调用 `runBriefingSection`：

```tsx
<button type="button" className="btn-ghost text-xs" onClick={() => runSection(section.id)}>
  重试
</button>
```

---

## FN-06 记忆搜索防竞态

**文件**：`src/pages/Memory.tsx`（`FindPanel` 组件）

**问题**：快速输入时旧查询可能比新查询晚返回，覆盖最新结果。

**改法**：加请求序列号：

```tsx
const searchSeqRef = useRef(0)

useEffect(() => {
  if (!q.trim()) { setHits([]); return }
  const seq = ++searchSeqRef.current
  const handle = window.setTimeout(() => {
    void runtimeApi.searchMemory(q.trim()).then((data) => {
      if (seq !== searchSeqRef.current) return  // 丢弃过期结果
      // ... 更新 hits
    }).catch(...)
  }, 280)
  return () => window.clearTimeout(handle)
}, [q])
```

---

## FN-07 记忆草稿支持批量入档

**文件**：`src/pages/Memory.tsx`（`CardsArchive` 组件）

**问题**：只能逐条点头入档，积累几十条时极其繁琐。

**改法**：在草稿列表顶部添加「全部入档」按钮：

```tsx
{tab === '起草' && visible.length > 1 && (
  <button
    type="button"
    className="btn mb-3"
    onClick={async () => {
      for (const row of visible) {
        const id = String(row.id || '')
        if (!id) continue
        await runtimeApi.nodMemoryCard(id).catch(() => undefined)
      }
      setTick((n) => n + 1)
    }}
  >
    全部入档（{visible.length} 条）
  </button>
)}
```

---

## FN-08 记忆卡片支持编辑

**文件**：`src/pages/Memory.tsx`（`CardsArchive` 中的卡片渲染部分）

**问题**：用户发现 AI 写错的记忆无法修改，只能删除重来。

**改法**：

1. 确认（或添加）`runtimeApi.updateMemoryCard(id, { cue, body })` 接口。
2. 卡片展示中添加「编辑」按钮，点击展开内联编辑表单（不新建页面/路由）：

```tsx
const [editing, setEditing] = useState<string | null>(null)
const [editCue, setEditCue] = useState('')
const [editBody, setEditBody] = useState('')

// 点编辑时：
<button onClick={() => { setEditing(id); setEditCue(cue); setEditBody(body) }}>编辑</button>

// 编辑态时展示：
{editing === id && (
  <form onSubmit={...}>
    <input className="input w-full mb-1" value={editCue} onChange={...} />
    <textarea className="input w-full mb-2" value={editBody} onChange={...} />
    <div className="flex gap-2">
      <button type="submit" className="btn-primary h-7 px-2">保存</button>
      <button type="button" className="btn h-7 px-2" onClick={() => setEditing(null)}>取消</button>
    </div>
  </form>
)}
```

---

## FN-09 文件上传改为 FormData 流式上传

**文件**：`src/pages/Files.tsx`（文件上传的 `onChange` handler）

**问题**：`reader.readAsDataURL(file)` 把整个文件读入内存转 base64，大文件（几十 MB）会引发内存峰值。

**改法**：

1. 检查 `runtimeApi.uploadWorkspaceFile` 的实现，确认 BFF 端 `POST /api/v1/files/upload` 路由是否支持 `multipart/form-data`。
2. 若支持，前端改为：

```tsx
const form = new FormData()
form.append('file', file)
form.append('name', rel)
if (sessionId) form.append('sessionId', sessionId)
const response = await fetch('/api/v1/files/upload', { method: 'POST', body: form })
```

1. 若 BFF 路由目前只接受 base64，则在 BFF 添加 multipart 支持，并保留 base64 路径作为 fallback。

---

## FN-10 离线/断连时显示全局降级横幅

**文件**：`src/components/IMScreen.tsx`（主壳）

**问题**：DSH 核心断开时，计划/文件/早报等面板静默失败，用户无法区分「服务不可用」和「数据为空」。

**改法**：在 `IMScreen` 顶部横幅区域（`taskToast` 下方）添加断连提示：

```tsx
const coreConnected = useApp((s) => /* 读取 core 连接状态 */)

{!coreConnected && (
  <div className="shrink-0 px-3 py-1.5 text-xs bg-accent-red/10 text-accent-red border-b border-accent-red/20 flex items-center gap-2">
    <WifiOff size={12} />
    本地核心未连接，部分功能不可用。
    <button className="ml-auto btn h-6 px-2" onClick={...}>重连</button>
  </div>
)}
```

> 核心连接状态通过 `useCoreStatus()` 或现有的 `core.connected` 读取，不新增状态。横幅只在实际断连时显示，连接成功后自动消失。
> 

---

# Phase 4 — 性能与工程质量

> **验收**：`npm run lint` 无新增 error；`npx tsc -b --pretty false` 无新增错误；Performance 面板里主线程 long task 减少。
> 

## P-01 统一 setInterval 轮询为 SSE 兜底策略

**文件**：`src/pages/Briefing.tsx`

**问题**：`pendingDigest` 触发 1500ms 轮询，最长 3.5 分钟，完全轮询驱动。

**改法**：

1. 保留 `useEvents(['briefing.ready'], () => refresh(false))` 作为主驱动。
2. 将 `pendingDigest` 轮询间隔从 `1500` 改为 `5000`（5 秒），作为 SSE 丢失事件的兜底。
3. 超时上限从 `210_000`（3.5分钟）改为 `300_000`（5分钟），与早报生成的实际最长时间对齐。

---

## P-02 修复 OfficeDocPreview dangerouslySetInnerHTML XSS 风险

**文件**：`src/pages/Files.tsx`（`OfficeDocPreview` 组件）

**问题**：`dangerouslySetInnerHTML={{ __html: sanitizeOfficeHtml(html) }}` 直接渲染由 mammoth 转换的 Word HTML。检查 `sanitizeOfficeHtml` 实现：

1. 若该函数已用 DOMPurify 或等效库做完整净化，则**无需修改**，仅添加注释说明。
2. 若只是简单字符串替换，则安装 `dompurify` + `@types/dompurify`，改为：

```tsx
import DOMPurify from 'dompurify'
const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
```

---

## P-03 xlsx 包替换为已有的 exceljs

**文件**：`package.json`

**问题**：`xlsx: ^0.18.5` 有已知 prototype pollution 漏洞，且已停止维护。项目中已存在 `exceljs: ^4.4.0`。

**改法**：

1. 搜索项目中所有 `import ... from 'xlsx'` 和 `require('xlsx')` 的使用点。
2. 逐一用 `exceljs` API 重写（exceljs API 文档：[https://github.com/exceljs/exceljs）。](https://github.com/exceljs/exceljs%EF%BC%89%E3%80%82)
3. 确认无使用后，从 `package.json` dependencies 删除 `xlsx`，运行 `pnpm install`。

> 若某处依赖 `xlsx` 的特定功能（如 XLS 老格式读取）exceljs 不支持，保留该处并添加注释 `// TODO: 迁移 xlsx`，不强行替换。
> 

---

## P-04 统一包管理器，删除 package-lock.json

**文件**：根目录

**问题**：同时存在 `pnpm-lock.yaml` 和 `package-lock.json`，依赖解析不一致。README 用 `npm i` 而 lint 脚本用 `pnpm tsc -b`。

**改法**：

1. 删除根目录 `package-lock.json`。
2. 在根目录 `.gitignore` 中添加 `package-lock.json`（确保不被意外提交）。
3. [README.md](http://README.md) 的安装命令改为 `pnpm i`。
4. `apps/desktop/package-lock.json` 参考 [HANDOFF.md](http://HANDOFF.md) 说明保留（不提交），`.gitignore` 确认已忽略。

---

## P-05 修复 TypeScript 编译错误（存量清零目标）

**文件**：全项目

**问题**：[HANDOFF.md](http://HANDOFF.md) 承认「`pnpm tsc -b` 长期可能红」，实际上 TypeScript 检查被系统性放弃。

**改法**（渐进式，不要求一次全部修完）：

1. 运行 `npx tsc -b --pretty false 2>&1 | grep error | wc -l` 获取当前错误总数。
2. 按文件分组，优先修复 `src/lib/`、`src/store/` 中的类型错误（调用处最多）。
3. 对暂时无法修复的，使用 `// @ts-expect-error 原因说明` 而非 `// @ts-ignore`（前者在错误消失时会提醒清理）。
4. 目标：每次 Phase 结束后错误总数不增加，逐步向 0 趋近。

---

# Phase 5 — 早报与计划调度健壮性

> **验收**：手动修改系统时区，早报触发时间正确；工作流重启后不批量补发历史触发点。
> 

## SC-01 工作流调度持久化上次触发时间，避免重启后批量补发

**文件**：`runtime/plan/workflow-schedule.mjs`

**问题**：`occurrenceInstants` 返回从创建到现在所有应触发点，重启后可能批量补发历史。

**改法**：

1. 在 SQLite 添加一个轻量表（通过新 migration 文件）：

```sql
CREATE TABLE IF NOT EXISTS workflow_schedule_state (
  event_id TEXT PRIMARY KEY,
  last_fired_at TEXT NOT NULL
) STRICT;
```

1. `tickWorkflowSchedules` 中，对每个 `occurrence`，查询 `workflow_schedule_state`，只触发**上次触发时间之后**的最近一次错过点（最多补一次）：

```jsx
const lastFired = db.prepare(
  'SELECT last_fired_at FROM workflow_schedule_state WHERE event_id = ?'
).get(row.id)?.last_fired_at

const pending = points.filter((iso) =>
  !lastFired || iso > lastFired
).slice(-1)  // 最多补最近一次

for (const occurrence of pending) {
  // 触发后更新 last_fired_at
  db.prepare(
    'INSERT OR REPLACE INTO workflow_schedule_state (event_id, last_fired_at) VALUES (?, ?)'
  ).run(row.id, occurrence)
  // ... startWorkflowRun
}
```

---

## SC-02 早报调度加入用户时区感知

**文件**：`runtime/briefing/scheduler.mjs`（`shouldFireSchedule` 函数）

**问题**：早报触发时间对比的是 Node 进程时间，没有用户时区，夏令时或修改 macOS 时区后会漂移。

**改法**：

1. 早报定义（`BriefingDefinition`）的 `schedule` 字段添加 `timezone?: string`，默认 `'Asia/Shanghai'`（用户可在早报设置里修改）。
2. `shouldFireSchedule` 改为用 `Intl.DateTimeFormat` 获取当前时区的小时分钟：

```jsx
function shouldFireSchedule(schedule, now, timezone = 'Asia/Shanghai') {
  const at = schedule.at || '08:30'
  const [hh, mm] = at.split(':').map(Number)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric', minute: 'numeric', hour12: false,
  })
  const parts = fmt.formatToParts(now)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return hour === hh && minute === mm
}
```

---

# 验收记录

> Coding Agent 每完成一个 Issue，在此追加一行：`[编号] 完成 · commit: xxxx · 验收：通过/失败(原因)`
> 

（待填写）

---

# Phase 6 — 扩展功能（原附录补入）

> **验收**：每个 Issue 有对应的手动验证步骤，做完后在「验收记录」section 追加。
> 

## EX-01 IM sendIM 接入 lan-assist 实际发送

**文件**：`src/store/app.ts`（`sendIM` action）+ BFF 路由

**背景**：当前 `sendIM` 只往本地 store 追加一条消息，消息不会发送给对端。PRODUCTION-SPEC §0.5 要求 IM 走 `lan-assist`。

**执行前置条件**：确认 lan-assist 进程已启动且 `/api/v1/im/send`（或等效路由）在 BFF 侧已存在或可添加。若 BFF 路由完全缺失，先在 `runtime/routes/` 新增，再接前端。

**改法**：

1. 在 BFF 确认（或新增）`POST /api/v1/im/send` 路由，调用 `aiRuntime.lanAssist('/send', { ... })`，返回发送结果。
2. `runtimeApi` 添加：

```tsx
sendImMessage(params: { threadId: string; text: string; attachments?: unknown[]; topicId?: string; replyToId?: string }): Promise<{ ok: boolean; messageId?: string }>
```

1. `app.ts` 的 `sendIM` 改为先乐观追加本地消息（保留现有逻辑），再异步调用 `runtimeApi.sendImMessage`；若调用失败，将本地消息标记为发送失败状态（`sendFailed: true`）：

```tsx
sendIM: (threadId, text, opts) => {
  const localMsg = { id: uid('mm'), threadId, authorId: 'u_self', text, ts: now(), read: true, ... }
  set((s) => ({ imMessages: [...s.imMessages, localMsg] }))
  void runtimeApi.sendImMessage({ threadId, text, ...opts }).catch(() => {
    set((s) => ({
      imMessages: s.imMessages.map((m) =>
        m.id === localMsg.id ? { ...m, sendFailed: true } : m
      ),
    }))
  })
},
```

1. IM 消息气泡在 `sendFailed: true` 时显示红色「发送失败」标记（找到渲染 `imMessages` 的组件，添加该状态展示）。

> **禁止**：不要改 `---` 拟回规则，不要把 `session/prompt` 混入普通 IM 发送路径。
> 

---

## EX-02 IM 拟回填充闭环

**文件**：`src/store/app.ts`（`imFillBind`）+ IM 输入框组件

**背景**：PRODUCTION-SPEC §0.5 要求「拟回只填 IM 框（`---` 规则强制）；采纳=IM→AI textarea」。`imFillBind` state 已存在，但监听 `imFillBind` 变化并实际填充 IM 输入框的逻辑在前端组件里不完整。

**执行前置条件**：找到渲染 IM 输入框的组件（搜索 `imFillBind` 的消费点）。

**改法**：

1. 在 IM 输入框组件中，用 `useEffect` 监听 `imFillBind` 变化：

```tsx
const imFillBind = useIM((s) => s.imFillBind)  // 或 useApp
const setIMFillBind = useIM((s) => s.setIMFillBind)

useEffect(() => {
  if (!imFillBind || imFillBind.threadId !== currentThreadId) return
  // 将 AI 生成的拟回内容填入输入框
  // 内容格式遵循 `---` 分隔规则：只取 --- 之前的部分作为 IM 草稿
  const draft = extractImDraft(imFillBind.suggestedText ?? '')
  setDraft(draft)
  setIMFillBind(null)  // 消费后清空
}, [imFillBind])
```

1. `extractImDraft` 实现：取字符串中 `---` 之前的内容（trim），若无 `---` 则取全文：

```tsx
function extractImDraft(text: string): string {
  const sepIndex = text.indexOf('---')
  return (sepIndex >= 0 ? text.slice(0, sepIndex) : text).trim()
}
```

1. 「采纳」按钮（将 IM 草稿发回 AI textarea）：确认现有的采纳流程（`session/prompt` 路径）已正确接线；若未接线，在采纳按钮的 onClick 中调用 `runtimeApi` 对应的 prompt 接口。

---

## EX-03 草稿应用激活流程引导

**文件**：`src/pages/Data.tsx`（`AppDraftEditor` 组件）

**背景**：用户打开草稿应用看到的只是 JSON 编辑器，没有清晰的「下一步」提示，首次使用路径不直观。

**改法**：在 `AppDraftEditor` 顶部添加一个引导横幅，仅当应用处于草稿态（`app.status !== 'active'`）时显示：

```tsx
{app.status !== 'active' && (
  <div className="mb-4 px-4 py-3 rounded-lg bg-brand/8 border border-brand/20 text-sm">
    <div className="font-medium mb-1">这是草稿应用</div>
    <div className="text-ink-muted text-xs leading-5">
      在 AI 对话里描述你的需求，AI 会生成应用规格并自动填入。
      填好后点「激活」让应用上线。
    </div>
    {hint && <div className="mt-2 text-xs text-brand">{hint}</div>}
  </div>
)}
```

> `hint` 是 `AppDraftEditor` 已有的 prop，直接复用。不新增 prop，不改 Data.tsx 其余结构。
> 

---

## EX-04 ⌘K 命令面板增加会话历史搜索

**文件**：`src/components/CommandPalette.tsx`

**背景**：⌘K 面板目前无法搜索 AI 会话，用户想快速跳到某个旧会话需要先打开 AI 页再翻列表。

**执行前置条件**：确认 `CommandPalette.tsx` 的改动不违反 PRODUCTION-SPEC §0.1（不改 className、不改组件树顺序）。本 Issue 只**新增搜索结果条目**，不改任何现有 DOM 结构。

**改法**：

1. 在 `CommandPalette` 内部读取会话列表（从 store 的 `activeAiSessionId` 推算，或直接读 `remoteSessions` 若已在 context 中）。
2. 在搜索结果中新增「会话」分组，当 query 匹配会话 title 时展示，点击跳转 `/ai/:sessionId`：

```tsx
// 在现有结果列表里追加一个分组（遵循现有条目的 className 结构）
const sessionResults = remoteSessions
  .filter((s) => (s.title || '').toLowerCase().includes(query.toLowerCase()))
  .slice(0, 5)
  .map((s) => ({
    id: s.sessionId,
    label: s.title || '无标题会话',
    group: '会话',
    onSelect: () => navigate(`/ai/${s.sessionId}`),
  }))
```

1. `remoteSessions` 数据通过 `useApp((s) => s.activeAiSessionId)` 间接获取，或将其提升为 context——优先使用已有的最小侵入方式，不新增全局 state。

> **禁止**：不改 `CommandPalette` 的 className、动画、尺寸。只在结果列表末尾追加新分组。
> 

---

# 附录：保留不改的事项

- **FDE_DSH_BIN 路径探测 macOS 硬编码**：`config.mjs` 中的 `/opt/homebrew/bin/dsh` fallback 是合理的 macOS 系统路径探测，不是开发机专用路径，**保留不改**。