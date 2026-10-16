# 操作历史列表宽度 · 验证（2026-09-18）

## 决定

[`records-panel-decisions.md`](../docs/records-panel-decisions.md) §8：列表随业务应用内容区拉满，不留右空槽；点一条仍用抽屉看 trace。

## 改动

| 文件 | 变更 |
|------|------|
| `src/components/biz/OperationRecordPanel.tsx` | `Card`：`max-w-3xl` → `w-full`（去掉双栏 trace 时代的宽度上限） |

SHA-256 `src/components/biz/OperationRecordPanel.tsx`：`c3f0fc49791e0ff7f0cab47eb3d04e034fb703e3a015a7d9a0ae0dbf77d1545e`

## CDP 实测（127.0.0.1:5174 · viewport 1440×900 · Stage 业务应用）

| 指标 | 值 |
|------|-----|
| `stage-content` 内容区（含 `px-6`） | 759px |
| 可排列表宽度（减左右 padding） | 711px |
| 操作历史 `Card` 宽度 | **711px**（= 父级 `min-w-0` 100%） |
| 同页「业务记录」主 `Card` 宽度 | **711px**（对齐） |
| `Card` class 含 `max-w-3xl` | **否** |
| `getComputedStyle(card).maxWidth` | `none` |

截图：`media/operation-history-fullwidth.png`（绿条与列表卡片同宽，贴满 Stage 内边距后的内容区；无右侧整页 trace 槽）

## 未改

- 抽屉 trace / 「审查 corpus」 / 回退逻辑未动。
- 其它页面（业务记录、应用概览）未动。
