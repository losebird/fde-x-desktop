---
cursor:
  subagentId: "bc-9ddd22c6-b341-52ec-b97a-726b19b4277c"
---

# 业务应用模块 · 应用壳缺口（只读核对）

核对时间：2026-09-26。源码树：`scene-39-personal-workstation`，`git` 短 SHA `6dcee573`（较 AV/AZ 验证提交已前进）。现网：`http://127.0.0.1:5174` 返回 200；BFF 经 Vite 代理可用。

范围：业务应用三 Tab 里的**应用壳**（目录、创建向导、工作面、声明能力、浮窗与主台状态）。不含业务记录/操作记录日常闭环（方案已另批 BA/BC）、不含首页/设置/IM 本体，除非壳层直接踩到。

---

## 1. 结论

**没收口。** 创建→预览→激活→SQLite CRUD、打开/删除、应用独享浮窗、建造抽屉里改 spec/回滚，管道在现网能跑；但相对方案里「WorkBuddy 级产品页 + spec 驱动铺面 + 能力长进业务动作 + 规格 04 完整验收」，应用壳仍停在「能演示、多轮图过但未齐」状态。`biz-app-module-plan.md` 在 AZ 之后已转去业务记录 BC，**创建应用八项与观感刀（AV–AY）的「未齐」在文档与代码里都没有被宣布完结**；本机树也未复现 AV 验证里「八项全过、无剩余」的断言。

---

## 2. 没搞好的条目

### 2.1 观感未达参照（健身 / 记账图）

| 维度 | 说明 |
|---|---|
| **现象** | 产品页仍是「色块英雄区 + 圆角卡片 + 薄流水」，信息密度、装饰、满屏信息流明显低于 Project Store 两张参照图；AY 最后一刀仍写「大色块留白、流水薄一行」。 |
| **证据** | `src/components/apps/SpecCards.tsx`：`HERO_TONES` 随机色条、`heroHeightClass`/`cardGridTemplate` 由 `resolvedSurface` 驱动，布局上限在此；`internal/verify-app-create-ay.md` 与 `biz-app-module-plan.md` AY 结果均标 **未齐**。 |
| **分类** | **方案写完成但手验没过**（多轮「图过这一截」≠ 参照过关）。 |

### 2.2 平台能力仍是「一排 chip」，未长进业务动作

| 维度 | 说明 |
|---|---|
| **现象** | 声明了 `ai/files/memory/…` 时，工作面仍出现与「播放/打开」同款的圆角按钮条；卡片页甚至在**每张卡底部**重复一整条能力按钮。 |
| **证据** | `AppCapabilityBar`（`recordActionChipClass`）在 `AppProductPage` 的 compose 区通过 `renderSubmit` 与 `primary` 并排；`SpecCards.tsx` 在 `perCardActions` 为真时对每张卡渲染 `AppCapabilityBar`（`actionUses` 来自 `recordActionUses`）。AU/AT 验证写「仍是一排按钮」。 |
| **分类** | **方案写完成但手验没过**（AU 图过但正文 **未齐**；与 AV 验证 #3「不是平台条」的表述不一致，以当前代码为准）。 |

### 2.3 目录页仍是「仪表盘 + 目录」，不是纯目录

| 维度 | 说明 |
|---|---|
| **现象** | 应用 Tab 列表上方仍固定四格指标（业务应用数、连接数、待审批、异常），右侧仍并排「业务系统与数据源」卡；AE 要求列表只做目录、使用进工作面。 |
| **证据** | `src/pages/Data.tsx`：`DataAppsPanel` 在 `workspaceAppId` 为空时渲染 `Metric` 网格（约 L560–565）与双栏 grid。 |
| **分类** | **没做**（AE 工作面刀做了，目录瘦身未做）。 |

### 2.4 草稿 / 同名应用辨识度不足

| 维度 | 说明 |
|---|---|
| **现象** | 运行中默认在前、草稿可折叠已有；但多条**同名**「库存盘点」「小区水电抄表」仅靠修订号/时间区分，第一眼仍抢视线。AH 停刀前要求同名草稿分开列、不当一条。 |
| **证据** | 现网 API：`GET /api/v1/business/apps?workspaceId=ws_personal` 返回 11 条，含 `active`+`draft` 同名各一对；`catalogApps` 只滤 `archived`，`AppCatalogRow` 主标题仅 `app.name`（`Data.tsx`）。 |
| **分类** | **方案写完成但手验没过**（AV #8 声称「同名分开列」；UI 未提供除修订/时间外的区分，AH 未过）。 |

