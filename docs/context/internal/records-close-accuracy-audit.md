---
cursor:
  subagentId: "bc-39f33ea4-24c9-560d-b385-2ef3b2b38652"
---

# Records-close accuracy audit

SHA `dfb28ab85a525209b337844d7775f3c5884ae164` on `cursor/records-close-session-end-fc3c`. Read only. No product edit.

Verdict: the spoken-label where is **not generic**. No kind name, field name, enum value, or the words 领用 / 归还 / 报废 / 调拨 / 固定资产 / 资产领用归还 is hardcoded in that change. A relation 现查 with no enum label hands **one capped page**, and `共 N 条` is that stored length. When N equals the lookup page size, N is the page length, not a confirmed total.

## 1. Spoken label → where

The new match walks every enum on a vocab kind’s schema and, if a label occurs in the utterance, can attach that code as a where. It does not name a business.

Clues come from schema enums. The say is the label, or the code when the label is empty. Keys are the field title (or name) plus the field name (`enum-clues.js:127-134`):

```127:134:runtime/vendor-overlays/dsh-lan-assist/enum-clues.js
    for (const [code, label] of Object.entries(enums)) {
      const say = stringList(label).length ? stringList(label) : [String(code)]
      clues.push({
        say,
        keys: [shape, name],
        values: [String(code)],
      })
    }
```

A hit is filterable when a key equals an enum-backed field name or title on the assigned kind (`slots.js:760-782`):

```760:770:runtime/vendor-overlays/dsh-lan-assist/slots.js
function enumBackedField(fields, key) {
  const want = String(key || '').trim()
  if (!want) return false
  return (Array.isArray(fields) ? fields : []).some((row) => {
    if (!row || typeof row !== 'object') return false
    const name = String(row.name || '').trim()
    const title = String(row.title || (row.uiSchema && row.uiSchema.title) || '').trim()
    if (name !== want && title !== want) return false
    const enums = row.enums
    return Boolean(enums && typeof enums === 'object' && !Array.isArray(enums) && Object.keys(enums).length)
  })
}
```

```773:782:runtime/vendor-overlays/dsh-lan-assist/slots.js
function isFilterableHit(hit, extra = {}) {
  if (!hit || typeof hit !== 'object') return false
  const keys = (hit.keys || []).map((item) => String(item || '').trim()).filter(Boolean)
  if (!keys.length) return false
  if (keys.every((key) => key === 'role' || key === 'action' || key === 'join')) return false
  if (keys.some((key) => isClosedSetKey(key))) return true
  const kind = String(hit.assignKind || '').trim()
  if (!kind) return false
  const fields = schemaFieldsForKind(kind, extra.vocab, extra)
  return keys.some((key) => enumBackedField(fields, key))
}
```

`termsForKind` keeps only hits whose `assignKind` is that kind (`slots.js:815-822`). `whereForKind` / `fillEmptyWhere` write that onto an empty where (`slots.js:872-877`, `slots.js:947-953`).

That is not the rule “a label that is an enum value on a mentioned kind becomes that kind’s where.” These special cases drop or reroute it:

- A say that is a prefix of a longer kind label is discarded before assignment (`slots.js:341-348`, applied at `slots.js:699`).
- Synthetic clues are not assigned to the kind that owns the enum. If the clue is synthetic, assignment is the next mention, otherwise the nearest mention (`slots.js:700-704`, `slots.js:351-365`). A label owned by mentioned kind A can be assigned to kind B. `enumBackedField` then looks at B’s schema (`slots.js:779-782`). A’s where stays empty.
- `isClosedSetKey` still accepts a fixed key list — `status|state|stage|priority|category|type|状态|优先级|类型` — even when the field has no enums (`slots.js:756-757`, `slots.js:778`). A title that merely contains 类型 does not match that regex.
- Closed-status labels also become negated clues from suffixes and the last two characters (`enum-clues.js:136-149`, `enum-clues.js:87-94`). Those says are not the enum label.
- `fillEmptyWhere` does nothing when the node already has a where (`slots.js:951`).

Repo search of `runtime/vendor-overlays/dsh-lan-assist` at this SHA finds none of 领用, 归还, 报废, 调拨, 固定资产, 资产领用归还.

## 2. Same miss, other shapes

### Relation 现查, no enum label

Yes. The official sheet can be one page of the target, not the rows the relation names beyond that page.

No filterable hit leaves the where empty (`slots.js:947-953`). A step with no `no` and no where is unbound (`write.js:275-278`), so the probe starts at the first step (`write.js:282-285`, `write.js:826-836`). An empty where uses the lookup page size, not the where cap (`where-pass.js:422-423`, `lookup.js:608`). The parent request is one list call at that page size, then sliced (`lookup.js:758-764`, `lookup.js:1329-1330`, `plan.js:8`). The child hop sends those parent ids with an empty where, so its cap is the same page size (`lookup.js:612-627`, `lookup.js:1257`). `listAll` stops once the kept rows reach the cap and does not keep the server total (`lookup.js:501-522`). `from` / `steps` make this page count as filtered, so it can become the official sheet (`session-round.js:38-50`, `session-round.js:173-174`).

### Enum label that is not on a mentioned kind

Yes. The label does not become the mentioned kind’s where, so the sheet can still be the unfiltered relation page above.

