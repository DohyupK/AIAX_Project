-- 이력 테이블과 공용 함수
-- 모든 데이터는 "어느 배치/어느 파이프라인 실행"에서 왔는지 추적 가능해야 함

-- 원본 적재 단위 (Excel 파일 1개 적재, Kafka 구간 적재 등)
CREATE TABLE meta.ingestion_batch (
    batch_id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_type    text        NOT NULL CHECK (source_type IN ('excel', 'csv', 'kafka', 'manual')),
    source_name    text        NOT NULL,             -- 파일명, 토픽명 등
    status         text        NOT NULL DEFAULT 'running'
                               CHECK (status IN ('running', 'success', 'failed')),
    row_count      bigint,
    error_message  text,
    started_at     timestamptz NOT NULL DEFAULT now(),
    finished_at    timestamptz
);
COMMENT ON TABLE meta.ingestion_batch IS '원본 적재 배치 이력';

-- Spark 작업 실행 단위 (mes→lake 정제, lake→mart 집계)
CREATE TABLE meta.pipeline_run (
    run_id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pipeline_name  text        NOT NULL,             -- 예: clean_sensor_reading
    source_layer   text        NOT NULL CHECK (source_layer IN ('mes', 'lake', 'mart')),
    target_layer   text        NOT NULL CHECK (target_layer IN ('lake', 'mart')),
    status         text        NOT NULL DEFAULT 'running'
                               CHECK (status IN ('running', 'success', 'failed')),
    rows_in        bigint,
    rows_out       bigint,
    params         jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- 처리 기간, 옵션 등
    error_message  text,
    started_at     timestamptz NOT NULL DEFAULT now(),
    finished_at    timestamptz
);
COMMENT ON TABLE meta.pipeline_run IS 'Spark 파이프라인 실행 이력';

-- 월 단위 파티션 생성 함수
-- 데이터 기간이 아직 정해지지 않았으므로, 적재 전 필요한 기간을 이 함수로 만든다.
-- 파티션이 없는 기간의 데이터는 default 파티션으로 들어가 유실되지 않음.
CREATE FUNCTION meta.ensure_monthly_partitions(p_parent regclass, p_from date, p_to date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_schema  text;
    v_table   text;
    v_month   date := date_trunc('month', p_from)::date;
    v_name    text;
    v_created integer := 0;
BEGIN
    IF p_from > p_to THEN
        RAISE EXCEPTION 'p_from(%) 가 p_to(%) 보다 늦습니다', p_from, p_to;
    END IF;

    SELECT n.nspname, c.relname INTO v_schema, v_table
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.oid = p_parent AND c.relkind = 'p';

    IF v_table IS NULL THEN
        RAISE EXCEPTION '% 는 파티션 테이블이 아닙니다', p_parent;
    END IF;

    WHILE v_month <= p_to LOOP
        v_name := format('%s_%s', v_table, to_char(v_month, 'YYYYMM'));
        IF to_regclass(format('%I.%I', v_schema, v_name)) IS NULL THEN
            EXECUTE format(
                'CREATE TABLE %I.%I PARTITION OF %I.%I FOR VALUES FROM (%L) TO (%L)',
                v_schema, v_name, v_schema, v_table,
                v_month, (v_month + interval '1 month')::date
            );
            v_created := v_created + 1;
        END IF;
        v_month := (v_month + interval '1 month')::date;
    END LOOP;

    RETURN v_created;
END;
$$;
COMMENT ON FUNCTION meta.ensure_monthly_partitions IS '월 단위 파티션 생성 (이미 있으면 건너뜀). 반환값=새로 만든 개수';
