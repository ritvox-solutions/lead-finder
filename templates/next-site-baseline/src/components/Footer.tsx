import Link from "next/link";
import { content } from "@/lib/content";

export default function Footer() {
  return (
    <footer className="mt-20 border-t py-10" style={{ borderColor: "var(--border)", background: "var(--bgAlt)" }}>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-3">
        <div>
          <p className="font-bold" style={{ color: "var(--text)" }}>{content.name}</p>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{content.tagline}</p>
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Visit us</p>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {content.street ? content.street : ""}
            {content.city ? `, ${content.city}` : ""}
            {content.postcode ? ` ${content.postcode}` : ""}
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Contact</p>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {content.phone ? `Phone: ${content.phone}` : ""}
            {content.email ? `\nEmail: ${content.email}` : ""}
          </p>
        </div>
      </div>
      <p className="mt-8 text-center text-xs" style={{ color: "var(--muted)" }}>
        © {new Date().getFullYear()} {content.name}. All rights reserved.
      </p>
    </footer>
  );
}