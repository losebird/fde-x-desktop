# 现网图审（续 `bee827d9`，不准另发明）

上一刀只交了代码和 API 采样，**图审没过**：员工对侧 chip `hitTotal` 仍是 0；部门/hop/`{{t()}}`/362 没有现网图。旧图复制不算证据。

## 先部署再拍

1. overlay：`cp` 到 `~/.dsh-fde-x/vendor/dsh-lan-assist`，只 `POST /api/v1/ai/connect`。禁止 reload。4318 已在听就不要重启。
2. 5174 不要杀、不要换端口。

## 顺序锁死

一类必须有：**独立库数 + 新截图（官方表+chip+页脚「共 N 条」）**。不齐不准做下一类。禁止复制 `media/` 里旧图。

1. **自环**
   - 员工档案的员工档案：官方表对上库（下属 15）；对侧 chip 必须能点，点开后页脚对上库（管理者 80）。禁止整表 120，禁止 chip 0。
   - 部门自环：11 与 4，不是整表 12。
   - 还不对：只修自环（词表+图上的同 kind 多条自环边 → 官方一条、其余 chip，`hitTotal` 来自该边 `:list` `meta.count`）。禁止写死 80/15/manager。
2. **hop 差 1**：采购收货单、订单明细、工单处理记录。页脚对独立库数。禁止 ±1。
3. **`{{t()}}` 边**：Departments↔Users、Roles↔Users。匹配用已有 `kind-label`，禁止写死这三个词。
4. 三类现网图都过了，才串行 362 换表。禁止并发。

## 交回

更新 `/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/docs/biz-data-eval.md` 和 `internal/close-remaining-eval-evidence.md`。新图放到 `media/close-remaining-eval/`，文件名按类，不要覆写成旧官方图。
