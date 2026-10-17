# IUI 标准对话性能与早报会话 bug 修法方案

日期 2026-10-17。基线 `test/mac-all-next` @ `e3776ba3`。本文只写方案，不含产品代码，不开 PR。

## 结论

1. 先修两个确定的 bug，再动性能。第一个是 B 没有技能目录。根因是 `ensureSkillProvidersInProfile` 把宿主平面的 `tool-skill` 打开了，宿主那份 `tool-skill` 在每一步把预设注入的目录消息删掉。只改 `runtime/mcp-archive.mjs` 一处。这一条会让 B 的前缀**变大**一点，不是省 token 的项。
2. MCP 膨胀推荐「按模式裁剪」打底，「延迟加载」随后跟上。两者都放在 fde-x 自己的宿主插件 `runtime/fde-x-dsh-bridge` 里，挂在已有的 `system-prompt/assemble` 钩子上，不改 DSH Host，不动用户的 `cordis.patch.yml`。不走宿主自带的 `deferLoading`，因为 pi-ai 适配器见到它直接抛错。按用户日志的数字估算，裁掉浏览器类和桌面类三台以后，B 每步 input 从约 69.6K 降到约 28.6K。延迟加载再降到约 25K。
3. effort=high 不靠改代码解决。它是一条已保存的用户选择，来源是宿主的 `selectModel` 把解析出的默认 effort 写回 `agent-default-model`。推荐用户在模型选择或设置里把它改成 low。如果要改「宿主只保存显式选择」，那是 DSH Host 上游的改动，不在本仓库。
4. 早报「会话未投影」推荐「早报按区块直接调 MCP」。具体做法是在 fde-x 桥接插件里加一个受 bridge token 保护的 `tools/call` 路由，由宿主里已经在跑的 MCP 进程执行。这条路径和延迟加载、模式裁剪是同一个方向，工具不进会话前缀。同一个错门在 `runtime/biz/invoke.mjs` 里还有一份。
5. 「新会话要刷新」两头都补。早报建会话后发 `ai.session.changed`，`AI.tsx` 订阅它。「切工作区不跟随」在外壳里改。地址栏会话的 cwd 不属于当前工作区时，改选新工作区最新的一条会话。iframe 桥接脚本收到 `select` 后清掉 `pendingSelectId`。
6. IUI 的 onFrame 回归和格式裁判冲突要在 IUI 仓库修，然后更新钉值。⚠️ 这一步要用户批准。推荐只把签名说明加回去，并让三段提示词都从同一份 `toolsAllowedBeforeFence` 生成。宿主兼容垫片和作者 JS 自动修一轮先不做，理由见第三节。
7. 现有 A/B 脚本测不出 MCP 那一项。它每次用全新的 HOME，里面没有用户的 8 个 MCP。要先给脚本加一个读入用户 patch 的开关，MCP 相关的 PR 才有办法验收。

推荐顺序是 PR-1（技能目录）、PR-2（测量脚本）、PR-5（早报直调）、PR-3（模式裁剪）、PR-4（延迟加载）。PR-6 和 PR-7（会话列表与工作区）与前面并行。IUI 的 PR-8 和 PR-9 等用户批准钉值后再做。effort 由用户自己设置，不开 PR。

## 证据来源与核对

- `origin/cursor/iui-perf-measure-b2fc` 上只有 `scripts/iui-perf/**`，没有提交 `artifacts/iui-perf/`。`run.mjs` 运行时才把结果写进 `artifacts/iui-perf/grok-static` 或 `grok-live`（`scripts/iui-perf/run.mjs:515`）。所以本文的 IUI 数字全部来自用户真机日志的结论，我没有重测。
- `origin/cursor/briefing-session-repro-260a:artifacts/briefing-session-bugs/REPORT.md` 里的行号，我在 `e3776ba3` 上逐条核对过。除了 `src/pages/Briefing.tsx` 以外都没有漂移。那个文件里错误文案在 266 到 268 行，「生成新早报」按钮在 228 行。
- DSH Host 用的是 npm 上的 `@deepseek-ai/dsh@0.2.0-rc.2` 安装产物。IUI 用的是 `https://github.com/losebird/IUI.git` 的 `c5b5a4b`，它就是钉值 commit，也是 IUI 默认分支的 HEAD。
- 下文的数字分三类，每条都会标出来。「日志」指用户真机日志的结论。「推算」指用日志数字做的算术。「猜测」指没有测量支持的估计。

## 一、IUI 标准对话慢、费 token

### 1. MCP 工具清单膨胀

#### 现状

