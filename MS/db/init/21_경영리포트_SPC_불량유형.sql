-- 21 경영 관리자 리포트: SPC 관리 한계 테이블 (2026-11-20, MS)
--   1) mes.spc_limit   : 라인·공정 변수별 관리도 기준선 (JH/api/casting/spc.py 의 고정 표 39행을 그대로 옮김)
--                        I = CL ± 3σ, MR UCL = 3.267 × MR̄, EWMA = CL ± 1σ (λ 0.2)
--                        리포트 SPC 경고 = mes 샷 값이 i_ucl 초과(UCL 초과) / i_lcl 미만(LCL 미만)인 횟수
--                        상·하형 온도3·4 는 표에 없음 (관리도 대상 아님)
--   (불량 유형 미성형·크랙 칼럼은 리포트에서 불량 유형을 빼기로 해 취소 — 라벨링 화면 선택지는 기공·버·표면 3종)
-- 11(ai)·03(mes) 뒤에 실행. 다시 실행해도 됨 (같은 라인·변수·적용일 행은 건너뜀)
BEGIN;

-- 1) SPC 관리 한계
CREATE TABLE IF NOT EXISTS mes.spc_limit (
    spc_limit_idx   integer          NOT NULL UNIQUE,
    line_unit       text             NOT NULL CHECK (line_unit ~ '^line_no[0-9]+$'),
    variable        text             NOT NULL CHECK (variable IN (
                        'mold_temperature', 'facility_cycletime', 'production_cycletime', 'mechanical_strength',
                        'molten_capacity', 'injection_pressure', 'sleeve_temperature',
                        'top_temp1', 'top_temp2', 'top_temp3', 'top_temp4',
                        'bottom_temp1', 'bottom_temp2', 'bottom_temp3', 'bottom_temp4',
                        'biscuit_thickness', 'cooling_water_temp')),
    cl              double precision NOT NULL,   -- 중심선
    sigma           double precision NOT NULL,   -- 표준편차
    i_lcl           double precision NOT NULL,   -- 개별값 하한 (CL − 3σ)
    i_ucl           double precision NOT NULL,   -- 개별값 상한 (CL + 3σ)
    mr_cl           double precision NOT NULL,   -- 이동범위 중심선
    mr_ucl          double precision NOT NULL,   -- 이동범위 상한
    ewma_lcl        double precision NOT NULL,   -- EWMA 하한
    ewma_ucl        double precision NOT NULL,   -- EWMA 상한
    effective_date  date             NOT NULL,
    created_at      timestamptz      NOT NULL DEFAULT now(),
    PRIMARY KEY (line_unit, variable, effective_date),
    CONSTRAINT spc_limit_order CHECK (i_lcl <= cl AND cl <= i_ucl AND ewma_lcl <= cl AND cl <= ewma_ucl
                                      AND sigma >= 0 AND mr_cl >= 0 AND mr_cl <= mr_ucl)
);
COMMENT ON TABLE  mes.spc_limit IS '관리도(SPC) 기준선 — 라인·공정 변수별. 특정일 조회 시 effective_date <= 그날 중 최신 행 사용. 원본: JH/api/casting/spc.py';
COMMENT ON COLUMN mes.spc_limit.variable IS 'mes.investment_casting 공정 변수 칼럼 이름 (소문자)';
GRANT SELECT ON mes.spc_limit TO role_lake, role_spark;

INSERT INTO mes.spc_limit (spc_limit_idx, line_unit, variable, cl, sigma, i_lcl, i_ucl, mr_cl, mr_ucl, ewma_lcl, ewma_ucl, effective_date)
SELECT (SELECT COALESCE(max(spc_limit_idx), 0) FROM mes.spc_limit) + row_number() OVER (ORDER BY v.line_unit, v.ord),
       v.line_unit, v.variable, v.cl, v.sigma, v.i_lcl, v.i_ucl, v.mr_cl, v.mr_ucl, v.ewma_lcl, v.ewma_ucl, DATE '2026-08-01'
