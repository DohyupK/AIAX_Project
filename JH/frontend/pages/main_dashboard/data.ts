// 메인 대시보드 — 일정·예시 공지 하드코딩. 일일 공정 알람 AI 공지는 noticeApi → GET /api/main/daily-notice

export type NoticeTag = "필독" | "안전" | "일반";
export type EventTone = "red" | "orange" | "blue" | "green";

export interface Notice {
  id: number;
  tag: NoticeTag;
  title: string;
  date: string; // 'YYYY-MM-DD'
  content: string; // 팝업 상세 본문
}

export interface CompanyEvent {
  date: string; // 'YYYY-MM-DD'
  title: string;
  tone: EventTone;
}

/** 회사 전체 공지 (최신순) */
export const NOTICES: Notice[] = [
  { id: 3, tag: "필독", title: "11/12 다이캐스팅 2라인 금형 교체로 오전 가동 중지", date: "2026-11-06",
    content: "11월 12일(목) 다이캐스팅 2라인 금형 교체 작업으로 08:00~12:00 가동을 중지합니다.\n해당 라인 생산 물량은 1라인으로 전환하며, 작업자는 08:30 2라인 앞에서 안전 브리핑에 참석해 주십시오.\n문의: 생산기술팀" },
  { id: 1, tag: "일반", title: "품질 검사 DL 모델 v2.3 배포 완료", date: "2026-11-02",
    content: "품질 검사 DL 모델 v2.3이 배포되었습니다.\n주요 변경: 기공 불량 검출률 개선, 오검출 감소.\n이상 판정이 보이면 품질팀으로 알려 주십시오." },
];

/** 회사 일정 */
export const EVENTS: CompanyEvent[] = [
  { date: "2026-11-03", title: "안전교육", tone: "orange" },
  { date: "2026-11-07", title: "품질 회의", tone: "blue" },
  { date: "2026-11-12", title: "2라인 금형교체", tone: "red" },
  { date: "2026-11-18", title: "경영 보고", tone: "green" },
  { date: "2026-11-20", title: "설비 점검", tone: "orange" },
  { date: "2026-11-20", title: "모델 배포", tone: "blue" },
  { date: "2026-11-27", title: "월말 마감", tone: "green" },
];
