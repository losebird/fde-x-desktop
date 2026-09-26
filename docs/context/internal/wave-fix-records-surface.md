---
cursor:
  subagentId: "bc-0df1bead-c2b8-5517-8607-6530e69ae9e8"
---

# Wave：业务记录页只浮现 AI 触及的数据

## 问题（Ace 拒收）

`RecordsPanel` 用 `GET /biz/kinds` 渲染全部型芯片，并在 `kind`/`connection` 变化时自动 `biz_preview(现查)`，等价于业务系统浏览器（见 `media/ace-records-full-catalog.png`）。违反 `project-context.md` 决策 1 与 `specs/05-business-records.md` §2 禁区。

## 改动摘要

| 区域 | 之前 | 之后 |
|---|---|---|
| 型芯片 | `/biz/kinds` 全目录 | 仅 `biz_surfaces` + 当前 `biz.sheet.pending` 出现的 `kind` |
| 默认加载 | `useEffect` → 整表现查 | 无自动现查；从 `GET /api/v1/biz/pending-sheet`（lan-assist `pendingSheet`）或会话内 `sheetSnapshots` 内存快照展示 |
| 空态 | 有连接器即出表 | 「还没有 AI 查过或改过的业务记录」（连接器已登记时不误导去登记） |
| 历史浮现 | 点历史 → `runPreview('现查')` 再整表 | 快照 / pending；过期则文案提示回 AI 会话，禁止整表 browse |
| BFF | — | `GET /api/v1/biz/pending-sheet` 转发 state，不落 SQLite 行业务行 |

## 对照（本波仅业务记录 Tab）

| 项 | 母体 / 规格 | fdex（改后） | 实测 |
|---|---|---|---|
| 禁止全目录芯片 | 决策 1、`05` §2 | 已去掉 `listBizKinds` 驱动芯片 | 现网未测（5174） |
| AI 触及才出表 | Ace 规则、`05` §6.1 浮现区 | SSE + pending-sheet + surfaces 元数据 | 现网未测 |
| preview→write | lan-assist gate | 行内改/删/审/新建仍 `bizPreview`→抽屉→`bizWrite` | 现网未测 |
| 空态文案 | 任务说明 | `RecordsPanel` Empty 文案 | 现网未测 |

## 文件

- `runtime/routes/biz.mjs` — `pending-sheet` 路由
- `src/lib/runtime-api.ts` — `getBizPendingSheet`
- `src/components/biz/RecordsPanel.tsx` — 主 UX
- `runtime/tests/biz.test.mjs` — 路由存在性断言

## 验证

- `node --test runtime/tests/biz.test.mjs` — 9/9 通过
- UI：未走 5174；**不声称** Ace 已验收

## 仍差 / 未对

- **仍差**：刷新后仅 `biz_surfaces` 元数据、无 pending 且无内存快照时，表体为空（符合不复制真值、不整表现查；依赖用户回 AI 或同会话内操作）
- **未对**：与 dsh-lan-assist 秘书 UI 像素级交互（未做 CDP 对照）
- **锁**：未改路由/顶栏；未 `biz_write` 无 preview；未 SQLite 缓存 NocoBase 行

## Commit

`fix(web): surface only AI-touched business records`（分支 `cursor/fix-records-surface-e9e8`）

## 已上 main

`fix(web): surface only AI-touched business records` — `4ba940a`（`main`，自 `446f22c` cherry-pick）
