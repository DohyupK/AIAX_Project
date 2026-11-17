"""인사 관리 API — NCP DB org 원본을 실시간 조회·변경 (계정 app_hr)

현재 사용자: 로그인 전이라 요청 헤더 X-Employee-No (화면의 목업 계정 선택) 로 받음.
ponytail: 로그인 도입 시 current_viewer() 한 곳만 세션 확인으로 교체. 그 전까지는 127.0.0.1 에서만 실행.
"""
from __future__ import annotations

import logging
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from common.db import connect
from hr import rules
from hr.rules import Viewer

log = logging.getLogger("jh.hr")
router = APIRouter(prefix="/api/hr", tags=["hr"])
DB = "HR_DATABASE_URL"

# 사원 1명 = employee + 개인정보 + 상태 + 부서명·직급코드·대표 여부
ROW_SQL = """
SELECT e.employee_no, e.dept_code, d.dept_name, e.position_name, p.position_code, e.team_code, e.created_at,
       i.employee_name, i.birth_date, date_part('year', age(i.birth_date))::int AS age, i.gender, i.phone, i.address, i.email,
       s.monthly_overtime_hour, s.annual_leave_used, s.years_of_service,
       (d.department_representative = e.employee_no) AS is_dept_rep,
       EXISTS (SELECT 1 FROM org.team t WHERE t.team_representative = e.employee_no) AS is_team_rep
FROM org.employee e
JOIN org.department d USING (dept_code)
JOIN org."position" p USING (position_name)
LEFT JOIN org.employee_info i USING (employee_no)
LEFT JOIN org.employee_status s USING (employee_no)
"""


# ---------- 현재 사용자 ----------
def _load_viewer(conn, employee_no: str) -> Viewer | None:
    r = conn.execute(ROW_SQL + " WHERE e.employee_no = %s", [employee_no]).fetchone()
    if not r:
        return None
    return Viewer(r["employee_no"], r["dept_code"], r["position_code"], r["team_code"], r["is_team_rep"])


def current_viewer(x_employee_no: str = Header(..., alias="X-Employee-No")) -> Viewer:
    with connect(DB) as conn:
        v = _load_viewer(conn, x_employee_no.strip())
    if not v:
        raise HTTPException(401, "등록되지 않은 사번입니다.")
    return v


def _tier_or_403(v: Viewer) -> str:
    t = rules.tier_of(v)
    if t is None:
        raise HTTPException(403, "인사 정보 열람 권한이 없습니다. (인턴)")
    return t


def _log_access(conn, v: Viewer, action: str, target: str, tier: str, n: int) -> None:
    conn.execute("INSERT INTO org.hr_access_log (viewer_no, action, target, field_tier, row_count) VALUES (%s,%s,%s,%s,%s)",
                 [v.employee_no, action, target, tier, n])


# ---------- 조회 ----------
@router.get("/me")
def me(v: Viewer = Depends(current_viewer)):
    tier = rules.tier_of(v)
    return {
        "employee_no": v.employee_no, "dept_code": v.dept_code, "team_code": v.team_code,
        "is_team_rep": v.is_team_rep, "is_hr": v.is_hr,
        "tier": tier, "visible_fields": rules.visible_fields(tier) if tier else [],
        "scope": "all" if v.is_hr else ("team" if tier else "none"),
        "can_create": rules.can_create(v),
    }


@router.get("/mock-accounts")
def mock_accounts():
    """목업 계정 선택용 (이름·개인정보 없음). ponytail: 로그인 도입 시 삭제"""
    with connect(DB) as conn:
        rows = conn.execute(ROW_SQL + " ORDER BY e.dept_code, p.position_code DESC, e.employee_no").fetchall()
    return [{k: r[k] for k in ("employee_no", "dept_code", "dept_name", "position_name", "team_code", "is_team_rep")} for r in rows]


