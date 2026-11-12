// 작업자 안전 검색대 목업 기록 — DL 모델·카드리더 연동 전 자리 (연동 시 이 파일만 API 호출로 교체)
import type { Gate, Gear } from "./rules";

export interface ScanRecord {
  id: number;
  date: string;      // 'YYYY-MM-DD'
  time: string;      // 'HH:mm:ss' 카드 태깅 시각
  userId: string;    // 카드 태깅 ID
  gate: Gate;
  company: string;   // 업체명 (본사 부서 포함)
  companyType: "하청업체" | "본사";
  camera: string;
  detected: Gear[];  // DL 모델이 검출한 착용 장구
}

/** 최신순 */
export const SCAN_RECORDS: ScanRecord[] = [
  { id: 7, date: "2026-11-07", time: "08:52:14", userId: "U-20417", gate: "B", company: "(주)한빛정밀", companyType: "하청업체", camera: "CAM 02", detected: ["helmet", "shoes", "vest"] },
  { id: 6, date: "2026-11-07", time: "08:51:03", userId: "U-10233", gate: "A", company: "본사 주조팀", companyType: "본사", camera: "CAM 01", detected: ["helmet", "shoes", "vest", "gloves", "goggles"] },
  { id: 5, date: "2026-11-07", time: "08:50:27", userId: "U-20388", gate: "B", company: "(주)한빛정밀", companyType: "하청업체", camera: "CAM 02", detected: ["helmet", "shoes", "vest", "gloves"] },
  { id: 4, date: "2026-11-07", time: "08:48:41", userId: "U-10198", gate: "A", company: "대성기공", companyType: "하청업체", camera: "CAM 01", detected: ["helmet", "shoes", "vest", "gloves", "goggles"] },
  { id: 3, date: "2026-11-07", time: "08:47:12", userId: "U-10196", gate: "A", company: "대성기공", companyType: "하청업체", camera: "CAM 01", detected: ["helmet", "shoes", "gloves"] },
  { id: 2, date: "2026-11-07", time: "08:46:05", userId: "U-10077", gate: "A", company: "본사 주조팀", companyType: "본사", camera: "CAM 01", detected: ["helmet", "shoes", "vest", "gloves", "goggles"] },
  { id: 1, date: "2026-11-07", time: "08:44:50", userId: "U-20402", gate: "B", company: "본사 품질팀", companyType: "본사", camera: "CAM 02", detected: ["shoes", "vest", "gloves", "goggles"] },
];
