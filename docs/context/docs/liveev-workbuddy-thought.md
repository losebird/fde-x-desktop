# LIVE / WorkBuddy 那句「思考」从哪来的

## 结论（先看这段）

- **不是**系统或文档里写了一句「LIVEEV 插件与 WorkBuddy 悬浮窗是两个不同的旧版版本」。
- 日志里的原文是：**「发现 LIVE 插件与 WorkBuddy 悬浮窗是两个不同的旧版版本。」** 截图里的 **LIVEEV** 多半是 UI 把 **「LIVE」+「插件」** 挤在一起看成的一个词（日志 chunk 也是先出 `LIVE` 再出 ` 插件`）。
- **会话**：工作区 `fdex测试`，会话 `session-634e9ae1-0589-4088-9778-8de789439f45`（标题来自首问「故障类而且紧急、还没关的工单是哪家客户的？」）。第二问用户说：**「停用客户还有哪些没关的工单？」** 模型 **grok-4.6**，出现在 **turn 2 / step 25**（`session.v3.jsonl` **seq 288**）。
- **凭什么这么说**：模型在排 `biz_preview` 的 **`WHERE_UNBOUND`** 时，**自己 grep/读了多份 `dsh-lan-assist` 源码路径**，看到「有的 `lookup.js` 能搜到 `WHERE_UNBOUND`、有的搜不到」，就**猜**成两套「旧版」在打架；**没有**任何工具返回「版本号对照表」或「当前加载的是 A 不是 B」的确定性结论。
- **更直白**：读到了**多份磁盘上的插件拷贝** + **多次 `biz_preview` 失败**；「两个旧版」是**推理过度**，同一段思考后面还写「已确认实际是新版 WorkBuddy 悬浮窗」——前后打架。

---

## 会话与日志位置

| 项 | 值 |
| --- | --- |
| 工作区 cwd | `/Users/zxz/Documents/ai-project/fdex测试` |
| 会话 ID | `634e9ae1-0589-4088-9778-8de789439f45` |
| 完整 transcript | `~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-634e9ae1-0589-4088-9778-8de789439f45/session.v3.jsonl.zstd` |
| 投影缓存 | `~/.dsh-fde-x/storages/session_projcache/sessions/session-634e9ae1-0589-4088-9778-8de789439f45.json` |

解压核对：`zstd -dc <上述 zstd> | rg '两个不同的旧版'` → **seq 288** 的 `assistant/message`，`type: reasoning`。

---

## 用户当时在问什么

1. **Turn 1**：故障类、紧急、未关工单 → 哪家客户？（`biz_preview` 成功，多条工单。）
2. **Turn 2**：**停用客户还有哪些没关的工单？** → 多次 `biz_preview` 返回 **`ok: false, error: "WHERE_UNBOUND"`**，且 sheet 仍挂着上一轮「故障/紧急」的 **`sheetSpeech`** 和旧行（例如 TK20250211633），模型开始读 WorkBuddy 仓里的 `vendor-overlays/dsh-lan-assist` 和别的目录里的插件源码。

---

## 出那句思考之前，模型实际读了 / 调了什么

按时间线（turn 2，step 约 19–24 → step 25 出句思考），主要是 **`run_code` 里嵌套的 `grep` / `read` / `bash`**，以及 **`biz_preview`**：

### 1. 现查失败（直接诱因）

- **`biz_preview`**，`speech`: 「停用客户还有哪些没关的工单？」（及带 `from` / `steps` / `where` 的变体）→ 多次 **`WHERE_UNBOUND`**（例如 jsonl **seq 72、81、213、353、378** 等）。

### 2. 在 WorkBuddy 工作台仓里搜 `WHERE_UNBOUND`

