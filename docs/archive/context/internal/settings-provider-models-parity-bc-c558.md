---
cursor:
  subagentId: "bc-c558fc66-8f48-59b6-8644-890c42eed9dd"
---

# 设置 → 核心 · Models 对齐落地

## 结论

已按 `docs/settings-provider-manage-plan.md` **替换** `77fc380b` 薄行方案：一行一张展开编辑卡 + BFF `ModelsOperations` 语义；未推远程。

## 改动

| 文件 | 作用 |
|------|------|
| `runtime/models-settings.mjs` | `joinProviderDirectory`、`pathOps`、快照 `fetchModelsSettingsSnapshot`、协议 choices |
| `runtime/server.mjs` | `GET models-settings`；`POST mutate` / `apply` / `credential`；custom 合并保留 `reasoningEfforts`；删除用 `unset` |
| `src/lib/runtime-api.ts` | `getModelsSettings`、`mutateModelsSettings`、`applyModelsSettingsProvider`、`setModelsCredential` |
| `src/components/settings/ModelsProvidersSection.tsx` | 列表 + 单卡编辑 + 折叠区 + 模型行删 + 恢复默认 + discover 选择器「添加所选」 |
| `src/components/settings/CoreSettings.tsx` | 接入新分区；保留重载核心、模型胶囊、Agent 预设 |

## 提交

分支 `cursor/models-settings-parity-d9dd`（本地）。

## 验收（本机）

| 项 | 结果 |
|----|------|
| `npm run runtime:check` | 通过 |
| `pathOps` 改 displayName 不动 models | 通过（node smoke） |
| DSH 连上后 UI 逐步点验 6.1–6.3 | **待 Ace**（当前 runtime check 显示 ai-runtime unavailable） |
| BFF 变更后重启 4318 | 需 Ace 重载核心或 dev 重启 |

## 保留兼容

旧 `GET/POST providers`、`PATCH/DELETE key`、`custom` 路由仍在；会话 `modelCatalog` 未改。
