---
cursor:
  subagentId: "bc-a01c2299-955c-540c-baa6-a0684a7aea07"
---

# handler bigint overlay：DSH 重连已加载

对照 [handler-bigint-fix.md](./handler-bigint-fix.md)。**只部署**，未改仓库产品逻辑、未点过账、未写业务库、未推远程。

`20c234fb` 教训：仅 `cp` overlay、不换 DSH 进程时，现网仍是旧内存。本次在 overlay 已与 vendor 一致的前提下，**disconnect → connect** 换进程。

## 1. `write.js` 一致性（overlay ↔ vendor）

| 检查 | 结果 |
|------|------|
| `diff -q` / `cmp` | `runtime/vendor-overlays/dsh-lan-assist/write.js` 与 `~/.dsh-fde-x/vendor/dsh-lan-assist/write.js` **逐字节相同** |
| SHA256 | `4145eb3033e8f2170cdc1cee96e7b0a44dd3ce7b31b819087e8009a2ceccba6d` |
| `relationSchemaField` | ✅ export L1971 |
| `shapePatch` | ✅ export L1995；预览路径 `bindWritePatch` → `shapePatch(display, …)` L1407 |
| `displayPatch` | ✅ 结构化预览 L1068–1076；`finishStructured` / 令牌 UI 仍用口语展示 L1209+ |

重连后 live 加载路径：`~/.dsh-fde-x/profiles/fde-x/node_modules/dsh-lan-assist/write.js` 与 vendor **同 inode 67135506**，与 overlay 仍一致。

未在本轮重复 `cp`（两边已一致）。

## 2. DSH 重启（非 reload）

| 动作 | 说明 |
|------|------|
| `POST http://127.0.0.1:4318/api/v1/ai/disconnect` | `Origin: http://localhost:5174` → `connected: false`，旧 DSH **11136** 已退出 |
| `POST …/api/v1/ai/connect` | 同上 Origin → 新 DSH **16002**，`startedAt` `2026-09-24T09:24:03.847Z` |

**未**调用 `POST /api/v1/ai/reload`。

| 组件 | 要求 | 结果 |
|------|------|------|
| BFF `4318` | 不重启 | PID **10640** 不变，唯一 LISTEN |
| Vite `5174` | 不动 | PID **42443** 不变 |
| 第二套 `4318` | 禁止 | 仅 10640 |

## 3. 重连后状态

`GET /api/v1/ai/status`：

- `connected`: **true**
- `state`: **connected**
- `pid`: **16002**
- `dshHome`: `/Users/zxz/.dsh-fde-x`
- `origin`: `http://127.0.0.1:56324`（DSH web 新 ephemeral 口）
- `lastError`: null

## 4. 未做

- 过账 / 业务库写入
- 远程 push
- 4318 BFF 进程重启、5174 / 42443 重启
- `ai/reload`

---

**Internal refs:** [handler-bigint-fix.md](./handler-bigint-fix.md)、[leftover-overlay-applied.md](./leftover-overlay-applied.md)（同类 disconnect/connect 流程）
