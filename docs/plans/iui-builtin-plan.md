# IUI 内置插件方案

日期：2026-10-16。分支：`cursor/iui-builtin-6fc8`（从 `main` `ada45f1a` 切出）。本分支只含这份文档。

2026-10-16 已批准这份方案（`af23b687`）。四项决定已经锁定。产物走方案 A，`pins` 里留 `artifact.url`，等上游发 release 再切方案 B。早报改用 `fde-briefing` 专用会话。IUI 状态先并进 AI 核心那一行，不改 `Settings.tsx`。profile `package.json` 解析失败时报错且不覆盖，放进 PR1，并加回归测试。

目标：把 `losebird/IUI`（npm 名 `@losebird/iui`）像 `dsh-lan-assist` / `dsh-semantic-os` 一样内置进 FDE-X Desktop，且只在「标准对话模式」生效。不做「存为业务应用」。

前提沿用原 brief：不改 AI 对话页 UI；不动连接器 / 技能 / 设置三模块的 UI 改造；不合并、不打包发布；不用 nil-check 捂问题；一 PR 一分支一 writer；Bug 先复现；修根因。

---

## 0. 目前已写的代码

| 项 | 状态 |
|---|---|
| 分支 | `cursor/iui-builtin-6fc8`，只有本文档一个提交 |
| 业务代码 commit | 无 |
| 改动文件 | 无（`runtime/`、`scripts/`、`src/` 均未改） |
| 本机临时物 | `/tmp/iui-pin/`（IUI 源码片段）、`/tmp/dsh-system-prompt/`、`/tmp/dsh-agent/`（npm 包解包，只读核对用），不进仓库 |

建议：没有需要保留或推翻的代码。从本方案批准后的第一个 PR 开始写。

---

## 0.5 调研中推翻原 brief 假设的事实

下面五条决定了方案形状，先列出来。

1. **`c5b5a4b` 没有预构建 `lib/`。** IUI 的 `.gitignore` 含 `lib/`，该 commit 的 git tree 里没有任何 `lib/` 路径。`package.json` 的 `main` 却指向 `lib/index.js`。IUI `docs/INSTALL.md` 说「本仓库已带 `lib/`」，与事实不符。这就是你实测 `dsh plugin add github:losebird/IUI` 需要 `COREPACK_HOME` 和 pnpm `allowBuilds` 的原因：GitHub 安装会现场构建。npm 上也没有 `@losebird/iui`（404），仓库没有 release 和 tag。所以「用预构建 lib/ 产物」目前没有现成来源，得我们在打包机上产出一次（见 §2.1）。
2. **IUI 的系统提示是进程全局的。** `src/plugin/index.ts` 在插件 `apply()` 里直接调 `ctx.systemPrompt.section({ name: 'iui:fence', order: STRUCTURED_OUTPUT, text: GENUI_SECTION_TEXT })`，不看会话、不看 preset。同时它还全局注册了：两个工具 `get_trip_stop_images` / `get_place_images`，一个技能提供者 `iui`，一个 `tools/pre-execute` 拦截器（拒绝写 `.html` 文件），以及 fence feedback。只关提示词不够，见 §2.2。
3. **DSH 的提示词注册表支持按作用域遮蔽。** `@deepseek-ai/dsh-system-prompt@0.2.0-rc.2` 的 `section()` 文档写明「A scoped section shadows a global section with the same name」。`assemble()` 用 `layers.merge(scope, …)` 合并，再跑 `system-prompt/assemble` waterfall，并且把 `AssembleContext { agent, scope }` 传给 waterfall（`dsh-agent` 的 `assembleContextFor`）。渲染时空段会被丢掉。这给了两个现成的挂点，不需要改 IUI。
4. **「早报模式」在请求层不存在。** `runtime/briefing/run.mjs` 第 142 行取的是工作区主会话（`resolvePrimarySessionForRuntime`），再往里发 `session/prompt`。`fde-briefing` preset 只有在那个会话恰好是用它创建时才生效，通常它是 `standard`。也就是说，只要 IUI 在标准模式开着，今天的早报请求一定带 IUI 提示。验收项「早报模式不带 IUI 提示」要求先修这个根因。
5. **模式就是 agent preset id。** 标准 = `standard`（来自上游 `@deepseek-ai/dsh-agent-presets`，不在本仓库），应用构建 = `fde-app-builder`，早报 = `fde-briefing`（`runtime/presets/*`）。两个 FDE preset 是 `standard` 的整份拷贝，不继承。会话有历史后 preset 锁定。

