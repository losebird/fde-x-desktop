---
cursor:
  subagentId: "bc-14a7d80c-0137-5524-8dbe-1f25ed36fc1e"
---

# 抄表夹具「问 AI」click 已从 verify 拿掉

Ace 批：只改 verify，不点小区水电抄表的「问 AI」。产品 `runDeclaredPlatformUse` / `AppCapabilityBar` 未动。未删脚本。未 git add。未开分支。未跑新印证。因见 [chaobiao-session-cause.md](chaobiao-session-cause.md)。

## 改了什么

收口脚本不再打开 `LEDGER_ID=app_9de6038b186a4e9786e28bc4f48add9d`，也不点 `[data-app-use="ai"]`。`out.askAiSkipped = true`；`d22.askAi = 'skipped'`（真值，不把 pass 卡死）。对照表该格写 **跳过**，不是过/没过。Tabs / 创建 / 拉伸 / 走访仍跑。

AZ 仍打开抄表做 productShot / 摘成待办，**只拿掉那次问 AI click**。没有另造「新应用问 AI」点击。`productShot` 里仍探测按钮是否存在（不是 click）。

## 文件

| 脚本 | 动作 |
|---|---|
| `internal/verify-records-bind-pipe-bi.mjs` | 去掉打开抄表 + 问 AI click；决策22 行写 问AI=跳过 |
| `internal/verify-records-bind-pipe-bh.mjs` | 同上（无单独问 AI md 行） |
| `internal/verify-records-close-ba.mjs` | 同上；问 AI 行 → 跳过 |
| `internal/verify-records-close-bb.mjs` | 同上 |
| `internal/verify-records-close-bc.mjs` | 同上 |
| `internal/verify-records-close-bd.mjs` | 同上 |
| `internal/verify-records-close-be.mjs` | 同上 |
| `internal/verify-records-close-bg.mjs` | 同上 |
| `internal/verify-records-query-miss-bf.mjs` | 同上 |
| `internal/verify-app-create-az.mjs` | 仍 `openRunningApp(LEDGER_ID)`；去掉 click；问 AI 左栏 → 跳过点抄表 |

未改：`src/`、`runtime/`、inquiry 文件。`LEDGER_ID` 常量仍留在脚本里。现网 leftover 会话未删。

`/cursor/stores` 本机不可写；写在 Mac AgentStores twin。
