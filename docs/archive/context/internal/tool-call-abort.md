---
cursor:
  subagentId: "bc-53b37f61-f16b-5cbb-82b1-e4ec62fd8f71"
---

# `tool call aborted` — jsonl 摘录

完整根因：[tool-call-abort-root-cause.md](/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/docs/tool-call-abort-root-cause.md)

## Session `77396503`（16:01）

**日志：** `~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-77396503-7612-415a-9948-70253301d733/session.v3.jsonl.zstd`

### plugin 注入的「user」（不是 Ace 又发一句）

```json
{"type":"user/message","seq":92,"time":1790236871302,"data":{
  "source":{"kind":"plugin","plugin":"dsh-lan-assist"},
  "content":[{"type":"text","text":"库里已改上。下面是现查到的现在值，不是图上的当时。\n…"}]
}}
```

### step 1 闸把现查落成新建 candidate

```json
// tool/result seq 98（节选）
"action":"新建","preview_id":"pv_c68a88264cf8da07","sheet":{"kind":"工单","action":"新建","rows":[{"no":"新单",...}]}
```

### 四 tool 同毫秒 abort + turn/end

```json
{"type":"tool/result","seq":107,"error":{"name":"AbortError","code":"ABORTED"}}
// seq 108–110 同上
{"type":"turn/end","seq":112,"data":{"turn":3,"reason":{"kind":"aborted","reason":{"kind":"user"}}}}
```

## 程序 cancel 调用点（均可能记成 `user`）

```79:79:runtime/vendor-overlays/dsh-lan-assist/index.js
      try { agent.cancel({ kind: 'user' }, { keepInbox: true }) } catch { /* leftover cancel is best-effort */ }
```

```231:237:runtime/vendor-overlays/dsh-lan-assist/tools.js
        if (outcome && outcome.cancel) {
          const live = exec && exec.agent
          if (live && typeof live.cancel === 'function') {
            try { live.cancel({ kind: 'user' }, { keepInbox: true }) } catch { /* leftover cancel is best-effort */ }
```

```952:965:src/components/biz/RecordsPanel.tsx
  const abortLeftoverAskTurn = (sheet: Record<string, unknown>) => {
    ...
    void runtimeApi.cancelAi(cancelSessionId).catch(() => undefined)
  }
```

## leftover 判定（16:01 主因）

```66:87:runtime/vendor-overlays/dsh-lan-assist/session-round.js
function leftoverQueryCoveringWrite(prev, incoming) {
  ...
  if (sheetAction(incoming) !== '现查') return false
  ...
}
```

Node 复现：`isLeftoverAfterCandidate({action:'新建',rows:[{no:'新单'}]}, {action:'现查',rows:[{no:'388419542908928'}],speech:'查工单 388419542908928 现在的值'})` → **true**。

## W1 `7eaa79f6`（对照）

abort 前 `biz_preview` 结果仍为 **`action:新建`**（`pv_be623a9d4d2bf17f`）；随后 `biz_preview` 现查 + `biz_traces` 并行，**preview 条 abort** — 同模式，非「手动停」。
