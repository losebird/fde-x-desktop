---
cursor:
  subagentId: "bc-8e72aefd-4765-506e-a4a2-d97810bc91c1"
---

# 业务记录 · hop · 表 · chip · 页脚 · 问卡 — 缺口盘点（只读）

**盘点范围：** 业务应用模块里的「业务记录」Tab 与官方表浮现链（不含应用创建向导、设置、IM 模块本身）。  
**代码树：** `scene-39-personal-workstation`，当前检出 `cursor/speech-action-authority-8c12` @ `6dcee573`（收口验证多引用 `main` @ `a31ca54` 一带，下文以 store 协调图审 + 现网代码为准）。  
**目标路径已确认：** 本文件新建；此前不存在。

---

## 结论

**业务记录这一块整块没收口。**  
BA→BQ 多轮图审结论一致：十条活用例与「冻结四条契约」没有在同一会话、同一套人眼图里一次站住；协调器对 BQ 仍判「图未进 Context、不能对屏、不报收口完成」。`biz-app-module-plan.md` 里「业务记录主线已现网图过、只差小尾巴」与 store 里 BA–BQ 失败记录矛盾——小尾巴实际是 **kind 资格、pending 管子、右表 apply、问卡、重开会话、已过态过审、页脚对象集** 等闭集，不是 cosmetic。

---

## 还没搞好的（现象 / 证据 / 状态）