还有三条次要事实：

- 内置名单现在手抄在至少四处：`runtime/dsh-core.mjs:518`、`scripts/pack/stage.mjs:541`、`stage.mjs:566`（`versions.json`）、`scripts/pack/versions.schema.json`，外加 `runtime/adapters.mjs` 的健康探针路径。
- `scripts/pack/pins.mjs` 现在不钉任何插件，stage 只是把 `$FDE_VENDOR_DIR/<name>` 整目录拷过来，不编译，也不记 sha。`plugin-stage.mjs` 会剥掉 `node_modules`、`docs`、`ui`、`test`。
- `linkReadablePlugin` 只在 vendor 目录不存在时才拷贝。钉版本升级后，用户机上的旧 vendor 拷贝不会被替换。

---

## 实验 0 结果（2026-10-16，已跑）

Node 用的是 `v22.23.3`（环境默认是 `v22.14.0`，低于 IUI 要求的 22.19）。pnpm 用 `11.7.0`，`COREPACK_HOME=/tmp/corepack-home`。Host 世代 `npm i @deepseek-ai/dsh@0.2.0-rc.2` 已装进 `runtime/.host-generation`，入口是 `node_modules/@deepseek-ai/dsh/lib/bin.js`。

**构建。** 在 `c5b5a4b` 上直接 `pnpm install --frozen-lockfile && pnpm run build` 失败。`tsconfig.json` 把 `@deepseek-ai/dsh-client-ui-primitives` 指到作者机器的绝对路径（`/opt/homebrew/...` 和 `/home/box/.local/...`）。这两处不存在时，tsc 落到 lockfile 里的 `0.1.2-rc.1`，而那个版本没有 `SettingsForm`。把这两条 path 改指到 `0.2.0-rc.2` 的类型后，构建成功，得到 `lib/index.js`（330K）和 `lib/client.js`（978K）。`0.2.0-rc.2` 的 primitives 确实导出 `SettingsForm`。打包脚本要做同样的路径改写，不能假设作者的本机路径存在。

**实验 1，symlink 能否加载。** 三次 import `@losebird/iui`，都从 `node_modules/@losebird/iui` 的 symlink 进来。

| 目标 | 结果 |
|---|---|
| symlink 到带 pnpm `node_modules` 的源码树 | 成功，`apply` 是函数，`name` 是 `@losebird/iui` |
| 按 `files` 拷贝、不带 `node_modules` | 失败。`ERR_MODULE_NOT_FOUND`，缺的是 `@deepseek-ai/schemastery`，报错路径是 symlink 的 realpath |
| 同一份拷贝，用 `npm install --install-strategy=nested` 装上生产依赖后再 symlink | 成功。整棵树 19MB |

结论：文件系统 symlink 可以用，前提是目标目录自己带着生产依赖。只剥掉 `node_modules` 的 stage 产物加载不了。Host 插件 `lib/index.js` 的外部依赖只有 `@deepseek-ai/schemastery`（它再依赖 `@deepseek-ai/cosmokit`）。`client.js` 是浏览器包，在 Node 里会因为没有 `window` 而失败，这是预期。PR3 的产物是「上游 `package.json`（保留 `dsh.bundle` 和 `dsh.client`）+ `lib/` + 嵌套的生产 `node_modules`」，约 19MB。`plugin-stage.mjs` 对 IUI 不能剥 `node_modules`。

