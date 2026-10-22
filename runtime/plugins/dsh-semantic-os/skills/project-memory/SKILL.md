---
name: project-memory
description: Board, memory-card, vocabulary, and graph-write rules for this cwd knowledge graph.
---

# Project memory

Use this skill before recording a board, writing a 记忆卡片, or upserting vocabulary.

## Retrieval

- `search_text` hits are 摘录 (`id` + `then` + nearby text). `total` is the full hit count; a page is not 图里没有.
- After a 摘录, open the diary with `open_node(id)`. `truncated` means the archive is longer.
- `lineage` answers 出自. `query_graph` walks edges.
- Graph facts are 当时, never 现在. Do not tell the user a ticket is still 待审 from the graph; that needs `biz_preview`.
- Only after `search_text` returns nothing may you say it is not in the graph.

## Board

- When the user is choosing, call `brief_for_decision` first, show options, then wait.
- After they confirm, `record_decision` with `because` ids from the brief. The gate rejects a board with no because. Never put scenario text in because.
- Omit status to stay 起草. `status=已生效` needs `leads_to`, `receipt_id`, and `nod_kind=业务过账`.
- Same `trace_id` or `receipt_id` cannot record 已生效 twice.
- `query_decisions` recalls 已生效 plus human 起草. `find_precedents` only returns 已生效.

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
