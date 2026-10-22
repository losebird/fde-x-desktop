# LAYOUT-REPORT

按用户拍板：功能进官方对应分类、替换官方同款、取消顶栏、拿掉左侧导航、首页六张卡当入口、功能不缺失。

## 改了哪些文件

- `client.js`：就绪且有 cwd 时不再画 `dsos-bar` / `CategoryMenu`。只留共享写薄横幅 + 全高 iframe + 抽屉。监听 `postMessage {source:'dsos', open, reload}`。空态仍可「打开设置」。抽屉组件全部保留，可从分类页打开。
- `http.js`：`THEME_CSS` 藏侧栏、补画布宽度、加 `#dsos-cat` 产品条样式、藏官方导入卡片和官方 SPARQL 查询页。explorer boot 按类插入产品条；导入导出在页内走我们的三句规矩；合并仍拦截 `POST /api/enrich/merge`；SPARQL 默认折上。`?v=` 从 `dsos10` 升到 `dsos12`。boot 无 `//`。
- `LAYOUT-REPORT.md`：本报告。

未改 `/workspace/deepseek-harness`。十二工具名未动。路径未写死。

## 侧栏选择器

官方 0.6.5 静态（`/tmp/semantica065/lib/python3.13/site-packages/semantica/static/assets/index-CSv7QafR.js`）：

| 元素 | class / 结构 |
|---|---|
| 整列侧栏 | `aside.app-rail`（宽 88px，内含 `brand-pill` + `.nav-button`） |
| 导航钮 | `.nav-button` + `.nav-label`；`data-active`；id 为 explore / analyze / decisions / enrich / manage / ontology-hub |
| 回首页 | `.brand-pill`（`O("welcome")`） |
| 首页官方卡 | `.landing-workspace-card` / `.landing-workspace-grid`（原先已藏） |
| 我们的六张卡 | `.dsos-home-card`，点击隐藏的 `.nav-button` |
| 工作区壳 | `.app-shell` > `.workspace-shell`（`flex:1`） + `.workspace-header` / `.workspace-body` |
| 工作区页 | `.ws-page` / `.ws-card` / `.workspace-tab` |

藏法：`.app-rail { display:none }`。主画布 `.workspace-shell` / `.landing-page` 补 `flex:1; width:100%`。DOM 里侧栏还在，首页卡 `click()` 仍能进各类。产品条第一钮「首页」点 `.brand-pill` 回到六张卡。

## 每类替换了什么

进入分类后在 `.workspace-header` 后插入 `#dsos-cat`，替换官方同款工具，不叠一层。

| 分类 | 官方被替换 | 我们的产品条 |
|---|---|---|
| 探索 | 不叠官方查找/加实体。官方图谱画布（GraphWorkspace / explore-toolbar）留下 | 查找 `/semantic-os/nodes`、加实体（postMessage 开 `AddEntityForm`）、复制来源路径 |
| 分析 | 官方 SPARQL 查询页整页藏掉（`body[data-dsos-sparql="1"] .workspace-body .ws-page`），默认折上不再给官方展开钮。官方推理画布留下 | SPARQL 开我们的 `SparqlPanel`（默认折上，失败 `sparql.fail`） |
| 决策 | 官方无「记一条」表单，无需拆。官方决策列表留下 | 记一条 → `DecisionForm`（缺字段 `decision.form.fail`） |
| 导入导出 | 官方 `.ws-card` 文件钮/拖放/Upload/Download 藏掉（仅 Import 子页） | 导入 JSON/CSV、导出 JSON/CSV；只认 json/csv；非空图覆盖确认；失败回滚；导出越出目录确认 |
| 知识分类 | 官方本体画布留下。合并拦截 `POST /api/enrich/merge` confirm | 实体消歧 → `ErBar`（合并前确认，不可逆，失败句） |
| 管理 | 无官方摄取/桥/登记/设置同款可叠 | 摄取状态/取消/重试/再摄取/路径、创建桥、变更登记、打开设置 |
| 共享写 | 不做顶栏 | Client 画布上一条 `.dsos-banner` 薄提示 |
| 首页 | 官方五张 workspace 卡仍藏 | 我们的六张卡当唯一分类入口 |

## 功能自检表

| 功能 | 入口 | 状态 |
|---|---|---|
| 摄取取消/重试/再吃 | 管理 `#dsos-cat` → `/semantic-os/ingest/*` | 保留 |
| 查找 | 探索条 → `/semantic-os/nodes`；抽屉 `FindBar` 仍在 | 保留 |
| 加实体 | 探索条 postMessage → `AddEntityForm` | 保留 |
| 复制路径 | 探索条 → `/semantic-os/lineage`；抽屉 `LineageCopyBar` 仍在 | 保留 |
| 记一条 | 决策条 → `DecisionForm`，缺字段 `decision.form.fail` | 保留 |
| SPARQL 折上 | 分析条 → `SparqlPanel` 默认折上；官方查询页藏 | 保留 |
| 消歧确认 | 知识分类条 → `ErBar`；官方 merge POST 仍 confirm | 保留 |
| 导入三句保险 | 导入导出条页内实现 + 抽屉 `ImportBar` | 保留 |
| 导出越出确认 | 导入导出条页内实现 + 抽屉 `ExportBar` | 保留 |
| 桥 | 管理条 → `BridgeWizard` | 保留 |
| 变更登记 | 管理条 → `RegistryForm` | 保留 |
| 设置 | 管理条 / 空态「打开设置」→ `SettingsForm` | 保留 |
| 共享写 | Client 薄横幅，非顶栏 | 保留 |
| 残留会话空态 | Client `EmptyState`（没目录 / 别处已开 / not-ready） | 保留 |
| dock | `conversation.input.dock` 未动 | 保留 |
| 官方图谱画布 | iframe `GET /semantic-os/explorer` | 保留 |
| 首页六张卡 | `.dsos-home-card` 点隐藏 `.nav-button` | 保留 |

## 阻塞

无。syntax `node --check` 通过。boot 无 `//`。`?v=dsos12`。
