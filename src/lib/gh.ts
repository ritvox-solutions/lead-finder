import { Octokit } from "@octokit/rest";
import type { AppState } from "@/lib/types";
import { readNeonData, neonConfigured, withNeonData } from "@/lib/db";

const GH_TOKEN = process.env.GITHUB_TOKEN;
const GH_OWNER = process.env.GH_OWNER ?? "anikethanshetty";
const GH_REPO = process.env.GH_REPO ?? "leadfinder-state";
const STATE_PATH = "state.json";

// How long to wait on the live agent / state-url endpoints before giving up
// and falling back to GitHub. The agent sits behind a Cloudflare tunnel that
// can be slow or rotated away entirely; without a bound, a dead tunnel stalls
// every dashboard page (all pages are force-dynamic and call readState).
const FETCH_TIMEOUT_MS = Number(process.env.LEADFINDER_FETCH_TIMEOUT_MS ?? 2500);

if (!GH_TOKEN) {
  console.warn("[gh] GITHUB_TOKEN not set; GitHub sync disabled");
}

/** fetch() that aborts after FETCH_TIMEOUT_MS instead of hanging forever. */
export async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function client(): Octokit | null {
  if (!GH_TOKEN) return null;
  return new Octokit({ auth: GH_TOKEN });
}

export interface RepoInfo {
  owner: string;
  repo: string;
  branch: string;
  statePath: string;
}

export const repo: RepoInfo = {
  owner: GH_OWNER,
  repo: GH_REPO,
  branch: process.env.GH_BRANCH ?? "main",
  statePath: STATE_PATH,
};

/** Read + parse the current state file from GitHub. */
export async function readState(): Promise<AppState | null> {
  // 1. Get a base snapshot: the live agent endpoint when configured (freshest
  //    settings + in-memory scanProgress for the mission console), else GitHub.
  let state: AppState | null = null;
  const agentUrl = process.env.LEADFINDER_AGENT_URL;
  if (agentUrl) {
    try {
      const res = await fetchWithTimeout(`${agentUrl.replace(/\/+$/, "")}/state`);
      if (res.ok) state = (await res.json()) as AppState;
    } catch (e) {
      console.warn("[gh] agent proxy read failed:", (e as Error).message);
    }
  }

  if (!state) {
    // Try GitHub raw URL first (works when a readable state.json exists).
    try {
      const url = process.env.NEXT_PUBLIC_STATE_URL;
      if (url) {
        const res = await fetchWithTimeout(url);
        if (res.ok) state = (await res.json()) as AppState;
      }
    } catch (e) {
      console.warn("[gh] state-url read failed:", (e as Error).message);
    }
  }

  if (!state) {
    // Try GitHub API (private repo via token).
    const gh = client();
    if (gh) {
      try {
        const res = await gh.rest.repos.getContent({
          owner: repo.owner,
          repo: repo.repo,
          path: repo.statePath,
          ref: repo.branch,
        });
        const content = Buffer.from(
          (res.data as { content: string }).content,
          "base64"
        ).toString("utf8");
        state = JSON.parse(content) as AppState;
      } catch (e: any) {
        console.warn("[gh] GitHub read failed:", e.status ?? e.message);
      }
    }
  }

  // 2. When Neon is configured, overlay the authoritative data tables from
  //    Postgres so the dashboard never shows stale mirror data.
  if (neonConfigured() && state) {
    const neonData = await readNeonData();
    if (neonData) state = withNeonData(state, neonData);
  }

  return state;
}

