import Link from "next/link";
import { Database, Download, Radar } from "lucide-react";
import { readState } from "@/lib/gh";
import { formatDateTime } from "@/lib/format";
import AppShell from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { StatusBadge } from "@/components/StatusBadge";
import { BuildSiteButton } from "@/components/BuildSiteButton";

export const dynamic = "force-dynamic";

const TABLE_CAP = 500;

export default async function LeadsPage() {
  const state = await readState();
  const leads = state ? Object.values(state.leads) : [];
  const sites = state ? Object.values(state.sites) : [];
  const scans = state?.scans ?? [];

  const siteMap = new Map<string, { slug: string; status: string }>();
  for (const s of sites) {
    if (s.leadId) siteMap.set(s.leadId, { slug: s.slug, status: s.status });
  }

  // Group leads by the scan that produced them. Leads without a scanId (e.g.
  // imported before scan-tracking existed) fall into a "legacy" bucket.
  const byScan = new Map<string, { name: string; leads: typeof leads }>();
  const legacy: typeof leads = [];
  for (const lead of leads) {
    if (lead.scanId && scans.some((s) => s.id === lead.scanId)) {
      const existing = byScan.get(lead.scanId) ?? { name: "", leads: [] };
      existing.leads.push(lead);
      byScan.set(lead.scanId, existing);
    } else {
      legacy.push(lead);
    }
  }
  for (const s of scans) {
    const bucket = byScan.get(s.id);
    if (bucket) bucket.name = s.label || s.location;
  }
  // Sort each bucket by score desc; order scans newest-first.
  for (const bucket of byScan.values()) {
    bucket.leads.sort((a, b) => b.score - a.score);
  }
  legacy.sort((a, b) => b.score - a.score);
  const orderedScans = [...byScan.entries()].sort((a, b) => {
    const atA = scans.find((s) => s.id === a[0])?.at ?? "";
    const atB = scans.find((s) => s.id === b[0])?.at ?? "";
    return atB.localeCompare(atA);
  });
  const totalShown = leads.length;

  return (
    <AppShell title="Leads" updatedAt={state?.updatedAt}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
            {totalShown} total // GROUPED BY SCAN ({scans.length} scans{legacy.length > 0 ? ` + ${legacy.length} legacy` : ""})
          </p>
        </div>
        <button className="neon-btn-ghost" disabled title="CSV export coming soon">
          <Download size={14} />
          Export
        </button>
      </div>

      {leads.length === 0 ? (
        <GlassCard label="Lead Registry" source={<span className="flex items-center gap-1.5"><Database size={12} /> SRC // LEAD_DB</span>}>
          <div className="p-12 text-center">
            <p className="font-mono text-sm text-text-muted">No leads yet — initiate a scan mission.</p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-10">
          {orderedScans.map(([scanId, bucket]) => {
            const scan = scans.find((s) => s.id === scanId);
            return (
              <section key={scanId}>
                <ScanHeader scan={scan} count={bucket.leads.length} />
                <LeadTable leads={bucket.leads.slice(0, TABLE_CAP)} siteMap={siteMap} />
              </section>
            );
          })}

          {legacy.length > 0 && (
            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-muted bg-bg-inset/40 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Radar size={14} className="text-text-muted" />
                  <div>
                    <div className="font-mono text-xs font-semibold uppercase tracking-widest text-text-primary">Legacy / Unassigned</div>
                    <div className="font-mono text-[10px] text-text-muted">Imported before scan-tracking existed</div>
                  </div>
                </div>
                <span className="font-mono text-xs text-text-muted">{legacy.length} leads</span>
              </div>
              <LeadTable leads={legacy.slice(0, TABLE_CAP)} siteMap={siteMap} />
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}

function ScanHeader({ scan, count }: { scan?: { label: string; location: string; niche: string; radiusKm: number; found: number; added: number; at: string; ok: boolean; source: string }; count: number }) {
  if (!scan) return null;
  const title = scan.label || scan.location;
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className={`h-2 w-2 rounded-full ${scan.ok ? "bg-accent-emerald" : "bg-accent-rose"}`} style={scan.ok ? { boxShadow: "0 0 8px rgba(52,211,153,0.7)" } : {}} />
        <div>
          <div className="font-mono text-sm font-bold uppercase tracking-widest text-text-primary">{title}</div>
          <div className="font-mono text-[10px] text-text-muted">
            {scan.location}
            {scan.niche ? ` // ${scan.niche}` : ""} · R{scan.radiusKm}km · {formatDateTime(scan.at)} · src {scan.source}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 font-mono text-xs text-text-muted">
        <span className="rounded border border-border-muted bg-bg-inset px-2 py-1">{count} shown</span>
        <span className="rounded border border-border-muted bg-bg-inset px-2 py-1">{scan.found} found</span>
        <span className="rounded border border-accent-emerald/25 bg-accent-emerald/5 px-2 py-1 text-accent-emerald">+{scan.added} new</span>
      </div>
    </div>
  );
}

function LeadTable({ leads, siteMap }: { leads: Array<{ id: string; name: string; category: string; phone: string | null; email: string | null; score: number; reasons: string[]; status: string; street: string | null; city: string | null; postcode: string | null }>; siteMap: Map<string, { slug: string; status: string }> }) {
  if (leads.length === 0) {
    return <p className="rounded-lg border border-border-muted/60 bg-bg-inset/30 p-6 font-mono text-xs text-text-muted">No leads in this scan.</p>;
  }
  return (
    <GlassCard label="Lead Registry" source={<span className="flex items-center gap-1.5"><Database size={12} /> SRC // LEAD_DB</span>}>
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
            {leads.map((lead) => {
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
                      {!site && lead.status === "new" && (
                        <BuildSiteButton leadId={lead.id} name={lead.name} />
                      )}
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
    </GlassCard>
  );
}

function scoreColor(score: number): string {
  if (score >= 60) return "#34d399";
  if (score >= 40) return "#FBBF24";
  return "#FB7185";
}
