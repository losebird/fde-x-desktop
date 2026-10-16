# 设置里的「局域网配对」能不能拿掉？

## 结论（给 Ace）

**能拿掉设置里这块 UI**——它和 IM「添加同事」是同一套配对，不是第二套后台。拿掉后配对、门牌、开码、填码、确认、离线对端列表都还在 IM 里。

**但：** 仓库 `PRODUCTION-SPEC.md` §10 仍写明「运行环境」里要有 lan-assist 配对表单；IM 空状态里还有按钮 **「打开设置配对」**。真要删设置卡片，属于**改产品 + 改规格/文案**，不是技术拦路。

**不是**「只能藏不能删」——底层不在设置里，没有「设置独占」的配对逻辑。

---

## 1. 设置 vs IM：是不是同一条路？

| 问题 | 答案 |
|------|------|
| 是不是同一条配对流程？ | **是。** 开码 → 对端填码+门牌 → 开码侧本机点确定（`accept`）。 |
| 读的接口 | **同一份。** 两边都用 `runtimeApi.imState()` → `GET /api/v1/im/state` → BFF 调 `lanAssist('/state')`。 |
| 写的接口 | **同一份。** `imPairMint` / `imPairHandshake` / `imPairAccept` / `imPairReject` → `/api/v1/im/pair/*` → `lanAssist('/pair/...')`。 |
| 账在哪 | **lan-assist（DSH 侧）**，不是 SQLite。`peers`、`pairAsk`、`doorPort` 都来自 `/state`；工作台 SQLite 管的是会话/计划等，不管配对钥匙。 |

代码对齐（设置与 IM 调用相同 client 方法）：

- 设置：`src/pages/Settings.tsx` 运行环境卡片 → `imPairMint` / `imPairHandshake` / `imPairAccept` / `imPairReject` + 进入分区时 `imState()`
- IM：`src/components/IMWorkspace.tsx`「添加同事」面板 + 顶栏 `pairAsk` 条 + 空联系人区开码 → 同一组 `imPair*` + 轮询/刷新 `imState()`

**根本原因：** 设置里的「局域网配对」是早期按 §10 落在「运行环境」里的**第二套壳**；IM 已做成主入口（文案已写「不用去设置」），后端没有分叉。

---

## 2. 拿掉设置块，谁还会找不到入口？

| 场景 | 拿掉设置后 |
|------|------------|
| 开码 / 填码 / 门牌 | IM → **添加同事 / 添加同事**（管理侧栏 `panel === 'add'`），或联系人为空时的内联开码。 |
| 等对面点「确定」 | **IM 顶栏黄条**（显示对方名字+门牌）；设置里只有进「运行环境」时拉一次 state，**不轮询**，体验反而更差。 |
| 本机第二套 `pnpm run dev:peer` | IM 空状态与添加同事里都有说明；README / HANDOFF 仍指向 peer 栈，不依赖设置。 |
| 已有离线对端（zxz / 林督等） | IM 联系人列表 **在线/离线**；设置里只是在配对卡下多列了一行诊断列表，**不能解配**。 |
| 解配 | **只在 IM** 联系人资料里 `imUnpair`，设置本来就没有。 |
| 仍会懵的人 | ① 只逛 **设置 → 运行环境**、把配对当「运维项」的老习惯；② 跟 **PRODUCTION-SPEC / HANDOFF** 里「在设置完成配对」的旧叙述；③ 点 IM 里的 **「打开设置配对」**（删设置块时必须一并改掉）。 |

**不会**因为删设置而丢能力的人：只要会开 IM，配对全流程都在 IM。

---

## 3. 死 UI 还是「配对只在设置」？

**重复 UI，不是设置独占底层。**

```text
浏览器 Settings / IMWorkspace
        │ 同一 runtimeApi.imPair* / imState
        ▼
runtime/server.mjs  /api/v1/im/pair/* 、/api/v1/im/state
        ▼
aiRuntime.lanAssist('/pair/...') 、lanAssist('/state')
        ▼
lan-assist（DSH）进程 — 配对状态与 peer 名册的权威
```

IM 不是「薄包装设置」；两边是**平行入口**，IM 侧更完整（`pairWait` 提示、顶栏确认、解配、轮询 state）。

设置块**多出来的**只有：贴在「运行环境诊断」旁边的 **peer 只读列表**（运维扫一眼）。若需要可保留一行「已配对 N 人，去 IM 管理」链接，而不是整卡表单。

---

## 4. 建议（不改代码，只决策）

1. **产品语义：** 配对主入口应在 IM；设置里整块表单可删，**能力不丢**。
2. **规格债务：** 删之前应改 `PRODUCTION-SPEC.md` §10 / §466（「必须在设置完成配对」）和 IM「打开设置配对」按钮，避免验收与 onboarding 打架。
3. **若暂时不敢删：** 也算**重复**，不是「不能删」；最差是「藏」——把设置卡收成一句跳转 IM，但那是体验折中，不是技术必需。

---

## 证据索引（仓库内）

| 位置 | 说明 |
|------|------|
| `src/pages/Settings.tsx` ~286–337 | 「局域网配对」卡片 |
| `src/components/IMWorkspace.tsx` ~1482–1564、1995–2017 | 顶栏确认、空状态、添加同事 |
| `src/lib/runtime-api.ts` ~1449–1471、1367 | `imPair*`、`imState` |
| `runtime/server.mjs` ~1886–2030 | BFF 转发到 `lanAssist` |
| `PRODUCTION-SPEC.md` §10、~466 | 仍要求设置里配对表单 |

---

*文档类型：产品与架构核对；未改代码。2026-09-25*