- 用户的 MCP 由宿主的 `@deepseek-ai/dsh-mcp-client` 注册成全局工具 `mcp__<server>__<tool>`。见 `node_modules/@deepseek-ai/dsh-mcp-client/lib/index.js` 中的 `syncTools`（127 到 160 行）和 `publicToolName`（96 到 101 行）。
- 每一步请求的工具清单来自 `ToolRuntime.wireSchemas`（`dsh-tools/lib/index.js:2831-2836`），再经过 `system-prompt/assemble` 瀑布（`dsh-system-prompt/lib/index.js:319-355`）。fde-x 已经在这个瀑布上挂了钩子，入口是 `runtime/fde-x-dsh-bridge/lib/index.js` 的 `installIuiModeGate`（160 到 182 行）。非 IUI 预设会被 `runtime/mode-policy.cjs` 的 `gatePromptAssembly` 拿掉 IUI 的两个工具。这个钩子就是本方案的落点。
- 宿主的 `deferLoading` 走不通。`dsh-llm-pi-ai/lib/index.js:1229-1235` 的 `toolsOf` 见到任何 `deferLoading === true` 的工具就抛 `LlmError("Deferred tool loading is not supported yet", "UNSUPPORTED_CONTENT")`。`dsh-mcp-client` 本身也不设这个字段。
- 宿主有 `ctx.tools.restrict({allow, deny})`（`dsh-tools/lib/index.js:2895-2909`），但它要求作用域上下文 `agent.ctx`。桥接插件拿到的是全局上下文，所以这里沿用 assemble 钩子的做法。
- 技能那套可以照抄。`dsh-tool-skill` 在 `agent/pre-step` 生成一条目录，内容是名字加截断描述，见 `dsh-tool-skill/lib/index.js:203-236`、`238-285`。模型调用 `skill` 时才取全文（138 到 156 行）。

#### 方向 (b)：按对话模式裁剪

做法：

- 在 `runtime/mode-policy.cjs` 里加一张「模式 × MCP 服务」的表，`gatePromptAssembly` 按表过滤 `assembly.tools` 里的 `mcp__<server>__*`。`installIuiModeGate` 的 `tools/pre-execute` 钩子对同一张表做拒绝，保证被裁的工具也不能执行。键用会话头里已有的 `agentPreset`（`presetFromAgent`）。
- 这张表不写死服务名。它作为桥接插件的配置项声明出来，配置写在 fde-x 自己管的 `runtime/dsh-core.patch.yml` 的 `fde-x-dsh-bridge` 行（44 行起），不写进用户的 `profiles/fde-x/cordis.patch.yml`。设置页如果能从宿主 schema 生成这个命名空间，就落在「AI 核心」或插件溢出区。生成不出来就不做页面。这一点要先验证 `settings/describe` 是否列出桥接插件的命名空间（未验证）。
- 按预设裁剪，不按单轮意图裁剪。原因是工具清单在会话前缀里，按意图来回切换，每切一次缓存前缀就失效一次。

预期（推算）：

- 用户日志里 cua-driver 约 29K、chrome-devtools 约 7.4K、playwright 约 4.6K，合计约 41.0K。B 第 1 步 input 69,640，减去 41.0K 约为 28.6K。
- 计费口径，未缓存 73.5K 降到约 32.5K，缓存 69.9K 降到约 28.9K。UI 上显示的 163K 降到约 81K。
- 时间省多少要 A/B 量。少 41K 的 prefill，能换多少秒取决于 grok2api 背后的首 token 延迟，我没有数据。

⚠️ 默认值。默认表是空（全部挂载、行为不变），还是默认在 `standard` 模式下不挂浏览器类和桌面类，需要用户定。默认表为空就等于不省。

风险：

- 用户在 IUI 标准对话里确实想让模型开浏览器时，工具不在了。要么换预设，要么改表。
- 被裁的工具如果出现在旧会话的历史 tool call 里，回放时显示不受影响，因为裁剪只作用在新一步的请求上（推测，没有验证）。

#### 方向 (a)：像技能一样延迟加载

做法：

- 桥接插件在 `system-prompt/assemble` 里把所有 `mcp__*` 工具的 schema 拿掉，同时加一个系统提示段，列出「服务名 / 工具名 / 一行描述」。不用技能那种持久用户消息，因为新的消息 kind 可能被对话页当成用户消息渲染出来，会碰到「不改对话页 UI」的约束。
- 再注册一个工具 `fde_mcp_load({ server })`。模型调用它以后，桥接插件按会话记下「已加载的服务」，下一步 assemble 时把这台服务的真实工具名和 schema 加回去。模型随后用真名调用，对话页的工具卡片和今天一样。
- 不推荐另一种变体「一个 `mcp_call({name,args})` 代理工具」。它的清单最稳，缓存最友好，但对话页上所有 MCP 调用都会显示成 `mcp_call`。这等于改了对话页的展示。

预期（推算加猜测）：

- 8 台 MCP 约 47.5K 全部换成目录。目录按每个工具约 20 token、约 150 个 MCP 工具估，约 3K（猜测，工具数是用 221 减去 A 的 65 个粗估的）。每步省约 44.5K，B 第 1 步 input 约 25K。
- 真需要某台服务时，多一步 `fde_mcp_load`，这一步的工具清单变了，缓存失效一次，后面的步骤又稳定下来。

风险：

- 模型可能不去调 `fde_mcp_load`，直接编一个工具名。宿主对看不见的工具返回 `UNKNOWN_TOOL`（`dsh-tools` 的 `execute` 说明，`lib/types/index.d.ts:750-765`），不会静默成功。
- 会话级的「已加载集合」存在桥接插件内存里，宿主重启后丢失。重启后要么从会话日志里最近的 `fde_mcp_load` 调用恢复，要么重新加载。这一点实现时要定（猜测，需要验证宿主重启后会话恢复的路径）。

