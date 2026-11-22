-- 16 모델매니지먼트(model_management) 페이지 권한 — 시스템개발부 전용으로 교체 (2026-11-19, MS)
-- 요청: 팀장 — 모델매니지먼트는 소장/부서장 전체규칙(01 DB 설명서.md 적용순서 1·4번) 무시하고
--       시스템개발부만 예외로 접근. 개발부 전원 read, 과장 이상 edit.
-- 주의: 새 개발부 사원이 들어오거나 직급·팀이 바뀌면 이 스크립트를 다시 돌려야 함
--       (다른 페이지처럼 트리거 자동 반영 아님 — 필요하면 트리거화는 추후 별도 작업)
-- 09(org) 뒤에 실행
BEGIN;

DELETE FROM org.model_management_page;

INSERT INTO org.model_management_page (model_management_page_idx, page_code, access_code, access_level)
SELECT row_number() OVER (ORDER BY x.access_code), 'model_management', x.access_code, x.access_level
FROM (
    SELECT DISTINCT ac.access_code,
           CASE WHEN p.position_code >= 40000 THEN 'edit' ELSE 'read' END AS access_level
    FROM org.access_code ac
    JOIN org.employee emp ON emp.employee_no = ac.employee_no
    JOIN org."position" p ON p.position_name = emp.position_name
    WHERE emp.dept_code = 4000   -- 시스템개발부
) x;

COMMIT;
