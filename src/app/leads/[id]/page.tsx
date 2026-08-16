import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { readState } from "@/lib/gh";
import AppShell from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = await readState();
  const lead = state?.leads[id];
  if (!lead) notFound();

  const site = lead.siteSlug ? state?.sites[lead.siteSlug] ?? null : null;

  return (
    <AppShell title={`Lead // ${lead.name}`} updatedAt={state?.updatedAt}>
      <Link href="/leads" className="mb-6 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-text-muted transition-colors hover:text-accent-cyan">
        <ArrowLeft size={12} /> Back to Registry
      </Link>

      <section className="glass-panel relative overflow-hidden rounded-xl p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-bold text-text-primary">{lead.name}</h1>
              <StatusBadge status={lead.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border-bright bg-bg-inset px-2.5 py-1 text-xs capitalize text-text-secondary">{lead.category}</span>
              {lead.likelyWebsiteAbsent && (
                <span className="rounded-full border border-accent-amber/30 bg-accent-amber/10 px-2.5 py-1 text-[10px] uppercase tracking-widest text-accent-amber">
                  No Website
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-4xl font-bold" style={{ color: scoreColor(lead.score) }}>{lead.score}</div>
            <div className="label-caps mt-1">Confidence</div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlassCard label="Contact" source="SRC // LEAD_DB">
          <dl className="divide-y divide-border-muted/50">
            <Field label="Phone" value={lead.phone} />
            <Field label="Email" value={lead.email} />
            <Field label="Instagram" value={lead.instagram} />
            <Field label="Facebook" value={lead.facebook} />
          </dl>
        </GlassCard>

        <GlassCard label="Location" source="SRC // OVERPASS">
          <dl className="divide-y divide-border-muted/50">
            <Field label="Street" value={lead.street} />
            <Field label="City" value={lead.city} />
            <Field label="Postcode" value={lead.postcode} />
            <Field label="Coords" value={lead.lat && lead.lon ? `${lead.lat.toFixed(5)}, ${lead.lon.toFixed(5)}` : null} />
          </dl>
        </GlassCard>

        <GlassCard label="Opening Hours" source="SRC // OS_DATA">
          {lead.openingHours ? (
            <pre className="p-5 font-mono text-xs leading-relaxed text-text-secondary">{lead.openingHours}</pre>
          ) : (
            <div className="p-5 font-mono text-sm text-text-muted/60">Not available.</div>
          )}
        </GlassCard>

        <GlassCard label="Scoring" source="SRC // SCORE_ENGINE">
          {lead.reasons.length > 0 ? (
            <div className="flex flex-wrap gap-2 p-5">
              {lead.reasons.map((r) => (
                <span key={r} className="rounded-full border border-accent-cyan/25 bg-accent-cyan/5 px-3 py-1 font-mono text-[11px] text-accent-cyan">{r}</span>
              ))}
            </div>
          ) : (
            <div className="p-5 font-mono text-sm text-text-muted/60">No scoring notes.</div>
          )}
        </GlassCard>
      </section>

      <section className="mt-6">
        <GlassCard label="Website Status" source="SRC // SYS_GEN">
          {site ? (
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-text-primary">{site.slug}</span>
                <StatusBadge status={site.status} />
              </div>
              <div className="flex items-center gap-3">
                {site.liveUrl && (
                  <a href={site.liveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-accent-cyan hover:underline">
                    <ExternalLink size={14} /> Live URL
                  </a>
                )}
                <Link href={`/sites?slug=${site.slug}`} className="neon-btn-ghost !px-3 !py-1.5">View Site</Link>
              </div>
            </div>
          ) : (
            <div className="p-5 font-mono text-sm text-text-muted/60">
              No site generated yet. This lead is ready for the next build cycle.
            </div>
          )}
        </GlassCard>
      </section>

      <footer className="mt-6 flex flex-wrap gap-x-8 gap-y-2 font-mono text-xs text-text-muted/60">
        <span>CREATED {lead.createdAt ? new Date(lead.createdAt).toLocaleString() : "—"}</span>
        <span>UPDATED {lead.updatedAt ? new Date(lead.updatedAt).toLocaleString() : "—"}</span>
      </footer>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <dt className="font-mono text-xs uppercase tracking-widest text-text-muted">{label}</dt>
      <dd className="text-right font-mono text-sm text-text-secondary">{value || <span className="text-text-muted/50">—</span>}</dd>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 60) return "#34d399";
  if (score >= 40) return "#FBBF24";
  return "#FB7185";
}
