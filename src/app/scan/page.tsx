import { readState } from "@/lib/gh";
import AppShell from "@/components/AppShell";
import { ScanConsole } from "@/components/ScanConsole";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const state = await readState();

  return (
    <AppShell title="Scan Mission" updatedAt={state?.updatedAt}>
      <ScanConsole initialProgress={state?.scanProgress ?? null} initialScan={state?.settings?.lastManualScan ?? null} />
    </AppShell>
  );
}