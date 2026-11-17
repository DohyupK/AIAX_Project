"""인사 규칙 자체 점검 — 실행: cd JH/api && uv run python -m hr.rules_check"""
from hr.rules import (
    Viewer, access_code_of, can_create, can_view_row, can_write_team, filter_fields,
    next_employee_no, sort_key, tier_of, validate_person, visible_fields,
)

hr_staff = Viewer("E10004", "10", 200, "cost", False)       # 경영부 사원
hr_head = Viewer("E10001", "10", 600, "cost", True)          # 경영부 부장 (cost 팀 대표)
rep = Viewer("E30007", "30", 200, "casting1", True)          # 생산부 사원, casting1 팀 대표
manager = Viewer("E30003", "30", 400, "casting3", False)     # 생산부 과장 (대표 아님)
staff = Viewer("E30008", "30", 200, "casting1", False)       # 생산부 사원
intern = Viewer("E30016", "30", 100, "casting2", False)
hr_intern = Viewer("E10099", "10", 100, "cost", False)       # 경영부 인턴 (가정)
no_team = Viewer("E30099", "30", 300, None, False)

# 열람 등급
assert tier_of(hr_staff) == "hr" and tier_of(hr_head) == "hr"
assert tier_of(rep) == "manage" and tier_of(manager) == "manage"
assert tier_of(staff) == "basic"
assert tier_of(intern) is None and tier_of(hr_intern) is None   # 경영부라도 인턴은 불가

# 칼럼: 등급이 오를수록 누적, 마지막 로그아웃은 어디에도 없음
assert "phone" not in visible_fields("basic") and "phone" in visible_fields("manage")
assert "address" not in visible_fields("manage") and "address" in visible_fields("hr")
assert set(visible_fields("basic")) < set(visible_fields("manage")) < set(visible_fields("hr"))
assert all("last_logout_at" not in visible_fields(t) for t in ("basic", "manage", "hr"))
row = {"employee_no": "E1", "employee_name": "가", "phone": "010", "address": "서울", "age": 30, "position_code": 200}
assert "phone" not in filter_fields(row, "basic") and "address" not in filter_fields(row, "manage")
assert filter_fields(row, "hr")["address"] == "서울"

# 열람 범위 (행)
assert can_view_row(hr_staff, "casting2") and can_view_row(hr_staff, None)
assert can_view_row(staff, "casting1") and not can_view_row(staff, "casting2")
assert not can_view_row(staff, None)
assert not can_view_row(intern, "casting2")
assert not can_view_row(no_team, None)                      # 팀 없는 사람은 볼 팀이 없음

# 추가·수정·삭제
assert can_create(hr_staff) and can_write_team(hr_staff, "TF") and can_write_team(hr_staff, None)
assert can_create(rep) and can_write_team(rep, "casting1") and not can_write_team(rep, "casting2")
assert not can_write_team(rep, None)
assert not can_create(manager) and not can_write_team(manager, "casting3")   # 과장이어도 대표 아니면 불가
assert not can_create(staff) and not can_create(intern) and not can_create(hr_intern)

# 정렬: 직급 높은 순 → 사번 순
rows = [{"employee_no": "E30008", "position_code": 200}, {"employee_no": "E30001", "position_code": 500},
        {"employee_no": "E30016", "position_code": 100}, {"employee_no": "E30007", "position_code": 200}]
assert [r["employee_no"] for r in sorted(rows, key=sort_key)] == ["E30001", "E30007", "E30008", "E30016"]

# 사번: 같은 부서 최대 + 1, 다른 부서·형식 다른 값 무시
assert next_employee_no(["E30001", "E30018", "E20009", "E30X01", "E300011"], "30") == "E30019"
assert next_employee_no([], "70") == "E70001"
for bad in ("3", "ab"):
    try:
        next_employee_no([], bad); raise AssertionError("부서 코드 검증 누락")
    except ValueError:
        pass

# access_code: 시드 규칙과 동일 (DB 53명 실데이터 예)
assert access_code_of("30", 200, False) == 302       # 생산부 사원
assert access_code_of("30", 200, True) == 303        # 생산부 사원 팀 대표 (E30007)
assert access_code_of("10", 600, True) == 107        # 경영부 부장 팀 대표 (E10001)
assert access_code_of("30", 700, False) == 700       # 소장

# 입력 검증
ok = {"employee_name": "홍길동", "age": 30, "gender": "M", "phone": "010-1234-5678", "address": "서울시", "email": "a@b.co"}
assert validate_person(ok) == {}
assert set(validate_person({})) == {"employee_name", "age", "gender", "phone", "address", "email"}
assert "age" in validate_person({**ok, "age": True}) and "age" in validate_person({**ok, "age": "30"})
assert "phone" in validate_person({**ok, "phone": "12345"})
assert validate_person({"phone": "01012345678"}, partial=True) == {}   # 수정: 보낸 항목만 검사

print("hr rules: OK")
