# FIELD_SPEAK / fieldSpeak — facts (read-only)

## Vendor comparison

`~/.dsh-fde-x/vendor/dsh-lan-assist/write.js` exists. `diff` against the repo overlay copy is empty (no differences in the full file as of this investigation). `FIELD_SPEAK` and `fieldSpeak` appear at the same line numbers in both files (1581–1624).

In this repository, the only file that defines or calls `fieldSpeak` / `FIELD_SPEAK` is:

`runtime/vendor-overlays/dsh-lan-assist/write.js`

---

## 1. Definition (path and line numbers)

**Path:** `runtime/vendor-overlays/dsh-lan-assist/write.js` (lines 1581–1624)

```javascript
const FIELD_SPEAK = new Map([
  ['phone', '电话'], ['mobile', '电话'], ['电话', '电话'], ['手机', '电话'],
  ['remark', '备注'], ['remarks', '备注'], ['notes', '备注'], ['备注', '备注'],
  ['status', '状态'], ['状态', '状态'],
  ['address', '地址'], ['地址', '地址'],
  ['warehouse', '仓库'], ['仓库', '仓库'],
  ['supplier', '供应商'], ['供应商', '供应商'],
  ['customer', '客户'], ['客户', '客户'],
  ['contract', '合同'], ['合同', '合同'],
  ['employee', '员工'], ['员工', '员工'],
  ['contact', '联系人'], ['联系人', '联系人'],
  ['position', '职位'], ['职位', '职位'],
  ['name', '名称'], ['title', '名称'], ['名称', '名称'],
  ['owner', '负责人'], ['负责人', '负责人'],
  ['assignee', '负责人'], ['createdBy', '用户'], ['updatedBy', '用户'],
  ['updatedAt', '更新时间'], ['updated_at', '更新时间'],
  ['priority', '优先级'], ['优先级', '优先级'],
  ['category', '类别'], ['类别', '类别'], ['分类', '类别'],
  ['amount', '金额'], ['total', '金额'], ['金额', '金额'],
  ['qty', '数量'], ['quantity', '数量'], ['数量', '数量'],
  ['enddate', '到期日'], ['duedate', '到期日'], ['expire', '到期日'], ['到期日', '到期日'],
])

function fieldSpeak(key) {
  const name = String(key || '').trim()
  if (!name) return '该行'
  const hit = FIELD_SPEAK.get(name) || FIELD_SPEAK.get(name.toLowerCase())
  if (hit) return hit
  if (/电话|手机/.test(name)) return '电话'
  if (/remark|notes|备注/i.test(name)) return '备注'
  if (/status|状态/i.test(name)) return '状态'
  if (/address|地址/i.test(name)) return '地址'
  if (/warehouse/i.test(name)) return '仓库'
  if (/contact/i.test(name)) return '联系人'
  if (/position|职位/i.test(name)) return '职位'
  if (/名称|title/i.test(name)) return '名称'
  if (/owner|负责人/i.test(name)) return '负责人'
  if (/priority|优先级/i.test(name)) return '优先级'
  if (/category|类别|分类/i.test(name)) return '类别'
  if (/amount|金额|total/i.test(name)) return '金额'
  if (/qty|quantity|数量/i.test(name)) return '数量'
  if (/endDate|dueDate|expire/i.test(name)) return '到期日'
  return name
}
```

---

## 2. Every `fieldSpeak` call site in the repo

All call sites are in `runtime/vendor-overlays/dsh-lan-assist/write.js`. There are no callers in other repo files.

### 2.1 Line 118 — argument: `name`

**Expression:** `label || fieldSpeak(name)`

**Next use of returned string:** assigned to `col.label`, then `columns.push(col)`.

```javascript
  function addCol(key, label, enums) {
    const name = String(key || '').trim()
    if (!name || seen.has(name)) return
    seen.add(name)
    const col = { key: name, label: label || fieldSpeak(name) }
    if (enums && typeof enums === 'object' && Object.keys(enums).length) col.enums = enums
    columns.push(col)
  }
  addCol('index', '序号')
  addCol('no', '单号')
  const hasStatus = rows.some((row) => {
```

### 2.2 Line 179 — argument: `key`

**Expression:** `displayColumnLabel(key, schemaFields) || fieldSpeak(key)`

**Next use:** `label` on a `changes` entry object returned from `flatMap` (becomes `packSheet` → `sheet.changes`).

```javascript
    if (action === '新建') {
      if (!to) return []
      return [{
        field: key,
        label: displayColumnLabel(key, schemaFields) || fieldSpeak(key),
        from: '',
        to,
      }]
    }
    if (to === from) return []
    return [{
      field: key,
      label: displayColumnLabel(key, schemaFields) || fieldSpeak(key),
```