| 主题 | 现象 | 证据 | 状态 |
|------|------|------|------|
| **整块收口（10 条 × 四条契约）** | 同 SHA 重跑第 1 条可从工单 21 抖成「客户 · 现查 · 0 行」；脚本全绿仍不被协调器接受 | BO 协调图审；BQ 协调图审「图没进 Context」；`records-align-plan.md` BL/BN/BO/BP/BQ 链 | **现网坏了**（间歇）+ **方案完成但手验没过** |
| **契约 1：kind 必须连着业务表** | 图谱并列概念（如报销单 vs 费用报销）历史上能打 preview；口语仍可能第二枪空指纹 | `records-close-root-cause.md`；`write.js` 的 `kindsFromGraphNodes` 仍从 `skos:Concept` 出 catalog；BQ 脚本 graphOnly→400 仅证明「当前 catalog 无 GraphOnlyConcept」，不证明生成路径永不再挂假 kind | **方案完成但手验没过**（HTTP 拒预览有进展；**上游 catalog 来源未按决策 15 收死**） |
| **契约 2：一句话一张 pending** | 左栏已对 97 条过审，右表可仍是报销单 0；BFF 与模型可各写一张 | 总因 § 工作台三路 pending + 模型第二枪；`biz.mjs` 仍 `lastEmittedPendingBySession` + `emitBizSheetPending` + GET 合并 `officialRoundSheet` 与 `lastEmitted` | **现网坏了**（BG/BL 史）+ **没做**（未废除 BFF 二次写 pending） |
| **契约 3：右表必须换上这一张** | 取消改行后 chip/footer 倒连接器目录；空过审盖有行现查；重开新 sid 右表仍带上一会话 kind | BG 取消→客户 ~20；BJ 图审契约 3 失败；BK 图过；BP reopen 脚本/图不一致；BQ 脚本 reopen 空表 vs 协调器未图审 | **现网坏了**（已修又回潮） |
| **契约 4：模糊名先选再继续** | 该停时变成「你要看哪一档」；该一批时变成选择题 | BE 第 2 条 NOT_FOUND 后问哪一档；BD 第 4 条图过；`records-close-fix-plan.md` §12 产品规则在 BE 仍被违反 | **现网坏了** |
| **hop 整句一次** | 模型拆多次单侧 preview，面板跟半表；空 hop 从目录第 1 页起探导致 NOT_FOUND | `hop-intersection-plan.md` 第 2–5 步史；BF 真因与 `98af488` 修起探点；现网 1–3 条在 BG/BF 后多次图过但 BO 第 1 条仍抖 | **方案完成但手验没过**（代码在 main/overlay，**整句路径仍靠模型纪律**） |
| **hop 侧 chip** | 非目标侧 chip 曾展示目录 20 而非本次命中 | `records-align-plan.md` 合同侧 chip 刀图过 `85d3887`；AA 仍写「点销售合同 20 未验」— 后续 9ec2818b 图过，**闭集未并入「一次收口」** | **方案完成但手验没过** |
| **官方表（tbody/chromium 一致）** | chrome 1 行、表体仍多行同号 | `records-align-plan.md` L+M+N 图过并进 main；属已修能力，但 **依赖 apply 链**，后续 pending 错乱仍会裂 | **已修路径可用，收口未锁** |
| **页脚（footer）** | 「共 N 条」应是命中对象集总数，不是本页行数；缺 enum/关系时仍可能交表 | `palantir-accuracy-gap.md` 4–6；`records-close-fix-plan.md` §3；UI 有 `hitTotalState`/`hitTotal`（`RecordsPanel.tsx`），闸侧未保证每条现查都带 known total | **没做**（对象集语义）+ **现网坏了**（大量场景显示「总数未知」或仍用页内行数心理模型） |
| **问卡（leftover / 模糊 / 改行后）** | 改行预览已出，左栏 Ask 问卡仍开、模型仍在转 | BP `verify-records-close-bp.md` case 4 `ask-card-still-open(thinking=true)`；BQ 称 `a31ca54` apply 时 `cancelAi` 清问卡 — **协调器未图审确认** | **方案完成但手验没过** |
| **过审已是目标态** | 令牌有了，抽屉「没有可展示的变更内容」 | BN case 6 对 `LV-2026-018`；`write.js` `alreadyAtTarget` 会改 speak，但 **抽屉空变更仍算 BN 失败**；闭集要求「已是已过要说清」未在十条原句稳定复现 | **现网坏了**（数据漂移 + 产品语义未收口） |
| **取消 / 写预览 / 浮现历史** | 取消倒目录；历史 miss 灰条；写预览并进旧 opening | 总因 §3；Z `1358425` 与 BG 回潮；L+M+Q+R 已图过 — **与契约 3 仍冲突** | **现网坏了**（间歇） |
| **重开会话右表** | 新 session 应先空或本句结果，不应端上一会话销售回款 | BM 自报；BP reopen 失败；BQ 脚本 `reopen.pass` | **方案完成但手验没过**（脚本声称修，**协调器未收**） |
| **横幅/来源条** | 过审预览横幅仍写「AI 刚查了」 | BM 协调图审「仍差」 | **没做** |
| **准确性大计划（读路径）** | 话未收成「对象+属性+边」再查；对象名拆条件；关系上游只扫第一页 | `records-close-fix-plan.md` 全文待批「说继续才改」；`session-round.js` 已在闸内落地 **部分** 回合逻辑，但 **右表仍混 hall/pending/GET 合并**，未达 Palantir 式对象集 | **没做**（计划层）+ **部分实现未验收** |
| **hop-sheet-stuck（这一句的权威表）** | 下一句现查应立刻顶掉上一句改行；半中间空表不得盖掉已对上的表 | `hop-sheet-stuck-plan.md` 仍「点头之前不改」；`session-round`/`shouldSkipCoveringPending` 部分覆盖，**无 store 图过「恒通工单 4 张」验收** | **没做**（产品验收） |

---

## 已能用的（各一句对照）

- **跨对象 hop 主路径（回款∩合同等）：** L/M/N + R/S/U + BF 起探修复后，原句现查在多条验证里 tbody/footer/chip/左 AI 能同为 1 行（如 `PAY-2026-005`）。  
- **写预览链：** V/W/X 图过同会话改行→删除→过审→新建跟最新一跳；过审抽屉可展示字段差（非空变更时）。  
- **浮现历史：** Q+R 图过本会话切换缓存表，空改行抽屉已收。  
- **chip 布局：** Z 图过连接器下拉与 kind chip 分列，本地应用不进 kind chip。  
- **操作记录（同模块 Tab）：** Y/AA 图过 corpus 原文与搜索/分页/颜色（本稿不展开操作记录需求）。  
- **取消改行留 hop 表（单场景）：** BK 图过契约 3 单条（工单 21，非目录 22）。  
- **批量过审口语→已连接表：** BM 图过「待审报销单都过一下」→ 费用报销 97 行过审预览含 `preview_id`（非现查顶替）。  

---

