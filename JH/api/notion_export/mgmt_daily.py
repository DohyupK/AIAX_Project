"""일일 경영 리포트 → 노션 블록 (화면 ReportView S/Q/D/C/P 양식)"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from notion_export.blocks import bullet, callout, divider, heading2, heading3, paragraph, table
from notion_export.mgmt_calc import GEAR_LABEL, build_report, compare_report, compute_report

KST = ZoneInfo("Asia/Seoul")


def pct(v: float | None) -> str:
    return "—" if v is None else f"{v * 100:.1f}%"


def won(n: float | None) -> str:
    return "—" if n is None else f"{int(n):,}원"


def n0(n: int | float) -> str:
    return f"{int(n):,}"


def delta_txt(v: float | None, fmt) -> str:
    if v is None:
        return "비교 없음"
    if abs(v) < 1e-9:
        return "– 0"
    return f"▲{fmt(v)}" if v > 0 else f"▼{fmt(abs(v))}"


def target_date(today: date | None = None) -> date:
    """어제(KST) — 당일 미완 집계 방지"""
    from datetime import datetime

    base = today or datetime.now(KST).date()
    return base - timedelta(days=1)


def build_mgmt_blocks(r: dict[str, Any], prev: dict[str, Any] | None, prev_label: str = "전일") -> list[dict[str, Any]]:
    c = compute_report(r)
    d = compare_report(r, prev)
    f = r["fixed"]
    blocks: list[dict[str, Any]] = [
        heading2("요약"),
        callout(
            "S 안전 위반 {v}건 · Q 불량률 {dr} · D {prod} · C 순손실 {nl} · P 출근 {ar}".format(
                v=r["safety"]["violations"],
                dr=pct(c["defectRate"]),
                prod="생산 데이터 없음" if r["noData"] else f"생산 {n0(r['production'])}개",
                nl=pct(c["netLossRate"]),
                ar=pct(c["attendanceRate"]),
            ),
            "📊",
        ),
        divider(),
        heading2("S 안전 (검색대 안전장구)"),
        paragraph("보호구 착용 위반 대시보드와 같은 판정 기준"),
        bullet(f"검색대 통과율 {pct(c['safetyPassRate'])} (태깅 {n0(r['safety']['scans'])}건)"),
        bullet(
            f"미착용 위반 {n0(r['safety']['violations'])}건 · {prev_label} "
            f"{delta_txt(d['violations'], lambda x: str(int(abs(x))))}"
        ),
        bullet(f"재위반 인원 {n0(r['safety']['repeatViolators'])}명 (기간 내 2회 이상)"),
        heading3("업체별 위반 (많은 순)"),
    ]
    if c["companies"]:
        blocks.append(
            table(
                ["업체", "구분", "위반"],
                [[x["company"], x["type"], f"{x['count']}건"] for x in c["companies"]],
            )
        )
    else:
        blocks.append(paragraph("위반 없음"))

    blocks.append(heading3("미착용 장구 (많은 순)"))
    if c["gears"]:
        for g, cnt in c["gears"]:
            blocks.append(bullet(f"{GEAR_LABEL.get(g, g)} {cnt}"))
    else:
        blocks.append(paragraph("위반 없음"))

    blocks.extend(
        [
            divider(),
            heading2("Q 품질"),
            paragraph("불량 = 실제 판정(mes) · SPC = I 관리선 밖 「샷 × 변수」 · 리콜·재활용률 = 고정값"),
            bullet(
                f"불량량 {'—' if r['noData'] else n0(r['defects']) + '개'} · 불량률 {pct(c['defectRate'])} · "
                f"{prev_label} {delta_txt(d['defectRatePp'], lambda x: f'{abs(x):.1f}%p')}"
            ),
            bullet(
                f"SPC 경고 알람 {'—' if r['noData'] else n0(c['spcTotal']) + '건'} "
                f"(UCL 초과 {n0(r['spcAlarms']['ucl'])} · LCL 미만 {n0(r['spcAlarms']['lcl'])})"
            ),
            bullet(
                f"고객사 리콜 {'—' if f['recall'] is None else n0(f['recall']) + '회'}"
                + ("" if f["recall"] is None else " (최근 12개월 고정값)")
            ),
            bullet(
                f"불량 재활용률 {pct(f['recycleRate'])}"
                + (
                    ""
                    if f["recycleRate"] is None
                    else f" · 재활용 {n0(c['recycled'] or 0)}개 · 회수 {won(c['recycleSaving'])}"
                )
            ),
            divider(),
            heading2("D 생산 · 설비"),
            paragraph("생산량 = 실제(mes, 세 라인 합계)"),
            bullet(
                f"생산량 {'—' if r['noData'] else n0(r['production']) + '개'}"
                + (" (기간에 생산 데이터 없음)" if r["noData"] else "")
            ),
            bullet(
                f"MTTR · MTBF "
                f"{'—' if f['mttr'] is None else f'{f['mttr']}h'} · "
                f"{'—' if f['mtbf'] is None else f'{f['mtbf']}h'}"
            ),
            divider(),
            heading2("C 원가"),
            paragraph("단가 고정값 미등록" if f["unitPrice"] is None else f"단가 {won(f['unitPrice'])} 기준"),
            bullet(f"생산 금액 {won(c['amount'])} (생산량 × 단가)"),
            bullet(f"불량 손실 비용 {won(c['lossCost'])} (불량량 × 단가 · {pct(c['defectRate'])})"),
            bullet(f"순 손실 비용 {won(c['netLoss'])} (불량 손실 − 재활용 회수 · {pct(c['netLossRate'])})"),
            divider(),
            heading2("P 인력 (근태)"),
            paragraph("총 인원 = 그날 근무 예정자 (근무 기록 기준), 출근 = 그중 결근 아님"),
            bullet(f"총 인원 {n0(r['attendance']['total'])}명"),
            bullet(f"출근 인원 {n0(r['attendance']['present'])}명"),
            bullet(f"출근율 {pct(c['attendanceRate'])}"),
            bullet(
                f"인당 생산 {'—' if c['perCapita'] is None else f'{c['perCapita']:.1f}개'} (생산량 ÷ 출근 인원)"
            ),
        ]
    )
    return blocks


def assemble_source(daily, safety, spc, attendance, fixed) -> dict[str, Any]:
    return {"daily": daily, "safety": safety, "spc": spc, "attendance": attendance, "fixed": fixed}


def build_daily_payload(src: dict[str, Any], day: date) -> tuple[str, list[dict[str, Any]]]:
    """제목 + 블록. day = 대상일, 전일 대비는 day-1."""
    ymd = day.isoformat()
    prev_d = (day - timedelta(days=1)).isoformat()
    cur = build_report(src, ymd, ymd)
    prev = build_report(src, prev_d, prev_d)
    # 전일 원자료가 전혀 없으면 비교 없음
    has_prev = any(prev_d == x["date"] for x in src["daily"]) or any(
        prev_d == x["date"] for x in src["attendance"]
    ) or any(prev_d == x["date"] for x in src["safety"]["scans"])
    title = f"{ymd} 일일 경영 리포트"
    blocks = [
        paragraph(f"대상일 {ymd} · 전체 라인(line_no1~3) · CylinderHead"),
        *build_mgmt_blocks(cur, prev if has_prev else None, "전일"),
    ]
    return title, blocks
