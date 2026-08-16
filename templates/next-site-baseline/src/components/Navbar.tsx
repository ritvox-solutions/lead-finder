import Link from "next/link";
import { content } from "@/lib/content";
import { paletteFor } from "@/lib/site";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const accent = paletteFor(content.category).accent;
  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-md"
      style={{ background: "var(--bg)", borderColor: "var(--border)" }}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight" style={{ color: "var(--text)" }}>
          {content.name}
        </Link>
        <div className="hidden items-center gap-6 sm:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--muted)" }}
            >
              {l.label}
            </Link>
          ))}
          {content.phone && (
            <a
              href={`tel:${content.phone}`}
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-white"
              style={{ background: accent }}
            >
              Call us
            </a>
          )}
        </div>
      </nav>
    </header>
  );
}