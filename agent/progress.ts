/**
 * In-memory live-progress store for the on-demand scan.
 *
 * `scan.ts` writes progress events here as the scan advances; `state.ts`
 * reads it when building the /state snapshot so the dashboard console can
 * render the mission live. Lives in its own module to avoid an import cycle
 * between scan.ts and state.ts.
 */
import type { ScanProgress, ScanLogLine, ScanProgressStage } from "./types.js";

let progress: ScanProgress | null = null;

function now(): string {
  return new Date().toISOString();
}

export function getScanProgress(): ScanProgress | null {
  return progress;
}

export function setScanProgress(p: ScanProgress | null): void {
  progress = p;
}

/** Start a new progress session for the given mission. */
export function startScanProgress(payload: { location: string; niche?: string; radiusKm?: number }): void {
  progress = {
    active: true,
    stage: "geocoding",
    operation: "GEOCODING REGION…",
    percent: 5,
    location: payload.location,
    niche: payload.niche ?? "",
    radiusKm: payload.radiusKm ?? 3,
    found: 0,
    noWebsite: 0,
    enriched: 0,
    added: 0,
    startedAt: now(),
    updatedAt: now(),
    logs: [],
  };
  pushScanLog("SYS", `Mission initialized — targeting '${payload.location}'`);
}

/** Advance the scan to a new stage and append a log line. */
export function advanceScanProgress(
  stage: ScanProgressStage,
  operation: string,
  percent: number,
  task?: (p: NonNullable<ScanProgress>) => void
): void {
  if (!progress || !progress.active) return;
  progress.stage = stage;
  progress.operation = operation;
  progress.percent = Math.max(0, Math.min(100, percent));
  progress.updatedAt = now();
  if (task) task(progress);
  syncLogs();
}

function syncLogs(): void {
  // cap log buffer so the /state payload stays small
  if (progress && progress.logs.length > 60) {
    progress.logs = progress.logs.slice(-60);
  }
}

export function pushScanLog(tag: ScanLogLine["tag"], msg: string): void {
  if (!progress) return;
  progress.logs.push({ time: now().slice(11, 19), tag, msg });
  progress.updatedAt = now();
  syncLogs();
}

export function finishScanProgress(ok: boolean, error?: string): void {
  if (!progress) return;
  progress.active = false;
  progress.stage = ok ? "done" : "error";
  progress.operation = ok ? "MISSION COMPLETE" : "MISSION FAILED";
  progress.updatedAt = now();
  if (!ok && error) {
    progress.error = error;
    pushScanLog("ERR", error);
  }
}

export function clearScanProgress(): void {
  progress = null;
}