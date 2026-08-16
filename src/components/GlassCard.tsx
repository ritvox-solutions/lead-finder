import type { ReactNode } from "react";

export function GlassCard({
  children,
  className = "",
  label,
  source,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
  source?: ReactNode;
}) {
  return (
    <div className={`glass-panel relative overflow-hidden rounded-xl ${className}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {label && (
        <div className="flex items-center justify-between border-b border-border-muted px-6 py-4">
          <h2 className="font-mono text-sm font-semibold uppercase tracking-widest text-text-primary">
            {label}
          </h2>
          {source && <span className="font-mono text-xs text-text-muted/70">{source}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  icon,
  accent = "cyan",
  source,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: "cyan" | "emerald" | "amber" | "violet" | "rose";
  source?: string;
}) {
  const accents: Record<"cyan" | "emerald" | "amber" | "violet" | "rose", { text: string; bg: string; glow: string }> = {
    cyan: { text: "text-accent-cyan", bg: "bg-accent-cyan/8", glow: "rgba(34,211,238,0.25)" },
    emerald: { text: "text-accent-emerald", bg: "bg-accent-emerald/8", glow: "rgba(52,211,153,0.25)" },
    amber: { text: "text-accent-amber", bg: "bg-accent-amber/8", glow: "rgba(251,191,36,0.25)" },
    violet: { text: "text-accent-violet", bg: "bg-accent-violet/8", glow: "rgba(167,139,250,0.25)" },
    rose: { text: "text-accent-rose", bg: "bg-accent-rose/8", glow: "rgba(251,113,133,0.25)" },
  };
  const a = accents[accent];
  return (
    <div className="glass-panel group relative overflow-hidden rounded-xl p-5 transition-all duration-300 hover:border-accent-cyan/30">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100`} />
      <div className="relative z-10 flex items-start justify-between">
        <span className="label-caps">{label}</span>
        {icon && (
          <span className={a.text} style={{ filter: `drop-shadow(0 0 8px ${a.glow})` }}>
            {icon}
          </span>
        )}
      </div>
      <div className="relative z-10 mt-3">{value}</div>
      {sub && <div className="relative z-10 mt-1 font-mono text-xs text-accent-emerald">{sub}</div>}
      {source && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-10">
          <span className="font-mono text-[10px] tracking-wider text-text-muted/50">{source}</span>
        </div>
      )}
    </div>
  );
}