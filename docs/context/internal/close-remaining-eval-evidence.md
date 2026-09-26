---
cursor:
  subagentId: "bc-a2fe6a4f-bb90-53e9-81c7-2bce113622e8"
---

# 收口剩余评测 — 证据（进行中）

仓库：`losebird/fde-x-desktop` @ `bee827d9`（已合 `main` 并推送）。

## 现网图审（2026-09-24，overlay cp + connect）

- 跑批：`internal/close-remaining-eval-live-run.mjs` → `internal/close-remaining-eval-live.json`。
- **未报成功**：自环类未齐，hop / `{{t()}}` / 362 未跑。
- 新图目录：`media/close-remaining-eval/`（勿用旧 `self-loop-emp.png` 复制件当证据）。

### 自环现网

| 说法 | 库数 | pending/API | 页脚 | 截图 |
|---|---:|---|---|---|
| 员工官方（下属） | 15 | 主 15；peer manager **80** | 共 15 条 | `self-loop-emp-subordinates-official.png` |
| 员工 chip（管理者） | 80 | peer 80 | 点 chip 后页脚仍 15（UI，见 RecordsPanel 本地修） | `self-loop-emp-subordinates-official-peer.png` |
| 部门 parent | 11 | 未稳定 11 | 拍到 共 4 条 | `self-loop-dept-parent.png` |
| 部门 children | 4 | peers 无 total | 总数未知 | `self-loop-dept-children.png` |

## 1. 自环（代码 main，图审未齐）

**代码**（同前刀）

- BFF `sheet-payload` 保留 peer `relation`；`lookupPublishedSelfEdge` FK `filled`；`operationChipKey` 分 chip。

**独立库数（fdex测试 / Noco）**

| 口径 | 条数 |
|---|---:|
| 员工全表 | 120 |
| `managerId` 非空 | 80 |
| 有下属（distinct managerId） | 15 |
| 部门 parent 非空 | 11 |
| 部门有子节点（distinct parentId） | 4 |

## 2. hop 差 1

未在本轮现网重拍（自环未齐）。

## 3. `{{t()}}` 跨对象边

未在本轮现网重拍（自环未齐）。

## 4. 串行 362

未跑。

## 运维备注

- overlay：`cp` → `vendor/dsh-lan-assist` + `POST /api/v1/ai/connect`（禁止 reload；4318 未重启）。