@router.get("/summary")
def summary(v: Viewer = Depends(current_viewer)):
    """부서·팀 정보 카드 — 인원·직급 분포·대표 사번 (개인정보 없음)"""
    _tier_or_403(v)
    with connect(DB) as conn:
        positions = conn.execute('SELECT position_name, position_code FROM org."position" ORDER BY position_code DESC').fetchall()
        depts = conn.execute("""
            SELECT d.dept_code, d.dept_name, d.department_representative AS rep_no, rp.position_name AS rep_position,
                   count(e.employee_no) AS headcount
            FROM org.department d
            LEFT JOIN org.employee e ON e.dept_code = d.dept_code
            LEFT JOIN org.employee rp ON rp.employee_no = d.department_representative
            GROUP BY 1, 2, 3, 4 ORDER BY 1""").fetchall()
        teams = conn.execute("""
            SELECT t.team_code, t.team_representative AS rep_no, rp.position_name AS rep_position, rp.dept_code AS rep_dept,
                   count(e.employee_no) AS headcount
            FROM org.team t
            LEFT JOIN org.employee e ON e.team_code = t.team_code
            LEFT JOIN org.employee rp ON rp.employee_no = t.team_representative
            GROUP BY 1, 2, 3, 4 ORDER BY 1""").fetchall()
        by_dept = conn.execute("SELECT dept_code AS k, position_name, count(*) AS n FROM org.employee GROUP BY 1, 2").fetchall()
        by_team = conn.execute("""SELECT e.team_code AS k, d.dept_name AS name, count(*) AS n FROM org.employee e
                                  JOIN org.department d USING (dept_code) WHERE e.team_code IS NOT NULL GROUP BY 1, 2""").fetchall()
    for d in depts:
        d["by_position"] = {r["position_name"]: r["n"] for r in by_dept if r["k"] == d["dept_code"]}
        d["can_view"] = v.is_hr
    for t in teams:
        t["by_dept"] = {r["name"]: r["n"] for r in by_team if r["k"] == t["team_code"]}
        t["can_view"] = rules.can_view_row(v, t["team_code"])
    return {"positions": positions, "departments": depts, "teams": teams}


@router.get("/employees")
def list_employees(dept: int | None = None, team: int | None = None, v: Viewer = Depends(current_viewer)):
    """부서 또는 팀 명단 — 권한 범위 안의 사원만, 등급에 맞는 칼럼만, 직급순"""
    tier = _tier_or_403(v)
    if dept and not v.is_hr:
        raise HTTPException(403, "부서별 명단은 인사팀(경영부)만 볼 수 있습니다.")
    if team and not rules.can_view_row(v, team):
        raise HTTPException(403, "자기 팀 명단만 볼 수 있습니다.")
    where, params = [], []
    if dept:
        where.append("e.dept_code = %s"); params.append(dept)
    if team:
        where.append("e.team_code = %s"); params.append(team)
    if not v.is_hr:                       # 범위 밖 행은 DB에서부터 빼고 (아래에서 한 번 더 확인)
        where.append("e.team_code = %s"); params.append(v.team_code)
    sql = ROW_SQL + (" WHERE " + " AND ".join(where) if where else "")
    with connect(DB) as conn:
        rows = [r for r in conn.execute(sql, params).fetchall() if rules.can_view_row(v, r["team_code"])]
        _log_access(conn, v, "view_list", f"dept={dept}" if dept else f"team={team}" if team else "all", tier, len(rows))
    rows.sort(key=rules.sort_key)
    return [rules.filter_fields(r, tier) | {"can_edit": rules.can_write_team(v, r["team_code"])} for r in rows]


@router.get("/employees/{employee_no}")
def get_employee(employee_no: str, v: Viewer = Depends(current_viewer)):
    tier = _tier_or_403(v)
    with connect(DB) as conn:
        r = conn.execute(ROW_SQL + " WHERE e.employee_no = %s", [employee_no]).fetchone()
        if not r or not rules.can_view_row(v, r["team_code"]):
            raise HTTPException(404, "사원을 찾을 수 없거나 볼 권한이 없습니다.")   # 존재 여부도 숨김
        _log_access(conn, v, "view_detail", employee_no, tier, 1)
    return rules.filter_fields(r, tier) | {"can_edit": rules.can_write_team(v, r["team_code"])}


# ---------- 추가·수정·삭제 ----------
class EmployeeIn(BaseModel):
    dept_code: int
    position_name: str
    team_code: int | None = None
    employee_name: str
    birth_date: str          # 'YYYY-MM-DD' — 형식·나이 범위는 rules.validate_person 에서 한글 오류로 검증
    gender: Literal["M", "F", "other"]
    phone: str
    address: str
    email: str


class EmployeePatch(BaseModel):
    dept_code: int | None = None
    position_name: str | None = None
    team_code: int | None = None
    employee_name: str | None = None
    birth_date: str | None = None
    gender: Literal["M", "F", "other"] | None = None
    phone: str | None = None
    address: str | None = None
    email: str | None = None