#### 两者的关系

| 方向 | 改哪里 | 每步约省 | 对缓存 | 对话页 |
| --- | --- | --- | --- | --- |
| (b) 按模式裁剪 | `runtime/mode-policy.cjs` 的 `gatePromptAssembly`，桥接插件的 `installIuiModeGate` 和配置 | 41K（推算） | 预设内稳定 | 不变 |
| (a) 延迟加载 | 桥接插件新增目录段和 `fde_mcp_load`，复用同一个 assemble 钩子 | 44.5K（推算加猜测） | 加载那一步失效一次 | 不变 |
| 宿主 `deferLoading` | DSH Host 上游 | 不适用 | 不适用 | pi-ai 直接抛错 |

推荐先做 (b)，再做 (a)。(b) 改动小，能马上验收。(a) 落地后，(b) 的表仍然有用，因为它能让某些模式根本看不到某台服务的目录行。两者改同一个文件，所以必须串行，由同一个 owner 依次做。

### 2. effort=high

#### 现状（已核对代码）

- `agent-default-model` 的配置里有可选字段 `reasoningEffort`（`dsh-agent-default-model/lib/index.js:21-25`）。
- `SessionCommands.selectModel`（`dsh-api-session-controller/lib/index.js:720-739`）先用 `ctx.llm.resolveCallConfig` 解析。请求里没带 effort 时，解析结果会补成模型的 `reasoning.defaultEffort`（`dsh-llm/lib/index.js:2174-2187`）。随后 `saveSelection(selected)` 把这个补出来的值写回配置。
- 请求阶段的优先级是本会话刚选的值，再到日志头里非适配器默认的值，最后是 `agentDefaultModel.currentSelection()`（`dsh-api-session-controller/lib/types/agent.js:309-325`）。
- fde-x 的 `runtime/` 和 `src/` 里没有任何地方写 `reasoningEffort`，也没有调用 `selectModel`。fde-x 只改模型行上的 `reasoningEfforts`（复数），比如 `runtime/models-settings-rows.mjs:19-25` 的 `sealCustomProviderModels`。

结论：high 是用户某次在模型选择器里选模型时，宿主按当时的模型默认值写下的。这是一条保存下来的用户选择，不是 fde-x 的默认值。

一个没解开的点：`sealCustomProviderModels` 会把没写 effort 的自定义模型封成 `reasoningEfforts: false`。按 `resolveCallWithInfo` 的逻辑，模型不支持 effort 时，带着 effort 的请求应该抛 `UNSUPPORTED_REASONING_EFFORT`。用户日志里请求却带着 high 发出去了。可能的解释是用户的 grok-4.6 行写了 effort 列表，或者这条行是在封口之前选的（猜测）。修之前要看用户的 `~/.dsh-fde-x` 里这条模型行和 `agent-default-model` 行。

#### 方向

| 方向 | 改哪里 | 谁做 | 说明 |
| --- | --- | --- | --- |
| E1 用户改设置 | 无代码 | 用户 | 在对话页模型选择器里显式选 low，或在设置的 AI 核心里改 `agent-default-model.reasoningEffort`。后一条要先确认设置页确实从宿主 schema 生成了这个字段（未验证）。 |
| E2 宿主只保存显式 effort | `dsh-api-session-controller` 的 `selectModel` | DSH Host 上游 | ⚠️ 改 Host 默认行为。本仓库只能提 issue。 |
| E3 fde-x 按模式压 effort | 桥接插件挂 `agent/request` 瀑布 | fde-x | ⚠️ 改默认值，而且会覆盖用户的显式选择，不推荐。 |

预期（日志）：思考 token 约 7.5K、时间约 140 秒。B 的 413.8 秒推算降到约 274 秒。

推荐 E1，加一条给上游的 E2 issue。E3 不做。

### 3. onFrame 签名说明被删的回归，以及格式裁判冲突

#### 现状（已核对 IUI 源码）

- 在 `c1948f8` 之前，`src/themes/oiu-design-system.ts` 的 `OIU_DESIGN_SKILL` 里有一句 `onFrame gives {pinIndex, pinProgress, activeStop}.`，`c1948f8` 把它删了。`SKILL.md` 原来那条 `createTripAnimator({stopCount, durationMs:6000, pinElements, onFrame, onState})` 也被改成了一句不带参数名的列表项。
- 钉值 `c5b5a4b` 上，提示词只剩参数名 `onFrame`（`oiu-design-system.ts:796-798`），没有说明参数形状。实际调用传的是对象（`oiu-design-system.ts:676-679`），字段有 `progress`、`fromIndex`、`toIndex`、`fraction`、`activeStop`、`pinIndex` 和 `pinProgress`。
- 示例代码 `src/shared/oiu-pattern-starters.ts:59-62` 用的是 `f.activeStop`，是对的。但模型看不到签名，就会写成 `onFrame: (i) => activate(i)`。`scripts/iui-perf/reproduce-onframe.mjs` 复现的就是这条。
- 作者 JS 报错只显示在沙箱里的失败条上（`src/shared/author-js-runtime.ts:437`、`496-505`、`597-615`），外壳 React 收到以后只改界面状态（`src/client/html-fence.tsx:473-494`）。插件侧没有把这个错误送回模型的通道。`fence-feedback.ts` 的修复只覆盖「fence 解析失败」。

