-- 17 app_ai 쓰기 계정 (2026-11-19, MS). JH 요청: 2026-11-18_MS_모델레지스트리_쓰기계정_요청.md
-- app_hr 패턴과 동일. 비밀번호는 psql 변수 ai_pw 로 받음 (파일·채팅에 적지 않음)
-- 실행: psql ... -v ai_pw=실제비번 -f 17_app_ai_계정.sql
-- 09(org)·11(ai) 뒤에 실행
BEGIN;

CREATE ROLE app_ai LOGIN PASSWORD :'ai_pw';
GRANT CONNECT ON DATABASE aiax TO app_ai;
GRANT USAGE ON SCHEMA ai TO app_ai;

-- 모델 레지스트리: 등록·배포(수정)
GRANT SELECT, INSERT, UPDATE ON ai.model_registry TO app_ai;
GRANT SELECT, INSERT, UPDATE ON ai.model_metric_cast_qc1, ai.model_metric_cast_qc2, ai.model_metric_safe_ppe TO app_ai;

-- 불량 유형 라벨링: 라벨·폐기 (지우고 다시 넣을 수 있어야 해서 DELETE 포함)
GRANT SELECT, INSERT, DELETE ON ai.defect_label, ai.defect_discard TO app_ai;

COMMIT;
