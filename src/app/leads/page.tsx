import Link from "next/link";
import { Database, Download } from "lucide-react";
import { readState } from "@/lib/gh";
import AppShell from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

const TABLE_CAP = 500;

export default async function LeadsPage() {
  const state = await readState();
  const leads = state ? Object.values(state.leads) : [];
  const sites = state ? Object.values(state.sites) : [];

  const siteMap = new Map<string, { slug: string; status: string }>();
  for (const s of sites) {
    if (s.leadId) siteMap.set(s.leadId, { slug: s.slug, status: s.status });
  }

  const sorted = [...leads].sort((a, b) => b.score - a.score);
  const shown = sorted.slice(0, TABLE_CAP);

  return (
    <AppShell title="Leads" updatedAt={state?.updatedAt}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
            {sorted.length} total // TOP {shown.length} BY CONFIDENCE
          </p>
        </div>
        <button className="neon-btn-ghost" disabled title="CSV export coming soon">
          <Download size={14} />
          Export
        </button>
      </div>

      <GlassCard label="Lead Registry" source={<span className="flex items-center gap-1.5"><Database size={12} /> SRC // LEAD_DB</span>}>
        {sorted.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-mono text-sm text-text-muted">No leads yet — initiate a scan mission.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-muted bg-bg-inset/40 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  <th className="px-5 py-3 font-normal">Name</th>
                  <th className="px-5 py-3 font-normal">Category</th>
                  <th className="px-5 py-3 font-normal">Contact</th>
                  <th className="px-5 py-3 text-right font-normal">Score</th>
                  <th className="px-5 py-3 text-right font-normal">Status</th>
                  <th className="px-5 py-3 text-right font-normal">Site</th>
                  <th className="px-5 py-3 text-right font-normal">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted/50 font-mono text-sm">
                {shown.map((lead) => {
                  const site = siteMap.get(lead.id);
                  return (
                    <tr key={lead.id} className="transition-colors hover:bg-accent-cyan/5">
                      <td className="px-5 py-3.5">
                        <Link href={`/leads/${lead.id}`} className="font-medium text-text-primary hover:text-accent-cyan">
                          {lead.name}
                        </Link>
                        <div className="font-mono text-xs text-text-muted">
                          {lead.street}, {lead.city} {lead.postcode}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="rounded-full border border-border-bright bg-bg-inset px-2.5 py-1 text-xs capitalize text-text-secondary">
                          {lead.category}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary">
                        <div>{lead.phone || <span className="text-text-muted/60">—</span>}</div>
                        <div className="text-xs">{lead.email || <span className="text-text-muted/60">—</span>}</div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium" style={{ color: scoreColor(lead.score) }}>
                        {lead.score}
                        {lead.reasons.length > 0 && (
                          <div className="text-[10px] font-normal text-text-muted">{lead.reasons.slice(0, 2).join(", ")}</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs">
                        {site ? (
                          <Link href={`/sites?slug=${site.slug}`} className="text-accent-cyan hover:underline">{site.slug}</Link>
                        ) : (
                          <span className="text-text-muted/50">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/leads/${lead.id}`} className="neon-btn-ghost !px-3 !py-1.5">View</Link>
                          {site && site.status === "deployed" && (
                            <Link href={`/sites?slug=${site.slug}`} className="neon-btn-primary !px-3 !py-1.5">Approve</Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </AppShell>
  );
}

function scoreColor(score: number): string {
  if (score >= 60) return "#34d399";
  if (score >= 40) return "#FBBF24";
  return "#FB7185";
}