格式裁判冲突：

- 运行时的放行名单是 `toolsAllowedBeforeFence: ['get_trip_stop_images', 'get_place_images']`（`src/config/stream-heuristics.ts:73`），判断函数是 `isToolBeforeFenceName`（121 到 127 行）。
- 三段提示词各说各的。`buildRefereePromptBlock`（`src/plugin/format-referee.ts:501`）只放行 `get_trip_stop_images`。`buildFirstTokenContract`（525 到 531 行）要求首字符就是 fence，写着 `no_tools_before_fence=true`，没有任何例外。`buildToolBeforeFenceAbort`（536 到 554 行）也写着 `no_tools_before_fence=true`。`OIU_DESIGN_SKILL`（803 到 804 行）和 `SKILL.md:34` 又要求 fence 之前先调图片工具。
- 用户日志里多出的那一步，是模型先调了 `web_search`（10.6 秒）。`web_search` 不在放行名单里，所以裁判按规则打断，然后模型重新出 fence，这一步共约 43 秒。裁判本身没错。错在提示词互相矛盾，模型不知道 fence 之前到底能不能调工具（推测）。

#### 方向

| 方向 | 改哪里 | 评价 |
| --- | --- | --- |
| O1 把签名说明加回去 | IUI `src/themes/oiu-design-system.ts` 的 `OIU_DESIGN_SKILL`，`SKILL.md` 第 28 行附近 | 推荐。两行提示词，`tests/skill-md.spec.ts` 和 `tests/oiu-design-system.spec.ts` 加断言。 |
| O2 宿主兼容 | IUI `createTripAnimatorSource` 给帧对象加 `valueOf` 和 `toString` | 不推荐。`stops[f]` 走的是 ToPropertyKey，只加 `valueOf` 不够，`toString` 也得返回下标。`Number.isInteger(f)` 仍然是 false。这是在掩盖提示词缺失，属于捎带。 |
| O3 作者 JS 报错自动修一轮 | IUI 的 `author-js-runtime.ts`、`html-fence.tsx`，以及插件和外壳之间新的回传通道，加 `fence-feedback.ts` | 价值大，但这是新功能，跨沙箱、客户端、插件三层。建议单独立项，不和本次回归一起做。 |
| R1 裁判提示词统一来源 | IUI `format-referee.ts` 的三个 builder 和 `OIU_DESIGN_SKILL`，例外名单都从 `getStreamHeuristics().toolsAllowedBeforeFence` 生成 | 推荐。不写死工具名，改动集中在提示词文本。 |

预期：

- O1 消除作者 JS 在 onFrame 上的运行错误。时间上省的是「页面坏了，用户再问一轮」那一整轮，日志里没有这一项的数字。
- R1 针对日志里那一步约 43 秒。能不能省下来要看模型行为（猜测），两边都要 A/B 量。

⚠️ 钉值。O1 和 R1 都改 IUI 产物，`f3dc3ef1d099aace…` 会变。要同步改的地方有 `scripts/pack/pins.mjs:13-20`（commit、version、sha256）、`runtime/builtin-plugins.mjs:11`、`scripts/pack/iui-pin-manifest.json:2`、`.github/workflows/mac-all.yml:123`，以及测试里的断言 `runtime/tests/builtin-plugins.test.mjs:24` 和 `scripts/pack/iui-artifact.test.mjs:40`。另外 `scripts/iui-perf/run.mjs:40-42` 里也写着这三个值。

这一条绕不开 IUI 插件。签名说明和裁判提示词都在 IUI 的提示词源里。fde-x 能做的替代办法是用 `runtime/vendor-overlays` 去覆盖 IUI 文件，但那等于绕过钉值，我不推荐。

### 4. B 没有技能目录

#### 根因（已核对）

- `runtime/mcp-archive.mjs:34-37` 的 `SKILL_PROVIDER_ROWS` 列出 `skill-filesystem` 和 `tool-skill` 两行。`ensureSkillProvidersInProfile`（591 到 602 行）把它们在用户 profile 的 patch 里写成 `disabled: false`。调用方是 `runtime/dsh-core.mjs:324-327` 的 `startInternal`，每次启动都跑。这是 `b0cbb6b2` 引入的。
- 宿主的设计是关掉宿主平面的这两行，交给预设自己挂载。`dsh-web-app/cordis.patch.yml:475-488` 的注释写明了这一点。标准预设 `dsh-web-app/presets/standard.patch.yml:34-37` 自己挂了 `skill-filesystem` 和 `tool-skill`。
- 宿主平面的 `tool-skill` 被打开以后，就有两份 `tool-skill`，各自挂一个 `agent/pre-step`。预设那份注册的 `skill` 在预设作用域里遮住了全局那份。宿主那份在 `dsh-tool-skill/lib/index.js:207-214` 检查 `ctx.tools.get(skillTool.name, agent) === skillTool`，检查不过，就拿空快照。接着在 227 到 230 行，如果目录还没发布过、且自己的技能是 0 个，就把消息里已有的目录（也就是预设那份刚放进去的）删掉。如果目录已经发布过，就发一条空目录更新，把旧名字全部撤销。两种情况结果一样，B 看不到技能。README 第 84 行也写了，同名遮蔽会同时拿掉 schema 和目录。
- 哪一份处理器在外层，是按注册顺序决定的。我没有在真机上确认顺序。「宿主那份在外层」是从用户日志「B 没有技能目录」的结果反推出来的（推断）。

