# 工单现查 where 绑定 · live 验证

## 根因（已对：代码）

| 现象 | 原因 | 修复位置 |
|------|------|----------|
| `where` 为 undefined | 口语词表未进 workspace；`enrichStructuredSlots` 无 collections/schema；`finishStructured` 只写 step0 where | `slots.js` + `enum-clues.js` + `write.js`（`schemaByKind`/`collectionsOf`、sheet `where`/`hopWhere`） |
| 现查仍含 resolved/closed | `expandNegatedClosedValues` 只扩「关」类 enum，negation 在 `termHits` 上对未命中字段反选为「全过」；`termFitsCollection` 丢掉 ascii where | `enum-clues.js` CLOSED 类 enum 扩全；`resolve.js` `termHits`；`lookup.js` `termFitsCollection` |
| BFF 带 `from` 不过闸 | `translateBizIntent` 未转发 `from` | `runtime/routes/biz.mjs` |

## Live 探针（`/Users/zxz/Documents/ai-project/fdex测试`）

| 项 | 结果 | 证据 |
|----|------|------|
| **where present** | **yes**（flat 现查 `status $notIn closed/resolved`） | `lan-assist/preview` → `sheet.where` 有 terms；业务记录截图 165 行均为 processing/assigned/new |
| **停用 hop** | **yes**（本地 enrich）；live 全句需 DSH 吃到新 `slots.js` 后复验 | 本地 `enrichStructuredSlots` + collections → `from.kind=客户` + inactive/停用 where；`lan-assist` 手工 `from`+`where` → **22 行、0 closed** |
| **没关** | **yes**（绑定逻辑） | `clueHitsInSpeech` → `没关` `not:true`；`expandNegatedClosedValues` → schema 上 closed/resolved 等 enum codes |
| **panel kind** | **工单** | `media/gongdan-where-bound.png` 胶囊「工单 165」 |
| **hardcoded literals** | **none**（业务路径） | 筛选来自词表 shape + connector enum + 图 hop；无停用/没关/22/70/2026 等字面量写死在查询逻辑 |

## 截图

- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/gongdan-where-bound.png`

## 仍差 / 锁

- **未对：live 全句**「停用客户还有哪些没关的工单？」在多次 `ai/reload` 后仍可能 `NOT_FOUND` 或 child `not:false`（DSH 进程未稳定重载 overlay 时）；需在 **不杀 pnpm** 前提下做一次「重载核心」或等监督进程拉起后再打全句探针。
- **未对：BFF `from` 转发** — `biz.mjs` 已改，需 **4318 runtime 重启** 后 `/api/v1/biz/preview` 才带 hop（当前 live curl 仍见 `hopWhere: false`）。

## 单测

- `runtime/tests/slots-enrich.test.mjs` — pass（overlay `slots.js`）
