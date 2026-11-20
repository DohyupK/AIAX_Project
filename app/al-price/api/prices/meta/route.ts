import { NextResponse } from "next/server";

const SERVE = "http://127.0.0.1:8766";

export async function GET() {
  try {
    const upstream = await fetch(`${SERVE}/prices/meta`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
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
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "meta 연결 실패" },
      { status: 502 },
    );
  }
}
