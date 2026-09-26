---
cursor:
  subagentId: "bc-74ab66a4-c9e1-5ba4-b947-c7e73ef89595"
---
# Verify: AZ builder 创建和改写进 spec

**pass:** yes
**main SHA:** `cb694ad6246fc9ad913682f5f6e78b66b740480e`
**branch:** `main`（未推 origin）
**走访 updatedAt:** unchanged `2026-09-19T06:03:58.932Z`
**拉伸 48/224:** yes（224 / 48）

## 1/2/3

| # | 过/没过 | 证据 |
|---|---|---|
| 1 spec 写得下铺法 | 过 | 新建 surface=`{"nav":"tabs","density":"packed","defaultPage":"page-plant","cards":{"minWidth":"narrow","hero":"below"},"ledger":{"composeChart":"pair","feed":"rows"},"primary":{"where":"card","kind":"open"}}` pages=`[{"id":"page-plant","label":"阳台植物","kinds":["cards","compose"]}]` |
| 2 新建一句新描述 | 过 | 描述="阳台植物浇水：按品种分组卡片，尽量挤密一行，主操作是打开养护说明链接。本地台账。" 名=阳台植物浇水 id=app_b03684ff6d4e4758b16c45ed20a1a129 DOM density=packed cards=true |
| 3 改已有同一 builder | 过 | 夹具家里的菜谱 修订 1→3 改前 surface=null 改后=`{"nav":"tabs","density":"packed","defaultPage":"page-recipe","cards":{"minWidth":"narrow","hero":"below","columns":6},"ledger":{"composeChart":"pair","feed":"rows"},"primary":{"where":"card","kind":"play"}}` heroH 112→64 titleBelow=true |

## 决策 22

| 项 | 过/没过 | 证据 |
|---|---|---|
| 三 Tab | 过 | 应用=true 业务记录=true 操作记录=true |
| 创建入口 | 过 | true |
| 草稿对话框 | 过 | true |
| 删除 | 过 | true |
| 目录运行中在前 | 过 | true |
| 摘成待办 | 过 | 抄表 plan 入口=true |
| 打开/播放 | 过 | 菜谱 play/open 改前=true/false |
| 问 AI 左栏 | 过 | askAi=true left={"asideW":48,"hit":false,"snippet":""} |
| 声明了才画 | 过 | created uses=[] 抄表 uses 未铺满 |
| 拉伸 48/224 | 过 | 224 / 48 |
| 走访不动 | 过 | before 2026-09-19T06:03:58.932Z after 2026-09-19T06:03:58.932Z |

## 禁区

静默 biz_write=false 自动发 IM=false 5174 未杀=true 未推 origin=true 未 git add -A



已对：surface 契约现网写进 spec 新建工作面按这份 spec 画 已有应用同一 builder 出新修订且 spec 变了
未对：无
仍差：无（本刀三条）

## 图

四格：新建铺法、菜谱改前、菜谱改后、目录走访还在。
