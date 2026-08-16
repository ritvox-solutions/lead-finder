import type { Business } from "../types.js";

export interface OutreachOptions {
  yourName: string;
  yourBusiness: string;
  preferredChannel?: "email" | "whatsapp" | "phone" | "instagram" | "default";
}

/** Rough greeting/gap by category, used to personalize a templated pitch. */
const CATEGORY_PITCH: Record<string, { hook: string; gap: string }> = {
  food: {
    hook: "menu visibility and online orders",
    gap: "customers can't find your menu, hours, or order info on the internet",
  },
  retail: {
    hook: "products and opening hours",
    gap: "shoppers looking you up get only a bare listing, not your actual offerings",
  },
  medical: {
    hook: "services, insurance, and bookings",
    gap: "patients can't verify your services or book an appointment online",
  },
  services: {
    hook: "your services and online booking",
    gap: "people searching for what you do can't easily find your details or book you",
  },
  professional: {
    hook: "your services and credentials",
    gap: "clients can't quickly verify your services, experience, or how to reach you",
  },
  beauty: {
    hook: "services, prices, and booking",
    gap: "clients can't easily find your services, prices, or book an appointment",
  },
  automotive: {
    hook: "services and a booking / quote path",
    gap: "drivers researching you can't find what you offer or request quotes",
  },
  home: {
    hook: "your services and a quote request",
    gap: "homeowners can't find your service details or request a quote online",
  },
  education: {
    hook: "courses and enrollment",
    gap: "people can't easily discover your courses or how to enroll",
  },
};

const FELLBACK_PITCH = {
  hook: "your services and how customers can reach you",
  gap: "people looking for you have no easy way to see what you offer or how to contact you",
};

function buildPitch(b: Business): string {
  const p = CATEGORY_PITCH[b.category] ?? FELLBACK_PITCH;
  if (b.openingHours && b.street) {
    return `${p.hook} — and you're clearly active (we can see your hours plus address on the map), yet ${p.gap}`;
  }
  return `it looks like ${p.gap}`;
}

/**
 * Generate a short, genuinely useful outreach message for a single business.
 * Kept respect-based: it offers value, no hard sell, and a clear next step —
 * consistent with only outwith real intent to help, not spam.
 */
export function generateOutreach(b: Business, opts: OutreachOptions): { subject: string; body: string } {
  const channel = opts.preferredChannel ?? "email";
  const subject = `Quick note about your website, ${b.name}`;
  const pitch = buildPitch(b);
  const place = [b.street, b.city].filter(Boolean).join(", ");

  const body = [
    `Hi ${b.name},`,
    ``,
    place
      ? `I came across this while looking at businesses online in ${place}, and yours came up without a real website. From the quick look, ${pitch}.`
      : `I came across ${b.name} while looking at local businesses online, and it came up without a real website. From the quick look, ${pitch}.`,
    ``,
    `I build simple, affordable sites for local businesses — usually a one-pager so customers can find, contact, and (for some types) book or order from you. We can also reuse what you already use (calls, social, orders) — it just gives you one clear place people can land.`,
    ``,
    `No obligation and no pressure. If it's useful, I'd be happy to share a plain pitch and a very short sample. Is that something ${opts.yourBusiness} could help with?`,
    ``,
    `Warm regards,`,
    opts.yourName,
    opts.yourBusiness,
  ].filter((l) => l !== "");

  const oneLiners: Record<string, string> = {
    email: "Send me a note here or a simple reply.",
    whatsapp: "If it's easier to message me on WhatsApp, just say hi.",
    phone: "If a quick call is easier, just reply with a good time.",
    sms: "Reply to this text and I'll send one non-salesy idea.",
    instagram: "If it's easier, just DM me here.",
    default: "Happy to explain more — just reply.",
  };
  const oneLiner = oneLiners[channel] ?? oneLiners.default;

  return {
    subject,
    body: [...body, ``, oneLiner].join("\n"),
  };
}