# DSH Agent Preset × FDE-X 接入研究（只读）

**DSH 版本证据**：`@deepseek-ai/dsh` 随 `@deepseek-ai/dsh-agent-presets` `^0.1.5-rc.1`（`dsh-api-session-controller/package.json` L77）。**FDE-X DSH 主目录**：`FDE_DSH_HOME` 默认 `~/.dsh-fde-x`（`runtime/dsh-core.mjs` L140–144）；本机尚无 `~/.dsh-fde-x/.agent-presets`。

---

## 1. Agent preset 是什么；FDE-X 怎么用

**定义**：一 preset = 一目录，必含 `agent.cordis.yml`（Cordis 插件行列表 = 该会话的工具/persona/prompt/skills）；可选 `preset.yml` 元数据 `name`/`description`/`order`（`dsh-agent-presets/README.zh.md` L32–36、L60–64；`lib/types/preset.d.ts` L18–31）。

**发现与路径**（优先级：随包 system 根 → `config.roots[]` → user 根）：
- 随包：`node_modules/@deepseek-ai/dsh-agent-presets/presets/{standard,ptc,minimal,cordis}/`（如 `presets/cordis/preset.yml` L1–3 显示名 **创造模式**，目录 id 为 **`cordis`**）。
- 用户可写：`<DSH_HOME>/.agent-presets/<id>/`（README.zh.md L36–37、L61–64）。FDE-X 即 `~/.dsh-fde-x/.agent-presets/`。
- Web 宿主默认：`dsh-web-app/cordis.patch.yml` L473–484 `default: standard`，`includeShippedRoot`/`includeUserRoot` 由包默认 true（README.zh.md L55–56）。

**加载时机**：会话 `create` 时 `agentPreset`（或 settings `agent-presets.default`）→ factory `setup` 里 `agentPresets.mount`（README.zh.md L64–71、L79–81；架构 note：https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/architecture/2026-08-03-per-session-agent-presets.md）。有消息后 preset **锁定**；换 preset 须新会话（README.zh.md L79–81；`PRODUCTION-SPEC.md` L72）。

**与 Skills / MCP / plugin**：
- Skills 目录按 **preset 作用域**：`skill-catalog.js` L150–154 `presets?.serviceFor(live, 'skills')`。
- MCP 在 **permission preset**（`/permission <id>`），非 agent preset（`PRODUCTION-SPEC.md` L72–76；`runtime/server.mjs` L1643–1649）。
- Host profile 插件：`dsh-core.mjs` L354–377 写 `profiles/fde-x/package.json` bundles + `runtime/dsh-core.patch.yml`（凭证/会话根/UI 关断/bridge）；**未**改 `agent-presets.roots`。

**FDE-X 读/切/增**：
| 能力 | 位置 |
|------|------|
| 列表 | `GET /api/v1/ai/presets` → `agentPresets/list`（`server.mjs` L1253–1255） |
| 新会话选 preset | `POST …/sessions` body `agentPreset`（L1432–1436）；UI `AI.tsx` L457–724、`CommandPalette.tsx` L51–55 |
| 空会话改 preset | `POST …/sessions/:id/preset`（L1603–1614）；`runtime-api.ts` L476–483 |
| 复制/删用户 preset | `POST …/presets/copy|delete`（L1259–1282）；设置 `CoreSettings.tsx` L304–352；API L399–410 |
| 权限档 | `setAiPermission` → `/permission`（`runtime-api.ts` L503–508） |

**新增 preset 现成路径**：UI「从哪个复制 + 新 id」（CoreSettings）；或 DSH `copy(from,id,name)` 写入 user 根（README.zh.md L73–77）。**无**官方 URL/git 一键导入 API。

---

## 2. 「创造模式」

**存在**：随包 preset **id=`cordis`**，UI 名 **创造模式**（`presets/cordis/preset.yml` L1–2）。

**能力**：在 `standard` 之上加 `dsh-tool-cordis`、`editing-cordis-compositions` / `cordis-plugin-development` skills；persona 说明 HOST vs AGENT 平面（`agent.cordis.yml` L1–30、L249+）。

**输出物**：非「业务 app 工件」，而是 **用户根下的新 preset 目录**（`agent.cordis.yml` + `preset.yml` + skills/本地 `.mjs`）；经 `copy()` 或 agent 写 `$DSH_HOME/.agent-presets/<id>/`（L28–30；SKILL `editing-cordis-compositions` L28–38）。`cordis_mount` 仅运行时探测（SKILL L122）。

