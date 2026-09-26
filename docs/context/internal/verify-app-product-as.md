# Verify: AS 产品页不要工具条和探针字

**pass:** yes
**main SHA:** `b298fba710e806722d2465804e3ce390dd627991`
**branch:** `main`（未推 origin）
**能力入口怎么放:** float=工作面顶栏「浮窗」；其余声明能力=记下栏真入口；没声明的不画
**产品页顶是否工具条:** no（栏目）
**说明里还有没有探针字:** no
**走访 updatedAt:** unchanged
**拉伸 48/224:** yes

## SHA

| 项 | 值 |
|---|---|
| daily main | `b298fba710e806722d2465804e3ce390dd627991` |
| branch | `main` |
| 产品提交 | `b298fba710e806722d2465804e3ce390dd627991` |

## 能力入口怎么放

| 入口 | 放哪 | 点了 | 现网看到 |
|---|---|---|---|
| float 浮窗 | 工作面顶栏（返回列表旁），不在产品栏目顶 | yes | 应用浮窗=yes 「—」收回=yes |
| files 引用文件 | 记下栏 | yes | stage=文件 tree=yes |
| memory 起草记忆卡片 | 记下栏 | yes | 起草卡=yes 图谱=no |
| im 拟回进输入框 | 记下栏 | yes | composer=filled send=no |
| briefing 打开早报 | 记下栏 | yes | 早报=yes |
| biz 打开业务记录 | 记下栏 | yes | records=yes 确认过账=no |
| 产品栏目顶 | 只铺这个应用自己的栏目 | — | nav=`资料板` 工具条=no |

## 卡片说明

| 项 | 结果 |
|---|---|
| 标题 | 接口说明 / 验收清单 / 入门手册 / 设计规范 / 周报模板 / 待办备忘 |
| 说明 | 字段和错误码 / 发布前对照 / 新同事先看这个 / 间距和字号 / 每周五更新 / 临时记下 |
| 探针字 | none |

## AO–AR / 决策 22

| 项 | 结果 |
|---|---|
| 按钮「浮窗」 | 浮窗 |
| 旧文案「撕出浮窗」 | gone |
| 「—」收回工作面 | yes |
| 连接器空页 | 未闪 |
| 拉宽 aside | 48px（要 48） |
| 拉窄 aside | 224px（要 224） |
| StagePanel iframe 指针屏蔽 | 未拆 |
| 三 Tab | 应用=true 业务记录=true 操作记录=true |
| 创建入口 | yes |
| 删除入口 | yes |
| 走访 id | `app_5d1eef0062114901b4797d705e5166b5` |
| 走访 updatedAt | before 2026-09-19T06:03:58.932Z / after 2026-09-19T06:03:58.932Z |
| 静默 biz_write | no |
| 自动发 IM | no |
| 新造应用 | no |
| 5174 | 未杀，仍在听 |

已对：产品栏目顶只铺「资料板」，没有「问 AI / 浮窗 / 引用文件 / …」一排。卡片说明来自 spec 字段并剥掉探针 token（字段和错误码 / 发布前对照 / 新同事先看这个 / 间距和字号 / 每周五更新 / 临时记下）。float 在工作面顶栏「浮窗」，点开是这个应用的浮窗，「—」收回仍是工作面。其余声明入口在记下栏，点到已有模块。走访 `app_5d1eef0062114901b4797d705e5166b5` updatedAt 仍是 2026-09-19T06:03:58.932Z。拉伸 48/224。StagePanel iframe 指针屏蔽未拆。`main` `b298fba710e806722d2465804e3ce390dd627991`。未推 origin。未静默写。未新造应用。未改走访。

未对：早报抽屉标题。

仍差：左栏旧会话正文还留着当时记进去的探针字，那不是卡片说明。

## 图

产品页：栏目不是一排工具条；卡片说明是业务文案。PNG `\x89PNG` 248285 bytes。

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/app-product-as.png`

本机 `/cursor` 只读（`mkdir: /cursor: Read-only file system`），与 AR 相同，协调器侧读 `files/`。


