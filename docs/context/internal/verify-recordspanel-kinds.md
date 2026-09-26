---
cursor:
  subagentId: "bc-86aaa5f6-862a-5758-b5c5-dfc73923e4ea"
---

# UI verify · RecordsPanel / kinds（5174）

**When**: 2026-09-17 (UTC+8)  
**Stack**: `http://127.0.0.1:5174` · workstation cwd `scene-39-personal-workstation`  
**Mode**: read-only · no code · no `biz_write` · pnpm left running

## Navigation（已摸过）

1. Open `http://127.0.0.1:5174` → lands on `/ai`（顶栏显示工作区 **fdex测试1**；横幅「已连接本地核心」）。
2. 顶栏 **业务应用** → 右侧 `Data.tsx` 侧栏浮层。
3. Tab **业务记录**（`view === 'records'` → `RecordsPanel`）。

`/data` 直链会重定向回 `/ai`；未新开路由。

## Screenshot

[verify-recordspanel-kinds.png](../media/verify-recordspanel-kinds.png)

## API（同会话 curl，对照 UI）

| Request | HTTP | Body facts |
|---------|------|------------|
| `GET :5174/api/v1/biz/kinds` + `Origin: http://127.0.0.1:5174` | **200** | `data.kinds` **41** 条；首项 `审批单`、`资产领用`…（与 [verify-after-dsh-connect.md](./verify-after-dsh-connect.md) 一致） |
| `GET :5174/api/v1/business/connections`（无 workspace 过滤） | **200** | 1 条 `conn_lan_assist`，`workspaceId: ws_personal` |
| `GET :5174/api/v1/business/connections?workspaceId=ws_personal` | **200** | 同上 1 条 |
| `GET :4318/api/v1/biz/connections?workspace=…scene-39…` | **200** | `items: []` |

## UI 结论（RecordsPanel）

| 观察项 | 结果 |
|--------|------|
| 型芯片 / kinds 列表 | **未出现** — 主区为 `Empty`：**「先在设置登记业务连接器」** / 「登记后可在此现查与过账」 |
| AuthorityStrip | **事务底座运行正常**；副文案 **「词表 未配」**（`catalogCount` 来自 `imState` mailbox，非 `/biz/kinds`） |
| 错误条 / 黄条 gate | **无**（未进入有连接器时的芯片区） |
| `biz_write` | **未点击** |

**原因（源码，非猜）**：`RecordsPanel.tsx` 在 `connectorOptions.length === 0` 时直接 `return <Empty …/>`（L285–287）。`connectorOptions` 来自当前 `activeWorkspaceId` 的 `listBusinessConnections` + 本地应用；本工作区 UI 名下 **连接器列表为空**，故 **即使 `/biz/kinds` 200**，面板也不渲染 kinds 芯片。

Playwright a11y 快照（业务记录 Tab active）：`generic [ref=e319]: 先在设置登记业务连接器`。

## 控制台（本 run Playwright）

- `favicon.ico` 404 ×2（无关）
- `POST :4318/api/v1/biz/preview` **502**（一次；未触发写操作）

## 对照表（本票范围）

| 项 | mother / 期望（规格 05 §8.1） | fdex 实测 |
|----|------------------------------|-----------|
| `/biz/kinds` 有数据 | BFF 200 + kinds | **已对** — curl 41 kinds |
| RecordsPanel 展示 kinds 芯片 | `biz_describe` / `/biz/kinds` 驱动芯片 | **仍差** — UI Empty（无连接器）；**未对** 与 API 是否应脱钩展示 |
| 无连接 Empty 文案 | 「先在设置登记业务连接器」 | **已对** — 截图 + a11y |
| AuthorityStrip 词表计数 | 与 kinds 一致？ | **仍差** — 条带写「未配」；kinds API 已有 41（数据源不一致） |

## Verdict

**PARTIAL** — API kinds **可用**；**RecordsPanel 未展示 kinds 列表**（连接器 Empty）。截图已留证。

**未对**：有连接器工作区下芯片是否渲染（需切换/登记连接器，超出本 run「不 restyle、不写」约束外的配置操作未做）。