FROM (SELECT row_number() OVER () AS ord, t.* FROM (VALUES
    ('line_no1', 'top_temp1', 374.95, 26.16, 296.49, 453.42, 29.5, 96.39, 348.8, 401.11),
    ('line_no1', 'top_temp2', 371.56, 9.72, 342.39, 400.74, 10.97, 35.84, 361.84, 381.29),
    ('line_no1', 'bottom_temp1', 558.47, 25.08, 483.23, 633.71, 28.29, 92.43, 533.39, 583.55),
    ('line_no1', 'bottom_temp2', 361.85, 11.17, 328.35, 395.35, 12.6, 41.15, 350.68, 373.01),
    ('line_no1', 'biscuit_thickness', 149.43, 3.45, 139.09, 159.77, 3.89, 12.7, 145.98, 152.87),
    ('line_no1', 'cooling_water_temp', 32.81, 2.26, 26.03, 39.59, 2.55, 8.33, 30.55, 35.07),
    ('line_no1', 'injection_pressure', 657.84, 1.19, 654.27, 661.4, 1.34, 4.38, 656.65, 659.02),
    ('line_no1', 'mechanical_strength', 87.17, 0.38, 86.02, 88.32, 0.43, 1.41, 86.78, 87.55),
    ('line_no1', 'sleeve_temperature', 377.97, 7.0, 356.97, 398.96, 7.89, 25.79, 370.97, 384.96),
    ('line_no1', 'mold_temperature', 589.83, 6.62, 569.98, 609.69, 7.47, 24.39, 583.22, 596.45),
    ('line_no1', 'molten_capacity', 14.85, 5.07, -0.35, 30.05, 5.72, 18.67, 9.78, 19.92),
    ('line_no1', 'facility_cycletime', 146.76, 7.78, 123.42, 170.1, 8.78, 28.67, 138.98, 154.54),
    ('line_no1', 'production_cycletime', 151.76, 7.34, 129.74, 173.77, 8.28, 27.04, 144.42, 159.09),
    ('line_no2', 'top_temp1', 374.03, 25.43, 297.73, 450.34, 28.69, 93.73, 348.6, 399.47),
    ('line_no2', 'top_temp2', 371.62, 9.36, 343.54, 399.69, 10.56, 34.49, 362.26, 380.97),
    ('line_no2', 'bottom_temp1', 558.68, 24.88, 484.03, 633.32, 28.07, 91.69, 533.79, 583.56),
    ('line_no2', 'bottom_temp2', 361.84, 10.97, 328.91, 394.76, 12.38, 40.44, 350.86, 372.81),
    ('line_no2', 'biscuit_thickness', 149.45, 3.4, 139.26, 159.63, 3.83, 12.51, 146.05, 152.84),
    ('line_no2', 'cooling_water_temp', 32.81, 2.24, 26.11, 39.52, 2.52, 8.24, 30.58, 35.05),
    ('line_no2', 'injection_pressure', 657.84, 1.19, 654.27, 661.4, 1.34, 4.38, 656.65, 659.02),
    ('line_no2', 'mechanical_strength', 87.19, 0.4, 86.0, 88.38, 0.45, 1.46, 86.79, 87.59),
    ('line_no2', 'sleeve_temperature', 377.96, 6.65, 358.0, 397.92, 7.51, 24.52, 371.31, 384.62),
    ('line_no2', 'mold_temperature', 589.78, 6.48, 570.34, 609.23, 7.31, 23.89, 583.3, 596.27),
    ('line_no2', 'molten_capacity', 14.88, 5.1, -0.41, 30.16, 5.75, 18.78, 9.78, 19.97),
    ('line_no2', 'facility_cycletime', 146.84, 8.04, 122.7, 170.97, 9.07, 29.64, 138.79, 154.88),
    ('line_no2', 'production_cycletime', 151.94, 7.61, 129.11, 174.78, 8.59, 28.05, 144.33, 159.56),
    ('line_no3', 'top_temp1', 373.88, 25.75, 296.64, 451.13, 29.05, 94.89, 348.14, 399.63),
    ('line_no3', 'top_temp2', 371.35, 9.56, 342.67, 400.03, 10.78, 35.23, 361.79, 380.91),
    ('line_no3', 'bottom_temp1', 558.55, 25.02, 483.49, 633.62, 28.22, 92.21, 533.53, 583.57),
    ('line_no3', 'bottom_temp2', 361.75, 10.96, 328.88, 394.62, 12.36, 40.38, 350.8, 372.71),
    ('line_no3', 'biscuit_thickness', 149.47, 3.47, 139.05, 159.88, 3.92, 12.79, 145.99, 152.94),
    ('line_no3', 'cooling_water_temp', 32.78, 2.26, 26.0, 39.56, 2.55, 8.33, 30.52, 35.04),
    ('line_no3', 'injection_pressure', 657.88, 1.23, 654.19, 661.58, 1.39, 4.54, 656.65, 659.11),
    ('line_no3', 'mechanical_strength', 87.19, 0.4, 86.01, 88.39, 0.45, 1.46, 86.8, 87.59),
    ('line_no3', 'sleeve_temperature', 377.19, 8.32, 352.24, 402.15, 9.38, 30.65, 368.88, 385.51),
    ('line_no3', 'mold_temperature', 589.59, 6.98, 568.65, 610.52, 7.87, 25.72, 582.61, 596.57),
    ('line_no3', 'molten_capacity', 14.85, 5.21, -0.77, 30.47, 5.87, 19.19, 9.64, 20.06),
    ('line_no3', 'facility_cycletime', 146.78, 8.07, 122.56, 171.0, 9.11, 29.75, 138.71, 154.85),
    ('line_no3', 'production_cycletime', 151.81, 7.57, 129.11, 174.5, 8.53, 27.88, 144.24, 159.37)
) AS t(line_unit, variable, cl, sigma, i_lcl, i_ucl, mr_cl, mr_ucl, ewma_lcl, ewma_ucl)) AS v
WHERE NOT EXISTS (
    SELECT 1 FROM mes.spc_limit s
    WHERE s.line_unit = v.line_unit AND s.variable = v.variable AND s.effective_date = DATE '2026-08-01'
);

COMMIT;

-- 확인: 라인별 13행씩 39행
SELECT line_unit, count(*) FROM mes.spc_limit GROUP BY 1 ORDER BY 1;
