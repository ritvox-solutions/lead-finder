export const dynamic = "force-dynamic";

import Link from "next/link";
import { MessageSquare, RefreshCw, ThumbsUp, Inbox } from "lucide-react";
import { readState } from "@/lib/gh";
import { formatDateTime } from "@/lib/format";
import AppShell from "@/components/AppShell";
import { GlassCard, StatTile } from "@/components/GlassCard";
import { SourceTag } from "@/components/StatusBadge";

export default async function RepliesPage() {
  const state = await readState();
  const replies = state ? state.replies : [];
  const leads = state ? Object.values(state.leads) : [];

  const leadMap = new Map<string, { name: string }>();
  for (const l of leads) leadMap.set(l.id, { name: l.name });

  const positive = replies.filter((r) => r.positive);
  const other = replies.filter((r) => !r.positive).sort((a, b) => new Date(b.seenAt).getTime() - new Date(a.seenAt).getTime()).slice(0, 50);

  return (
    <AppShell title="Replies" updatedAt={state?.updatedAt}>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Replies" value={<span className="font-mono text-3xl font-bold text-text-primary">{replies.length}</span>} icon={<Inbox size={20} strokeWidth={1.6} />} accent="cyan" source="SRC // GMAIL_IMAP" />
        <StatTile label="Positive" value={<span className="font-mono text-3xl font-bold text-accent-emerald">{positive.length}</span>} sub="interested prospects" icon={<ThumbsUp size={20} strokeWidth={1.6} />} accent="emerald" source="SRC // CLASSIFY" />
        <StatTile label="Non-positive" value={<span className="font-mono text-3xl font-bold text-text-primary">{other.length}</span>} icon={<MessageSquare size={20} strokeWidth={1.6} />} accent="violet" source="SRC // CLASSIFY" />
      </section>

      {positive.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-accent-emerald">
            ▲ Positive Replies ({positive.length})
          </h2>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {positive.map((reply) => {
              const lead = reply.leadId ? leadMap.get(reply.leadId) : undefined;
              return <ReplyCard key={reply.id} reply={reply} lead={lead} />;
            })}
          </div>
        </section>
      )}

      {replies.length === 0 ? (
        <section className="mt-6">
          <GlassCard label="Inbox" source={<span className="flex items-center gap-1.5"><RefreshCw size={12} /> SRC // GMAIL_IMAP</span>}>
            <div className="p-12 text-center">
              <p className="font-mono text-sm text-text-muted">No replies scanned yet — the agent will sync the inbox.</p>
            </div>
          </GlassCard>
        </section>
      ) : (
        <section className="mt-6">
          <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-text-muted">
            ▲ All Scanned ({other.length} non-positive)
          </h2>
          <GlassCard label="Inbox" source={<span className="flex items-center gap-1.5"><RefreshCw size={12} /> SRC // GMAIL_IMAP</span>}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-muted bg-bg-inset/40 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                    <th className="px-5 py-3 font-normal">From</th>
                    <th className="px-5 py-3 font-normal">Subject</th>
                    <th className="px-5 py-3 font-normal">Snippet</th>
                    <th className="px-5 py-3 font-normal">Lead</th>
                    <th className="px-5 py-3 text-right font-normal">Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted/50 font-mono text-sm">
                  {other.map((reply) => {
                    const lead = reply.leadId ? leadMap.get(reply.leadId) : null;
                    return (
                      <tr key={reply.id} className="transition-colors hover:bg-accent-cyan/5">
                        <td className="px-5 py-3.5 text-text-primary">{reply.sender}</td>
                        <td className="max-w-[240px] truncate px-5 py-3.5 text-text-secondary">{reply.subject}</td>
                        <td className="max-w-[320px] truncate px-5 py-3.5 text-text-muted">{reply.snippet}</td>
                        <td className="px-5 py-3.5">
                          {lead ? <span className="text-accent-cyan hover:underline"><Link href={`/leads/${reply.leadId}`}>{lead.name}</Link></span> : <span className="text-text-muted/60">Unmatched</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right text-xs text-text-muted">{formatDateTime(reply.seenAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </section>
      )}
    </AppShell>
  );
}

function ReplyCard({ reply, lead }: { reply: { sender: string; subject: string; snippet: string; reasons: string; seenAt: string; leadId: string | null }; lead?: { name: string } }) {
  return (
    <div className="glass-panel rounded-xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-emerald/30 bg-accent-emerald/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-accent-emerald">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-emerald" /> Positive
            </span>
            <span className="font-mono text-xs text-text-muted">{formatDateTime(reply.seenAt)}</span>
            {lead && (
              <Link href={`/leads/${reply.leadId}`} className="font-mono text-xs uppercase tracking-widest text-accent-cyan hover:underline">
                → {lead.name}
              </Link>
            )}
          </div>
          <p className="font-medium text-text-primary">{reply.subject}</p>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">{reply.snippet}</p>
          <div className="mt-3 font-mono text-xs text-text-muted">
            From: <span className="font-medium text-text-secondary">{reply.sender}</span>
            {reply.reasons && <> • Matched: <span className="font-medium text-text-secondary">{reply.reasons}</span></>}
          </div>
        </div>
      </div>
    </div>
  );
}