def _check_refs(conn, dept: int, position: str, team: int | None) -> int:
    """부서·직급·팀이 실제 있는지 확인, 직급코드 반환"""
    if not conn.execute("SELECT 1 FROM org.department WHERE dept_code = %s", [dept]).fetchone():
        raise HTTPException(422, {"dept_code": "없는 부서입니다."})
    p = conn.execute('SELECT position_code FROM org."position" WHERE position_name = %s', [position]).fetchone()
    if not p:
        raise HTTPException(422, {"position_name": "없는 직급입니다."})
    if team and not conn.execute("SELECT 1 FROM org.team WHERE team_code = %s", [team]).fetchone():
        raise HTTPException(422, {"team_code": "없는 팀입니다."})
    return p["position_code"]


def _next_idx(conn, table: str) -> int:
    return conn.execute(f'SELECT coalesce(max({table}_idx), 0) + 1 AS n FROM org.{table}').fetchone()["n"]


def _lock(conn) -> None:
    """사번·idx 를 max+1 로 만드므로 쓰기 요청을 한 줄로 세움 (트랜잭션 끝나면 자동 해제)"""
    conn.execute("SELECT pg_advisory_xact_lock(hashtext('jh_hr_employee_write'))")


def _sync_rosters(conn, no: str, dept: int, team: int | None, position_code: int, is_dept_rep: bool, is_team_rep: bool) -> None:
    """부서·팀 명단과 access_code 를 employee 와 같게 맞춤 (org 시드 규칙)"""
    conn.execute("DELETE FROM org.dept_roster WHERE employee_no = %s", [no])
    conn.execute("INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no) VALUES (%s,%s,%s)",
                 [_next_idx(conn, "dept_roster"), dept, no])
    conn.execute("DELETE FROM org.team_roster WHERE employee_no = %s", [no])
    if team:
        conn.execute("INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no) VALUES (%s,%s,%s)",
                     [_next_idx(conn, "team_roster"), team, no])
    code = rules.access_code_of(dept, position_code, team, is_dept_rep, is_team_rep)
    if conn.execute("UPDATE org.access_code SET access_code = %s WHERE employee_no = %s", [code, no]).rowcount == 0:
        conn.execute("INSERT INTO org.access_code (access_code_idx, employee_no, access_code) VALUES (%s,%s,%s)",
                     [_next_idx(conn, "access_code"), no, code])


