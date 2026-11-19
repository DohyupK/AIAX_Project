// 현재 로그인 계정 — 업로더 등 "누가 했는지" 자동 기록에 사용
// ponytail: 로그인(인증)이 아직 없어 목업 계정을 돌려줌. 로그인 도입 시 이 함수만 세션/토큰 조회로 교체
export interface CurrentUser {
  user_id: string;    // 사번·계정 ID
  name: string;
  department: string;
}

// 서버 org.employee 실제 사번 (E2001 없음 → e0001 김지환)
const MOCK_USER: CurrentUser = { user_id: 'e0001', name: '김지환', department: '경영' };

/** 로그인 안 된 상태면 null */
export function getCurrentUser(): CurrentUser | null {
  return MOCK_USER;
}
