# 业务记录 · 现查筛选 + 翻页（live）

- **SHA**: `d2868f406dd379e48e154f8a6a4e3d30fa706763` (`d2868f4`)
- **现网**: `http://127.0.0.1:5174` · BFF `4318` · 工作区 **fdex测试1** · cwd `/Users/zxz/Documents/ai-project/fdex测试`
- **DSH**: 已 POST /api/v1/ai/connect
- **筛选生效**: no（未过滤 20 行 · 条件 `status=processing` → 70 行；不得为 1665 若条件排除行）
- **翻页第 2 页 / 序号 11**: yes
- **截图**: [records-filter-page.png](../media/records-filter-page.png)

## 备注

- connect:{"ok":true,"connected":true,"state":"connected"}
- probe:{"kind":"工单","statusField":"status","all":{"rows":20},"filtered":{"rows":70,"where":[{"keys":["status"],"values":["processing"],"not":false,"dateBefore":[],"dateAfter":[]}]}}
- countText:共 70 条 · 局域网业务协作适配器 · 现查 11:01
- pageLabel:第 2 / 7 页;serial:11
