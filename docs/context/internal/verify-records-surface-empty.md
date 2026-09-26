---
cursor:
  subagentId: "bc-67603ed3-48f3-5c68-9345-41653e8ee6d1"
---

# Verify · 业务记录 empty surface（post `4ba940a`）

**When**: 2026-09-17 19:18–19:20 (UTC+8)  
**URL**: `http://127.0.0.1:5174`  
**Worktree**: `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**Mode**: read-only · no code · no `biz_write` · pnpm / Vite / DSH left running

## Navigation（已摸过）

1. Open `http://127.0.0.1:5174/ai` → 工作区 **fdex测试1**，横幅「已连接本地核心…」。
2. 顶栏 **业务应用** → 侧栏 `Data.tsx` 浮层。
3. Tab **业务记录**（`RecordsPanel`）。

## Git / 进程 vs UI

| 来源 | 值 |
|------|-----|
| `git rev-parse HEAD`（workstation） | `4ba940a75687d5acd78d6a19541f682624ec9eea` — `fix(web): surface only AI-touched business records` |
| Vite | `127.0.0.1:5174`，pid 33617，启动 19:07:39；入口 `main.tsx?t=1789643819204` |
| BFF runtime | `127.0.0.1:4318`，pid 33616，与 Vite 同批启动 |
| 前端文案 | a11y + 截图见 [verify-records-surface-empty.png](../media/verify-records-surface-empty.png)：`还没有 AI 查过或改过的业务记录` + 副文案明确「不会列出全部型芯片，也不会整表倾倒源系统」 |
| BFF 路由 | `GET /api/v1/biz/kinds` → **200**（41 kinds）；`GET /api/v1/biz/pending-sheet`（经 5174 代理与直打 4318）→ **404** `not_found` / 「接口不存在」；Playwright 控制台对 `4318/.../pending-sheet` 404 ×2 |

**解读（不对等声称 parity）**：磁盘 HEAD 已是 `4ba940a`，Vite 已加载新 `RecordsPanel` 空态；**仍差** 本地核心 Node 进程似未带上 `biz.mjs` 里 `pending-sheet` 分支（同进程 `kinds` 仍 200），需重载 runtime 后 API 才与源码一致。本票 PASS 范围仅「Tab 默认面不是全库浏览器」。

## PASS / FAIL 判据

| 判据 | 结果 | 证据 |
|------|------|------|
| 无 40+ 型芯片 | **PASS** | 业务记录 Tab 主区无 chip / kind 列表；`/biz/kinds` 41 条未渲染到面板 |
| 默认非「审批单」整表现查表 | **PASS** | 无 `Table` / 行数据；仅 Empty + 黄条说明 |
| 空态：AI 未触及记录（或仅 AI 浮现） | **PASS** | 标题 `还没有 AI 查过或改过的业务记录`；副文案描述会话内现查/改行后浮现 |
| 仍全库 catalog browser | **FAIL 否** | 未出现旧版全目录芯片 + 自动现查表 |

## 其他 UI（本 Tab）

- **AuthorityStrip**：「事务底座运行正常」+ SQLite 44 表；词表仍显示「未配」（与 `/biz/kinds` 41 条并存，**仍差** 条带数据源一致性问题，非本票 FAIL）。
- **黄条**：「事务底座未就绪。等底座恢复后，AI 在会话里的现查/改行会浮现到这里。」（与绿条并存；无整表兜底）。
- **应用 Tab**（未切）：仍有「浏览记录」按钮 — 本 run 未点；不在「业务记录 Tab 默认面」判据内。

## 控制台（Playwright）

- `favicon.ico` 404 ×2
- `4318/api/v1/biz/pending-sheet` 404 ×2（Tab 切到业务记录时）

## 对照表（本票最小集）

| 项 | 规格 / 母体期望 | fdex 实测 |
|----|-----------------|-----------|
| 禁止全目录芯片 | 决策 1、`05` §2 | **已对** — Tab 空态 + 文案；源码 `RecordsPanel.tsx` 无 `listBizKinds`（workstation @ `4ba940a`） |
| 默认不整表现查 | Ace 拒收 catalog browser | **已对** — 无表体 |
| AI 空态 copy | wave-fix 文案 | **已对** — 截图 + a11y `e329`/`e330` |
| BFF pending-sheet | `4ba940a` 路由 | **仍差** — 404；磁盘有路由、进程似旧 |
| `/biz/kinds` API | BFF 仍可查 | **已对** — 200 / 41 kinds（未驱动 UI 芯片） |

## Verdict

**PASS**（业务记录 Tab：非全库浏览器；符合 post-`4ba940a` 空态 UX）。

Follow-up（非本票 FAIL）：重载本地核心使 `pending-sheet` 与 `4ba940a` runtime 一致；再验 AI 浮现行与 pending 路径。

## Screenshot

[verify-records-surface-empty.png](../media/verify-records-surface-empty.png)
