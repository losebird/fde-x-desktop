---
cursor:
  subagentId: "bc-97c5268a-6e12-5711-bb4b-69ac1c7d3bbb"
---

# wave-fix · vocab wire · Memory 有「工单」· lan-assist NO_VOCAB

**时间**：2026-09-17  
**cwd**：`/Users/zxz/Documents/ai-project/fdex测试`（顶栏「fdex测试1」）  
**DSH**：`~/.dsh-fde-x` · BFF `5174` → runtime `4318` · DSH 动态口（重连后示例 `55546`）

## 根因（两条，均已修代码）

| # | 现象 | 原因 | 修复 |
|---|------|------|------|
| 1 | `createSemanticBridge()` 默认 `http://127.0.0.1:3080/semantic-os` | FDE DSH 用 `--port 0`，子进程**未**设 `PORT`/`DSW_WEB_PORT`；3080 是另一套 `~/.dsh` 语义仓，`list_graph_nodes(fdex)` **空** | overlay：`resolvePage` 读 `ctx.webServer.port` → 同源 DSH |
| 2 | `semantic.vocab` 对含中文的 cwd 在 Node `fetch` 里失败 | `x-dsh-cwd: …fdex测试` 非 Latin-1 → **ByteString** 抛错；`loadWorkspaceVocab` → `NO_VOCAB` | overlay：仅 ASCII cwd 才设 `x-dsh-cwd`；cwd 仍在 JSON body（与 BFF `dsh-core.semanticCwd` 一致） |

Memory 词表 UI 走 BFF → **已连接 DSH** 的 `/semantic-os/*`（`?cwd=` + body），从不打 3080，故一直能看到「工单」。

## 验证（重连 DSH + semantic `ready` 后）

```bash
FDEX="/Users/zxz/Documents/ai-project/fdex测试"
H='Origin: http://127.0.0.1:5174'
ENC=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$FDEX'))")
DSH=$(curl -sS -H "$H" http://127.0.0.1:5174/api/v1/ai/status | jq -r '.data.origin')

# Memory 等价图查询（DSH 直连）
curl -sS -X POST "$DSH/semantic-os/python" -H 'content-type: application/json' -H "Origin: $DSH" \
  -d "{\"op\":\"list_graph_nodes\",\"cwd\":\"$FDEX\",\"args\":{\"type\":\"skos:Concept\",\"limit\":5000}}" \
  | jq '.nodes | length'   # → 45

# lan-assist 目录（与 kinds 同源）
curl -sS "$DSH/lan-assist/catalog?workspace=$ENC" | jq '[.kinds[].kind] | index("工单")'  # → 非 null（约 42 kinds）

# BFF kinds（成功标准）
curl -sS -H "$H" "http://127.0.0.1:5174/api/v1/biz/kinds?cwd=$ENC" \
  | jq '.data.kinds | map(.kind) | index("工单")'   # → 非 null
```

**改前**：`kinds?cwd=fdex` → `[]`；`catalog` → `kinds:[]`（或 NOT_READY 瞬间）。

**改后（实测）**：`kinds` **42** 条，含「工单」。

## 代码落点（scene-39-personal-workstation）

| 路径 | 作用 |
|------|------|
| `runtime/vendor-overlays/dsh-lan-assist/{semantic.js,index.js}` | 同源 semantic + 非 ASCII `x-dsh-cwd` |
| `runtime/dsh-core.mjs` | `applyVendorOverlay`；`list_graph_nodes` 允许经 BFF 调 Memory 图 |
| `runtime/biz/memory-vocab.mjs` | kinds 空时回落 `list_graph_nodes`（与 Memory 同 op） |
| `runtime/routes/biz.mjs` | `GET /biz/kinds` 回落 |

提交：`fix(biz): use Memory vocab for lan-assist kinds`（scene-39 `main`）。

## 仍差 / 运维

- **runtime `4318` 进程**自 Vite 启动后未重载 `biz.mjs`；磁盘已是 `75605f3` + 本提交，但 **`POST /api/v1/biz/preview` 经 BFF 仍可能 502/NO_VOCAB** 直到仅重启 runtime 子进程（不必杀 pnpm）。**DSH 直连** `POST …/lan-assist/preview` + `workspace: fdex` 已 **ok**。
- 新 DSH 实例需等 `semantic-os/ready` 再测 catalog（否则短暂 `NOT_READY`）。
- 已有 vendor 目录需 **`FDE_REFRESH_PLUGINS=1` 重连** 或手动 `cp` overlay 到 `~/.dsh-fde-x/vendor/dsh-lan-assist/` 后 `ai/disconnect` + `connect`。

## 不是根因

- 词表未导入（`graph.json` 含 `#ticket` / `content: 工单`）
- `cwd` query 未传（BFF kinds 已用 `?cwd=`）
- 需二次 import / NocoBase 刮库

## 相关

- [wave-fix-biz-novocab.md](./wave-fix-biz-novocab.md)
- 截图：[ace-vocab-imported.png](../media/ace-vocab-imported.png)
