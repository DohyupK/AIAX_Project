"""인사 관리 권한·규칙 (DB·웹 의존 없음) — 자체 점검: rules_check.py

코드 체계 (org, 2026-11-17 개편): 부서 1000~7000, 직급 10000(인턴)~70000(소장), 팀 10~60, 사번 e0001~

열람 범위 (행)
  - 인사팀 = 경영부(1000): 인턴 제외 전원이 전 직원 열람
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
from datetime import date

HR_DEPT = 1000            # 인사 담당 부서 = 경영부 (org.department.dept_code)
INTERN_CODE = 10000       # org."position".position_code
MANAGER_CODE = 40000      # 과장 이상

# 등급별로 "추가로" 보이는 칼럼. 위 등급은 아래 등급 칼럼을 모두 포함
FIELD_TIERS: dict[str, tuple[str, ...]] = {
    "basic": ("employee_no", "employee_name", "dept_code", "dept_name", "position_name", "position_code",
              "team_code", "team_name", "email", "is_dept_rep", "is_team_rep"),
    "manage": ("phone", "years_of_service", "annual_leave_used", "monthly_overtime_hour"),
    "hr": ("age", "birth_date", "gender", "address", "created_at"),  # age = birth_date 로 계산한 만 나이
}
TIER_ORDER = ("basic", "manage", "hr")


@dataclass(frozen=True)
class Viewer:
    employee_no: str
    dept_code: int
    position_code: int
    team_code: int | None
    is_team_rep: bool
    team_name: str | None = None   # 표시용 (casting1 … tf)
    actor: str | None = None       # 실제 행동한 계정 (관리자 보기 전환 시 "admin:아이디") — 접속 기록·로그용

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


def can_view_row(v: Viewer, row_team: int | None) -> bool:
    if v.is_intern:
        return False
    if v.is_hr:
        return True
    return v.team_code is not None and row_team == v.team_code


def can_write_team(v: Viewer, team: int | None) -> bool:
    """이 팀(또는 팀 없음)의 사원을 추가·수정·삭제할 수 있는가"""
    if v.is_hr:
        return True
    return v.is_team_rep and not v.is_intern and v.team_code is not None and team == v.team_code


def can_create(v: Viewer) -> bool:
    return v.is_hr or (v.is_team_rep and not v.is_intern and v.team_code is not None)


def sort_key(row: dict) -> tuple:
    """직급 높은 순(소장 → 인턴), 같은 직급은 사번 순"""
    return (-int(row["position_code"]), row["employee_no"])


_EMP_NO = re.compile(r"e(\d{4})")


def next_employee_no(existing: list[str]) -> str:
    """e + 4자리 일련번호 (부서와 무관, 전체 최대 + 1). 예: e0055"""
    seqs = [int(m.group(1)) for n in existing if (m := _EMP_NO.fullmatch(n))]
    nxt = max(seqs, default=0) + 1
    if nxt > 9999:
        raise ValueError("사번이 가득 찼습니다 (e9999).")
    return f"e{nxt:04d}"


GENDERS = ("M", "F", "other")
_PHONE = re.compile(r"0\d{1,2}-?\d{3,4}-?\d{4}")
_EMAIL = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


def parse_date(v) -> date | None:
    """'YYYY-MM-DD' 문자열 또는 date → date. 형식이 틀리면 None"""
    if isinstance(v, date):
        return v
    try:
        return date.fromisoformat(str(v).strip()) if v else None
    except ValueError:
        return None


def age_on(birth: date, today: date) -> int:
    """만 나이 (생일 전이면 1살 뺌) — DB 조회의 age(birth_date) 와 같은 기준"""
    return today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))


def validate_person(d: dict, *, partial: bool = False, today: date | None = None) -> dict[str, str]:
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
    if has("birth_date"):
        birth = parse_date(d.get("birth_date"))
        if birth is None:
            e["birth_date"] = "생년월일을 YYYY-MM-DD 형식으로 입력하세요."
        elif not 15 <= age_on(birth, today or date.today()) <= 100:
            e["birth_date"] = "생년월일은 만 15~100세 범위여야 합니다."
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
