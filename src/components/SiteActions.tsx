"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

type ActionState = { busy: "approve" | "reject" | null; error: string | null; done: boolean };

/**
 * Approve / Reject buttons for a site. POSTs to /api/approve (which queues the
 * action via GitHub actions.ndjson or the agent's /action endpoint), then
 * refreshes the page so the status reflects the queued action.
 */
export function SiteActions({ slug, status }: { slug: string; status: string }) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({ busy: null, error: null, done: false });

  const act = useCallback(
    async (action: "approve" | "reject") => {
      setState({ busy: action, error: null, done: false });
      try {
        const res = await fetch("/api/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, slug }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setState({ busy: null, error: null, done: true });
        router.refresh();
      } catch (e: any) {
        setState({ busy: null, error: e.message ?? "Action failed", done: false });
      }
    },
    [router, slug]
  );

  const deployable = status === "deployed";

  return (
    <div className="flex items-center justify-end gap-2">
      {state.error && <span className="font-mono text-[10px] text-accent-rose">{state.error}</span>}
      {state.done && (
        <span className="font-mono text-[10px] text-accent-emerald">
          <CheckCircle2 size={11} className="mr-1 inline" />
          queued
        </span>
      )}
      <button
        onClick={() => act("reject")}
        disabled={state.busy !== null}
        className="neon-btn-ghost !px-3 !py-1.5 disabled:pointer-events-none disabled:opacity-50"
        title={deployable ? "Reject this site" : "Mark rejected"}
      >
        {state.busy === "reject" ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
        Reject
      </button>
      {deployable && (
        <button
          onClick={() => act("approve")}
          disabled={state.busy !== null}
          className="neon-btn-primary !px-3 !py-1.5 disabled:pointer-events-none disabled:opacity-50"
          title="Approve: sends the outreach email to this business"
        >
          {state.busy === "approve" ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
          Approve
        </button>
      )}
    </div>
  );
}

/** Scroll a ?slug= deep-link into view once, used by the sites page. */
export function ScrollToSite({ slug }: { slug: string | null }) {
  const done = useRef(false);
  useEffect(() => {
    if (!slug || done.current) return;
    done.current = true;
    const el = document.getElementById(`site-${slug}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [slug]);
  return null;
}
