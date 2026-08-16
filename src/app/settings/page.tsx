export const dynamic = "force-dynamic";

import { ScanSearch, Contact2, Zap, GitBranch, Check, RotateCcw, AlertTriangle } from "lucide-react";
import { readState } from "@/lib/gh";
import AppShell from "@/components/AppShell";
import { GlassCard, StatTile } from "@/components/GlassCard";

export default async function SettingsPage() {
  const state = await readState();
  const settings = state?.settings;

  if (!settings) {
    return (
      <AppShell title="Settings">
        <GlassCard label="System Settings">
          <div className="p-8 text-center font-mono text-sm text-text-muted">
            No state file found yet. The agent will create one on first run.
          </div>
        </GlassCard>
      </AppShell>
    );
  }

  return (
    <AppShell title="System Settings" updatedAt={state?.updatedAt}>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Scan Area" value={<span className="font-mono text-sm font-medium leading-snug text-text-primary">{settings.scanArea}</span>} icon={<ScanSearch size={20} strokeWidth={1.6} />} accent="cyan" source="SRC // CFG" />
        <StatTile label="Radius" value={<span className="font-mono text-3xl font-bold text-text-primary">{settings.radiusKm}<span className="text-lg text-text-muted">km</span></span>} icon={<ScanSearch size={20} strokeWidth={1.6} />} accent="violet" source="SRC // CFG" />
        <StatTile label="Min Score" value={<span className="font-mono text-3xl font-bold text-text-primary">{settings.minScore}</span>} icon={<ScanSearch size={20} strokeWidth={1.6} />} accent="amber" source="SRC // CFG" />
        <StatTile label="Auto Scan" value={<span className={`font-mono text-3xl font-bold ${settings.autoScanEnabled ? "text-accent-emerald" : "text-text-muted"}`}>{settings.autoScanEnabled ? "ON" : "OFF"}</span>} icon={<Zap size={20} strokeWidth={1.6} />} accent="emerald" source="SRC // AGENT" />
      </section>

      <div className="mt-6 space-y-6">
        <GlassCard label="Scan Configuration" source="SRC // AGENT_CFG">
          <div className="divide-y divide-border-muted/60">
            <SettingRow label="Scan Center (lat,lng)">{settings.scanArea}</SettingRow>
            <SettingRow label="Radius (km)">{settings.radiusKm}</SettingRow>
            <SettingRow label="Min Score">{settings.minScore}</SettingRow>
            <SettingRow label="Last Scan">{settings.lastScanAt ? new Date(settings.lastScanAt).toLocaleString() : "—"}</SettingRow>
            {settings.lastManualScan && (
              <SettingRow label="Last Manual Scan">
                {settings.lastManualScan.label} — {settings.lastManualScan.added} added / {settings.lastManualScan.found} found
                {settings.lastManualScan.ok ? "" : " (failed)"}
              </SettingRow>
            )}
          </div>
        </GlassCard>

        <GlassCard label="Outreach Identity" source="SRC // MAILER">
          <div className="divide-y divide-border-muted/60">
            <SettingRow label="Your Name">{settings.yourName}</SettingRow>
            <SettingRow label="Your Business">{settings.yourBusiness}</SettingRow>
            <SettingRow label="Owner Email" mono>{settings.ownerEmail}</SettingRow>
          </div>
        </GlassCard>

        <GlassCard label="Automation" source="SRC // SYSTEMD">
          <div className="divide-y divide-border-muted/60">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-text-primary">Auto Scan Enabled</p>
                <p className="mt-1 text-sm text-text-muted">Run scan → build → deploy automatically on the agent</p>
              </div>
              <div className={`relative h-6 w-11 rounded-full transition-colors ${settings.autoScanEnabled ? "bg-accent-emerald/40" : "bg-bg-inset"}`}>
                <span className={`absolute top-0.5 inline-block h-5 w-5 rounded-full transition-all ${settings.autoScanEnabled ? "left-[22px] bg-accent-emerald" : "left-0.5 bg-text-muted"}`}
                  style={settings.autoScanEnabled ? { boxShadow: "0 0 8px rgba(52,211,153,0.6)" } : {}} />
              </div>
            </div>
            <SettingRow label="Scan Interval (minutes)">{settings.scanIntervalMinutes}</SettingRow>
          </div>
        </GlassCard>

        <GlassCard label="GitHub Sync" source="SRC // OCTOKIT">
          <div className="divide-y divide-border-muted/60">
            <InfoRow label="State Repository" mono>{process.env.NEXT_PUBLIC_GH_REPO ?? "leadfinder-state"}</InfoRow>
            <InfoRow label="Branch" mono>main</InfoRow>
          </div>
        </GlassCard>

        <div className="flex items-center gap-3">
          <button className="neon-btn-primary">
            <Check size={14} />
            Apply Config
          </button>
          <button className="neon-btn-ghost">
            <RotateCcw size={14} />
            Reset
          </button>
        </div>

        <div className="rounded-xl border border-accent-amber/30 bg-accent-amber/5 p-6">
          <h3 className="flex items-center gap-2 font-mono text-sm font-semibold uppercase tracking-widest text-accent-amber">
            <AlertTriangle size={16} /> Danger Zone
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            Erase all locally-stored data on the agent. This cannot be undone.
          </p>
          <button className="mt-4 neon-btn-danger">
            <RotateCcw size={14} />
            Erase All Data
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function SettingRow({ label, value, mono, children }: { label: string; value?: string; mono?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <label className="font-mono text-xs uppercase tracking-widest text-text-muted">{label}</label>
      <span className={`text-right text-sm ${mono ? "font-mono text-accent-cyan" : "text-text-primary"}`}>{value ?? children}</span>
    </div>
  );
}

function InfoRow({ label, mono, children }: { label: string; mono?: boolean; children: React.ReactNode }) {
  return (
    <div className="px-6 py-4">
      <label className="font-mono text-xs uppercase tracking-widest text-text-muted">{label}</label>
      <p className={`mt-1 break-all text-sm ${mono ? "font-mono text-accent-cyan" : "text-text-primary"}`}>{children}</p>
    </div>
  );
}