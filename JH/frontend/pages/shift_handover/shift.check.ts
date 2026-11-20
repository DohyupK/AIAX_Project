// 교대 구간 자체 점검 — 실행: node JH/frontend/pages/shift_handover/shift.check.ts (Node 23.6+)
import assert from 'node:assert/strict';
import {
  addDays,
  autoHandoverWindow,
  currentShiftWindow,
  inShiftWindow,
  previousShiftWindow,
  timeToMin,
  windowFromStart,
} from './shift.ts';

// KST Date — 로컬이 KST가 아니어도 toLocale* Asia/Seoul 로 맞춤. 고정 시각은 UTC 오프셋으로 구성
function atKst(isoDate: string, hh: number, mm: number): Date {
  // Asia/Seoul = UTC+9 → UTC = 로컬 KST - 9h
  return new Date(`${isoDate}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+09:00`);
}

{
  assert.equal(timeToMin('6:00:00'), 360);
  assert.equal(timeToMin('14:00'), 840);
  assert.equal(timeToMin('22:30:00'), 1350);
  assert.equal(addDays('2026-11-20', 1), '2026-11-21');
  assert.equal(addDays('2026-11-20', -1), '2026-11-19');
}

// 주간 부분: 10:00 → 06~10
{
  const w = currentShiftWindow(atKst('2026-11-20', 10, 0));
  assert.equal(w.id, 'day');
  assert.equal(w.partial, true);
  assert.deepEqual(w.segments, [{ date: '2026-11-20', fromMin: 360, toMin: 600 }]);
  assert.ok(inShiftWindow('2026-11-20', '09:59:00', w));
  assert.ok(!inShiftWindow('2026-11-20', '10:00:00', w));
}

// 야간 자정 횡단 (진행 중 02:00)
{
  const w = currentShiftWindow(atKst('2026-11-21', 2, 0));
  assert.equal(w.id, 'night');
  assert.equal(w.partial, true);
  assert.deepEqual(w.segments, [
    { date: '2026-11-20', fromMin: 1320, toMin: 1440 },
    { date: '2026-11-21', fromMin: 0, toMin: 120 },
  ]);
  assert.ok(inShiftWindow('2026-11-20', '23:00:00', w));
  assert.ok(inShiftWindow('2026-11-21', '01:30:00', w));
  assert.ok(!inShiftWindow('2026-11-21', '06:00:00', w));
}

// 완료 야간 (직전, 주간 시작 직후)
{
  const w = previousShiftWindow(atKst('2026-11-21', 6, 15));
  assert.equal(w.id, 'night');
  assert.equal(w.partial, false);
  assert.deepEqual(w.segments, [
    { date: '2026-11-20', fromMin: 1320, toMin: 1440 },
    { date: '2026-11-21', fromMin: 0, toMin: 360 },
  ]);
}

// 자동 팝업 창
{
  assert.ok(autoHandoverWindow(atKst('2026-11-20', 14, 0)));
  assert.ok(autoHandoverWindow(atKst('2026-11-20', 14, 29)));
  assert.equal(autoHandoverWindow(atKst('2026-11-20', 14, 30)), null);
  const nightEnd = autoHandoverWindow(atKst('2026-11-21', 6, 5));
  assert.ok(nightEnd);
  assert.equal(nightEnd!.id, 'night');
  assert.equal(autoHandoverWindow(atKst('2026-11-20', 10, 0)), null);
}

// windowFromStart 주간 완료
{
  const w = windowFromStart('day', '2026-11-20', '2026-11-20', 14 * 60, false);
  assert.deepEqual(w.segments, [{ date: '2026-11-20', fromMin: 360, toMin: 840 }]);
  assert.equal(w.key, 'day|2026-11-20|06:00');
}

console.log('shift.check OK');
