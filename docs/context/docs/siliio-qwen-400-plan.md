# 硅基 Qwen 不能用：怎么收

对照 [硅基 Qwen 400 是怎么回事](siliio-qwen-400.md)。点头之前不改。

权威是硅基这条接口认哪些角色：只要 `system` / `user` / `assistant` / `tool`。配置里有没有推理档、界面 Off 还是 High，都不能把系统提示发成 `developer`。

## 现在为什么关 Off 也不行

界面 Off 只改这一轮的 `reasoningEffort`。转换层看见这条模型配置里有 `reasoningEfforts`，照样把主系统提示写成 `developer`。硅基 20015 拒掉。溢出标签仍是误标。

## 怎么收

1. **马上能用**：这条硅基 Qwen 的配置里去掉 `reasoningEfforts`，重载核心，新开会话。只拨 Off 不够。
2. **正路**：对硅基这类不认 `developer` 的接口，发出去的第一条必须是 `system`。界面 Off 必须等于不发 `developer`。发现模型时不要给这类接口写上会逼出发 `developer` 的推理档。
3. **不要**：只改文案；只藏 Off；手改 yaml 当长期做法；把硅基误标成窗口溢出留着当真相。

现查、改行、过账、其它提供方（能吃 `developer` 的）不要被这刀改坏。

## 你怎么验

点头改上之后。硅基 Qwen，推理 Off 和新开会话「你好」能回。打开推理档也不再因 `developer` 被 20015 拒（要么发 `system`，要么这类接口不提供推理档）。grok2api 等原来能用的还在。
