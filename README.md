# FDE-X Desktop

本机工作台。浏览器只打自己的 API；AI / IM / 记忆分别由 DSH、lan-assist、semantic-os 在本机提供。

## 启动

```bash
# 终端 1：运行时（默认 127.0.0.1:4318）
FDE_DSH_BIN="$(command -v dsh)" FDE_AI_WORKSPACE="$PWD" npm run runtime

# 终端 2：界面
npm run dev
```

Vite 只把 `/api/v1` 和 `/health` 转到 4318。需要绝对路径工作区（`FDE_AI_WORKSPACE`）。

## 权威

| 能力 | 引擎 |
|---|---|
| 会话、模型、工具、轨迹 | DSH Host |
| IM、业务过账 | dsh-lan-assist |
| 记忆搜索 | dsh-semantic-os |
| 待办/布局 | 本机 SQLite + 浏览器壳状态 |

不要用浏览器打开 DSH 官方网页当产品界面。接线规格见 `PRODUCTION-SPEC.md`（冲突以 §0.5 为准）。
