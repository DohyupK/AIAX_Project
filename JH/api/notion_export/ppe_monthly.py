"""보호구 착용 위반 보고서 → 노션 블록 (화면 ViolationReports ①~⑤ 양식)"""
from __future__ import annotations

from typing import Any

from notion_export.blocks import bullet, divider, heading2, heading3, paragraph, table
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


def build_ppe_blocks(r: dict[str, Any]) -> list[dict[str, Any]]:
    prev_no = r["prevMonthNo"]
    enter_note = (
        f"등록 {r['registered']}명 전원 출입"
        if r["entered"] == r["registered"]
        else f"등록 {r['registered']}명 중 {r['entered']}명 출입"
    )
    blocks: list[dict[str, Any]] = [
        heading2("보호구 착용 위반 보고서"),
        paragraph(f"{r['title']} ({r['period']}, 가동일 {r['workDays']}일) · {r['site']}"),
        heading3("결재란"),
        table(["담당", "부서장", "기관장"], [["", "", ""]]),
        divider(),
        heading2("① 핵심 지표"),
        bullet(f"판정 수 {_int(r['scans'])} · {enter_note}"),
        bullet(f"위반 {_int(r['violations'])}건 (미충족 판정)"),
        bullet(f"위반율 (1,000회당) {_fmt(r['rate'])}" + (f" · {r['rank']}" if r["rank"] else "")),
        bullet(
            f"전월({prev_no}월) 대비 {_delta(r)} · "
            + ("전월 기록 없음" if r["prevRate"] is None else f"{prev_no}월 {_fmt(r['prevRate'])}")
        ),
        divider(),
        heading2("② 어디서: 소속·게이트별 (위반율 높은 순)"),
        table(
            [
                "소속",
                "구분",
                "게이트",
                f"{r['monthNo']}월 판정",
                f"{r['monthNo']}월 위반",
                f"{r['monthNo']}월 위반율",
                f"전월({prev_no}월)",
            ],
            [
                *[
                    [
                        u["name"],
                        u["type"],
                        u["gate"],
                        _int(u["scans"]),
                        _int(u["violations"]),
                        _fmt(u["rate"]),
                        _fmt(u["prevRate"]),
                    ]
                    for u in r["units"]
                ],
                [
                    "계",
                    "",
                    r["gates"],
                    _int(r["scans"]),
                    _int(r["violations"]),
                    _fmt(r["rate"]),
                    _fmt(r["prevRate"]),
                ],
            ],
        ),
        divider(),
        heading2("③ 무엇을: 보호구별 (개, 본청 / 협력업체)"),
        paragraph(
            " › ".join(
                f"{GEAR_LABEL.get(g['gear'], g['gear'])} {g['total']} ({g['hq']} / {g['sub']})"
                for g in r["gears"]
            )
            or "없음"
        ),
        divider(),
        heading2("④ 언제: 태깅 시각별 (위반 많은 순)"),
        paragraph(
            "위반 없음"
            if not r["slots"]
            else " · ".join(f"{x['hour']:02d}시대 {x['violations']}건 ({x['pct']}%)" for x in r["slots"])
        ),
        divider(),
        heading2("⑤ 원인 및 조치"),
        table(["항목", "내용"], [["원인", ""], ["이번 달 조치", ""], ["다음 달 할 일", ""]]),
        paragraph(f"작성일: {r['month'][:4]}.    .    .     작성: 안전관리자"),
        paragraph(
            "위반율(1,000회당) = 위반 ÷ 판정 수 × 1,000. 위반은 1건, 보호구는 필수 미착용만 각각 집계 "
            f"(게이트 b 보안경은 선택이라 제외). 가동일 = 검사 기록이 있는 날. 집계는 첫 검사일({r['start']})부터."
        ),
    ]
    return blocks


def build_ppe_payload(month: str, all_raw: list[dict[str, Any]]) -> tuple[str, list[dict[str, Any]]]:
    r = build_ppe_report(month, all_raw)
    title = f"{r['title']} 보호구 착용 위반 보고서"
    return title, build_ppe_blocks(r)
