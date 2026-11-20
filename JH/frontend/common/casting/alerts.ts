// 공정 최적화 관리도 알림 — 「공정 최적화 알림 개발 명세 (시연용)」(2026-11-18) 1~5장·부록 A~C 구현
// 불량 예측 모델과 별개. 관리선은 서버 고정 표(/api/casting/limits = casting/spc.py)를 읽기만 하고 다시 계산하지 않음
// 자체 점검: node JH/frontend/pages/process_optimization/alerts.check.ts
// (Node 타입 제거 실행을 위해 이 파일은 type import 만 둠)
import type { FeatureKey, Shot } from './types';

/** 관리선 1개 변수 — 서버 spc.baseline 과 같은 키. σ = MR̄ / 1.128, EWMA 반폭 = 1σ */
export interface Limit { cl: number; sigma: number; iLcl: number; iUcl: number; mrCl: number; mrUcl: number; ewmaLcl: number; ewmaUcl: number }
/** 라인 관리선 — 기준 기간(첫 7일) 다음 날(judgeFrom)부터 판정 */
export interface ControlLimits { line: string; baselineFrom: string; baselineTo: string; judgeFrom: string; lambda: number; variables: Partial<Record<FeatureKey, Limit>> }

export type Grade = 'alarm' | 'caution' | 'watch';
export type Rule = 'alarm' | 'n1' | 'n2' | 'n3' | 'ewma' | 'mr';
type Dir = 'up' | 'down' | null;

export const GRADE_NAME: Record<Grade, string> = { alarm: '경보', caution: '주의', watch: '관찰' };
export const GRADE_RANK: Record<Grade, number> = { alarm: 3, caution: 2, watch: 1 };

/** 판정 변수 13개 (명세 1장) — 상·하형 온도3·4 는 알림에 쓰지 않음. 화면 이름은 호출하는 쪽이 넘김 (analysis.ts LABELS) */
const ALERT_KEYS: FeatureKey[] = [
  'top_temp1', 'top_temp2', 'bottom_temp1', 'bottom_temp2', 'biscuit_thickness', 'cooling_water_temp', 'injection_pressure',
  'mechanical_strength', 'sleeve_temperature', 'mold_temperature', 'molten_capacity', 'facility_CycleTime', 'production_CycleTime',
];

/** 경보 = 설비 한계값 (관리선 무관). 경보 샷은 주의·관찰 판정과 런 상태 갱신을 하지 않음 */
const ALARMS: { key: FeatureKey; hit: (v: number) => boolean; limit: number; cond: string }[] = [
  { key: 'injection_pressure', hit: v => v < 600, limit: 600, cond: '600 미만' },
  { key: 'mechanical_strength', hit: v => v <= 0, limit: 0, cond: '0 이하' },
  { key: 'biscuit_thickness', hit: v => v <= 125, limit: 125, cond: '125 이하' },
];

const LAMBDA = 0.2;
const N2_LEN = 9;            // 넬슨 2: 중심선 한쪽 연속 점 수
const N3_LEN = 6;            // 넬슨 3: 연속 상승/하강 점 수
const RELATED_WINDOW = 5;    // 다른 샷 관련 알림 창 (production_count 차이)
/** 같은 변수에서 여러 규칙이 처음 참이 되면 하나만 — 넬슨 1 > 넬슨 2 > EWMA > 넬슨 3 > MR 1 */
const RULE_ORDER: Exclude<Rule, 'alarm'>[] = ['n1', 'n2', 'ewma', 'n3', 'mr'];
const RULE_GRADE: Record<Rule, Grade> = { alarm: 'alarm', n1: 'caution', n2: 'watch', n3: 'watch', ewma: 'watch', mr: 'watch' };

/** 센서 오류값·빈 값 — 그 변수만 판정 제외 (EWMA·MR·연속 샷 수도 갱신 안 함) */
const invalid = (k: FeatureKey, v: number | null): v is null =>
  v == null || Number.isNaN(v) || (k === 'mold_temperature' && v === 0) || (k === 'molten_capacity' && (v === 0 || v > 100));

