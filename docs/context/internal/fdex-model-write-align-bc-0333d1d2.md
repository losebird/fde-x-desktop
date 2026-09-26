---
cursor:
  subagentId: "bc-0333d1d2-5ddd-5190-b182-e2f1c39ec602"
---

# 模型写入对齐 · 落地记录

## 结论

- 代码已提交：`cursor/models-settings-parity-d9dd` @ 见 git log
- 本机 `~/.dsh-fde-x/settings.yaml` 硅基 Qwen 已去掉误灌 `reasoningEfforts`
- 验收会话 `session-62c40ebe-…` 发「你好」有 `turn/end` + `text`，无 20015/developer
- BFF 4318 需重启后 UI/BFF 新逻辑才生效；核心已 connect 可测

## 改了什么

| 区域 | 内容 |
|------|------|
| `runtime/models-settings.mjs` | `alignModelRowsWithDiscover`、`discoverProviderModels`、`formatReasoningEffortsYaml` |
| `runtime/server.mjs` | 去掉 `reasoning:true` 灌档；apply/custom 写前对齐 discover；discover 透传 `reasoningEfforts`；密钥 ASCII 校验补全 |
| `ModelsProvidersSection.tsx` | 清除密钥；添加自定义 discover 只预选新 id；模型行仅 override 时可删 |
| 测试 | `runtime/tests/models-settings-align.test.mjs` |

## Ace 操作

1. 重启工作台 BFF（或 `npm start` 整包）以加载新 server
2. AI 页 **连接核心**（若 idle）
3. 新会话选硅基 Qwen →「你好」
