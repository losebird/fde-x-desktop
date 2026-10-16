---
cursor:
  subagentId: "bc-d000ca33-2f76-56af-83de-d92959e2ef38"
---

# 设置里「前端兼容缓存 · 过渡中」为什么还在

## 结论（先看这句）

**不是迁移没做完，也不是读错了你的机器状态。** 琥珀色「过渡中」是 `Settings.tsx` 里**写死的标签**，和 SQLite、连接器、首页红字**没有联动**。只要这行 JSX 还在，你就会一直看到「过渡中」。

底下那张卡**不读** `localStorage` 有没有数据、也不读运行时迁移进度；它只是在说明：浏览器里还有一个叫 `scene-39-workstation` 的键，给 Zustand 持久化用。

---

## 1. 这张卡读的是哪份数据？

| 区块 | 来源 |
|------|------|
| 标题「存储状态」、蓝条「事务型数据正在切换到统一 SQLite…」 | **静态文案**，写在 `src/pages/Settings.tsx` |
| 「前端兼容缓存」+ 键名说明 + **「过渡中」** | **同上，静态**；没有 `useState`、没有 API、没有读 `localStorage` 体积 |
| 「语义记忆存储 · 独立权威」 | **静态** |
| 同页「业务连接器」表单 | **活数据**：`GET /api/v1/im/state`（lan-assist 的 `state.json`） |
| 同页点「存储与数据」时后台会调 `runtimeApi.health()` | **有请求，但结果不画在这张「存储状态」卡上**（健康诊断只在「运行环境」页用 `RuntimeRow` 展示） |

和「前端兼容缓存」**真正对应**的存盘，是浏览器 **`localStorage['scene-39-workstation']`**：Zustand `persist` 在 `src/store/app.ts` 里写入（见下文键名）。导出账户数据、重置前端 demo 会直接碰这个键；**存储状态 UI 本身不会去查它。**

---

## 2. 「过渡中」什么时候会消失？有人会在迁移完成后拨吗？

**代码里没有「迁移完成 → 自动改标签」的逻辑。**

- 「过渡中」= `<Tag kind="amber">过渡中</Tag>`，固定渲染。
- 全仓库 `rg '过渡中'` 只命中这一处（设置页）。
- 没有 feature flag、没有读 `runtimeHealth.persistence`、没有「localStorage 已清空则显示已迁移」之类分支。

所以要消失，只能是**有人改前端文案/标签**（或删掉这张子卡），不是跑完 SQLite 迁移会自动变绿。

产品叙事上这张卡想表达「壳层状态还在 localStorage、事务在迁 SQLite」；但**实现上标签不会跟着叙事更新**。

---

## 3. 和首页灯/红字、业务连接器是不是同一本账？

**不是。**

| 你看到的 | 读什么 |
|----------|--------|
| 首页业务卡红字、异常计数 | SQLite **操作表**（如 `uncertain` / `failed` 等），见项目内 `home-exception-connector.md` |
| 首页「系统连接」、适配器「待启用」胶囊 | `GET /api/v1/business/connections` → `business_connections.status`（种子常为 `pending`） |
| 设置 → 存储与数据 → **业务连接器** | `GET /api/v1/im/state` + 保存走 `bizLookup` → **lan-assist 本机 state**，不是 `business_connections` 那一行 |
| 设置 → 存储与数据 → **存储状态 → 前端兼容缓存 · 过渡中** | **纯静态 UI**，和上面三张表/接口无关 |

和 **pending 胶囊**：只有「业务连接器 / connections」那条线跟 `pending` 有关；**「过渡中」不是 pending 的另一种写法**，除非以后有人故意绑在一起——**当前代码没有绑。**

---

## 4. 键名 `scene-39-workstation` 从哪来？

1. **Zustand 持久化名**（权威定义）  
   `src/store/app.ts` 里 `persist(..., { name: 'scene-39-workstation', storage: createJSONStorage(() => localStorage), version: 17, partialize: ... })`  
   浏览器里实际键名就是 `name` 字段；值是 JSON，只持久化 `partialize` 列出的字段（面板、抽屉、工作区、IM/AI 草稿等）。大段业务 demo 数据在 v13 迁移里已从持久化里删掉，改由运行时/SQLite 侧承载，但 **persist 名没改**。