// ── 부록 A: 확인할 곳 문구 ─────────────────────────────────────────────
type Signal = 'alarm' | 'n1-up' | 'n1-down' | 'mean-up' | 'mean-down' | 'n3-up' | 'n3-down' | 'mr';
type Group = 'mold' | 'biscuit' | 'cooling' | 'injection' | 'strength' | 'sleeve' | 'melt' | 'molten' | 'cycle';
const MOLD: FeatureKey[] = ['top_temp1', 'top_temp2', 'bottom_temp1', 'bottom_temp2'];
const CYCLE: FeatureKey[] = ['facility_CycleTime', 'production_CycleTime'];
const groupOf = (k: FeatureKey): Group =>
  MOLD.includes(k) ? 'mold' : CYCLE.includes(k) ? 'cycle'
    : ({ biscuit_thickness: 'biscuit', cooling_water_temp: 'cooling', injection_pressure: 'injection', mechanical_strength: 'strength',
      sleeve_temperature: 'sleeve', mold_temperature: 'melt', molten_capacity: 'molten' } as Partial<Record<FeatureKey, Group>>)[k]!;

/** {v} = 변수 화면 이름 */
const GUIDE: Record<Group, Partial<Record<Signal, string>>> = {
  mold: {
    'n1-down': '{v} 낮음: 직전 정지·재가동 여부와 이형제 스프레이 양·시간을 확인하세요.',
    'n1-up': '{v} 높음: 해당 위치 냉각 채널 유량·막힘과 온조기 설정을 확인하세요.',
    'mean-down': '{v} 평균 하강: 온조기 히터 출력과 냉각수 유량 증가 여부를 확인하세요.',
    'mean-up': '{v} 평균 상승: 온조기·냉각수 설정 변경과 사이클 단축 여부를 확인하세요.',
    'n3-down': '{v} 계속 하강: 사이클 지연·대기 증가와 온조기 동작을 확인하세요.',
    'n3-up': '{v} 계속 상승: 냉각 채널 스케일 누적과 냉각수 공급 중단을 확인하세요.',
    mr: '{v} 샷 간 흔들림: 열전대 고정·접촉 상태와 온조기 헌팅을 확인하세요.',
  },
  biscuit: {
    alarm: '비스켓 두께 한계 이하: 용탕 공급과 사출 동작을 점검하세요.',
    'n1-down': '비스켓 두께 낮음: 용탕 계량(래들) 정량과 보온로 수위를 확인하세요.',
    'n1-up': '비스켓 두께 높음: 래들 과다 계량과 플런저 스트로크를 확인하세요.',
    'mean-down': '비스켓 두께 평균 하강: 래들 계량 설정과 래들 내부 부착물을 확인하세요.',
    'mean-up': '비스켓 두께 평균 상승: 계량 설정 변경과 래들 계량 장치를 확인하세요.',
    'n3-down': '비스켓 두께 계속 하강: 래들 내부 산화물 부착이 늘고 있는지 확인하세요.',
    'n3-up': '비스켓 두께 계속 상승: 플런저 팁 마모와 슬리브 마찰을 확인하세요.',
    mr: '비스켓 두께 샷 간 흔들림: 래들 계량 반복성(각도·타이밍)을 확인하세요.',
  },
  cooling: {
    'n1-up': '냉각수 온도 높음: 칠러·쿨링타워 동작과 냉각수 유량을 확인하세요.',
    'n1-down': '냉각수 온도 낮음: 칠러 설정과 온도 센서를 확인하세요.',
    'mean-up': '냉각수 온도 평균 상승: 칠러 능력 저하, 열교환기 오염, 외기 온도를 확인하세요.',
    'mean-down': '냉각수 온도 평균 하강: 칠러 설정 변경 이력을 확인하세요.',
    'n3-up': '냉각수 온도 계속 상승: 칠러·냉각탑 팬 정지와 순환 펌프를 확인하세요.',
    'n3-down': '냉각수 온도 계속 하강: 샷 사이 대기가 길어져 열 부하가 줄었는지와 칠러 설정 변경을 확인하세요.',
    mr: '냉각수 온도 샷 간 흔들림: 칠러 온도 제어 헌팅과 밸브 개폐 반복을 확인하세요.',
  },
  injection: {
    alarm: '{v} 한계 미달: 어큐뮬레이터와 유압 장치를 점검하세요.',
    'n1-down': '{v} 낮음: 어큐뮬레이터 질소 압력과 유압을 확인하세요.',
    'n1-up': '{v} 높음: 사출 설정 변경과 압력 센서를 확인하세요.',
    'mean-down': '{v} 평균 하강: 유압유 온도와 펌프·밸브 누설을 확인하세요.',
    'mean-up': '{v} 평균 상승: 사출 조건 설정 변경 이력을 확인하세요.',
    'n3-down': '{v} 계속 하강: 어큐뮬레이터 압력 저하와 유압 누유를 확인하세요.',
    'n3-up': '{v} 계속 상승: 유압유 온도 변화와 팁·슬리브 마찰을 확인하세요.',
    mr: '{v} 샷 간 흔들림: 비례·서보 밸브 응답과 압력 센서를 확인하세요.',
  },
  strength: {
    alarm: '형체력 0: 금형이 잠기지 않았습니다. 형체 장치를 점검하세요.',
    'n1-down': '형체력 낮음: 금형 분할면 이물·버와 토글 윤활을 확인하세요.',
    'n1-up': '형체력 높음: 형체 설정과 형두께 조정을 확인하세요.',
    'mean-down': '형체력 평균 하강: 금형 온도 하락과 타이바 신장을 확인하세요.',
    'mean-up': '형체력 평균 상승: 금형 온도 상승(열팽창)과 형두께 조정을 확인하세요.',
    'n3-down': '형체력 계속 하강: 토글 링크·핀 마모와 타이바 너트 풀림을 확인하세요.',
    'n3-up': '형체력 계속 상승: 금형이 가열 중인지(재가동 직후) 확인하세요.',
    mr: '형체력 샷 간 흔들림: 형체 유압과 형체력 센서를 확인하세요.',
  },
  sleeve: {
    'n1-down': '슬리브 온도 낮음: 직전 대기·정지 여부와 슬리브 예열을 확인하세요.',
    'n1-up': '슬리브 온도 높음: 슬리브 냉각과 급탕 후 체류 시간을 확인하세요.',
    'mean-down': '슬리브 온도 평균 하강: 슬리브 냉각 유량 증가와 사이클 대기 증가를 확인하세요.',
    'mean-up': '슬리브 온도 평균 상승: 슬리브 냉각 부족과 용탕 온도 상승을 확인하세요.',
    'n3-down': '슬리브 온도 계속 하강: 샷 사이 대기 시간이 길어지고 있는지(급탕·취출 지연) 확인하세요.',
    'n3-up': '슬리브 온도 계속 상승: 재가동 후 예열 중인지, 냉각 회로 이상인지 확인하세요.',
    mr: '슬리브 온도 샷 간 흔들림: 급탕 시점 불규칙과 온도 센서 접촉을 확인하세요.',
  },
  melt: {
    'n1-down': '용융온도 낮음: 보온로 히터와 잉곳 투입 직후인지 확인하세요.',
    'n1-up': '용융온도 높음: 보온로 온도 설정과 과열을 확인하세요.',
    'mean-down': '용융온도 평균 하강: 보온로 히터 출력과 잉곳 투입 주기를 확인하세요.',
    'mean-up': '용융온도 평균 상승: 보온로 설정 변경 이력을 확인하세요.',
    'n3-down': '용융온도 계속 하강: 잉곳 연속 투입과 히터 고장을 확인하세요.',
    'n3-up': '용융온도 계속 상승: 온도 제어기 동작을 확인하세요.',
    mr: '용융온도 샷 간 흔들림: 열전대 보호관 상태와 온도 제어기 헌팅을 확인하세요.',
  },
  molten: {
    'n1-down': '용탕량 낮음: 래들 계량과 보온로 수위를 확인하세요.',
    'n1-up': '용탕량 높음: 래들 과다 계량과 계량 센서를 확인하세요.',
    'mean-up': '용탕량 평균 이동: 계량 설정 변경과 보온로 수위 변화를 확인하세요.',
    'mean-down': '용탕량 평균 이동: 계량 설정 변경과 보온로 수위 변화를 확인하세요.',
    'n3-down': '용탕량 계속 하강: 보온로 수위가 낮아지고 있는지, 용탕 보충 시점을 확인하세요.',
    'n3-up': '용탕량 계속 상승: 보충 직후 수위 상승과 계량 설정을 확인하세요.',
    mr: '용탕량 샷 간 흔들림: 래들 계량 반복성을 확인하세요.',
  },
  cycle: {
    'n1-up': '{v} 길어짐: 취출·스프레이·로봇 대기 등 지연 원인을 확인하세요.',
    'n1-down': '{v} 짧아짐: 사이클 설정 변경과 공정 단계 생략 여부를 확인하세요.',
    'mean-up': '{v} 평균 증가: 로봇·취출기 동작 지연과 작업 인원을 확인하세요.',
    'mean-down': '{v} 평균 단축: 냉각·스프레이 시간 설정 변경을 확인하세요.',
    'n3-up': '{v} 계속 증가: 지연이 누적되는 설비(취출, 스프레이)를 확인하세요.',
    'n3-down': '{v} 계속 단축: 사이클 설정 조정 중인지 확인하세요.',
    mr: '{v} 불규칙: 짧은 정지 반복, 취출 실패, 작업자 대기를 확인하세요.',
  },
};

