---
cursor:
  subagentId: "bc-8ae62cbe-d0dc-5821-a103-92fc9ce25625"
---

# Verify: AE′ 打开与删除

**pass:** yes  
**hardcoded:** none  
**origin:** not pushed  
**silent biz_write:** no  
**confirmed:** no（未点业务系统确认过账）  
**草稿对话框:** yes  
**使用离开列表页:** yes  
**决策 22 / AC 一条龙:** yes（走访记录打开后仍见已有行，能新建）  
**三 Tab / kind chip / 操作记录:** yes  
**step 9 / eval set / packaging / overlay 收编 / 决策 20/21 / 切会话 AB / AD / L2:** not done

## SHA

| 项 | 值 |
|---|---|
| daily main | `8acb5c3db4bfcee94676c8f3f6ee0e702c5464db` |
| branch | `main` |
| 现网脚本记下的 SHA | `98e3e5f9f555a9201baecd9b79c7bf1309b11a2f`（随后只补了 catalog 标记的闭合标签 `8acb5c3`） |

## 过关项

| 项 | 结果 | 证据 |
|---|---|---|
| 草稿是否对话框 | yes | 点草稿出现 overlay：文案「草稿预览 · 采纳后进入工作面，不在列表页填表」+「采纳并激活」 |
| 使用是否离开列表页 | yes | 点「本周现场走访记录」后 catalog 消失，工作面有「返回列表」「独立工作面」 |
| 删除草稿怎么确认 | 确认即删 | 对话框「删除草稿 / 确认后这条草稿从列表拿掉」→ 点「确认删除」；`app_0bd1507d92694ca9a56cd1e0a52c5eab` 从列表消失 |
| 删除已激活怎么确认 | 二次确认，默认软删 | 「删除运行中的应用 / 再确认一次」+ 未勾「连数据一起删」→「确认删除」；列表消失，status=`archived`，表 `app_ae-a-mu7xhnsp__item` 仍在 |
| 静默写业务系统 | no | 未点确认过账；无 `biz_write` |
| 硬编码 | none | 产品 `src/` 无邮件/教务/PPT/电商名单；fixture 名只在 store 探针里 |
| AC 已有行 | yes | 工作面表格 `走访-mu7vaswd` / 2026-09-19 / 计划，共 1 条 |
| AC 能新建 | yes | 工作面 `button.btn-brand`「新建」可见 |
| 三 Tab | yes | 应用 / 业务记录 / 操作记录 |
| kind chip | yes | 销售回款1、销售合同1；本地应用名未进 chip |
| 操作记录 | yes | 切到操作记录 Tab 能打开 |

## 现网未测

未再走一遍 AI 创建向导（沿用 AC 已激活应用 + API 临时草稿/归档应用）。未点硬删勾选（默认软删已证，表还在）。

## 图

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/app-open-ae.png`  
已激活删除确认：再确认一次、连数据一起删未勾、确认删除。
