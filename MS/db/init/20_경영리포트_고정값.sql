-- 20 경영 관리자 리포트 고정값 (2026-11-20, MS)
-- JH 리포트 코드(JH/frontend/pages/management_report/data.ts)에 박혀 있던 고정 숫자를 DB 로 옮김
-- 제품_단가(85,000원)는 14 에 이미 있음. 리포트는 effective_date <= 그날 중 최신 행을 씀
-- 14 뒤에 실행. 다시 실행해도 같은 이름·날짜 행이 있으면 건너뜀
BEGIN;

INSERT INTO org.fixed_value (fixed_value_idx, value_name, value, unit, effective_date)
SELECT (SELECT COALESCE(max(fixed_value_idx), 0) FROM org.fixed_value) + row_number() OVER (ORDER BY v.ord),
       v.value_name, v.value, v.unit, v.effective_date
FROM (VALUES
    (1, '재활용_회수액',    12000::numeric, '원/개', DATE '2026-08-01'),   -- 1차 불량품 재용해 시 개당 소재 회수액
    (2, '재활용률',         0.87,           '비율',  DATE '2026-08-01'),   -- 1차 불량 중 재활용 비율 (재활용 수 = 1차 불량 수 × 이 값)
    (3, 'MTTR',             1.8,            '시간',  DATE '2026-08-01'),   -- 평균 수리 시간
    (4, 'MTBF',             142,            '시간',  DATE '2026-08-01'),   -- 평균 고장 간격
    (5, '리콜_횟수_12개월', 1,              '회',    DATE '2026-08-01')    -- 고객사 리콜 횟수 (최근 12개월)
) AS v(ord, value_name, value, unit, effective_date)
WHERE NOT EXISTS (
    SELECT 1 FROM org.fixed_value f
    WHERE f.value_name = v.value_name AND f.effective_date = v.effective_date
);

COMMIT;

-- 확인
SELECT fixed_value_idx, value_name, value, unit, effective_date
FROM org.fixed_value ORDER BY fixed_value_idx;
