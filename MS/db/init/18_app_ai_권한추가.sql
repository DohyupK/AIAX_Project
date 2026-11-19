-- 18 app_ai 권한 추가 (2026-11-19, MS). 17(app_ai 계정 생성) 이후 실행
-- 요청: JH/전달사항/2026-11-18_MS_모델레지스트리_쓰기계정_요청.md 「추가 요청」·「추가 요청 2」
--   · ai.model_robustness  : 품질 2차 모델 등록 시 강건성 CSV 저장(INSERT), 결과 다시 올리기(DELETE)
--   · ai.quality_prediction: 샷별 2차(DL) 판정 저장(INSERT), 새 모델로 다시 판정 시 덮어쓰기(UPDATE)
-- 다시 실행해도 안전 (GRANT 는 중복 부여해도 오류 없음)
BEGIN;

GRANT SELECT, INSERT, DELETE ON ai.model_robustness   TO app_ai;
GRANT SELECT, INSERT, UPDATE ON ai.quality_prediction TO app_ai;

COMMIT;

-- 확인: app_ai 의 ai 스키마 권한 목록
SELECT table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privs
FROM information_schema.role_table_grants
WHERE grantee = 'app_ai' AND table_schema = 'ai'
GROUP BY table_name
ORDER BY table_name;
