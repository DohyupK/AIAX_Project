"""인사 관리 권한·규칙 (DB·웹 의존 없음) — 자체 점검: rules_check.py

열람 범위 (행)
  - 인사팀 = 경영부(10): 인턴 제외 전원이 전 직원 열람
  - 그 외 부서: 인턴 제외 전원이 자기 팀(team_code) 팀원만
  - 인턴: 열람 불가
열람 등급 (칼럼) — FIELD_TIERS
  - basic : 팀원(사원·대리)
  - manage: 팀 대표 + 과장 이상
  - hr    : 인사팀(경영부) — 전체
추가·수정·삭제
  - 경영부(인턴 제외): 전 직원
  - 팀 대표: 자기 팀만 (팀 변경도 자기 팀으로만)
"""
from __future__ import annotations

import re
from dataclasses import dataclass

HR_DEPT = "10"            # 인사 담당 부서 = 경영부
INTERN_CODE = 100         # org."position".position_code
MANAGER_CODE = 400        # 과장 이상
DIRECTOR_CODE = 700       # 소장 (access_code 고정 700)

# 등급별로 "추가로" 보이는 칼럼. 위 등급은 아래 등급 칼럼을 모두 포함
FIELD_TIERS: dict[str, tuple[str, ...]] = {
    "basic": ("employee_no", "employee_name", "dept_code", "dept_name", "position_name", "position_code",
              "team_code", "email", "is_dept_rep", "is_team_rep"),
    "manage": ("phone", "years_of_service", "annual_leave_used", "monthly_overtime_hour"),
    "hr": ("age", "gender", "address", "created_at"),
}
TIER_ORDER = ("basic", "manage", "hr")


@dataclass(frozen=True)
class Viewer:
    employee_no: str
    dept_code: str
    position_code: int
    team_code: str | None
    is_team_rep: bool

    @property
    def is_intern(self) -> bool:
        return self.position_code <= INTERN_CODE

    @property
    def is_hr(self) -> bool:
        return self.dept_code == HR_DEPT and not self.is_intern


def tier_of(v: Viewer) -> str | None:
    """열람 등급. None = 열람 불가"""
    if v.is_intern:
        return None
    if v.is_hr:
        return "hr"
    if v.is_team_rep or v.position_code >= MANAGER_CODE:
        return "manage"
    return "basic"


def visible_fields(tier: str) -> tuple[str, ...]:
    out: list[str] = []
    for t in TIER_ORDER:
        out += FIELD_TIERS[t]
        if t == tier:
            return tuple(out)
    raise ValueError(f"unknown tier: {tier}")


def filter_fields(row: dict, tier: str) -> dict:
    """권한 없는 칼럼은 응답에서 아예 제거 (화면에서 숨기는 게 아님)"""
    return {k: row.get(k) for k in visible_fields(tier)}


def can_view_row(v: Viewer, row_team: str | None) -> bool:
    if v.is_intern:
        return False
    if v.is_hr:
        return True
    return v.team_code is not None and row_team == v.team_code


def can_write_team(v: Viewer, team: str | None) -> bool:
    """이 팀(또는 팀 없음)의 사원을 추가·수정·삭제할 수 있는가"""
    if v.is_hr:
        return True
    return v.is_team_rep and not v.is_intern and v.team_code is not None and team == v.team_code


def can_create(v: Viewer) -> bool:
    return v.is_hr or (v.is_team_rep and not v.is_intern and v.team_code is not None)


def sort_key(row: dict) -> tuple:
    """직급 높은 순(소장 → 인턴), 같은 직급은 사번 순"""
    return (-int(row["position_code"]), row["employee_no"])


def next_employee_no(existing: list[str], dept_code: str) -> str:
    """E + 부서코드 + 3자리 순번 (같은 부서 최대 + 1). 예: E30019"""
    if not re.fullmatch(r"\d{2}", dept_code):
        raise ValueError("부서 코드는 숫자 2자리여야 합니다.")
    prefix = f"E{dept_code}"
    seqs = [int(n[len(prefix):]) for n in existing
            if n.startswith(prefix) and len(n) == len(prefix) + 3 and n[len(prefix):].isdigit()]
    nxt = max(seqs, default=0) + 1
    if nxt > 999:
        raise ValueError(f"{dept_code} 부서의 사번이 가득 찼습니다 (999).")
    return f"{prefix}{nxt:03d}"


def access_code_of(dept_code: str, position_code: int, is_team_rep: bool) -> int:
    """org 시드 규칙: 부서코드×10 + 직급코드÷100, 팀 대표 +1, 소장 700"""
    if position_code >= DIRECTOR_CODE:
        return DIRECTOR_CODE
    return int(dept_code) * 10 + position_code // 100 + (1 if is_team_rep else 0)


GENDERS = ("M", "F", "other")
_PHONE = re.compile(r"0\d{1,2}-?\d{3,4}-?\d{4}")
_EMAIL = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


def validate_person(d: dict, *, partial: bool = False) -> dict[str, str]:
    """개인정보 입력 검증 — 항목별 오류 문구 (비어 있으면 통과). partial: 수정 시 보낸 항목만 검사"""
    e: dict[str, str] = {}

    def has(k: str) -> bool:
        return not partial or k in d

    if has("employee_name"):
        name = str(d.get("employee_name") or "").strip()
        if not name:
            e["employee_name"] = "이름을 입력하세요."
        elif len(name) > 50:
            e["employee_name"] = "이름은 50자 이하로 입력하세요."
    if has("age"):
        age = d.get("age")
        if not isinstance(age, int) or isinstance(age, bool) or not 15 <= age <= 100:
            e["age"] = "나이는 15~100 사이 숫자로 입력하세요."
    if has("gender") and d.get("gender") not in GENDERS:
        e["gender"] = "성별을 선택하세요."
    if has("phone") and not _PHONE.fullmatch(str(d.get("phone") or "").strip()):
        e["phone"] = "전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)"
    if has("address"):
        addr = str(d.get("address") or "").strip()
        if not addr:
            e["address"] = "주소를 입력하세요."
        elif len(addr) > 200:
            e["address"] = "주소는 200자 이하로 입력하세요."
    if has("email"):
        email = str(d.get("email") or "").strip()
        if not _EMAIL.fullmatch(email) or len(email) > 100:
            e["email"] = "이메일 형식이 올바르지 않습니다."
    return e
