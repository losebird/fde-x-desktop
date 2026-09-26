---
cursor:
  subagentId: "bc-338efcf7-c150-564a-88c4-6ea5dfef7b3d"
---

# 运行环境诊断里「IM 与业务系统操作」为什么还是待接通

## 结论（先看这句）

**不是 NocoBase 没配好，也不是现查/改行/过账没跑通。** 这行读的是 **`GET /health`** 里 `adapters[]` 中 `capability === 'im-business-adapter'` 的 **`state`**。后端 **`inspectAdapters` 对 IM 只查本机有没有装 `dsh-lan-assist` 目录**；只要装了就固定返回 **`degraded`**，文案写死「插件已安装，运行时调用尚未接通」。前端把 **`degraded` 显示成琥珀「待接通」**。  
**代码里从未给 IM 这一 capability 赋 `healthy`**，所以和 lookup、写账、首页灯是不是变绿**无关**——**「重新检查」只会再扫一遍目录，正常用法下会一直待接通**（只有卸掉插件才会变红「不可用」）。

---

## 1. 这行读哪个接口、哪个字段？

| 步骤 | 是什么 |
|------|--------|
| 页面 | 设置 → **运行环境** →「运行环境诊断」 |
| 请求 | **`GET http://127.0.0.1:4318/health`**（经 Vite 同源也是 `/health`） |
| 触发 | 进入「运行环境」或点 **重新检查** → `runtimeApi.health()` |
| 用的字段 | 响应 **`adapters`** 数组里 **`capability: "im-business-adapter"`** 那一项的 **`state`**、**`detail`** |
| 标签 | `Settings.tsx` 的 `RuntimeRow`：**只有 `state === 'healthy'` 才显示「正常」**；`unavailable` →「不可用」；**其余（含 `degraded`）→「待接通」** |

**是不是活健康检查？**  
**半活。** 每次请求都会跑 `inspectAdapters`，但 **IM 分支没有**像 AI（`aiRuntime.status().connected`）或语义记忆（`semanticOs('/ready')`）那样打运行时。  
**IM 实际只做了：** `access(F_OK)` 看路径  
`~/.dsh-fde-x/profiles/fde-x/node_modules/dsh-lan-assist`（或 `FDE_DSH_HOME` / profile 对应目录）**是否存在**。

存在 → **`state: "degraded"`**，**`detail` 固定拼接**：  
「IM 与业务系统操作能力的防腐适配入口；**插件已安装，运行时调用尚未接通**」。  
不存在 → `unavailable` +「未发现本机安装」。

源码锚点：`runtime/adapters.mjs` 第 29–33、100–107 行；`/health` 组装在 `runtime/server.mjs` 约 1008–1024 行。

页顶说明「不把发现源码误报成已经接通」——AI/语义有活探针；**IM 被做成「装包 = 待接通」的固定档位，且没有「已接通」档位**。

---

## 2. 和首页胶囊、业务连接器表单、存储状态是不是同一本账？

**不是。** 四块各读各的；只有「业务连接器 / 首页灯」和 lan-assist **语义相近**，但 **运行环境这行不读它们**。

| 你看到的 | 读什么 | 和 `/health` IM 行关系 |
|----------|--------|-------------------------|
| **运行环境 · IM 与业务系统操作** | `GET /health` → `adapters[].state`（装包检测 + 固定文案） | **本行** |
| 首页「系统连接 / 待启用」胶囊 | `GET /api/v1/business/connections` → SQLite **`business_connections.status`**（拉列表前会 `refreshLanAssistConnectionLamp` 按 lan-assist `/state` **可能**把灯 sync 成 `connected`） | **不同接口、不同字段**；见 `home-exception-connector.md` |
| 设置 · 存储与数据 · **业务连接器**表单 | `GET /api/v1/im/state` → 本机 **`~/.dsh-fde-x/lan-assist/state.json`** 等 | **不同**；保存走 `POST /api/v1/biz/lookup`，不写 `/health` |
| 同页 **存储状态**（浏览器壳层 / SQLite 说明） | **静态文案**，见 `storage-compat-cache.md` | **无关** |

**不要混：** 表单里 NocoBase + API Key 配齐、甚至首页灯已被 `connection-lamp` 刷成「已接通」，**运行环境 IM 行仍可一直「待接通」**——因为 `/health` 根本没查 lookup、没调 `lanAssist('/state')`、没读 `business_connections`。

---

## 3. 现查、改行、过账都能走，为什么这行还说「尚未接通」？

真业务走 **BFF → `aiRuntime.lanAssist(...)`**（preview/write/lookup/catalog 等），和 **`inspectAdapters` 的 IM 分支没有接线**。

已有、但 **未接到 `/health` IM 行** 的活信号示例（别处在用）：

- `aiRuntime.lanAssist('/state')` 里的 lookup / catalog / `capabilities.connector`
- `runtime/biz/connection-lamp.mjs` 里的 `lanAssistAdapterHealthy`、`desiredLanAssistConnectionStatus`（给 **`business_connections` 灯**用，在 `GET /business/connections`、保存 lookup、`lan-assist-state-watch` 里调用）

**漏接的就是：`inspectAdapters` 在 `im-business-adapter` 上停在「目录存在 → degraded + 固定 detail」，没有复用 connection-lamp 或任何 lanAssist 探针。**  
所以：**运行时调用其实已接通，诊断仍显示「尚未接通」——是诊断实现落后，不是业务链路断了。**

---

## 4. 点「重新检查」会不会变？

| 情况 | IM 行标签 |
|------|-----------|
| `dsh-lan-assist` 仍在 profile `node_modules` 里 | **还是「待接通」**（`degraded`） |
| 卸掉/找不到该目录 | **「不可用」**（红） |
| 配好 lookup、过账成功、AI 已连上 | **仍不会变「正常」**——当前代码 **不会** 给 `im-business-adapter` 返回 `healthy` |

重新检查 = 再请求一次 **`GET /health`**，**不会**读 `im/state`、**不会**刷新 `business_connections`、**不会**因为刚做完一笔 write 而变绿。

---

## 和已有文档怎么对齐（不打架）

- **`home-exception-connector.md`**：首页数字/胶囊看 **操作表 + `business_connections`**；和本页 **`/health` adapters** 是两条线。首页灯有可能随 lamp 逻辑变；**本行不会跟着变**。
- **`storage-compat-cache.md`**：「存储状态」卡是静态说明；**本问是「运行环境」页的活请求**，但 IM 项在活请求里仍只做装包检测。

---

## 代码索引（自己点）

- IM 诊断逻辑：`runtime/adapters.mjs` → `inspectAdapters`
- `/health`：`runtime/server.mjs`
- UI 映射：`src/pages/Settings.tsx` → `diagnoseRuntime` / `RuntimeRow`
- 首页灯（非本行）：`runtime/biz/connection-lamp.mjs`、`GET /api/v1/business/connections`