const signalOf = (rule: Rule, dir: Dir): Signal =>
  rule === 'alarm' || rule === 'mr' ? rule
    : `${rule === 'n1' ? 'n1' : rule === 'n3' ? 'n3' : 'mean'}-${dir === 'up' ? 'up' : 'down'}`;

// ── 부록 B: 함께 볼 곳 (같은 샷) — 더 구체적인 조합을 먼저 ─────────────────
const COMBOS: { test: (has: (keys: FeatureKey[], dir: 'up' | 'down') => boolean) => boolean; text: string }[] = [
  { test: h => h(['top_temp1', 'top_temp2'], 'down') && h(['bottom_temp1', 'bottom_temp2'], 'down') && h(CYCLE, 'up'),
    text: '설비 지연으로 금형 온도 하락: 지연 원인을 확인하고 예열 샷을 검토하세요.' },
  { test: h => h(['mold_temperature'], 'down') && h(['sleeve_temperature'], 'down') && h(MOLD, 'down'),
    text: '열 공급 부족: 보온로 온도부터 확인하세요.' },
  { test: h => h(['top_temp1'], 'down') && h(['top_temp2'], 'down'),
    text: '상형 전체 온도 하락: 직전 정지 여부와 상형 온조기를 확인하세요.' },
  { test: h => h(MOLD, 'up') && h(['cooling_water_temp'], 'up'),
    text: '냉각수 온도 상승으로 금형 과열: 칠러와 냉각수 유량을 확인하세요.' },
  { test: h => h(['biscuit_thickness'], 'down') && h(['molten_capacity'], 'down'),
    text: '용탕 공급 부족: 래들 계량과 보온로 수위를 확인하세요.' },
  { test: h => h(['injection_pressure'], 'down') && h(['biscuit_thickness'], 'up'),
    text: '사출 불완전: 어큐뮬레이터 압력과 플런저 동작을 확인하세요.' },
  { test: h => h(['mechanical_strength'], 'up') && h(MOLD, 'up'),
    text: '금형 온도 상승(형체력 동반): 금형 온도 원인부터 확인하세요.' },
];

