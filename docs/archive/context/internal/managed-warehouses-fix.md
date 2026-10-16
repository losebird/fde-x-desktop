# 员工档案 → 仓库 managedWarehouses

只修这一类。不要另起方案。不要开子 agent。不要动芯片那几刀已经关上的代码，除非这一类的根因就在那里。

## 现况
- 仓库 `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`
- 分支 `cursor/eval-three-causes-2d90`，从 `7f535ce` 接着改
- [评测记录](/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/docs/biz-data-eval.md)：员工档案 → 仓库，`managedWarehouses`。库里 6，右边 3。闸过了，条数没对上。
- 命中集必须完整。 hop 的父 id 不能只拿第 1 页。
- 不要写死 6、3、仓库、员工档案、页长。词表+图是结构来源。
- 5174 / 4318 不要杀、不要换端口。不要过账。不要写业务库。不要合 main。不要推远程。不要动 FIELD_SPEAK。

## 要完成的
1. 现网复现：人话说员工档案的仓库 / 管理的仓库（用词表里这条边的说法）。独立会话。
2. 用 NocoBase 只读 `meta.count` 自己数库，确认是不是 6。
3. 按第一性原理修到右边命中集 = 库里那 6，页脚共 6 条。缺 0 多 0。
4. 对抗自己打一遍：换说法、倒着说如果词表有、确认不是整表、不是第 1 页子集。
5. 图：`media/biz-data-eval-managed-warehouses-<短名>.png`
6. 报告：`internal/biz-data-eval-managed-warehouses.json`
7. 提交到当前分支。
