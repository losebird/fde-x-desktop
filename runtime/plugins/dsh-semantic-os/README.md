# dsh-semantic-os

这是 DeepSeek Harness 上的语义插件。装在你自己电脑里，每个工作目录一本图：人、单据引用、制度词表、聊过的话、当时拍过的板。拿来搜、对照规则、查这句话从哪来。

它不是公司 Wiki，也别拿它当现账。单据现在待不待审，要现查。

引擎是安装包里那份离线 `semantica==0.6.7`。页面已经打进 `dist/`，装的人不用编前端。浏览器不打 sidecar 回环，也不嵌官方 Explorer。

## 什么时候用得上

上次怎么定的：聊天里问，或打开决策页。图上记的是当时，不是现在。

这句话出自哪次会话、哪份文件：直接问出处。血缘页要节点编号——探索里点那个点就能抄，搜出来的摘录上也有，长得像 `session:…:123` 或 `memory:…`。

铁律、你纠正过的话：说「记住」。会写成记忆卡，之后能当依据。新卡直接入档；不想再用就去记忆梳理里退休。

采购单现在待不待审：走业务页现查。图上那条引用只说明曾经有这张单、当时怎么定，别信图上的「现在」。

词表改了两版差在哪：知识分类 → 版本，登记再对比。用的是 Semantica 自带的 `VersionManager`。

填写规则过不过：知识分类 → 规则检查。没有形状就先点「按结构生成规则」。

协助插件那边聊过什么：那边是另一本图。这边要搜到，先建桥。两本图不会并成一本。

人名单进图：设置里配花名册或同步地址。只写 id、显示名、在不在职，不写账号。

别指望它：全公司同时在线、自动过账、把 ERP 行灌进图、拿它当审批流引擎。

## 语义页

会话头顶栏点「语义」。引擎起来了、当前会话又有工作目录，首页就是六张卡。

探索是工作图。点节点能看编号、复制路径、跳出血缘。日记全文不画在这张图上。

分析里有 SPARQL，还有往前推、模式匹配、逻辑规则。默认只预览，不会把推出来的边偷偷写进图。

决策页是台账、因果、先例。只有带回执的业务过账才叫已生效。

导入导出认 json / csv。RDF 看你这台机器有没有导出器。失败会回到上一份，不会把图写烂。

知识分类管词表：列表、编辑、版本、对齐、健康、规则检查。

管理上看摄取进度、血缘、人名单、存图后端、记忆梳理。

首页那一排数字是按图上真实类型数的：聊天、人、制度、单据引用、决策、文件。没有的桶就不出现。

## 聊天里

模型按你的原话选工具，常见这几类。

搜用 `search_text`：原话、人名、某天、几点。先给你摘录，再 `open_node` 打开整段。默认会顺着桥去对面工作区翻会话。命中带 `knowledge_grade`（观察 / 记忆 / 推断 / 回执），都是当时，不是现在。`missing` 是词表里该现查的型；现查仍走协助插件的 `biz_preview`，连接配置在协助上。

出处用 `lineage`，要带编号。

拍板先 `brief_for_decision` 把依据摆出来，你点了头再 `record_decision`。要记成已生效：依据、回执、`nod_kind=业务过账`，三项缺一不可。

记忆：`draft_memory_card` 入档，`list_memory_cards` 列表，梳理里退休、续期、连理解边。

型用 `upsert_workspace_vocab` 手写，比如采购单、待办。单号和金额不要写成型。

图上增删查：`query_graph`、`add_entity`、`add_relationship`、`get_graph_summary`、`get_graph_analytics`、`export_graph`，以及 `backup_graph` / `restore_graph`。

推理是 `run_reasoning`。`route_intent` 只分类，不代替搜索。

中文实体抽取走会话模型；英文在本机有 spaCy 模型时才走引擎 NER。抽出来的东西不能当已经过账。

## 账本搁哪儿

每个工作目录一本：`{cwd}/.dsh/semantic-os/`。

工作图在 FalkorDB，备份是 `graph.json`。上面是型、实体、边、决策、记忆卡、业务引用。

聊天正文在 DSH 会话日志里。段落索引大约留最近一万条，一条消息一个点，不是整场塞一篇。进索引的正文大约 1200 字。更早的模糊搜会变弱，对原话往往还能从日记里捞到。

人从花名册写到图上的 Person，前提是引擎能写图。

制度是 OWL / SKOS / SHACL，加上版本、对齐、规则检查。

单据在图上只留引用和当时的板。现在的状态现查。

记忆卡另有一份很小的向量（`agent_memory.json`）。聊天段落还有一份有上限的 FAISS 目录。整图那份无限变大的稠密 FAISS 不用了。

跨工作区用桥。搜可以跟过去，库还是分开的。

## 安装

