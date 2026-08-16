export const dynamic = "force-dynamic";

import Link from "next/link";
import { Users, Globe, MessageSquare, Radar, ArrowRight, Activity } from "lucide-react";
import { readState } from "@/lib/gh";
import AppShell from "@/components/AppShell";
import { GlassCard, StatTile } from "@/components/GlassCard";
import { StatusBadge, SourceTag } from "@/components/StatusBadge";

export default async function DashboardPage() {
  const state = await readState();
  const leads = state ? Object.values(state.leads) : [];
  const sites = state ? Object.values(state.sites) : [];
  const replies = state ? state.replies : [];

  const statusCounts: Record<string, number> = { new: 0, building: 0, built: 0, deployed: 0, approved: 0, pitched: 0, interested: 0, rejected: 0 };
  for (const l of leads) statusCounts[l.status] = (statusCounts[l.status] ?? 0) + 1;

  const stats = {
    totalLeads: leads.length,
    newLeads: leads.filter((l) => l.status === "new").length,
    builtSites: sites.filter((s) => s.status === "built" || s.status === "deployed" || s.status === "approved").length,
    deployedSites: sites.filter((s) => s.status === "deployed").length,
    approvedSites: sites.filter((s) => s.status === "approved").length,
    positiveReplies: replies.filter((r) => r.positive).length,
    lastScan: state?.settings?.lastManualScan,
    scanArea: state?.settings?.scanArea ?? "—",
  };

  const scanRegion = state?.settings?.scanArea ?? "—";
  const recentLeads = [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);

  return (
    <AppShell title="Overview" updatedAt={state?.updatedAt}>
      {/* Stat tiles */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Leads"
          value={<span className="font-mono text-3xl font-bold text-text-primary">{stats.totalLeads}</span>}
          sub={`+${stats.newLeads} new this cycle`}
          icon={<Users size={20} strokeWidth={1.6} />}
          source="SRC // DB_LEADS"
        />
        <StatTile
          label="Websites Built"
          value={<span className="font-mono text-3xl font-bold text-text-primary">{stats.builtSites}</span>}
          sub={`${stats.deployedSites} deployed`}
          icon={<Globe size={20} strokeWidth={1.6} />}
          accent="emerald"
          source="SRC // SYS_GEN"
        />
        <StatTile
          label="Replies"
          value={<span className="font-mono text-3xl font-bold text-text-primary">{replies.length}</span>}
          sub={`${stats.positiveReplies} positive`}
          icon={<MessageSquare size={20} strokeWidth={1.6} />}
          accent="amber"
          source="SRC // INBOX_SYNC"
        />
        <StatTile
          label="Scan Region"
          value={<span className="font-mono text-lg font-medium leading-tight text-text-primary">{recentRegion(stats.scanArea)}</span>}
          icon={<Radar size={20} strokeWidth={1.6} className="animate-spin" style={{ animationDuration: "8s" }} />}
          accent="violet"
          source="SRC // GEO_API"
        />
      </section>

      {/* Pipeline + Live activity */}
      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlassCard label="Pipeline" source={`VOL // ${stats.totalLeads} UNITS`} className="lg:col-span-2">
          <div className="p-6">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-bg-inset">
              {Object.entries(statusCounts).map(([status, count]) =>
                count > 0 ? (
                  <div
                    key={status}
                    title={`${status}: ${count}`}
                    style={{ width: `${(count / Math.max(stats.totalLeads, 1)) * 100}%`, backgroundColor: barColor(status) }}
                  />
                ) : null
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dotColor(status) }} />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                    {status} <span className="text-text-secondary">{count}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        <GlassCard label="Command Center">
          <div className="space-y-3 p-6">
            <QuickLink href="/scan" icon={<Radar size={18} />} title="LAUNCH SCAN MISSION" desc="Find businesses without a website" />
            <QuickLink href="/sites" icon={<Globe size={18} />} title="REVIEW PENDING SITES" desc={`${stats.deployedSites} awaiting approval`} />
            <QuickLink href="/replies" icon={<MessageSquare size={18} />} title="CHECK REPLIES" desc={`${stats.positiveReplies} positive replies`} />
          </div>
        </GlassCard>
      </section>

      {/* Recent leads */}
      <section className="mt-6">
        <GlassCard
          label="Recent Leads"
          source={<Link href="/leads" className="flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-text-muted transition-colors hover:text-accent-cyan">
            View All <ArrowRight size={12} />
          </Link>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-muted bg-bg-inset/40 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  <th className="px-5 py-3 font-normal">Name</th>
                  <th className="px-5 py-3 font-normal">Category</th>
                  <th className="px-5 py-3 font-normal">Score</th>
                  <th className="px-5 py-3 text-right font-normal">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted/50 font-mono text-sm">
                {recentLeads.map((lead) => (
                  <tr key={lead.id} className="transition-colors hover:bg-accent-cyan/5">
                    <td className="px-5 py-3.5">
                      <Link href={`/leads/${lead.id}`} className="font-medium text-text-primary hover:text-accent-cyan">
                        {lead.name}
                      </Link>
                      <div className="font-mono text-xs text-text-muted">{lead.city ?? "—"}, {lead.postcode ?? ""}</div>
                    </td>
                    <td className="px-5 py-3.5 capitalize text-text-secondary">{lead.category}</td>
                    <td className="px-5 py-3.5 font-medium" style={{ color: scoreColor(lead.score) }}>
                      {lead.score}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <StatusBadge status={lead.status} />
                    </td>
                  </tr>
                ))}
                {recentLeads.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center font-mono text-sm text-text-muted">
                      No leads yet. Initiate a scan mission.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </section>
    </AppShell>
  );
}

function QuickLink({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="group flex items-center gap-4 rounded-lg border border-border-muted/60 bg-bg-inset/40 p-4 transition-all hover:border-accent-cyan/40 hover:bg-accent-cyan/5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-bright text-accent-cyan group-hover:shadow-[0_0_12px_rgba(34,211,238,0.25)]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-mono text-xs uppercase tracking-widest text-text-primary">{title}</p>
        <p className="truncate text-sm text-text-muted">{desc}</p>
      </div>
      <ArrowRight size={16} className="ml-auto shrink-0 text-text-muted transition-colors group-hover:text-accent-cyan" />
    </Link>
  );
}

function barColor(status: string): string {
  return (
    {
      new: "#5B6478",
      building: "rgba(34,211,238,0.6)",
      built: "#22d3ee",
      deployed: "#34d399",
      approved: "#34d399",
      pitched: "#A78BFA",
      interested: "#34d399",
      rejected: "#FB7185",
    }[status] ?? "#5B6478"
  );
}

function dotColor(status: string): string {
  return (
    {
      new: "#5B6478",
      building: "#22d3ee",
      built: "#A78BFA",
      deployed: "#FBBF24",
      approved: "#34d399",
      pitched: "#A78BFA",
      interested: "#34d399",
      rejected: "#FB7185",
    }[status] ?? "#5B6478"
  );
}

function scoreColor(score: number): string {
  if (score >= 60) return "#34d399";
  if (score >= 40) return "#FBBF24";
  return "#FB7185";
}

function recentRegion(area: string): string {
  if (!area) return "—";
  if (area.includes(",")) {
    const [lat, lon] = area.split(",");
    return `@ ${Number(lat).toFixed(2)}, ${Number(lon).toFixed(2)}`;
  }
  return area;
}