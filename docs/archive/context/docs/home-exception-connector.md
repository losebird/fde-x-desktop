---
cursor:
  subagentId: "bc-d7ca08dd-da56-5309-ae79-91b8ccf5f3c7"
---

# 首页那个 1，和适配器为什么还写着待启用

**那个 1 是一条演练改行，没打到 NocoBase。页面上没有可点的那一行。** 适配器仍是待启用，是因为库里的 `status` 从种下去就是 `pending`，后来的现查、改行都不改这个字段。

工作区是顶栏 **fdex测试1**（`1985293d-03bb-496f-ad69-5c7f2ac23149`）。全库只有这一格同时是「1 条操作、其中 1 条算异常」。BFF **63367** 听 4318，DSH **63427**。只看，没改。

## 那个 1 是什么

首页「业务应用」四张卡里，大红字是异常条数，小字是操作总条数。这次碰巧都是 1。

大红字只数 `state` 属于这三样的操作：`failed`、`uncertain`、`compensation_failed`。这一条是 **`uncertain`**（代码里的中文是「结果待确认」）。小字「1 次操作留有记录」是这一格里的操作一共几条，不是又一条异常。

这一条：

| | |
|---|---|
| 操作 | `op_f1a87c38fa9640538ba21e09db2718eb` |
| 关联 | `corr_75841ac8a5d6461c831e6bfc446e3a7a` |
| 动作 | `record.update`（改行） |
| 对象 | 工单 `TK20260305892` |
| 想改成 | `status` = `approved` |
| 模式 | `dry_run`（演练，不写外部系统） |
| 时间 | 2026-09-17 21:18:20 记下，21:18:29 本机点了确认，21:18:36 演练结束 |

演练回执写的是：计划对过了，**没有调用外部业务系统**。审计里这次演练的结果是成功（`operation.dry_run` / `succeeded`），事件名也是 `operation.dry_run_succeeded`。但代码在演练结束时把操作状态写成 `uncertain`，不是 `succeeded`。首页把 `uncertain` 算进「异常待处理」，所以红字是 1。

这不是 NocoBase 写失败，也不是今天的现查/改行。`biz_write_audit` 里没有单号 `TK20260305892`。

## 去哪点开这一条

**点不开。** 红卡本身不是按钮。

「操作记录」那个页签是另一本账。它列的是局域网适配器的写入痕迹（今天能看到客户改行 `CUST2056`、费用报销过审 `EXP20251224598` 这些），一共 28 条，里面没有 `TK20260305892`，也没有 `op_f1a87c38…`。不要在那一页按单号找。

这一条只活在操作表里。接口是：

`GET http://127.0.0.1:4318/api/v1/operations/op_f1a87c38fa9640538ba21e09db2718eb/trace`

界面没有调用这个接口的地方。「结果待确认」这几个字写在 `Data.tsx` 里，没有画到任何一行上。

## 为什么适配器还是待启用

右卡「局域网业务协作适配器」和首页「系统连接 1，0 个已接通」，看的是同一个字段：

**`business_connections.status`**

必须是字符串 **`connected`** 才显示「已接通」。现在这一行是 **`pending`**，所以胶囊是「待启用」，已接通是 0。连接一共 1 条，就是它。

| | |
|---|---|
| id | `conn_lan_assist` |
| 挂在 | `ws_personal`（fdex测试1 列表会带上它） |
| name | 局域网业务协作适配器 |
| provider | `lan-assist` |
| status | **`pending`** |
| lastHealth | `state: detected`，备注「已发现源码入口，真实调用适配尚未启用」 |

这行是第一次建库时种进去的，用的是「已有就别覆盖」。全仓库没有一处把 `business_connections.status` 改成 `connected`。现查、改行走适配器进程，写进 `biz_write_audit`，不碰这个 `status`。所以 NocoBase 已经在读写，胶囊还是待启用。

旁边那份连接器接口（`/api/v1/mcp/servers`）里，同一条现在是 `lookupRegistered: true`、`online: true`。首页胶囊不读这两个字段。

## 从哪读

首页「系统连接 / 0 个已接通」和右边「待启用」是同一次请求，不是两次。

