# 语义系统进 FDE-X：可生产方案

第一性原理：顶栏当前工作区里的知识图，官方语义系统能做的，FDE-X 记忆模块都能做、能用、数据跟目录走。不接受「只搜摘录」。

本方案取代规格阶段 E 的薄切片（仅 `search_text` + 记忆卡）。浏览器仍不加载 DSH `__ModuleLoader__` / 官方整页；语义 **产品画布** 要进 FDE-X 壳。

---

## 1. 「全部功能」清单（对照官方语义首页）

| 块 | 官方入口 | 用户能做什么 | 现 FDE-X |
|---|---|---|---|
| 首页 | 在线状态、当前目录名、封面计数、三按钮 | 一眼看到这是哪张图 | 记忆页仍是三层日记假壳 |
| 01 探索 | `ws/explore` | 看图、点节点、换视图、加实体 | 无 |
| 02 分析 | `ws/analyze` | 跑推理、测规则 | 无 UI（工具或许可在会话里调） |
| 03 决策 | `ws/decisions` | 拍板、依据→决策→后果 | 无 |
| 04 出入 | `ws/io` | 导入导出、对齐、审计 | 无 |
| 05 词表 | `ws/ontology` | SKOS / SHACL / 分类 | 无 |
| 06 管理 | `ws/admin` | 摄取、血缘、桥、存图后端 | 设置里只有探测/抽取数字 |
| 抽屉 | 设置、花名册、梳理、血缘 | 不离开记忆模块 | 设置 → 语义记忆（部分） |
| 会话工具 | Host tools | 对话里读写图 | 引擎就绪后可用，无界面 |

引擎、runtime、按 cwd 分图：已经有。缺的是 **BFF 开全 + 记忆页变成语义首页 + 六块画布挂上**。

---

## 2. 怎么做（不要整文件粘贴 `client.js`）

官方六块 **已经是可挂载模块**，不是 Cordis 插件本体：

```text
/semantic-os/ws/explore/explore.js   → mount(el, { cwd, hostActions })
/semantic-os/ws/analyze/analyze.js
/semantic-os/ws/decisions/decisions.js
/semantic-os/ws/io/io.js
/semantic-os/ws/ontology/ontology.js
/semantic-os/ws/admin/admin.js
```

`client.js` 只负责：选 cwd、画首页、动态 `import()` 这些模块、抽屉。  
FDE-X 要抄的是这套 **信息架构 + mount 契约**，用 React 重写首页和抽屉，六块画布继续用官方 `mount`（只改 CSS 变量 / 外包一层 FDE-X 顶栏）。

接入方法：浏览器只打 `http://127.0.0.1:4318`，由 4318 把 `/semantic-os/*`（HTTP + 静态 ws 资源）转到本机 DSH（cookie 留在 4318 进程，不进浏览器）。

```text
FDE-X 记忆页 (React)
  ├─ 首页：在线 / 目录名 / 封面计数 / 六张卡   ← 自绘，跟 FDE-X 壳
  └─ 子页：div ref + import('/api/v1/semantic-os/ws/…')  ← 官方画布
         cwd = 顶栏工作区绝对路径
4318
  └─ 反代 DSH origin /semantic-os/*
       只 loopback；剥 Set-Cookie；cwd 走 query
```

禁止：FDE-X 里跑 `__ModuleLoader__`；把整页 DSH 再嵌一层当语义；继续用 zustand 三层记忆冒充图。

---

## 3. 工作区（必须先钉死）

顶栏工作区是唯一 cwd。

- 切工作区 → 记忆首页、六块 `mount` 的 `cwd`、搜索/卡片、会话工具用的 session.cwd **同一条路径**
- 新工作区 = 空图 `{cwd}/.dsh/semantic-os/`
- 中文路径只走 `?cwd=`，不放非 ASCII `x-dsh-cwd`
- 4318 启动目录（scene-39）不再当语义默认目录

会话页已按工作区过滤；语义必须同等待遇。

---

## 4. 阶段（一阶段一截，做完再进下一阶段）

### P0 — 4318 语义网关（没有这个，后面全是空壳）

