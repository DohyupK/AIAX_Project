// Al 시세 조회 — same-origin /api/al-price → Next rewrite → serve :8766

const FETCH_MS = 15_000;

export interface AlPriceRow {
  price_date: string;
  price: number;
}

export async function fetchAlPrices(limit = 500): Promise<AlPriceRow[]> {
  const res = await fetch(`/api/al-price/prices?limit=${limit}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `시세 조회 실패 (HTTP ${res.status})`);
  }
  const data = (await res.json()) as {
    ok?: boolean;
    rows?: AlPriceRow[];
    error?: string;
  };
  if (!data.ok) {
    throw new Error(data.error || "시세 조회 실패");
  }
  return data.rows ?? [];
}