**实验 2，waterfall 能否读到 preset。** 读的是已安装的 `0.2.0-rc.2` 包，不是猜的。`dsh-agent-loop` 在每一步调用 `systemPrompt.assemble(assembleContextFor(this, signal))`。`assembleContextFor` 把 `agent` 设成这个活的 agent。`Agent.session.header.agentPreset` 是持久化字段，注释写明它决定这轮会话的工具和提示词。门控读 `context.agent.session.header.agentPreset`。这一步没有跑真实模型回合，PR2 用会话日志再确认一次。

**实验 3，技能目录走哪条路。** 不走 `systemPrompt` 的 section，也不走 context。`@deepseek-ai/dsh-tool-skill` 在 `agent/pre-step` 里追加一条 user 消息，正文是 `<available_skills>`。IUI 在全局注册技能提供者 `iui`，所以这条消息默认每个会话都有。门控要在 `agent/pre-step` 里把非标准模式的 `iui` 条目去掉，只删 system section 不够。

这三条改了 §2.1 和 §2.2 的落地细节，不改推荐方案本身：产物仍是方案 A，门控仍在桥里，白名单仍是 `standard`。

## 1. 要改的文件和模块

| 模块 | 文件 | 改什么 |
|---|---|---|
| 内置插件表（新，唯一来源） | `runtime/builtin-plugins.mjs` | 一张表描述三个内置插件：目录名、模块名、bundle 名、钉版本、来源、健康探针。其它地方都从这里派生 |
| Profile 安装 | `runtime/dsh-core.mjs`（`ensureIsolatedProfile`、`linkReadablePlugin`、`pluginSourceCandidates`） | 改为遍历表；支持 scoped 模块名 `@losebird/iui`；按钉版本对账替换旧 vendor |
| Profile 合并 | `runtime/profile-manifest.mjs` + `runtime/tests/profile-manifest.test.mjs` | 逻辑大概率不用改（`requiredBundles` 已保证不丢）；补 IUI 用例；按 §4 复现结果决定是否要补 `dependencies` 合并 |
| 打包钉版本 | `scripts/pack/pins.mjs` | 新增 `IUI_PIN = { repo, commit: 'c5b5a4b…', version: '0.13.0-iui.26', artifact: { url, sha256 } }` |
| 打包产物 | `scripts/pack/stage.mjs`、`scripts/pack/plugin-stage.mjs`、`scripts/pack/versions.schema.json`、`scripts/pack/verify.mjs` | 插件循环和 `versions.json` 从表派生；`versions.json` 记版本和 commit；verify 要求 `resources/plugins/iui` 存在且版本对 |
| 产物构建（打包机） | `scripts/pack/build-iui.mjs`（新） | 在打包机上 checkout 钉住的 commit，构建一次 `lib/`，产出 tarball 和 sha256。用户机永不构建 |
| 模式门控 | `runtime/fde-x-dsh-bridge/lib/index.js`（或新文件 `lib/mode-gate.js`）+ `runtime/mode-policy.mjs`（新，纯函数） | 按会话 preset 去掉 IUI 的提示段、工具和技能目录，见 §2.2 |
| 早报会话 | `runtime/briefing/run.mjs`、`runtime/briefing/ask-ai.mjs` | 早报改用 `fde-briefing` preset 的专用会话，见 §2.3 |
| 运行环境展示 | `runtime/adapters.mjs` | 在 AI 核心那一行的 detail 里带上 IUI 版本和状态，见 §2.4。不改 `Settings.tsx` |
| 规格 | `PRODUCTION-SPEC.md` §0.5 | 增「IUI 内置插件例外（2026-10-17 解禁）」一条，正文见 §2.5 |
| 检查 | `runtime/tests/builtin-plugins.test.mjs`、`runtime/tests/mode-policy.test.mjs`（新），`scripts/pack/plugin-stage.test.mjs`（补） | 表派生、门控、stage 产物 |

