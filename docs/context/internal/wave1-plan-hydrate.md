---
cursor:
  subagentId: "bc-2588bf27-4e82-5f8e-a049-59093f9acb2f"
---

# Wave 1 · Plan 空列表 / ⌘K 未命中 — 诊断

**代码根**：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**提交**：`4a9879f` `fix(web): fetch plan API via same-origin proxy in browser`

## 裁决

| 问题 | 结论 |
|------|------|
| 验收 A 在 sqlite/API 有、UI `taskCount=0` | **产品缺陷**（非工作区写错） |
| accept walk 工作区是否一致 | **已对**：顶栏 `activeWorkspaceId=2adccbf8-…` 与 POST/GET `workspaceId` 一致（`wave1-accept-walk-final.out` L5、L111–116） |
| accept「刷新后未见任务」 | **部分 walk 误差**：`/plan` 路由后未再 `openPlanPanel()`（walk L141–147），Plan 未 mount 则不会 hydrate；但**面板已开仍 taskCount=0** 与产品缺陷一致 |

## 根因（有实测）

1. **Vite peer** 将 `import.meta.env.VITE_FDE_RUNTIME_URL` 设为 `http://127.0.0.1:4319`（`vite.config.ts` define）。
2. **`runtime-api.ts` `planRequest`** 在浏览器里对 BFF **直连 4319**（`fetch(\`${baseUrl}/api/v1/plan/...\`)`）。
3. **Plan 路由**（`runtime/routes/plan.mjs` `planOk`/`planError`）响应**不带** `Access-Control-Allow-Origin`；其它经 `server.mjs` `sendJson` 的 API 带 CORS。
4. 浏览器侧（Playwright + Chrome，origin `http://127.0.0.1:5175`）：
   - `fetch('http://127.0.0.1:4319/api/v1/plan/tasks?…')` → **`TypeError: Failed to fetch`**
   - `fetch('/api/v1/plan/tasks?…')`（经 5175 代理）→ **200**，`data.length` 与 sqlite 一致
5. `hydratePlan` 在 `ensureWorkspace`（走 `request()`，CORS 正常）之后 `Promise.all(listTasks, listEvents, listWorkflows)`；**plan 三路任一失败**即 `catch` → `planServiceError: 计划服务未就绪`，列表保持 `[]`。accept 探针 `planErr: null` 时多为 **hydrate 尚未完成或探针读 persist**；手动 `hydratePlan` 在修复前稳定得到 `计划服务未就绪` 且无 `/plan/tasks` 网络请求。

## 修复

- **文件**：`src/lib/runtime-api.ts`
- **改动**：浏览器内 `planRequest` 使用 **同源相对路径**（走 Vite `/api` 代理）；仅非浏览器（Node 测试）继续 `baseUrl + path`。
- **未改**：`Plan.tsx` mount/useEvents、`CommandPalette` 逻辑、`plan.mjs`、`server.mjs`（禁区）。

## 复验（5175 peer，顶栏「宣传图」工作区）

| 步骤 | 证据 |
|------|------|
| 切工作区 → 开计划面板 | `plan/tasks` 经 **proxy** 200；面板可见多条「验收 A」 |
| `createTask`「验收 A2」+ 刷新再开计划 | sqlite/API 有 A2；列表仍可见 |
| ⌘K 搜「验收」 | palette 命中「验收 A2」（`repro.json` `cmdHit: true`） |
| `npx tsc -b --pretty false` | 退出 0 |

截图：`files/media/wave1-plan-hydrate/01-plan-list.png`、`02-cmdk.png`（`repro.json` 为探针 JSON）。

## 与 accept 对照

- **非**「任务写在 UI 未选的工作区」：walk 已切「宣传图」且 store `activeWorkspaceId` 与 API 相同。
- **是**「hydrate 从未成功灌入 store」：直连 4319 的 plan CRUD 在浏览器被 CORS/网络层挡掉。