The hit is assigned by proximity, then kept only when `assignKind` equals the step kind (`slots.js:351-365`, `slots.js:700-704`, `slots.js:815-817`). If the owner is not a step, `fillEmptyWhere` never writes it (`slots.js:947-953`). The probe then follows the empty-where path.

### Two labels on one field

OR, not AND. A row that matches either label is in the sheet. A row that matches neither is not, on this path.

Same keys and the same `not` flag are merged into one term’s values (`slots.js:850-869`). One term with several values is `$in` on the list request (`lookup.js:1251-1253`) and `values.some` on the client (`resolve.js:336-338`). Separate terms would be `$and` (`lookup.js:1255`) and `groups.every` (`resolve.js:374-379`). The merge happens first, so two labels on one field do not stay as two terms.

### Enum where that drops the relation

Yes. The official target rows can be every row of the target kind that matches the enum, including rows that are not in the mentioned relation.

The first step that has a where is the probe start (`write.js:275-285`). When only the target step has the enum where, that probe is the target kind plus the where, and it does not pass parent ids (`write.js:826-836`, `lookup.js:656-676`). The later parent walk stores parents of those rows. `pruneHopHits` replaces the parent set only (`write.js:378-388`). The target set stays the enum list (`write.js:854-855`, `write.js:916-917`). With a where, the list cap is `WHERE_LIST_CAP` (`where-pass.js:8`, `where-pass.js:422-423`), then `previewRowCap` slices structured plans to that same cap (`write.js:922-925`, `where-pass.js:426-427`).

### Chat-only round

This round does not hand a new sheet. The previous official stays, so the table can still show rows outside this utterance.

`turn/start` opens a round and `turn/end` closes it (`index.js:296-300`). Close copies `candidate` or `weak` onto official only when one of those exists (`session-round.js:128-140`). No tool sheet means both stay empty. `servedSheet` returns the previous official (`session-round.js:180-183`).

### 行内改行 / 过审 / 取消 / 点历史

These do not go through the left-session round. The right table can show a sheet that is not this utterance’s relation result.

A row button calls `runPreview` with that row’s action (`RecordsPanel.tsx:1728-1735`). `runPreview` posts `bizPreview` and applies the returned sheet (`RecordsPanel.tsx:1078-1145`). 改行 and 过审 are that same call. 取消 dismisses the preview and puts back the stored list (`RecordsPanel.tsx:651-660`, `RecordsPanel.tsx:663-701`). 点历史 loads a saved surface and pins it (`RecordsPanel.tsx:1588-1597`, `RecordsPanel.tsx:1211-1228`). None of these call `noteToolSheet` (`tools.js:225-227` is only the chat tool).

## 3. No enum label: full related set, or one page reported as the total?

One page whose length is the lookup page size, reported as the total. Not the full related set. This is any relation 现查 with an empty where. The illustration is not a special pair and the page size is not a special number.

What the code does:

1. Empty where → lookup limit is `PAGE_SIZE` (`plan.js:8`, `where-pass.js:422-423`, `lookup.js:608`).
2. The parent list is a single GET whose query page size is `PAGE_SIZE`, then `slice(0, 50)` (`lookup.js:1329-1330`, `lookup.js:758-764`). One request. No walk of later pages. The parent ids used for the hop are that page.
3. The child list is `relatedListPath` with `pageSize=${PAGE_SIZE}` (`lookup.js:1257`) and `listAll` limited to `PAGE_SIZE` (`lookup.js:620-627`, `lookup.js:501-504`).
4. `listAll` stops when `rows.length >= cap` and returns those rows (`lookup.js:518-522`). It does not copy `meta.total`, `meta.count`, or `totalPage` onto the sheet. `pageCount` reads that meta (`lookup.js:483-490`) only when the first page did not already fill the cap (`lookup.js:522-524`).
5. The sheet’s row array is that capped list, sliced again by `previewRowCap` (`write.js:922-925`). For a structured plan the second cap is `WHERE_LIST_CAP` (`where-pass.js:426-427`), which is larger than `PAGE_SIZE`, so it does not undo the lookup cap. Nothing in that path stores a hit count separate from `rows.length`.

So a real related set larger than the lookup page size is cut to one page. The official sheet length is the number of rows kept, which is at most the page size. If the real set is smaller than the cap and the server page meta says there is another page, `listAll` can read further pages until the cap (`lookup.js:523-534`). The stored length is still just how many rows were kept. The server total is never the sheet’s count.

`共 N 条` is the length of the rows already on the panel, after the local search box, not a server total:

```1375:1385:src/components/biz/RecordsPanel.tsx
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tableRows
    return tableRows.filter((row) => Object.values(row).some((v) => String(v).toLowerCase().includes(q)))
  }, [query, tableRows])

  useEffect(() => {
    setPage(1)
  }, [kind, query])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
```

```1758:1760:src/components/biz/RecordsPanel.tsx
        <span>共 {filteredRows.length} 条{sourceLabel ? ` · ${sourceLabel}` : ''}</span>
        <div className="flex items-center gap-2">
          <span>第 {page} / {totalPages} 页</span>
```

The panel’s own `PAGE_SIZE` is 10 (`RecordsPanel.tsx:83`). That only slices the rows the sheet already has. It is not the lookup page size and it is not a server total.

When N equals the lookup page size, N is the page length. `listAll` stopped at the cap (`lookup.js:518-522`). The code has no remaining field that would show a larger real total, so the footer cannot be read as “this is all of them.”