/** Write the full state back to GitHub. Returns the new commit SHA. */
export async function writeState(state: AppState): Promise<string> {
  const gh = client();
  const blob = Buffer.from(JSON.stringify(state, null, 2), "utf8").toString("base64");
  const message = `chore: sync state ${new Date().toISOString().slice(0, 19)}`;

  if (!gh) {
    // Local fallback (agent on laptop)
    const { writeFileSync, mkdirSync } = await import("node:fs");
    try {
      mkdirSync(".data", { recursive: true });
    } catch {}
    writeFileSync(".data/state.json", JSON.stringify(state, null, 2), "utf8");
    return "";
  }

  // Create blob + commit + update ref (idempotent path)
  const blobRes = await gh.rest.git.createBlob({
    owner: repo.owner,
    repo: repo.repo,
    content: blob,
    encoding: "base64",
  });
  const sha = blobRes.data.sha;

  const branchRef = await gh.rest.git.getRef({
    owner: repo.owner,
    repo: repo.repo,
    ref: repo.branch,
  });
  const base = branchRef.data.object.sha;

  const tree = await gh.rest.git.createTree({
    owner: repo.owner,
    repo: repo.repo,
    base_tree: base,
    tree: [{ path: repo.statePath, mode: "100644", type: "blob", sha }],
  });

  const commit = await gh.rest.git.createCommit({
    owner: repo.owner,
    repo: repo.repo,
    message,
    tree: tree.data.sha,
    parents: [base],
  });

  await gh.rest.git.updateRef({
    owner: repo.owner,
    repo: repo.repo,
    ref: repo.branch,
    sha: commit.data.sha,
    force: true,
  });

  return commit.data.sha;
}

/**
 * Post a single pending action (approve/reject/build) for the agent to consume.
 *
 * Returns true if the action was written to GitHub (the token has write
 * access), false otherwise. The caller (POST /api/approve) uses this to decide
 * whether to also forward the action to the laptop agent over HTTP — otherwise
 * a read-only GitHub token would silently swallow the action into a local file
 * the agent never reads, and the click would "do nothing".
 */
export async function appendAction(action: {
  action: "approve" | "reject" | "build";
  slug: string;
  requestedBy: string;
}): Promise<boolean> {
  const line = JSON.stringify({ ...action, requestedAt: new Date().toISOString() }) + "\n";
  const actionsPath = "actions.ndjson";

  const gh = client();
  if (gh) {
    try {
      let sha: string | undefined;
      let existing = "";
      try {
        const res = await gh.rest.repos.getContent({
          owner: repo.owner,
          repo: repo.repo,
          path: actionsPath,
          ref: repo.branch,
        });
        sha = (res.data as { sha: string }).sha;
        existing = Buffer.from(
          (res.data as { content: string }).content,
          "base64"
        ).toString("utf8");
      } catch (e: any) {
        if (e.status !== 404) throw e;
      }

      const updated = existing + line;
      const blobRes = await gh.rest.git.createBlob({
        owner: repo.owner,
        repo: repo.repo,
        content: Buffer.from(updated, "utf8").toString("base64"),
        encoding: "base64",
      });

      const branchRef = await gh.rest.git.getRef({
        owner: repo.owner,
        repo: repo.repo,
        ref: repo.branch,
      });
      const base = branchRef.data.object.sha;

      const commit = await gh.rest.git.createCommit({
        owner: repo.owner,
        repo: repo.repo,
        message: `chore: action ${action.action} ${action.slug}`,
        tree: (
          await gh.rest.git.createTree({
            owner: repo.owner,
            repo: repo.repo,
            base_tree: base,
            tree: [{ path: actionsPath, mode: "100644", type: "blob", sha: blobRes.data.sha }],
          })
        ).data.sha,
        parents: [base],
      });

      await gh.rest.git.updateRef({
        owner: repo.owner,
        repo: repo.repo,
        ref: repo.branch,
        sha: commit.data.sha,
        force: true,
      });
      return true;
    } catch (e: any) {
      console.warn("[gh] GitHub append failed, falling back to agent HTTP:", e.status ?? e.message);
    }
  }
  // GitHub unavailable or read-only: do NOT write to a local file here — the
  // dashboard may be on Vercel where the filesystem is ephemeral. Signal the
  // caller to forward the action to the laptop agent's HTTP /action endpoint.
  return false;
}
