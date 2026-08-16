"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Radar,
  MapPin,
  Tag,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import type { ScanProgress, ManualScanInfo } from "@/lib/types";

const NICHE_SUGGESTIONS = [
  "gym", "fitness", "pub", "bar", "restaurant", "cafe", "coffee",
  "salon", "hairdresser", "beauty", "clinic", "doctor", "pharmacy",
  "plumber", "electrician", "car repair", "garage", "hotel", "bakery",
  "supermarket", "grocery", "clothes store", "jewelry", "electronics",
  "book store", "any",
];

const PRESETS = [
  { label: "ALPHA_LOCAL_SVC", location: "Yeshwanthpur, Bangalore", niche: "gym, salon, cafe", radiusKm: 3 },
  { label: "BETA_MED_TECH", location: "Indiranagar, Bangalore", niche: "clinic, pharmacy", radiusKm: 5 },
];

const STAGE_META: Record<ScanProgress["stage"], { label: string; color: string }> = {
  geocoding: { label: "GEOCODING", color: "#22d3ee" },
  querying: { label: "QUERYING OVERPASS", color: "#22d3ee" },
  filtering: { label: "FILTERING NO-WEBSITE", color: "#a78bfa" },
  enriching: { label: "ENRICHING CONTACTS", color: "#a78bfa" },
  scoring: { label: "SCORING LEADS", color: "#fbbf24" },
  writing: { label: "WRITING LEADS", color: "#fbbf24" },
  done: { label: "MISSION COMPLETE", color: "#34d399" },
  error: { label: "MISSION FAILED", color: "#fb7185" },
};