@router.post("/employees", status_code=201)
def create_employee(body: EmployeeIn, v: Viewer = Depends(current_viewer)):
    if not rules.can_create(v):
        raise HTTPException(403, "사원 추가 권한이 없습니다. (인사팀·팀 대표만)")
    if not rules.can_write_team(v, body.team_code):
        raise HTTPException(403, {"team_code": "팀 대표는 자기 팀으로만 추가할 수 있습니다."})
    errors = rules.validate_person(body.model_dump())
    if errors:
        raise HTTPException(422, errors)
    d = body.model_dump()
    try:
        with connect(DB) as conn:              # 한 트랜잭션: 하나라도 실패하면 전부 취소
            _lock(conn)
            pcode = _check_refs(conn, body.dept_code, body.position_name, body.team_code)
            existing = [r["employee_no"] for r in conn.execute("SELECT employee_no FROM org.employee").fetchall()]
            no = rules.next_employee_no(existing)
            conn.execute("""INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code)
                            VALUES (%s,%s,%s,%s,%s)""",
                         [_next_idx(conn, "employee"), no, body.dept_code, body.position_name, body.team_code])
            conn.execute("""INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, birth_date, gender, phone, address, email)
                            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                         [_next_idx(conn, "employee_info"), no, d["employee_name"].strip(), rules.parse_date(d["birth_date"]), d["gender"],
                          d["phone"].strip(), d["address"].strip(), d["email"].strip()])
            conn.execute("""INSERT INTO org.employee_status (employee_status_idx, employee_no, annual_leave_used, years_of_service)
                            VALUES (%s,%s,0,0)""", [_next_idx(conn, "employee_status"), no])
            _sync_rosters(conn, no, body.dept_code, body.team_code, pcode, False, False)
            _log_access(conn, v, "create", no, rules.tier_of(v) or "basic", 1)
            r = conn.execute(ROW_SQL + " WHERE e.employee_no = %s", [no]).fetchone()
    except ValueError as e:                    # 사번 e9999 초과
        raise HTTPException(422, {"employee_no": str(e)})
    log.info("사원 추가 %s by %s", no, v.employee_no)
    return rules.filter_fields(r, rules.tier_of(v)) | {"can_edit": True}


@router.patch("/employees/{employee_no}")
def update_employee(employee_no: str, body: EmployeePatch, v: Viewer = Depends(current_viewer)):
    d = body.model_dump(exclude_unset=True)
    errors = rules.validate_person(d, partial=True)
    if errors:
        raise HTTPException(422, errors)
    with connect(DB) as conn:
        _lock(conn)
        cur = conn.execute(ROW_SQL + " WHERE e.employee_no = %s", [employee_no]).fetchone()
        if not cur or not rules.can_view_row(v, cur["team_code"]):
            raise HTTPException(404, "사원을 찾을 수 없거나 볼 권한이 없습니다.")
        if not rules.can_write_team(v, cur["team_code"]):
            raise HTTPException(403, "이 사원을 수정할 권한이 없습니다.")
        new = {k: d.get(k, cur[k]) for k in ("dept_code", "position_name", "team_code")}
        if not rules.can_write_team(v, new["team_code"]):
            raise HTTPException(403, {"team_code": "팀 대표는 자기 팀 밖으로 옮길 수 없습니다."})
        pcode = _check_refs(conn, new["dept_code"], new["position_name"], new["team_code"])
        conn.execute("UPDATE org.employee SET dept_code = %s, position_name = %s, team_code = %s WHERE employee_no = %s",
                     [new["dept_code"], new["position_name"], new["team_code"], employee_no])
        info = {k: (d[k].strip() if isinstance(d[k], str) else d[k])
                for k in ("employee_name", "gender", "phone", "address", "email") if k in d}
        if "birth_date" in d:
            info["birth_date"] = rules.parse_date(d["birth_date"])
        if info:
            sets = ", ".join(f"{k} = %s" for k in info)
            conn.execute(f"UPDATE org.employee_info SET {sets} WHERE employee_no = %s", [*info.values(), employee_no])
        if any(k in d for k in ("dept_code", "position_name", "team_code")):
            _sync_rosters(conn, employee_no, new["dept_code"], new["team_code"], pcode, cur["is_dept_rep"], cur["is_team_rep"])
        _log_access(conn, v, "update", employee_no, rules.tier_of(v) or "basic", 1)
        r = conn.execute(ROW_SQL + " WHERE e.employee_no = %s", [employee_no]).fetchone()
    log.info("사원 수정 %s by %s (%s)", employee_no, v.employee_no, ",".join(d))
    return rules.filter_fields(r, rules.tier_of(v)) | {"can_edit": rules.can_write_team(v, r["team_code"])}


@router.delete("/employees/{employee_no}", status_code=204)
def delete_employee(employee_no: str, v: Viewer = Depends(current_viewer)):
    with connect(DB) as conn:
        _lock(conn)
        cur = conn.execute(ROW_SQL + " WHERE e.employee_no = %s", [employee_no]).fetchone()
        if not cur or not rules.can_view_row(v, cur["team_code"]):
            raise HTTPException(404, "사원을 찾을 수 없거나 볼 권한이 없습니다.")
        if not rules.can_write_team(v, cur["team_code"]):
            raise HTTPException(403, "이 사원을 삭제할 권한이 없습니다.")
        if employee_no == v.employee_no:
            raise HTTPException(409, "본인은 삭제할 수 없습니다.")
        # 출입카드·근태·대표 지정이 남아 있으면 기록 손실을 막기 위해 삭제하지 않음
        blockers = []
        if cur["is_dept_rep"]:
            blockers.append("부서 대표")
        if cur["is_team_rep"]:
            blockers.append("팀 대표")
        if conn.execute("SELECT 1 FROM org.employee_card WHERE employee_no = %s", [employee_no]).fetchone():
            blockers.append("출입카드")
        if conn.execute("SELECT 1 FROM org.attendance WHERE employee_no = %s", [employee_no]).fetchone():
            blockers.append("근태 기록")
        if blockers:
            raise HTTPException(409, f"삭제할 수 없습니다 — 연결된 항목: {', '.join(blockers)}. 먼저 해제하세요.")
        try:
            for t in ("dept_roster", "team_roster", "access_code", "employee_status", "employee_info", "employee"):
                conn.execute(f"DELETE FROM org.{t} WHERE employee_no = %s", [employee_no])
        except psycopg.errors.ForeignKeyViolation:
            raise HTTPException(409, "다른 기록이 이 사원을 참조하고 있어 삭제할 수 없습니다.")
        _log_access(conn, v, "delete", employee_no, rules.tier_of(v) or "basic", 1)
    log.info("사원 삭제 %s by %s", employee_no, v.employee_no)