明确不改：`src/pages/AI.tsx`、`src/pages/Settings.tsx`、`src/pages/MCP.tsx`、`src/pages/Skills.tsx`、`src/components/settings/*`、`runtime/canvas-occupancy.mjs` 的表、IUI 上游源码。

---

## 2. 交互与信息架构

### 2.1 内置插件的数据形状

先定数据形状，再写逻辑（Model the Domain）。现在的名单是一个字符串数组，被手抄多处。IUI 是第一个 scoped 包、第一个不叫 `dsh-*` 的插件、第一个需要钉 commit 的插件，再加一个字符串会让每处都要多一个分支。

```js
// runtime/builtin-plugins.mjs（草图）
export const BUILTIN_PLUGINS = [
  { dir: 'dsh-lan-assist',  module: 'dsh-lan-assist',  source: { kind: 'vendor' }, health: 'im-business-adapter' },
  { dir: 'dsh-semantic-os', module: 'dsh-semantic-os', source: { kind: 'vendor' }, health: 'semantic-memory' },
  {
    dir: 'iui',
    module: '@losebird/iui',
    source: { kind: 'pinned', version: '0.13.0-iui.26', commit: 'c5b5a4b7b9b5d39f541a796b9bb5e495f61c6c37' },
    health: 'ui-sandbox',
    modes: ['standard'],
  },
]
```

`dir` 决定 `resources/plugins/<dir>` 和 `~/.dsh-fde-x/vendor/<dir>`。`module` 决定 `profiles/fde-x/node_modules/<module>` 和 profile `dsh.profile.bundles` 里的名字。`modes` 是门控白名单，只有 IUI 有（见 §2.2）。

**预构建产物从哪来**（事实 1 决定这里必须选）：

| 备选 | 做法 | 取舍 |
|---|---|---|
| A. 打包机构建一次（推荐） | `scripts/pack/build-iui.mjs` 拉 `c5b5a4b`，`pnpm install --frozen-lockfile && pnpm run build`，把 `npm pack` 出来的 tarball 和 sha256 放进 pack 缓存。stage 解包到 `resources/plugins/iui` | 用户机不编译。打包机多一次构建，需要 pnpm 11.7 和 corepack。可复现性靠 lockfile 和 sha256 |
| B. 请 IUI 上游发 release tarball | 上游给 `0.13.0-iui.26` 发带 `lib/` 的 GitHub release，`pins.mjs` 钉 URL + sha256 | 最干净，和语义运行时的钉法一样。但依赖上游动作，当前没有 release |
| C. 把 `lib/` 提交进本仓库 vendor | 构建结果入库 | 违反 HANDOFF「不要把 resources/ 提交」的精神，二进制和大文件进 git，否决 |

推荐 A，并在 `pins.mjs` 里留 `artifact.url` 字段。上游一旦发了 release 就切到 B，只改这一处。

**开发机（`pnpm dev`）怎么拿到 IUI**：沿用现有 `pluginSourceCandidates` 的 `FDE_PLUGIN_<NAME>` 环境变量和 `FDE_VENDOR_DIR`。开发者跑一次 `node scripts/pack/build-iui.mjs --out ~/.dsh/vendor/iui`。不在 BFF 启动路径里联网或构建。

**版本对账**（Make Operations Idempotent）：`linkReadablePlugin` 对 `pinned` 来源读 vendor 里的 `package.json`，版本或 commit 不等于钉值就整目录替换（先拷到临时目录再 rename）。重复启动不做事；崩在一半时下次启动看到版本不对会重来。

**链接方式**：IUI 文档说桌面端不要用 `link:` / junction，要拷真实目录。现有实现是 vendor 拷贝 + symlink 进 `node_modules`。Node ESM 按 realpath 解析依赖，如果 IUI 的 `lib/` 有未打包的运行时 import（`react`、`katex`、`@deepseek-ai/schemastery`、`mdast-util-from-markdown`），symlink 到 vendor 后会找不到。PR1 的第一步是在真后端上确认这一点：能加载就沿用 symlink；不能，就让 `pinned` 来源走「拷贝真实目录 + 自带 `node_modules`」，并让 stage 对 IUI 不剥 `node_modules`。这是一个用实验回答的问题，不靠猜。