// ── 5장: 다른 샷 관련 변수 쌍 (창 5샷) ──────────────────────────────────
const RELATED_PAIRS: [FeatureKey[], FeatureKey[]][] = [
  [['top_temp1'], ['top_temp2']],
  [CYCLE, MOLD],
  [['cooling_water_temp'], MOLD],
  [['injection_pressure'], ['biscuit_thickness']],
  [MOLD, ['mechanical_strength']],
  [CYCLE, ['sleeve_temperature']],
  [['mold_temperature'], ['sleeve_temperature', ...MOLD]],
  [['molten_capacity'], ['biscuit_thickness']],
];
const related = (a: FeatureKey, b: FeatureKey) =>
  RELATED_PAIRS.some(([x, y]) => (x.includes(a) && y.includes(b)) || (x.includes(b) && y.includes(a)));

/** 변수 하나의 알림 (카드 안 한 줄) */
export interface VarAlert { key: FeatureKey; rule: Rule; grade: Grade; dir: Dir; z: number; title: string; detail: string }

/** 알림 카드 — 같은 샷의 알림은 한 장 (명세 4·5장) */
export interface AlertCard {
  id: string; line: string; date: string; time: string; shotId: number;
  grade: Grade;
  head: string;       // 1줄: 등급 · 시각 · 설비 · 샷 번호
  title: string;      // 2줄
  details: string[];  // 3줄 (변수마다 한 줄)
  guide: string;      // 4줄
  extra: string | null; // 5줄: 함께 볼 곳 또는 최근 관련 알림
  vars: VarAlert[];
}

