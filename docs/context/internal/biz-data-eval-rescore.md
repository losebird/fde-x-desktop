# 362 重打分数

只打分，不改产品代码。不要开子 agent。不要用人话 UI 把 362 条各跑一轮 LLM。

仓库 `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`，分支 `cursor/eval-three-causes-2d90`，HEAD 应是 `f1b9275`。对着现网词表+图重打 [评测记录](/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/docs/biz-data-eval.md) 里那 362 条。生成规则不变。旧表是 `472226c`。

闸看计划是不是这条结构。现网看命中条数是不是等于库里只读数出来的条数。没有总数算没对上。五类分开，不合成一个百分比。库数用 NocoBase `meta.count`。整表等于边库时必须对行集，不能只报条数。

5174 / 4318 不要杀、不要换端口。不要过账。不要写业务库。不要合 main。不要推远程。

## 产物
- 覆盖写 [评测记录](/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/docs/biz-data-eval.md) 开头和分数表，写明 HEAD
- 机器结果：`internal/biz-data-eval.json`
- 没过的仍按类列出，条数写「库里 / 右边」
