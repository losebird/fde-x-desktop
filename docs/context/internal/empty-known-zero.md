# 已知空集页脚必须是「共 0 条」

只修这一类。不要开子 agent。不要另起方案。不要动已经关上的芯片、仓库 hop、枚举过滤（37 / 220 / 54 / 212 / 179 / 139）。

对着 `ebd8078`。仓库 `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`，分支 `cursor/eval-three-causes-2d90`。5174 / 4318 不要杀、不要换端口。不要过账。不要写业务库。不要合 main。不要推远程。

对抗和补拍都对上：个人客户命中集是 0，右边空表，页脚却是「总数未知」。空集已经知道是空的，页脚必须是「共 0 条」。不要把「没有行」当成「没拿到总数」。不要把 0 当成 unknown。不要写死个人客户 / 客户 / 客户类型 / 0。不要退回屏幕行数当总数。

查 `hitTotal` / `hitTotalState` 为什么在已知空集上变成 unknown。改完 overlay 就 cp + POST `/api/v1/ai/reload`；reload 若把 AI 掐断就 `/api/v1/ai/connect`，不要再 reload。有代码改动就提交。

自测只打这一类：个人客户空表页脚「共 0 条」。顺手看一个非空枚举页脚还在（比如企业客户 212），证明没把旧路径搞坏。不要打 362。

## 产物
- 图：`/cursor/stores/self/media/biz-data-eval-empty-zero-<短名>.png`
- 报告：`/cursor/stores/self/internal/biz-data-eval-empty-zero.json`
