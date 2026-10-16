---
cursor:
  subagentId: "bc-a2fe6a4f-bb90-53e9-81c7-2bce113622e8"
---

# 现网图审（`bee827d9`）— 未闭环

## 部署

- 已 `cp` `runtime/vendor-overlays/dsh-lan-assist` → `~/.dsh-fde-x/vendor/dsh-lan-assist`。
- 已 `POST /api/v1/ai/connect`（5174/4318 未杀、未重启 BFF）。
- 未做浏览器 reload。

## 自环

| 子项 | 独立库数 | pending/API | 页脚现网 | 新图 |
|---|---:|---|---|---|
| 员工「X的X」官方（下属） | 15 | `hitTotal` 15；peer `manager` **80** | 官方 **共 15 条** | `media/close-remaining-eval/self-loop-emp-subordinates-official.png` |
| 员工对侧 chip（管理者） | 80 | peer `hitTotal` 80 | chip 可点，**点 80 后页脚仍 15**（复拍前） | `…/self-loop-emp-subordinates-official-peer.png`（页脚未切到 80） |
| 部门 parent | 11 | 一次 pending：`hitTotal` 4，`peers` 无 `hitTotal` | 拍到 **共 4 条** | `…/self-loop-dept-parent.png` |
| 部门 children | 4 | 另一次 pending：页脚 **总数未知** | 未对齐 | `…/self-loop-dept-children.png` |

机器可读：`internal/close-remaining-eval-live.json`（`allCategoriesPass: false`，停在自环类）。

**本地未提交改动（为 chip 切表）**：`scene-39-personal-workstation/src/components/biz/RecordsPanel.tsx` — 同 kind 不同 `relation` 的 chip 不再误 `applyPendingSheet` 主表。

## hop / `{{t()}}` / 362

- 自环类未齐，**未**进入 hop 差 1、`{{t()}}` 边、串行 362（与 `close-remaining-eval-live.md` 一致）。

## 脚本

- `internal/close-remaining-eval-live-run.mjs`（按类顺序；输出 `media/close-remaining-eval/` + `close-remaining-eval-live.json`）。
