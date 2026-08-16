import type { Metadata } from "next";
import ScrollReveal from "@/components/ScrollReveal";
import { content } from "@/lib/content";

export const metadata: Metadata = {
  title: `Services — ${content.name}`,
  description: `Services offered by ${content.name}: ${content.services.join(", ")}.`,
};

export default function ServicesPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20">
      <ScrollReveal>
        <h1 className="text-4xl font-bold" style={{ color: "var(--text)" }}>Our services</h1>
        <p className="mt-3 max-w-2xl" style={{ color: "var(--muted)" }}>
          Everything you need, handled by {content.name}. Reach out for details, availability, or a quick chat.
        </p>
      </ScrollReveal>
      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {content.services.map((s, i) => (
          <ScrollReveal key={s} delay={i * 0.08}>
            <div
              className="h-full rounded-2xl border p-6 transition-transform hover:-translate-y-1"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>{s}</h3>
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                Customized for you — ask {content.name} how we can tailor this to your needs.
              </p>
            </div>
          </ScrollReveal>
        ))}
      </div>
      <ScrollReveal delay={0.2}>
        <div
          className="mt-12 rounded-2xl p-8 text-center"
          style={{ background: "var(--accent-soft)", color: "var(--text)" }}
        >
          <p className="font-semibold">Want to know more?</p>
          {content.phone ? (
            <a href={`tel:${content.phone}`} className="mt-2 inline-block font-bold" style={{ color: "var(--accent-2)" }}>
              Call {content.phone}
            </a>
          ) : (
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Contact us to get started.</p>
          )}
        </div>
      </ScrollReveal>
    </section>
  );
}