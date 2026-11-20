-- 전날 공정 관리도 알림 → 메인 「회사 전체 공지」 AI 요약 캐시 (DH 요청, MS init 편입용)
-- 화면 띄우는 날(notice_date)당 1행. 집계일 = source_date (보통 전날 KST)

CREATE TABLE IF NOT EXISTS org.process_alert_daily_notice (
    notice_date   date PRIMARY KEY,
    source_date   date NOT NULL,
    tag           text NOT NULL DEFAULT '필독',
    title         text NOT NULL,
    content       text NOT NULL,
    stats         jsonb NOT NULL DEFAULT '{}'::jsonb,
    model         text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT process_alert_daily_notice_tag_chk
        CHECK (tag IN ('필독', '안전', '일반'))
);

COMMENT ON TABLE org.process_alert_daily_notice IS
    '메인 대시보드 일일 공정 알람 AI 공지. notice_date=표시일, source_date=알람 집계일(전날)';

-- JH casting API(app_lake): mes 읽기 + 이 테이블만 쓰기
GRANT SELECT, INSERT, UPDATE ON org.process_alert_daily_notice TO app_lake;
GRANT SELECT ON org.process_alert_daily_notice TO role_lake, role_spark;
