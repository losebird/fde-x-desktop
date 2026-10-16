---
cursor:
  subagentId: "bc-849b605d-060e-5f11-a372-f142e4e09dab"
---

# 右栏业务记录 · 增删改审 UI 洞（只查因，未改产品）

对照：`docs/biz-write-eval.md`（W1–W30）、`docs/biz-write-w1-root-cause.md`、`docs/records-panel-decisions.md`（§7 取消、§9 左右同表、§12 问卡）。  
方法：静态走读 `RecordsPanel.tsx`、`BizPreviewDrawer.tsx`、`biz-hit-set-pick-cancel.ts`、`biz-session-sheet.ts`、`biz-sheet-display.ts`、`runtime/.../write.js`（`packSheet`）、`runtime/routes/biz.mjs`；未 reload、未点过账、未动 5174/4318。

---

## 1. 主路径（便于复现）

| 步骤 | 机制 | 关键位置 |
|------|------|----------|
| AI / 行内 / 顶栏预览 | `biz.sheet.pending` 或 `runPreview` → `applyPendingSheet` / `applySheet` → `setPending` + 可选 `setDrawer` | `RecordsPanel.tsx` 968–1051、1242–1332 |
| 抽屉开关 | `shouldOpenWritePreviewDrawer`：有 `preview_id`、未 dismiss、且（有可确认 diff / 过审已到目标） | 220–228、1042–1048 |
| 取消 | `dismissPreviewDrawer`：dismiss id、`bizDismissPreview`、浮回 `displayBeforeWriteRef` 现查表 | 803–841 |
| 确认 | `confirmWrite` → `bizWrite(..., source:'workstation')`；成功关抽屉清 pending；失败红条 + dismiss + `restoreRecordsList` | 1680–1720 |
| 左栏 leftover | `abortLeftoverAskTurn` → `cancelAi(..., records-cancel)`，仅当 `shouldAbortLeftoverAskForWritePreview` | 952–966、`biz-hit-set-pick-cancel.ts` 7–14 |

与 W1 文档差异（代码已变）：**确认失败**现会关抽屉、dismiss 令牌、恢复列表（`1707–1716`），不再「只红条仍待确认」。BFF/`dsh-core` 已倾向透传 `lines[].hint`（`biz.mjs` 51–63、1135–1160），但前端仍有一层 `formatBizPanelError` 兜底（见洞 **H07**）。

---

## 2. 可复现洞（文件 + 行 + 触发 + 用户可见后果）

### H01 · 点 chip / 换型不关写预览抽屉

| 项 | 内容 |
|----|------|
| 文件 | `src/components/biz/RecordsPanel.tsx` |
| 行 | `1440–1586`（`selectKind` 全路径无 `setDrawer`）；对比 `1375–1437`（`loadSurface` 会 `setDrawer(null)`） |
| 触发 | 写预览抽屉打开时，点工具栏对象 chip 或蓝条 pending 链到 `selectKind` |
| 后果 | 表已切到另一型/同次另一侧命中，抽屉仍显示**上一跳** `preview_id` 与变更文案；用户可能对**与当前表不一致**的行点「确认过账」。违背五问 §4「打开着的写预览不能挡住切换」、W28/W29 的「右表与操作一致」。 |

### H02 · 浮现历史可重新打开已取消的写预览

| 项 | 内容 |
|----|------|
| 文件 | `src/components/biz/RecordsPanel.tsx` |
| 行 | `1428–1437`（`loadSurface` 用 `shouldOpenWritePreviewDrawer`，**未** `isBizPreviewDismissed`）；对比 `1001–1003`、`1068–1076`（`applyPendingSheet` / `hydrateFromPending` 会拦） |
| 触发 | W24：改行预览 → 取消/关闭 → 从「本会话浮现历史」选回**仍带** `previewId` 的那条 surface |
| 后果 | 已 dismiss 的令牌再次出抽屉与「确认过账」，违背 records-panel-decisions §7 / W24。 |

### H03 · 顶栏/行内预览不写 session pending 缓存

| 项 | 内容 |
|----|------|
| 文件 | `src/components/biz/RecordsPanel.tsx` |
| 行 | `886–887`（`applySheet` 对写预览 **不** `rememberBizPendingSheet`）；`1309`（`runPreview` 只 `applySheet`，无 `rememberBizPendingSheet`）；对比 `1039`（AI 路径 `applyPendingSheet` 会 remember） |
| 触发 | W2：仅右栏「新建/改行/…」→ 预览，不经左栏 `biz.sheet.pending` |
| 后果 | 本机 `peekBizPendingSheet` / chip 锚定（`412–417`）与服务器 `getBizPendingSheet` 重水合时，可能**丢**「待确认」写预览；切 Tab、浮现历史、问卡 bind（`1254–1257`）与表不对齐。抽屉与 React `pending` 仍可能短暂正确，**不稳定**。 |

