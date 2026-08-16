"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar, LayoutDashboard, Users, Globe, MessageSquare, Settings as SettingsIcon } from "lucide-react";
import Sidebar from "./Sidebar";

const MOBILE_NAV = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/scan", label: "Scan", icon: Radar },
  { href: "/sites", label: "Sites", icon: Globe },
  { href: "/replies", label: "Replies", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function AppShell({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Ambient background */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 0%, rgba(34,211,238,0.05) 0%, transparent 60%), radial-gradient(50% 40% at 90% 20%, rgba(52,211,153,0.04) 0%, transparent 60%), radial-gradient(40% 40% at 60% 100%, rgba(167,139,250,0.04) 0%, transparent 60%)",
        }}
      />
      <Sidebar />

      {/* Topbar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border-muted/60 bg-bg-primary/70 px-3 backdrop-blur-md sm:px-6 md:ml-56">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold uppercase tracking-[0.2em] text-text-primary">
            {title}
          </span>
          <span className="hidden font-mono text-xs text-text-muted md:inline">
            {updatedAt ? `UPD ${new Date(updatedAt).toLocaleTimeString()}` : "NO LINK"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 rounded-full border border-accent-emerald/30 bg-accent-emerald/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-accent-emerald">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-emerald" style={{ boxShadow: "0 0 8px rgba(52,211,153,0.8)" }} />
            Agent Online
          </span>
          <Link
            href="/scan"
            className="hidden items-center gap-2 rounded-md border border-accent-cyan/60 bg-accent-cyan/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-accent-cyan transition-all hover:bg-accent-cyan/20 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] sm:flex"
          >
            <Radar size={14} strokeWidth={1.8} />
            Run Scan
          </Link>
        </div>
      </header>

      <main className="relative z-10 px-4 py-6 pb-24 sm:px-6 md:ml-56 md:px-8">
        <div className="mx-auto w-full max-w-[1400px]">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border-muted/60 bg-bg-panel/90 px-2 py-2 backdrop-blur-xl md:hidden">
        {MOBILE_NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 font-mono text-[9px] uppercase tracking-widest transition-colors ${
                active ? "text-accent-cyan" : "text-text-muted"
              }`}
            >
              <Icon size={18} strokeWidth={1.6} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}