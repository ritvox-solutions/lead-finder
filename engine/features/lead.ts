import type { Business, Lead, LeadScore } from "../types.js";

/**
 * Score a business as a sales lead. Points reward signals that make a business
 * a good candidate to buy a website: no website present, an existing local
 * footprint (address + phone), operating hours (signals active operation), and
 * categories where a web presence tends to convert (salons, trades, restaurants).
 */
const SCORE = {
  noWebsite: 50,
  hasPhone: 10,
  hasAddress: 10,
  hasHours: 15,
  categoryBoost: 5,
};

const HIGH_URGENCY: ReadonlySet<string> = new Set([
  "services",
  "home",
  "beauty",
  "automotive",
  "professional",
  "food",
]);

export function scoreLead(b: Business): LeadScore {
  const reasons: string[] = [];
  let total = 0;
  if (!b.website) {
    total += SCORE.noWebsite;
    reasons.push("no website on record");
  }
  if (b.phone) {
    total += SCORE.hasPhone;
    reasons.push("has contact phone");
  }
  if (b.street && b.city) {
    total += SCORE.hasAddress;
    reasons.push("has address (locatable)");
  }
  if (b.openingHours) {
    total += SCORE.hasHours;
    reasons.push("lists opening hours");
  }
  if (HIGH_URGENCY.has(b.category)) {
    total += SCORE.categoryBoost;
    reasons.push(`high-urgency category (${b.category})`);
  }
  return { total, reasons };
}

export function toLead(b: Business): Lead {
  const score = scoreLead(b);
  return {
    ...b,
    score,
    likelyWebsiteAbsent: !b.website,
  };
}