### 2.2 按会话模式开关 IUI

要关掉的不只是 `iui:fence` 提示段。IUI 在全局还注册了两个工具、一个 `iui` 技能、一个拒写 `.html` 的拦截器。拦截器对应用构建模式是实害：模型如果用普通写文件工具写 `apps/<slug>/index.html`，会被 IUI 拒掉并被要求改发 `iui-html` 围栏。

**备选**：

| 备选 | 机制 | 覆盖面 | 取舍 |
|---|---|---|---|
| A. 桥里挂 `system-prompt/assemble` waterfall（推荐） | `fde-x-dsh-bridge` 注册一个 waterfall 监听器，从 `context.agent` 读到会话的 preset，查 `mode-policy.mjs`，不在白名单就从 `assembly.sections` 去掉 `iui:fence`、从 `assembly.tools` 去掉两个 IUI 工具 | 提示段和工具都覆盖；技能目录要看它走不走 `contexts`（PR3 前用实验确认） | 一个策略点，策略是纯函数可单测。依赖 `agent` 对象上能读到 preset，`dsh-agent` 类型里 preset 只出现在 `CreateAgentOptions.meta.agentPreset`，需要实验确认运行时可读 |
| B. 在两个 FDE preset 里遮蔽 | `fde-app-builder` / `fde-briefing` 的 `agent.cordis.yml` 各加一行，在 preset 作用域注册同名空段 `iui:fence` | 只覆盖提示段 | 不碰全局。前提是会话作用域链包含 preset 的常驻作用域，需实验。工具、技能、拦截器都还在。新导入的 preset 默认带 IUI，是黑名单语义 |
| C. 只在 `standard` preset 里挂 IUI | 把 IUI 从全局 bundle 挪到 `standard` 的 agent-plane 组合里 | 全部覆盖 | `standard` 来自上游包，不在本仓库，要拷一份 `standard` 进来维护，和上游漂移。否决 |
| D. 按模式切 `pluginManager.setPluginEnabled` | 进入应用构建时停 IUI | 全部覆盖 | 插件是进程全局，多个会话并行时互相干扰，共享可变状态。否决 |
| E. 改 IUI 让 `text()` 看 preset | 上游改 | 全部可覆盖 | 动了钉住的上游，违反钉版本。否决 |

推荐 A。拦截器的处理放进同一个策略：桥再挂一个 `tools/pre-execute` 监听器，排在 IUI 之前，非白名单模式下对 `.html` 写入直接放行给下一个非 IUI 处理器。如果 DSH 的监听顺序做不到「跳过 IUI」，退一步把应用构建 preset 的写文件路径限定为 `fde_app_spec_submit`（它的参数是 `files[]`，IUI 的判定函数不匹配），并在 PR3 里用真后端证明。

**白名单还是黑名单**：

| 备选 | 语义 | 取舍 |
|---|---|---|
| 白名单 `modes: ['standard']`（推荐） | 只有 `standard` 带 IUI | 与 brief「只在标准对话模式启用」字面一致。用户导入的 preset 和上游 `ptc` / `minimal` / `cordis` 不带 IUI |
| 黑名单 `['fde-app-builder', 'fde-briefing']` | 其它都带 | 新 preset 默认带上 IUI，偏离 brief |

**未指定 preset 的会话**：FDE 新会话不传 `agentPreset` 时由 Host 默认决定（当前是 `standard`）。策略按「会话实际加入的 preset」判断，不按请求体判断。

**交互面**：不加任何按钮或开关。用户在 AI 页选「标准」就有 IUI 卡片，选「应用构建」或跑早报就没有。渲染仍在 `/dsh-app/` iframe 里由 IUI 的 client 完成，不进 FDE 页面。