2. **与仓库/场景命名一致**  
   - `package.json` → `"name": "scene-39-personal-workstation"`  
   - 种子工作区 id → `scene-39`（`src/data/seed.ts`）  
   localStorage 键用短名 `scene-39-workstation`，是壳层 persist 的固定字符串，不是运行时下发的。

3. **设置页硬编码**  
   说明文案和「导出账户数据」里的 `getItem('scene-39-workstation')` 与 store 的 `name` **手动对齐**；改键名要同时改 `app.ts` 和 `Settings.tsx`（以及用户浏览器里旧键的迁移，若要做的话——**当前没有自动迁移键名**）。

---

## 代码锚点（便于自己点进去）

- 静态「过渡中」卡：`src/pages/Settings.tsx`（`section === 'data'` → 「存储状态」）
- 真实写入 localStorage：`src/store/app.ts` → `name: 'scene-39-workstation'`
- 活诊断（本页调用但未驱动这张卡）：同文件 `useEffect` 在 `section === 'data'` 时 `diagnoseRuntime()`

---

## 和 Ace 问题的直接对应

- **为什么设置了存储状态还显示这句？** → 因为「存储状态」大部分是**产品说明 + 装饰标签**，不是「当前存储健康仪表」。
- **迁移做了会不会自动不显示过渡中？** → **不会**，除非改代码。
- **和首页/连接器乱象是不是一回事？** → **不是**；那是 SQLite / connections API；这是设置页静态 copy。

---

## 建议：删那张子卡，还是改？（Ace 2026-09-25）

### 结论

**改，不要删。** 去掉假标签「过渡中」，把文案改成「浏览器壳层还在用这个键」——**别再说任务/对话的权威还在 localStorage**（v13 起已经不持久化那些字段了）。

整张子卡删掉不合适：键仍在每次进站写入，「导出账户数据」「重置前端 demo」也指着它；删 UI 不等于停用 persist，只会让人以为没有浏览器侧存盘。

---

### `scene-39-workstation` 现在还是不是「真页面」的权威？

**不是事务权威，但是壳层还在靠它恢复。**

| 数据 | 权威在哪 | 还会写 `localStorage['scene-39-workstation']` 吗 |
|------|----------|--------------------------------------------------|
| 任务 / 日程 / 工作流 | 运行时 SQLite（`hydratePlan` → `listTasks` / `listEvents` / `listWorkflows`，增删改走 `runtimeApi`） | **否**（v13 `migrate` 已从 persist 剔除） |
| AI 会话列表与消息 | 运行时（`AI.tsx` → `listAiSessions` 等） | **否**（会话正文不在 persist） |
| IM 消息 / 联系人 / 话题 | 运行时 + 内存 store；刷新后不靠这个键恢复聊天记录 | **否** |
| 业务原型表 `businessTables` | 内存；`DataDrawer` 等读 store，不 persist | **否** |
| 侧栏/面板布局、`drawers`、`floating` 浮窗 | **浏览器 persist** | **是** |
| 工作区列表、`activeWorkspaceId` | **先读 persist**，进站后 `IMScreen` / `AI.tsx` 还会 `replaceWorkspaces` 跟运行时对齐 | **是**（列表会写回键里） |
| IM 静音、`imComposerDrafts` / `aiComposerDrafts`、上次 `activeAiSessionId` | **浏览器 persist**（草稿与「回到哪条会话」） | **是** |

仓库里除 Zustand 外，**没有**别的业务页再单独 `localStorage.setItem`（全仓 TS 只有 `app.ts` persist + 设置页导出）。

`app.ts` 文件头仍写「统一来源,持久化到 localStorage」——对**整块 store** 过时了；**实际 `partialize` 只落壳层字段**（见 `name` + `partialize` + `version: 17`）。

---

### 为什么选「改」不选「删」

