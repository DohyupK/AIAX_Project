/**
 * 인수인계 리포트 집계 — 기존 casting API + alerts/inspection 재사용 (신규 서버 API 없음)
 * 경보(alarm)만 · 전체 불량(final = 1차+2차) · 라인 1~3
 */
import { buildAlertCards, type AlertCard } from '../../common/casting/alerts';
import { LABELS } from '../../common/casting/analysis';
import {
  LINES,
  fetchLimits,
  fetchMlModel,
  fetchSecond,
  fetchShots,
  type Line,
} from '../../common/casting/api';
import type { SecondResult, Shot } from '../../common/casting/types';
import { summarize, type InspectionSummary } from '../quality_inspection/inspection';
import { datesInWindow, inShiftWindow, type ShiftWindow } from './shift';

export interface LineHandover {
  line: Line;
  shots: number;
  defects: InspectionSummary;
  alarms: AlertCard[];
}

export interface HandoverReport {
  window: ShiftWindow;
  lines: LineHandover[];
  totalShots: number;
  totalDefects: number;
  totalFirst: number;
  totalSecond: number;
  totalAlarms: number;
  /** 집계 시각 (KST 표시용) */
  builtAt: string;
}

function filterShots(shots: Shot[], date: string, win: ShiftWindow): Shot[] {
  return shots.filter(s => inShiftWindow(date, s.time, win));
}

function filterAlarms(cards: AlertCard[], win: ShiftWindow): AlertCard[] {
  return cards.filter(c => c.grade === 'alarm' && inShiftWindow(c.date, c.time, win));
}

async function lineReport(line: Line, win: ShiftWindow, th: number): Promise<LineHandover> {
  const dates = datesInWindow(win);
  const [limits, ...dayLoads] = await Promise.all([
    fetchLimits(line).catch(() => null),
    ...dates.map(async date => {
      const [shots, second] = await Promise.all([
        fetchShots(line, date, true),
        fetchSecond(line, date).catch(() => null),
      ]);
      return { date, shots, second };
    }),
  ]);

  const windowShots: Shot[] = [];
  const results = new Map<string, SecondResult>();
  const alarms: AlertCard[] = [];

  for (const day of dayLoads) {
    for (const r of day.second?.results ?? []) results.set(r.castingId, r);
    windowShots.push(...filterShots(day.shots, day.date, win));
    // 알림 판정은 하루 전체 순서 유지 후 구간·경보만 필터 (런/EWMA 상태)
    if (limits) {
      const cards = buildAlertCards(day.shots, limits, day.date, LABELS);
      alarms.push(...filterAlarms(cards, win));
    }
  }

  alarms.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.shotId - b.shotId);
  const defects = summarize(windowShots, th, results);
  return { line, shots: windowShots.length, defects, alarms };
}

/** 교대 창에 대해 3라인 집계. JH API(127.0.0.1:8000) 필요 */
export async function buildHandoverReport(win: ShiftWindow): Promise<HandoverReport> {
  const ml = await fetchMlModel();
  const th = ml.threshold;
  const lines = await Promise.all(LINES.map(line => lineReport(line, win, th)));
  const builtAt = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  return {
    window: win,
    lines,
    totalShots: lines.reduce((n, l) => n + l.shots, 0),
    totalDefects: lines.reduce((n, l) => n + l.defects.final, 0),
    totalFirst: lines.reduce((n, l) => n + l.defects.first, 0),
    totalSecond: lines.reduce((n, l) => n + l.defects.second, 0),
    totalAlarms: lines.reduce((n, l) => n + l.alarms.length, 0),
    builtAt,
  };
}
