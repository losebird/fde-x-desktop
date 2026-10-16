# verify-records-ops-full

SHA: `2166d504c24b7373de346299528d1506bbd3d7f5`
PNG SHA256 (16): `50033f7dc0178d72`

| # | Criterion | Live 5174 |
|---|-----------|-----------|
| 1 | 操作列来自词表 can | yes |
| 2 | 无「规划数据操作」 | yes |
| 3 | 选中行高亮 | yes |
| 4 | 本会话浮现历史有本 session 项 | yes |
| 5 | Kind chips 仅当前操作绑定 kinds | yes |
| 6 | 单元格 enum 标题非 raw code | yes |

Hardcoded literals（状态/停用/客户/工单 写死）: none

Details:
- 1: buttons=[改行,删除] expected=[改行,删除] kind=工单
- 2: ok
- 3: bg=rgba(231, 240, 233, 0.8) cls=bg-brand-soft/80
- 4: options=40 apiSurfaces=0 labels=工单 · 现查 · 09/18 14:17 | 工单 · 现查 · 09/18 14:17
- 5: chips=工单20
- 6: raw=none zh=处理中,已解决,已解决,已解决,已解决

Evidence: `media/records-ops-full.png`, `media/records-history-open.png` · probe on `http://127.0.0.1:5174/data` · workspace `/Users/zxz/Documents/ai-project/fdex测试`
