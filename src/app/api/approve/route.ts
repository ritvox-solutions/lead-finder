import { appendAction } from "@/lib/gh";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, slug } = body as { action: "approve" | "reject" | "build"; slug: string };

    if (!action || !slug) {
      return NextResponse.json({ error: "action and slug required" }, { status: 400 });
    }

    if (!["approve", "reject", "build"].includes(action)) {
      return NextResponse.json({ error: "action must be approve, reject or build" }, { status: 400 });
    }

    // appendAction returns true only if it actually wrote to GitHub. When the
    // token is read-only (or GitHub is unreachable) it returns false — the
    // action must then be forwarded to the laptop agent's HTTP /action endpoint
    // so it actually reaches the agent instead of vanishing into an ephemeral
    // local file the agent never reads.
    const wroteToGithub = await appendAction({ action, slug, requestedBy: "dashboard" });

    if (!wroteToGithub) {
      const agentUrl = process.env.LEADFINDER_AGENT_URL;
      if (agentUrl) {
        const r = await fetch(`${agentUrl.replace(/\/+$/, "")}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, slug, requestedBy: "dashboard" }),
        });
        if (!r.ok) throw new Error(`agent returned ${r.status}`);
        return NextResponse.json({ ok: true, via: "agent" });
      }
      return NextResponse.json({ ok: true, via: "none" });
    }
    return NextResponse.json({ ok: true, via: "github" });
  } catch (e: any) {
    console.error("[api/approve] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}