#### 修法

- 只改 `ensureSkillProvidersInProfile`，让 `tool-skill` 行写成 `disabled: true`。`skill-filesystem` 保留 `disabled: false`，因为宿主平面的文件系统提供者注册在全局层，这是宿主注释里允许的用法（`dsh-web-app/cordis.patch.yml` 同一段），技能页面可能还依赖它。`$DSH_HOME/skills` 的软链逻辑不动。
- 已经写进用户 patch 的那一行是 fde-x 自己写的，不是用户配的。把它从 `false` 改成 `true`，属于修正 fde-x 自己写错的值，不算删用户配置。这个函数每次启动都会收敛到同一个结果，是幂等的。
- 不用 try/catch 吞错，也不加空值判断。

⚠️ 默认值。这改变的是 fde-x 写进 profile 的默认值。

预期（猜测）：B 的前缀会**增加**技能目录那部分。每个技能描述最多 500 字符（`catalogDescriptionMaxLength`，`dsh-tool-skill/lib/index.js:40`、`49`），按十来个技能估，约 1K 到 3K token。这是修 bug，不是优化。

风险：如果宿主平面的 `tool-skill` 是为某条不挂预设的会话（比如没有 preset 的子代理）准备的，那条会话会失去 `skill` 工具。需要检查 `runtime/presets/.generated-agent-presets.patch.yml` 里的 `fde-app-builder` 和 `fde-briefing` 是否各自挂了 `tool-skill`。探索结果显示两者都挂了（91 到 101 行、360 到 370 行）。还要确认有没有不带预设的会话路径（未验证）。

## 二、早报和会话的 3 个 bug

### 1. 「会话未投影」

#### 根因（已核对）

`runtime/briefing/ask-ai.mjs:47-54` 轮询 `listSessionProjectedToolNames`，默认最多等 8000 毫秒（第 26 行）。第 61 到 63 行把不在投影里的 mcp 区块拦下，文案是「会话未投影」。第 69 到 71 行在没有区块能通过时直接返回。投影来自会话日志里的 `header.tools`（`runtime/routes/mcp.mjs:54-67`、`87-107`）。`resolveBriefingSession`（`runtime/briefing/session.mjs:19-42`）新建的 `fde-briefing` 会话还没有跑过任何一轮，所以没有 header。这道门永远不放行，而能写出 header 的那次 prompt 又正好被这道门拦住。新会话是 `c0227143` 引入的，门上的文案来自 `b0cbb6b2`。

同样的错门还有一份。`runtime/biz/invoke.mjs:63-90` 的 `invokeStdioMcp` 也先等投影，再让模型代调 stdio MCP。这是同一类错误（Fix Root Causes 要求连同类一起处理），我把它列进需要用户拍板的问题。

#### 修法：早报按区块直接调用 MCP

为什么选这条。延迟加载和模式裁剪做完以后，会话前缀里本来就不该有 `mcp__*` 的 schema，这道门就更不可能放行。「先 prompt 再等 header」会让早报会话付整份约 62K 的前缀，和第一节的方向冲突。「只为这一轮装上点名的工具」需要宿主提供按轮装工具的接口，而 `SessionPromptRequest` 没有任何工具相关的字段（`dsh-api-session-controller/lib/types/types.d.ts:319-327`）。

做法：

- 桥接插件 `runtime/fde-x-dsh-bridge/lib/index.js` 的 `handler`（104 行起，前缀 `/fde-session`）新增路由 `POST /fde-session/mcp/call`，入参是 `{ name, args }`，用现有的 `bridge.token`（`runtime/fde-x-dsh-bridge/lib/tools.js` 的 `bridgeTokenPath`）做鉴权。处理时走宿主已有的同进程执行接口 `ctx.tools.execute`（`dsh-tools/lib/types/index.d.ts:750-765`），执行全局注册的 `mcp__<server>__<tool>`。stdio 进程本来就由宿主的 `dsh-mcp-client` 持有，所以不会再起第二个进程，也不会重复读用户的 MCP 凭据。`ToolExecutionInput` 的具体字段要在实现时对照类型定义（未核对到字段级）。
- `runtime/briefing/ask-ai.mjs` 删掉第 40 到 71 行的投影等待和拦截，改成对每个 mcp 区块用 `params.server`、`params.tool`、`params.args` 调上面这个路由。区块的形状见 `src/lib/runtime-api.ts:524-531`、`runtime/briefing/defaults.mjs:38-39` 和 `BriefingSettingsDrawer.tsx:410-460`。工具返回的结果放进给模型的 prompt。模型只负责写摘要，最后调 `fde_briefing_submit`。
- 工具调用失败时，把宿主返回的错误原样记到这个区块上，和今天 `blocked[]` 的结构一致，不吞错。
- 早报会话的 prompt 里不再需要 `mcp__*` 的 schema。第一节的方向 (b) 可以让 `fde-briefing` 模式不挂任何用户 MCP，早报每轮再省一份前缀。

