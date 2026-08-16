import Hero3D from "@/components/Hero3D";
import ScrollReveal from "@/components/ScrollReveal";
import { content } from "@/lib/content";
import { paletteFor } from "@/lib/site";
import Link from "next/link";

export default function Home() {
  const p = paletteFor(content.category);
  return (
    <div>
      {/* Hero with 3D canvas */}
      <section className="relative flex min-h-[86vh] items-center justify-center overflow-hidden">
        <Hero3D scene={content.heroScene} />
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl" style={{ color: "var(--text)" }}>
            {content.name}
          </h1>
          <p className="mt-4 text-lg sm:text-xl" style={{ color: "var(--muted)" }}>
            {content.tagline}
          </p>
          <p className="mx-auto mt-6 max-w-xl text-sm sm:text-base" style={{ color: "var(--muted)" }}>
            {content.description}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {content.phone && (
              <a
                href={`tel:${content.phone}`}
                className="rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105"
                style={{ background: "var(--accent)", boxShadow: `0 10px 30px -10px ${p.accent}` }}
              >
                Call {content.name}
              </a>
            )}
            <Link
              href="/services"
              className="rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            >
              View services
            </Link>
          </div>
          {content.hours && (
            <p className="mt-6 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              {content.hours}
            </p>
          )}
        </div>
      </section>

      {/* Highlights */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-6 sm:grid-cols-3">
          {content.services.slice(0, 3).map((s, i) => (
            <ScrollReveal key={s} delay={i * 0.1}>
              <div
                className="h-full rounded-2xl border p-6 transition-transform hover:-translate-y-1"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div
                  className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
                  style={{ background: "var(--accent)" }}
                >
                  {String(i + 1)}
                </div>
                <h3 className="font-semibold" style={{ color: "var(--text)" }}>{s}</h3>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* About teaser */}
      <section
        className="py-20"
        style={{ background: "linear-gradient(var(--gradient-from), var(--gradient-to))" }}
      >
        <div className="mx-auto max-w-4xl px-4 text-center">
          <ScrollReveal>
            <h2 className="text-3xl font-bold" style={{ color: "var(--text)" }}>
              About {content.name}
            </h2>
            <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--muted)" }}>
              {content.description}
            </p>
            <Link
              href="/about"
              className="mt-6 inline-block text-sm font-semibold underline underline-offset-4"
              style={{ color: "var(--accent)" }}
            >
              Learn more →
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}