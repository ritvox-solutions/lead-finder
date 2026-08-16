import { appendAction } from "@/lib/gh";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, slug } = body as { action: "approve" | "reject"; slug: string };

    if (!action || !slug) {
      return NextResponse.json({ error: "action and slug required" }, { status: 400 });
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
    }

    let wroteToGithub = false;
    try {
      await appendAction({ action, slug, requestedBy: "dashboard" });
      wroteToGithub = true;
    } catch (e) {
      console.warn("[api/approve] GitHub append failed, falling back to agent:", (e as Error).message);
    }

    // Fallback: forward the action to the laptop agent over HTTP (if configured).
    // The agent listens on /action and records it locally.
    if (!wroteToGithub) {
      const agentUrl = process.env.LEADFINDER_AGENT_URL;
      if (agentUrl) {
        const r = await fetch(`${agentUrl}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, slug, requestedBy: "dashboard" }),
        });
        if (!r.ok) throw new Error(`agent returned ${r.status}`);
        return NextResponse.json({ ok: true, via: "agent" });
      }
    }
    return NextResponse.json({ ok: true, via: wroteToGithub ? "github" : "local" });
  } catch (e: any) {
    console.error("[api/approve] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}