export function ScanConsole({
  initialProgress,
  initialScan,
}: {
  initialProgress: ScanProgress | null;
  initialScan: ManualScanInfo | null;
}) {
  const [location, setLocation] = useState(initialScan?.location || "Yeshwanthpur, Bangalore");
  const [niche, setNiche] = useState(initialScan?.niche || "");
  const [radiusKm, setRadiusKm] = useState(initialScan?.radiusKm || 3);
  const [minScore, setMinScore] = useState(60);

  const [progress, setProgress] = useState<ScanProgress | null>(initialProgress);
  const [phase, setPhase] = useState<"idle" | "starting" | "running" | "done" | "error">(
    initialProgress?.active ? "running" : initialProgress ? "done" : "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSeenAtRef = useRef<string | null>(initialScan?.at ?? null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  /* Poll for live progress while running. */
  const poll = useCallback(() => {
    stopPolling();
    tickRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/state", { next: { revalidate: 0 } });
        if (!res.ok) return;
        const state = await res.json();
        // Live progress object from the agent.
        if (state?.scanProgress && typeof state.scanProgress === "object") {
          setProgress(state.scanProgress);
          if (!state.scanProgress.active) {
            setPhase(state.scanProgress.stage === "done" ? "done" : "error");
            setError(state.scanProgress.error ?? null);
            stopPolling();
            return;
          }
        }
        // Completion fallback: detect lastManualScan advancing.
        const info = state?.settings?.lastManualScan;
        if (info?.at && info.at !== lastSeenAtRef.current) {
          lastSeenAtRef.current = info.at;
          if (!info.ok) {
            setPhase("error");
            setError(info.error ?? "Scan failed");
          } else {
            setPhase("done");
          }
          stopPolling();
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
  }, [stopPolling]);

  async function launch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setProgress(null);
    setPhase("starting");
    setElapsed(0);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, niche: niche || undefined, radiusKm, minScore }),
      });
      const json = await res.json();
      if (!json.ok) {
        setPhase("error");
        setError(json.error ?? "Failed to launch scan");
        return;
      }
      setPhase("running");
      poll();
    } catch (err: any) {
      setPhase("error");
      setError(err.message ?? "Network error starting scan");
    }
  }

  const running = phase === "running" || phase === "starting";
  const stage = progress?.stage;
  const meta = stage ? STAGE_META[stage] : null;
  const pct = progress?.percent ?? (phase === "starting" ? 2 : phase === "done" ? 100 : 0);
  const logs = progress?.logs ?? previousLogs(initialScan);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* LEFT: Mission config */}
      <div className="xl:col-span-4">
        <form onSubmit={launch} className="glass glass-panel flex h-full flex-col rounded-xl p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-widest text-text-primary">New Mission</h2>
            <span className="rounded border border-border-muted bg-bg-inset px-2 py-1 font-mono text-[10px] text-text-secondary">CFG_SEQ_01</span>
          </div>

          <div className="flex flex-1 flex-col gap-6">
            <div className="space-y-2">
              <label className="label-caps flex items-center gap-1.5">
                <MapPin size={12} /> Target Sector (Location)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Austin, TX"
                required
                className="terminal-input"
                list="preset-locations"
              />
              <datalist id="preset-locations">
                {PRESETS.map((p) => <option key={p.location} value={p.location} />)}
              </datalist>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                <Tag size={12} /> Entity Classification (Niche)
              </label>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="gym, pub, restaurant"
                list="niche-suggestions"
                className="terminal-input"
              />
              <datalist id="niche-suggestions">
                {NICHE_SUGGESTIONS.map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">Sweep Radius</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="terminal-input pr-10 text-right"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-text-muted">KM</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">Min Confidence</label>
                <div className="flex h-[42px] flex-col justify-center">
                  <input type="range" min={20} max={80} step={5} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="h-1 w-full cursor-pointer appearance-none rounded-full bg-bg-inset accent-accent-cyan" />
                  <div className="mt-1 flex justify-between font-mono text-[10px] text-text-muted">
                    <span>20</span>
                    <span className="font-bold text-accent-cyan">{minScore}</span>
                    <span>80</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={running || !location.trim()}
            className={`neon-btn-primary mt-8 w-full !py-3.5 ${running ? "pointer-events-none opacity-60" : ""}`}
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Radar size={16} />}
            {running ? "Scan In Progress" : "Initiate Scan"}
          </button>

          <div className="mt-6 border-t border-border-muted pt-4">
            <h3 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-text-secondary">Saved Presets</h3>
            <div className="space-y-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { setLocation(p.location); setNiche(p.niche); setRadiusKm(p.radiusKm); }}
                  className="flex w-full items-center justify-between rounded-lg border border-transparent bg-bg-inset/40 px-3 py-2 font-mono text-xs text-text-primary transition-colors hover:border-border-muted hover:bg-bg-inset"
                >
                  {p.label}
                  <ArrowRight size={14} className="text-text-muted" />
                </button>
              ))}
            </div>
          </div>
        </form>

        {initialScan && (
          <div className="mt-4 rounded-xl border border-border-muted bg-bg-inset/40 p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">Last Mission Result</p>
            <div className="flex items-center gap-2 font-mono text-xs text-text-primary">
              {initialScan.ok ? <CheckCircle2 size={14} className="text-accent-emerald" /> : <XCircle size={14} className="text-accent-rose" />}
              <span>{initialScan.label}</span>
              <span className="text-text-muted">— {initialScan.found} found / {initialScan.added} added</span>
            </div>
            <p className="mt-1 font-mono text-[10px] text-text-muted">{new Date(initialScan.at).toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* Right: Live console */}
      <div className="xl:col-span-8">
        <div className="glass glass-panel relative flex h-full flex-col overflow-hidden rounded-xl">
          <div className="flex items-center justify-between border-b border-border-muted px-6 py-4">
            <div className="flex items-center gap-3">
              <span className={`h-2 w-2 animate-pulse rounded-full ${running ? "bg-accent-cyan" : phase === "done" ? "bg-accent-emerald" : "bg-text-muted"}`}
                style={{ boxShadow: running ? "0 0 8px rgba(34,211,238,0.8)" : phase === "done" ? "0 0 8px rgba(52,211,153,0.8)" : undefined }} />
              <h2 className="font-mono text-sm font-semibold uppercase tracking-widest text-text-primary">Live Scan Console</h2>
            </div>
            <span className="rounded border border-border-muted bg-bg-inset px-2 py-1 font-mono text-[10px] text-text-muted">SRC_OVERPASS.GEO</span>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-6 p-6 lg:grid-cols-2">
            {/* Radar */}
            <div className="relative flex flex-col items-center justify-center rounded-lg border border-border-muted/40 bg-bg-inset/30 p-6">
              <div className="relative flex h-56 w-56 items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-accent-cyan/20" style={{ boxShadow: "inset 0 0 30px rgba(34,211,238,0.06)" }} />
                <div className="absolute inset-[18%] rounded-full border border-accent-cyan/30" />
                <div className="absolute inset-[34%] rounded-full border border-accent-cyan/40" />
                <div className="absolute inset-[48%] rounded-full border border-accent-cyan/50" />
                <div className="absolute inset-y-1/2 left-0 w-full border-t border-accent-cyan/20" />
                <div className="absolute inset-x-1/2 top-0 h-full border-l border-accent-cyan/20" />
                {running && <div className="absolute left-1/2 top-1/2 h-1/2 w-1/2 origin-bottom-left" style={{ animation: "radar-sweep 3s linear infinite" }}>
                  <div className="h-full w-full rounded-tr-full border-r border-accent-cyan bg-gradient-to-br from-accent-cyan/40 to-transparent" />
                </div>}
                {running && <Blip className="left-[25%] top-[22%]" color="#34d399" />}
                {running && <Blip className="left-[68%] top-[60%]" color="#22d3ee" />}
                {running && <Blip className="left-[45%] top-[70%]" color="#fb7185" />}
                {!running && phase === "done" && (
                  <div className="flex flex-col items-center">
                    <CheckCircle2 size={40} className="text-accent-emerald" style={{ filter: "drop-shadow(0 0 12px rgba(52,211,153,0.6))" }} />
                    <span className="mt-2 font-mono text-[10px] uppercase tracking-widest text-accent-emerald">Complete</span>
                  </div>
                )}
                {!running && phase === "error" && (
                  <div className="flex flex-col items-center">
                    <XCircle size={40} className="text-accent-rose" />
                    <span className="mt-2 font-mono text-[10px] uppercase tracking-widest text-accent-rose">Error</span>
                  </div>
                )}
                {!running && phase === "idle" && (
                  <Radar size={48} className="text-text-muted/40" strokeWidth={1.2} />
                )}
              </div>
              <div className="mt-4 flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                <span className="text-accent-cyan">{meta?.label ?? "STANDBY"}</span>
              </div>
            </div>

            {/* Readout */}
            <div className="flex flex-col rounded-lg border border-border-muted bg-bg-inset/40 p-5">
              <div className="mb-4">
                <h3 className="label-caps mb-2">Current Operation</h3>
                <div className="font-mono text-lg font-medium text-accent-cyan">{meta?.label ?? "AWAITING COMMAND"}</div>
              </div>
              <div className="progress-bar mb-2">
                <div className="progress-bar-fill h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="mb-5 flex justify-between font-mono text-[10px] text-text-muted">
                <span>{pct}%</span>
                <span>{running ? `ELAPSED ${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}` : ""}</span>
              </div>

              <div className="flex flex-col gap-3 font-mono text-xs text-text-secondary">
                <Stat label="POI Records">{progress?.found ?? "—"}</Stat>
                <Stat label="No-Website">{progress?.noWebsite ?? "—"}</Stat>
                <Stat label="Enriched">{progress?.enriched ?? "—"}</Stat>
                <Stat label="Added">{progress?.added ?? "—"}</Stat>
              </div>
            </div>
          </div>

          {/* Terminal log */}
          <div className="border-t border-border-muted bg-[#0a0d14] p-5">
            <div className="mb-3 flex items-center justify-between border-b border-border-muted/60 pb-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-accent-cyan">&gt;_ SYS.LOG // OVERPASS_PROCESSOR</span>
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-border-bright" />
                <span className="h-1.5 w-1.5 rounded-full bg-border-bright" />
                <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan" style={{ boxShadow: "0 0 5px rgba(34,211,238,0.5)" }} />
              </span>
            </div>
            <div className="max-h-40 space-y-1.5 overflow-y-auto font-mono text-xs">
              {logs.length === 0 && (
                <div className="font-mono text-xs text-text-muted">// System ready. Awaiting scan command.</div>
              )}
              {logs.map((l, i) => (
                <div key={i} className="flex gap-3">
                  <span className="shrink-0 text-text-muted">[{l.time}]</span>
                  <span className="w-8 shrink-0" style={{ color: tagColor(l.tag) }}>{l.tag}</span>
                  <span className={l.tag === "ERR" ? "text-accent-rose" : "text-text-secondary"}>{l.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function previousLogs(scan: ManualScanInfo | null): { time: string; tag: "SYS" | "NET" | "BOT" | "OUT" | "ERR"; msg: string }[] {
  if (!scan) return [];
  return [
    { time: scan.at?.slice(11, 19) ?? "--", tag: "SYS", msg: `Mission for '${scan.label}' completed` },
    { time: "", tag: "BOT", msg: `${scan.found} found, ${scan.added} added${scan.ok ? "" : " (failed)"}` },
  ];
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border-muted/30 pb-2 last:border-0 last:pb-0">
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</span>
      <span className="font-mono text-sm font-medium text-text-primary">{children}</span>
    </div>
  );
}

function Blip({ className, color }: { className: string; color: string }) {
  return <div className={`absolute h-2 w-2 rounded-full ${className}`} style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />;
}

function tagColor(tag: string): string {
  return {
    SYS: "rgba(34,211,238,0.7)",
    NET: "rgba(251,191,36,0.7)",
    BOT: "rgba(167,139,250,0.7)",
    OUT: "rgba(52,211,153,0.7)",
    ERR: "#fb7185",
  }[tag] ?? "#9aa3b8";
}