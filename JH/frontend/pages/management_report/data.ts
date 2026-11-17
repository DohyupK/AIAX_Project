// 경영 관리자 리포트 목업 — 생산·근태·안전 집계 API 연동 전 자리 (연동 시 이 파일만 API 호출로 교체)
import type { Gear } from "../ppe_violation/rules";

export type Period = "daily" | "weekly" | "monthly";

export const LINE = "line_no1";
export const PRODUCT = "CylinderHead";

/** 불량 유형 — 2차 검사(DL) 결함 분류 출력과 맞출 키 */
export type DefectType = "porosity" | "short_shot" | "crack" | "burr";
export const DEFECT_LABEL: Record<DefectType, string> = { porosity: "기공", short_shot: "미성형", crack: "크랙", burr: "버(Burr)" };

export const UNIT_PRICE = 85_000;    // 실린더 헤드 1개 단가(원) — 생산 금액·불량 손실 기준
export const RECYCLE_VALUE = 12_000; // 1차 불량품 재용해 시 개당 소재 회수액(원)

/** 고정 값 (기간과 무관) */
export const FIXED = {
  mttrHours: 1.8,   // 평균 수리 시간
  mtbfHours: 142,   // 평균 고장 간격
  recallCount: 1,   // 고객사 리콜 횟수 (최근 12개월)
};

export interface PeriodReport {
  attendance: { total: number; present: number }; // 일일 = 인원, 주간·월간 = 기간 누적 연인원
  production: number;      // 생산량(개)
  defects: number;         // 최종 불량(개)
  defectTypes: Record<DefectType, number>; // 유형별 불량(합계 = defects). DL 연결 전 목업
  firstDefects: number;    // 1차(ML) 불량 판정(개) — 재활용 대상
  recycled: number;        // 1차 불량 중 재용해 재활용(개)
  spcAlarms: { ucl: number; lcl: number };
  safety: {
    scans: number;           // 검색대 태깅 수
    violations: number;      // 필수 장구 미착용 건수
    repeatViolators: number; // 기간 내 2회 이상 위반 인원
    byCompany: { company: string; type: "본사" | "하청업체"; count: number }[];
    byGear: Record<Gear, number>;
  };
}

// 일일 안전 수치는 작업자 안전 대시보드 목업(2026-11-07, 7건 중 위반 3건)과 맞춤
export const REPORTS: Record<Period, PeriodReport> = {
  daily: {
    attendance: { total: 128, present: 121 },
    production: 575, defects: 26, firstDefects: 35, recycled: 31,
    defectTypes: { porosity: 11, short_shot: 7, crack: 5, burr: 3 },
    spcAlarms: { ucl: 4, lcl: 2 },
    safety: {
      scans: 121, violations: 3, repeatViolators: 0,
      byCompany: [
        { company: "(주)한빛정밀", type: "하청업체", count: 1 },
        { company: "대성기공", type: "하청업체", count: 1 },
        { company: "본사 품질팀", type: "본사", count: 1 },
      ],
      byGear: { helmet: 1, shoes: 0, vest: 1, gloves: 1, goggles: 1 },
    },
  },
  weekly: {
    attendance: { total: 768, present: 731 },
    production: 3420, defects: 148, firstDefects: 201, recycled: 176,
    defectTypes: { porosity: 62, short_shot: 41, crack: 28, burr: 17 },
    spcAlarms: { ucl: 21, lcl: 9 },
    safety: {
      scans: 731, violations: 17, repeatViolators: 3,
      byCompany: [
        { company: "(주)한빛정밀", type: "하청업체", count: 7 },
        { company: "대성기공", type: "하청업체", count: 5 },
        { company: "본사 품질팀", type: "본사", count: 3 },
        { company: "본사 주조팀", type: "본사", count: 2 },
      ],
      byGear: { helmet: 4, shoes: 1, vest: 5, gloves: 6, goggles: 4 },
    },
  },
  monthly: {
    attendance: { total: 1536, present: 1462 },
    production: 6890, defects: 301, firstDefects: 412, recycled: 359,
    defectTypes: { porosity: 126, short_shot: 83, crack: 57, burr: 35 },
    spcAlarms: { ucl: 47, lcl: 18 },
    safety: {
      scans: 1462, violations: 38, repeatViolators: 6,
      byCompany: [
        { company: "(주)한빛정밀", type: "하청업체", count: 14 },
        { company: "대성기공", type: "하청업체", count: 11 },
        { company: "세진산업", type: "하청업체", count: 5 },
        { company: "본사 품질팀", type: "본사", count: 5 },
        { company: "본사 주조팀", type: "본사", count: 3 },
      ],
      byGear: { helmet: 9, shoes: 3, vest: 11, gloves: 13, goggles: 8 },
    },
  },
};
