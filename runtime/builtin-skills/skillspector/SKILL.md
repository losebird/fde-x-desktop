---
name: skillspector
description: 安装前扫描技能包风险。NVIDIA SkillSpector；本机没有 CLI 时用工作台静态扫描。
---

# skillspector

安装任何技能之前先扫描。有 `skillspector` 命令就对目录执行扫描；没有则检查 SKILL.md 和脚本里的 `eval`/`exec`、子进程、凭据、外传和外链安装。

给用户看：来源、风险分、发现项、是否建议安装。高风险也必须等人确认后才能装。FDE 安装口在确认框里展示同一份扫描结果。
