---
cursor:
  subagentId: "bc-7ff04045-b2f8-52d7-8154-b0f562cd3901"
---

# 提供方管理落地 · 实施记录

## 结论

按 `docs/settings-provider-manage-plan.md` 在 fde-x-desktop（`scene-39-personal-workstation` checkout）完成 BFF + `CoreSettings` 行内管理；未推远程。

## 改动摘要

| 区域 | 内容 |
|------|------|
| `runtime/server.mjs` | `upsertSettingsProvider` 改为覆盖已有 route；`removeSettingsProvider` / `removeCredentialRef` / `readSettingsProviderProfile`；`PATCH/DELETE .../providers/:id/key`；`PATCH/DELETE .../providers/custom/:route`；GET 列表带 `kind` + 自定义 `profile` |
| `src/lib/runtime-api.ts` | `patchAiProviderKey`、`clearAiProviderKey`、`patchCustomAiProvider`、`deleteCustomAiProvider` |
| `src/components/settings/CoreSettings.tsx` | 目录行：更换/清除密钥；自定义行：编辑/删除；编辑复用自定义表单 + PATCH |

## 提交

本地 commit（未 push）：`77fc380b` — feat(settings): provider row key edit and custom CRUD

## 你怎么验（本机已做 / 待 Ace 连核心）

| 项 | 状态 |
|----|------|
| YAML upsert 覆盖逻辑 | 通过：`node -e` 临时文件替换 baseURL |
| `npm run runtime:check` | 通过 |
| `ReadLints` CoreSettings + runtime-api | 无新问题 |
| 官方 qwen 换钥/清钥 + 行仍在 | 需本机 DSH 连上后 UI 点验 |
| 自定义 grok2api 编辑 / 删硅基流动 | 同上 + **重载核心** |
| Agent 预设 / 现查改行 | 未改相关文件 |

BFF 变更后需重启 4318（设置页「重载核心」或 dev 脚本），与方案一致。
