"""Keep extracted entities that appear in the source window. No kind-name ifs."""

from __future__ import annotations

import re
from typing import Any

_FILLER = {
    "我", "你", "他", "她", "我们", "你们", "他们", "咱们",
    "这个", "那个", "这些", "那些", "这里", "那里",
    "什么", "怎么", "为什么", "是否", "如何",
    "今天", "明天", "昨天", "现在", "刚才",
    "问题", "事情", "东西", "内容", "信息",
    "功能", "系统", "用户", "页面", "按钮",
    "ok", "OK", "yes", "no",
}
_CHAT = re.compile(r"^(请问|帮我|看一下|怎么样|好的|嗯|啊)+$")


def _compact(text: Any) -> str:
    return re.sub(r"\s+", "", str(text or "")).lower()


def label_in_source(label: Any, source: Any) -> bool:
    needle = _compact(label)
    if len(needle) < 2:
        return False
    return needle in _compact(source)


def is_chat_filler(label: Any) -> bool:
    raw = str(label or "").strip()
    if not raw:
        return True
    if raw in _FILLER or raw.lower() in _FILLER:
        return True
    if len(raw) < 2 or len(raw) > 40:
        return True
    if re.match(r"^[?？。.!！,，、]+$", raw):
        return True
    if _CHAT.match(raw):
        return True
    return False


def clean_extract(source: Any, entities: Any, relations: Any, types: Any = None) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    allowed = {str(row or "").strip() for row in (types or []) if str(row or "").strip()}
    kept: list[dict[str, Any]] = []
    names: set[str] = set()
    for row in entities or []:
        if not isinstance(row, dict):
            continue
        label = str(row.get("text") or row.get("label") or row.get("name") or "").strip()
        if not label or is_chat_filler(label) or not label_in_source(label, source):
            continue
        ntype = str(row.get("type") or "Entity").strip() or "Entity"
        if allowed and ntype != "Entity" and ntype not in allowed:
            ntype = "Entity"
        if label in names:
            continue
        names.add(label)
        packed = dict(row)
        packed["text"] = label
        packed["label"] = label
        packed["type"] = ntype
        kept.append(packed)
        if len(kept) >= 12:
            break
    links: list[dict[str, Any]] = []
    for row in relations or []:
        if not isinstance(row, dict):
            continue
        src = str(row.get("source") or row.get("subject") or "").strip()
        tgt = str(row.get("target") or row.get("object") or "").strip()
        kind = str(row.get("type") or row.get("predicate") or "related_to").strip() or "related_to"
        if src not in names or tgt not in names or src == tgt:
            continue
        packed = dict(row)
        packed["source"] = src
        packed["target"] = tgt
        packed["type"] = kind
        links.append(packed)
        if len(links) >= 16:
            break
    return kept, links
