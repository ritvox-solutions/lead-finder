"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Radar,
  Globe,
  MessageSquare,
  Settings as SettingsIcon,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/scan", label: "Scan", icon: Radar },
  { href: "/sites", label: "Sites", icon: Globe },
  { href: "/replies", label: "Replies", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 top-0 z-40 hidden h-full w-56 flex-col border-r border-border-muted/60 bg-bg-panel/85 backdrop-blur-xl md:flex">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border-muted/60 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent-cyan/50 bg-accent-cyan/10 text-sm font-black tracking-tighter text-accent-cyan" style={{ boxShadow: "0 0 12px rgba(34,211,238,0.25)" }}>
          LF
        </span>
        <div className="flex flex-col">
          <span className="font-mono text-sm font-bold tracking-tight text-text-primary">LEADFINDER</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">ARC_TERMINAL_V1</span>
        </div>
      </div>

      {/* Nav */}
      <ul className="flex flex-1 flex-col gap-1 px-3 py-4">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-lg border-r-2 px-3 py-2.5 font-mono text-xs uppercase tracking-widest transition-all duration-200 ${
                  active
                    ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan"
                    : "border-transparent text-text-muted hover:bg-white/5 hover:text-text-secondary"
                }`}
              >
                <Icon size={17} strokeWidth={1.6} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Footer status */}
      <div className="border-t border-border-muted/60 p-4">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent-emerald" style={{ boxShadow: "0 0 8px rgba(52,211,153,0.8)" }} />
          System Online
        </div>
      </div>
    </nav>
  );
}