# NATS 作协助插件公网中继：核对笔记

> 对照用户方案（NATS Server + JetStream + Object Store + Caddy WSS + 设备 JWT）。  
> 代码核对：本仓库 `secretary.js` / `index.js` / `lan.js` / `pair.js` / `envelope.js` / `listen.js` / `home.js`。  
> NATS 能力以官方文档为准，不把“能当消息队列”写成“已经是 IM”。

## 结论

NATS + JetStream **适合**做自建公网投递底座：双方无公网 IP、只需出站 WSS、离线队列、至少一次投递、大对象分块，都在官方能力范围内。许可证是 Apache-2.0（[nats-server](https://github.com/nats-io/nats-server)、[nats.js](https://github.com/nats-io/nats.js)）。

但它 **不是 IM**。已读、撤回、配对、端到端密钥、工作区绑定、去重后的界面，都必须留在插件。用户方案的大方向对，下列点必须改，否则第一版会把“中继已收下”显示成“对方已收到”，或把配对卡死在 NAT 后的同步 HTTP 上。

## 1. 仓库现状（方案里写对的和写漏的）

写对了：

- `createSecretary()` 注入 `send`，HTTP 没有写死在 secretary 里。[secretary.js](../secretary.js)
- 当前注入的是局域网 `postFrame`。[index.js](../index.js)
- 配对是 X25519 + 口头六位码，密钥不离本机。[crypto.js](../crypto.js) [pair.js](../pair.js)
- 听口是独立进程，不能和插件同时占 LAN 口。[listen.js](../listen.js)
- 单附件 200MB、合计 500MB。[home.js](../home.js)

写漏了或会踩坑：

1. **当前 `send` 是请求-响应，不是投递。** `postFrame` 默认等 60 秒，配对 `handshake()` 依赖返回体里的 `offer` / `peerId`。[lan.js](../lan.js) [pair.js](../pair.js)  
   公网双方都在 NAT 后，这个同步往返不存在。Transport 若只暴露 `send({to, frame}) -> {ok}`，配对会断。
2. **当前 `delivered` = 对端 HTTP 200。** `flushOutbox` 在 `sent.ok` 时写 `row.delivered`。[envelope.js](../envelope.js)  
   这最多等于“对端进程当时接住了”，不是“已落盘”。方案里的四级状态必须替换这个字段，不能复用同名。
3. **入站已经有 nonce 去重**（`noteSeen` / `REPLAY`）。[index.js](../index.js)  
   JetStream 至少一次投递要叠在这层之上，不能只靠 `Nats-Msg-Id`。
4. **信件模型很深**：`requests` + `replies`、1:N 信封、未读撤回、听口按 `requestId` 落盘。IM 迁移是第二份发布，不是改个表名。

## 2. NATS 能提供什么

官方能力与本方案的对应：

| 需求 | NATS | 必须自建 |
|---|---|---|
| NAT 后出站长连接 | WebSocket 客户端（[nats.js](https://github.com/nats-io/nats.js)）；服务端开 websocket | 插件里连 WSS |
| 离线再投 | JetStream 持久化 + durable consumer | 每设备一个 consumer，DSH 与听口互斥 |
| 至少一次 | JetStream ack / 重投 | 接收端按 `deliveryId` 幂等 |
| 短窗去重 | `Nats-Msg-Id` + duplicate window（默认约 2 分钟，见 [JetStream headers](https://docs.nats.io/reference/2.11/jetstream/api/headers)） | 本机长期去重表 |
| 大附件 | 默认单条 payload 约 1MB，必须走 [Object Store](https://docs.nats.io/learn/object-store/) 分块 | 先 E2E 再上传；指针进收件箱 |
| 设备权限 | NKey / 用户 JWT + subject 授权 | 邀请码、吊销、Enrollment |
| TLS 443 | 可用 NATS 原生 websocket TLS，或反代 | 反代闲置超时要按长连接配 |

服务端看不到明文，前提是：**先加密签名，再 publish / put object**。Object Store 仍能看见随机 ID、密文大小、时间。这是流量元数据，方案里应写明可接受。

## 3. 必须改的设计

### 3.1 发送策略：禁止“先 LAN 等满 60 秒再 NATS”

同一局域网优先直连是对的，但探测必须短（约 1～2 秒）。门牌陈旧或 lastHeard 超过几十秒，直接走 NATS。禁止双发。去重靠 `deliveryId`。

推荐：

```text
peer.door 是私网 且 lastHeard 很近 → LAN 短超时 → 失败转 NATS
否则 → 只走 NATS
```

LAN 故障不影响已配对同事的公网投递；NATS 故障时 LAN 同事仍可直连。这与验收条一致。

### 3.2 配对必须改成异步帧（公网路径）

保留口头六位码、十分钟、五次、人工点接受。但 `hello` 不能再当 HTTP 响应。

LAN 可保留同步握手当快路径。公网只用 JetStream 上的 `pair.offer / challenge / confirm / accept`。  
邀请链接只带 `relay` + `target设备` + `session`，**不带六位码**。这一条保留。

听口在 DSH 关闭时对 `hello` 只挑战、不落盘。[listen.js](../listen.js) 公网配对必须 DSH 开着才能点接受；方案要写清，不要假装听口能完成人工配对。

### 3.3 中继注册 ≠ 同事配对

必须分开。设备 JWT 只证明“可以连我的服务器”。同事密钥仍是 X25519 + 口头码。

权限建议收得比“可向任意 inbox 发布”更紧：

- `sub`: 仅 `dsh.v1.inbox.<deviceId>`
- `pub`: `dsh.v1.inbox.*` **加上严格限流**；配对帧另走 `dsh.v1.pair.<sessionId>`，短 TTL
- 禁止管理、监控、`$JS.API.>` 除必要的 consumer ack / object 自己的桶

任意设备可向任意 inbox 灌密文，会造成磁盘和 CPU 拒绝服务。E2E 签名挡的是解密，挡不住垃圾。Enrollment 必须有连接数、发布速率、Object 配额。

设备身份用 NATS 官方 operator / account / user JWT 链（nsc 或 auth callout），不要在插件里塞共享密码，也不要自造一套与 NATS 不兼容的 JWT。

### 3.4 四级状态不要复用现字段

| 新状态 | 含义 | 现有字段 |
|---|---|---|
| queued | 本机已落盘未出门 | `status=queued` |
| relayed | JetStream 已持久化 | **新**。不是现在的 `delivered` |
| delivered | 对端已校验并落盘，回了签名 `delivery_ack` | **新** |
| read | 对端打开，现有 `ack` | 可继续叫 ack，但 UI 文案是已读 |

撤回仍是一条签名帧，不是删 JetStream 消息。对方已读则不能撤，与现在一致。

`deliveryId = messageId + recipientId + messageVersion` 作为 `Nats-Msg-Id` 和本机幂等键，这一条保留。JetStream 去重窗口短，本机 `seen` 必须长期。

### 3.5 大对象

256KB 以上进 Object Store、收件箱只放指针：合理。  
必须：加密帧整体上传；下载后校验 sha256；校验失败不 ack；对象 14 天过期。  
必须加：**每设备配额**。否则几份 200MB 就会打满 50GB 盘。本地 90 天记录不删。

### 3.6 听口与 durable consumer

同一 `durable` 不能两进程同时拉。规则保留：DSH 开着由插件消费；关掉且开启听口由 listener 消费；切换时先停一方再接管，再导入 `listen-inbox`。  
用文件锁锁死。NATS 重连不等于 ack。进程崩溃未 ack 会重投，界面靠幂等。

### 3.7 Caddy

Enrollment HTTP 可以走 Caddy。NATS WSS 优先 NATS 原生 TLS websocket；若反代，必须加长 idle / 关闭缓冲请求体限制，并验证 200MB 分块上传不被 60s 杀掉。不要假设“443 反代一下就行”。

### 3.8 工作区

NATS 设备是机器，不是工作区。密文里必须带工作区。中继按设备投递；工作台按工作区过滤对话。禁止用中继当全公司一张收件箱。

### 3.9 明确仍不做（第一版）

多设备漫游同步、云端明文历史、服务端搜索、音视频、公开注册、联邦、中继参与解密。  
第一版一台电脑一个 deviceId；笔记本和台式机是两台设备、两次配对。

## 4. 与 IM 模型迁移的关系

通信层先稳定，再迁 Conversation / Message。同意。

迁移时：

- 每个旧 `request` → 一条 Message
- 每条 `reply` → 独立 Message（`replyTo` / `threadRoot`）
- 拟回、采纳、交接、待办、档案、业务确认全部改引用 `messageId`
- 兼容投影让 `inboxOf()` 先读新模型
- 备份旧 `state.json`，写数据版本；失败可回读旧文件

在 Transport 未完成前不要迁模型。信件模型能跑通公网，比半套 IM 加半套 NATS 安全。

## 5. 发布切分（修订后）

1. 抽出 `onFrame` + `LanTransport`，LAN 行为与测试不变。  
2. 配对公网路径改异步（可先只在测试中用内存总线验证）。  
3. 单节点 NATS + 设备邀请码 + 文本帧 + 四级状态。  
4. Object Store、配额、听口接管、吊销。  
5. **此时 A/B 家里可通信。**  
6. 再迁 IM 模型。  
7. 限流、备份、监控、镜像钉扎、三系统安装验证。

业务闸、语义投影、工作台壳仍按 `docs/employee-workbench.md` 的第 1～4 段推进；中继是协作模块的增量，不替代闸。
