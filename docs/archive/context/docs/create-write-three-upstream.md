---
cursor:
  subagentId: "bc-4f471b38-6d66-541c-be0b-cdd0a2d18432"
---

# 这笔新建为什么会生出那三条

会话 `session-b1223c3a-e15d-4c0b-9a91-86860bbc6845`。只往上追一层。现网 checkout 与 `~/.dsh-fde-x/vendor/dsh-lan-assist` 里闸文件哈希一致（DSH 19:39 起的那份，未 reload）。直接原因见 [create-write-three-bugs.md](create-write-three-bugs.md)。

闸不按某张表的列名写死。过账看 **schema**（字段名、界面类型、`target`、`foreignKey`），现查键看 **词表 + schema 标题**，人话补槽看 **词表/图**。这一笔里这三份对不齐。

## 这一笔的词表、图、schema

`GET /api/v1/biz/kinds`（cwd = 该会话工作区）和 seq 19 / seq 84 的 `biz_describe` 一致。`GET http://127.0.0.1:13000/api/collections:list?fields=name,title,fields` 是 schema。

| | 词表 / 图 | schema |
|---|---|---|
| 这一型 | `fields` 只有 `ticketNo`、`单号`、`状态`；`aliases` 空 | 集合 `biz_tickets`。`title` 标题「工单标题」，`priority` 标题「优先级」（`high` = 高），`assignee` 标题「处理人」 |
| 人边上 | 没有指向 `users` 的边 | `assignee` 是 `m2o`，`target=users`，`foreignKey=assigneeId` |
| 图上有的边 | `客户 → 这一型`，字段 `customer` | `customer` 同样是 `m2o`，`target=biz_customers` |
| 目标集合 `users` | 型名仍是 `{{t("Users")}}`，列含 `nickname` / `username` / `email` | 列是 `username`、`nickname`、`email`、`phone`。没有 `name`、`title`、`code` |

`FIELD_SPEAK`（`write.js` 1830–1831）把字段名 `assignee` **说成**「负责人」。schema 标题是「处理人」。这张表只用于回执措辞，不把入口键收成字段名。

## 1. 处理人

### 展示 patch 带着口语过确认，过账却要目标行的 id

展示 patch 只按 **schema 字段名**留键，关系值仍是口语；令牌和 POST 走 `shapePatch`，`m2o` 非数字必须收成 `target` 上唯一的 `id`，收不到就丢掉该键，不把口语写进外键列。

- `plan.js` 129–149：`normalizePlan` 原样拷贝工具 `patch`，注释写明不从 speech 发明 patch。
- `write.js` 1081–1089：`displayPatch` 经 `schemaHasField` 滤键，再 `bindWritePatch` → `shapePatch` 得到 `writePatch`。
- `write.js` 1114–1124：令牌 `patch` 存 `writePatch`；返回对象在展开令牌之后用 `displayPatch` 盖住 `patch`。seq 67 工具结果因此是 `assignee=ace`，那是展示层。令牌里过账字节未落 jsonl，未证。
- `write.js` 2035–2045：`relationSchemaField` 认 `m2o` 后，值已是数字才写 `foreignKey`；否则 `resolveRelatedId`，有唯一 id 才写，没有就 `continue`（键消失）。
- `write.js` 1707–1711 与 1978–1988：过账 `postWrite({...token})`，body 再 `shapePatch(token.patch)`。确认面看的是被盖住的展示 patch。
- 这一笔 schema：`assignee` 是 `m2o` → `users`，外键列 `assigneeId`。口语过不了 `resolveRelatedId` 就不会出现在 POST。

### 外键 `$or` 含目标集合上没有的列，所以 400

`spokenResourceFilters` 在目标集合自己的等值列之外，**无条件**再拼 `name`（`$includes`）、`title`（`$includes`）、`code`（等值）。这三列不来自该集合的 schema。

- `relation-bind.js` 34–41：`users` 追加 `username` / `nickname` / `email` 等值，然后所有目标都再拼上面三列。
- `relation-bind.js` 63–76：整段 `$or` 打 `GET /api/{target}:list`。不看 HTTP 状态；`data` 不是恰好一行就返回空串。
- 现打同一段 `$or`（值 `ace`）：`400`，`Invalid SQL column or table reference`。`users` 列名单里没有 `name` / `title` / `code`。

### 「Ace Admin」收不成 id

人这一支只做 **整列等值**，不做子串、不做大小写折叠。昵称「Ace Admin」不等于口语 `ace`。上面的 400 让这一查根本不返回行；就算拿掉不存在的列，等值仍然是 0 行。

