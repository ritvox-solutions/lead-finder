/**
 * Agent-side GitHub sync.
 * - writeState: push the full AppState snapshot as state.json to GitHub (or local fallback).
 * - pullActions: read actions.ndjson created by the dashboard's /api/approve endpoint,
 *   return parsed pending actions, and mark them consumed.
 *
 * Env: GITHUB_TOKEN (required for GitHub mode), GH_OWNER, GH_REPO, GH_BRANCH.
 */
import { Octokit } from "@octokit/rest";
import type { AppState, PendingAction } from "./types.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const GH_TOKEN = process.env.GITHUB_TOKEN;
const GH_OWNER = process.env.GH_OWNER ?? "anikethanshetty";
const GH_REPO = process.env.GH_REPO ?? "leadfinder-state";
const GH_BRANCH = process.env.GH_BRANCH ?? "main";
// || (not ??) so an empty-string env var falls back to the default path.
const STATE_FILE = process.env.LEADFINDER_STATE_FILE || ".data/agent-state.json";
const STATE_PATH = "state.json";
const ACTIONS_PATH = "actions.ndjson";

const STATE_DIR = join(process.cwd(), ".data");

function gh(): Octokit | null {
  if (!GH_TOKEN) return null;
  return new Octokit({ auth: GH_TOKEN });
}

async function ensureRepo() {
  const client = gh();
  if (!client) return false;
  try {
    await client.rest.repos.get({ owner: GH_OWNER, repo: GH_REPO });
    return true;
  } catch (e: any) {
    if (e.status === 404) {
      // Create the repo
      await client.rest.repos.createForAuthenticatedUser({
        name: GH_REPO,
        private: true,
        description: "LeadFinder runtime state sync (between dashboard + laptop agent)",
        auto_init: true,
      });
      await new Promise((r) => setTimeout(r, 2000));
      return true;
    }
    return false;
  }
}

export async function writeState(state: AppState): Promise<string> {
  const client = gh();
  if (!client) {
    // Local fallback
    try {
      if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
    } catch {}
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
    return "";
  }

  await ensureRepo();
  const content = Buffer.from(JSON.stringify(state, null, 2), "utf8").toString("base64");

  try {
    // Try update (file may exist)
    const existing = await client.rest.repos.getContent({
      owner: GH_OWNER,
      repo: GH_REPO,
      path: STATE_PATH,
      ref: GH_BRANCH,
    });
    const sha = (existing.data as { sha: string }).sha;
      await client.rest.repos.createOrUpdateFileContents({
        owner: GH_OWNER,
        repo: GH_REPO,
        path: STATE_PATH,
        message: `chore: sync state ${state.updatedAt}`,
        content,
        sha,
        branch: GH_BRANCH,
      });
    return "";
  } catch (e: any) {
    if (e.status === 404) {
        // Create new
        await client.rest.repos.createOrUpdateFileContents({
        owner: GH_OWNER,
        repo: GH_REPO,
        path: STATE_PATH,
        message: `chore: init state`,
        content,
        branch: GH_BRANCH,
      });
      return "";
    }
    throw e;
  }
}

export async function readState(): Promise<AppState | null> {
  const client = gh();
  if (client) {
    try {
      const res = await client.rest.repos.getContent({
        owner: GH_OWNER,
        repo: GH_REPO,
        path: STATE_PATH,
        ref: GH_BRANCH,
      });
      const content = Buffer.from(
        (res.data as { content: string }).content,
        "base64"
      ).toString("utf8");
      return JSON.parse(content) as AppState;
    } catch (e: any) {
      console.warn("[agent] GitHub read failed, using local:", e.status ?? e.message);
    }
  }
  // Local fallback
  try {
    const raw = readFileSync(STATE_FILE, "utf8");
    return JSON.parse(raw) as AppState;
  } catch {
    return null;
  }
}

export interface PulledAction extends PendingAction {
  fileSha: string | null;
}

/**
 * Read pending actions from actions.ndjson — BOTH the local file and GitHub.
 *
 * The dashboard writes actions through one of two transports depending on its
 * own token: GitHub (write-capable token) or the agent's HTTP /action endpoint
 * (which appends to the local file). Either can hold pending actions at any
 * time, so we merge both sources instead of preferring one and silently
 * dropping the other — otherwise a click "does nothing" on the agent side.
 */
export async function pullActions(): Promise<PendingAction[]> {
  const client = gh();
  const localActions = join(STATE_DIR, "actions.ndjson");
  const out: PendingAction[] = [];

  // 1. Local file (written by the agent's own HTTP /action handler).
  if (existsSync(localActions)) {
    try {
      const text = readFileSync(localActions, "utf8");
      out.push(...parseActions(text));
      // Clear consumed
      writeFileSync(localActions, "", "utf8");
    } catch (e: any) {
      console.warn("[agent] local pullActions failed:", e.message);
    }
  }

  // 2. GitHub (written by the dashboard's appendAction when its token can write).
  if (client) {
    try {
      const res = await client.rest.repos.getContent({
        owner: GH_OWNER,
        repo: GH_REPO,
        path: ACTIONS_PATH,
        ref: GH_BRANCH,
      });
      const text = Buffer.from(
        (res.data as { content: string }).content,
        "base64"
      ).toString("utf8");
      const sha = (res.data as { sha: string }).sha;
      // Clear the file after reading (consume).
      await client.rest.repos.createOrUpdateFileContents({
        owner: GH_OWNER,
        repo: GH_REPO,
        path: ACTIONS_PATH,
        message: "chore: consume actions",
        content: Buffer.from("", "utf8").toString("base64"),
        sha,
        branch: GH_BRANCH,
      });
      out.push(...parseActions(text));
    } catch (e: any) {
      if (e.status !== 404) {
        console.warn("[agent] GitHub pullActions failed:", e.status ?? e.message);
      }
    }
  }

  return out;
}

function parseActions(text: string): PendingAction[] {
  const out: PendingAction[] = [];
  for (const line of text.split("\n").filter((l) => l.trim())) {
    try {
      out.push(JSON.parse(line) as PendingAction);
    } catch {}
  }
  return out;
}