1. **还有人靠这个键**：不是业务权威，但是布局、工作区选择、输入草稿、上次 AI 会话指针——删卡不改代码，用户清缓存仍会丢这些体验。
2. **当前卡在说假话**：「尚未迁移页面和离线原型状态」+「过渡中」暗示任务/对话还在迁；代码上大业务块已在 v13 从 persist 拿掉，**假进度标签应删**，说明应改成壳层清单。
3. **删子卡不解决问题**：蓝条仍写「任务、对话…保留在浏览器缓存」——同样偏旧；若只删灰卡、不改蓝条，叙事仍不一致（改卡是最小、说真话的一步）。

---

### 若改文案，建议对齐的事实（给 implementer，不是本问要动代码）

- 标题：别叫「前端兼容缓存」也可改成「浏览器壳层状态」或「布局与草稿（localStorage）」。
- 标签：去掉「过渡中」；可改为无标签，或中性「本机浏览器」——**不要**暗示迁移百分比。
- 正文一句：键名 `scene-39-workstation`；存面板/浮窗/工作区与草稿；**任务、计划、AI/IM 正文以 SQLite / 运行时为准**。
- 与「语义记忆 · 独立权威」那张并列仍然合理；与「重置前端 demo」按钮语义一致。

**只有**在同时打算去掉 Zustand persist、或把壳层也迁走之后，再考虑**删整张灰卡**（并改导出/重置文案）；那是另一刀，不是「迁移已完成」的现态。

---

## 要怎么改？键名是什么？新环境还用吗？（Ace 2026-09-25）

### 结论

1. **改法**：灰卡换成下面「可点头原文」——**去掉「过渡中」**；标签改成中性 **「本机浏览器」**（或不要标签）。
2. **`scene-39-workstation`**：源码里**写死的** Zustand persist 桶名，**不是**你当前工作区的名字；JSON 里才存 `workspaces` / `activeWorkspaceId`。
3. **新 clone / 新机器 / 换工作区**：只要跑的是这份前端，localStorage 键**仍然叫** `scene-39-workstation`；**两台机器不会抢**——各浏览器各一份，按「网站来源（协议+域名+端口）」隔离。换工作区只改 JSON 里的 `activeWorkspaceId`，**不改键名**。

---

### 1. 设置页灰卡：建议改成哪几句（implementer 可直接贴进 `Settings.tsx`）

**标题（`font-medium` 那一行）**

> 浏览器壳层状态

**正文（`text-xs text-ink-muted` 那一行，键名仍用现有 `<code>` 样式包 `scene-39-workstation`）**

> 键名 `scene-39-workstation`，只在本机浏览器里保存界面状态：侧栏与面板怎么开、浮窗位置、工作区列表与当前选中、IM 静音、IM 未发送草稿、上次打开的 AI 会话 id。任务、日程、工作流、AI/IM 聊天记录、业务操作与审计在本机 SQLite / 运行时里，**不在这个键里**。

**右侧标签（替换琥珀「过渡中」）**

> `<Tag kind="blue">本机浏览器</Tag>`  
> （若希望和「语义记忆 · 独立权威」对称就用蓝标；也可以**不设标签**，只留标题+正文。）

**明确不要再用**

- 「前端兼容缓存」作标题（容易让人以为还在迁业务数据）
- 「仅用于尚未迁移页面和离线原型状态」
- 「过渡中」

**同页可选一句（非必须，只当蓝条仍写「任务、对话还在浏览器缓存」时）**  
蓝条可收成一句事实，避免和灰卡打架，例如：「事务数据在本机 SQLite；浏览器里只剩壳层状态（见下）。」——**只改灰卡也能先止血**。

---

### 2. `scene-39-workstation` 在 persist 里干什么？

