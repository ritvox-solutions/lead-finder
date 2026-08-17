import type { Business, Enrichment } from "../types.js";

/** Object map: business id -> filled contact fields. */
export type EnrichmentMap = Map<string, Enrichment>;

/**
 * A contact provider takes a list of businesses and tries to fill in contact
 * fields (email, phone, socials) by looking them up in an external source.
 * It must never throw for individual businesses — it returns only what it found.
 */
export interface ContactProvider {
  readonly name: string;
  enrich(businesses: Business[]): Promise<EnrichmentMap>;
}

/**
 * Provider built entirely from OpenStreetMap tags already available on the
 * business. Free and instant — good enough to start prototyping outreach.
 */
export const osmTagProvider: ContactProvider = {
  name: "osm-tags",
  async enrich(businesses: Business[]): Promise<EnrichmentMap> {
    const out: EnrichmentMap = new Map();
    for (const b of businesses) {
      const t = b.tags;
      const email = t["email"] ?? t["contact:email"] ?? null;
      const phone = b.phone ?? t["phone"] ?? t["contact:phone"] ?? null;
      const website = b.website ?? t["website"] ?? t["contact:website"] ?? t["url"] ?? null;
      const instagram = t["contact:instagram"] ?? null;
      const facebook = t["contact:facebook"] ?? null;
      if (email || phone || website || instagram || facebook) {
        out.set(b.id, {
          email,
          phone,
          website,
          instagram,
          facebook,
          verified: false,
          source: this.name,
        });
      }
    }
    return out;
  },
};

export interface GooglePlacesConfig {
  apiKey: string;
}

/**
 * Google Places Text Search — the realistic way to get the phone + website for
 * businesses OSM didn't record. Requires a paid Google Maps API key (set via
 * GOOGLE_PLACES_KEY env). Unused here unless you provide your own key.
 */
export const googlePlacesProvider: ContactProvider = {
  name: "google-places",
  async enrich(businesses: Business[]): Promise<EnrichmentMap> {
    const apiKey = process.env.GOOGLE_PLACES_KEY;
    if (!apiKey) return new Map();

    const map: EnrichmentMap = new Map();
    // Query in small batches, gently throttled.
    for (let i = 0; i < businesses.length; i += 5) {
      const batch = businesses.slice(i, i + 5);
      await Promise.all(
        batch.map(async (b) => {
          try {
            const q = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
            q.searchParams.set("key", apiKey);
            q.searchParams.set("input", `${b.name}, ${b.city ?? ""} ${b.street ?? ""}`);
            q.searchParams.set("inputtype", "textquery");
            q.searchParams.set("fields", "place_id,name,formatted_phone_number,website,formatted_address");

            const res = await fetch(q, { signal: AbortSignal.timeout(15_000) });
            if (!res.ok) return;
            const data = (await res.json()) as {
              candidates?: Array<{ place_id: string }>;
            };
            const placeId = data.candidates?.[0]?.place_id;
            if (!placeId) return;

            const detail = new URL("https://maps.googleapis.com/maps/api/place/details/json");
            detail.searchParams.set("key", apiKey);
            detail.searchParams.set("placeid", placeId);
            detail.searchParams.set("fields", "formatted_phone_number,url,website,email");
            const dres = await fetch(detail, { signal: AbortSignal.timeout(15_000) });
            if (!dres.ok) return;
            const ddata = (await dres.json()) as {
              result?: { formatted_phone_number?: string; website?: string; url?: string };
            };
            const r = ddata.result ?? {};
            map.set(b.id, {
              email: null,
              phone: r.formatted_phone_number ?? null,
              website: r.website ?? null,
              instagram: null,
              facebook: null,
              verified: true,
              source: this.name,
            });
          } catch {
            /* skip on any error */
          }
        })
      );
    }
    return map;
  },
};

/** Merge enrichment results into a business (fills gaps, never overwrites). */
export function applyEnrichment(b: Business, e: Enrichment | undefined): Business {
  if (!e) return b;
  return {
    ...b,
    phone: b.phone ?? e.phone,
    website: b.website ?? e.website,
    email: e.email,
    instagram: e.instagram,
    facebook: e.facebook,
  };
}

export const CONTACT_PROVIDERS: Record<string, ContactProvider> = {
  osm: osmTagProvider,
  google: googlePlacesProvider,
};