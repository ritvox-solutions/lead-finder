import type { Metadata } from "next";
import ScrollReveal from "@/components/ScrollReveal";
import { content } from "@/lib/content";
import { paletteFor } from "@/lib/site";

export const metadata: Metadata = {
  title: `About — ${content.name}`,
  description: content.description,
};

export default function AboutPage() {
  const p = paletteFor(content.category);
  return (
    <section className="mx-auto max-w-4xl px-4 py-20">
      <ScrollReveal>
        <h1 className="text-4xl font-bold" style={{ color: "var(--text)" }}>About {content.name}</h1>
        <p className="mt-4 text-lg leading-relaxed" style={{ color: "var(--muted)" }}>{content.description}</p>
      </ScrollReveal>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {[
          { label: "Services", value: content.services.length.toString() },
          { label: "Phone", value: content.phone ?? "—" },
          { label: "Location", value: content.city ?? "—" },
          { label: "Hours", value: content.hours ?? "—" },
        ].map((f, i) => (
          <ScrollReveal key={f.label} delay={i * 0.08}>
            <div className="rounded-2xl border p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{f.label}</p>
              <p className="mt-1 text-lg font-semibold" style={{ color: "var(--text)" }}>{f.value}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal delay={0.2}>
        <div className="mt-12 rounded-2xl p-8" style={{ background: "var(--bg-alt)", color: "var(--text)" }}>
          <h2 className="text-xl font-bold">Why choose us</h2>
          <p className="mt-2" style={{ color: "var(--muted)" }}>
            We combine quality, care, and local expertise — with clear communication and a personal touch.
          </p>
        </div>
      </ScrollReveal>
    </section>
  );
}