| 持久化字段（`partialize`） | 存什么 | 谁在读 / 谁写 |
|---------------------------|--------|----------------|
| `panels` | 各功能面板 closed/tab/half/full、宽度、角标等 | 全壳 `IMScreen`、`StagePanel`、`ThumbnailStack`、路由进面板时 `togglePanel`；刷新后恢复你上次怎么开的侧栏 |
| `drawers` | 旧抽屉 visible/width（兼容层，会映射到 panels） | `setDrawerVisible` 等；与 panels 联动 |
| `floating` / `floatingZTop` | 撕出的浮窗坐标、尺寸、叠放顺序 | `FloatingPanel`、`AppFloatSurface` |
| `workspaces` | 工作区对象数组（id、name、cwd 等） | `WorkspaceSwitcher` 展示；进站 `IMScreen` / `AI.tsx` 用 `replaceWorkspaces` 跟运行时列表合并后再写回 |
| `activeWorkspaceId` | 当前选中的工作区 id | `Data.tsx`、`AI.tsx`、`runtime-api` 解析 cwd、`hydratePlan`、业务连接/操作列表等 |
| `imMuted` | IM 是否静音 | `Settings` 通知区、`setIMMuted` |
| `imComposerDrafts` | 各 IM 线程输入框未发送文字 | `IMWorkspace` 输入栏；`app-platform` 拟回灌字 |
| `aiComposerDrafts` | 按 chatId 存的 AI 草稿 | 目前几乎只有 store 定义，**无页面在读**；仍会进 JSON（历史字段） |
| `activeAiSessionId` | 上次选中的 AI 会话 id | `AI.tsx` 恢复会话；`RecordsPanel` 和业务 sheet 跟会话挂钩 |

**机制**：Zustand `persist` 在 `src/store/app.ts` 里 `name: 'scene-39-workstation'` + `version: 17`；状态一变就整包 JSON 写入 `localStorage`。启动时先 `merge` 进内存 store，再由各页去拉 SQLite / 运行时补任务、会话等。

**名字从哪来**：仓库代号 scene-39（`package.json` 的 `scene-39-personal-workstation`），**不是**运行时下发的，也**不会**因为你把工作区从「fdex测试1」换成别的而改名。

---

### 3. 新环境、换工作区：键还叫这个吗？会抢名吗？

| 场景 | 键名 | 说明 |
|------|------|------|
| 新 `git clone` 后 `pnpm dev` | 仍是 `scene-39-workstation` | 来自源码常量；第一次打开该端口时 localStorage 里没有这条，会新建空壳 JSON |
| 另一台 Mac / 另一浏览器 | 仍是同名键，但**各存各的** | localStorage 按「来源」隔离（如 `http://127.0.0.1:5174`）；A 机不会覆盖 B 机，除非你用浏览器账号同步把扩展数据同步过去（那是浏览器行为，不是产品设计的「抢锁」） |
| 同一浏览器换端口（5174→别的） | **另一套** localStorage | 键名字面相同，但属于不同来源，**互不相干** |
| 应用里切换工作区 | 键名不变 | 只更新 JSON 内的 `activeWorkspaceId`（和 `workspaces` 列表）；事务数据跟 `workspaceId` 走 SQLite，不跟键名走 |
| 本机 SQLite / `fde-workstation.sqlite` | **无关** | 库路径在 runtime 配置里；和 localStorage 键名无对应关系 |

**导出**：设置「账户」里的「导出账户数据」下载的是**当前浏览器**里这条键的 raw JSON（文件名 `fde-x-shell.json`），不是 SQLite；**没有**对称的「导入」按钮。

**重置**：「重置前端 demo」走 `resetDemo()`，清内存并依赖 persist 写回；语义是清壳层/demo，**不删** SQLite（按钮文案已说明）。

---

## 为什么还要留着 `scene-39-workstation`？（Ace 纠正：不是灰卡文案问题）

### 结论（一句人话）

**不是业务上「必须叫 scene-39」、也不是 SQLite 迁不动才卡在这个名字上**——是**壳层界面状态至今只实现了浏览器 persist 这一条路**，键名是当年 scene 代号写进源码的**习惯用名**；**可以换名、也可以迁库，但还没人做**，所以桶还在。

---

### 1. 这个桶现在还「挡」着什么？

