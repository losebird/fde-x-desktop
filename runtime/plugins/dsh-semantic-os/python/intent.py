"""Intent routing onto existing tools. Not a second search engine."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

_WRITE_ACTIONS = ("删除", "过审", "新建", "改行")
_REWRITE_AFTER = re.compile(r"\s*([\u4e00-\u9fffA-Za-z0-9._-]{1,32})")


def _text(value: Any) -> str:
    return str(value or "").strip()


def _spoken_path() -> Path:
    here = Path(__file__).resolve()
    return here.parents[1].parent / "dsh-lan-assist" / "vocab" / "spoken.json"


def _spoken() -> dict:
    path = _spoken_path()
    if not path.is_file():
        return {}
    try:
        packed = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return packed if isinstance(packed, dict) else {}


def _role_says(role: str) -> list[str]:
    want = str(role or "").strip()
    clues = _spoken().get("clues")
    if not isinstance(clues, list):
        return []
    says: list[str] = []
    for clue in clues:
        if not isinstance(clue, dict):
            continue
        if str(clue.get("role") or "").strip() != want:
            continue
        for say in clue.get("say") or []:
            token = str(say or "").strip()
            if token:
                says.append(token)
    says.sort(key=len, reverse=True)
    return says


def _speech_has_role(raw: str, role: str) -> bool:
    if not raw:
        return False
    return any(say in raw for say in _role_says(role))


def _clue_says(clue: dict) -> list[str]:
    return [str(item or "").strip() for item in (clue.get("say") or []) if str(item or "").strip()]


def _find_clue_hit(text: str, says: list[str]) -> re.Match[str] | None:
    words = [item for item in says if item]
    if not words or not text:
        return None
    words.sort(key=len, reverse=True)
    pattern = "|".join(re.escape(item) for item in words)
    return re.search(pattern, text, flags=re.IGNORECASE)


def _spoken_write_actions(raw: str) -> list[str]:
    clues = _spoken().get("clues")
    if not isinstance(clues, list) or not raw:
        return []
    found: list[str] = []
    for clue in clues:
        if not isinstance(clue, dict):
            continue
        keys = [str(item or "").strip() for item in (clue.get("keys") or [])]
        if "action" not in keys:
            continue
        values = [str(item or "").strip() for item in (clue.get("values") or []) if str(item or "").strip()]
        hit = _find_clue_hit(raw, _clue_says(clue))
        if hit is None:
            continue
        for act in _WRITE_ACTIONS:
            if act in values and act not in found:
                found.append(act)
    return found


def _rewrite_has_value(raw: str) -> bool:
    says = _role_says("改写")
    at = -1
    hit_say = ""
    for say in sorted(says, key=len, reverse=True):
        idx = raw.find(say)
        if idx >= 0 and (at < 0 or idx < at or (idx == at and len(say) > len(hit_say))):
            at = idx
            hit_say = say
    if at < 0 or not hit_say:
        return False
    tail = raw[at + len(hit_say):]
    matched = _REWRITE_AFTER.match(tail)
    return bool(matched and matched.group(1))


def _speech_holds_workstation_write(raw: str) -> bool:
    if not raw:
        return False
    if _spoken_write_actions(raw):
        return True
    return _rewrite_has_value(raw)


def _speech_has_connector_lookup(raw: str) -> bool:
    return _speech_has_role(raw, "现查路由")


def route_intent(text: Any) -> dict[str, str]:
    raw = _text(text)
    if not raw:
        return {"intent": "闲聊", "tool": ""}
    if _speech_has_role(raw, "出处"):
        return {"intent": "出处", "tool": "lineage"}
    if _speech_has_role(raw, "定了") and not _speech_has_role(raw, "拍板"):
        return {"intent": "查询", "tool": "search_text"}
    if _speech_has_role(raw, "拍板"):
        return {"intent": "拍板", "tool": "brief_for_decision"}
    if _speech_has_role(raw, "记忆卡"):
        return {"intent": "查询", "tool": "list_memory_cards"}
    if _speech_holds_workstation_write(raw):
        return {"intent": "现况", "tool": "biz_preview"}
    if _speech_has_connector_lookup(raw):
        return {"intent": "现况", "tool": "biz_preview"}
    if _speech_has_role(raw, "业务动作"):
        return {"intent": "业务动作", "tool": "brief_for_decision"}
    if _speech_has_role(raw, "过账") and _speech_has_role(raw, "过账帮忙"):
        return {"intent": "业务动作", "tool": "brief_for_decision"}
    if _speech_has_role(raw, "催待办"):
        return {"intent": "催待办", "tool": "search_text"}
    if _speech_has_role(raw, "闲聊"):
        return {"intent": "闲聊", "tool": ""}
    return {"intent": "查询", "tool": "search_text"}
