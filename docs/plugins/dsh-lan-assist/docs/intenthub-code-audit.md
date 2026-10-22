# IntentHub 代码审计与简历表述建议

审计日期：2026-09-02。证据范围为本地克隆的 `origin=https://github.com/losebird/IntentHub.git`、分支 `business-semantic-abstraction-refactor` 及指定提交 `72af026a995d299e4a70d211cfb52399d8323934`；没有把 README 的产品描述误当作某一位贡献者的个人职责。

## 结论先行

IntentHub 不是一个单一的“文案/本地化项目”，而是一个让企业把 AI Agent 当作数字员工来使用的协作与业务执行平台。用户可创建并管理 Agent、通过 Web 或 IM 渠道交互；平台把自然语言业务请求编译为结构化操作计划，在业务对象、字段、关联、权限、确认、快照和审计检查后再执行或给出澄清/阻断反馈。[产品 README](https://github.com/losebird/IntentHub/blob/72af026a995d299e4a70d211cfb52399d8323934/README_zh-CN.md)、[路由实现](https://github.com/losebird/IntentHub/blob/72af026a995d299e4a70d211cfb52399d8323934/frontend/src/App.tsx)

对简历而言，正确的项目定位是“**企业智能体协作平台二次开发**”或“**企业 AI Agent 业务运行时改造**”；“企业运行时本地化治理”只能作为其中一个职责点，不能用来替代项目介绍。

## 产品实际做什么

### 面向最终用户的能力

- 为每个 Agent 提供持久身份、长期记忆、独立工作空间、任务关注点及定时/消息/Webhook 等触发器；组织成员可以把 Agent 当作可协作的数字员工使用。[README：Aware、数字员工与工作空间](https://github.com/losebird/IntentHub/blob/72af026a995d299e4a70d211cfb52399d8323934/README_zh-CN.md)
- 提供 Agent 聊天、工作台、任务、工作流、知识、业务对象/关系、搜索、审计、可观测性、日程、记忆、通知、交接、文件、本地化和连接器等页面；这些是实际注册的前端路由，而非仅出现在宣传文档中的功能。[`frontend/src/App.tsx` 路由](https://github.com/losebird/IntentHub/blob/72af026a995d299e4a70d211cfb52399d8323934/frontend/src/App.tsx)
- 企业业务运行时可把自然语言请求编译成结构化计划，针对业务对象、字段、关系、权限、确认、语义快照和审计进行验证；未满足条件时会停止执行或要求用户澄清。项目中的运行时提示键覆盖“对象未找到、字段不可写、权限不足、关系不存在、快照不可信、计划不可执行”等情形。[统一操作运行时改动](https://github.com/losebird/IntentHub/commit/72af026a995d299e4a70d211cfb52399d8323934#diff-00)；本地证据：`/tmp/intenthub-resume.G6EiYq/IntentHub/backend/app/services/enterprise_workbench_unified_operation_runtime.py`
- 业务数据场景与 NocoBase 连接器治理深度耦合；当前产品路径会在执行前生成预览/确认，并保留权限、快照、审计等控制点。该结论来自本次提交新增的运行时展示资源与服务调用点，不宜将其扩大为“已支持任意企业系统”。[运行时展示资源](https://github.com/losebird/IntentHub/blob/72af026a995d299e4a70d211cfb52399d8323934/backend/app/data/enterprise_runtime_presentation_catalog.json)

### 技术架构

前端采用 React 19、TypeScript、Vite、Zustand、TanStack Query 和 `react-i18next`；后端为 FastAPI + 异步 SQLAlchemy，可使用 SQLite/PostgreSQL、Redis、Docker、WebSocket 和外部 LLM API。README 明确说明平台不在本地执行模型推理，推理由 OpenAI、Anthropic 等外部 API 提供商承担。[前端依赖](https://github.com/losebird/IntentHub/blob/72af026a995d299e4a70d211cfb52399d8323934/frontend/package.json)、[后端依赖](https://github.com/losebird/IntentHub/blob/72af026a995d299e4a70d211cfb52399d8323934/backend/pyproject.toml)、[部署说明](https://github.com/losebird/IntentHub/blob/72af026a995d299e4a70d211cfb52399d8323934/README_zh-CN.md)

## 指定提交可证实的贡献

指定提交由 `losebird <382625007@qq.com>` 于 2026-08-18 提交；其父提交存在，因此可核对实际 diff。该提交修改 58 个文件（5,772 行新增、174 行删除），包括运行时展示资源、12 个后端语义/工作台服务、按能力域拆分的回归测试和变更范围清单。[提交与 diff](https://github.com/losebird/IntentHub/commit/72af026a995d299e4a70d211cfb52399d8323934)

可准确归纳为：

- 将分散在企业业务运行时中的提示、状态、澄清和阻断反馈接入版本化的中英文展示资源；运行代码通过 `runtime_display_text(key, values, locale=...)` 读取文案。加载器对英文选择 `en`，其他语言回退至 `zh-CN`。[资源加载器](https://github.com/losebird/IntentHub/blob/72af026a995d299e4a70d211cfb52399d8323934/backend/app/services/enterprise_runtime_presentation_catalog.py)
- 改造的用户可见路径横跨语义计划校验、业务对象/字段/关联解析、查询编译、运行时澄清、操作反馈和执行 Trace；例如统一操作运行时将“快照不可信”“缺少可校验计划”“对象冲突”等硬编码反馈改为按键读取的展示资源。[运行时 diff](https://github.com/losebird/IntentHub/commit/72af026a995d299e4a70d211cfb52399d8323934)
- 对会参与业务识别的匹配词显式按 `zh-CN` 读取，避免资源化后改变现有中文别名、提示词改写或状态字段的匹配结果；这属于兼容性保护，而不是简单的翻译工作。[提交说明](https://github.com/losebird/IntentHub/commit/72af026a995d299e4a70d211cfb52399d8323934)
- 为各改动面新增按范围划分的 RED 守卫和 owner-scope JSON；这些测试检查资源键、调用点和范围边界，目的是防止跨模块迁移造成回归。示例：[运行时编译上下文守卫](https://github.com/losebird/IntentHub/blob/72af026a995d299e4a70d211cfb52399d8323934/backend/tests/test_enterprise_task06_hr15_runtime_compile_context_red.py)、[范围清单](https://github.com/losebird/IntentHub/blob/72af026a995d299e4a70d211cfb52399d8323934/docs/qa/2026-08-18-task-06-hr15-runtime-compile-context-owner-scope.json)

### 关于“57 组”的口径

提交说明写有“57 个 `migrate_presentation_catalog` groups”，但同次提交的 owner-scope 文档又将这批展示资源的实施归到 Task 06，并保留 Task 05 的任务归属语义。这是项目内部任务编排口径，不能在简历中直接写成“完成 57 组功能”或“完成 57 个模块”。除非能给出业务验收口径，建议简历完全省略这个数字，只描述覆盖的业务链路和用户价值。[提交说明](https://github.com/losebird/IntentHub/commit/72af026a995d299e4a70d211cfb52399d8323934)、[owner-scope 的口径说明](https://github.com/losebird/IntentHub/blob/72af026a995d299e4a70d211cfb52399d8323934/docs/qa/2026-08-18-task-06-hr15-workbench-plan-reply-owner-scope.json)

## 推荐的简历写法

### 项目介绍（描述产品，不冒充个人全量成果）

> **IntentHub｜企业智能体协作平台二次开发**  
> 基于开源 IntentHub，面向企业内 AI Agent 协作与业务系统操作进行二次开发。平台支持通过 Web 与 IM 渠道接收自然语言请求，将请求转换为可校验的结构化计划，并在业务对象、字段、权限、确认与审计校验后执行或给出澄清引导。

### 个人职责（与提交可核对）

> - 负责企业业务语义运行时的跨模块资源化改造，将业务校验、对象/字段/关联解析、查询编译、执行 Trace 等链路中的用户提示统一接入双语展示目录，降低核心运行时的硬编码维护成本。  
> - 针对对象不明确、无权限、字段不可写、语义快照不可信等场景，完善一致的澄清与阻断反馈，使 Agent 在不满足安全执行条件时给出可操作的下一步提示。  
> - 为业务意图匹配相关中文资源保留固定语言读取策略，并以分域范围清单和自动化守卫覆盖改动边界，降低资源迁移影响原有识别结果的风险。

如果用户能确认自己承担了产品架构、完整前后端或部署职责，再补充对应职责；在此之前，上述写法足以体现复杂系统的后端治理能力，且不会把开源上游的整体成果归为个人。

## 明确不要写的内容

- “从 0 到 1 独立开发整个多智能体平台”“平台总架构师”或“全栈负责人”。README 的徽章与安装地址仍指向 `dataelement/IntentHub`，而当前 `origin` 指向 `losebird/IntentHub`；这说明存在上游/派生关系，但代码证据不足以证明原创归属、完整架构职责或个人全量贡献。[README 上游链接](https://github.com/losebird/IntentHub/blob/72af026a995d299e4a70d211cfb52399d8323934/README_zh-CN.md)
- “在该项目中部署/训练本地大模型、RAG 知识库”。该仓库 README 反而说明推理由外部 LLM API 完成；如确有独立部署经历，应写入南京智岸的工作经历，不能挂到 IntentHub 名下。[README 环境说明](https://github.com/losebird/IntentHub/blob/72af026a995d299e4a70d211cfb52399d8323934/README_zh-CN.md)
- “全量测试通过”“零缺陷”“生产级稳定”或“所有安全治理已完成”。交接记录明确将 Task 05、Task 06 标为“需重验”，HR-15 为“部分缓解”；本审计也没有重新执行全量测试。[交接记录](https://github.com/losebird/IntentHub/blob/72af026a995d299e4a70d211cfb52399d8323934/handoff.md)
- “完整多语言产品已交付”。本次代码有中英文展示资源和中文兼容保护，但没有足够证据说明全部页面、全部渠道和真实环境完成多语言验收。