- 只等值 `username` / `nickname` / `email` = `ace`：`200`，0 行。
- `nickname` `$includes` `ace`：`200`，恰好 1 行，`id=1`，`nickname=Ace Admin`，`username=admin`。`spokenResourceFilters` 没有把 `$includes` 用在 `nickname` 上。
- 图上没有「这一型 → users」这条边（`biz_describe` 只有 `customer`）。模型无从先 hop 到人再填 id；工具说明只要求 patch 键是能改的列（`tools.js` 207）。

### 空令牌上的「负责人」没收成 `assignee`

patch 键不走 where 那条「标题 → 字段名」收口。键必须已经是 schema **字段名**（或备注/电话/地址那张小别名表）。「负责人」不是字段名，schema 标题是「处理人」，词表也没有这个别名，所以整张中文 patch 在绑定前被滤成 `{}`。

- `lookup.js` 1241–1262：`schemaHasField` 只认 `name`，外加 `FIELD_ALIASES`（备注、电话、地址）。没有「负责人」也没有「标题」。
- `where-pass.js` 247–298：`resolveShapeKey` 用 schema 标题（及 `title.includes`）收 **where** 的键。调用点在 where / 线索，不在 `normalizePlan` 的 patch。
- 对照：seq 82 的工具参数没有 `where`，seq 85 的表却带 `where` 键 `优先级`+`priority`、值 `high`。那是 speech「优先级是高」走了 where/枚举收口（`slots.js` `attachSpeechIdentity`，`plan.js` `bindPatchEnums` 只在键已经等于字段名时把「高」收成 `high`）。seq 58 的 patch 键是「标题 / 优先级 / 负责人」，三键都不是字段名，滤完是 `{}`（seq 60）。
- 就算 patch 走了 `resolveShapeKey`：「工单标题」含「标题」，「优先级」与标题相同，能收；「处理人」不含「负责人」，**仍然收不成** `assignee`。这一步未发生，标为对照，不是这次的执行路径。
- seq 66 的英文键是模型重发的（seq 65：「按表上的英文字段重发」），不是闸把「负责人」收成了 `assignee`。

## 2. 空行

### 同一次开口两枚新建令牌，第一枚 patch 是 `{}`

同一次人话里模型打了两次 `biz_preview`（都是新建、同一句 speech）。闸按「同会话 + 同动作 + 开口未过期」并成 **一个 opening**。新建在 patch 被滤空时仍发令牌。合并规则是「后一张的键要已出现在前一张 patch 上才覆盖」；前一张是 `{}`，后一张的键对不上，于是两枚都留下。

- seq 58 中文 patch → seq 60 `pv_23993019a2bca0a2`，`patch={}`，`openingId=session-b1223c3a-…:1790251155671:8e49a697`。
- seq 66 英文字段 patch → seq 67 同一 `openingId`，`lines` 两枚都在，`replaced=false`。
- `write.js` 1108–1119：动作是新建就 `tokens.set`。空 patch 拒发令牌只写在改行（`write.js` 1363、1633），新建没有这条。
- `gate.js` 350–381：没带 `openingId` / `trace_id` 时，同会话、同动作、未过 `OPENING_TTL` 就沿用上一开口。
- `gate.js` 14–23 `mergePreviewLines`：`nextKeys` 为空 **或** 与旧 patch 有公共键才替换，否则 `push`。后一张键是 `title` / `priority` / `assignee`，前一张 `{}` 没有这些键，所以 push。
- 两枚的 `no` 都是「标题」，工具参数里没有 `no`。`slots.js` 1250–1262：新建且不是改写句时，把 `leftoverNameIdentity` 写进 `no`。speech 剥掉型名和 patch 值之后，靠近型名的剩余词是「标题」。这使两行在合并时 kind/no/action 相同，仍然因为 patch 键不相交而分成两行。

### 一次确认按 lines 两发

工作台确认只交一枚 `preview_id`。该 id 只要在开口的 `lines` 里，闸就把 **每一行**都 `gate.write` 一次，不过滤空 patch、也不挑「未使用且有变更」的那一枚。

- `runtime/routes/biz.mjs` 1145–1151：`POST /api/v1/biz/write` 转给闸的 body 只有 `preview_id`、`trace_id`、`source`、`workspace`。
- `gate.js` 452–472：`inBundle` 为真时 `jobs = lines`，循环里每行一次 `gate.write`。

### 同 opening 作废死令牌：先写后废

作废在「至少一行写成功」之后，把开口里尚未 `used` 的令牌标成用过。它不在 POST 之前丢掉空行。

