---
name: find-skill
description: 按技能名称在 ClawHub 查找对应安装包。用户只说名字时用这个。
---

# find-skill

用户给出技能名称时，先按精确 slug 查 ClawHub（`GET https://clawhub.ai/api/v1/search?q=<name>&mode=exact`），没有再按相关性搜。命中后给出 slug、显示名、摘要和安装来源 `clawhub install <slug>`。

FDE 技能安装口走同一条查找：名称 → ClawHub → 找不到再请用户补地址或命令。不要编造未搜到的包。