### 2.3 早报改走 `fde-briefing` 会话

这是事实 4 的根因修复，不是绕过。

| 备选 | 做法 | 取舍 |
|---|---|---|
| A. 早报用专用会话（推荐） | `run.mjs` 按工作区找或建一个 `agentPreset: 'fde-briefing'` 的会话（和应用构建的 `askAiForResult` 同一套路），早报 prompt 发到这里 | 早报不再污染主会话的历史。行为变化：用户在主会话里看不到早报这一轮。早报页本身不变 |
| B. 主会话保持不变，在门控里按「这一轮是早报」判断 | 给 prompt 打标记，waterfall 看标记 | 把模式从 preset 挪到消息上，引入第二套模式概念。否决 |

推荐 A。PR3 前要先确认一件事：`fde-briefing` 的 `skills/` 目录是否真的挂上了（调研发现 `new URL('skills/', baseUrl)` 在生成的合并 patch 里可能解析成 `runtime/presets/skills/`）。如果没挂上，这是现存 bug，单独一个 commit 修。

### 2.4 设置 → 运行环境展示

现状：运行环境卡片画的是 `GET /health` 的 `adapters`，`Settings.tsx` 里把 capability 映射成三个写死的标签，未知 capability 一律显示成「语义记忆」。所以后端多加一行 `ui-sandbox` 会被显示错。

| 备选 | 做法 | 取舍 |
|---|---|---|
| A. 后端把 IUI 状态并进 AI 核心那一行（推荐，本 PR） | `adapters.mjs` 的 `ai-runtime` 行 detail 追加「IUI 0.13.0-iui.26 · 已启用（标准对话）」或「IUI 未安装」 | 零 `Settings.tsx` diff，不碰设置模块 UI 改造。信息够用但不独立成行 |
| B. 新增一行 `ui-sandbox` | `adapters.mjs` 加一行，`Settings.tsx` 标签映射加一项 | 展示最清楚。要改 `Settings.tsx`，和另一个 agent 的设置改造冲突。等那边合入后作为后续 PR |
| C. 改成后端下发 `label` | `RuntimeRow` 改读 `adapter.label` | 最通用，同样要改 `Settings.tsx`。和 B 一起放到后续 |

推荐本轮做 A，B/C 记为后续。

「已启用」的判定：插件目录存在、版本等于钉值、且 `pluginManager/listPlugins` 里 IUI 那一行 `enabled` 为真。三者都满足才写「已启用」，否则写出哪一项不满足。

**IUI 设置分区（可选）**：IUI 的 `Config` 是 schemastery 对象（主题、格式裁判、Jev、Structured Outputs 等，含两个 secret 字段）。如果 `settings/describe` 返回了 IUI 的 namespace，现有 `HostNsPanel` 会自动把它画在「AI 核心 → Host 配置」卡里，标题取插件元数据，不需要写代码。本轮只验证它是否出现、secret 是否画成密码框，不做额外工作。如果没出现，记为已知问题，不为它新造页面。

### 2.5 PRODUCTION-SPEC.md 新增条目

加在 §0.5 末尾：

> **IUI 内置插件例外（2026-10-17 解禁）：** `@losebird/iui`（钉 `0.13.0-iui.26` @ `c5b5a4b`）与 lan-assist / semantic-os 同为内置 Host 插件，profile 启动时自动挂上，打包进 `resources/plugins/iui`，用户机不构建。它的 client 只在现有 `/dsh-app/` 会话 iframe 内渲染 `iui-html` 围栏，这是「浏览器不加载插件 client」的唯一例外，不进 FDE 页面、不新开顶栏、不新开路由。IUI 只在 `standard` preset 生效：提示段、工具、技能目录由 `fde-x-dsh-bridge` 按会话 preset 门控，应用构建与早报不带。

---

## 3. PR 拆分与顺序