### 2.3 Line 187 — argument: `key`

**Expression:** `displayColumnLabel(key, schemaFields) || fieldSpeak(key)`

**Next use:** same as 2.2 — `label` on a change row in `changes`.

```javascript
    if (to === from) return []
    return [{
      field: key,
      label: displayColumnLabel(key, schemaFields) || fieldSpeak(key),
      from,
      to,
    }]
  })
  const many = rows.length > 1
  const previewId = String(spec.preview_id || '').trim()
  const alreadyAtTarget = action === '过审' && rows.length > 0 && changes.length === 0
  let canWrite = !!previewId && action !== '现查' && (!many || !!spec.batch)
```

### 2.4 Line 478 — argument: `key` (inside `displayColumnLabel`)

**Expression:** `(title && /[\u4e00-\u9fff]/.test(title)) ? title : fieldSpeak(key)`

**Next use:** `label` returned from `displayColumnLabel`; used as column header text via `addCol(key, label, …)` and deduped with `usedLabels`.

```javascript
function displayColumnLabel(key, schemaFields, usedLabels) {
  const list = Array.isArray(schemaFields) ? schemaFields : []
  const hit = list.find((item) => {
    const name = typeof item === 'string' ? item : (item && item.name)
    return String(name || '') === String(key || '')
  })
  const title = hit && typeof hit === 'object' ? String(hit.title || '').trim() : ''
  const label = (title && /[\u4e00-\u9fff]/.test(title)) ? title : fieldSpeak(key)
  if (usedLabels && usedLabels.has(label)) return ''
  return label
}

/**
 * @param {{ fingerprint?: string } | null | undefined} preview
```

### 2.5 Line 1651 — argument: `key` (inside `patchChange`)

**Expression:** `const label = fieldSpeak(key)`

**Next use:** embedded in Mandarin patch sentences assigned to `parts`, then `speak: parts.join('；')` on the return value of `patchChange`.

```javascript
function patchChange(patch, fields) {
  if (!patch || typeof patch !== 'object') return null
  const keys = Object.keys(patch)
  if (!keys.length) return null
  const parts = keys.map((key) => {
    const label = fieldSpeak(key)
    const next = String(patch[key] ?? '').trim()
    const prev = fieldValue(fields, key)
    if (prev && next) return `将${label}从 ${prev} 改为 ${next}`
    if (next) return `将${label}改为 ${next}`
    return `将改${label}`
  })
  return {
    speak: parts.join('；'),
```

**Downstream:** `patchChange` is called at lines 540 (`speakBundleReceipt`) and 1198 (write preview path); `change.speak` is concatenated into receipt/preview copy.

### 2.6 Line 1695 — argument: `key` (inside `patchSpeak`)

**Expression:** `keys.map((key) => fieldSpeak(key)).join('、')`

**Next use:** return value of `patchSpeak(writePatch)` used as `to` when building preview speech (line 1201), then passed into `speakPreview` (line 1202).

```javascript
function patchSpeak(patch) {
  if (!patch || typeof patch !== 'object') return '该行'
  const keys = Object.keys(patch)
  return keys.length ? keys.map((key) => fieldSpeak(key)).join('、') : '该行'
}

/**
 * Optional write mouth. Never used by lookup GET.
 * @param {{
 *   resolve?: () => Promise<Record<string, unknown>>,
 *   fetchImpl?: typeof fetch,
 * }} [opts]
 */
```

Caller context (line 1201):

```javascript
    const change = recognized.action === '改行' ? patchChange(writePatch, row.fields) : null
    const to = recognized.action === '过审'
      ? nextStatus('过审', row.status)
      : recognized.action === '删除' ? '删除' : (change && change.speak) || patchSpeak(writePatch)
    const spoken = speakPreview({ kind: recognized.kind, no: resolvedNo }, {
      ok: true, status: row.status, from: change ? change.from : row.status, to,
      action: recognized.action, fingerprint: found && found.fingerprint, mine: found && found.mine,
    })
```

---

## 3. Git history and branch tips

| Ref | SHA (full) |
|-----|------------|
| `cursor/eval-three-causes-2d90` (current `HEAD`) | `3c58dadd874104d89d3cd0f505362a6945322405` |
| `main` (local) | `980839056de7a92bee47635fb6bac8a7ac5780bc` |

`HEAD` is **not** an ancestor of `main` (`git merge-base --is-ancestor 3c58dad main` → false). `cursor/eval-three-causes-2d90` is **11 commits ahead** of `main`; `main` has **0** commits not on that branch.

