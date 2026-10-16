# 业务记录 · 型/连接器芯片溯源（fdex测试1）

**代码**：`scene-39-personal-workstation/src/components/biz/RecordsPanel.tsx`  
**现网**：`http://127.0.0.1:5174` · BFF `4318` · 顶栏 **fdex测试1** · cwd `/Users/zxz/Documents/ai-project/fdex测试`  
**探测**：2026-09-18 · READ ONLY（curl + 源码，未改代码）

## 芯片怎么画出来（两套按钮，同一行 Card）

| 来源 | 状态/数据 | 渲染条件 | 标签 |
|------|-----------|----------|------|
| **连接器芯片** | `connections` + `apps` 里 `isFdeAppSpec` 的本地应用 | `connectorOptions.length > 1` 时整组渲染 | 外部：`connection.name`；本地：`本地 · ${app.name}` |
| **型芯片** | `runtimeApi.listBizSurfaces(workspaceCwd)` → `surfaces`；可选并入当前 `biz.sheet.pending` 的 `kind` | `hasSurfacedData` 为真时，与连接器芯片同 Card 内第二组 | `surface.kind` 字符串（**不是**词表 `label`） |
| **词表** | `listBizKinds()` → `kindCatalog` | **不画芯片**；仅 `currentKindCan` / 行内「改行」「删除」等 | — |
| **本会话浮现历史** | 同 `surfaces` 全量（最多 20 条） | `<select>`，不是芯片 | `kind · action · 时间` |

型芯片去重：`surfacedKinds` 按 `kind` 字符串 **Map 合并**，同一型只保留 `createdAt` 最新的一条；**不会**因多次 AI 现查出现两个「工单」芯片。  
选中型上的数字：仅 **当前选中** `kind` 显示 `filteredRows.length`，否则回退 `pending.rows` 或 `surfaces` 里该型的 `rowCount`（见 L991–994）。

浮现元数据写入：`runtime/routes/biz.mjs` `recordSurfaceFromPreview` → SQLite `biz_surfaces`（每次 `biz_preview` / AI pending 路径带 workspace cwd）。

本地应用选中时：`connectionId` 以 `local:` 开头 → **整页切到 `SpecTable`**，型芯片区不再走 Noco/lan-assist 浮现逻辑（L907–933）。

## 现网数据（cwd=fdex测试）

- **surfaces**：型仅 **`工单`**（16 条 surface 行，动作含现查/改行/删除，现查曾有 **165** 行）与 **`客户`**（1 条，现查 **37** 行）。无「供应商拜访台账」型 surface。
- **apps**：2 条 FDE 应用，名称均为 **供应商拜访台账**（`app_634b18c2…`、`app_522b558f…`，均为 `draft`）。
- **connections**：1 条 **局域网业务协作适配器**（`conn_lan_assist`）。
- **pending-sheet**：`kind=工单`，`action=现查`（行集与当前表一致）。

## Ace 截图：一行一芯片（为何存在）

- **本地·供应商拜访台账（第 1 个）** — **local app / 连接器芯片**；`GET …/business/apps` 中 FDE 应用 `app_634b18c2…`；与 AI 浮现无关，是「切到本地 SQLite 应用表」入口。
- **本地·供应商拜访台账（第 2 个）** — **local app / 连接器芯片**；第二条同名应用 `app_522b558f…`；**不是** session surface 重复。
- **工单 165** — **session surface**；`biz_surfaces` 多条 `kind=工单`（AI 现查/改行/删除经 `recordSurfaceFromPreview`）；芯片上 **165** 为当前选中型的行数/最近 surface 的 `rowCount`（现网现查 surface 为 165 行）。
- **客户** — **session surface**；1 条 `kind=客户` · `现查` · 37 行；AI 触及后写入 `biz_surfaces`，经 `surfacedKinds` 去重后单独一型芯片。

（同排另有连接器 **局域网业务协作适配器** 时，因 `connectorOptions.length > 1` 也会出现；Ace 列举未写，属同一机制。）

## 重复「供应商拜访台账」？

**是重复标签，否重复浮现。**  
原因：工作区登记了 **两个** `fde-app/v1` 应用、**同名**「供应商拜访台账」，`connectorOptions` 对每条本地应用各画一颗 `本地 · …` 芯片；`biz_surfaces` 中 **没有** 该名的型。修复方向（产品/数据，非本任务）：合并或删重复 app 记录，或连接器列表按 `slug`/id 去重展示。

## 与「仅 AI 触及」规则

- **型芯片（工单、客户）**：符合 — 仅 `biz_surfaces` + pending，未用 `listBizKinds` 扫全目录（`kindCatalog` 只供行操作权限）。
- **本地应用连接器芯片**：**未**按 AI 触及过滤；凡工作区登记的 FDE 应用且连接器数 >1 即显示。点进后走 **整表 `SpecTable`**，与「业务记录不整表浏览外部真值」的禁区需产品层单独约定（当前实现刻意提供本地 SQLite 应用入口）。

## 代码锚点

- 连接器 + 型芯片 UI：L971–996  
- `surfacedKinds`：L250–265  
- `connectorOptions` / `localApps`：L240–248  
- `listBizSurfaces`：L518–523  
- 空态「不会列出全部型芯片」：L951–953  
