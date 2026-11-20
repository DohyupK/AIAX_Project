"""협회 LME시세 HTML에서 일자·Al만 파싱 (stdlib html.parser)."""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from html.parser import HTMLParser


@dataclass(frozen=True)
class AlRow:
    price_date: date
    price: float


_DATE_RE = re.compile(r"^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})$")


def parse_price_date(text: str) -> date | None:
    m = _DATE_RE.match(text.strip())
    if not m:
        return None
    y, mo, d = (int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return date(y, mo, d)


def parse_price_number(text: str) -> float | None:
    s = text.strip().replace(",", "").replace(" ", "")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


class _LmeTableParser(HTMLParser):
    """첫 데이터 테이블에서 헤더 Al 열·일자 열을 찾아 행 수집."""

    def __init__(self) -> None:
        super().__init__()
        self._in_table = False
        self._table_done = False
        self._in_tr = False
        self._in_cell = False
        self._cell_parts: list[str] = []
        self._row_cells: list[str] = []
        self._al_idx: int | None = None
        self._date_idx: int = 0
        # 금속 헤더 행에 일자 열이 없으면(Cu가 0열) 데이터 행은 일자+금속 → Al 인덱스 +1
        self._metal_header_offset: int = 0
        self.rows: list[AlRow] = []
        self.error: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if self._table_done:
            return
        if tag == "table" and not self._in_table:
            self._in_table = True
            return
        if not self._in_table:
            return
        if tag == "tr":
            self._in_tr = True
            self._row_cells = []
            return
        if self._in_tr and tag in ("td", "th"):
            self._in_cell = True
            self._cell_parts = []

    def handle_endtag(self, tag: str) -> None:
        if self._table_done:
            return
        if tag in ("td", "th") and self._in_cell:
            text = "".join(self._cell_parts).strip()
            self._row_cells.append(text)
            self._in_cell = False
            self._cell_parts = []
            return
        if tag == "tr" and self._in_tr:
            self._in_tr = False
            self._consume_row(self._row_cells)
            self._row_cells = []
            return
        if tag == "table" and self._in_table:
            self._in_table = False
            self._table_done = True
            if self._al_idx is None:
                self.error = "헤더에서 Al 열을 찾지 못함"

    def handle_data(self, data: str) -> None:
        if self._in_cell:
            self._cell_parts.append(data)

    def _consume_row(self, cells: list[str]) -> None:
        if not cells:
            return
        upper = [c.strip() for c in cells]
        if self._al_idx is None and any(c.upper() == "AL" for c in upper):
            header_al: int | None = None
            for i, c in enumerate(upper):
                if c.upper() == "AL":
                    header_al = i
            if header_al is None:
                return
            self._date_idx = 0
            # 예: ['Cu','Al',...] → 데이터는 [일자,Cu,Al,...] 이므로 offset=1
            # 예: ['','Cu','Al',...] 또는 ['일자','Cu','Al',...] → offset=0 후 Al 열 그대로
            first = upper[0].upper() if upper else ""
            if first in ("CU", "AL", "ZN", "PB", "NI", "SN"):
                self._metal_header_offset = 1
            else:
                self._metal_header_offset = 0
            self._al_idx = header_al + self._metal_header_offset
            return
        if self._al_idx is None:
            return
        if len(cells) <= self._al_idx:
            return
        pd = parse_price_date(cells[self._date_idx])
        if pd is None:
            return
        pr = parse_price_number(cells[self._al_idx])
        if pr is None:
            return
        self.rows.append(AlRow(price_date=pd, price=pr))


def parse_lme_al_html(html: str) -> list[AlRow]:
    parser = _LmeTableParser()
    parser.feed(html)
    if parser.error and not parser.rows:
        raise ValueError(parser.error)
    return parser.rows