每个 PR 一个分支、一个 writer，从 `main` 切。顺序按「先能证明，再往上叠」排（Sequence Work into Verifiable Units）。

| 顺序 | 分支（拟） | 内容 | 依赖 | 完成时能证明什么 |
|---|---|---|---|---|
| 0 | 不开 PR，实验 | 三个实验：IUI 经 symlink 能否加载；waterfall 里 `context.agent` 能否读到 preset；技能目录是否经 `contexts` 注入 | 无 | 决定 PR1 链接方式和 PR3 机制。结果写回本文档 |
| 1 | `cursor/iui-builtin-registry-6fc8` | `builtin-plugins.mjs` 表；`dsh-core.mjs` 遍历表、scoped 模块名、钉版本对账；profile 合并补测；`PRODUCTION-SPEC.md` 条目 | 实验 0 | 干净 profile 启动后 IUI 在 `node_modules/@losebird/iui` 和 `bundles` 里；重启后仍在 |
| 2 | `cursor/iui-mode-gate-6fc8` | `mode-policy.mjs`；桥里的 waterfall 和 pre-execute 门控；早报改走 `fde-briefing` 会话；如有，`skills/` baseUrl 修复单独 commit | PR1 | 标准模式出 `iui-html` 卡片；应用构建、早报的请求里没有 `iui:fence`，也没有 IUI 工具 |
| 3 | `cursor/iui-pack-pin-6fc8` | `pins.mjs` 钉 IUI；`build-iui.mjs`；stage / `versions.json` / schema / verify 从表派生 | PR1（共用表） | `resources/plugins/iui` 存在，`versions.json` 记版本和 commit，stage 不调用构建 |
| 4 | `cursor/iui-runtime-status-6fc8` | `adapters.mjs` AI 核心行带 IUI 状态；验证 IUI 设置分区是否自动出现 | PR1 | 设置→运行环境能看到 IUI 版本和激活状态 |

PR2 和 PR3 只共享 PR1 的表，文件不重叠，PR1 合入后可以并行。PR4 很小，可以并进 PR1，但为了不让 PR1 碰 `adapters.mjs` 的健康逻辑，单独放。

---

## 4. 验收标准与验证办法

真后端环境：`runtime/.host-generation` 里 `npm i @deepseek-ai/dsh@0.2.0-rc.2`，`pnpm dev`（5174 / 4318），`POST /api/v1/ai/connect` 带 `Origin: http://127.0.0.1:5174`。证据存 `/opt/cursor/artifacts/iui/`，在 PR 描述里引用。作者不自判最终 verdict。

| 验收项 | 验证办法 | 证据 |
|---|---|---|
| 干净 profile 启动后 IUI 自动内置 | `DSH_HOME` 指向空目录启动；读 `profiles/fde-x/package.json` 的 `dsh.profile.bundles` 和 `node_modules/@losebird/iui/package.json` 的版本；`pluginManager/listPlugins` 里 IUI `enabled` | `profile-clean.json`、`list-plugins.json` |
| 标准模式渲染 `iui-html` | 标准会话问天气，iframe 内出卡片（不是 Markdown 原文） | `standard-weather.png` |
| 应用构建、早报不带 IUI 提示 | 两种模式各跑一轮，读会话日志 `session.v3.jsonl.zstd` 里的 system 段，确认无 `iui:fence` 文本、`request/header.tools` 无 `get_trip_stop_images`；同一问题对比三种模式的 prompt token 数 | `prompt-sections-{standard,app-builder,briefing}.txt`、`tokens.md`、对照截图 |
| 重启 Host 后仍在 | 重启前后各存一份 profile `package.json`，`diff`；重启后再跑一次标准模式渲染 | `profile-before.json`、`profile-after.json`、`profile.diff` |
| 防合并丢 IUI | 先复现：用 Host 的插件管理动作（启停别的插件、MCP 保存触发 HMR）改写 `package.json`，再重启，看 IUI 是否丢。丢了就在 `mergeProfileManifest` 修根因并加回归测试；不丢就记录「未复现」和步骤 | `merge-repro.md` |
| stage 产物含 `resources/plugins/iui` | `FDE_PACK_OUT=/tmp/pack node scripts/pack/stage.mjs`；列出 `resources/plugins/iui` 文件清单和 `versions.json`；确认 stage 日志里没有构建命令 | `stage-tree.txt`、`versions.json` |
| 运行环境显示 IUI | 设置→运行环境截图，AI 核心行含 IUI 版本和状态 | `settings-runtime.png` |
| 单测 | `node --test runtime/tests/*.test.mjs scripts/pack/*.test.mjs`；`npx tsc -b --pretty false`（HANDOFF 说它可能长期红，红的话记录基线对比） | 命令输出 |