**触发**：新会话选 preset **`cordis`（创造模式）**，自然语言要求创作/复制 preset（`AI.tsx` 选 roster）。

**若无创造模式**：最接近 = **`standard`** 编码 agent；或 **`copy(standard,…)` + 手改**；业务侧 FDE-X 已有独立「AI 创建应用」表单（见 §4），与 DSH 创造模式 **不同域**。

---

## 3. 接入开源 preset

**最短路径**（FDE-X 应用 `DSH_HOME=~/.dsh-fde-x`）：
1. **复制安装**：`cp -r <repo>/<id> ~/.dsh-fde-x/.agent-presets/`（awesome-dsh-presets README）；`list()` 即时可见（Moeblack/dsh-preset-kit 文档）。
2. **API 克隆**：设置页已有 `copyAiPreset({ from, id, name })` — 只能 **从已在 roster 的 id 复制**，不能直接拉 GitHub。
3. **部署级 roots**：在 profile `cordis.patch.yml` 增 `agent-presets.config.roots`（README.zh.md L40–49）；FDE 现仅 `dsh-core.patch.yml` 动 bridge/存储，**未**暴露 roots 配置 UI。

**风险**：`user` trust = shell 级（README.zh.md L12）；id 冲突时 **早序 root 赢**（L50–51）；升级覆盖随包 preset，勿改随包目录（SKILL L12–14）；第三方 `!!js` / 本地 `.mjs` 需信源审查（hackerFish 校验脚本说明）。

**UI 承载「导入」**：**设置 → Agent 预设**（`CoreSettings.tsx` L304–352）最自然——扩「从 Git 路径/zip 安装说明 + 调用 copy」或「粘贴 repo 子目录名后一键 cp 到 `FDE_DSH_HOME`」；**Skills 页**是会话 catalog 只读（`Skills.tsx` L25–42），不适合装 preset。

**Web 搜到的开源样例（格式均为 `<id>/agent.cordis.yml` + `preset.yml`）**：
| 仓库 | 代表 preset |
|------|-------------|
| https://github.com/hackerFish/awesome-dsh-presets | `minimal-zh`, `writer`, `researcher` |
| https://github.com/my-dsh-plugin/dsh-presets | 多 id + install 脚本 |
| https://github.com/ruby1304/dsh-preset-anchored-standard | `anchored-standard` + `tool-bootstrap.mjs` |
| https://github.com/GY-Bai/dsh-anchored-subagent | `dsh-anchored-subagent` |
| 本机 `~/.dsh/.agent-presets/liangshen/` | 用户 preset 实例（`preset.yml` L1–3） |

---

## 4. 业务应用 × preset/创造模式

**现状**（`Data.tsx` L342–366）：`createBusinessApp` 空 definition → 可选 `promptAi` 到**当前**会话，**不**选 preset、**不** `PUT` 解析结果；人工 `AppDraftEditor` `updateBusinessApp`（L241–255；API `runtime-api.ts` L1059–1066）。

**缺环**：① 创建流选 agent preset；② 专用会话（如 `cordis` 或 `fde-biz-app`）；③ AI 输出 → 结构化 `definition`；④ 受控 `PUT /api/v1/business/apps/:id`；⑤ 与操作审批链衔接（PRODUCTION-SPEC 禁止自动 biz_write）。

**方案 A — Bridge preset + 工具写回**
复制 `standard` → user preset，加 Skill/工具调 FDE bridge（已有 `fde-x-dsh-bridge`）提交 JSON definition。
优：可审计、可复跑；劣：要写 Cordis 行与工具契约（`runtime/dsh-core.patch.yml` L34–36 bridge 可扩展）。

**方案 B — 轻编排（扩 Data.tsx + server）**
创建时 `createRemoteSession({ agentPreset:'standard' })` + 固定 prompt schema；runtime 解析 assistant 消息/附件 JSON → `updateBusinessApp`。
优：不动 DSH 文件；劣：脆、需会话解析与 locked preset 规则。

**动文件（A/B 共有）**：`Data.tsx` 创建 UI；`runtime/server.mjs` 可选 `apps/:id/draft-from-ai`；`runtime-api.ts`；或 `profiles/fde-x` + user preset 目录。

---

## 5. 一句话结论

**值得做，但分两层**：① **preset 导入/复制** 成本低，应用 CoreSettings + `~/.dsh-fde-x/.agent-presets` 即可；② **AI 写业务 app definition** 与 DSH「创造模式」（写 harness preset）**不是同一产物**，应先做 **方案 B 最小闭环**（选 preset + 结构化 prompt + 人确认 PUT），再视需要加 **方案 A** 专用 preset。
