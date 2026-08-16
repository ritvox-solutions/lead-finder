import type { LeadStatus, SiteStatus } from "@/lib/types";

const LEAD_STYLES: Record<LeadStatus, string> = {
  new: "text-text-muted border-border-muted bg-bg-inset",
  building: "text-accent-cyan border-accent-cyan/30 bg-accent-cyan/10",
  built: "text-accent-violet border-accent-violet/30 bg-accent-violet/10",
  deployed: "text-accent-amber border-accent-amber/30 bg-accent-amber/10",
  approved: "text-accent-emerald border-accent-emerald/30 bg-accent-emerald/10",
  pitched: "text-accent-violet border-accent-violet/30 bg-accent-violet/10",
  interested: "text-accent-emerald border-accent-emerald/30 bg-accent-emerald/10",
  rejected: "text-accent-rose border-accent-rose/30 bg-accent-rose/10",
};

const DOT: Record<string, string> = {
  new: "bg-text-muted",
  building: "bg-accent-cyan",
  built: "bg-accent-violet",
  deployed: "bg-accent-amber",
  approved: "bg-accent-emerald",
  pitched: "bg-accent-violet",
  interested: "bg-accent-emerald",
  rejected: "bg-accent-rose",
};

export function StatusBadge({ status }: { status: string }) {
  const style =
    LEAD_STYLES[(status as LeadStatus) ?? "new"] ??
    (Object.values(LEAD_STYLES).find((_, i) => Object.keys(LEAD_STYLES)[i] === status) as string) ??
    LEAD_STYLES.new;
  const dot = DOT[status] ?? "bg-text-muted";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest ${style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} style={{ boxShadow: `0 0 6px currentColor` }} />
      {status}
    </span>
  );
}

const SITE_STYLES: Record<SiteStatus, string> = {
  built: "text-accent-violet border-accent-violet/30 bg-accent-violet/10",
  deployed: "text-accent-amber border-accent-amber/30 bg-accent-amber/10",
  approved: "text-accent-emerald border-accent-emerald/30 bg-accent-emerald/10",
  pitched: "text-accent-violet border-accent-violet/30 bg-accent-violet/10",
  rejected: "text-accent-rose border-accent-rose/30 bg-accent-rose/10",
};

const DOT_STYLES: Record<SiteStatus, string> = {
  built: "bg-accent-violet",
  deployed: "bg-accent-amber",
  approved: "bg-accent-emerald",
  pitched: "bg-accent-violet",
  rejected: "bg-accent-rose",
};

export function SiteStatusBadge({ status }: { status: SiteStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-widest ${SITE_STYLES[status] ?? SITE_STYLES.built}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[status] ?? "bg-text-muted"}`} />
      {status}
    </span>
  );
}

export function SourceTag({ source }: { source: string }) {
  return (
    <span className="font-mono text-xs tracking-wider text-text-muted/60">
      {source}
    </span>
  );
}