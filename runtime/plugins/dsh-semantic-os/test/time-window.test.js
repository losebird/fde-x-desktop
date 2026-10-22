import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

function py(code) {
  const r = spawnSync('python3', ['-c', code], {
    cwd: new URL('..', import.meta.url).pathname,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: 'python' },
  })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return r.stdout.trim()
}

const SETUP = `
import sys
sys.path.insert(0, "python")
from datetime import datetime, timedelta, timezone
from bootstrap import node_event_time, node_time_span, _query_window, _row_in_query_window, _is_day_only

def utc_iso(dt):
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

row = {"id": "session:x:1", "properties": {
  "valid_from": "2026-08-23T06:50:40.879Z",
  "timestamp": "2026-08-23T06:50:40.879Z",
  "event_time": "2026-08-23T06:50:40.879Z",
}}
`

test('point stamp stays a point on the node', () => {
  const out = py(`${SETUP}
start, end = node_time_span(row)
print(start.isoformat(), end.isoformat(), node_event_time(row).isoformat())
`)
  assert.match(out, /2026-08-23T06:50:40.879000\+00:00 2026-08-23T06:50:40.879000\+00:00 2026-08-23T06:50:40.879000\+00:00/)
})

test('HH:MM is the host-local minute; ISO-Z stays an instant', () => {
  const out = py(`${SETUP}
at, a, b = _query_window("14:33")
print("hm", at, a.isoformat(), b.isoformat())
at2, a2, b2 = _query_window("2026-08-23 14:33")
print("dhm", at2, a2.isoformat(), b2.isoformat())
want_lo = datetime(2026, 8, 23, 14, 33, 0).astimezone().astimezone(timezone.utc)
want_hi = want_lo + timedelta(minutes=1) - timedelta(microseconds=1)
print("dhm-ok", a2 == want_lo and b2 == want_hi)
row_lan = {"properties": {"valid_from": utc_iso(datetime(2026, 8, 23, 14, 33, 35, 489000).astimezone()), "timestamp": utc_iso(datetime(2026, 8, 23, 14, 33, 35, 489000).astimezone())}}
print("lan-in", _row_in_query_window(row_lan, at2, a2, b2))
print("point-out", _row_in_query_window(row, at2, a2, b2))
at3, a3, b3 = _query_window("2026-08-23T06:50:40.879Z")
print("iso", at3.isoformat(), a3, b3, _row_in_query_window(row, at3, a3, b3))
`)
  assert.match(out, /dhm-ok True/)
  assert.match(out, /lan-in True/)
  assert.match(out, /point-out False/)
  assert.match(out, /iso 2026-08-23T06:50:40.879000\+00:00 None None True/)
})

test('YYYY-MM-DD query covers the host-local calendar day; ISO timestamp is an instant', () => {
  const out = py(`${SETUP}
at, a, b = _query_window("2026-08-23")
want_lo = datetime(2026, 8, 23, 0, 0, 0).astimezone().astimezone(timezone.utc)
want_hi = want_lo + timedelta(days=1) - timedelta(microseconds=1)
print("day-ok", at is None and a == want_lo and b == want_hi)
early = {"properties": {"valid_from": utc_iso(datetime(2026, 8, 23, 2, 0, 0).astimezone()), "timestamp": utc_iso(datetime(2026, 8, 23, 2, 0, 0).astimezone())}}
nxt = {"properties": {"valid_from": utc_iso(datetime(2026, 8, 24, 0, 0, 0).astimezone()), "timestamp": utc_iso(datetime(2026, 8, 24, 0, 0, 0).astimezone())}}
evening = {"properties": {"valid_from": utc_iso(datetime(2026, 8, 23, 22, 0, 0).astimezone()), "timestamp": utc_iso(datetime(2026, 8, 23, 22, 0, 0).astimezone())}}
print("early-in", _row_in_query_window(early, at, a, b))
print("next-out", _row_in_query_window(nxt, at, a, b))
print("evening-in", _row_in_query_window(evening, at, a, b))
at2, a2, b2 = _query_window("2026-08-23T06:50:40.879Z")
print("inst", at2.isoformat(), a2, b2, _row_in_query_window(row, at2, a2, b2))
other = {"properties": {"valid_from": "2026-08-23T01:27:05.231Z", "timestamp": "2026-08-23T01:27:05.231Z"}}
print("other-inst", _row_in_query_window(other, at2, a2, b2))
print("day-only", _is_day_only("2026-08-23"), _is_day_only("2026-08-23T06:50:40.879Z"))
`)
  assert.match(out, /day-ok True/)
  assert.match(out, /early-in True/)
  assert.match(out, /next-out False/)
  assert.match(out, /evening-in True/)
  assert.match(out, /inst 2026-08-23T06:50:40.879000\+00:00 None None True/)
  assert.match(out, /other-inst False/)
  assert.match(out, /day-only True False/)
})

test('undated nodes stay out of a day filter and say 没有日期', () => {
  const out = py(`${SETUP}
from board import then_label
blank = {"id": "session:x:2", "properties": {"content": "没有时间"}}
print("in-day", _row_in_query_window(blank, *_query_window("2026-08-23")[:3] if False else _query_window("2026-08-23")))
at, a, b = _query_window("2026-08-23")
print("in-day", _row_in_query_window(blank, at, a, b))
print("open", _row_in_query_window(blank, None, None, None))
then = then_label(blank["properties"])
print("label", then["label"])
print("undated", then.get("undated"))
`)
  assert.match(out, /in-day False/)
  assert.match(out, /open True/)
  assert.match(out, /没有日期/)
  assert.match(out, /undated True/)
})

test('search and graph display timestamps match then_label host-local clock', () => {
  const out = py(`${SETUP}
from board import then_label, display_iso
from bootstrap import _pack_query_node, _pack_explore_node, _display_time_fields
stored = "2026-08-22T18:00:00Z"
want = display_iso(stored)
row = {"id": "session:x:1", "type": "Document", "content": "昨晚", "properties": {"valid_from": stored, "timestamp": stored, "content": "昨晚"}}
query = _pack_query_node(row)
explore = _pack_explore_node(row)
props = _display_time_fields(row["properties"])
then = then_label(props)
print("query", query["valid_from"])
print("explore", explore["valid_from"])
print("props", props["valid_from"])
print("then", then["valid_from"])
print("aligned", query["valid_from"] == explore["valid_from"] == props["valid_from"] == then["valid_from"] == want)
print("has-offset", bool(__import__("re").search(r"[+-]\\d{2}:\\d{2}$", str(query["valid_from"] or ""))))
`)
  assert.match(out, /aligned True/)
  assert.match(out, /has-offset True/)
})
