# Verify: AW 补齐 AV 未齐

**pass:** yes
**main SHA:** `ffa47673bafc61bcc0db881e354c759e13feb2dd`
**branch:** `main`（未推 origin）
**走访 updatedAt:** unchanged `2026-09-19T06:03:58.932Z`
**拉伸 48/224:** yes（48 / 224）

## SHA

| 项 | 值 |
|---|---|
| daily main | `ffa47673bafc61bcc0db881e354c759e13feb2dd` |
| branch | `main` |

## 1–3

| # | 过/没过 | 证据 |
|---|---|---|
| 1 | 过 | 家里的菜谱工作面 3 张卡（红烧排骨 / 番茄炒蛋 / 清炒时蔬），按组横排。标题白字压在 token 色块上（红烧排骨 parentBg=`rgb(212, 162, 76)` parentH=104），播放是 amber 实心芯片。小区水电抄表同一屏：概览 1 / 12、记一笔、分类图（水 12 100%）、流水「东门水表」。未写死应用名/菜系/水电气/颜色字典。 |
| 2 | 过 | 抄表点「摘成待办」后右侧计划·待办，行 `data-plan-task-selected` 标题「小区水电抄表」（id `task_0c4ec3d0192244ef819dfeffcc102a5b`）。图里那一行有选中底。不只是 `/api/v1/plan/tasks` 计数。 |
| 3 | 过 | 点「播放」。`<a data-app-card-href="https://example.com/watch?v=aw-ribs">`。`window.open` 返回窗口（`data-app-opened-mode=popup`，`data-app-opened-href` 同 URL）。无头 `popup` 事件空；截到的是 Chrome 正在打开该 URL 的页（`无法访问此网站` + 完整 URL，本机隧道 `ERR_TUNNEL_CONNECTION_FAILED`）。URL 对得上。 |

## AO–AV / 决策 22

| 项 | 结果 |
|---|---|
| 工作面事务底座条 | 无 |
| 栏目顶工具条 | no |
| 三 Tab | 应用=true 业务记录=true 操作记录=true |
| 创建入口 | yes |
| 删除入口 | yes |
| 走访 id | `app_5d1eef0062114901b4797d705e5166b5` 仍在目录 |
| 走访 updatedAt | before 2026-09-19T06:03:58.932Z / after 2026-09-19T06:03:58.932Z |
| 拉宽 aside | 48px（要 48；第二轮拉宽右栏量到） |
| 拉窄 aside | 224px（要 224） |
| StagePanel iframe 指针屏蔽 | 未拆（`index.css` `[data-floating-drag] iframe`；`StagePanel` `iframeDragShield`） |
| 静默 biz_write | no |
| 自动发 IM | no |
| 新造第三套应用 | no（仍用家里的菜谱 / 小区水电抄表） |
| 5174 | 未杀，仍在听 pid 39206 |

已对：1 观感密度（菜谱卡色块标题 + 抄表概览/记一笔/图/流水）现网图；2 计划页选中刚摘待办；3 播放点击后 URL=`https://example.com/watch?v=aw-ribs` 窗口发生（Chrome 打开该地址）；走访 `app_5d1eef0062114901b4797d705e5166b5` updatedAt 未改；拉伸 48/224（第二轮）。

未对：无头 Playwright `page.waitForEvent('popup')` 的 Page 对象（事件空，改用 `window.open` 返回值 + 打开页截图）。

仍差：无（本刀三条尾巴）。example.com 本机隧道连不上，打开页是浏览器错误页，但地址栏/正文 URL 已对上。

## 图

四格：更密菜谱卡、更密抄表屏、计划里选中的待办、播放打开的 URL 页。

`files/media/app-create-aw.png`
