/**
 * 3교대 구간 — 주간 06~14 / 오후 14~22 / 야간 22~다음날 06 (KST)
 * 인수인계: 완료 교대 = 시작~종료, 진행 중 = 시작~지금(부분 집계)
 */

export type ShiftId = 'day' | 'afternoon' | 'night';

export const SHIFT_LABEL: Record<ShiftId, string> = {
  day: '주간',
  afternoon: '오후',
  night: '야간',
};

/** 교대 전환 직후 자동 팝업을 띄우는 분 (경계 시각부터) */
export const AUTO_OPEN_MINUTES = 30;

/** 하루 분(0~1440). 06:00=360, 14:00=840, 22:00=1320 */
export const SHIFT_START_MIN: Record<ShiftId, number> = {
  day: 6 * 60,
  afternoon: 14 * 60,
  night: 22 * 60,
};

/** 한 달력일·시간대 구간 (toMin 미만, 분 단위) */
export interface TimeSegment {
  date: string; // YYYY-MM-DD
  fromMin: number;
  toMin: number;
}

export interface ShiftWindow {
  id: ShiftId;
  label: string;
  /** 집계 구간 (야간은 최대 2일) */
  segments: TimeSegment[];
  /** 교대 정식 종료 시각이 아직 안 지났으면 true */
  partial: boolean;
  /** sessionStorage·파일명용 키 (교대 시작 시각 기준) */
  key: string;
  /** 화면용 구간 문구 */
  rangeLabel: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 'H:mm:ss' | 'HH:mm' → 분 (초는 버림) */
export function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minToHhmm(min: number): string {
  const m = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/** YYYY-MM-DD + 일수 */
export function addDays(iso: string, days: number): string {
  const [y, mo, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** KST 기준 오늘 날짜·분 */
export function kstNowParts(now = new Date()): { date: string; minutes: number } {
  const date = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  const time = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul', hour12: false });
  return { date, minutes: timeToMin(time) };
}

function rangeLabel(segments: TimeSegment[]): string {
  if (!segments.length) return '';
  const a = segments[0];
  const b = segments[segments.length - 1];
  const from = `${a.date} ${minToHhmm(a.fromMin)}`;
  const to = `${b.date} ${minToHhmm(b.toMin)}`;
  return `${from} ~ ${to}`;
}

/**
 * 교대 시작 시각(달력일·분)부터 untilMin(같은 타임라인의 절대 분)까지 세그먼트.
 * night: startDate 22:00 → 다음날 06:00 이 until 상한.
 */
export function windowFromStart(
  id: ShiftId,
  startDate: string,
  untilDate: string,
  untilMin: number,
  partial: boolean,
): ShiftWindow {
  const startMin = SHIFT_START_MIN[id];
  const segments: TimeSegment[] = [];

  if (id === 'night') {
    const endDate = addDays(startDate, 1);
    const endMin = 6 * 60;
    // 시작일 22:00 ~ 24:00
    if (untilDate > startDate || (untilDate === startDate && untilMin > startMin)) {
      const toOnStart = untilDate === startDate ? Math.min(untilMin, 24 * 60) : 24 * 60;
      if (toOnStart > startMin) segments.push({ date: startDate, fromMin: startMin, toMin: toOnStart });
    }
    // 다음날 00:00 ~ until 또는 06:00
    if (untilDate > startDate) {
      const to = untilDate > endDate ? endMin : Math.min(untilMin, endMin);
      if (to > 0) segments.push({ date: endDate, fromMin: 0, toMin: to });
    }
  } else {
    const endMin = id === 'day' ? 14 * 60 : 22 * 60;
    const to = untilDate > startDate ? endMin : Math.min(untilMin, endMin);
    if (to > startMin) segments.push({ date: startDate, fromMin: startMin, toMin: to });
  }

  const key = `${id}|${startDate}|${minToHhmm(startMin)}`;
  return {
    id,
    label: SHIFT_LABEL[id],
    segments,
    partial,
    key,
    rangeLabel: rangeLabel(segments),
  };
}

/** 지금이 속한 교대 (진행 중 → partial, until=지금) */
export function currentShiftWindow(now = new Date()): ShiftWindow {
  const { date, minutes } = kstNowParts(now);
  if (minutes >= SHIFT_START_MIN.day && minutes < SHIFT_START_MIN.afternoon) {
    return windowFromStart('day', date, date, minutes, true);
  }
  if (minutes >= SHIFT_START_MIN.afternoon && minutes < SHIFT_START_MIN.night) {
    return windowFromStart('afternoon', date, date, minutes, true);
  }
  if (minutes >= SHIFT_START_MIN.night) {
    return windowFromStart('night', date, date, minutes, true);
  }
  // 00:00 ~ 06:00 = 전날 시작 야간
  const startDate = addDays(date, -1);
  return windowFromStart('night', startDate, date, minutes, true);
}

/** 방금 끝난 직전 교대 (완료 구간, partial=false) */
export function previousShiftWindow(now = new Date()): ShiftWindow {
  const { date, minutes } = kstNowParts(now);
  if (minutes >= SHIFT_START_MIN.day && minutes < SHIFT_START_MIN.afternoon) {
    // 주간 중 → 직전은 야간(어제 22~오늘 06)
    return windowFromStart('night', addDays(date, -1), date, 6 * 60, false);
  }
  if (minutes >= SHIFT_START_MIN.afternoon && minutes < SHIFT_START_MIN.night) {
    return windowFromStart('day', date, date, 14 * 60, false);
  }
  if (minutes >= SHIFT_START_MIN.night) {
    return windowFromStart('afternoon', date, date, 22 * 60, false);
  }
  // 00~06: 직전은 어제 오후(14~22)가 아니라, 야간이 아직 진행 중.
  // previous = 어제 오후 완료분
  const y = addDays(date, -1);
  return windowFromStart('afternoon', y, y, 22 * 60, false);
}

/**
 * 교대 전환 직후 AUTO_OPEN_MINUTES 안이면 직전 교대 창을 반환, 아니면 null
 * 경계: 06:00(야간 종료), 14:00(주간 종료), 22:00(오후 종료)
 */
export function autoHandoverWindow(now = new Date()): ShiftWindow | null {
  const { date, minutes } = kstNowParts(now);
  const edges: { at: number; build: () => ShiftWindow }[] = [
    {
      at: 6 * 60,
      build: () => windowFromStart('night', addDays(date, -1), date, 6 * 60, false),
    },
    {
      at: 14 * 60,
      build: () => windowFromStart('day', date, date, 14 * 60, false),
    },
    {
      at: 22 * 60,
      build: () => windowFromStart('afternoon', date, date, 22 * 60, false),
    },
  ];
  for (const e of edges) {
    if (minutes >= e.at && minutes < e.at + AUTO_OPEN_MINUTES) return e.build();
  }
  return null;
}

/** 샷·알림이 집계 구간에 들어가는지 */
export function inShiftWindow(date: string, time: string, win: ShiftWindow): boolean {
  const min = timeToMin(time);
  return win.segments.some(s => s.date === date && min >= s.fromMin && min < s.toMin);
}

/** 집계에 필요한 달력일 목록 */
export function datesInWindow(win: ShiftWindow): string[] {
  return [...new Set(win.segments.map(s => s.date))];
}
