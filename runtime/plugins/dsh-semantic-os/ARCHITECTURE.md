# 语义插件 · 架构与流程

用户装的是插件包（画面在 `dist/`）加离线运行时（`runtime-dist/`，Semantica 0.6.7）。不跑 Vite，不在语义页里现 pip。

## 四件套

| 角色 | 是什么 | 不是什么 |
|---|---|---|
| 书 | DSH 会话日志 `persistence.readFrom` | 不是图上的 Document 正文柜 |
| 目录 | `{cwd}/.dsh/semantic-os/passages/index.faiss` | 不是整图稠密向量、不会再涨到数 GB |
| 工作图 | FalkorDB 瘦图：型、实体、边、决策、记忆卡、`出自` | 不装日记全文 |
| 店面 | 本插件 `ui/` → `dist/` → `/semantic-os` | 不挂官方 Explorer 应用 |

```mermaid
flowchart LR
  subgraph dsh [DSH]
    Logs[会话日志]
    UI[语义页 dist]
  end
  subgraph plugin [dsh-semantic-os]
    Host[Host 工具 / product API]
    Sidecar[sidecar /_dsh/python]
    FAISS[FAISS 日志段]
    Graph[瘦工作图 FalkorDB]
  end
  UI -->|同源 /semantic-os| Host
  Host -->|search / open| Logs
  Host -->|召回 id| FAISS
  Host --> Sidecar
  Sidecar --> Graph
  Logs -->|ingest 只索引+抽取| FAISS
  Logs -->|抽取工人| Graph
  Graph -->|出自 session:场:seq| Logs
```

## 问话怎么走

原话、钟点、出处都以日志为准。抽取结果不能当已过账。

```mermaid
sequenceDiagram
  participant 人
  participant 工具 as search_text
  participant 日志 as DSH 日志
  participant 目录 as FAISS
  participant 图 as 瘦工作图
  人->>工具: 搜原话 / 某天 / 14:33
  工具->>日志: 按 cwd 扫 session:场:seq
  工具->>目录: 近邻召回 id
  目录-->>工具: session:场:seq
  工具->>日志: 打开该句取摘录
  工具->>图: 补型 / 决策 / 记忆卡标签
  工具-->>人: 摘录 + 当时
  人->>工具: open_node(id)
  工具->>日志: 读该 seq 正文
```

## 新消息怎么进图

聊天正文不再 `upsert_documents`。日记只在日志里。

```mermaid
flowchart TD
  Tick[定时 ingest] --> Read[readFrom 新 seq]
  Read --> Index[index_passages → FAISS]
  Read --> Queue[抽取队列]
  Queue --> Gate{信封没点头 / 助手表 / 套话?}
  Gate -->|丢掉| Stop[不上图]
  Gate -->|过| LLM[DSH 模型抽实体]
  LLM --> Clean{名称是原文子串?}
  Clean -->|否| Stop
  Clean -->|是| Write[工作图: 实体 + 边 + 出自]
  Write --> Cue[记忆卡仅起草]
```

## 图谱页

```mermaid
flowchart LR
  Explore[探索页] --> API["GET /api/graph/nodes|edges"]
  API --> Slim[list_graph_* 跳过 session:/file:/mail:]
  Slim --> Seed[按类型撒点 即布局就绪]
  Seed --> FX[图分析可开]
```

`x/y` 只给画画。路径、SPARQL、SHACL、推理、检索不读坐标。

## 各功能吃什么

| 功能 | 依据 |
|---|---|
| 搜原话 / 几点钟 / 出处 | 日志 + FAISS 目录 |
| 图谱 / SPARQL / 路径 / 邻域 | 瘦工作图（抽取结果） |
| 词表 / 过审闸 | 手写 型，不是 NER |
| 已生效决策 | because + 回执 + 业务过账；抽取只是起草 |
| 现查单据 | 连接器在协助插件，行不进图 |
| 当前问题切片 | `search_text` 命中信封 + `missing`；不代现查 |
