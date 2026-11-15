// 현재 로그인 계정 — 업로더 등 "누가 했는지" 자동 기록에 사용
// ponytail: 로그인(인증)이 아직 없어 목업 계정을 돌려줌. 로그인 도입 시 이 함수만 세션/토큰 조회로 교체
export interface CurrentUser {
  user_id: string;    // 사번·계정 ID
  name: string;
  department: string;
}

const MOCK_USER: CurrentUser = { user_id: 'E2001', name: '홍길동', department: '생산팀' };

/** 로그인 안 된 상태면 null */
export function getCurrentUser(): CurrentUser | null {
  return MOCK_USER;
}
