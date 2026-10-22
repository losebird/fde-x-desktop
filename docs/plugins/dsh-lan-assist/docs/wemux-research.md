# Wemux 官方仓库研究：对 DSH 员工 AI 工作台的可复用性评估

> 研究对象：[`wemux-ai/wemux`](https://github.com/wemux-ai/wemux)  
> 研究快照：提交 [`179e6aa5c6277e4a73c2773028114eeb59fedc86`](https://github.com/wemux-ai/wemux/tree/179e6aa5c6277e4a73c2773028114eeb59fedc86)，仓库版本 `0.3.131`；官方 tag [`v0.3.131`](https://github.com/wemux-ai/wemux/releases/tag/v0.3.131) 指向提交 `f3a7b330ec8269f211e1fc177891e92da691a6fe`。  
> 调查范围：只使用官方 README、docs、仓库源码、LICENSE、NOTICE、CHANGELOG、manifest/tag。文中“事实”直接来自这些第一方材料；“判断/建议”是结合 DSH 目标架构所作分析，不代表 Wemux 官方立场。  
> 目标项目边界：`dsh-lan-assist` 提供 IM、协作和 AIP 式业务操作；`dsh-semantic-os` 提供知识图谱、业务目录和 Foundry + Ontology 式能力；企业业务系统始终是真相来源（system of record）。

## 结论摘要

Wemux 最值得 DSH 学习的，不是“再做一个 coding-agent 产品”，而是它把**人的交互面、中央控制面、每台电脑上的执行节点、可追溯任务/会话**拆成了清楚的产品与技术边界：Web/桌面/移动端负责统一体验，server 负责鉴权、调度和状态，worker daemon 是真实执行入口，控制面与节点通过持久 WebSocket 通信，并以配对码完成首次归属。[README 架构与工作原理](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/README.zh-CN.md#L68-L98) [Worker-first 文档](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/wiki/03-execution-architecture.md#L3-L29)

对 DSH 的推荐是：

1. **直接复用应非常克制**：Apache-2.0 下只建议复用经审计的小型纯 helper、无品牌 UI primitives 或少量 contract/type；配对/心跳协议、Electron 壳、IM/Drive 等都与 Wemux 领域和依赖紧密耦合，更适合改造而非原样搬入。
2. **重点改造成 DSH 模块**：把“每台电脑一个 worker”改造成“每台电脑一个 DSH node”，节点暴露的是受控的 Cordis/DSH 工具、文件、终端、浏览器、业务连接器与本地模型能力；控制面只编排，不绕过 DSH 的 sandbox、approval、业务 preview/write 闸门。
3. **主要借鉴产品信息架构**：主聊天、工作空间、任务、文件、执行中心的分层很有价值；但 DSH 应把知识图谱、业务目录、决策/审计、业务对象页提升为一等入口，而不是照搬以 Git/worktree 为核心的页面模型。
4. **明确不复用的核心假设**：Wemux 的“代码任务 = Git worktree = diff/branch/commit 交付”不适合成为员工工作台的通用业务事务模型。企业 ERP/CRM/采购等系统仍是真相，业务写入必须经连接器实时预览、权限核验、人工确认和幂等回执，不能由远程 shell、文件 diff 或 Agent 自述替代。

此外，仓库虽整体标注 Apache-2.0，但官方 README 明确说**文档与营销素材另行授权**，且 `wemux` 名称和域名是商标；NOTICE 也只明确商标限制，并未给出一份单独的素材许可文本。因此，复制软件代码通常可行，复制品牌、图标、营销文案/截图/视觉资产则不应仅凭 Apache-2.0 推定可行。[README 许可说明](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/README.zh-CN.md#L244-L250) [NOTICE](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/NOTICE#L1-L13)

---

## 1. 产品理念：一台电脑就是一个可调度节点

### 1.1 官方产品定位

Wemux 将自己定位为“AI Native organization OS / AI 原生组织的操作系统”，核心不是单一聊天机器人，而是人类与 Agent 协作、Agent 在隔离 worker 上完成真实工作的编排平台。[中文 README](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/README.zh-CN.md#L1-L13) 当前根 `package.json` 的描述更收敛为：worker 在真实设备节点执行代码任务，配套可自托管控制面、Web console 和 worker daemon。[package manifest](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/package.json#L1-L15)

其官方叙事有五步：描述需求、主 Agent 规划和选节点、worker 在本机隔离 worktree 执行、用户审核 diff、确认后交付。人的确认被放在交付前，控制面不执行用户代码。[README 工作原理](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/README.zh-CN.md#L68-L76)

“代码不离开机器”需要按官方 FAQ 的精确边界理解：仓库代码与模型凭据留在 worker，但 **diff、日志与产物会回传控制面**，因此不能把它扩大解读成“执行数据零出机”。[README FAQ](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/README.zh-CN.md#L195-L204)

### 1.2 “电脑即节点”的具体含义

官方 self-hosting 架构把控制面与 worker 明确分开：

- 控制面机器运行 web + server、Postgres、S3 兼容对象存储；
- worker 可以是用户电脑或任意机器，可以多台；
- worker 持有代码仓库、worktree、Agent CLI 和模型密钥；
- worker 不要求和控制面同机，通过控制面生成的配对码/安装命令加入。[SELF-HOSTING 架构](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/SELF-HOSTING.md#L5-L20) [安装与配对](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/SELF-HOSTING.md#L108-L121)

这意味着“一台电脑”不是简单的浏览器客户端，而是拥有身份、能力标签、并发上限、本地目录、运行时、终端和网络状态的执行实体。worker 注册消息中包含 `capabilities`、`labels`、`workspaceRoot`、`maxConcurrency`、平台、版本、运行/排队任务、终端会话与 mesh 状态。[executor 消息契约](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/packages/shared/src/types/executor-messages.ts#L101-L145)

### 1.3 对 DSH 的意义

**适合吸收的理念**：把员工电脑视为企业 AI 网络中的“能力与数据邻近节点”，而非仅作为网页入口。它可以承载：

- 本地文件与办公软件上下文；
- 用户已登录的浏览器/桌面应用；
- 本地模型、GPU 或专用工具；
- 局域网内业务系统、打印机、设备或受限资源；
- DSH sandbox、approval stack 和 Cordis 插件能力。

**必须改写的定义**：DSH node 不应被定义成“唯一代码执行入口”，而应是“受策略治理的能力执行入口”。代码执行只是其中一种能力；业务写操作依然必须由 `dsh-lan-assist` 的连接器与 preview/write 业务闸完成，知识与历史证据由 `dsh-semantic-os` 管理，ERP/CRM 等业务系统才是实时事实来源。

---

## 2. 架构、进程与协议

### 2.1 进程和存储拓扑

官方仓库是 monorepo，主要进程为：

| 组件 | 官方职责 | 关键技术 |
|---|---|---|
| `apps/web` | 控制台、任务/聊天/工作空间 UI | React、Vite、TanStack Start/Router |
| `apps/server` | 控制面、鉴权、调度、聊天编排、任务/工作空间管理 | Hono、Node.js |
| `apps/worker` | 配对、仓库准备、worktree、Agent runtime、Git 交付、终端/预览 | Node daemon、WebSocket、node-pty 等 |
| `apps/desktop` | 原生桌面壳 | Electron、electron-builder/updater |
| `apps/mobile` | 移动端壳 | React Native + Expo |
| `packages/shared` | 跨端类型、协议契约和纯函数 | TypeScript |
| Postgres | 主结构化状态 | Drizzle migrations |
| S3/R2/MinIO | Drive、图片和对象产物 | S3 兼容 API |

来源：[README 架构](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/README.zh-CN.md#L78-L98)、[根 manifest 依赖](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/package.json#L99-L172)。

Worker-first 是硬边界：server 只做控制和状态，worker 是代码任务执行入口；没有在线 worker 时 Web 不回退到 server 本地执行。[执行架构](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/wiki/03-execution-architecture.md#L3-L10)

### 2.2 控制面—worker 协议

#### 首次配对

控制面创建默认 10 分钟有效的配对码；兑换时检查不存在、已用、过期等状态。成功后按 `ownerUserId + machineId` 判断是否复用节点，生成 executor token，只在服务端保存 token hash，并记录节点所有者、可见性、workspace 范围、能力、平台与版本。[配对码与 token 源码](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/server/src/control-plane/executor-registry.ts#L450-L594)

这是一种易部署的“短期引导凭证 → 长期节点凭证”模式，适合 DSH 节点注册，但企业版还应增加设备证明、管理员准入、凭证轮换/吊销和审计。本次检索没有找到 mTLS 或证书型节点身份的第一方依据，因此不能把它推断为现有能力。官方本地存储文档还要求 node/user/workspace 分层，带用户身份的 runtime/auth 必须进入用户级 scope，禁止把用户凭据、Agent auth 或 MCP token 放入 workspace 共享目录。[Worker Local Storage](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/WORKER-LOCAL-STORAGE.md#L45-L108)

#### 长连接

worker 使用 executor token 构造控制面 WebSocket URL，消息是 JSON；收到的数据先解析为共享契约类型，再交给处理器。[worker WebSocket 客户端](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/worker/src/control-plane/ws-client.ts#L16-L78)

连接后 worker 发送 `executor.register`，此后每 5 秒发送 heartbeat；断开后 5 秒重连。注册/心跳包括运行与排队任务、节点版本、terminal sessions、mesh 和 telemetry。控制面下发 `control-plane.ready`、`task.assign`、`config.sync`、`executor.unpair/shutdown` 以及大量请求消息。[daemon 连接与心跳](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/worker/src/runtime/daemon.ts#L730-L778) [重连和心跳实现](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/worker/src/runtime/daemon.ts#L780-L1023) [双向消息 union](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/packages/shared/src/types/executor-messages.ts#L101-L619)

共享消息契约覆盖：

- 节点注册、心跳、能力更新和延迟探测；
- 任务 ack/event/result；
- runtime 配置同步与模型导出；
- 文件浏览、读写；
- worktree、Git status/diff/commit/rebase/push/PR；
- Agent prompt/event；
- terminal 创建、附着、输出和退出；
- preview tunnel、远程代码和桌面沙箱。

这说明它不是通用标准协议，而是一套 Wemux 领域专用的、强类型 JSON 消息总线。

#### Runtime 抽象

Wemux 将 OpenCode、Codex、Claude Code、Pi 统一在 worker runtime 层；OpenCode/Pi 走 SDK，Codex/Claude Code 走 STDIO。Skill 是每次执行由 server 打包下发的快照；MCP 可同时有 worker 配置级和单次执行级覆盖。[Runtime 架构](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/wiki/10-runtime-architecture.md#L3-L75)

Session continuation 不是简单复用一个会话 ID，而按 runtime、executor、agent、模型和 cwd hash 组成 scope；scope 不匹配时使用摘要 handoff，避免跨运行时错误续接。[续接作用域](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/wiki/03-execution-architecture.md#L49-L66)

### 2.3 对 DSH 的模块化建议

建议在 DSH 中形成四层，而不是原样引入 Wemux server/worker：

1. **DSH UI/协作层**：会话、任务、文件、节点、知识、业务对象和审批卡片；
2. **DSH control plane**：session/agent/node registry、调度、状态、审计、通知；
3. **DSH node plane**：每台电脑上的 daemon，装载宿主允许的 Cordis 服务和工具；
4. **truth connectors**：ERP/CRM/采购/NocoBase 等实时系统连接器，所有业务写入仍走现有业务闸。

协议上可借鉴 register/heartbeat/request-response/event 的 envelope，但不应复制整套 `ExecutorToControlPlaneMessage`：应定义 DSH 自己的版本化能力描述、工具调用、approval、artifact、stream、cancel、lease、幂等和回执协议。尤其不能允许远端用泛化 `file-write`/terminal 绕过企业业务系统连接器。

---

## 3. UI 页面布局、导航与核心工作面

### 3.1 全局壳与导航

Web 根布局是桌面左侧 sidebar + 顶部 SiteHeader + 主内容区；移动端改用 bottom nav，并有全局通知、悬浮 Agent chat 和全局搜索。认证后默认进入 dashboard/onboarding。[根布局源码](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/web/src/routes/__root.tsx#L105-L245)

当前主导航源码包括：

- 工作：Dashboard、Workspaces、Drive、可选会议记录/Brain/自动化、主 Agent Chat、Inbox；
- GitHub：Reviews、Actions、Issues（按 feature flag）；
- 系统：执行节点、Overview、Universe、Usage、Changelog、Models、Skills、Integrations、MCP、Feedback、Settings；
- 侧栏还嵌入 workspace switcher、项目和 Agent 列表，并显示节点在线/离线/可升级数量。[侧栏导航定义](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/web/src/components/app-sidebar.tsx#L770-L929)

优点是把高频“工作”与低频“系统配置”分区；缺点是当前入口很多，员工工作台若照搬会显得偏开发者控制台。

### 3.2 三种会话/空间页面必须区分

官方文档特意规定三个页面边界：

| 页面 | 职责 | 会话/实体 |
|---|---|---|
| `/chat` | 主 Agent 编排、需求理解、选 Agent/worker、派发 | `mainChatSession` |
| `/workspace` | 单个工作区详情、任务状态、terminal | `workspaceSession + taskId + workspaceSessionId` |
| `/workspaces` | 工作区列表、创建和进入会话 | workspace/session 列表 |

来源：[页面边界](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/wiki/13-page-boundaries.md#L1-L50)、[会话模型](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/wiki/14-session-models.md#L1-L63)。

这对 DSH 很有启发：**交互会话、业务工作空间、后台执行任务、runtime 原生线程不是同一种对象**，不能只用一个泛化 `sessionId`。DSH 至少应区分：人际/Agent 会话、业务上下文空间、业务动作票据、后台 agent run、节点运行时 thread、语义证据/决策记录。

### 3.3 Chat

`/chat` 桌面端是三栏布局，使用 `react-resizable-panels`：目标栏、会话列表栏、主对话栏；目标可以是 Agent、群聊或 DM。移动端退化为列表/详情两态，并把 URL 深链和未读总量纳入状态。[chat route 源码](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/web/src/routes/-chat-route/chat-route.tsx#L1-L65)

官方 changelog 显示其协作面已覆盖 DM、群聊、未读、好友/连接、工作空间可见性、@人/@组/@文档、分享会话与 Web Push 等。[0.3.120–0.3.124 变更](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/CHANGELOG.md#L85-L164)

对 `dsh-lan-assist`：三栏 IM 骨架、统一 composer、未读和深链可改造成模块；但人员目录、群组、消息权限应接企业身份与组织系统，不能以内置好友模型作为唯一事实。

### 3.4 Workspace、Terminal、Files、Preview

单工作区页面将 Chat 与可懒加载的 Files、Git、Preview、Terminal、测试记录、桌面沙箱等 panel 组合，并支持持久 terminal dock、折叠/最大化和通过 URL 保存 panel 状态。[workspace route 源码](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/web/src/routes/workspace.tsx#L101-L186)

这适合作为 DSH 的“上下文工作空间”参考：左/中侧是会话和任务，右侧是当前对象/文件/运行/业务结果。不过 DSH 的右侧主面板应优先承载：

- 业务对象详情和实时查询结果；
- preview/approval/write 回执；
- 文件与知识证据；
- 节点工具输出和终端（仅对获准角色）；
- 图谱实体、ontology 类型和 lineage。

Terminal 不应成为普通员工绕开 AIP 业务动作闸的入口。

### 3.5 Tasks

Wemux 的任务具有独立 `distributedTask` 生命周期，和页面 `taskId`、runtime session 明确分开；任务可被 worker ack，持续报告 event，最终返回 result。[消息契约](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/packages/shared/src/types/executor-messages.ts#L169-L191) 这套“任务是持久业务对象，执行是其一次运行”的区分值得 DSH 直接采用概念，但 DSH 的任务结果还需关联审批、业务票据、事实快照和幂等 trace。

### 3.6 Drive / Files

README 将 Drive 定义为 workspace 级文件存储与分享，后端使用 S3 兼容对象存储。[核心特性](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/README.zh-CN.md#L34-L43) [对象存储配置](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/SELF-HOSTING.md#L69-L92)

DSH 可借鉴统一文件浏览/预览/分享面，但应把“文件存储”和“进入知识图谱”分开：文件上传不应自动等同于已验证知识；是否摄取、来源、版本、访问范围和有效期应由 `dsh-semantic-os` 显式管理。

### 3.7 Execution / 远程节点

执行中心负责新增、配对、查看在线/离线/版本与 mesh 状态，并可进入节点终端。worker 支持私有、public ingress 和 mesh preview/terminal 路径；mesh bridge 对目标和签名 token 做约束。[自托管节点流程](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/SELF-HOSTING.md#L108-L121) [mesh proxy 路径及 token 校验源码](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/worker/src/preview-ingress/server.ts#L288-L428)

DSH 应采用“执行中心”作为管理员/高级用户入口，并进一步展示：设备归属、企业身份、信任级别、策略包、连接器、可用工具、敏感能力、最近审批、版本合规和撤销状态。

### 3.8 视觉系统

官方 UI 指南强调：扁平而非 Card 嵌套、紧凑信息密度、克制颜色、键盘友好；推荐可调整双栏、header + content、main + settings sidebar；深色 zinc 色板和语义状态色被写成具体 token。[UI 原则和色板](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/LINEAR-STYLE-UI-GUIDE.md#L1-L57) [布局模式](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/LINEAR-STYLE-UI-GUIDE.md#L60-L120)

此处更适合“借鉴原则”而非像素级复制：企业员工工作台需要 DSH 自己的品牌、浅/深主题、无障碍标准和业务状态视觉语言。

---

## 4. 安装、升级与跨平台

### 4.1 控制面安装

开发环境要求 Node.js 20+、pnpm 10+、Docker；开发可分别启动 infra/server/client/worker，也可用 TUI 一体启动。[README 快速开始](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/README.zh-CN.md#L100-L137)

生产支持：

- Railway IaC/模板；
- Docker Compose：control plane + Postgres + MinIO；
- 自定义 S3/R2；
- health/readiness 端点；
- server 启动时自动跑 Drizzle migrations。[SELF-HOSTING Railway](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/SELF-HOSTING.md#L23-L130) [Docker Compose](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/SELF-HOSTING.md#L132-L153)

注意：README 仍说 `railway.json` 可用于一键部署，而最新 SELF-HOSTING 明确说 Railway 已弃用新服务的 Config as Code，应使用 `.railway/railway.ts` 或手工命令；研究和实施时应以更具体、更新的部署文档及源码为准。[README Railway 描述](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/README.zh-CN.md#L139-L173) [SELF-HOSTING 修正](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/SELF-HOSTING.md#L31-L67)

### 4.2 Worker 安装与升级

执行中心按系统生成安装命令。macOS/Linux 使用 `curl .../install | bash`；Windows/WSL 与 Docker 使用针对目标生成的命令。安装器完成下载、配对、用户服务注册和启动。[README 节点安装](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/README.zh-CN.md#L127-L137)

worker daemon 每 10 秒在空闲条件下检查更新；更新通道从 server 的 `/install/worker/manifest.json` 和 `/install/worker/package.tgz` 获取，不再依赖 npm registry。[worker 自动更新循环](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/worker/src/runtime/daemon.ts#L973-L998) [更新 manifest 实现](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/worker/src/update/worker-release.ts#L142-L239)

需要注意：`WorkerReleaseAsset` 类型支持 `sha256`，但当前 installer package 更新路径展示的 manifest 类型只读取 `packageName/packageVersion`，此处源码没有显示 `package.tgz` 的签名或 digest 校验。因此，如果 DSH 借鉴此更新机制，应补上签名 manifest、内容哈希、原子切换、回滚和企业发布环。[manifest 类型与检查](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/worker/src/update/worker-release.ts#L20-L52) [installer 更新逻辑](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/worker/src/update/worker-release.ts#L152-L227)

### 4.3 原生客户端与平台矩阵

桌面端和移动端复用 `apps/web` React renderer，通过 promise bridge 暴露 deep link、通知、更新、麦克风、托盘等能力。[Client Architecture](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/CLIENT-ARCHITECTURE.md#L1-L18)

Electron 构建目标为：

- macOS 10.15+，arm64/x64，DMG + ZIP；
- Windows x64，NSIS；
- Linux x64，AppImage；
- 默认 GitHub Releases 更新源，也可指定自托管 generic publish URL。[electron-builder 配置](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/desktop/electron-builder.config.cjs#L16-L21) [平台 targets](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/desktop/electron-builder.config.cjs#L65-L96)

PWA manifest 也提供 standalone 安装体验。[Web manifest](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/web/public/manifest.webmanifest#L1-L24)

对 DSH：复用同一 Web renderer + 轻量原生 bridge 的路线合理；优先顺序建议 Web/PWA → Electron 桌面 → 移动审批/消息壳。worker/node 与桌面壳应保持可独立升级，避免 UI 更新影响节点执行稳定性。

---

## 5. 安全、身份与网络

### 5.1 已有安全机制

第一方材料可确认：

- 用户鉴权由 server 负责，多数 API 使用 `requireAuth`；生产要求独立的 `BETTER_AUTH_SECRET`、`TOKEN_SECRET`、`SECRET_ENCRYPTION_KEY`。[生产变量](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/SELF-HOSTING.md#L69-L90)
- 敏感凭据使用 AES-256-GCM，加密 key 必须是 32 字节 hex；生产缺 key 会失败，而开发环境有本机路径派生的 fallback。[secret-crypto](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/server/src/services/secret-crypto.ts#L6-L64)
- 节点配对码一次性、默认 10 分钟有效；长期 executor token 在服务端仅保存 hash。[配对实现](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/server/src/control-plane/executor-registry.ts#L450-L594)
- 模型密钥在 worker 侧配置，官方声称不会进入 server；但控制面消息契约也支持同步若干 runtime 配置/凭据字段，所以实际部署应逐字段审计，而不能只依赖产品文案。[README BYOK](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/README.zh-CN.md#L175-L179) [control-plane.ready/config.sync 字段](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/packages/shared/src/types/executor-messages.ts#L556-L602)
- 工作空间、Agent、节点和会话存在 owner/workspace/membership/visibility/permission 范围；changelog 记录了按 workspace 收紧 DM、资源和节点可见性。[0.3.113/0.3.120–122](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/CHANGELOG.md#L111-L164)
- 建议用 HTTPS，worker 需要到控制面 HTTPS/WebSocket 连通性；支持 EasyTier mesh，preview/terminal mesh 使用签名 scoped token。[TLS 建议](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/SELF-HOSTING.md#L132-L153) [mesh token 校验](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/worker/src/preview-ingress/server.ts#L288-L428)
- 官方有私密漏洞报告政策，覆盖 web/server/worker/desktop/mobile/shared；但 SECURITY.md 是披露流程，不是安全架构证明或审计报告。[SECURITY.md](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/SECURITY.md#L1-L20)

### 5.2 网络路由

worker 可从控制面获得多个路由候选，对 `/api/health` 并发探测后选择可达且延迟最低的 control-plane URL，全部失败时回退 assigned route。[route-selection](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/worker/src/control-plane/route-selection.ts#L44-L128)

这种“节点主动出站连接 + 多入口探测 + WebSocket 长连”很适合 LAN/异地混合网络，通常比要求控制面主动入站到员工电脑更易穿过 NAT 和防火墙。

### 5.3 遥测与隐私

社区版默认启动时和每天向 `wemux.ai` 上报匿名聚合数据，包括随机 installId、版本、OS、部署模式和五个累计计数；官方声明不含内容、身份、密钥、代码和文件，可用 `WEMUX_USAGE_REPORTING_DISABLED=1` 关闭或改为自有端点。[TELEMETRY 完整说明](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/TELEMETRY.md#L1-L80)

对企业 DSH，默认策略应更保守：默认不外发，所有 telemetry 落企业自有域；如需外发必须明确 opt-in、数据分类、字段白名单、审计和保留期。

### 5.4 对 DSH 仍需补齐的企业安全要求

Wemux 源码可以作为起点，但本次第一方材料不足以证明其已具备下列完整能力，DSH 不应直接假设存在：

- OIDC/SAML/SCIM、企业目录同步、设备证书或 MDM 证明；
- mTLS、节点证书轮换、细粒度短期 capability token；
- 完整 RBAC/ABAC 策略引擎和 segregation of duties；
- 对 shell、文件、浏览器和连接器调用的一致审批/沙箱/数据防泄漏；
- 软件供应链签名、SBOM、可验证更新和企业灰度回滚；
- 不可篡改业务审计、SIEM 输出、数据驻留和保留策略。

DSH 应保留自身已有的 sandbox/approval/工具权限栈，并让 Cordis 服务、节点协议和业务闸统一受它约束。

---

## 6. LICENSE：代码、样式和素材能否复制

> 以下是工程合规分析，不构成法律意见；正式商用前应由法务复核具体文件、依赖和分发方式。

### 6.1 可以做什么

根目录 `LICENSE` 是标准 Apache License 2.0，授予永久、全球、非独占、免版税、不可撤销（许可条款规定的例外除外）的复制、修改、公开展示、再许可和分发权，并包含贡献者专利许可。[Apache-2.0 §2–3](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/LICENSE#L67-L88)

因此，对**明确属于本仓库 Work 的软件源代码**，通常可以：

- 内部复制和修改；
- 抽取模块并整合进 DSH；
- 以源代码或二进制形式分发；
- 将自己的修改或整体衍生作品置于不同许可条款下，但仍要满足 Apache-2.0 对原 Work 的要求。

README 也明确说仓库社区版代码可自托管、可修改，仓库内容在 Apache-2.0 下使用；ROADMAP 再次声明控制面、worker、web、desktop/mobile 和 meeting runtime 位于本仓库且采用 Apache-2.0。[README 开源边界](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/README.zh-CN.md#L45-L66) [ROADMAP](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/ROADMAP.md#L7-L11)

### 6.2 分发时必须做什么

Apache-2.0 §4 要求：

1. 向接收者提供许可证副本；
2. 修改过的文件要有醒目的修改说明；
3. 保留适用的版权、专利、商标和归属声明；
4. 如果上游含 NOTICE，衍生分发物要在规定位置包含适用 NOTICE 内容。[Apache-2.0 §4](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/LICENSE#L90-L129)

本仓库确有 NOTICE，因此若分发复制/衍生代码，应保留适用归属，同时不能让新增声明看起来修改了 Apache 许可证。[NOTICE](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/NOTICE#L1-L13)

### 6.3 商标不可复制

Apache-2.0 不授予 licensor 的商号、商标、服务标志或产品名称使用权，除合理描述来源和重现 NOTICE 所需使用外。[Apache-2.0 §6](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/LICENSE#L139-L142)

NOTICE 明确称 `wemux` 和 `wemux.ai` 是商标；因此 DSH 不能把自己的产品、节点或服务命名/包装成 Wemux，也不应复用其 logo、app icon 造成来源混淆。[NOTICE 商标条款](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/NOTICE#L8-L10)

### 6.4 样式代码与视觉原则

- **CSS、React 组件、布局实现、设计 token 等软件代码**：若文件没有额外许可标记，原则上可按 Apache-2.0 复制/修改并履行归属义务。
- **通用设计原则**（扁平、紧凑、双栏、状态色）：思想/方法可借鉴，最好由 DSH 独立实现自己的 design system。
- **像素级视觉、独特品牌装潢**：即使实现代码可用，也应去除 Wemux 品牌识别，并避免让成品构成混淆性模仿。

### 6.5 文档、营销文案、截图、图标和素材

README 的许可末尾明确写道：“文档与营销素材另行授权（见 NOTICE）”，但当前 NOTICE 只给出版权、贡献者、商标与第三方组件说明，没有列出一份明确的独立文档/素材许可。[README 许可说明](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/README.zh-CN.md#L244-L250) [NOTICE 全文](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/NOTICE#L1-L13)

因此采取保守结论：

| 内容 | 建议 |
|---|---|
| 软件源码、配置、协议类型 | 可按 Apache-2.0 复用，履行 LICENSE/NOTICE/修改声明 |
| UI 组件/CSS/token 源码 | 可按代码复用，但去品牌并独立设计视觉体系 |
| 文档原文、营销文案 | 不直接复制；摘要、引用并链接来源，或另行取得授权 |
| logo、app icon、favicon、品牌插画 | 不复制，除非获得书面授权；自行制作 DSH 资产 |
| 产品截图/宣传图 | 不作为自有营销素材复用；研究文档中合理引用也应标注来源 |
| 第三方图标、字体、依赖 | 逐项遵守各自许可，不因顶层 Apache-2.0 自动归一 |

官方第三方许可报告也提示存在 MPL/LGPL/OFL 和大量 `UNKNOWN` 项，要求进一步人工确认；完整依赖以 lockfile 为准。[THIRD-PARTY-LICENSES](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/THIRD-PARTY-LICENSES.md#L1-L36)

### 6.6 建议的合规落地

若 DSH 实际拷贝代码，建议建立：

- `THIRD_PARTY_NOTICES.md`：记录来源仓库、固定 commit、文件路径、原许可；
- 修改文件头或 `CHANGES`：明确 DSH 做过的修改；
- vendored 模块目录中的 `LICENSE.wemux` 与适用 `NOTICE`；
- CI 依赖许可/SBOM 扫描；
- 一份“禁止导入”的品牌素材清单；
- 对每次上游同步做安全、许可和架构差异审查。

---

## 7. 面向 DSH 的能力分类

### 7.1 分类总表

| Wemux 能力 | 分类 | 对 DSH 的建议 |
|---|---|---|
| Electron 壳复用 Web renderer、native promise bridge | **直接复用候选** | 抽取通用壳/bridge 结构，替换 branding、URL、更新源和权限；先核对 DSH Web 注入/启动机制 |
| 可调整双栏/三栏布局组件、统一 composer 模式 | **直接复用候选** | 复用代码前做依赖与样式隔离；更推荐复制少量无品牌组件而非整套 Web app |
| pairing code → executor token、register/heartbeat/reconnect | **改造成模块** | 设计为 DSH node identity/protocol，补设备证明、token 轮换、吊销、版本协商和审计 |
| 执行中心、节点状态、能力标签、版本合规 | **改造成模块** | 变成 DSH Node Center，纳入 Cordis 服务、sandbox policy、连接器、审批和健康信息 |
| 主聊天/DM/群聊/未读/通知 | **改造成模块** | 可服务 `dsh-lan-assist`，但人员/组织/渠道/权限接企业身份与 IM，不复制内置社交关系作为真相 |
| Main Chat / Workspace / Runtime Session 分离 | **仅借鉴并落实为 DSH 领域模型** | 增加业务票据、decision/evidence、connector transaction 等 DSH 专有实体 |
| Task ack/event/result 与流式执行状态 | **改造成模块** | 建立版本化 job/run 协议；结果必须带 trace、证据、approval 和业务回执 |
| Drive、文件浏览/预览/分享 | **改造成模块** | 对接企业对象存储/DMS；文件入图谱需显式 ingest 与 lineage，不自动成为事实 |
| Terminal、文件读写、remote code、preview tunnel | **有限改造** | 仅对开发/运维角色和受控节点开放；必须走 DSH sandbox/approval，不能成为业务绕行通道 |
| Runtime adapter（OpenCode/Codex/Claude/Pi） | **仅借鉴接口思想** | DSH 已有模型路由、subagent/goal/Cordis；避免叠加第二套 runtime orchestration |
| Skill 每次执行打包、MCP 配置级 + 执行级覆盖 | **仅借鉴** | 可用于 capability snapshot/versioning，但 DSH 应以 Cordis registry、工具 schema 与会话 preset 为主 |
| Git worktree 隔离、diff/branch/commit 交付 | **只适合编码子域** | 可作为 DSH coding workspace 插件，不应成为员工业务工作台的通用事务模型 |
| EasyTier mesh、最低延迟路由探测 | **改造成可选网络模块** | 企业环境优先标准 VPN/Zero Trust；需要 LAN 节点互联时再采用，安全团队审计网络面 |
| 自托管控制面 + Postgres + S3 | **仅借鉴部署拓扑** | DSH 现有 Host/Cordis 组成优先；不要为了复用 Wemux UI 引入第二套控制面和数据库 |
| 默认向 wemux.ai 的社区遥测 | **完全不适合原样使用** | 企业 DSH 默认禁用外发，改为自有 telemetry/audit 域 |
| 内置邮箱/Google 登录和好友/空间模型 | **不适合作为企业身份主系统** | 企业身份、组织、成员与权限必须来自 IAM/HR/目录系统；本地数据只做缓存/映射 |
| 商业托管模型网关、官方托管节点池 | **不在开源仓库，不能复用** | README 明确这些是仓库外商业服务；DSH 需自建或对接企业现有服务 |
| Wemux 名称、logo、icon、营销文案/素材 | **完全不适合复制** | 商标未授权，文档/营销素材许可不清晰；必须使用 DSH 自有品牌资产 |

### 7.2 最值得优先实施的四个 DSH 模块

#### A. DSH Node Agent

从 Wemux worker 中吸收：安装、配对、服务注册、心跳、能力上报、断线重连、版本/更新、网络路由。替换执行内核为 DSH/Cordis，暴露明确能力：filesystem、terminal、browser、desktop、local-model、connector、GPU 等。每项能力有独立策略、可见范围和审批等级。

#### B. Node Center

从 `/execution` 产品模式改造：节点列表 + 详情；在线、版本、平台、信任、策略、最近运行、网络路线、可升级、隔离能力、所属员工/部门。普通员工只看自己的设备，管理员看组织态势。

#### C. Unified Work Surface

借鉴 chat 三栏和 workspace 多 panel，但围绕员工任务设计：

- 左：空间/人与 Agent/业务目录；
- 中：会话、任务与待确认；
- 右：业务对象、文件、知识证据、图谱、执行/回执；
- 底部或抽屉：仅在需要时出现 terminal/log，而非默认主角。

#### D. Versioned Node Protocol

使用 `hello/register/heartbeat/request/event/result/cancel` 基础 envelope，增加：

- `protocolVersion` 与 capability schema version；
- request id、trace id、idempotency key、lease/timeout；
- user/session/workspace/business-ticket scope；
- required approval、policy decision、receipt；
- payload size/stream channel；
- signed update and artifact digest；
- revocation、rotation、remote wipe/unpair。

### 7.3 明确保留 DSH 的架构主权

不建议把 Wemux 整仓 fork 成 DSH 主体，原因是：

1. Wemux 的领域中心是 coding worker、Git/worktree 和 agent runtime；DSH 的中心是企业协作、语义知识和受控业务操作。
2. DSH 已以 Cordis 组合 Host services、agent presets、tools、sandbox、approval、subagent 与 UI slots；引入 Wemux server/worker 会形成重复 registry、调度器、权限面和会话模型。
3. 企业业务系统是真相，不能把 Wemux Postgres、Drive 或 worker 本地状态提升为业务事实源。
4. 整仓 fork 会带来 6,000+ 依赖许可/安全面、快速变化的 preview 版本和大量非目标功能。

更合理的路线是“**读源码、抽模式、少量 vendoring、DSH 原生实现**”。

---

## 8. 推荐落地路线

### 阶段 0：许可与边界

- 固定本次评估 commit；
- 建立可复制代码白名单和品牌素材黑名单；
- 选择 2–3 个最小、无品牌、低依赖的候选模块；
- 法务确认 README 所称“文档与营销素材另行授权”的实际边界。

### 阶段 1：节点协议原型

- 只实现本机/LAN 节点注册、heartbeat、capabilities 和状态页；
- 节点只主动出站连接控制面；
- 不先做远程 terminal，不做业务写入；
- 接入 DSH 现有 session、sandbox、approval 和审计。

### 阶段 2：员工工作面

- 三栏 IM/Agent 会话；
- workspace 右侧业务对象与知识 panel；
- 任务 run 独立于会话；
- 节点执行结果可追溯到具体 tool、input、approval、artifact 和 receipt。

### 阶段 3：受控能力

- 文件读取、浏览器、桌面和 terminal 按风险分级开放；
- 业务操作只调用 `dsh-lan-assist` 连接器，不允许 shell 直写业务库；
- `dsh-semantic-os` 负责来源、图谱、ontology、decision 和历史证据，不声称历史等于当前事实。

### 阶段 4：企业化

- OIDC/SAML/SCIM、设备证书/MDM、mTLS 或 Zero Trust；
- 节点更新签名、SBOM、灰度、回滚；
- SIEM/审计、数据驻留、DLP；
- 标准 VPN/企业网络优先，按需评估 mesh。

---

## 9. 风险与待验证事项

1. **仓库版本节奏**：当前根版本为 `0.3.131`，CHANGELOG 多处标为 Preview，说明 API/UI 仍可能快速变化；不要把内部协议视为稳定公共标准。[package version](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/package.json#L1-L15) [CHANGELOG 顶部](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/CHANGELOG.md#L1-L18)
2. **README 与具体部署文档存在时效差异**：Railway 配置即是一例；复用时应以源码、测试和具体 docs 交叉验证。
3. **BYOK 表述需逐字段审计**：官方产品文案说模型 key 不离开 worker，但 control-plane message 类型含 runtime auth/config 内容；实际数据流要按每个 runtime 实现审计。
4. **更新供应链**：当前 installer manifest 路径未在所查源码中显示 package digest/signature 强制校验；企业 DSH 不应原样复制。
5. **依赖许可**：官方第三方报告存在 1,124 个 UNKNOWN，且报告时间点/扫描方法只是仓库自述；实际抽取模块需重新生成 SBOM 和许可报告。
6. **素材许可不清楚**：README 指向 NOTICE，但 NOTICE 没有单独素材授权条款；在获得明确书面许可前不要复制品牌资产。
7. **安全成熟度不能由 SECURITY.md 推定**：有漏洞报告流程不等于经过第三方审计或满足企业合规。

---

## 10. 第一方来源索引

- [README.zh-CN.md（固定提交）](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/README.zh-CN.md)
- [package.json / manifest（固定提交）](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/package.json)
- [SELF-HOSTING.md](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/SELF-HOSTING.md)
- [CLIENT-ARCHITECTURE.md](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/CLIENT-ARCHITECTURE.md)
- [执行架构](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/wiki/03-execution-architecture.md)
- [Runtime 架构](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/wiki/10-runtime-architecture.md)
- [页面边界](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/wiki/13-page-boundaries.md)
- [会话模型](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/wiki/14-session-models.md)
- [UI Guide](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/LINEAR-STYLE-UI-GUIDE.md)
- [TELEMETRY.md](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/TELEMETRY.md)
- [THIRD-PARTY-LICENSES.md](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/docs/THIRD-PARTY-LICENSES.md)
- [SECURITY.md](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/SECURITY.md)
- [LICENSE](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/LICENSE)
- [NOTICE](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/NOTICE)
- [CHANGELOG.md](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/CHANGELOG.md)
- [ROADMAP.md](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/ROADMAP.md)
- [executor message contracts](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/packages/shared/src/types/executor-messages.ts)
- [worker WebSocket client](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/worker/src/control-plane/ws-client.ts)
- [worker daemon](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/worker/src/runtime/daemon.ts)
- [pairing/executor registry](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/server/src/control-plane/executor-registry.ts)
- [worker update manifest path](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/worker/src/update/worker-release.ts)
- [Electron builder config](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/desktop/electron-builder.config.cjs)
- [PWA manifest](https://github.com/wemux-ai/wemux/blob/179e6aa5c6277e4a73c2773028114eeb59fedc86/apps/web/public/manifest.webmanifest)
- [官方 release v0.3.131](https://github.com/wemux-ai/wemux/releases/tag/v0.3.131)