/** 관리선이 좁은 변수(σ < 1, 예: 형체력 0.38)는 소수 둘째 자리 — 86 이 LCL 86.02 밖인데 「86.0 (관리선 86.0 ~)」처럼 안으로 보이지 않게 */
const fv = (v: number, l: Limit) => v.toFixed(l.sigma < 1 ? 2 : 1);
const plain = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const hhmm = (t: string) => { const [h, m] = t.split(':'); return `${h.padStart(2, '0')}:${m}`; };

const PHENOMENON: Record<Exclude<Rule, 'alarm'>, (dir: Dir) => string> = {
  n1: d => `정상 범위 이탈 (${d === 'up' ? '높음' : '낮음'})`,
  n2: d => `평균 이동 (${d === 'up' ? '높은 쪽' : '낮은 쪽'}, ${N2_LEN}샷)`,
  n3: d => `연속 ${d === 'up' ? '상승' : '하강'} (${N3_LEN}샷)`,
  ewma: d => `수준 서서히 ${d === 'up' ? '상승' : '하강'}`,
  mr: () => '샷 간 흔들림',
};

interface VarState { e: number; xPrev: number | null; recent: number[]; active: Record<Exclude<Rule, 'alarm'>, boolean> }
const newState = (): VarState => ({ e: 0, xPrev: null, recent: [], active: { n1: false, n2: false, n3: false, ewma: false, mr: false } });

/** 최근 n개가 모두 중심선 한쪽 (z = 0 이면 끊김) */
const sameSide = (r: number[], cl: number, n: number) => {
  if (r.length < n) return null;
  const last = r.slice(-n);
  return last.every(x => x > cl) ? 'up' : last.every(x => x < cl) ? 'down' : null;
};
/** 최근 n개가 계속 상승/하강 (같은 값이면 끊김) */
const monotone = (r: number[], n: number) => {
  if (r.length < n) return null;
  const last = r.slice(-n);
  const d = last.slice(1).map((x, i) => x - last[i]);
  return d.every(x => x > 0) ? 'up' : d.every(x => x < 0) ? 'down' : null;
};

/**
 * 샷 목록(시각 순) → 알림 카드(시각 순). date = 'YYYY-MM-DD' (카드 1줄·판정 기간 확인용), labels = 변수 화면 이름
 * 판정 시작일(기준 기간 다음 날) 앞의 날짜는 판정하지 않음 (빈 목록)
 * 런 = production_count 가 앞 샷보다 작아지면 새 런 → EWMA·MR 앞 샷·넬슨 연속 수·걸림 표시·관련 알림 기록 초기화
 */
