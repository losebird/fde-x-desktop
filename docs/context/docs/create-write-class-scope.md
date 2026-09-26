---
cursor:
  subagentId: "bc-a6bbce72-5cdd-5850-8b94-e1d8e041fb70"
---

# 这三条打在哪一类写上

只看现网闸的共用路径。checkout 与 `~/.dsh-fde-x/vendor/dsh-lan-assist` 的闸文件哈希一致，没有 reload。直接原因见 [create-write-three-bugs.md](create-write-three-bugs.md)，上游见 [create-write-three-upstream.md](create-write-three-upstream.md)。

现网词表 40 个型。schema 上闸认的 m2o（`m2o` / `o2o` / `belongsTo`，去掉创建人/更新人）85 条，落在 39 个集合。被这些字段指向的目标集合 22 个，每一个都缺 `name`、`title`、`code` 里至少一列。同一段 `$or` 现打人集合和客户集合，都是 400。

四种写动作是新建、改行、删除、过审。词表 `can` 没有的动作，`actionAllowed` 在预览前拒绝。这一型的 `can` 有新建/改行/删除，没有过审。别的型有过审，走的是同一条 `finishStructured`。

## 1. 口语进不了外键

**新建和改行的 patch 会踩。删除和过审不把人话写进外键列。按口语找行时，三种定位动作共用同一套收口，失败是找不到行。**

展示 patch 与 `shapePatch` 只包新建和改行（`write.js` 1081–1089）。关系值留在给人看的 patch 上；令牌和 POST 走 `shapePatch`。`m2o` 不是数字就 `resolveRelatedId`，没有唯一 id 就丢掉该键（2035–2045）。返回对象再用展示 patch 盖住 `patch`（新建 1124，改行 1395）。删除和过审的 `displayPatch` 在这里是空的，过账正文分别是 destroy 和状态列。

`$or` 不看动作、不看型。`spokenResourceFilters` 对所有目标无条件再拼 `name`（`$includes`）、`title`（`$includes`）、`code`（等值）。目标缺任一列，整段 400，id 收成空串。现网 22 个目标全缺，所以现网每条 m2o 的口语都收不回 id。人这个目标多三列等值（`username` / `nickname` / `email`），没有子串、没有大小写折叠；拿掉不存在列后再打，等值是 200、0 行。

中文键：patch 在绑定前只留 schema 字段名，外加备注/电话/地址那张小别名表（`schemaHasField`）。新建和改行的中文键会滤掉。where 另走 `resolveShapeKey`（schema 标题，以及标题包含）。改行、删除、过审找行都进 `lookup.js` → `bindWhereRelationTerms`，关系值仍是 `resolveRelatedId`。收不到 id 的那条 term 被丢掉；传入的 where 一条不剩就是 `WHERE_UNBOUND`，不写。所以删除/过审会踩的是「口语当条件时对不上行」，不是「口语落进外键列」。

图缺边不参与收 id。闸按 schema 的 `target` 查。缺边只让模型在 `biz_describe` 里看不到这条 hop。85 条 m2o 里，已发布词表有边的 47 条，没有的 38 条，20 个集合至少缺一条。有边的照样会在 `$or` 上 400。

改行若写补丁里只剩被丢掉的 m2o，预览 `NO_PATCH`，不发牌。新建没有这道拒绝，行会建出来，外键空着。

现网打到的是这一笔新建（外键空）。口语审计里同一型还有客户名、客户编号没进库。审计里另有改行（员工档案、客户、这一型），没有对上「口语外键被丢」的记录。删除、过审在审计里没有。其余型：契约会踩，现网未再打到。

## 2. 空牌、两发、空行

**空牌和空行只属于新建。一次确认按开口里每一行过账，四种写动作共用。**

| | 新建 | 改行 | 删除 | 过审 |
|---|---|---|---|---|
| 滤空仍发牌 | 会。`tokens.set` 不看 patch 空不空 | 不会。预览和 `write()` 都 `NO_PATCH` | 会发牌，牌上没有字段 patch | 会发牌，牌上是状态列；枚举收不成则过账 `NO_PATCH` |
| 同一开口两行都留下 | 会。先 `{}` 再有键，键不相交就 `push` | 会。两张键不相交就两行（测试已断言） | 同一行的 patch 为空，合并是覆盖。不同单号是两行 | 状态列同名则覆盖 |
| 确认两发 | 会 | 开口里有两行就会 | 同左 | 同左 |
| 写出空行 | 会。`POST :create`，body 可以是 `{}` | 不会 | 不会，是 destroy | 不会，写状态或拒绝 |

合并规则不看「是不是新建」，只看型 + 单号 + 动作，以及 patch 键有没有交集（`mergePreviewLines`）。后一张 patch 为空会盖住前一张。确认时 `preview_id` 只要在 `lines` 里，`jobs` 就是全部行，不过滤空 patch（`gate.js` 452–472）。作废未用令牌在至少一行写成功之后，空牌已经进过 `jobs`。

现网打到的空行和两发，是这一次新建确认。改行两发、删除/过审按 lines 全发：契约会踩，现网未再打到。

## 3. 过账后的无筛选现查

**wrote follow-up 四种写成功共用。无筛选 cancel 不看刚才的写动作，也不看型。**

成功过账只有一处 `briefFollowup({ kind: 'wrote' })`（`gate.js` 526–538），不按动作分文案。四种只要写成功，注入的是同一段。那段没有「没有单号就只传型」；「换一句、改单都换新页」在目录句里，wrote 也带着。

无筛选的定义只看进来的那张表是不是现查、没有写令牌、没有 where / hop / steps（`isUnfilteredListSheet`）。`isLeftoverAfterCandidate` 124 行只要这张是无筛选列表就成立，不读候选的动作或型。更前面有一道替换：候选自己是写预览（不是现查）时，工具打出的现查换成候选，不 cancel。过账把轮关上并清掉候选，follow-up 再开一轮。这一轮里先有一张带条件的现查当上候选，后面的无筛选列表才走 124 行，`plugin-leftover`。换成改行、删除或过审成功，follow-up 正文和这条判定不变。

现网打到的是这一次新建过账之后。其余三种写成功：契约会踩，现网未再打到。

## 总答

不是「所有业务数据操作都有这三条」，也不是「只有这一笔新建」。

1. 口语外键：新建和改行的 patch 都会丢键；现网每条 m2o 的收 id 都会 400。删除和过审不把口语写入外键，用口语找行时同一套收口失败就对不上行。
2. 空牌和空行只有新建。两发是开口里留下的每一行，确认循环四种写动作共用。
3. 过账后的 wrote，和无筛选现查的 cancel，不看动作、不看型。

准备怎么收：[create-write-fix-plan.md](create-write-fix-plan.md)。
