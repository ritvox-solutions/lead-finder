"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Hammer, Loader2 } from "lucide-react";

/**
 * "Build Site" gate button. POSTs a `build` action (slug = lead id) to
 * /api/approve, which the agent picks up on its next cycle to scaffold, build
 * and deploy a preview site — never automatic, always human-approved first.
 */
export function BuildSiteButton({ leadId, name }: { leadId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const build = useCallback(async () => {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "build", slug: leadId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setDone(true);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Build request failed");
    } finally {
      setBusy(false);
    }
  }, [leadId, router]);

  return (
    <div className="flex items-center justify-end gap-2">
      {error && <span className="font-mono text-[10px] text-accent-rose">{error}</span>}
      {done && (
        <span className="font-mono text-[10px] text-accent-emerald">
          <CheckCircle2 size={11} className="mr-1 inline" />
          queued
        </span>
      )}
      <button
        onClick={build}
        disabled={busy}
        className="neon-btn-ghost !px-3 !py-1.5 disabled:pointer-events-none disabled:opacity-50"
        title={`Build + deploy a preview site for ${name}`}
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Hammer size={12} />}
        Build Site
      </button>
    </div>
  );
}