预期（推算）：早报从「永远失败」变成可用。早报那一轮的前缀，在加上 (b) 以后不再带用户 MCP 的约 47.5K。

风险：

- 参数必须事先写在区块上，模型不再替用户补参数。今天设置抽屉已经有 `params.args` 输入框，所以这符合现有的数据形状。
- 新路由能执行任意已注册的工具。名字只放行 `mcp__` 前缀，并且必须带 token。这是一个新的攻击面，要在 PR 描述里单独写清楚。
- 这一条要改桥接插件，绕不开。早报要用的 stdio 进程活在宿主进程里，BFF 只有通过宿主进程才能调到它。我们不改 DSH Host 本体，也不改对话页 UI。

### 2. 新会话要刷新才出现

#### 根因（已核对）

- `resolveBriefingSession` 调用 `session/create`（`runtime/briefing/session.mjs:33-35`）之后没有 `emit`。会发事件的只有 REST 创建口（`runtime/server.mjs:1993-1998`）。
- `src/pages/AI.tsx:414-468` 只在进页面时拉一次列表，第 492 到 498 行的 `useEvents` 只订阅了 `memory.engine.changed`。事件目录里其实已经有 `ai.session.changed`（`src/lib/events.ts:17`）。

#### 修法：创建和监听两头都补

- `runtime/briefing/session.mjs` 的 `resolveBriefingSession` 在新建成功之后，调用 `emit('ai.session.changed', …)`，载荷沿用 REST 那份 `kind: 'created'`（`runtime/events.mjs:84-134` 的签名，带 `workspaceCwd` 和 `sessionId`）。复用已有会话时不发。`resolveBriefingSession` 现在只收 `aiRuntime` 和 `cwd`，要把 `emit` 依赖传进来，调用方是 `runtime/briefing/run.mjs:143`。
- `src/pages/AI.tsx` 订阅 `ai.session.changed`，收到以后重新拉一次 `GET /api/v1/ai/sessions`，复用第 414 到 468 行的同一个拉取函数，不在本地手工拼行。手工拼行容易和服务端的过滤规则不一致。
- 不用整页刷新。

备选是「早报改走 REST 创建口」，好处是创建只有一个入口。但页面订阅照样要加，而且 BFF 内部再走一次 HTTP 绕回自己，没有必要。可以退一步，把 `server.mjs` 里发事件的那段抽成一个函数给两边共用。这个由实现者决定，不影响验收。

风险：事件在 SSE 上按工作区过滤时，早报所在的工作区和当前页的工作区不同，就收不到。这是对的，那条会话本来也不该出现在当前列表里。

### 3. 切工作区不跟随

#### 根因（已核对）

- `src/store/app.ts:370-384` 的 `setActiveWorkspace` 清掉 `activeAiSessionId`（379 行）。
- `src/pages/AI.tsx:137-145` 的 `wantedSessionId` 先用地址栏 `chatId`。`visibleSessions`（120 到 126 行）按 cwd 过滤以后，旧会话不在里面。第 569 到 578 行的 effect 找不到 row 就直接 return，不发 `select`。第 518 到 533 行在 iframe 的 base 不变时保留旧 hash。
- iframe 里的桥接脚本 `runtime/fde-x-dsh-bridge/lib/client.js:222-228` 从 hash 里读出 `pendingSelectId`。`pickExisting`（230 到 251 行）优先返回它。`connectWorkspace` 的包装（265 到 275 行）因此不会去选新工作区里的会话。
- 这个问题 main 上就有，基线提交是 `a8449148`，加上 `b0cbb6b2`。

#### 修法

- `src/pages/AI.tsx` 中，把 `wantedSessionId` 的推导改成按工作区归属。地址栏 `chatId` 那一行的 cwd 等于当前工作区 cwd 时才用它。不等时，取 `visibleSessions` 里 `updatedAt` 最新的一条，`navigate` 换掉路由（replace，不进历史），然后发 `tellDsh('select')`。列表、地址栏、iframe 三处用同一个 id。
- 新工作区里一条会话都没有时怎么办，要用户定。可选的做法有两种。一是新建一条空会话（`data-phase=hero`）。二是让 iframe 走 Host 自己的 `connectWorkspace`，它在 `pickExisting` 返回空时会落到原函数。
- `runtime/fde-x-dsh-bridge/lib/client.js` 收到外壳的 `select`（387 到 405 行）以后，把 `pendingSelectId` 置空。hash 里的 id 只在 iframe 首次加载时用一次。这是 fde-x 自己注入 iframe 的桥接脚本，不是 Host 的 UI 代码，不改任何样式。
- 不强制刷新整页，也不把旧会话 id 配上新工作区的 workspaceId 发 `select`，那样会把旧会话绑到新工作区。

