import type { Metadata } from "next";
import ScrollReveal from "@/components/ScrollReveal";
import { content } from "@/lib/content";

export const metadata: Metadata = {
  title: `Contact — ${content.name}`,
  description: `Contact ${content.name}: ${content.phone ?? "reach out online"}.`,
};

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-20">
      <ScrollReveal>
        <h1 className="text-4xl font-bold" style={{ color: "var(--text)" }}>Contact us</h1>
        <p className="mt-3" style={{ color: "var(--muted)" }}>
          {content.description.split(".")[0]}. Use the details below to get in touch.
        </p>
      </ScrollReveal>

      <div className="mt-12 grid gap-8 sm:grid-cols-2">
        <ScrollReveal>
          <div className="rounded-2xl border p-8" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Get in touch</h2>
            <ul className="mt-4 space-y-3 text-sm" style={{ color: "var(--muted)" }}>
              {content.phone && (
                <li><span className="font-semibold" style={{ color: "var(--text)" }}>Phone: </span>{content.phone}</li>
              )}
              {content.email && (
                <li><span className="font-semibold" style={{ color: "var(--text)" }}>Email: </span>{content.email}</li>
              )}
              <li>
                <span className="font-semibold" style={{ color: "var(--text)" }}>Address: </span>
                {content.street ? content.street : "On request"}{content.city ? `, ${content.city}` : ""}
              </li>
              {content.hours && (
                <li><span className="font-semibold" style={{ color: "var(--text)" }}>Hours: </span>{content.hours}</li>
              )}
            </ul>
            <a
              href={content.phone ? `tel:${content.phone}` : "/contact"}
              className="mt-6 inline-block rounded-full px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-105"
              style={{ background: "var(--accent)" }}
            >
              Call now
            </a>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div className="rounded-2xl border p-8" style={{ background: "var(--bg-alt)", borderColor: "var(--border)" }}>
            <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Send a message</h2>
            {/* Static preview form — wire to a backend/service when ready. */}
            <form className="mt-4 space-y-4">
              <input
                type="text"
                placeholder="Your name"
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              />
              <input
                type="email"
                placeholder="Your email"
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              />
              <textarea
                placeholder="How can we help?"
                rows={4}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              />
              <button
                type="button"
                className="w-full rounded-full py-3 text-sm font-semibold text-white"
                style={{ background: "var(--accent)" }}
              >
                Send message
              </button>
            </form>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}