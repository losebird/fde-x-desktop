---
cursor:
  subagentId: "bc-633608b2-9c46-57e2-b527-6725b2243159"
---

# 口语进库 overlay：DSH 重连已加载

对照 [spoken-write-fix.md](./spoken-write-fix.md)。**只部署**，未改仓库产品逻辑、未点过账、未写业务库、未推远程。

## 1. overlay ↔ vendor

| 检查 | 结果 |
|------|------|
| overlay 子集 `diff -q` | `runtime/vendor-overlays/dsh-lan-assist/*` 与 `~/.dsh-fde-x/vendor/dsh-lan-assist/` 对应项 **无差异** |
| 新文件 `relation-bind.js` | vendor **有**（2026-09-24 17:41），非仅 `write.js` |
| `relation-bind.js` SHA256 | `dbaeb6b028f0a76188ca60f6f296240d2325585c5b2aa19f9fa13d439580c296`（overlay = vendor） |
| `write.js` SHA256 | `b10515977194b79f68c72edac4b474b5a4cf9a6f9eee7877887d1a2bf01424d9`（overlay = vendor） |
| `lookup.js` | overlay = vendor（`diff -q` 通过） |
| live 模块 | `~/.dsh-fde-x/profiles/fde-x/node_modules/dsh-lan-assist/relation-bind.js` 与 overlay **cmp 相同** |

本轮 **未** 重复 `cp`（spoken-write-fix 所列四文件已在 vendor 且与 overlay 一致）。

vendor 符号（口语收口相关）：

- `relation-bind.js` L125 `approveNextStatusCode`
- `relation-bind.js` L172 `bindWhereRelationTerms`
- `write.js` 自 `./relation-bind.js` 引入 `approveNextStatusCode` 等
- `lookup.js` 自 `./relation-bind.js` 引入 `bindWhereRelationTerms`

## 2. DSH 重连（非 reload）

| 动作 | 说明 |
|------|------|
| `POST http://127.0.0.1:4318/api/v1/ai/disconnect` | `Origin: http://localhost:5174` → `connected: false`，旧 DSH **16002** 已退出 |
| `POST …/api/v1/ai/connect` | 同上 Origin → 新 DSH **23047**，`startedAt` `2026-09-24T09:43:17.320Z` |

**未**调用 `POST /api/v1/ai/reload`。

| 组件 | 要求 | 结果 |
|------|------|------|
| BFF `4318` | 不重启 | PID **10640** 不变，唯一 LISTEN |
| Vite `5174` | 不动 | PID **42443** 不变 |
| 第二套 `4318` | 禁止 | 仅 10640 |

## 3. 重连后状态

`GET /api/v1/ai/status`（`Origin: http://localhost:5174`）：

- `connected`: **true**
- `state`: **connected**
- `pid`: **23047**（自 16002 换新进程）
- `dshHome`: `/Users/zxz/.dsh-fde-x`
- `origin`: `http://127.0.0.1:62759`（DSH web 新 ephemeral 口）
- `lastError`: null

## 4. 未做

- 过账 / 业务库写入
- 远程 push
- 4318 BFF 进程重启、5174 / 42443 重启
- `ai/reload`

---

**Internal refs:** [spoken-write-fix.md](./spoken-write-fix.md)、[handler-overlay-applied.md](./handler-overlay-applied.md)（同类 disconnect/connect 流程）