风险：`updatedAt` 相同或缺失时，选哪条是不确定的。`pickExisting` 现在用的是 `>=`，会选列表里排在后面的那条。外壳最好用同一条规则，两边才不会各选各的。

## 三、PR 拆分、依赖与合入顺序

规则是一个 PR 一个 owner，一个分支一个 writer。两个 PR 改同一个文件时，必须串行，按依赖关系 rebase 在前一个之上。

| PR | 内容 | 主要文件 | 依赖 | 冲突面 |
| --- | --- | --- | --- | --- |
| PR-1 | B 的技能目录 | `runtime/mcp-archive.mjs`，`runtime/tests/mcp-archive.test.mjs` | 无 | 无 |
| PR-2 | 测量脚本支持用户 MCP 和技能目录检查 | `scripts/iui-perf/run.mjs`，`scripts/iui-perf/lib/summarize.mjs` | 基于 `cursor/iui-perf-measure-b2fc` 另开分支 | 无 |
| PR-5 | 早报直调 MCP | `runtime/fde-x-dsh-bridge/lib/index.js`（新路由），`runtime/briefing/ask-ai.mjs`，`runtime/tests/briefing-agent.test.mjs` | 无 | 和 PR-3、PR-4 同改桥接插件 |
| PR-3 | MCP 按模式裁剪 | `runtime/mode-policy.cjs`，`runtime/fde-x-dsh-bridge/lib/index.js` 的 `installIuiModeGate` 和配置，`runtime/dsh-core.patch.yml`，`runtime/tests/mode-policy.test.mjs` | PR-5 之后 | 桥接插件 |
| PR-4 | MCP 延迟加载 | `runtime/fde-x-dsh-bridge/lib/index.js`、`runtime/fde-x-dsh-bridge/lib/tools.js`，`runtime/mode-policy.cjs` | PR-3 之后 | 同上 |
| PR-6 | 新会话进列表 | `runtime/briefing/session.mjs`，`runtime/briefing/run.mjs`，`src/pages/AI.tsx` | 无 | 和 PR-7 同改 `AI.tsx` |
| PR-7 | 切工作区跟随 | `src/pages/AI.tsx`，`runtime/fde-x-dsh-bridge/lib/client.js` | PR-6 之后 | `AI.tsx` |
| PR-8 | IUI 签名说明与裁判统一（IUI 仓库） | IUI `src/themes/oiu-design-system.ts`、`SKILL.md`、`src/plugin/format-referee.ts` 和对应测试 | 用户批准 | 无 |
| PR-9 | ⚠️ 更新 IUI 钉值 | `scripts/pack/pins.mjs`，`runtime/builtin-plugins.mjs`，`scripts/pack/iui-pin-manifest.json`，`.github/workflows/mac-all.yml`，两处测试断言，`scripts/iui-perf/run.mjs` 的常量 | PR-8 合入并出产物 | 和 PR-2 同改 `run.mjs` 的常量 |

effort 没有 PR。如果用户同意，就给 DSH Host 上游开一个 issue。

建议的合入顺序是 PR-1，PR-2，PR-5，PR-3，PR-4。PR-6 和 PR-7 可以和这条线并行。PR-8 和 PR-9 在批准以后再做。PR-1 放第一位，是因为它最小，而且之后每次 A/B 都需要一个「目录正常」的 B 作基线。PR-5 排在 PR-3 前面，是因为 PR-3 合入以后，`fde-briefing` 模式可以不挂用户 MCP，前提是早报已经不依赖会话里的 MCP schema。

## 四、验收

### IUI 性能，在用户 Mac 上跑

前提是 Node 26、pnpm 11.20.0，并且 grok2api 在 `127.0.0.1:8000` 上运行（`scripts/iui-perf/README.md`）。

基线，在 `test/mac-all-next` 上跑，脚本取自测量分支：

```bash
git fetch origin test/mac-all-next cursor/iui-perf-measure-b2fc
git switch --detach origin/test/mac-all-next
git checkout origin/cursor/iui-perf-measure-b2fc -- scripts/iui-perf
GROK2API_API_KEY=... node scripts/iui-perf/run.mjs
```

PR-2 合入以后，用用户自己的 MCP 跑一遍。下面的环境变量名 `IUI_PERF_PROFILE_PATCH` 是本方案提议的名字，今天还不存在：

```bash
GROK2API_API_KEY=... IUI_PERF_PROFILE_PATCH="$HOME/.dsh-fde-x/profiles/fde-x/cordis.patch.yml" node scripts/iui-perf/run.mjs
```

每个性能 PR 都在自己的分支上重复这一步，把 `artifacts/iui-perf/grok-live/` 和基线比较。默认每臂冷启动 3 次（`IUI_PERF_RUNS`）。要验证 effort，就加上 `GROK2API_EFFORT=high`。

各 PR 的通过线：

