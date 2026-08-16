/**
 * Map a human "niche" keyword (e.g. "gym", "pub", "restaurant") to the OSM tags
 * that describe it. Used to narrow Overpass queries so a manual scan doesn't
 * return every amenity/shop/office under the sun.
 *
 * Free-text niche strings are matched case-insensitively against the keys;
 * unknown niches simply yield no restriction (we fall back to the all-keys scan).
 */
export interface NicheTag {
  key: string;
  values: string[];
}

export const NICHE_MAP: Record<string, NicheTag[]> = {
  gym: [{ key: "leisure", values: ["fitness_centre", "fitness_station", "sports_centre"] }, { key: "sport", values: ["fitness", "gymnastics"] }],
  "fitness centre": [{ key: "leisure", values: ["fitness_centre", "fitness_station", "sports_centre"] }],
  pub: [{ key: "amenity", values: ["pub", "bar"] }],
  bar: [{ key: "amenity", values: ["bar", "pub"] }],
  restaurant: [{ key: "amenity", values: ["restaurant", "fast_food", "food_court"] }],
  cafe: [{ key: "amenity", values: ["cafe", "coffee_shop"] }],
  salon: [{ key: "shop", values: ["hairdresser", "beauty"] }, { key: "amenity", values: ["beauty"] }, { key: "craft", values: ["beauty_therapist"] }],
  "hairdresser": [{ key: "shop", values: ["hairdresser"] }],
  clinic: [{ key: "amenity", values: ["clinic"] }, { key: "healthcare", values: ["clinic"] }, { key: "amenity", values: ["doctors"] }],
  doctor: [{ key: "amenity", values: ["doctors"] }, { key: "healthcare", values: ["doctor"] }],
  pharmacy: [{ key: "amenity", values: ["pharmacy"] }, { key: "healthcare", values: ["pharmacy"] }],
  dentist: [{ key: "healthcare", values: ["dentist"] }, { key: "amenity", values: ["dentist"] }],
  plumber: [{ key: "craft", values: ["plumber"] }],
  electrician: [{ key: "craft", values: ["electrician"] }],
  "car repair": [{ key: "shop", values: ["car_repair"] }, { key: "craft", values: ["car_repair"] }],
  garage: [{ key: "shop", values: ["car_repair"] }, { key: "craft", values: ["car_repair"] }, { key: "amenity", values: ["car_wash"] }],
  hotel: [{ key: "tourism", values: ["hotel", "guest_house", "hostel"] }, { key: "amenity", values: ["hotel"] }, { key: "tourism", values: ["motel"] }],
  bakery: [{ key: "shop", values: ["bakery"] }],
  supermarket: [{ key: "shop", values: ["supermarket"] }],
  grocery: [{ key: "shop", values: ["convenience", "greengrocer", "supermarket", "market"] }],
  "clothes store": [{ key: "shop", values: ["clothes", "fashion", "shoes"] }],
  "jewelry": [{ key: "shop", values: ["jewelry"] }],
  "electronics": [{ key: "shop", values: ["electronics"] }],
  "book store": [{ key: "shop", values: ["books"] }],
  "cafe / coffee": [{ key: "amenity", values: ["cafe"] }, { key: "shop", values: ["coffee"] }],
};

/** Normalize user input ("Gyms", "pubs", "Restaurants") to a canonical map key. */
export function resolveNiche(raw: string): NicheTag[] | null {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return null;

  // Accept comma/space separated input ("gym, pub") — union of all recognized.
  const tokens = s.split(/[\s,]+/).filter(Boolean);
  const found: NicheTag[] = [];
  for (const tok of tokens) {
    if (NITCHE_SYNONYMS[tok]) {
      for (const k of NITCHE_SYNONYMS[tok]) {
        const tags = NICHE_MAP[k];
        if (tags) found.push(...tags);
      }
    } else if (NICHE_MAP[tok]) {
      found.push(...NICHE_MAP[tok]);
    }
  }
  if (!found.length) return null;
  return dedupeNiche(found);
}

/** Extra synonym spellings a user might type. */
const NITCHE_SYNONYMS: Record<string, string[]> = {
  gyms: ["gym"],
  pubs: ["pub"],
  bars: ["bar"],
  restaurant: ["restaurant"],
  restaurants: ["restaurant"],
  cafe: ["cafe"],
  cafes: ["cafe"],
  "coffee shop": ["cafe"],
  salons: ["salon"],
  "hair dresser": ["hairdresser"],
  "hairdresser": ["hairdresser"],
  "car repair": ["car repair"],
  "electronics store": ["electronics"],
  "jewellery": ["jewelry"],
};

function dedupeNiche(tags: NicheTag[]): NicheTag[] {
  const byKey = new Map<string, NicheTag>();
  for (const t of tags) {
    const existing = byKey.get(t.key);
    if (!existing) {
      byKey.set(t.key, { key: t.key, values: [...t.values] });
    } else {
      for (const v of t.values) if (!existing.values.includes(v)) existing.values.push(v);
    }
  }
  return [...byKey.values()];
}

/** Build the Overpass value regex for one (key, values) pair, e.g. "^(pub|bar)$". */
function valueRegex(values: string[]): string {
  return `^(${values.map(escapeRe).join("|")})$`;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolve the full set of keys to scan, plus per-key value regexes, for a niche.
 * Returns null if no niche restriction (scan all TOP_KEYS with any value).
 */
export interface NicheSpec {
  keys: string[]; // OSM keys to query
  valueRegex: string; // union value regex applied across those keys
}

export function nicheSpec(raw: string | undefined): { keys: string[]; valueRegex: string } | null {
  const tags = resolveNiche(raw ?? "");
  if (!tags) return null;
  const keys = dedupeNiche(tags).map((t) => t.key);
  const allValues = dedupeNiche(tags).flatMap((t) => t.values);
  return { keys, valueRegex: valueRegex(allValues) };
}
