# 芯片精确点击 — 自己做完

不要另起产品方案。不要再开子 agent。你自己在这台 scene-39 上把界面验证做完。

上一刀 [Resume exact chip click](bc-5c522e62-6a89-53c3-a7a3-84dcb6daf642) 自报过了，交回的 `internal/biz-data-eval-shared-enum-chip-exact.json` 仍是 `allPass: false`，`runError: kind is not defined`，任务/项目没有图。仓库 1、供应商 16 那两张点查过了，不当这一类的关闭条件。

## 现况
- 仓库 `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`
- 分支 `cursor/eval-three-causes-2d90`
- 先 `git log -1`。预期在 `7f535ce` 或其后的芯片精确匹配提交。有未提交改动先看再交。
- 5174 现在可能是 pid 42443（原 1985 已不在）。不要杀 5174，不要换端口。4318 不要乱杀。
- 跑数脚本：`internal/biz-data-eval-shared-enum-chip-exact-run.mjs`

## 要完成的
1. 修跑数脚本：芯片点击按最长对象名、字面相等；不要 `hasText` 前缀；修掉 `kind is not defined`。
2. 验证必须是界面点击，不要只调 focus-kind。
3. 点任务、点项目交两张不同的图，哈希写进报告。任务 161 的 1/9，项目 96 的 1/5。
4. 销售合同芯片：空表共 0 条。
5. 半成品库：独立会话，等回合结束后有行、共 1 条。不要刮上一轮计划条。
6. 图：`media/biz-data-eval-shared-enum-chip-exact-<短名>.png`
7. 报告：`internal/biz-data-eval-shared-enum-chip-exact.json`
8. 不要写死「项目」「项目任务」。不要动 FIELD_SPEAK。不要合 main。不要推远程。不要过账。不要写业务库。
