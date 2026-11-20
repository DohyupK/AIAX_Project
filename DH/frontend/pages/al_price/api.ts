// Al 시세 — /al-price/api/prices(+meta/csv) → serve :8766

const FETCH_MS = 20_000;

export interface AlPriceRow {
  price_date: string;
  price: number;
}

export interface AlPriceMeta {
  min_date: string | null;
  max_date: string | null;
  count: number;
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `시세 조회 실패 (HTTP ${res.status})`);
  }
  return (await res.json()) as T;
}

export async function fetchMeta(): Promise<AlPriceMeta> {
  const res = await fetch("/al-price/api/prices/meta", {
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_MS),
  });
  const data = await readJson<{
    ok?: boolean;
    error?: string;
    min_date?: string | null;
    max_date?: string | null;
    count?: number;
  }>(res);
  if (!data.ok) throw new Error(data.error || "meta 실패");
  return {
    min_date: data.min_date ?? null,
    max_date: data.max_date ?? null,
    count: data.count ?? 0,
  };
}

export async function fetchRange(
  from: string,
  to: string,
): Promise<AlPriceRow[]> {
  const q = new URLSearchParams({ from, to });
  const res = await fetch(`/al-price/api/prices?${q}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_MS),
  });
  const data = await readJson<{
    ok?: boolean;
    rows?: AlPriceRow[];
    error?: string;
  }>(res);
  if (!data.ok) throw new Error(data.error || "구간 조회 실패");
  return data.rows ?? [];
}

/** 전체 CSV 다운로드 (브라우저 저장) */
export async function downloadCsv(): Promise<void> {
  const res = await fetch("/al-price/api/prices/csv", {
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `CSV 다운로드 실패 (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "aluminum_price_all.csv";
  a.click();
  URL.revokeObjectURL(url);
}
