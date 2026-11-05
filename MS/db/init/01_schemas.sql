-- 영역(스키마) 생성 및 기본 보안 설정
-- mes  : 원본 영역 (Data Producing APP이 적재, 가공하지 않음)
-- lake : Data Lake 영역 (Spark가 정제·변환한 데이터)
-- mart : Data Mart 영역 (Spark가 집계한 학습·분석용 데이터)
-- meta : 적재 배치·파이프라인 실행 이력 (추적용)

-- 시간 기준은 한국 시간. 컬럼은 timestamptz 로 저장해 서버 위치와 무관하게 동일 시점 보장
DO $$ BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'Asia/Seoul');
END $$;

-- 아무나 public 스키마에 테이블을 만들지 못하게 막음
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
DO $$ BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO role_producer, role_spark, role_ml, role_readonly', current_database());
END $$;

CREATE SCHEMA mes;
CREATE SCHEMA lake;
CREATE SCHEMA mart;
CREATE SCHEMA meta;

COMMENT ON SCHEMA mes  IS '원본 영역: MES·센서 원본 데이터';
COMMENT ON SCHEMA lake IS 'Data Lake 영역: 정제·변환 데이터';
COMMENT ON SCHEMA mart IS 'Data Mart 영역: 학습·분석용 집계 데이터';
COMMENT ON SCHEMA meta IS '적재 배치·파이프라인 실행 이력';
