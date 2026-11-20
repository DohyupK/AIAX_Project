/** 시세 구간·페이지(6개월) 날짜 계산 */

const MS_DAY = 86_400_000;

export function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = out.getDate();
  out.setDate(1);
  out.setMonth(out.getMonth() + months);
  const last = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
  out.setDate(Math.min(day, last));
  return out;
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * MS_DAY);
}

/** page 1 = 최신 6개월, page 2 = 그 이전 6개월 … */
export function pageWindow(
  maxIso: string,
  page: number,
): { from: string; to: string } {
  const max = parseIso(maxIso);
  const pageEnd = addMonths(max, -6 * (page - 1));
  const pageStart = addMonths(max, -6 * page);
  if (page === 1) {
    return { from: toIso(pageStart), to: toIso(max) };
  }
  return {
    from: toIso(pageStart),
    to: toIso(addDays(pageEnd, -1)),
  };
}

export function totalPages(minIso: string, maxIso: string): number {
  const min = parseIso(minIso).getTime();
  const max = parseIso(maxIso);
  let n = 0;
  let cursor = max;
  while (cursor.getTime() >= min) {
    n += 1;
    cursor = addMonths(cursor, -6);
    if (n > 200) break;
  }
  return Math.max(1, n);
}

export function monthsAgoIso(maxIso: string, months: number): string {
  return toIso(addMonths(parseIso(maxIso), -months));
}

export function cacheKey(from: string, to: string): string {
  return `${from}_${to}`;
}