---

## 5. 风险

| 风险 | 影响 | 应对 |
|---|---|---|
| 上游没有预构建 `lib/` | 「不在用户机编译」只能靠我们在打包机构建 | 选 §2.1 A；同时请上游发 release，到时切 B |
| `lib/` 有外部运行时依赖 | symlink 或剥 `node_modules` 后 IUI 加载失败 | 实验 0 先测；必要时 IUI 走真实目录拷贝并保留 `node_modules` |
| waterfall 里读不到 preset | 门控 A 不成立 | 退到 B（preset 作用域遮蔽空段）加工具过滤；实验 0 决定 |
| IUI 拦截 `.html` 写入 | 应用构建模式写托管 Web 包被拒 | §2.2 的 pre-execute 门控；真后端跑一次托管 Web 创建作为回归 |
| 早报改用专用会话 | 主会话里不再出现早报轮次，用户习惯变化 | 写进 PR 描述，等你确认；早报页 UI 不变 |
| `fde-briefing` / `fde-app-builder` 的 `skills/` 可能没挂上 | preset 专属技能一直没生效，是现存 bug | 实验确认，确有就单独 commit 修 |
| IUI 资源路由 `/plugins/@losebird/iui/assets/*` | Vite 只反代 `/api/v1` 和 `/dsh-app`。如果 IUI client 用绝对路径 `/plugins/...` 取 `runtime-config.json`，会打到 5174 而 404 | 你实测卡片能渲染，说明主路径可用；PR1 里抓一次 iframe 网络请求确认所有 IUI 资源都走 `/dsh-app/` 前缀 |
| 和设置模块 UI 改造冲突 | 两个 writer 改 `Settings.tsx` | 本轮不碰 `Settings.tsx`（§2.4 A） |
| 钉版本与 Host 世代不兼容 | IUI peer 范围是 `>=0.2.0-rc.1 <0.3.0-0`，当前 `0.2.0-rc.2` 在范围内；以后切代可能出范围 | 表里记钉值；切代清单加一项「IUI peer 范围」 |
| IUI 把提示写到 `/tmp/iui-system-section.txt` | 上游调试残留，每次启动写文件 | 无害但记为已知问题，报给上游 |
| profile `package.json` 解析失败时整份被替换 | `ensureIsolatedProfile` 把 `JSON.parse` 失败当成空文件，只写回 required bundles，之前 Host 写入的 bundles 和 `dependencies` 全丢。这是「重启丢插件」的一条真实路径 | 已定。解析失败报错且不覆盖，放进 PR1，并加回归测试 |
| 开发机 vendor 目录是共享 symlink | `scripts/dev.mjs` 的 `prepareFdeHome` 把 `$DSH_HOME/vendor` 链到 `~/.dsh/vendor`。按版本对账时如果整目录删掉重拷，会删到共享源本身（现有的 `FDE_REFRESH_PLUGINS=1` 已经有这个问题） | 对账先拷到 `vendor/.iui.staging-<pid>`，确认来源不是目标自身再 rename；PR1 加用例 |
| 3 天时间盒 | 实验 0 若三项都不成立，需要重新设计门控 | 卡住超过一个 run 就停下报告 |
