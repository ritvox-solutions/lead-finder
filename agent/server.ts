/**
 * Tiny HTTP server for the laptop agent.
 *
 * Serves the live state snapshot (so the Vercel dashboard can fetch it when
 * GitHub write access isn't available), and accepts approve/reject actions
 * from the dashboard's /api/approve route (which then gets picked up by the
 * agent loop on its next cycle).
 *
 * Start: AGENT_PORT=8090 npx tsx agent/index.ts
 *
 * This is only needed if your GitHub token can READ but not WRITE (so GitHub
 * can't be the state transport). If you later grant a token Write access to the
 * repo, set GITHUB_TOKEN with write scope and the HTTP server becomes optional.
 */
import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import type { AppState } from "./types.js";
import { readState as loadState } from "./gh.js";
import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { performScan, type ScanPayload, type ScanSummary } from "./scan.js";
import { buildState, saveLocalState } from "./state.js";
import type { ManualScanInfo } from "./types.js";

const PORT = Number(process.env.AGENT_PORT ?? 0); // 0 = disabled
const STATE_DIR = join(process.cwd(), ".data");
const ACTIONS_FILE = join(STATE_DIR, "actions.ndjson");

let latestState: AppState | null = null;

function toManualScanInfo(payload: ScanPayload, summary: ScanSummary): ManualScanInfo {
  return {
    location: payload.location,
    niche: payload.niche ?? "",
    radiusKm: payload.radiusKm ?? 3,
    found: summary.found,
    added: summary.added,
    label: summary.label,
    coords: summary.coords,
    source: summary.source,
    at: new Date().toISOString(),
    ok: summary.ok,
    error: summary.error,
  };
}

/** Run a manual scan in the background, then refresh + persist the state so the
 * dashboard picks up new leads. Called from the /action handler. */
async function runManualScan(payload: ScanPayload): Promise<ScanSummary | null> {
  try {
    const summary = await performScan(payload);
    const fresh = await buildState();
    fresh.settings.lastManualScan = toManualScanInfo(payload, summary);
    saveLocalState(fresh);
    setState(fresh);
    return summary;
  } catch (e: any) {
    console.warn("[agent] runManualScan failed:", e.message);
    // Still try to mark the scan as failed so the dashboard stops polling.
    try {
      const fresh = await buildState();
      fresh.settings.lastManualScan = {
        location: payload.location,
        niche: payload.niche ?? "",
        radiusKm: payload.radiusKm ?? 3,
        found: 0,
        added: 0,
        label: payload.location,
        coords: null,
        source: "error",
        at: new Date().toISOString(),
        ok: false,
        error: e.message,
      };
      saveLocalState(fresh);
      setState(fresh);
    } catch {}
    return null;
  }
}

export function setState(state: AppState | null) {
  latestState = state;
}

export function getState(): AppState | null {
  return latestState;
}

export function startAgentServer(): Server | null {
  if (!PORT) return null;
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    // CORS so the Vercel dashboard can fetch directly from your laptop.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/state") {
      // Serve the in-memory snapshot when available. Before the first cycle
      // finishes, latestState is null — fall back to a fresh snapshot built
      // from the Postgres DB (source of truth) so we never 404 in that window.
      let state = latestState;
      if (!state) state = await buildState().catch(() => null);
      if (!state) state = await loadState().catch(() => null);
      // Overlay live scan progress (kept in memory) so the dashboard console
      // can render the scan as it advances, even before the cycle refreshes.
      const { getScanProgress } = await import("./progress.js");
      const fresh: AppState | null = state
        ? { ...state, scanProgress: getScanProgress() ?? state.scanProgress ?? null }
        : null;
      res.writeHead(fresh ? 200 : 404, { "Content-Type": "application/json" });
      res.end(JSON.stringify(fresh));
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, updated: latestState?.updatedAt ?? "never" }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/action") {
      let body = "";
      for await (const chunk of req) body += chunk.toString();
      const action = JSON.parse(body);
      try {
        if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });

        // On-demand scan actions run immediately in the background (so the
        // dashboard gets a quick ack and polls /state for results), and are NOT
        // appended to actions.ndjson to avoid the main loop re-running them.
        if (action && action.action === "scan") {
          runManualScan({
            location: action.location,
            niche: action.niche,
            radiusKm: action.radiusKm,
            minScore: action.minScore,
          }).catch((e: any) => console.warn("[agent] background scan failed:", e.message));
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, status: "queued", location: action.location, niche: action.niche }));
          return;
        }

        // approve/reject actions are queued for the next loop cycle.
        appendFileSync(
          ACTIONS_FILE,
          JSON.stringify({ ...action, receivedAt: new Date().toISOString() }) + "\n",
          "utf8"
        );

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });

  server.listen(PORT, () => {
    console.log(`[agent] HTTP server listening on :${PORT}`);
    console.log(`[agent] dashboard can proxy state via http://<your-laptop-ip>:${PORT}/state`);
  });
  return server;
}
