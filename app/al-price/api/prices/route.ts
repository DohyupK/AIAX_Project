// Al 시세 프록시 — 브라우저 → Next → DH serve :8766 (nginx /api/ 와 분리)
import { NextRequest, NextResponse } from "next/server";

const SERVE = "http://127.0.0.1:8766";

export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get("limit") ?? "500";
  const url = `${SERVE}/prices?limit=${encodeURIComponent(limit)}`;
  try {
    const upstream = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") ?? "application/json; charset=utf-8",
      },
    });
  } catch (e) {
    const msg = (e as Error).message || "aluminum_price serve 연결 실패";
    return NextResponse.json(
      {
        ok: false,
        error: `시세 서버(:8766)에 연결하지 못했습니다. myapp al_price 창을 확인하세요. (${msg})`,
      },
      { status: 502 },
    );
  }
}
