// 관리도(SPC) 기준선 — 라인별·변수별 고정값 (JH 제공 표, 2026-11-19). 날짜와 무관하게 항상 이 값을 기준선으로 씀
// 공식: I = CL ± 3σ, MR UCL = 3.267 × MR̄ (MR LCL 0), EWMA = CL ± 3σ·√(λ/(2-λ)) = CL ± 1σ (λ 0.2) — 자체 점검: spc.check.ts
// ponytail: 기준선을 자주 바꾸게 되면 DB 테이블·API 로 옮길 것 (지금은 코드 상수)
import type { FeatureKey } from './types';

export interface SpcBaseline {
  cl: number;    // 중심선 (I·EWMA 공통)
  sigma: number; // σ
  iLcl: number; iUcl: number;
  mrCl: number;  // MR̄
  mrUcl: number; // MR LCL 은 0
  ewmaLcl: number; ewmaUcl: number;
}

/** 표 한 줄 = [CL, σ, I LCL, I UCL, MR CL, MR UCL, EWMA LCL, EWMA UCL] */
type Row = [number, number, number, number, number, number, number, number];
const toBaseline = ([cl, sigma, iLcl, iUcl, mrCl, mrUcl, ewmaLcl, ewmaUcl]: Row): SpcBaseline =>
  ({ cl, sigma, iLcl, iUcl, mrCl, mrUcl, ewmaLcl, ewmaUcl });

/** 기준선이 있는 변수 (상·하형 온도3 은 표에 없어 관리도 대상 아님) */
export type SpcKey = Exclude<FeatureKey, 'top_temp3' | 'bottom_temp3'>;

const TABLE: Record<'line_no1' | 'line_no2' | 'line_no3', Record<SpcKey, Row>> = {
  line_no1: {
    top_temp1: [374.95, 26.16, 296.49, 453.42, 29.50, 96.39, 348.80, 401.11],
    top_temp2: [371.56, 9.72, 342.39, 400.74, 10.97, 35.84, 361.84, 381.29],
    bottom_temp1: [558.47, 25.08, 483.23, 633.71, 28.29, 92.43, 533.39, 583.55],
    bottom_temp2: [361.85, 11.17, 328.35, 395.35, 12.60, 41.15, 350.68, 373.01],
    biscuit_thickness: [149.43, 3.45, 139.09, 159.77, 3.89, 12.70, 145.98, 152.87],
    cooling_water_temp: [32.81, 2.26, 26.03, 39.59, 2.55, 8.33, 30.55, 35.07],
    injection_pressure: [657.84, 1.19, 654.27, 661.40, 1.34, 4.38, 656.65, 659.02],
    mechanical_strength: [87.17, 0.38, 86.02, 88.32, 0.43, 1.41, 86.78, 87.55],
    sleeve_temperature: [377.97, 7.00, 356.97, 398.96, 7.89, 25.79, 370.97, 384.96],
    mold_temperature: [589.83, 6.62, 569.98, 609.69, 7.47, 24.39, 583.22, 596.45],
    molten_capacity: [14.85, 5.07, -0.35, 30.05, 5.72, 18.67, 9.78, 19.92],
    facility_CycleTime: [146.76, 7.78, 123.42, 170.10, 8.78, 28.67, 138.98, 154.54],
    production_CycleTime: [151.76, 7.34, 129.74, 173.77, 8.28, 27.04, 144.42, 159.09],
  },
  line_no2: {
    top_temp1: [374.03, 25.43, 297.73, 450.34, 28.69, 93.73, 348.60, 399.47],
    top_temp2: [371.62, 9.36, 343.54, 399.69, 10.56, 34.49, 362.26, 380.97],
    bottom_temp1: [558.68, 24.88, 484.03, 633.32, 28.07, 91.69, 533.79, 583.56],
    bottom_temp2: [361.84, 10.97, 328.91, 394.76, 12.38, 40.44, 350.86, 372.81],
    biscuit_thickness: [149.45, 3.40, 139.26, 159.63, 3.83, 12.51, 146.05, 152.84],
    cooling_water_temp: [32.81, 2.24, 26.11, 39.52, 2.52, 8.24, 30.58, 35.05],
    injection_pressure: [657.84, 1.19, 654.27, 661.40, 1.34, 4.38, 656.65, 659.02],
    mechanical_strength: [87.19, 0.40, 86.00, 88.38, 0.45, 1.46, 86.79, 87.59],
    sleeve_temperature: [377.96, 6.65, 358.00, 397.92, 7.51, 24.52, 371.31, 384.62],
    mold_temperature: [589.78, 6.48, 570.34, 609.23, 7.31, 23.89, 583.30, 596.27],
    molten_capacity: [14.88, 5.10, -0.41, 30.16, 5.75, 18.78, 9.78, 19.97],
    facility_CycleTime: [146.84, 8.04, 122.70, 170.97, 9.07, 29.64, 138.79, 154.88],
    production_CycleTime: [151.94, 7.61, 129.11, 174.78, 8.59, 28.05, 144.33, 159.56],
  },
  line_no3: {
    top_temp1: [373.88, 25.75, 296.64, 451.13, 29.05, 94.89, 348.14, 399.63],
    top_temp2: [371.35, 9.56, 342.67, 400.03, 10.78, 35.23, 361.79, 380.91],
    bottom_temp1: [558.55, 25.02, 483.49, 633.62, 28.22, 92.21, 533.53, 583.57],
    bottom_temp2: [361.75, 10.96, 328.88, 394.62, 12.36, 40.38, 350.80, 372.71],
    biscuit_thickness: [149.47, 3.47, 139.05, 159.88, 3.92, 12.79, 145.99, 152.94],
    cooling_water_temp: [32.78, 2.26, 26.00, 39.56, 2.55, 8.33, 30.52, 35.04],
    injection_pressure: [657.88, 1.23, 654.19, 661.58, 1.39, 4.54, 656.65, 659.11],
    mechanical_strength: [87.19, 0.40, 86.01, 88.39, 0.45, 1.46, 86.80, 87.59],
    sleeve_temperature: [377.19, 8.32, 352.24, 402.15, 9.38, 30.65, 368.88, 385.51],
    mold_temperature: [589.59, 6.98, 568.65, 610.52, 7.87, 25.72, 582.61, 596.57],
    molten_capacity: [14.85, 5.21, -0.77, 30.47, 5.87, 19.19, 9.64, 20.06],
    facility_CycleTime: [146.78, 8.07, 122.56, 171.00, 9.11, 29.75, 138.71, 154.85],
    production_CycleTime: [151.81, 7.57, 129.11, 174.50, 8.53, 27.88, 144.24, 159.37],
  },
};

/** 라인·변수의 기준선. 표에 없는 라인·변수면 null (화면에 「기준선 없음」) */
export function spcBaseline(line: string, k: FeatureKey): SpcBaseline | null {
  const row = (TABLE as Record<string, Partial<Record<FeatureKey, Row>>>)[line]?.[k];
  return row ? toBaseline(row) : null;
}
