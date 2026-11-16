"""근태·게이트 관련 순수 계산. DB/FastAPI 의존 없음.

access_code·지각/조퇴 자동판정은 이 모듈에 두지 않음 (시드/별도 정책).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any


def _parse_dt(value: str) -> datetime:
    text = value.strip()
    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%H:%M:%S",
        "%H:%M",
    ):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    raise ValueError(f"unsupported datetime: {value!r}")


def compute_actual_hour(
    clock_in_at: str | None,
    clock_out_at: str | None,
) -> float | None:
    """출근~퇴근 시간(실수). 한쪽만 있으면 None."""
    if not clock_in_at or not clock_out_at:
        return None
    start = _parse_dt(clock_in_at)
    end = _parse_dt(clock_out_at)
    seconds = (end - start).total_seconds()
    if seconds < 0:
        return None
    return round(seconds / 3600.0, 2)


def compute_overtime_hour(actual_hour: float | None) -> float | None:
    """actual−9. ≤0 또는 None이면 None. (9시간 초과분만)"""
    if actual_hour is None:
        return None
    delta = actual_hour - 9.0
    if delta <= 0:
        return None
    return round(delta, 2)


def compute_monthly_overtime_hour(actual_hour: float | None) -> float | None:
    """actual−10. ≤0 또는 None이면 None (월 초기화 대상 값)."""
    if actual_hour is None:
        return None
    delta = actual_hour - 10.0
    if delta <= 0:
        return None
    return round(delta, 2)


def compute_years_of_service(
    employee_created_at: str | datetime | date,
    today: date | None = None,
) -> int:
    """오늘 − employee.created_at 정수 근속년수."""
    today = today or date.today()
    if isinstance(employee_created_at, datetime):
        created = employee_created_at.date()
    elif isinstance(employee_created_at, date):
        created = employee_created_at
    else:
        created = datetime.strptime(str(employee_created_at)[:10], "%Y-%m-%d").date()
    years = today.year - created.year
    if (today.month, today.day) < (created.month, created.day):
        years -= 1
    return max(0, years)


def gate_flags_for_employee() -> tuple[str, str]:
    """사원 카드: 양쪽 게이트 O."""
    return ("O", "O")


def gate_flags_for_vender_card(
    vender_card_id: str,
) -> tuple[str | None, str | None]:
    """끝자리 a → gate_a만 O / b → gate_b만 O."""
    if not vender_card_id:
        raise ValueError("vender_card_id required")
    last = vender_card_id[-1].lower()
    if last == "a":
        return ("O", None)
    if last == "b":
        return (None, "O")
    raise ValueError(f"vender_card_id must end with a|b: {vender_card_id!r}")


def build_vender_card_id(
    company_prefix2: str,
    yymmdd: str,
    gate: str,
) -> str:
    """예: hb + 260601 + a → hb260601a."""
    prefix = company_prefix2.strip().lower()
    g = gate.strip().lower()
    if len(prefix) != 2 or not prefix.isalpha():
        raise ValueError("company_prefix2 must be 2 letters")
    if len(yymmdd) != 6 or not yymmdd.isdigit():
        raise ValueError("yymmdd must be 6 digits")
    if g not in ("a", "b"):
        raise ValueError("gate must be a|b")
    return f"{prefix}{yymmdd}{g}"


def clamp_annual_leave_used(n: int | None) -> int:
    """연차 사용량 0~15."""
    if n is None:
        return 0
    return max(0, min(15, int(n)))


def bump_annual_leave_used(
    current: int | None,
    absent_flag: str | None,
) -> int:
    """absent가 있으면 +1 후 clamp."""
    base = clamp_annual_leave_used(current)
    if absent_flag:
        return clamp_annual_leave_used(base + 1)
    return base


def build_employee_record_fields(
    clock_in_at: str | None = None,
    clock_out_at: str | None = None,
    *,
    absent: str | None = None,
    late: str | None = None,
    early_leave: str | None = None,
    work_deficit: str | None = None,
) -> dict[str, Any]:
    """게이트 시각 → actual/overtime 산출. late/early_leave는 호출측이 넘긴 값만 사용."""
    if absent:
        return {
            "actual_hour": None,
            "overtime_hour": None,
            "late": None,
            "early_leave": None,
            "absent": absent,
            "work_deficit": work_deficit,
        }
    actual = compute_actual_hour(clock_in_at, clock_out_at)
    return {
        "actual_hour": actual,
        "overtime_hour": compute_overtime_hour(actual),
        "late": late,
        "early_leave": early_leave,
        "absent": None,
        "work_deficit": work_deficit,
    }
