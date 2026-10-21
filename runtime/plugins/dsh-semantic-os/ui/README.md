# 语义页 UI

本插件自己的图谱、分析、决策、词表、导入导出页面。

实现方法按 Semantica 工作台一比一复刻（Sigma / graphology 点选、邻域、路径、时序），数据走 `/semantic-os` 产品 API，不挂官方 Explorer 应用。文案走 `dsh-i18n` + 插件 `zh.json` / `en.json`。

用户装的是插件包，里面已经带 `dist/`。不要让用户在本机跑 Vite。

开发者改完本目录之后，在插件根目录执行 `npm run build:ui`，再发布。
