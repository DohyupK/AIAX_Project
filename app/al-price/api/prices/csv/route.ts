import { NextResponse } from "next/server";

const SERVE = "http://127.0.0.1:8766";

export async function GET() {
  try {
    const upstream = await fetch(`${SERVE}/prices/csv`, {
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: text || `CSV 실패 HTTP ${upstream.status}` },
        { status: upstream.status },
      );
    }
    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="aluminum_price_all.csv"',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "CSV 연결 실패" },
      { status: 502 },
    );
  }
}
