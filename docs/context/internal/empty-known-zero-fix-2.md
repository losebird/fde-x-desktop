# 已知空集页脚 — 第二刀

只修这一类。不要开子 agent。不要另起方案。不要动企业客户 212、不要动已经关上的芯片和仓库 hop。

对着 `0dec12b`。仓库 `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`，分支 `cursor/eval-three-causes-2d90`。5174 / 4318 不要杀、不要换端口。不要过账。不要写业务库。不要合 main。不要推远程。

`0dec12b` 没把现网页脚改过来。上一刀只证明了 preview JSON / 单测，自测图只有会话页。独立对抗打到业务记录官方表后：个人客户空表，页脚仍是「总数未知」。企业客户「共 212 条」还在。

对抗 JSON 里这条官方 sheet 已是 `hitTotalState: known`、`hitTotal: 0`。不要再补 packSheet / preview 返回值。去查页脚实际读的那份 meta（`listSheetMeta` / `applySheet` / `hitFooterText`）为什么 0 到不了「共 0 条」。不要写死个人客户。不要把 0 当成没拿到。不要退回屏幕行数。

改完 overlay 就 cp + POST `/api/v1/ai/reload`；AI 断了就 connect，不要再 reload。有改动就提交。

自测必须打开业务记录，看见官方表和页脚。只有 IM、只有 preview JSON，都算没打到。个人客户页脚必须是「共 0 条」。企业客户仍是「共 212 条」。不要打 362。

## 产物
- 图：`/cursor/stores/self/media/biz-data-eval-empty-zero-2-<短名>.png`
- 报告：`/cursor/stores/self/internal/biz-data-eval-empty-zero-2.json`