- 白名单前缀 `/semantic-os/` 反代到已连接的 DSH origin（含 `/ws/*` 静态资源、`/api/*`、`/python`、`/find`、`/lineage`、ingest）
- 浏览器不得收到 DSH `Set-Cookie`
- Origin 白名单、只 127.0.0.1
- 每个请求带当前工作区 cwd；DSH `workspaceAuthority` 仍闸目录
- 现有 `/api/v1/memory/*` 保留为薄封装，内部走同一网关，避免两套 cwd 逻辑

**完成：** 浏览器打开 `4318/semantic-os/ws/explore/explore.js` 200；`/api/coverage?cwd=` 返回当前目录封面；cookie 不出现在响应头。

### P1 — 记忆页换成语义首页

- 删掉用户级/工作区级/今日日志假计数、`~/.workbuddy/MEMORY.md` 文案、本地删除冒充入档
- 首页：系统在线（/ready）、目录名、封面桶、按钮「打开探索 / 运行推理 / 记忆梳理」、六张卡
- 设置抽屉继续用现有「设置 → 语义记忆」（引擎、抽取、花名册），不在记忆页再做一套

**完成：** 切顶栏工作区，首页目录名和封面跟着变；无 seed 记忆条目。

### P2 — 挂上六块官方画布

- 路由建议（不新增顶栏模块）：`/memory` 首页，`/memory/explore|analyze|decisions|io|ontology|admin`
- 每页一个 host `div`，`import` 对应 `ws/*.js` 的 `mount`，传入顶栏 cwd
- FDE-X 外壳：返回首页、工作区名；画布内部交互保持官方能力
- 用 FDE-X token 覆盖画布 CSS 变量（字体、半径、品牌绿），不改官方压缩包源码

**完成：** 六块都能在当前工作区 cwd 下点开、读写图；刷新不丢工作区。

### P3 — 抽屉与会话打通

- 记忆梳理 / 加实体 / 记一条决策：FDE-X 抽屉或现设置页，调同一网关
- 会话工具读写的图 = 当前工作区图（session.cwd 必须等于顶栏 cwd）
- 「记住」→ 卡片出现在记忆首页/决策块，不再进 localStorage

**完成：** 在 A 工作区写入的节点，切到 B 看不见；切回 A 还在。

### P4 — 清场

- `rg addMemory src` 连接后路径为空
- 记忆页无「约 N K 字」
- README / PRODUCTION-SPEC 阶段 E 改为本文件
- `tsc` + smoke：未授权 Origin 的 `/semantic-os` 写 403；无 cookie 外泄

---

## 5. 安全 / 稳定 / 性能

- 4318 与 DSH 只绑 127.0.0.1；反代目标禁止用户拼 URL
- 不把 DSH cookie、业务口令、配对钥匙回浏览器
- cwd 必须是绝对路径且通过 DSH 工作区权限；禁止 `..`
- 画布 `import()` 失败要有 FDE-X Empty，禁止白屏
- sidecar 退出：已有 `/ready` 后台再拉起，首页「系统在线」必须反映真实 ready
- 六块画布不要预加载；点开再 `import`，卸页要调官方 `unmount`

---

## 6. 明确不做

- 不把 FDE-X 打成 dsh profile 换皮
- 不在 FDE-X 进程跑 `__ModuleLoader__`
- 不嵌整页 DSH 当语义（对话 iframe 保持现状，语义走 4318 网关 + mount）
- 不把图迁进 SQLite
- 不在无 cwd 时画出「制度 11」这种别的目录的数

---

## 7. 验收（手工，对照现源码页，不对照早期宣传 PNG）

1. 顶栏切到新工作区：记忆首页目录名变；探索里是空图或该目录自己的点。
2. 探索里加一个实体，设置里的文件备份路径是 `{该cwd}/.dsh/semantic-os/graph.json`。
3. 分析能跑一条推理（质量是引擎问题，界面要能提交并显示回包）。
4. 决策列表能看见本目录的板；导入导出能下载/回灌。
5. 词表页能看见本目录 SKOS；管理页能看见摄取数字。
6. 会话里对当前工作区 `search_text` 能命中刚才写下的点。
7. 响应头无 `set-cookie`。

---

执行顺序：P0 → P1 → P2 → P3 → P4。P0 未绿之前不要改记忆页壳，否则又是空按钮。