- `gate.js` 454–495：先跑完 `jobs`，`ok` 才 `voidOpeningTokens` → `voidUnusedTokens`（46–55 行，已 `used` 的跳过）。
- `runtime/tests/write-confirm-collapse.test.mjs` 112–120 只断言成功后兄弟令牌变 `used`。领头那枚在测试里事先已是 `used`。没有「空 patch 不进 jobs」的断言。

## 3. leftover

### wrote follow-up 之后为什么还有一张没有 `no`、没有 `where` 的整表

这次 follow-up 正文 **没有**「没有单号就只传型，列出该型最近一页」（那句只在 `briefFollowup` 的非 `wrote` 分支，`catalog.js` 284）。同一段仍有共用的「换一句、改单都换新页」（seq 79 正文第 3255 字附近，对应 `catalog.js` 310）。模型在标题条件 `WHERE_UNBOUND` 之后自己发了只带型、动作、speech 的现查（seq 102「换新页按标题现查」，seq 103 参数无 `no`、无 `where`）。计划层不从这句 speech 补 where，空槽现查就列整页。

- seq 79 是 plugin `dsh-lan-assist` 的 wrote 正文。检索「没有单号 / 只传型 / 最近一页」均不在这 3527 字里。「条件放 where」「换新页，旧页作废」在。
- seq 90 带了 `where` 键 `title`+`工单标题`，结果 `error=WHERE_UNBOUND`，附带的 sheet 仍是 seq 85 那张（有 `where`，单号 `…656`），所以那下没有变成无筛选列表，也没有 abort。`WHERE_UNBOUND` 在 `lookup.js` 695–702：传入的 where 收口后一条 term 都不剩，就拒绝，hint 原文是「不能整表现查」。seq 94 的 hint 文案与这句不一致，包装层未证。
- seq 103 参数只有 `kind`、`action=现查`、`speech=现查工单标题测试新增功能`。`plan.js` 129：不从 speech 发明 where。`pendingSheet` 现况：`speech` 与 seq 103 相同，`where` 无，`hitTotal=403`，`preview_id` 空。查询先做完，然后才 cancel（`tools.js` 218–235：`previewBiz` 之后才 `noteToolSheet`）。

### 无筛选列表仍走 leftover cancel；留下的那一支是谁规定的

`isLeftoverAfterCandidate` 在「现查盖住写预览」之外，还有一句：**只要进来的是无筛选现查列表，且本轮已经有候选（或上一轮 official 还在），就 cancel**。`explicitLiveLookupSupersedesWrite` 只豁免前一句，不豁免这一句。执行取消的是 `biz_preview` 尾钩，kind 为 `plugin-leftover`。

- 无筛选的定义：`session-round.js` 37–51 `isUnfilteredListSheet`。动作是现查、没有写令牌、`where` / `listWhere` / `hopWhere` / `from.kind` / `steps` 都空。speech 可以有，页大小不算数。测试 `unfiltered list is leftover even when speech is stamped` 把「只有一行、没有 where」也判成真。
- 豁免：`session-round.js` 66–76、226–229。工具打出的现查、且没有写令牌时，替换本轮写预览候选，不走 `leftoverQueryCoveringWrite`（78–80 行提前返回）。这就是 [tool-call-abort-root-cause.md](tool-call-abort-root-cause.md) §2.2 那条「写候选 + 带单号的现查也 `cancel({kind:'user'})`」被改掉的一支。
- 还留着的一支：`session-round.js` 124，`if (isUnfilteredListSheet(incoming)) return true`。不看候选是不是写预览。本轮 seq 85 的表现查带 where，能当候选（`isEligibleRoundSheet` 先排除无筛选，51 行）；seq 103 无 where，124 行成立，232–234 行 `cancelKind: 'plugin-leftover'`。
- 谁执行：`tools.js` 230–235，`live.cancel({ kind: cancelKind })`。记账与 seq 108 一致。右栏 `records-cancel` 不在这条返回值里。
- 另一处同样规定无筛选要掐、但不是这一笔的路径：轮次已关上且还有 official 时，205–213 行对无筛选直接 cancel，测试 `leftover dump after a closed official`。这一笔 turn 3 由 `index.js` 313–316 在 `turn/start` 另开一轮（上一轮 `closedBy=wrote`），seq 82/90 已在该轮里返回，所以掐在 **开着的轮、已有候选** 的 124 行，不是 205 行。

这三条打在哪些动作、哪些型上：[create-write-class-scope.md](create-write-class-scope.md)。
