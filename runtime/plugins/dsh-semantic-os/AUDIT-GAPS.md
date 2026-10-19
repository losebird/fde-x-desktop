# dsh-semantic-os 审查缺口 2026-08-19

审的是官方 Explorer：`/semantic-os/explorer?cwd=...&lang=zh`
本体中心当时卡在「正在加载工作区」，登记 / 编辑器 / 对齐 / 版本 / SHACL / 健康度 没审到。

## 已看到的缺口

### 首页
- 工作区卡片标题浅白叠在白底上，几乎看不见
- 「Semantica」曾被切成「语义a」（Semantic 短词误伤，已拆）

### 探索 / 图谱
- 搜索框里的「搜索」钮偏淡
- 节点在浅色画布上几乎看不见

### 分析
- 仍有英文：Drug Candidate, Gene → Disease, Pathway Activation
- 「One fact per line…」曾被切成「开e fact…」（On → 开，已拆）
- 「Use IF … AND … THEN …」整句英文
- 「Enter facts and rules… click Run Reasoning…」中英夹杂

### 决策
- 筛选框 placeholder 仍是 Filter by ID, category, outcome…
- 「无决策 available in the graph.」半翻译
- No decision selected / Select a decision from the list…
- 错误条 HTTP 422 原文，浅红对比差

### 导入导出
- 大段英文：Full graph snapshot: all node properties…
- 拖放区灰色官方暗底；「上传到图」偏淡
- 差异与合并：Compare suspected… 半翻译；表头灰底；「重复（删除）」红字看不清
- 实体消歧：整块炭黑/海军蓝底，阈值文字看不清
- 登记：IMPORT / EXPORT / MERGE / INFER / DELETE / VOCAB；0 events

### 管理
- PROV-O 血缘顶栏整条黑，输入和按钮看不清
- 图谱总览：4 types / 1 rel. types；分布标签偏淡
- 本体摘要：0 vocabulary schemes loaded；「打开完整浏览器」偏淡

### 本体中心（未审完）
- 标题出来，正文一直「正在加载工作区…」
- 因此没点到：登记、编辑器、对齐、版本、SHACL、健康度、加载本体弹层、实体搜索

## 修法约束
- 不要再整页扫 [style] 改颜色
- 短词只做整段精确匹配，禁止切进别的英文单词

## 本体中心复审 2026-08-19（加载已通）

- 登记空状态尾巴 `above.`
- 对齐：Suggestions、RELATION、CONFIDENCE、SOURCE、占位 Ontology Hub
- 版本：Ontology URI
- 健康度：ONTOLOGY
- SHACL：SHACL STUDIO、0 shapes、Generate strict、ONTOLOGY
- 主题：正文仍是官方深蓝；编辑器工具栏黑底看不见字；版本输入黑框；对齐/健康度/SHACL/加载弹层标题对比差；登记第一个筛选芯片空白
