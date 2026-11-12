---
name: project-memory
description: Board, memory-card, vocabulary, and graph-write rules for this cwd knowledge graph.
---

# Project memory

Use this skill before recording a board, writing a 记忆卡片, or upserting vocabulary.

## Retrieval

- Time-recall (昨天/今天/上午/中午/下午聊了啥) uses `search_text`. Do not load search-digest or search-query. Do not substitute `list_memory_cards`. If `search_text` is missing from this turn's tools, say the graph tools have not mounted; do not decompress session zstd.
- `search_text` hits are 摘录 (`id` + `then` + nearby text). `total` is the full hit count; a page is not 图里没有.
- After a 摘录, open the diary with `open_node(id)`. `truncated` means the archive is longer.
- `lineage` answers 出自. For a recorded board it also walks 依据 and 因果. `format=turtle` (or `export_graph` with that id) is the W3C PROV-O audit. `query_graph` walks edges.
- Graph facts are 当时, never 现在. Do not tell the user a ticket is still 待审 from the graph; that needs `biz_preview`.
- Only after `search_text` returns nothing may you say it is not in the graph.

## Board

- When the user is choosing, call `find_precedents` first, then `brief_for_decision`, show options, then wait.
- After they confirm, `record_decision`. `because` is optional (supports edges when ids exist). Never put scenario text in because. `check_decision_rules` first if the workspace has rules; `RULE_CONFLICT` means do not write. Empty rules allow. Rules never block talking.
- Omit status to record as 已生效 (Semantica: recorded is live). Auto extract stays 起草. Same `trace_id` or `receipt_id` cannot record 已生效 twice.
- `query_decisions` and `find_precedents` recall recorded boards. Auto 起草 / 作废 / 已冲正 are omitted from precedents. `get_causal_chain` walks supports/CAUSED/PRECEDENT_FOR from a decision_id. `analyze_decision_impact` lists boards this one CAUSED. Empty graph returns [].

## Memory cards

- When the human is correcting / pinning a 铁律 / saying 记住, or after they pick a brief option, call `draft_memory_card` first (`cause=correction|choice`).
- Do not call `nod_memory_card` unless the human nodded. Retire and link need `nodded=true`.
- Leftover 起草 is not 依据. List leftover drafts with `list_memory_cards`.

## Vocabulary

- Hand-written 型 only. Write with `upsert_workspace_vocab` (max 16 concepts per call).
- Do not use `add_entity` to patch a 型. Do not add ERP 行, ticket numbers, or amounts as vocab concepts.
- Do not POST `/semantic-os/python` to import a vocab.

## Canvas

Extract, backup, export, analytics, and reasoning run on the Semantic canvas, not as chat tools.