先装 [DeepSeek Harness](https://github.com/deepseek-ai/dsh)，再从本仓库 Release 下对应平台的包。

当前公开包：[v0.1.1](https://github.com/losebird/dsh-semantic-os/releases/tag/v0.1.1)。未签名。装完重启 DSH。

GitHub 上这条 Release 的日期是 **2026-08-29**（建 tag 那天）。安装包后来覆盖过，**Mac / Windows / 两个 Linux 是 2026-09-02 换上去的**。别只看「4 天前」那一行。macOS Intel 这版还没挂，别 `pip install` 凑合。

| 机器 | 文件 | 怎么装 |
|---|---|---|
| macOS Apple Silicon | [darwin-arm64.tar.gz](https://github.com/losebird/dsh-semantic-os/releases/download/v0.1.1/dsh-semantic-os-0.1.1-darwin-arm64.tar.gz) | 校验 [sha256](https://github.com/losebird/dsh-semantic-os/releases/download/v0.1.1/dsh-semantic-os-0.1.1-darwin-arm64.tar.gz.sha256)，解压，双击 `Install Semantic OS.command` |
| Windows x64 | [win32-x64.tar.gz](https://github.com/losebird/dsh-semantic-os/releases/download/v0.1.1/dsh-semantic-os-0.1.1-win32-x64.tar.gz) | 校验 [sha256](https://github.com/losebird/dsh-semantic-os/releases/download/v0.1.1/dsh-semantic-os-0.1.1-win32-x64.tar.gz.sha256)，解压，双击 `Install Semantic OS.cmd` |
| Linux x64 | [linux-x64.tar.gz](https://github.com/losebird/dsh-semantic-os/releases/download/v0.1.1/dsh-semantic-os-0.1.1-linux-x64.tar.gz) | 校验 [sha256](https://github.com/losebird/dsh-semantic-os/releases/download/v0.1.1/dsh-semantic-os-0.1.1-linux-x64.tar.gz.sha256)，解压，跑 `install-semantic-os.sh` |
| Linux ARM64 | [linux-arm64.tar.gz](https://github.com/losebird/dsh-semantic-os/releases/download/v0.1.1/dsh-semantic-os-0.1.1-linux-arm64.tar.gz) | 同上 |
| macOS Intel | 还没挂 | 不要 pip |

安装器不用管理员权限，不访问 PyPI，不动系统 Python。它先校验 runtime，再 `dsh plugin --profile web add`。装完重启 DSH。

日常用不用自己装 Python。runtime 落在 `${DSH_HOME:-~/.dsh}/semantic-os/runtime/<version>/<platform-arch>`，切换版本是整份替换。失败会留下旧的。卸插件默认不删图。

Apple Silicon 包几百 MB，装完大约 1.5 GB。第一次拉引擎可能要一两分钟（Torch / ONNX），以后十几秒。`startTimeoutMs` 默认 180 秒。FalkorDB、Docker 是可选的，没有也能跑。

人名单同步默认不打本机、私网、link-local、云元数据。真要内网同步，打开 `peopleAllowPrivateNetwork`。

源码开发或修包才碰系统 Python，顺序是 `DSH_SEMANTICA_PYTHON`、设置里填的路径、插件私有 venv、平台默认。版本必须是 `semantica` 0.6.7。doctor 不过就是未就绪，不会把 Loader 弄挂。点「再探」会先停旧进程再拉新的。

```sh
dsh plugin --profile web add /path/to/dsh-semantic-os
```

改 Host 之后：

```sh
dsh --profile web --host 127.0.0.1 --port 3080
```

## 装好了没有

`dsh --profile web --dump-config` 里能看到 `id: dsh-semantic-os`。

打开 `http://127.0.0.1:3080`，会话头有「语义」。

引擎没起来：空态，设置里看 doctor，工具返回 `NOT_READY`。

没工作目录会让你选。目录已经在别的会话打开，就去会话头换过去，别硬改当前会话。

就绪后是自己画的六张卡，不是 Explorer 的 iframe。开发者工具里不该出现打 sidecar 端口的请求。

`GET /semantic-os/ready` 应返回 JSON。DSH 根上的 `/api/graph/nodes` 不是这插件的口。

wheel 装在另一份 Python 里的话：

```sh
export DSH_SEMANTICA_PYTHON=/path/to/python
```

然后设置里点「再探」。

## 发版

```sh
npm test
npm run test:smoke
npm run test:package
```

本机打当前平台的安装包：

```sh
npm run build:ui
node scripts/build-release-media.js
node scripts/archive-release-media.js
```

别的系统和 CPU 去 GitHub Actions 的 `Build platform runtimes` 打。别在一台 Mac 上交叉冒充 Windows / Linux 包。

## 卸载

```sh
dsh plugin --profile web remove dsh-semantic-os
```

卸完 sidecar 端口不该还在听。图文件默认还在各目录的 `.dsh/semantic-os/` 里。
