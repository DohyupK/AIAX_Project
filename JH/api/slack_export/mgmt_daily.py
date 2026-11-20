"""일일 경영 리포트 → 슬랙 mrkdwn (화면 ReportView S/Q/D/C/P 양식)"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from notion_export.mgmt_calc import GEAR_LABEL, build_report, compare_report, compute_report
from notion_export.mgmt_daily import delta_txt, n0, pct, won


def build_mgmt_mrkdwn(r: dict[str, Any], prev: dict[str, Any] | None, prev_label: str = "전일") -> str:
    c = compute_report(r)
    d = compare_report(r, prev)
    f = r["fixed"]
    prod = "생산 데이터 없음" if r["noData"] else f"생산 {n0(r['production'])}개"
    lines = [
        "*요약*",
        (
            f"S 안전 위반 {r['safety']['violations']}건 · Q 불량률 {pct(c['defectRate'])} · "
            f"D {prod} · C 순손실 {pct(c['netLossRate'])} · P 출근 {pct(c['attendanceRate'])}"
        ),
        "",
        "*S 안전 (검색대 안전장구)*",
        "_보호구 착용 위반 대시보드와 같은 판정 기준_",
        f"• 검색대 통과율 {pct(c['safetyPassRate'])} (태깅 {n0(r['safety']['scans'])}건)",
        (
            f"• 미착용 위반 {n0(r['safety']['violations'])}건 · {prev_label} "
            f"{delta_txt(d['violations'], lambda x: str(int(abs(x))))}"
        ),
        f"• 재위반 인원 {n0(r['safety']['repeatViolators'])}명 (기간 내 2회 이상)",
        "",
        "*업체별 위반 (많은 순)*",
    ]
    if c["companies"]:
        for x in c["companies"]:
            lines.append(f"• {x['company']} ({x['type']}) {x['count']}건")
    else:
        lines.append("• 위반 없음")
    lines += ["", "*미착용 장구 (많은 순)*"]
    if c["gears"]:
        for g, cnt in c["gears"]:
            lines.append(f"• {GEAR_LABEL.get(g, g)} {cnt}")
    else:
        lines.append("• 위반 없음")

    lines += [
        "",
        "*Q 품질*",
        "_불량 = 실제 판정(mes) · SPC = I 관리선 밖 · 리콜·재활용률 = 고정값_",
        (
            f"• 불량량 {'—' if r['noData'] else n0(r['defects']) + '개'} · 불량률 {pct(c['defectRate'])} · "
            f"{prev_label} {delta_txt(d['defectRatePp'], lambda x: f'{abs(x):.1f}%p')}"
        ),
        (
            f"• SPC 경고 알람 {'—' if r['noData'] else n0(c['spcTotal']) + '건'} "
            f"(UCL {n0(r['spcAlarms']['ucl'])} · LCL {n0(r['spcAlarms']['lcl'])})"
        ),
        (
            f"• 고객사 리콜 {'—' if f['recall'] is None else n0(f['recall']) + '회'}"
            + ("" if f["recall"] is None else " (최근 12개월 고정값)")
        ),
        (
            f"• 불량 재활용률 {pct(f['recycleRate'])}"
            + (
                ""
                if f["recycleRate"] is None
                else f" · 재활용 {n0(c['recycled'] or 0)}개 · 회수 {won(c['recycleSaving'])}"
            )
        ),
        "",
        "*D 생산 · 설비*",
        f"• 생산량 {'—' if r['noData'] else n0(r['production']) + '개'}"
        + (" (기간에 생산 데이터 없음)" if r["noData"] else ""),
        (
            f"• MTTR · MTBF "
            f"{'—' if f['mttr'] is None else f'{f['mttr']}h'} · "
            f"{'—' if f['mtbf'] is None else f'{f['mtbf']}h'}"
        ),
        "",
        "*C 원가*",
        "_단가 고정값 미등록_" if f["unitPrice"] is None else f"_단가 {won(f['unitPrice'])} 기준_",
        f"• 생산 금액 {won(c['amount'])}",
        f"• 불량 손실 비용 {won(c['lossCost'])} ({pct(c['defectRate'])})",
        f"• 순 손실 비용 {won(c['netLoss'])} ({pct(c['netLossRate'])})",
        "",
        "*P 인력 (근태)*",
        f"• 총 인원 {n0(r['attendance']['total'])}명",
        f"• 출근 인원 {n0(r['attendance']['present'])}명",
        f"• 출근율 {pct(c['attendanceRate'])}",
        f"• 인당 생산 {'—' if c['perCapita'] is None else f'{c['perCapita']:.1f}개'}",
    ]
    return "\n".join(lines)


def build_daily_slack(src: dict[str, Any], day: date) -> tuple[str, str]:
    ymd = day.isoformat()
    prev_d = (day - timedelta(days=1)).isoformat()
    cur = build_report(src, ymd, ymd)
    prev = build_report(src, prev_d, prev_d)
    has_prev = any(prev_d == x["date"] for x in src["daily"]) or any(
        prev_d == x["date"] for x in src["attendance"]
    ) or any(prev_d == x["date"] for x in src["safety"]["scans"])
    title = f"{ymd} 일일 경영 리포트"
    body = (
        f"대상일 {ymd} · 전체 라인(line_no1~3) · CylinderHead\n\n"
        + build_mgmt_mrkdwn(cur, prev if has_prev else None, "전일")
    )
    return title, body
