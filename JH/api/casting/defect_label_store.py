"""불량 유형 라벨 저장소 — 이 페이지 「완료」저장만: JH/data/defect_labels.db (SQLite, git 제외 · AGENTS.md 10항)

Postgres ai.defect_label / ai.defect_discard 쓰기 대신 서버 로컬 파일에 남김.
목록 GET 은 SQLite 상태를 머지해 새로고침 후에도 라벨 완료·폐기 유지.
ponytail: 정식 Postgres 쓰기가 되면 upsert_label·get_labels 만 교체 — 라우터 시그니처는 그대로
"""
from __future__ import annotations

import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "defect_labels.db"  # JH/api/casting → JH/data

DEFECT_TYPES = ("blowhole", "edge_burr", "surface_rough")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS defect_label (
    casting_id     TEXT PRIMARY KEY,
    status         TEXT NOT NULL CHECK (status IN ('labeled', 'discarded')),
    blowhole       INTEGER NOT NULL DEFAULT 0,
    edge_burr      INTEGER NOT NULL DEFAULT 0,
    surface_rough  INTEGER NOT NULL DEFAULT 0,
    updated_at     TEXT NOT NULL,
    updated_by     TEXT NOT NULL DEFAULT ''
)
"""


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH, timeout=5)
    c.row_factory = sqlite3.Row
    c.execute(_SCHEMA)
    return c


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def upsert_label(casting_id: str, types: set[str], updated_by: str = "") -> dict:
    """types = 소문자 코드 집합. UNDECIDABLE 단독 → discarded, 그 외 → labeled.
    반환: {status, types} (types 는 화면용 대문자 목록)
    """
    discard = types == {"undecidable"}
    if discard:
        flags = {k: 0 for k in DEFECT_TYPES}
        status = "discarded"
        out_types: list[str] = []
    else:
        flags = {k: (1 if k in types else 0) for k in DEFECT_TYPES}
        status = "labeled"
        out_types = [k.upper() for k in DEFECT_TYPES if flags[k]]

    with closing(_conn()) as c, c:
        c.execute(
            """INSERT INTO defect_label
               (casting_id, status, blowhole, edge_burr, surface_rough, updated_at, updated_by)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(casting_id) DO UPDATE SET
                 status=excluded.status,
                 blowhole=excluded.blowhole,
                 edge_burr=excluded.edge_burr,
                 surface_rough=excluded.surface_rough,
                 updated_at=excluded.updated_at,
                 updated_by=excluded.updated_by""",
            (
                casting_id,
                status,
                flags["blowhole"],
                flags["edge_burr"],
                flags["surface_rough"],
                _now(),
                updated_by or "",
            ),
        )
    return {"status": status, "types": out_types}


def get_labels(casting_ids: list[str]) -> dict[str, dict]:
    """casting_id → {status, types}. 없는 id 는 결과에 없음."""
    if not casting_ids:
        return {}
    placeholders = ",".join("?" * len(casting_ids))
    with closing(_conn()) as c:
        rows = c.execute(
            f"SELECT casting_id, status, blowhole, edge_burr, surface_rough "
            f"FROM defect_label WHERE casting_id IN ({placeholders})",
            casting_ids,
        ).fetchall()
    out: dict[str, dict] = {}
    for r in rows:
        status = r["status"]
        types = (
            []
            if status == "discarded"
            else [k.upper() for k in DEFECT_TYPES if r[k]]
        )
        out[r["casting_id"]] = {"status": status, "types": types}
    return out
