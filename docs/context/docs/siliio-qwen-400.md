# 硅基 Qwen3.8-27B 报 400（CONTEXT_WINDOW_EXCEEDED）

## 结论（先读）——推理打成 **Off**，只发「你好」，为什么还不能用

**因为发给硅基的第一条仍是 `role: developer`，不是 `system`；硅基用 20015 拒掉，和「推理档位 Off」无关。**

本机 **~20:43** 会话 **`session-3ad2f0bf-7859-4a49-87d2-2abaa582739c`**：

| 核对项 | 本机结果 |
|--------|----------|
| UI / 请求头推理 | seq **11** `request/header` · **`reasoningEffort: "off"`** |
| Harness 事件顺序 | system(7) →「你好」(8) → system-prompt 注入 **user**(9) → skill-catalog **user**(10) → 请求(11) |
| **发给硅基的 wire `messages` 角色**（同会话文本 + pi-ai `convertMessages` 路径复现） | **`developer` → `user` → `user` → `user`** |
| **不是**「system 不在开头」 | 若属这类，硅基正文是 **`System message must be at the beginning...`**；本 session **不是** |
| **硅基 raw HTTP 正文** | `{"code":20015,"message":"Input tag 'developer' found using 'role' does not match any of the expected tags: 'system', 'user', 'assistant', 'tool'","data":null}` |
| UI `CONTEXT_WINDOW_EXCEEDED` | 仍是 SDK **`400 status code (no body)`** 被 pi-ai 错标，**不是**硅基在说窗口满 |

**一句话给 Ace：** 关了推理只影响本轮 **thinking 参数**；**Off 这次原始 wire 里主 system 仍是 `developer`**，硅基不认 → 400 → 界面误标溢出。**不是** catalog 插成 system，**也不是** system 排在「你好」后面。

---

## 20:43 Off 会话证据

- 日志：`~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-3ad2f0bf-7859-4a49-87d2-2abaa582739c/session.v3.jsonl.zstd`
- 失败：seq **15** `assistant/attempt` · `400 status code (no body)` · Harness `CONTEXT_WINDOW_EXCEEDED`
- 请求：`POST https://api.siliconflow.cn/v1/chat/completions` · `model: Qwen/Qwen3.8-27B` · provider **`sili`** · **64 tools**
- 配置：`~/.dsh-fde-x/settings.yaml` · `api: openai-completions` · `baseURL: https://api.siliconflow.cn/v1`

**本机复现：** 用 seq 7–10 正文 + seq 11 工具表，按 pi-ai 转换且 **`reasoningEffort: off`** → wire 仍为 **`developer` + 3×user** → 硅基 **20015（developer tag）**；同内容首条改为 **`system`** → **HTTP 200**。

---

## 其它已钉案例（别和 Off 会话混为一谈）

| 会话 | 拒因（硅基 20015 正文） |
|------|-------------------------|
| **`session-b6bb3c3e…`**（~20:32，Default/未带 off） | 同上 **`developer` tag**（wire 已复现） |
| **`session-5c4bb97d…`**（grok → 硅基） | **`System message must be at the beginning...`**（历史里多条 system 穿插） |

---

## 附

- **400** 来自硅基；FDE BFF **4318 不代理** LLM。
- 模型 id **`Qwen/Qwen3.8-27B`** 在硅基 `/v1/models` 存在；密钥与 URL 对短请求可 200，**不是** id/路由/密钥问题。
- **模型管理页**：与上述 wire **developer** 行为 **无已证直接因果**（本轮未改 DSH 转换逻辑）。
