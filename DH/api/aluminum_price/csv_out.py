"""최초 백필 CSV 산출 (MS가 org 적재 후 파일 삭제)."""
from __future__ import annotations

import csv
import logging
from pathlib import Path

from .env_load import project_root
from .parse import AlRow

log = logging.getLogger("dh.aluminum_price.csv_out")


def default_csv_path() -> Path:
    return project_root() / "DH" / "data" / "aluminum_price" / "aluminum_price_backfill.csv"


def write_backfill_csv(rows: list[AlRow], path: Path | None = None) -> Path:
    out = path or default_csv_path()
    out.parent.mkdir(parents=True, exist_ok=True)
    # 일자 중복 시 최신 파싱값 유지
    by_date = {r.price_date: r.price for r in rows}
    ordered = sorted(by_date.items(), key=lambda x: x[0], reverse=True)
    with out.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["price_date", "price"])
        for d, p in ordered:
            w.writerow([d.isoformat(), f"{p:.4f}".rstrip("0").rstrip(".")])
    log.info("CSV 저장 path=%s rows=%s", out, len(ordered))
    return out
