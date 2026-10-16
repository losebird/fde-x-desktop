# verify-records-ops-actions

SHA: `2166d504c24b7373de346299528d1506bbd3d7f5`
PNG SHA256 (16): `2d8bfbfeb11c95b3`

| Criterion | Live 5174 |
|-----------|-----------|
| 横向滚到行尾，操作列入视口 | yes |
| 操作列来自词表 can | yes |
| 选中行高亮 | yes |
| PNG 可读改行/删除 | yes |

Details:
- prep: 关预览抽屉 → 点「返回」→ 本会话浮现历史选「工单·现查」恢复 165 行表
- scrollLeft=0 maxScroll=0 rows=10（本视口宽下表未产生横向溢出；操作列在框内）
- buttons=[改行,删除] expected=[改行,删除] kind=工单
- selectedCls=bg-brand-soft/80

Evidence: `media/records-ops-actions.png` · probe on `http://127.0.0.1:5174/data` · workspace `/Users/zxz/Documents/ai-project/fdex测试`