- PR-1。B 的请求体里出现 `<available_skills>` 目录，并且不含 `No skills are currently available`。B 的 input 比基线略高，属于预期。
- PR-3。B 在 `standard` 模式下，请求里没有被表排除的那几台服务的 `mcp__` 工具。第 1 步 input 在基线减 41K 上下。3 次运行的中位数和波动都写进报告。
- PR-4。B 的请求里没有 `mcp__` schema，只有目录段和 `fde_mcp_load`。第 1 步 input 在 25K 上下。另外补一条需要 MCP 的提示，确认 `fde_mcp_load` 之后能用真名调到工具。
- PR-8 和 PR-9。A 和 B 都不再出现 `tool_before_fence` 操作记录，或者出现次数比基线少。onFrame 复现脚本 `node --experimental-strip-types scripts/iui-perf/reproduce-onframe.mjs` 要配合新的提示词和真实模型输出一起看。单靠这个脚本，只能证明宿主传的是对象。

报告里的每个数字都要带上运行次数、波动，以及时间主要花在哪一段（首 token 还是生成）。

### 三个 bug，先红后绿的真页面测试

现有证据在 `origin/cursor/briefing-session-repro-260a`。`scripts/repro/page-list-follow.mjs` 和 `page-session-bugs.mjs` 是「复现到 bug 就退出 0」的写法，要翻成「期望行为」的断言，放进 `tests/visual/`（Playwright 配置在 `playwright.config.ts`，baseURL 是 5174）。每个 bug PR 的第一个提交只加测试，在基线上是红的。第二个提交改代码，变绿。

- PR-5。真 BFF 加假 stdio MCP（`scripts/repro/fake-mcp-stdio.mjs`），新建 `fde-briefing` 会话，点「生成新早报」。断言两栏都不出现「会话未投影」，并且条数大于 0。进程内的断言可以先用 `node --test scripts/repro/briefing-session-desired.test.mjs`，今天是红的。
- PR-6。打开会话页，不刷新，触发一次早报建会话和一次 REST 建会话。断言侧栏条数各加一。
- PR-7。在工作区 A 打开会话 A，切到工作区 B。断言地址栏、iframe 的 hash、侧栏选中项都是 B 里最新的那条会话，并且整个过程中页面没有 reload（在测试里监听 `page.on('load')`）。

页面测试需要 BFF 4318、Vite 5174 已经起来，并且 `/api/v1/ai/status` 的 `connected` 为 true，和复现脚本的前提一样。

## 五、风险汇总

- 方向 (b) 和 (a) 只在请求组装阶段生效。旧会话日志里的 `header.tools` 会和新请求不一致。任何仍然以 `header.tools` 判断「能不能调用」的代码都会出错。已知的有 `ask-ai.mjs`（PR-5 删掉）和 `biz/invoke.mjs`（待定）。实现前要全仓搜一遍 `listSessionProjectedToolNames` 的调用方。
- `fde_mcp_load` 和直调路由都是新的模型可见面或网络可见面，PR 描述要单独写鉴权和名字放行规则。
- PR-2 会把用户的 `cordis.patch.yml` 复制进临时 HOME，里面可能有 MCP 凭据。只能复制到 `mkdtemp` 目录，跑完删除，日志继续走 `scripts/iui-perf/lib/redact.mjs`。
- UI 把两步的 total 相加显示成 163K，这是对话页的展示问题，属于 Host iframe，本方案不改。

## 六、推荐组合

- 技能目录走 PR-1。
- MCP 先走 (b)，再走 (a) 的「真名挂载」变体。
- effort 走 E1，另给上游提 E2 的 issue。
- IUI 走 O1 加 R1，作为 PR-8 和 PR-9。O2 不做，O3 另立项。
- 早报走直调 MCP（PR-5）。
- 会话列表走 emit 加订阅（PR-6）。
- 工作区按 cwd 改路由，并在 iframe 里消费掉 `pendingSelectId`（PR-7）。

按推算，B 的第 1 步 input 从约 69.6K 降到约 25K。时间上，effort 那一项约 140 秒是日志给的数，MCP 和裁判那两项要等 A/B 实测。

## 七、需要用户拍板的问题

1. 方向 (b) 的默认表要不要在 `standard` 模式下默认不挂浏览器类和桌面类 MCP，还是默认全挂、由你在设置里勾？⚠️
2. 是否接受 (a) 用「真名挂载」变体，代价是加载那一步缓存失效一次？
3. effort 是你自己改成 low，还是保持 high？
4. 要不要给 DSH Host 上游提「`selectModel` 只保存显式 effort」的 issue？
5. 是否批准改 IUI 并更新钉值 `f3dc3ef1…`（PR-8、PR-9）？⚠️
6. 作者 JS 报错自动修一轮，是否另立项、不进本轮？
7. 宿主平面的 `tool-skill` 是否改成 `disabled: true`，同时保留 `skill-filesystem` 为 `disabled: false`？⚠️
8. 早报直调 MCP 以后，模型不再替你补参数，参数必须写在区块上，是否接受？
9. `runtime/biz/invoke.mjs` 里同类的投影门，是并进 PR-5 一起改，还是另开一个 PR？
10. 切到一个还没有会话的工作区时，是新建一条空会话，还是交给 Host 的 `connectWorkspace`？
11. 是否接受在桥接插件里新增受 token 保护的 `POST /fde-session/mcp/call` 路由？
