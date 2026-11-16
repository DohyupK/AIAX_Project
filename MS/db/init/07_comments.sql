-- 테이블·컬럼 한글 설명(COMMENT)
-- 명명규칙.md 7절: 모든 컬럼에 한글 이름·실제 뜻·원본 이름을 COMMENT로 기록한다.

COMMENT ON TABLE mes.investment_casting IS '주조 원본 (Investment_Casting.csv): 제품 1개 생산 = 1행, 원본 23개 컬럼 이름·값 그대로 + casting_id. 단 timestamp 연도는 2021 → 2026으로 변경';
COMMENT ON COLUMN mes.investment_casting.casting_id IS '주조 ID — 생산일자_생산시각_생산번호 (예: 260804_070411_1). 원본 값으로 DB가 자동 생성 (추가 컬럼)';
COMMENT ON COLUMN mes.investment_casting.line_unit IS '생산 라인 — 예: line_no1 (원본: line_unit)';
COMMENT ON COLUMN mes.investment_casting.production IS '제품명 — 예: CylinderHead (원본: production)';
COMMENT ON COLUMN mes.investment_casting."timestamp" IS '생산 일자 — 이름은 timestamp지만 실제 내용은 일자 (원본: timestamp)';
COMMENT ON COLUMN mes.investment_casting."date" IS '생산 시각 — 이름은 date지만 실제 내용은 시각 (원본: date)';
COMMENT ON COLUMN mes.investment_casting.production_count IS '생산 번호 — 몇 번째 생산인지 (원본: production_count)';
COMMENT ON COLUMN mes.investment_casting.mold_temperature IS '용융온도 — 쇳물 온도. 이름은 금형(mold) 온도지만 가이드북 정의는 용융온도 (원본: mold_temperature)';
COMMENT ON COLUMN mes.investment_casting.facility_cycletime IS '설비 사이클 시간 — 설비가 한 바퀴 도는 시간 (원본: facility_CycleTime)';
COMMENT ON COLUMN mes.investment_casting.production_cycletime IS '생산 사이클 시간 — 제품 하나 생산에 걸린 시간 (원본: production_CycleTime)';
COMMENT ON COLUMN mes.investment_casting.mechanical_strength IS '형체력 — 금형을 닫아 누르는 힘. 이름(기계적 강도)과 실제 뜻이 다름 (원본: mechanical_strength)';
COMMENT ON COLUMN mes.investment_casting.molten_capacity IS '용탕량 — 한 번에 붓는 쇳물 양. 원본 빈 값 많음 (원본: molten_capacity)';
COMMENT ON COLUMN mes.investment_casting.injection_pressure IS '주입 압력 — 쇳물을 금형에 밀어 넣는 압력 (원본: injection_pressure)';
COMMENT ON COLUMN mes.investment_casting.sleeve_temperature IS '슬리브 온도 — 쇳물을 받아 두는 원통(슬리브) 온도 (원본: sleeve_temperature)';
COMMENT ON COLUMN mes.investment_casting.top_temp1 IS '상금형 온도 1 — 위쪽 금형 1번 위치 온도 (원본: top_temp1)';
COMMENT ON COLUMN mes.investment_casting.top_temp2 IS '상금형 온도 2 — 위쪽 금형 2번 위치 온도 (원본: top_temp2)';
COMMENT ON COLUMN mes.investment_casting.top_temp3 IS '상금형 온도 3 — 위쪽 금형 3번 위치 온도. 다른 위치보다 값이 큼 (원본: top_temp3)';
COMMENT ON COLUMN mes.investment_casting.top_temp4 IS '상금형 온도 4 — 위쪽 금형 4번 위치 온도. 원본에서 항상 1620 (상수) (원본: top_temp4)';
COMMENT ON COLUMN mes.investment_casting.bottom_temp1 IS '하금형 온도 1 — 아래쪽 금형 1번 위치 온도 (원본: bottom_temp1)';
COMMENT ON COLUMN mes.investment_casting.bottom_temp2 IS '하금형 온도 2 — 아래쪽 금형 2번 위치 온도 (원본: bottom_temp2)';
COMMENT ON COLUMN mes.investment_casting.bottom_temp3 IS '하금형 온도 3 — 아래쪽 금형 3번 위치 온도. 다른 위치보다 값이 큼 (원본: bottom_temp3)';
COMMENT ON COLUMN mes.investment_casting.bottom_temp4 IS '하금형 온도 4 — 아래쪽 금형 4번 위치 온도. 원본에서 항상 1880 (상수) (원본: bottom_temp4)';
COMMENT ON COLUMN mes.investment_casting.biscuit_thickness IS '비스킷 두께 — 사출 후 슬리브 끝에 남은 쇳물 덩어리 두께 (원본: biscuit_thickness)';
COMMENT ON COLUMN mes.investment_casting.cooling_water_temp IS '냉각수 온도 — 금형을 식히는 물의 온도 (원본: cooling_water_temp)';
COMMENT ON COLUMN mes.investment_casting.passorfail IS '품질 결과 — 0 = 양품, 1 = 불량. AI 학습의 정답 (원본: PassOrFail)';

-- lake.lake_investment_casting: mes와 같은 이름의 컬럼은 mes 설명을 그대로 복사
COMMENT ON TABLE lake.lake_investment_casting IS '주조 정제본: casting_id(mes 외래키) + 원본 20개 컬럼 (값 그대로 복사, EDA 검토 완료)';
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT a.attname, col_description(a.attrelid, a.attnum) AS d
    FROM pg_attribute a
    WHERE a.attrelid = 'mes.investment_casting'::regclass AND a.attnum > 0 AND NOT a.attisdropped
      AND EXISTS (SELECT 1 FROM pg_attribute b WHERE b.attrelid = 'lake.lake_investment_casting'::regclass AND b.attname = a.attname)
  LOOP
    EXECUTE format('COMMENT ON COLUMN lake.lake_investment_casting.%I IS %L', r.attname, r.d);
  END LOOP;
END $$;
COMMENT ON COLUMN lake.lake_investment_casting.casting_id IS '주조 ID — 외래키, mes.investment_casting.casting_id 참조 (생산일자_생산시각_생산번호)';

-- mart.mart_investment_casting: 같은 이름 컬럼은 mes 설명을 그대로 복사
COMMENT ON TABLE mart.mart_investment_casting IS '주조 학습용: casting_id(lake 외래키) + 18개 컬럼. molten_capacity 결측 행·정답(passorfail) 빈 행은 학습에 쓰지 않아 제외';
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT a.attname, col_description(a.attrelid, a.attnum) AS d
    FROM pg_attribute a
    WHERE a.attrelid = 'mes.investment_casting'::regclass AND a.attnum > 0 AND NOT a.attisdropped
      AND EXISTS (SELECT 1 FROM pg_attribute b WHERE b.attrelid = 'mart.mart_investment_casting'::regclass AND b.attname = a.attname)
  LOOP
    EXECUTE format('COMMENT ON COLUMN mart.mart_investment_casting.%I IS %L', r.attname, r.d);
  END LOOP;
END $$;
COMMENT ON COLUMN mart.mart_investment_casting.casting_id IS '주조 ID — 외래키, lake.lake_investment_casting.casting_id 참조 (생산일자_생산시각_생산번호)';
COMMENT ON COLUMN mart.mart_investment_casting.molten_capacity IS '용탕량 — 한 번에 붓는 쇳물 양. mart에는 값이 있는 행만 들어옴 (원본: molten_capacity)';
