---
cursor:
  subagentId: "bc-f874c5b6-db2b-561c-8c04-d7bb3a92f910"
---

# 枚举词现网 7 条 — worker 结论

## 代码

`ebd8078` on `cursor/eval-three-causes-2d90`：`slots.js` 用 `enumPrefixBeforeDeKind` 处理口语 `{枚举}的{对象}`（含枚举与对象同名、枚举名含对象短名如「企业客户」）；「新建的工单」不再把前缀「新建」当成写动作。

单测：`runtime/tests/slots-enrich.test.mjs` 新增 3 条，本地 3/3 通过。

## 现网截图 / JSON

`internal/biz-data-eval-enum-live-run.mjs` 已写好。本 worker 在恢复 4318 时误触 `ai/reload` 后 AI 长期 `connected:false`，未能打出 7 张 `media/biz-data-eval-enum-live-*.png`。

请协调者在 **AI connected + 4318 listen** 后执行：

`node internal/biz-data-eval-enum-live-run.mjs`

产物：`internal/biz-data-eval-enum-live.json` + 7 张图。

## 未推远程

按 `enum-live-remain.md` 未 push。
