"""Shift 봇용 품질 검사 KPI — 대시보드 전체 생산 샷·최종 불량률·전체 불량 개수와 동일 정의."""
from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from casting import dl_model, model
from casting.router import SHOT_COLS, to_shot
from common.db import connect

log = logging.getLogger("jh.documents.quality_context")

DB = "DATABASE_URL"  # app_lake — mes + ai.quality_prediction 읽기
LINES = ("line_no1", "line_no2", "line_no3")
KST = ZoneInfo("Asia/Seoul")


def _kst_today() -> date:
    return datetime.now(KST).date()


def _latest_date(conn, line: str) -> date | None:
    row = conn.execute(
        'SELECT MAX("timestamp") AS d FROM mes.investment_casting WHERE line_unit = %s',
        [line],
    ).fetchone()
    d = row["d"] if row else None
    return d if isinstance(d, date) else None


def _load_rows(conn, line: str, day: date) -> list[dict]:
    return list(
        conn.execute(
            f'SELECT {SHOT_COLS} FROM mes.investment_casting WHERE line_unit = %s AND "timestamp" = %s '
            "ORDER BY date, production_count",
            (line, day),
        ).fetchall()
    )


def _second_fail_ids(conn, line: str, day: date, meta: dict[str, str]) -> set[str]:
    """저장된 2차 판정 불량 casting_id (현재 DL 모델·버전·이미지 갱신 이후)."""
    rows = conn.execute(
        """SELECT i.casting_id, i.updated_at, q.model_name, q.version, q.result, q.predicted_at
           FROM mes.casting_image i
           JOIN mes.investment_casting m USING (casting_id)
           LEFT JOIN ai.quality_prediction q USING (casting_id)
           WHERE m.line_unit = %s AND m."timestamp" = %s""",
        (line, day),
    ).fetchall()
    out: set[str] = set()
    for r in rows:
        done = (
            r["result"] is not None
            and r["model_name"] == meta["name"]
            and r["version"] == meta["version"]
            and r["predicted_at"] is not None
            and r["updated_at"] is not None
            and r["predicted_at"] >= r["updated_at"]
        )
        if done and r["result"] == "fail":
            out.add(r["casting_id"])
    return out


def _line_kpi(conn, line: str, th: float, dl_meta: dict[str, str] | None) -> dict[str, Any] | None:
    today = _kst_today()
    day = today
    rows = _load_rows(conn, line, day)
    if not rows:
        latest = _latest_date(conn, line)
        if latest is None:
            return None
        day = latest
        rows = _load_rows(conn, line, day)
    if not rows:
        return None

    try:
        probs = model.scores(rows)
    except Exception:
        log.exception("품질 KPI 1차 점수 실패 line=%s", line)
        return None

    shots = [to_shot(r, s) for r, s in zip(rows, probs)]
    first_ids = {s["castingId"] for s in shots if s["prob"] >= th}
    first_n = len(first_ids)

    second_n = 0
    if dl_meta:
        try:
            fail_ids = _second_fail_ids(conn, line, day, dl_meta)
            # 1차 양품만 2차 불량으로 집계 (inspection.summarize 와 동일)
            second_n = len(fail_ids - first_ids)
        except Exception:
            log.exception("품질 KPI 2차 조회 실패 line=%s — 1차만 집계", line)

    total = len(shots)
    final = first_n + second_n
    rate = (final / total * 100.0) if total else None
    return {
        "line": line,
        "date": day.isoformat(),
        "total": total,
        "first": first_n,
        "second": second_n,
        "final": final,
        "rate": rate,
        "threshold": th,
    }


def _kpi_to_source(k: dict[str, Any]) -> dict[str, Any]:
    rate_s = f"{k['rate']:.2f}%" if k["rate"] is not None else "N/A"
    snippet = (
        f"전체 생산 샷: {k['total']}\n"
        f"전체 불량 개수(1차+2차): {k['final']} (1차 {k['first']} + 2차 {k['second']})\n"
        f"최종 불량률: {rate_s}"
    )
    return {
        "kind": "quality_kpi",
        "company_document_idx": 0,
        "doc_no": f"QKPI-{k['line']}-{k['date']}",
        "title": f"품질 KPI · {k['line']} · {k['date']}",
        "file_name": f"threshold={k['threshold']:.3f}",
        "category": "quality_inspection",
        "chunk_no": 0,
        "score": 1.0,
        "content": snippet,
        "line": k["line"],
    }


def _kpi_block(k: dict[str, Any]) -> str:
    rate_s = f"{k['rate']:.2f}%" if k["rate"] is not None else "N/A"
    return (
        f"[QKPI-{k['line']}-{k['date']}] 품질 검사 KPI\n"
        f"라인: {k['line']} · 날짜: {k['date']} · 1차 기준값: {k['threshold']:.3f}\n"
        f"전체 생산 샷: {k['total']}\n"
        f"전체 불량 개수(1차+2차): {k['final']} (1차 {k['first']} + 2차 {k['second']})\n"
        f"최종 불량률: {rate_s}"
    )


def collect_quality_context() -> tuple[list[dict[str, Any]], str]:
    """라인별 품질 KPI → (sources, LLM 텍스트). 실패 시 빈 결과."""
    try:
        ml = model.info()
        th = float(ml["threshold"])
    except Exception:
        log.exception("품질 KPI — 1차 모델 정보 실패")
        return [], ""

    dl_meta: dict[str, str] | None
    try:
        info = dl_model.info()
        dl_meta = {"name": info["name"], "version": info["version"]}
    except Exception:
        log.warning("품질 KPI — 2차 모델 정보 없음, 1차만 집계")
        dl_meta = None

    kpis: list[dict[str, Any]] = []
    try:
        with connect(DB) as conn:
            for line in LINES:
                k = _line_kpi(conn, line, th, dl_meta)
                if k:
                    kpis.append(k)
    except Exception:
        log.exception("품질 KPI 컨텍스트 수집 실패")
        return [], ""

    if not kpis:
        return [], ""

    sources = [_kpi_to_source(k) for k in kpis]
    text = "\n\n".join(_kpi_block(k) for k in kpis)
    log.info("Shift 품질 KPI %d라인", len(kpis))
    return sources, text
