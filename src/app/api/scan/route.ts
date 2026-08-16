import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { location, niche, radiusKm, minScore } = body as {
      location: string;
      niche?: string;
      radiusKm?: number;
      minScore?: number;
    };

    if (!location || !location.trim()) {
      return NextResponse.json({ ok: false, error: "Location is required" }, { status: 400 });
    }

    const agentUrl = process.env.LEADFINDER_AGENT_URL;
    if (!agentUrl) {
      return NextResponse.json(
        { ok: false, queued: false, error: "No agent URL configured (LEADFINDER_AGENT_URL). Start the agent + tunnel." },
        { status: 503 }
      );
    }

    // Forward to the laptop agent. The agent acknowledges the scan immediately
    // and runs it in the background; the dashboard then polls /api/state.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(`${agentUrl.replace(/\/+$/, "")}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "scan",
          location,
          niche,
          radiusKm: radiusKm ?? 3,
          minScore: minScore ?? 40,
          requestedBy: "dashboard",
          requestedAt: new Date().toISOString(),
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ ok: false, queued: false, error: json.error || `agent HTTP ${res.status}` }, { status: 502 });
    }

    // Agent responded with {ok:true, status:"queued"} immediately.
    return NextResponse.json({ ok: true, queued: true, status: json.status ?? "queued", location, niche }, { status: 200 });
  } catch (e: any) {
    const isAbort = e?.name === "AbortError";
    return NextResponse.json(
      { ok: false, queued: false, error: isAbort ? "Agent did not respond (timed out). It may be busy scanning." : e.message },
      { status: isAbort ? 504 : 500 }
    );
  }
}
