export type Category =
  | "restaurant"
  | "retail"
  | "medical"
  | "services"
  | "professional"
  | "beauty"
  | "automotive"
  | "home"
  | "food"
  | "education"
  | "other";

export interface Business {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: Category;
  /** Sub-category tags from the source (e.g. "cuisine", placeholder tags). */
  tags: Record<string, string>;
  /** Non-empty if the source records a website. */
  website: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  postcode: string | null;
  /** Business hours, when present. */
  openingHours: string | null;
  /** Filled in by contact enrichment. */
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  /** Raw source element for debugging. */
  raw: unknown;
}

export interface ScannedArea {
  label: string;
  lat: number;
  lon: number;
  radiusKm: number;
  scannedAt: string;
  totalFound: number;
  businesses: Business[];
}

/** Enriched contact data merged onto a lead from a contact provider. */
export interface Enrichment {
  email: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  verified: boolean;
  source: string;
}

export interface LeadScore {
  total: number;
  reasons: string[];
}

export interface Lead extends Business {
  score: LeadScore;
  likelyWebsiteAbsent: boolean;
}

export type LeadRow = {
  name: string;
  category: string;
  phone: string;
  street: string;
  city: string;
  postcode: string;
  score: number;
  reasons: string;
  website: string;
  lat: string;
  lon: string;
  osmId: string;
};