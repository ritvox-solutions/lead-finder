import { readState, fetchWithTimeout } from "@/lib/gh";
import type { AppState } from "@/lib/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // Prefer the live agent endpoint when configured: it holds in-memory
    // scanProgress for the mission console and the freshest local state.
    const agentUrl = process.env.LEADFINDER_AGENT_URL;
    if (agentUrl) {
      try {
        const res = await fetchWithTimeout(`${agentUrl.replace(/\/+$/, "")}/state`);
        if (res.ok) {
          const live = (await res.json()) as AppState;
          return NextResponse.json(live);
        }
      } catch {
        /* agent not reachable — fall through to GitHub */
      }
    }

    const state = await readState();
    if (!state) {
      return NextResponse.json({ error: "No state found" }, { status: 404 });
    }
    return NextResponse.json(state);
  } catch (e: any) {
    console.error("[api/state] read error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}