### 2.5 双轨运行时：无 `pages` 的应用仍是脚手架管理台

| 维度 | 说明 |
|---|---|
| **现象** | 有 `spec.pages` 的走 `AppProductPage`（`daily`）；无 `pages` 的激活应用仍顶栏切换 table/form/kanban/stat，并露出「编辑 spec」条，像后台而不是产品页。 |
| **证据** | `hasProductPages`（`app-spec.ts`）；`AppRuntime.tsx` `daily` 分支 vs 非 `product` 分支（视图切换 + `编辑 spec`）。现网样本「本周现场走访记录」`pages: null`，views 仍为 table/form/kanban/stat（API `app_5d1eef…`）。 |
| **分类** | **没做全**（新创建路径有 pages；存量与未迁移 spec 仍占壳层，与「创建应用=产品页」目标不一致）。 |

### 2.6 Builder 差异化：提示词仍带同一套 surface 默认

| 维度 | 说明 |
|---|---|
| **现象** | 不同自然语言描述能否稳定走出「教务 ≠ 运营」两种铺法，依赖模型；提示词每层都注入同一段 `SURFACE_DEFAULT` JSON，易收敛到相似壳。 |
| **证据** | `src/lib/app-builder-prompt.ts`：`SURFACE_DEFAULT` + `PAGES_RULES` 在 create/revise 均拼接；`runtime/apps/layout.mjs` 注释写「不要永远同一套脚手架换列名」但约束在 builder 侧。 |
| **分类** | **方案写完成但手验没过**（AV #1 在固定 SHA 上图过；当前 SHA 未复验，机制上仍易同质）。 |

### 2.7 规格 04 验收第 4 条：看板拖卡改状态

| 维度 | 说明 |
|---|---|
| **现象** | 规格要求拖卡到另一列后表格状态同步变；AD 过关范围**明确不含**拖卡，之后无单独过关记录。 |
| **证据** | `docs/specs/04-app-spec-runtime.md` 验收 #4；`SpecKanban.tsx` 已实现 `commitDrop` → `patchAppRecord`（指针拖拽）；`biz-app-module-plan.md` AD 结果写「拖卡这次没做」。 |
| **分类** | **方案写完成但手验没过**（实现存在，规格级现网验收未闭环）。 |

### 2.8 「打开 / 播放」在浏览器壳与 Electron 壳不一致

| 维度 | 说明 |
|---|---|
| **现象** | 预览 mock 与部分生成链仍落 `https://example.com/...`；AX 用本机 `127.0.0.1:48721/ax-open` 证明，文档记夹具**未进 git**，复现即死链；Electron `openExternal` 路径在 dev 浏览器里不走。 |
| **证据** | `mockRowsForEntity`（`app-spec.ts` L444）；`openAppHref`（`app-platform.ts`）分支 `window.fdeDesktop?.openExternal` vs `window.open`；`biz-app-module-plan.md` AX **未齐**（Electron 窗体没证）。 |
| **分类** | **方案写完成但手验没过**（AV/AW 对 popup 的宽容与 AX 后的仍 **未齐** 并存）。 |

### 2.9 看板拖拽幽灵标题仍会落回 enum/字段值

| 维度 | 说明 |
|---|---|
| **现象** | 列表卡面用 `displayTitle` 空则显示「—」，但拖拽幽灵文案在 title 为空时用 `row[titleField]`，若 `titleField` 误绑 enum 或旧数据无标题，会露出分类值（方案举过药箱「常备」类问题）。 |
| **证据** | `displayTitle` 禁止 enum 作标题（`app-spec.ts`）；`SpecKanban.tsx` L88 `displayTitle(...) \|\| String(row[titleField] ?? row.id)`（L173 卡片正文用 `—` 不用 fallback，拖拽不一致）。`runtime/tests/apps.title.test.mjs` 只测 `displayTitle`，未测 kanban 幽灵。 |
| **分类** | **做了现网坏了**（标题规则在 feed/cards 与 kanban 拖拽 UI 不一致）。 |