export function buildAlertCards(shots: Shot[], limits: ControlLimits, date: string, labels: Record<FeatureKey, string>): AlertCard[] {
  if (date < limits.judgeFrom) return [];
  const { line, variables: lim } = limits;
  const keys = ALERT_KEYS.filter(k => lim[k]);
  const label = (k: FeatureKey) => labels[k] ?? k;
  let state: Partial<Record<FeatureKey, VarState>> = {};
  let history: { shotId: number; key: FeatureKey; title: string }[] = []; // 같은 런의 최근 알림 (관련 알림 5줄용)
  let prevCount: number | null = null;
  const cards: AlertCard[] = [];

  for (const shot of shots) {
    if (prevCount != null && shot.shotId < prevCount) { state = {}; history = []; }
    prevCount = shot.shotId;
    const f = shot.features;
    const hits: VarAlert[] = [];

    const alarms = ALARMS.filter(a => f[a.key] != null && a.hit(f[a.key]!));
    if (alarms.length) {
      // 경보 샷: 경보만, 주의·관찰 판정·상태 갱신 안 함
      for (const a of alarms) {
        const v = f[a.key]!, l = lim[a.key];
        hits.push({ key: a.key, rule: 'alarm', grade: 'alarm', dir: 'down', z: l ? (v - l.cl) / l.sigma : 0,
          title: `${label(a.key)} 설비 한계 이탈 (${a.cond})`, detail: `${label(a.key)} ${plain(v)} (한계 ${a.limit})` });
      }
    } else {
      for (const k of keys) {
        const x = f[k];
        if (invalid(k, x)) continue;
        const l = lim[k]!;
        const s = (state[k] ??= newState());
        const d = x - l.cl, z = d / l.sigma;
        s.e = LAMBDA * d + (1 - LAMBDA) * s.e;
        s.recent.push(x);
        if (s.recent.length > N2_LEN) s.recent.shift();
        const ewma = l.cl + s.e;
        const diff = s.xPrev == null ? null : Math.abs(x - s.xPrev);
        const n2 = sameSide(s.recent, l.cl, N2_LEN), n3 = monotone(s.recent, N3_LEN);
        const now = {
          n1: x > l.iUcl || x < l.iLcl,
          n2: n2 != null,
          n3: n3 != null,
          ewma: ewma > l.ewmaUcl || ewma < l.ewmaLcl,
          mr: diff != null && diff > l.mrUcl,
        };
        s.xPrev = x;
        const fresh = RULE_ORDER.filter(r => now[r] && !s.active[r]); // 처음 참이 된 규칙만
        s.active = now;
        if (!fresh.length) continue;
        const rule = fresh[0];
        const dir: Dir = rule === 'n1' ? (z > 0 ? 'up' : 'down') : rule === 'n2' ? n2 : rule === 'n3' ? n3 : rule === 'ewma' ? (s.e > 0 ? 'up' : 'down') : null;
        const detail = rule === 'ewma' ? `${label(k)} EWMA ${fv(ewma, l)} (관리선 ${fv(l.ewmaLcl, l)} ~ ${fv(l.ewmaUcl, l)})`
          : rule === 'mr' ? `${label(k)} 차이 ${fv(diff!, l)} (상한 ${fv(l.mrUcl, l)})`
            : `${label(k)} ${fv(x, l)} (관리선 ${fv(l.iLcl, l)} ~ ${fv(l.iUcl, l)})`;
        hits.push({ key: k, rule, grade: RULE_GRADE[rule], dir, z, title: `${label(k)} ${PHENOMENON[rule](dir)}`, detail });
      }
    }
    if (!hits.length) continue;

    // 제목 변수 = 등급이 가장 높고, 같으면 |z| 가 가장 큰 변수
    hits.sort((a, b) => GRADE_RANK[b.grade] - GRADE_RANK[a.grade] || Math.abs(b.z) - Math.abs(a.z));
    const top = hits[0];
    const guide = (GUIDE[groupOf(top.key)][signalOf(top.rule, top.dir)] ?? '').replace('{v}', label(top.key));
    const has = (ks: FeatureKey[], dir: 'up' | 'down') => hits.some(h => ks.includes(h.key) && h.dir === dir);
    let extra = COMBOS.find(c => c.test(has))?.text ?? null;
    if (!extra) {
      const recent = history
        .filter(h => shot.shotId - h.shotId > 0 && shot.shotId - h.shotId <= RELATED_WINDOW && hits.some(x => related(x.key, h.key)))
        .slice(-2).reverse()
        .map(h => `#${h.shotId} ${h.title}, ${shot.shotId - h.shotId}샷 전`);
      if (recent.length) extra = `최근 관련 알림: ${recent.join(' · ')}`;
    }
    for (const h of hits) history.push({ shotId: shot.shotId, key: h.key, title: h.title });
    history = history.filter(h => shot.shotId - h.shotId < RELATED_WINDOW); // 다음 샷에서 창 밖이 될 기록 정리

    cards.push({
      id: `${line}|${date}|${shot.castingId ?? `${shot.time}#${shot.shotId}`}`,
      line, date, time: shot.time, shotId: shot.shotId, grade: top.grade,
      head: `${GRADE_NAME[top.grade]} · ${date} ${hhmm(shot.time)} · ${line} · #${shot.shotId}`,
      title: `#${shot.shotId} ${top.title}${hits.length > 1 ? ` 외 ${hits.length - 1}건` : ''}`,
      details: hits.map(h => h.detail), guide, extra, vars: hits,
    });
  }
  return cards;
}
