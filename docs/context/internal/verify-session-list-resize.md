---
cursor:
  subagentId: "bc-8a7f0579-5dca-5a20-a100-71bf36f821d7"
---

# Verify: session list follows right-rail resize

**pass:** yes  
**main SHA:** `2b44ae39a3bde93e23d1683ac6f0d66c08b5c5e1`  
**branch:** `main`（未推 origin）  
**hardcoded:** none

## 根因

AE/AC 把 DSH iframe 稳定接通后，StagePanel 拉伸没有浮窗那套 iframe 指针屏蔽；跨源 iframe 抢走 pointer capture，右栏宽度到不了 `MIN_LEFT_OPEN`，左栏会话列表就不会自动收起/展开。

## 拉伸（现网 5174，1600×1000）

| 动作 | 会话列表 | 实测 |
|---|---|---|
| 拉宽右栏 | 收起 | aside 48px，无「会话」标题，panel 872px，main 640px |
| 拉窄右栏 | 展开 | aside 224px，有「会话」标题，panel 360px，main 1152px |

规则仍是 `AI.tsx` `leftForced ?? width >= 720`，没有新交互。

## 决策 22 旧路径

| 项 | 结果 |
|---|---|
| 应用 / 业务记录 / 操作记录 三 Tab | yes |
| 应用列表 | yes（catalog 仍在，「本周现场走访记录」） |
| 应用打开 | yes（独立工作面 + 返回列表，再回 catalog） |
| 应用删除入口 | yes（列表「删除」仍在，未点确认） |
| 业务记录 Tab | yes |
| 操作记录 Tab | yes |
| 静默 biz_write | no |
| 硬编码 | none |
| AD | 未继续 |

## 图

左拉窄（会话列表展开）/ 右拉宽（会话列表收起）。

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/session-list-resize.png`