- **`grep`** 路径：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation` → 命中 **`runtime/vendor-overlays/dsh-lan-assist/lookup.js` 约 698 行**（seq 145、149 等）。
- **`read`** 同一 overlay 下的 `lookup.js`、`plan.js`、`write.js`、`gate.js` 等（模型口头叫 **「WorkBuddy 悬浮窗」**，指工作台 runtime 里的 **vendor overlay**，不是 UI 组件名来自工具）。

### 3. 在「LIVE 插件」目录（开发树）里搜

- **`grep`** 路径：`/Users/zxz/Documents/ai-project/dsh-lan-assist`，pattern **`WHERE_UNBOUND`** → 工具结果 **「No matches found」**（jsonl **seq 273**）。
- 同目录 **`list` + `read probe.js`** 等（seq 274 一带）；**`UNBOUND []`** 出现在 captured output 里——模型据此在思考里写「LIVE 插件的 lookup.js 里没有 WHERE_UNBOUND 过滤逻辑」。

> 说明：仓库里这份 `dsh-lan-assist` 是 **ai-project 下的独立拷贝**；模型把它简称 **「LIVE 插件」**（live / 在研协助插件），**不是**日志里的专有名词 LIVEEV。

### 4. FDE-X 家目录里的其它拷贝（对比用，未用来下定论）

- **`bash` / `grep`**：`~/.dsh-fde-x/profiles/fde-x/node_modules/dsh-lan-assist/lookup.js` **有** `WHERE_UNBOUND`（seq 310–311）。
- **`grep`**：`~/.dsh-fde-x/vendor/dsh-lan-assist` **有** `WHERE_UNBOUND`（seq 346–347）。

### 5. 官方 npm DSH（对照）

- **`grep`** `/opt/homebrew/lib/node_modules/@deepseek-ai/dsh` → **`WHERE_UNBOUND` No matches**（seq 98、107 等）——说明错误码来自 **overlay / 工作台打包的 lan-assist**，不是全局 npm 里搜得到的那套字符串。

### 6. 出句思考**之后**的第一步工具（说明它还在猜加载路径）

- seq 288 思考块结束后立刻 **`run_code` + `bash`**：查 `DSH_PLUGIN`、`DSH_HOME`、工作区 `.dsh/lan-assist`、`cordis` 等（「Identify loaded assist plugin path」）——即 **思考先于「当前到底加载哪一份」的实证**。

---

## 「两个不同的旧版」是怎么拼出来的

| 模型看到的证据 | 它怎么理解 |
| --- | --- |
| `ai-project/dsh-lan-assist` 上对 `WHERE_UNBOUND` 的 grep **无匹配** | 「LIVE 插件」那份 **lookup** 和运行时不一致 / 更旧 |
| WorkBuddy `runtime/vendor-overlays/dsh-lan-assist/lookup.js` **有** `WHERE_UNBOUND` | 「WorkBuddy 悬浮窗」是另一份代码 |
| `biz_preview` 报 `WHERE_UNBOUND` | 一定是「加载了错的那份旧代码」 |
| 同一段 reasoning 后半段 | 又写 **「已确认实际运行的是新版 WorkBuddy 悬浮窗」** 且 **WHERE_UNBOUND 也在这份的 lookup.js** |

因此：

- **读到了两份（及以上）磁盘路径上的源码**，且 **grep 结果不一致** → 真。
- **「是两个不同的旧版版本」** → **模型归纳，不是工具结论**；甚至与后半段「新版 WorkBuddy」自相矛盾。
- **更贴近事实的一句话**：现查失败是因为 **where / hop 绑定** 在该次 `biz_preview` 里触发了 overlay 里的 `WHERE_UNBOUND`；模型误把 **开发树里一份 grep 结果不同的拷贝** 当成「运行时旧插件」，并贴上 **「旧版」** 标签。

---

## 和截图的对应

- 截图文案：`思考 · 发现 LIVEEV 插件与 WorkBuddy 悬浮窗是两个不同的旧版版本。`
- 日志原文：`发现 LIVE 插件与 WorkBuddy 悬浮窗是两个不同的旧版版本。`
- 差异：**LIVEEV ≈ 展示/误读；日志是 LIVE + 插件。**

---

## 检索方法（本机复现）

```bash
zstd -dc "$HOME/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-634e9ae1-0589-4088-9778-8de789439f45/session.v3.jsonl.zstd" \
  | rg '两个不同的旧版|发现 LIVE 插件'
```

`storages/session_projcache/sessions/*.json` **不含** 完整 reasoning 正文；要以 **`sessions/.../session.v3.jsonl.zstd`** 为准。

---

*只解释思考来源，不改产品。*
