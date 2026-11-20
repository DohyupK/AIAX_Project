"""보호구 착용 위반 보고서 → 슬랙 mrkdwn (화면 ①~⑤ 양식)"""
from __future__ import annotations

from typing import Any

from notion_export.ppe_calc import GEAR_LABEL, build_ppe_report


def _fmt(n: float | None) -> str:
    return "-" if n is None else f"{n:,.1f}"


def _int(n: int) -> str:
    return f"{n:,}"


def _delta(r: dict[str, Any]) -> str:
    if r["delta"] is None:
        return "-"
    sign = "+" if r["delta"] > 0 else "−" if r["delta"] < 0 else ""
    return f"{sign}{_fmt(abs(r['delta']))}"


def build_ppe_mrkdwn(r: dict[str, Any]) -> str:
    prev_no = r["prevMonthNo"]
    enter_note = (
        f"등록 {r['registered']}명 전원 출입"
        if r["entered"] == r["registered"]
        else f"등록 {r['registered']}명 중 {r['entered']}명 출입"
    )
    lines = [
        f"_{r['title']} ({r['period']}, 가동일 {r['workDays']}일) · {r['site']}_",
        "",
        "*① 핵심 지표*",
        f"• 판정 수 {_int(r['scans'])} · {enter_note}",
        f"• 위반 {_int(r['violations'])}건 (미충족 판정)",
        f"• 위반율 (1,000회당) {_fmt(r['rate'])}" + (f" · {r['rank']}" if r["rank"] else ""),
        (
            f"• 전월({prev_no}월) 대비 {_delta(r)} · "
            + ("전월 기록 없음" if r["prevRate"] is None else f"{prev_no}월 {_fmt(r['prevRate'])}")
        ),
        "",
        "*② 어디서: 소속·게이트별 (위반율 높은 순)*",
    ]
    for u in r["units"]:
        lines.append(
            f"• {u['name']} / {u['type']} / {u['gate']} — "
            f"판정 {_int(u['scans'])} · 위반 {_int(u['violations'])} · "
            f"위반율 {_fmt(u['rate'])} · 전월 {_fmt(u['prevRate'])}"
        )
    lines.append(
        f"• *계* / {r['gates']} — 판정 {_int(r['scans'])} · 위반 {_int(r['violations'])} · "
        f"위반율 {_fmt(r['rate'])} · 전월 {_fmt(r['prevRate'])}"
    )
    lines += ["", "*③ 무엇을: 보호구별 (개, 본청 / 협력업체)*"]
    gear_line = " › ".join(
        f"{GEAR_LABEL.get(g['gear'], g['gear'])} {g['total']} ({g['hq']} / {g['sub']})" for g in r["gears"]
    )
    lines.append(gear_line or "없음")
    lines += ["", "*④ 언제: 태깅 시각별 (위반 많은 순)*"]
    if not r["slots"]:
        lines.append("위반 없음")
    else:
        lines.append(" · ".join(f"{x['hour']:02d}시대 {x['violations']}건 ({x['pct']}%)" for x in r["slots"]))
    lines += [
        "",
        "*⑤ 원인 및 조치*",
        "• 원인: (작성란)",
        "• 이번 달 조치: (작성란)",
        "• 다음 달 할 일: (작성란)",
        "",
        f"작성일: {r['month'][:4]}.    .    .     작성: 안전관리자",
        f"_가동일 = 검사 기록이 있는 날. 집계는 첫 검사일({r['start']})부터._",
    ]
    return "\n".join(lines)


def build_ppe_slack(month: str, all_raw: list[dict[str, Any]]) -> tuple[str, str]:
    r = build_ppe_report(month, all_raw)
    title = f"{r['title']} 보호구 착용 위반 보고서"
    return title, build_ppe_mrkdwn(r)
