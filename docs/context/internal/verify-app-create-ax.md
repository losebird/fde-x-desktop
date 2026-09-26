# Verify: AX 观感 + 真打开 URL

**pass:** yes
**main SHA:** `209e42690859b072f0dc9b93a0b6bae9486ab8af`
**branch:** `main`（未推 origin）
**走访 updatedAt:** unchanged `2026-09-19T06:03:58.932Z`
**拉伸 48/224:** yes（48 / 224）

## SHA

| 项 | 值 |
|---|---|
| daily main | `209e42690859b072f0dc9b93a0b6bae9486ab8af` |
| branch | `main` |

## 1–2

| # | 过/没过 | 证据 |
|---|---|---|
| 1 | 过 | 菜谱卡 heroH=144 标题在色块下=true 播放圆=true 卡数=3。抄表同一屏 overview/compose/chart/feed=true/true/true/true，流水行高=64，记下按钮高=40。未写死应用名/菜系/水电气。 |
| 2 | 过 | 点播放 href=`http://127.0.0.1:48721/ax-open`。弹出页 URL=`http://127.0.0.1:48721/ax-open` 正文含「AX打开证明」。不是错误页。桌面壳 `setWindowOpenHandler`+openExternal。未用 iframe 冒充。未写死域名。 |

## AO–AW / 决策 22

| 项 | 结果 |
|---|---|
| 工作面事务底座条 | 无 |
| 三 Tab | 应用=true 业务记录=true 操作记录=true |
| 创建入口 | true |
| 删除入口 | true |
| 走访 id | `app_5d1eef0062114901b4797d705e5166b5` 仍在目录=true |
| 走访 updatedAt | before 2026-09-19T06:03:58.932Z / after 2026-09-19T06:03:58.932Z |
| 拉宽 aside | 48px（要 48） |
| 拉窄 aside | 224px（要 224） |
| StagePanel iframe 指针屏蔽 | 未拆 |
| 静默 biz_write | no |
| 自动发 IM | no |
| 新造应用 | no |
| 5174 | 未杀，仍在听 pid 39206 |

已对：1 观感密度（菜谱卡色块下标题+中心播放圆，抄表概览/记一笔/图/流水更密）现网图；2 播放打开 `http://127.0.0.1:48721/ax-open` 正文「AX打开证明」，不是错误页；走访 `app_5d1eef0062114901b4797d705e5166b5` updatedAt 未改；拉伸 48/224。

未对：桌面 Electron 包体现网（本机 5174 Chrome；壳代码已接 setWindowOpenHandler / openExternal）。

仍差：无（本刀两项）。

## 图

四格：更密菜谱卡、更密抄表屏、真打开页、目录走访还在。

`files/media/app-create-ax.png`
