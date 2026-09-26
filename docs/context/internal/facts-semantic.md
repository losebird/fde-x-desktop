# FDE-X × dsh-semantic-os 事实摸底（只读）

源码：`scene-39-personal-workstation`；插件：`~/.dsh/vendor/dsh-semantic-os`；FDE runtime：`~/.dsh-fde-x/semantic-os/runtime`（`runtime/dsh-core.mjs` L384–410 从 `~/.dsh/semantic-os/runtime` 或 `vendor/.../runtime-dist` 物理拷贝，禁 symlink；HANDOFF L156 ≈1.8GB）。

## 1. semantic-os 能力（Host / HTTP）

**DSH Host 工具**（`gate.js` L10–18，`tools.js` L220+）：读—`search_text`、`lineage`、`brief_for_decision`、`query_decisions`、`find_precedents`、`list_memory_cards`、`query_graph`、`open_node`、`get_causal_chain`、`route_intent`、`get_graph_summary`…；写—`draft_memory_card`、`nod_memory_card`、`record_decision`、`add_entity`、`extract_*`、`ingest_directory`、`index_passages` 等。执行走 sidecar `POST /python` `{op, cwd, args}`（`tools.js` L2–4）。

**同源 `/semantic-os/*`**（`http.js` L718–783 + `product.js` L41–462）：
- 运维：`/ready`、`/retry-ready`、`/settings`(+`/settings/probe`、`/settings/cli`)；`GET/POST /deps`（`product.js` L236–257）。
- 摄取：`/ingest`、`/ingest/progress|ensure|start|cancel|retry`（L47–81）；`GET /session-ingest`、`POST /session-ingest/now`（L83–95，`session-ingest.js` L3–4 默认 30min 扫 DSH 会话）。
- 检索：`POST /find`→`search_text`+`search_passages`+`mergePassageHits`（`product.js` L107–109、L1195–1270）；`POST /api/graph/search`→`graph_label_search`（L123–125、L1273+）；`POST /retrieval-score`（L110–118）。
- 图/决策/词表/时间：`/lineage`；`/api/coverage`、`/api/graph/*`、`/api/decisions/*`、`/api/temporal/*`、`/api/ontology/*`、`/api/vocabulary/*`、`POST /api/sparql`、`/api/enrich/dedup`、`/api/export|import`（L121–234）。
- 桥与人员：`/bridge` CRUD（L352–368）；`GET/POST /people`、`/people/left-ids`（L435–456）。
- 其它：`POST /python` 任意 `bootstrap.run_tool` op（L296–346）；`POST /import`；`POST /extract-session`（L267–294）；`GET /ask-excerpt`；`GET/POST /annotations`；`GET /writes`；`POST /archive-record`；`POST /api/reason`；`GET /usage`（L97–98）。
- 静态六画布：`/ws/{explore|analyze|decisions|io|ontology|admin}/*`（`http.js` L776–810）。
- **反代 sidecar**：`/assets/*`、`/_dsh/*` 等（`http.js` L859–887）；sidecar 侧还有 `product.js` L24–35 探测的 `/api/analytics`、`/api/provenance` 等。

**FAISS 段落索引**（`python/passages.py` L1、L25–26、L72–86、L210+）：路径 `{cwd}/.dsh/semantic-os/passages/`；算法 `faiss-ip-hash256-v1`，**本地 sklearn `HashingVectorizer` char_wb 256 维**（L72–86），非云端 embedding。存 `index.faiss`+`meta.json`（ids/times）；写入后删 legacy `texts.json`（L170–176）。**数据源**：`session-ingest` 从 DSH 会话事件切块 `session:{id}:{seq}` 调 `index_passages`（`session-ingest.js` L280–289）；id 亦可 `file:`/`mail:`（`passages.py` L1）。**更新**：定时 session-ingest + 手动 `session-ingest/now` + 摄取管道；`index_passages` 亦可 Host 写入任意 rows（`bootstrap.py` L6571–6572）。

**图存储**：按 cwd 的 FalkorDB/`graph.json`（`SemanticSettings.tsx` L7）；`search_text` 读节点行+稀疏向量补全（`bootstrap.py` L2323–2396、L2399+）。

## 2. FDE-X 已用

**4318 BFF**（`runtime/server.mjs`）：`/api/v1/memory/ready|retry-ready|settings`→`/semantic-os` 同名（L977–1000）；`deps|usage|session-ingest|people`（L1318–1359）；`GET search`→`semanticOs('/find')` POST（L1773–1777，`dsh-core.mjs` L646–659）；`GET/POST cards`→`/python` `list_memory_cards`/`draft_memory_card`（L1781–1800，`dsh-core.mjs` L598–601 白名单仅此二 op）。**`/semantic-os/*`**：`proxySemanticOs` 转发 DSH origin，剥 cookie、校验 Origin/路径（L553+、L879）。