### H04 · 写预览页脚恒为「总数未知」

| 项 | 内容 |
|----|------|
| 文件 | `runtime/vendor-overlays/dsh-lan-assist/write.js` `74–261`（`packSheet` 仅透传已有 `hitTotalState`，写路径默认不带）；`RecordsPanel.tsx` `104–112`、`2032–2034` |
| 触发 | 任意新建/改行/删除/过审预览 1 行或多行（W1、W6–W17、W29） |
| 后果 | 页脚显示「总数未知」而非「共 N 条」；与 W1 手测根因 §4、eval「空集须共 0 条」并列，易让人以为命中集未落定或仍是现查。 |

### H05 · `changes: []` 仍有令牌：蓝条待确认但抽屉不开

| 项 | 内容 |
|----|------|
| 文件 | `RecordsPanel.tsx` `220–228`、`895–905`；`biz-sheet-display.ts` `409–414`；`biz-hit-set-pick-cancel.ts` `7–14` |
| 触发 | 左栏误路由写预览：`preview_id` 有、`action` 为新建/改行等、`changes: []`、行空或无可展示 diff（W1 后续 `pv_be623…` 类）；`shouldAbortLeftoverAskForWritePreview` 为 **false**（不测 `changes: []`，见 `runtime/tests/biz-hit-set-pick-cancel.test.mjs` 24） |
| 后果 | 蓝条「AI 拟改 … · 待确认」，**无抽屉**、难看到令牌与字段；同时**不** abort leftover 问卡/现查（W21/W28），左栏可 abort 现查而右栏仍像「新建待确认」。 |

### H06 · 确认成功后表不拉官方，文案像已对齐业务库

| 项 | 内容 |
|----|------|
| 文件 | `RecordsPanel.tsx` `1701–1706` |
| 触发 | W4/W10/W20 可选过账成功 |
| 后果 | 琥珀条「已过账，表格保留本次预览行供核对」；**不**现查刷新；页脚仍常为 H04；用户以为右表=业务系统真值（W10「业务系统该主键只有你改的字段变了」需去源系统对）。 |

### H07 · 红条仍可能被「IM 调用失败」吃掉闸 hint

| 项 | 内容 |
|----|------|
| 文件 | `RecordsPanel.tsx` `185–189`；`runtime/routes/biz.mjs` `51–63` |
| 触发 | W4 失败：BFF 仍返回 `RuntimeApiError.message` 含 `IM 调用失败`（旧链路或 `AiRemoteError` 未带 hint） |
| 后果 | 红条固定「过账失败，请重新预览后再试」，看不到「预览过期了…」等闸原文；与 W1 根因描述同类，**部分环境已修、UI 层仍保留掩码**。 |

### H08 · 确认失败：红条 + 整单恢复列表，待确认态被抹掉

| 项 | 内容 |
|----|------|
| 文件 | `RecordsPanel.tsx` `1707–1716` |
| 触发 | EXPIRED / 闸拒 / 网络错误时点确认 |
| 后果 | 抽屉关、pending 清、`restoreRecordsList`；红条在。用户**不能**在同一预览上重试，只能重新预览；与 W1 旧行为不同，但若未看清红条易以为「没写过」或「已取消」（W4「失败不得假装成功」— 不假装成功，但**失败信息依赖红条**）。 |

### H09 · 确认请求进行中，下一跳预览可盖住抽屉

| 项 | 内容 |
|----|------|
| 文件 | `RecordsPanel.tsx` `1180–1198`、`1685–1720`（`loading` 不阻塞 `applyPendingSheet`） |
| 触发 | 点确认后 SSE 再推 W3/W9 更新预览 |
| 后果 | 过账仍用**点击瞬间**的 `preview_id`（闭包），但抽屉/表已换成下一跳；成功/失败反馈与所见不一致，W3/W29「跟最新一跳」与「刚点的确认」交错。 |

### H10 · 同 fingerprint 重放：抽屉 `canWrite`/gate 可能不刷新

| 项 | 内容 |
|----|------|
| 文件 | `RecordsPanel.tsx` `1015–1035`、`859–864` |
| 触发 | 同一 `sheetRowsFingerprint`（含 `previewId`）的 pending 再推，仅 `canWrite`/`hint` 变 |
| 后果 | `applySheet` 早退；`setDrawer` 仅在 `prevId === previewId && prevAction === action` 时保留 prev（`1026–1028`），**不**合并新 `canWrite`/`gateReason`；W30 闸文案可能过期。 |

### H11 · AI 写预览 abort 误伤并行现查

| 项 | 内容 |
|----|------|
| 文件 | `RecordsPanel.tsx` `1005–1005`；`biz-hit-set-pick-cancel.ts` `7–14` |
| 触发 | 有可确认 diff 的写预览进右栏（含 W21 选人后的改行/过审），左栏同 turn 仍有 Ask/现查 |
| 后果 | `cancelAi(..., records-cancel)`；Harness 记 `user` abort（W1 根因 §3）。右栏正常，左栏现查/工具显示 aborted，**不是**用户点停。 |