1. 正在跑的页面（Vite 5174 编出来的客户端）直接打 **`GET http://127.0.0.1:4318/api/v1/business/connections?workspaceId=1985293d-03bb-496f-ad69-5c7f2ac23149`**。BFF 是进程 **63367**。刚才这条返回的就是 `conn_lan_assist`，`pending`。
2. 4318 打开的库文件是 **`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation/runtime/data/fde-workstation.sqlite`**。表 `business_connections`，行 `id = conn_lan_assist`（挂在 `ws_personal`）。这一格的 `status` 就是 `pending`。`created_at` 和 `updated_at` 都是 **2026-09-13 16:25:13**（北京时间），之后没人改过。
3. 这个 `pending` 是 **`runtime/db.mjs` 里的 `seedRuntime`** 在第一次打开这个库时写进去的（`INSERT OR IGNORE`，写死 `'pending'`）。同一秒，迁移 `003_business_operations.sql` 刚建好这张表。以后每次启动还会再跑这段种子，但「已有就跳过」，所以不会改掉。
4. 不是 NocoBase，也不是适配器在不在线。NocoBase 的现查/改行不写这张表。适配器在线看的是另一条接口 `GET /api/v1/mcp/servers`，那边现在是 `online: true`。首页没用那条。

## 设置里那张表不是这一行

不是从「设置 → 存储与数据 → 业务连接器」读的。那张表和首页胶囊是两处。

打开那一页时，表单打的是 `GET http://127.0.0.1:4318/api/v1/im/state`，把里面的系统、环境、地址填进输入框。刚才活数据就是截图上那三格：系统 NocoBase，环境 生产，地址 `http://127.0.0.1:13000`，而且已经有 API Key。这些写在 **`/Users/zxz/.dsh-fde-x/lan-assist/state.json`** 的 `lookup` / `lookups` 里。API Key 在同目录 **`secrets.json`** 的 `lookupToken`，不进 SQLite。

点「保存连接」打的是 `POST /api/v1/biz/lookup`，再交给局域网适配器记下。它改的是上面那个 json：系统、环境、地址、方言 `nocobase`。API Key 进 `secrets.json`。账号和密码不落库。它不写 `business_connections` 的任何一列，也不会把 `status` 改成 `connected`。

刚才再查那一行：`status` 仍是 `pending`，`config_json` 仍是 `{}`，`credential_ref` 是空的，`updated_at` 仍是 2026-09-13 16:25:13。首页胶囊只看这一格的 `status`，不看设置表单里的系统、环境、地址、API Key。所以表单已经填好，胶囊还是待启用。

## 为什么灯和钥匙不在一本账上

**同一个人先后做了两套，钥匙故意不进工作台的账，灯该跟着钥匙亮这件事写了但没接上。** 不是两拨人各记各的。

工作台自己的账（首页那盏灯）是给「业务应用」首页用的。2026-09-13 16:25 这台机器第一次建库时，就种了一行「局域网业务协作适配器」，状态写死待启用，旁边注明「源码入口找到了，真调用还没开」。仓库里这段和首页「待启用」胶囊一起出现在 2026-09-17 的基线提交 `a8449148`（losebird，标明截至 9 月 16 日）。这盏灯当时的意思是：工作台这边的适配器还没启用，别拿工作台的账去冒充已经写进业务系统。规格第 9 节写明：首页只展示状态，启用入口在设置。

钥匙是给现查、改行用的。业务真账规定在局域网适配器里，不准写进工作台的 SQLite。所以设置里「保存连接」从同一份基线就有，只把系统、环境、地址和 API Key 交给适配器自己的 `state.json` / `secrets.json`。口令不进工作台账，这是故意拆开的。

中间本该有一缝：规格 0.5 写过，首页胶囊只表示「钥匙和词表已经配好，而且能描述业务型」。对抗审查把这件事记成未做：「Data 胶囊未接三态 ③」。另有一条 `GET /api/v1/biz/connections`（9 月 17 日已在，搬家提交写明不改行为）会在旁边附上适配器是否在线，但既不改那盏灯的 `status`，首页也根本不调它。保存连接和健康检查都没有把 `status` 写成已接通。全仓库没有这种更新。

所以钥匙能开 NocoBase，灯还停在 9 月 13 日那句「还没启用」。差的是没把灯接到钥匙上，不是又配了一套钥匙。
