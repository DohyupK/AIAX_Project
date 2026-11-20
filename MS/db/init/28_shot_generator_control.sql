-- 28 실시간 샷 생성기 시연 배속 (2026-11-20, DH)
--   mes.shot_generator_control : JH 공정최적화 ×20 ↔ MS shot_generator run 배속
--   app_lake(JH API)가 speed 를 쓰고, app_mes(생성기)가 읽음. 1행만 사용 (id=1)
-- 03(mes)·06(grants) 뒤에 실행. 다시 실행해도 됨
BEGIN;

CREATE TABLE IF NOT EXISTS mes.shot_generator_control (
    id         integer PRIMARY KEY CHECK (id = 1),
    speed      real    NOT NULL DEFAULT 1 CHECK (speed IN (1, 20)),
    updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE mes.shot_generator_control IS '시연용 샷 생성 배속 — JH /api/casting/demo-speed ↔ MS shot_generator';
COMMENT ON COLUMN mes.shot_generator_control.speed IS '1 = 실시간(~150초/샷), 20 = 20배속';

INSERT INTO mes.shot_generator_control (id, speed)
VALUES (1, 1)
ON CONFLICT (id) DO NOTHING;

-- 생성기(app_mes): 읽기 / JH(app_lake): 읽기·수정 (기본 mes 는 lake 읽기만)
GRANT SELECT ON mes.shot_generator_control TO role_mes;
GRANT SELECT, UPDATE ON mes.shot_generator_control TO role_lake;

COMMIT;