### H12 · 无 `preview_id` 仍可能「待确认」蓝条

| 项 | 内容 |
|----|------|
| 文件 | `RecordsPanel.tsx` `1769–1772`、`207–209`；`shouldOpenWritePreviewDrawer` 要求 preview id |
| 触发 | 异常 sheet：`action` 非现查、无 `preview_id`（W5/W11/W27 假对象边缘） |
| 后果 | 蓝条「待确认」，无抽屉、无法确认；W30「无令牌不能过账」在 UI 上像坏了的待确认。 |

### H13 · 「返回」与「取消」语义分裂

| 项 | 内容 |
|----|------|
| 文件 | `RecordsPanel.tsx` `791–801` vs `803–841` |
| 触发 | 多行现查被收窄为写预览后出现「返回」；用户关抽屉 |
| 后果 | `handleRecordsBack` **清** pending；`dismissPreviewDrawer` **恢复**现查 pending。同一次预览两种关法，W25「取消后仍同一张浮现表」依赖用户点的是哪一种。 |

### H14 · 过账成功不刷新「共 N 条」与行集

| 项 | 内容 |
|----|------|
| 文件 | `RecordsPanel.tsx` `1703–1705`（无 `applySheet` 现查、无改 `hitTotalState`） |
| 触发 | 删除/过审/改行过账后行数应变（W15/W20） |
| 后果 | 表仍显示预览行集与 H04 页脚；删除成功仍可能看到「将删」那一行，直到人再现查或切历史。 |

---

## 3. W1–W30 对照（UI 会不会让人以为写成功 / 写了表不更新）

| 编号 | 判定 | 关联洞 / 说明 |
|------|------|----------------|
| W1 | 风险 | H04/H05；预览阶段正常；W1 文档 Turn2 模型写库已由 `gate.js` `source==='workstation'` 挡（非右栏 UI） |
| W2 | 风险 | H03；不经 AI 事件时 pending 缓存脆弱 |
| W3 | 风险 | H09；最新一跳设计成立，但与进行中确认冲突 |
| W4 | 风险 | H06–H08、H14；成功文案偏乐观；失败依赖红条 |
| W5 | 风险 | H12 |
| W6–W8 | 过* | 行内 `runPreview` 带 `originalRow`/`patch`（1317–1320）；chip 切换见 H01 |
| W9 | 风险 | H09；换预览一般跟最新；指纹早退见 H10 |
| W10 | 风险 | H06、H14 |
| W11 | 风险 | H12；行内仍受 `currentKindCan` |
| W12–W14 | 过* / 风险 | 连续写跟 `applyPendingSheet`；H01/H09 |
| W15–W20 | 风险 | H06、H14 |
| W16–W18 | 过* / 风险 | 空过审盖表：后端 `write-opening.test`；UI 空 changes 见 H05 |
| W19 | 过* | 取消路径 `dismissPreviewDrawer` + dismissed set；历史见 H02 |
| W21–W23 | 风险 | H05、H11；问卡后须有 diff 才 abort |
| W24 | **不过** | H02 历史重开；SSE 路径 dismiss 后 `1001–1003` 可挡 |
| W25 | 风险 | H13 两种关闭 |
| W26 | 过* | `shouldRejectIncomingCovering` 等（非写路径） |
| W27 | 过* / 风险 | `applyPendingSheet` `resolveConnectedKind` 拒假 kind；空写见 H05 |
| W28 | 风险 | H01、H11 |
| W29 | 风险 | H04、H09 |
| W30 | 过* / 风险 | `BizPreviewDrawer` 禁用确认 + `title`（72–76）；H10 闸文案不刷新 |

\*「过」= 主路径代码与决策一致；仍可能被 H01/H02 等叠加破坏。

---

## 4. 建议复现顺序（手测，仍不要过账）

1. W28 现查 → 行内改行预览 → **不关抽屉**点另一对象 chip（H01）。  
2. W24 取消 → 浮现历史选同条（H02）。  
3. W2 仅顶栏新建预览 → 切到别 Tab 再回右栏（H03）。  
4. 左栏只预览新建 → 看页脚与蓝条（H04/H05）。  
5. 预览后等 >90s 点确认（H07/H08，可选）。  

---

## 5. 证据

- 仓内测试（未跑浏览器）：`node --test runtime/tests/biz-hit-set-pick-cancel.test.mjs` 通过；`records-align.test.mjs` 部分用例与当前 `RecordsPanel` 导入不一致（非本次手测范围）。  
- 既有现网验证摘要：`internal/verify-records-write-cancel.md`、`internal/verify-records-write-opening.md`（取消/连续写预览跟最新一跳）。
