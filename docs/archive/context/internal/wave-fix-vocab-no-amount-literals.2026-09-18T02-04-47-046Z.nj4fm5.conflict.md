# Wave: vocab — remove amount/order title literals

## SHA

`cafefaa` (`fix(biz): drop hardcoded field-title filters in vocab adapter`)

## Change

- Removed `shapeFields` skips for `uiSchema.title === '金额' | '单号'` in `runtime/biz/adapters/nocobase-vocab.mjs`.
- Concepts still one per **collection** row (`name`/`title`); **relations** from `m2o`/`o2m`/… + `target`; **fields** from writable non-association field rows (`isWritableField` / `isRelationField`), no kind-name heuristics.

## Literals gone?

| Literal | In `nocobase-vocab.mjs` / `vocab-from-connector.mjs` |
|---------|--------------------------------------------------------|
| 金额    | yes — removed from adapter |
| 单号    | yes — removed from adapter |
| 单行    | n/a (never in adapter) |
| 明细行  | n/a (never in adapter) |

## Tests

`node --test runtime/tests/vocab-from-connector.test.mjs` — 4/4 pass; relations still derived from `m2o` parent/child fixture.

## Relations without literals

Yes — unchanged relation path (`REL_PARENT_TO_CHILD` / `REL_CHILD_TO_PARENT` + `target` in catalog).
