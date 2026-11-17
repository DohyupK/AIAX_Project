"""인사 규칙 자체 점검 — 실행: cd JH/api && uv run python -m hr.rules_check"""
from datetime import date

from hr.rules import (
    Viewer, access_code_of, age_on, can_create, can_view_row, can_write_team, filter_fields,
    next_employee_no, sort_key, tier_of, validate_person, visible_fields,
)

# 실데이터 예 (org 2026-11-17 개편: 부서 1000~7000, 직급 10000~70000, 팀 10~60, 사번 e0001~)
hr_staff = Viewer("e0005", 1000, 20000, 50, False)          # 경영부 사원
hr_head = Viewer("e0002", 1000, 60000, 50, True)            # 경영부 부장 (50팀 대표)
rep = Viewer("e0028", 3000, 20000, 20, True)                # 생산부 사원, 20팀 대표
manager = Viewer("e0017", 3000, 40000, 30, False)           # 생산부 과장 (대표 아님)
staff = Viewer("e0029", 3000, 20000, 20, False)             # 생산부 사원
intern = Viewer("e0031", 3000, 10000, 20, False)            # 생산부 인턴
hr_intern = Viewer("e9999", 1000, 10000, 50, False)         # 경영부 인턴 (가정)
director = Viewer("e0001", 1000, 70000, None, False)        # 경영부 소장 (팀 없음)
no_team = Viewer("e9998", 3000, 30000, None, False)

# 열람 등급
assert tier_of(hr_staff) == "hr" and tier_of(hr_head) == "hr" and tier_of(director) == "hr"
assert tier_of(rep) == "manage" and tier_of(manager) == "manage"
assert tier_of(staff) == "basic"
assert tier_of(intern) is None and tier_of(hr_intern) is None   # 경영부라도 인턴은 불가
assert tier_of(Viewer("x", 2000, 50000, 30, False)) == "manage"  # 다른 부서 차장 = 과장 이상

# 칼럼: 등급이 오를수록 누적, 마지막 로그아웃은 어디에도 없음
assert "phone" not in visible_fields("basic") and "phone" in visible_fields("manage")
assert "address" not in visible_fields("manage") and "address" in visible_fields("hr")
assert set(visible_fields("basic")) < set(visible_fields("manage")) < set(visible_fields("hr"))
assert all("last_logout_at" not in visible_fields(t) for t in ("basic", "manage", "hr"))
row = {"employee_no": "e0001", "employee_name": "가", "phone": "010", "address": "서울", "age": 30, "birth_date": "1996-05-20", "position_code": 20000}
assert "phone" not in filter_fields(row, "basic") and "address" not in filter_fields(row, "manage")
assert "birth_date" not in filter_fields(row, "manage") and "birth_date" in filter_fields(row, "hr")
assert filter_fields(row, "hr")["address"] == "서울"

# 열람 범위 (행)
assert can_view_row(hr_staff, 30) and can_view_row(hr_staff, None) and can_view_row(director, 10)
assert can_view_row(staff, 20) and not can_view_row(staff, 30)
assert not can_view_row(staff, None)
assert not can_view_row(intern, 20)
assert not can_view_row(no_team, None)                      # 팀 없는 사람은 볼 팀이 없음

# 추가·수정·삭제
assert can_create(hr_staff) and can_write_team(hr_staff, 60) and can_write_team(hr_staff, None)
assert can_create(rep) and can_write_team(rep, 20) and not can_write_team(rep, 30)
assert not can_write_team(rep, None)
assert not can_create(manager) and not can_write_team(manager, 30)   # 과장이어도 대표 아니면 불가
assert not can_create(staff) and not can_create(intern) and not can_create(hr_intern)

# 정렬: 직급 높은 순 → 사번 순
rows = [{"employee_no": "e0029", "position_code": 20000}, {"employee_no": "e0016", "position_code": 50000},
        {"employee_no": "e0031", "position_code": 10000}, {"employee_no": "e0028", "position_code": 20000}]
assert [r["employee_no"] for r in sorted(rows, key=sort_key)] == ["e0016", "e0028", "e0029", "e0031"]

# 사번: 전체 최대 + 1 (부서 무관), 형식 다른 값 무시
assert next_employee_no(["e0001", "e0054", "e0009", "E30019", "e00x1", "e00055"]) == "e0055"
assert next_employee_no([]) == "e0001"
try:
    next_employee_no(["e9999"]); raise AssertionError("사번 상한 검증 누락")
except ValueError:
    pass

# access_code = 직급 + 부서 + 팀 + 부서 대표 100 + 팀 대표 1 (DB 실데이터 예)
assert access_code_of(3000, 20000, 10, False, False) == 23010   # e0022 생산부 사원
assert access_code_of(3000, 20000, 20, False, True) == 23021    # e0028 생산부 사원 20팀 대표
assert access_code_of(3000, 50000, 30, True, True) == 53131     # e0016 생산부 차장 부서·팀 대표
assert access_code_of(2000, 50000, 30, True, False) == 52130    # e0007 설비부 차장 부서 대표
assert access_code_of(1000, 70000, None, True, False) == 71100  # e0001 소장 (팀 없음)

# 입력 검증
ok = {"employee_name": "홍길동", "birth_date": "1996-05-20", "gender": "M", "phone": "010-1234-5678", "address": "서울시", "email": "a@b.co"}
assert validate_person(ok) == {}
assert set(validate_person({})) == {"employee_name", "birth_date", "gender", "phone", "address", "email"}
assert "birth_date" in validate_person({**ok, "birth_date": "1996/05/20"})            # 형식 오류
assert "birth_date" in validate_person({**ok, "birth_date": "2026-02-30"})            # 없는 날짜
T = date(2026, 11, 17)
assert "birth_date" in validate_person({**ok, "birth_date": "2012-01-01"}, today=T)   # 만 14세
assert validate_person({**ok, "birth_date": "2011-11-17"}, today=T) == {}             # 오늘 만 15세
assert "birth_date" in validate_person({**ok, "birth_date": "2011-11-18"}, today=T)   # 내일 15세 → 아직 14세
# 만 나이: 생일 전날까지는 한 살 적음
assert age_on(date(1996, 5, 20), date(2026, 5, 19)) == 29 and age_on(date(1996, 5, 20), date(2026, 5, 20)) == 30
assert age_on(date(2000, 2, 29), date(2026, 2, 28)) == 25 and age_on(date(2000, 2, 29), date(2026, 3, 1)) == 26
assert "phone" in validate_person({**ok, "phone": "12345"})
assert validate_person({"phone": "01012345678"}, partial=True) == {}   # 수정: 보낸 항목만 검사

print("hr rules: OK")