### Map introduction

- **`git log -L '1581,1602:runtime/vendor-overlays/dsh-lan-assist/write.js'`** shows a single history entry: the map appeared when the overlay file was added.
- **`git log --all -S 'FIELD_SPEAK' --oneline -- '*.js'`** lists only: `3589272 fix(biz): pass date where on 现查 preview`.
- **`git blame -L 1581,1624`** attributes every line of `FIELD_SPEAK` and `fieldSpeak` to commit **`3589272f07527cc2be34499ecf72f86ae25977e3`** (author losebird, 2026-09-17), subject **`fix(biz): pass date where on 现查 preview`**.
- That commit added `runtime/vendor-overlays/dsh-lan-assist/write.js` (+1314 lines) among other files; it did not patch an existing `FIELD_SPEAK` block in-repo.

### Commits that “grew” the map

- **`git log -L`** on lines 1581–1602 and 1604–1624 reports **no subsequent edits** after `3589272`; the map and `fieldSpeak` body have not changed in later commits on this file (later commits on `write.js` touched other regions; blame on 1581–1624 remains `3589272` only).

### Branch membership for `3589272`

- **On local `main`:** yes (`git merge-base --is-ancestor 3589272 main`).
- **On `cursor/eval-three-causes-2d90`:** yes (`git merge-base --is-ancestor 3589272 cursor/eval-three-causes-2d90`).

---

## 4. Schema / title lookup vs `fieldSpeak`

**Function:** `displayColumnLabel` (same file, lines 471–480).

**Lookup:**

```javascript
  const hit = list.find((item) => {
    const name = typeof item === 'string' ? item : (item && item.name)
    return String(name || '') === String(key || '')
  })
  const title = hit && typeof hit === 'object' ? String(hit.title || '').trim() : ''
  const label = (title && /[\u4e00-\u9fff]/.test(title)) ? title : fieldSpeak(key)
```

- **`schemaFields`** is supplied from `packSheet` / `sheet()` via `spec.schemaFields`, often loaded through `extra.fieldsOf(kind, extra.vocab)` (lines 415–418, 449–452).
- **Chinese title:** if `hit.title` is non-empty **and** matches `/[\u4e00-\u9fff]/`, `displayColumnLabel` returns that `title` and **does not** call `fieldSpeak` on that path.
- **Non-Chinese or missing title:** `displayColumnLabel` calls **`fieldSpeak(key)`** instead of using a Latin/English `title`.
- **Call sites that bypass schema for labels:** `patchChange` / `patchSpeak` call **`fieldSpeak(key)` only** (no `displayColumnLabel`). `addCol` uses `fieldSpeak(name)` only when the explicit `label` argument is falsy.

---

## 5. User-visible string shapes (from code, not live traffic)

| Surface | Role of `fieldSpeak` output |
|--------|------------------------------|
| **Sheet column header** | `col.label` from `addCol` (fallback when `label` omitted). |
| **Preview drawer change rows** | `sheet.changes[].label` from `packSheet` (with `displayColumnLabel \|\| fieldSpeak`). UI reads `row.label` in `src/lib/biz-sheet-display.ts` (`previewChangesFromSheetPayload`). |
| **Secretary / preview utterance** | For `改行`, `speakPreview` sets `speak` to `` `将改${label}：${next}。这是预览，不是过账。` `` when `action === '改行' && next` (line 58), where `next` may be `change.speak` (built with `fieldSpeak` inside `patchChange`) or `patchSpeak(writePatch)` (joined field names). |
| **Write receipt** | `speakBundleReceipt` may emit `` `库里已改上：${label}。${change.speak}。有回执才算写上了。` `` (lines 546–547), with `change.speak` using `fieldSpeak` labels inside `patchChange`. |

**Example string shapes quoted from source (template literals as written):**

1. Patch narration (uses `fieldSpeak` for `${label}`): `` `将${label}从 ${prev} 改为 ${next}` `` (line 1654).
2. Preview line when `改行` and `next` is set: `` `将改${label}：${next}。这是预览，不是过账。` `` (line 58) — here `label` is ticket ref from `refLabel`, while `next` can be the semicolon-joined patch sentence from (1) or a `、`‑joined list from `patchSpeak`.
3. Column object shape: `{ key: name, label: label || fieldSpeak(name) }` (line 118) — `label` is the header text shown on the business sheet face.

`fieldSpeak` does **not** set database/API field keys; it only supplies human-facing Chinese (or raw key fallback via `return name` at line 1623) labels and words inside the above copy.