**挡不了事务迁移。** 任务、计划、AI/IM 正文、业务操作已经在运行时 SQLite 里走自己的 API；和 localStorage **并行**，不互斥。留着它不会让 SQLite「少迁一块」。

**挡的是：如果你现在删掉 persist（或清掉这个键）而没有替代实现**，刷新/重开页面会丢的是 **partialize 里那 10 个字段**，不是业务库：

| 会丢的 | 具体体感 |
|--------|----------|
| 布局 | 侧栏/面板回到默认 closed/tab；浮窗位置与叠放顺序没了 |
| 工作区 | `workspaces` / `activeWorkspaceId` 没了；进站后要靠 `IMScreen` / `AI.tsx` 再 `listAiWorkspaces` 拉列表，**当前选中可能回到默认第一个**，和上次不一致 |
| 草稿 | IM 各线程输入框未发送字（`imComposerDrafts`）没了 |
| 上次会话 | `activeAiSessionId` 没了；AI 页、业务 Records 跟会话绑的逻辑要重新选会话 |
| 其它壳层 | `imMuted`、`drawers` 兼容态、`aiComposerDrafts`（几乎无 UI 读，但仍会落盘） |

**不会丢的**：SQLite 里的任务/日程/工作流、AI 会话与消息、IM 持久化（若有）、`business_connections`、lan-assist 的 `state.json`、语义记忆——**都不在这个键里**。

**换掉名字（不改结构）**：Zustand 只认 `persist` 的 `name` 当 localStorage 键。改成别的字符串后，**旧键里的 JSON 不会被自动读**（当前没有 `name` 迁移逻辑），效果等同「壳层恢复出厂」一次；全仓只有 `app.ts` 和设置页导出硬编码了这个字符串，**运行时/BFF 不查这个键名**。

---

### 2. 名字为什么是 scene-39？

| 说法 | 对不对 |
|------|--------|
| 历史代号写死在源码 | **对**。`persist({ name: 'scene-39-workstation' })` + 设置导出 `getItem('scene-39-workstation')`；与 `package.json` 的 `scene-39-personal-workstation`、种子里的 `scene-39` 同一套命名习惯。 |
| 现在还必须叫 scene-39 才能跑 | **不对**。没有任何服务端契约、迁移脚本或第三方依赖这个字面量；换中性名（如 `fde-x-shell`）只要改前端常量并（可选）读一次旧键做导入。 |
| 等于当前工作区名称 | **不对**。工作区叫「fdex测试1」也好，id 是 UUID 也好，**都不参与** localStorage 键名；键是「整站一个桶」，桶里再用 `activeWorkspaceId` 区分。 |

---

### 3. 能不能迁到 SQLite / 换成中性键名？代价？必须留还是没人改？

**能，但都是工程选择，不是现网硬约束。**

| 方向 | 代价（人话） | 结果 |
|------|----------------|------|
| **换中性键名** | 小：改 `name` + 导出按钮字符串；若要保留老用户布局，加一次「启动时读旧键、写入新键」 | 名字不再带 scene-39；行为不变 |
| **壳层迁进 SQLite** | 中：要在 runtime 增偏好/壳层表或 KV、启动时先 hydrate 再渲染（避免闪默认布局）、处理多浏览器 profile 与「壳层跟本机浏览器还是跟账号」产品定义 | 可去掉 localStorage 依赖；**与事务库同文件但不同表**，不是「业务没迁完才留着」 |
| **直接删 persist** | 最小 diff，**最大体感回退**：每次刷新像第一次打开壳层 | 仅当接受不保存布局/草稿/上次会话 |

**必须留吗？**  
- **必须留「某种壳层持久化」**——若产品仍要刷新后保留面板、草稿、上次 AI 会话，就得有 persist 或等价存储；  
- **不必须留「localStorage + scene-39-workstation」这个具体形态」**——这是当前唯一实现 + 历史键名，**不是**架构上退不掉的锁。

**一句收束：**留着是因为 **还没把壳层迁走、也没改名收口**，不是因为 scene-39 这个名字或这个桶在挡 SQLite 或挡业务正确性。