### 2.10 接邮箱 / 业务 / 文件：向导有 UI，壳不保证 spec 真接线

| 维度 | 说明 |
|---|---|
| **现象** | 创建向导可切「接平台模块」并勾选 briefing/biz/files，但后续仍完全依赖 `fde-app-builder` 是否写入 `uses` 与合法引用；无二次校验或强制接线。 |
| **证据** | `AppCreateWizard.tsx` `dataConnect` / `buildDataPlacementHint`；勾选为空时直接 `setError` 阻断。勾选后无 BFF 侧硬校验（与 `apps-open-and-capability.md`「接就走已有模块」的差距在 builder 履约）。 |
| **分类** | **方案写完成但手验没过**（AV #4 在验证 SHA 上「过」；非本次复验，机制仍为软约束）。 |

### 2.11 应用壳与打包壳

| 维度 | 说明 |
|---|---|
| **现象** | 决策 14 暂停正式打包；应用内「打开」在 Electron 单包里的行为未验收。 |
| **证据** | `project-context.md` 决策 14；`biz-app-module-plan.md` AX 结果。 |
| **分类** | **没做**（对产品交付壳，非应用 Tab 内 UI，但属「应用在工作台里真用」的缺口）。 |

### 2.12 小尾巴（壳相关但非主线）

| 条目 | 现象 / 证据 | 分类 |
|---|---|---|
| 早报浮窗抽屉标题 | AQ/AR 写明 settings=open 但抽屉标题未扫到 | **方案写完成但手验没过** |
| 左栏旧会话探针字 | 与 AS 相关，属会话残留，不是工作面 spec 字段 | **没做**（清理范围在方案「小尾巴」） |

---

## 3. 已能用的对照句（各一句）

- **创建管道**：应用 Tab 内描述 → 预览 → 采纳激活，数据进 SQLite，新应用不进业务记录 kind chip（AC/AG 主线；`AppCreateWizard` + `AppRuntime.activate`）。
- **打开与删除**：运行中进工作面、草稿进对话框，软删/硬删路径在（AE；`Data.tsx` `openApp` / `AppDeleteConfirm`）。
- **应用独享浮窗**：工作面「浮窗」撕当前应用，主台不整块业务应用模块（AO/AP；`Data.tsx` + `AppFloatSurface`）。
- **模块浮窗记状态**：记忆/计划/IM 等撕出收回不掉默认页（AQ/AR；与文件同套 `StagePanel` 顺序）。
- **建造改 spec**：抽屉内一句话修订 + `putDeclarativeAppSpec` + 回滚（AZ；`AppRuntime.submitRevisePrompt`）。
- **声明能力有真入口**：`runDeclaredPlatformUse` 接各模块，记忆为起草卡（AN 重派；非图谱自动入档）。

---

## 4. 对「已完成」声称的打假要点

| 声称来源 | 核对结论 |
|---|---|
| AV 八项全过、`internal/verify-app-create-av.md` pass | 同文档 AD 链后续 AW–AY 仍 **未齐**；当前 `6dcee573` 未重跑八项；#3/#7 与现网 `AppCapabilityBar`/`example.com` mock 矛盾。 |
| AU「能力跟添加资料同一行」= 产品级融合 | 代码仍是独立 chip 组件，卡片页还 **per-card 重复**（见 2.2）。 |
| AZ「创建和改都走 builder → surface」 | 对**有 `pages` 的新 spec** 成立；走访等无 `pages` 样本仍脚手架（见 2.5）。 |
| AD 看板/加列/回滚 | 加列/回滚有图；**拖卡**规格项未验（见 2.7）。 |

---

## 5. 建议优先级（仅归纳缺口，不派工）

1. 观感 + 能力融合（2.1、2.2）——方案里「创建应用还没齐」核心剩余。  
2. 目录纯化 + 草稿辨识度（2.3、2.4）。  
3. 规格 04 拖卡验收 + 打开在 Electron（2.7、2.8、2.11）。  
4. 无 `pages` 存量迁移或强制 builder 补 `pages`（2.5）。