**`src/` 调用**：`Memory.tsx`—语义首页、六画布 `mount`（L8–15、L212–246）、`semanticCoverage`、`ingest/*`、`lineage`、`import`、`bridge`、`semanticPython`（`add_node`、`record_decision`、`memory_health`、`export_graph`）；抽屉搜索 `searchMemory`（L622–647）。`CommandPalette.tsx` L107–115、L174–179：`searchMemory`。`IMWorkspace.tsx` L1123：`draftMemoryCard`（记档案）；「先例」仅 `im-ai.ts` L134–136 提示 AI 调 `search_text`，**无 memory HTTP**。`Briefing.tsx` L264：`draftMemoryCard`。`SemanticSettings.tsx`：ready/settings/deps/usage/session-ingest/people。`runtime-api.ts`：`listMemoryCards` **仅定义、无引用**。`AI.tsx`：仅 `memoryReady` 状态条（L333、L543–550）。**无**计划/文件/Skills 页直接调 memory API。

**Host 会话**：DSH 连上后 semantic-os 全套工具可用（规格 `PRODUCTION-SPEC.md` L37）；FDE 未在 UI 封装。

## 3. semantic-os 有、FDE 产品层未接（示例）

- BFF `dsh-core.semanticOs` 禁止除 cards/find/运维外的 `/python` op（L598–646）。
- UI 未用：`/retrieval-score`、`/extract-session`、`/ask-excerpt`、`/annotations`、`/writes`、`/archive-record`、`/api/reason`、`POST /api/reason`、WebSocket upgrade（`http.js` L819+）。
- `listMemoryCards` 无页面；**HANDOFF §4.8「三层卡片 UI」与当前 `Memory.tsx` 语义首页不一致**（文档 L141 vs 代码无 project/daily/user 列表）。
- 模块未接：早报/计划/文件/Skills **无** `searchMemory`/`draftMemoryCard`（除 Briefing 保存）；IM 不进索引除 `draft_memory_card` 与会话 ingest。

## 4. 「中文工作区图搜索」活测链（`PRODUCTION-STATUS.md` L13）

探索画布搜框走 `POST /semantic-os/api/graph/search`（`product.js` L123–125）→ `graph_label_search`：**子串匹配** `_workbench_nodes` 的 id/type/content（`bootstrap.py` L3183–3214）。全局/⌘K/抽屉走 `POST /find`→`search_text`（图子串+`search_vectors` TF-IDF，`L2376` 对 CJK 用 `q in blob`）+ FAISS `search_passages`（char n-gram）+ `openCorpus` **回读 DSH session 日志拼摘录**（`session-corpus.js` L205–224）。中文 cwd 用 `?cwd=`（`server.mjs` L568–569 剥非 ASCII `x-dsh-cwd`）。

## 5. 数据边界

- **Profile**：DSH 进程 `DSH_HOME=~/.dsh-fde-x`（`dsh-core.mjs` L140、L253）；插件在 `profiles/fde-x/node_modules/dsh-semantic-os`（L355–360）。会话游标 `~/.dsh-fde-x/semantic-os/session-cursors.json`（`session-ingest.js` L16–18）。
- **按 cwd 隔离**：图/FAISS 在 `{cwd}/.dsh/semantic-os/`（`passages.py` L25–26）；API 需 `cwd`/`x-dsh-cwd`+`workspaceAuthority`（`http.js` L768–771）。
- **跨 cwd**：`search_text`/`find` 默认 `across_bridges`（`product.js` L1206–1207）；`/bridge` 链别的工作区（L352–368）。
- **非会话进索引**：`draft_memory_card`（BFF cards POST）；文件 `ingest_directory`/`run_pipeline`（Host）；`index_passages` rows；决策/实体写入图。**IM/待办/业务操作**无专用 FDE 写入通道；IM 仅卡片草稿或（若进 DSH 会话）session-ingest。

## 6. 性能与 `/health`

- 1.8GB：bundled Python+venv+FAISS 依赖树物理拷贝（§ 首段）。
- Embedding：**本机 CPU** HashingVectorizer（`passages.py` L72–86）；`search_text` fast path **不 import onnx**（`bootstrap.py` L2326–2328）；首次走 semantica 路径文档写 **~12s onnx 导入**（同 L2327、L6554–6555）。
- 搜索延迟：仓库**无** SLA 数字；session-ingest 冷启动重试 10s×20（`session-ingest.js` L305–317）。
- **`semantic-memory` 适配器**（`adapters.mjs` L74–90）：核心 `connected` 时 `GET /semantic-os/ready`，`ready.ready===true`→healthy，否则 degraded（doctor/reason）。

## 7. 规格铁律（约束「他模块写入记忆」）

| 原文要点 | 出处 | 对写入的含义 |
|---|---|---|
| 会话原文只读 DSH session 日志；禁止再抄 `texts.json`；FAISS 只留向量+id | `HANDOFF` L142；`PRODUCTION-SPEC` L510 | 模块不能把长文塞进 FAISS 侧车副本；应用 `draft_memory_card`/图节点，摘录搜索时读 session |
| 图是「当时」不是「现在」；记忆搜索不把图当现况 | `HANDOFF` L143；`PRODUCTION-SPEC` L312 | 搜索展示带时间戳/等级（`tools.js` L156–185）；不能把图状态当实时业务 |
| 现查走 `biz_preview`（记忆侧栏决策） | `HANDOFF` L143 | 业务真值不走 semantic 写穿 |
| 列表默认起草，点头才入档 | `HANDOFF` L141；`PRODUCTION-SPEC` L101 | 外部写入应走 `draft_memory_card`+`nod_memory_card`，非直接「已生效」 |
