---
cursor:
  subagentId: "bc-88936405-ec13-5470-a627-2035d34dbc75"
---

## 改动

- `6fd4f4d` feat(apps): fde-app/v1 schema + semantic validator + tests
- `76e04cd` feat(apps): controlled DDL materializer + revisions + tests
- `72c826c` feat(apps): CRUD routes + actions + server dispatch + tests
- `b9e13b8` feat(web): declarative app runtime UI + wizard + SpecEditor
- `27d0072` feat(presets): fde-app-spec skill; docs: APPS runtime reference
- `server.mjs`：仅新增 `handleAppsRoutes` import + dispatch（保留 07 的 context/corpus/writer 挂载）
- `SpecEditor.tsx`：`PutSpecResponse` 显式类型；`putDeclarativeAppSpec` 对 422 返回 `errors` 而不抛错
- 校验：允许 spec 内 `_workspaceCwd`；激活时 `slug` 仅与 **active** 应用冲突

## 验证

| 步骤 | 做了什么 | 看到什么 |
|---|---|---|
| tsc | `npx tsc -b --pretty false` | 退出 0 |
| 单元 | `node --test runtime/tests/apps.*.test.mjs` | 37/37 通过 |
| smoke | `node runtime/smoke.mjs` | 通过 |
| peer API | 4319 重启后 POST 创建 fixture → activate → POST 行 | activate `ok:true` 表 `app_supplier-visits__visit`；insert 201 |
| 列表 | GET `…/supplier-visits/visit?workspace=<cwd>` | `total:1` 行含 ACME |
| Playwright 5175 §11 | `/tmp/node_modules/playwright` 不可用 | **现网未测**（无截图） |
| 5174 回归 | 重启验证时误杀过 4318 进程 | **需 Ace 确认主栈 `pnpm dev` / 4318 是否仍绿** |

## 未做到 / 偏离规格

- 验收清单 1–10 逐步 Playwright 截图：未跑（playwright 路径缺失；AI 生成为可选，已用 fixture + API 证明 activate/CRUD）
- `agent` 动作 BFF 仍 501，需前端 `askAiForResult`（规格允许）
- peer 4319 需手动重启后 `/api/v1/apps` 才生效（已在本机重启验证）

## 需要 Ace 决定

- 若主栈 4318 已掉：请重启 `pnpm dev`（勿动 5174 数据目录）；对端仅回收 4319 即可
- 多个 `supplier-visits` 草稿并存：是否要在 UI 合并/清理重复草稿
