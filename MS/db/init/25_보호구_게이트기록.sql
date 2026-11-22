-- 25 보호구 게이트 실기록 준비 (2026-11-20, MS)
-- 시나리오: 카드 태깅 → 카메라 3초 판정 → 위반·판정 불가면 알람 → 안전관리자가 조치 후 카드 태깅 → 알람 해제
--   1) ai.ppe_check.manual_at 추가 (안전관리자 태깅 시각)
--   2) 안전관리자 확인 기록을 위반 건에도 허용 (통과 건은 알람이 없어 그대로 불가)
--      확인 칸 3개(manual_result·manual_by·manual_at)는 함께 채움. 위반 건의 manual_result = 'pass' 는 카메라 오판
--   3) 목업 맞추기 — 지난 알람(위반·판정 불가)에 안전관리자 확인을 그럴듯하게 채움
--      확인한 사람 = 안전부 재직자 중 하나, 시각 = 태깅 후 2~10분, 결과 = 위반 건은 약 92% 위반 확인·8% 오판(pass),
--      판정 불가 건은 원래 확인 결과가 있으면 그대로, 없으면 약 75% 통과·25% 위반. 값은 판정 번호로 정해서 다시 실행해도 같음
--      아직 오지 않은 시각(지금 이후)의 목업은 건드리지 않음
--   4) 번호 자동 증가 — 게이트 프로그램이 동시에 넣어도 번호가 겹치지 않게
--      org.employee_gate_log · org.vendor_gate_log · ai.ppe_check 의 *_idx 에 시퀀스 기본값 (지금 최댓값 다음부터)
-- 알람 켜짐 = result IN ('violation','undecidable') AND manual_at IS NULL
-- 11 뒤에 실행. 다시 실행해도 됨
BEGIN;

-- 1) 안전관리자 태깅 시각
ALTER TABLE ai.ppe_check ADD COLUMN IF NOT EXISTS manual_at timestamptz;
COMMENT ON COLUMN ai.ppe_check.manual_at     IS '안전관리자가 확인·조치 후 카드를 태깅한 시각 (알람 해제)';
COMMENT ON COLUMN ai.ppe_check.manual_result IS '안전관리자 확인 결과 pass / violation. 위반 건의 pass = 카메라 오판';
COMMENT ON COLUMN ai.ppe_check.manual_by     IS '확인한 안전관리자 사번';

-- 2) 확인 기록 규칙
ALTER TABLE ai.ppe_check DROP CONSTRAINT IF EXISTS ppe_check_manual_only_undecidable;
ALTER TABLE ai.ppe_check DROP CONSTRAINT IF EXISTS ppe_check_manual_only_alarm;
ALTER TABLE ai.ppe_check ADD CONSTRAINT ppe_check_manual_only_alarm
    CHECK (result IN ('violation', 'undecidable') OR (manual_result IS NULL AND manual_by IS NULL AND manual_at IS NULL));

-- 3) 목업: 지난 알람에 안전관리자 확인 채우기 (확인 시각이 빈 줄만)
WITH mgr AS (
    SELECT array_agg(employee_no ORDER BY employee_no) AS a
    FROM org.employee WHERE dept_code = 5000 AND employment_status = 'active'
), ev AS (
    SELECT p.ppe_check_idx AS idx, p.result, p.manual_result, p.manual_by,
           coalesce(el.clock_in_at, vl.clock_in_at, p.created_at) AS at
    FROM ai.ppe_check p
    LEFT JOIN org.employee_gate_log el ON el.employee_gate_log_idx = p.employee_gate_log_idx
    LEFT JOIN org.vendor_gate_log vl ON vl.vendor_gate_log_idx = p.vendor_gate_log_idx
    WHERE p.result IN ('violation', 'undecidable') AND p.manual_at IS NULL
)
UPDATE ai.ppe_check p
SET manual_at     = ev.at + make_interval(secs => 120 + (ev.idx * 37) % 481),
    manual_by     = coalesce(ev.manual_by, mgr.a[1 + ev.idx % cardinality(mgr.a)]),
    manual_result = coalesce(ev.manual_result,
                             CASE WHEN ev.result = 'violation' THEN (CASE WHEN ev.idx % 12 = 0 THEN 'pass' ELSE 'violation' END)
                                  ELSE (CASE WHEN ev.idx % 4 = 0 THEN 'violation' ELSE 'pass' END) END)
FROM ev, mgr
WHERE p.ppe_check_idx = ev.idx
  AND cardinality(mgr.a) > 0
  AND (ev.at + make_interval(secs => 120 + (ev.idx * 37) % 481) <= now() OR ev.manual_result IS NOT NULL);

ALTER TABLE ai.ppe_check DROP CONSTRAINT IF EXISTS ppe_check_manual_all_or_none;
ALTER TABLE ai.ppe_check ADD CONSTRAINT ppe_check_manual_all_or_none
    CHECK (num_nulls(manual_result, manual_by, manual_at) IN (0, 3));

-- 4) 번호 자동 증가 — 게이트 프로그램이 동시에 넣어도 번호가 겹치지 않게
--   org.employee_gate_log · org.vendor_gate_log · ai.ppe_check 의 *_idx 에 시퀀스 기본값 (지금 최댓값 다음부터)
-- (처음 버전에 있던 안전관리자 확인 칸 manual_at·목업은 26 에서 칸째 지움 — 확인은 종이에 수기로 함)
-- 11 뒤에 실행. 다시 실행해도 됨
BEGIN;

-- 번호 자동 증가
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
      ('org', 'employee_gate_log', 'employee_gate_log_idx'),
      ('org', 'vendor_gate_log',   'vendor_gate_log_idx'),
      ('ai',  'ppe_check',         'ppe_check_idx')) AS v(sch, tbl, col)
  LOOP
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I.%I', t.sch, t.tbl || '_idx_seq');
    EXECUTE format('ALTER SEQUENCE %I.%I OWNED BY %I.%I.%I', t.sch, t.tbl || '_idx_seq', t.sch, t.tbl, t.col);
    EXECUTE format('SELECT setval(%L, GREATEST((SELECT COALESCE(max(%I), 0) FROM %I.%I), 1), (SELECT count(*) > 0 FROM %I.%I))',
                   t.sch || '.' || t.tbl || '_idx_seq', t.col, t.sch, t.tbl, t.sch, t.tbl);
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT nextval(%L)',
                   t.sch, t.tbl, t.col, t.sch || '.' || t.tbl || '_idx_seq');
  END LOOP;
END $$;

COMMIT;

-- 확인: 칸·규칙·다음 번호
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE (table_schema, table_name, column_name) IN (('ai', 'ppe_check', 'manual_at'), ('ai', 'ppe_check', 'ppe_check_idx'),
      ('org', 'employee_gate_log', 'employee_gate_log_idx'), ('org', 'vendor_gate_log', 'vendor_gate_log_idx'));