## 对照方案与四条契约（打假，不抄 notes）

### 对 `biz-app-module-plan.md`

- 文档写「业务记录 / 操作记录主线已现网图过，还差另批项和小尾巴」→ **假。** store 明确 Ace 批了 **BA 整块收口**，且 BA–BQ **从未**协调器图审「一次收住」；操作记录 Y/AA 过了 ≠ 业务记录十条 + 四条契约过了。  
- 把收口说成「评测集 / 第 9 步不做即可」→ **假。** 决策 18 禁评测集，但 **收口完成条件** 是冻结四条 + 原十句（见 `records-align-plan.md` BA），不是「合同∩回款一条」。

### 对 `records-close-fix-plan.md`（Palantir 式读）

- 计划要求「一轮结束才交表、词表 enum 唯一来源、命中集分页与页脚分离」→ **产品未按该计划批跑完。** 闸里有 `session-round.js`，BFF GET pending 仍 **`officialRoundSheet` + `lastEmitted` 合并**（`biz.mjs` 918–921），右表仍听 SSE/pending hall，**不是**计划里的单一「正式结果」。  
- 「说继续才改」→ 与 BA–BM 已在 main 上大量改动 **不矛盾**，但 **accuracy 计划 §2–3 的 bind/总数规则** 无同等验收，不能宣称读路径已达 Palantir 差距文档的「已有」。

### 对 `hop-intersection-plan.md` / `hop-sheet-stuck-plan.md`

- 「hop 代码已在 main，问题在模型拆句」→ **半真半假。** 闸侧 N-kind hop 已 land，但 **面板跟最后一次单侧** 在 plan 第 2 步仍失败过；stuck 计划要的 **权威「这一句表」** 没有 store 图过闭环，不能写「hop 已搞好」。  

### 对四条契约（`records-close-root-cause.md`）

| 契约 | 文档要求 | 现网/代码打假 |
|------|----------|----------------|
| **1** | 无业务表不得 preview；口语是别名 | `kindsFromGraphNodes` **仍图谱优先**；BQ 仅测「catalog 已无 graph-only 节点」，**不**等于连接器表是 kind 唯一来源（决策 15 未落地） |
| **2** | 一句话一张 pending；假 kind 第二枪不上屏 | BFF 多路 emit + 轮询仍在；BL case 5 仍出现「先报销单空指纹再费用报销 97」轨迹；BM 修过 batch 过审 **不等于** 第二枪绝不上屏 |
| **3** | 空表/假 kind/取消不得 hold 旧表或倒目录 | BK 单场景图过；BG/BJ/BO 仍记录倒目录或 hold；BO 同 SHA 第 1 条 **工单句→客户 0** 直接打脸「右表换上这一张」 |
| **4** | 模糊名多家先选；一批不一家家问 | BD 图过第 4 条；BE 第 2 条 **一批现查变选择题** 打脸；第 1/5 条「一批」与第 4 条「先选」边界 **未**在闭集一次验完 |

### 对 `palantir-accuracy-gap.md`

- 文档列的 6 条读差距（无对象集关卡、属性乱绑、关系不全、总数=本页、正式结果未绑回合、缺词表仍猜）→ **截至本盘点仍在**；footer 的 `hitTotal` 是 **UI 能力**，不是「每条查询都经校验的对象集」。  
- 写路径「预览令牌接近 Palantir 动作」→ **真**；但 **不能**用写路径过关推断读路径已收口（协调器 BN/BO 已过态/空抽屉仍在读链暴露）。

---

## 建议后续验证锚点（本稿不派工）

1. 协调器 **对屏** BQ 十格 + reopen 图，再判是否「一次收住」。  
2. 同会话连续 BA 第 1→2 条，确认不再出现「哪一档」与「客户 0 盖工单」。  
3. 契约 1：从连接器 re-gen catalog，确认 `(in graph)` 无 resource 概念 **永不**进 `biz_preview`。  
4. 第 6 条原句（已过行）与第 9 条（待审+过审）分别验 **alreadyAtTarget 文案 + 抽屉字段差**，不互换 id 冒充过。  

---

## 文件

- 用户可见：无（本稿在 `internal/`）。  
- 本稿：`internal/biz-app-records-gaps.md`（新建）。
