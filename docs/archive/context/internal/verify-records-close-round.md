---
cursor:
  subagentId: "bc-791c5c75-f15b-51a1-8527-93ee4154947a"
---

# Verify: records-close session round

对照 [准备怎么验](../docs/records-close-session-plan.md)。契约未改。不写死业务名。说的话从现场词表已发布关系现拼。对抗审查未开始。不声称图过。

**SHA:** `e3f481fff48cf24026f5c8251f345c3cac25253c`  
**branch:** `cursor/records-close-session-round-947a`  
**三块都过:** no

不验某一种业务好不好使。验工作台认不认一轮、认不认正式结果。

## 第一块：同一条对话里你说 2～3 句

目的：右边跟的是「这一轮结束时的正式结果」，不是过程里过闸的那一次。

怎么做：

1. 开业务记录，用同一条对话。
2. 发送第一句。等左边这一轮停转。
3. 看右边：应是第一句的结果。
4. 再发送第二句（和第一句不是同一件事）。等左边这一轮停转。
5. 看右边：应换成第二句的结果，不能还停在第一句。

过程里怎么看「自己再查不换表」：某一句发出去之后、左边还在转的时候，右边如果先跳到另一张表（尤其是没筛条件的一页列表），再跳回来或停在那页，就算没过。停转之后，右边必须是你这一句要的那张，不是过程里闪过的那张。

**过：** 每一句停转后，右边 = 这一句。转的时候不跟丢、不跟成自己再查的表。  
**没过：** 你没说下一句，表自己换了；或下一句停转后还是上一句的表。

### 现场

- 第一句：现场词表一条已发布关系的现查（「这个，和它关联的那个」）。
- 第二句：另一条已发布关系的现查。
- 转的时候右边画过的对象：第一句 `[]`；第二句 `[]`。

### 判定

**没过** not-this-send

| 句 | 停转 | dump | leftoverJump | running | 右边对象 | 行数 |
|---|---|---|---|---|---|---|
| 第一句 | 是 | false | false | false | （现场对象，不写进脚本） | NaN |
| 第二句 | 是 | false | false | false | （现场对象，不写进脚本） | 20 |

图：`media/records-close-round-01.png` exists=true  
路径：`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-round-01.png`

## 第二块：正式结果上桌后，左边必须停转

目的：一轮结束这个信号是真的，不是表先画了、聊天还以为没说完。

怎么做：就用第一块里某一句已经停转、右边已经是正式结果的那一刻。看左边聊天。

**过：** 正式表已经在右边，左边没有「深度求索中」，输入框可以再发。  
**没过：** 右边表有了，左边还一直转。把等待再加长不算过。

### 判定

**过** 

- 右边已有正式表：true
- 左边「深度求索中」：false
- session.running：false
- 输入框可再发：hasInput=true disabled=false
- 额外加长等待：否

图：`media/records-close-round-02.png` exists=true  
路径：`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-round-02.png`

## 第三块：新开一条对话，说一句带关系的现查

目的：跳关联表走词表里已发布的关系，而且是这一轮的正式结果；不是后台自己拉的一页目录。

怎么做：

1. 新开一条对话（不要接着第一块那条）。
2. 在词表里找一条已经发布的关系：两种对象是连着的。
3. 说一句现查，把这两个都点出来（「这个，和它关联的那个」这种）。
4. 等左边这一轮停转。看右边。

**过：** 右边是关系指向的那张，并且带着这一句的条件，不是某种对象的默认第一页。  
**没过：** 右边是没筛条件的一页列表；或跳到的不是词表关系指向的那张。  
**现场词表没有关系：** 记「词表没有可验的关系」，不编一种业务来验。

### 判定

**没过** not-relation-target

- dump（没筛条件的一页列表）：false
- 带这一句的条件：from=false hopWhere=false steps=0
- running：true

图：`media/records-close-round-03.png` exists=true  
路径：`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-round-03.png`

## 图上看到的

不声称图过。三张都在。

- `records-close-round-01.png` / `02.png`：同一条对话。左边已停转，输入框可发。第一句停转后 GET 正式表是空的；第二句停转后 GET 是带关系链的正式表，不是无筛选目录。截图主区是会话，不是业务记录右表。
- `records-close-round-03.png`：新对话。左边仍是「深度求索中」，右边没有关系指向的那张正式表。

## Files

- /Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-round-01.png exists=true
- /Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-round-02.png exists=true
- /Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-round-03.png exists=true
- /Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/internal/verify-records-close-round.json
