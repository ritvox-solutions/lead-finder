import type { Business, Category } from "../types.js";
import { nicheSpec } from "./niches.js";
import { getOsmUserAgent, sleep } from "../osm/usage.js";

/**
 * Overpass API endpoint. Public instance is fine for light usage; heavy scans
 * can point OVERPASS_URL at a mirrored or more permissive endpoint.
 */
const OVERPASS_URL = process.env.OVERPASS_URL ?? "https://overpass.kumi.systems/api/interpreter";
const FALLBACK_URLS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];

/**
 * Optional pacing between per-key Overpass queries (ms). Free mirrors rate-limit
 * aggressively; set OVERPASS_DELAY_MS (e.g. 1000) to slow scans down politely.
 */
const QUERY_DELAY_MS = Number(process.env.OVERPASS_DELAY_MS ?? 0);

const TOP_KEYS = ["amenity", "shop", "office", "tourism", "craft", "leisure", "healthcare", "man_made"];

const KNOWN_CATEGORY_TAGS: Array<[Category, string[]]> = [
  ["food", ["restaurant", "cafe", "fast_food", "bar", "pub", "food_court", "ice_cream"]],
  ["retail", ["clothes", "shoes", "supermarket", "convenience", "gift", "jewelry", "electronics", "books", "furniture", "bakery", "butcher"]],
  ["medical", ["doctors", "dentist", "pharmacy", "clinic", "hospital", "veterinary", "physiotherapist"]],
  ["services", ["hair_care", "barber", "beauty", "salon", "laundry_dry_cleaning", "dry_cleaning"]],
  ["professional", ["accountant", "lawyer", "attorney", "estate_agent", "insurance", "it", "consulting"]],
  ["automotive", ["car_repair", "car_rental", "fuel", "taxi", "auto_parts", "car_dealer"]],
  ["home", ["construction", "plumber", "electrician", "locksmith", "roof_dealer", "hvac"]],
];

function classify(tags: Record<string, string>): Category {
  for (const [category, values] of KNOWN_CATEGORY_TAGS) {
    for (const k of ["shop", "amenity", "office", "craft", "healthcare"]) {
      const v = tags[k];
      if (v && values.includes(v)) return category;
    }
  }
  if (tags["healthcare"] || tags["amenity"] === "doctors" || tags["amenity"] === "dentist" || tags["amenity"] === "pharmacy") return "medical";
  if (tags["amenity"]) return "services";
  if (tags["shop"]) return "retail";
  if (tags["office"]) return "professional";
  if (tags["craft"]) return "home";
  return "other";
}

const value = (tags: Record<string, string>, ...keys: string[]): string | null => {
  for (const k of keys) {
    const v = tags[k];
    if (v !== undefined && v !== "") return v;
  }
  return null;
};

export interface ScanParams {
  bbox?: string; // "south,west,north,east"
  lat?: number;
  lon?: number;
  radiusKm?: number;
  /** Human-readable niche (e.g. "gym", "pub, bar"), resolved to OSM tags. */
  niche?: string;
}

/**
 * Build an Overpass QL query for a single business key regex (e.g. "^(amenity)$").
 * Splitting the scan per-key keeps each query light enough for free mirrors.
 *
 * When `valueRegex` is provided, only tags whose value matches it are returned
 * (this is how a user-supplied niche narrows results, e.g. "pub" -> amenity=pub).
 */
export function buildQuery(
  params: ScanParams,
  noWebsiteOnly: boolean,
  keyRegex = "^(amenity|shop|office)$",
  valueRegex?: string
): string {
  const notWebsite = noWebsiteOnly
    ? `[!"website"][!"contact:website"][!"url"]`
    : `["website"|"contact:website"|"url"]`;
  const value = valueRegex ?? ".*";
  const tags = `["name"][~"${keyRegex}"~"${value}"]${notWebsite}`; // [~"key"~"value"] selects matching key/value pairs

  let area: string;
  if (params.bbox) {
    const parts = params.bbox.split(",").map((p) => p.trim());
    const [s, w, n, e] = parts.map(Number);
    if (parts.length !== 4 || [s, w, n, e].some((x) => Number.isNaN(x))) {
      throw new Error(`Invalid bbox "${params.bbox}" (want "south,west,north,east")`);
    }
    if (s >= n || w >= e) throw new Error(`Invalid bbox order (want south<north, west<east)`);
    area = `(${s},${w},${n},${e})`;
  } else if (params.lat !== undefined && params.lon !== undefined) {
    const r = params.radiusKm ?? 3;
    // Overpass `around` takes meters, not km.
    area = `(around:${Math.round(r * 1000)},${params.lat},${params.lon})`;
  } else {
    throw new Error("Provide a bbox or lat+lon+radius");
  }

  return `[out:json][timeout:120];(
   node${tags}${area};
   way${tags}${area};
   relation${tags}${area};
 );out body center;`;
}

/** Map a raw Overpass JSON element to a Business. */
export function fromOverpassElement(el: any): Business | null {
  const tags = el.tags ?? {};
  const name = tags.name;
  if (!name) return null;
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat === undefined || lon === undefined) return null;
  return {
    id: `osm:${el.type}:${el.id}`,
    name,
    lat,
    lon,
    category: classify(tags),
    tags,
    website: value(tags, "website", "contact:website", "url"),
    phone: value(tags, "phone", "contact:phone"),
    street: value(tags, "addr:street", "contact:street"),
    city: value(tags, "addr:city", "addr:place"),
    postcode: value(tags, "addr:postcode"),
    openingHours: value(tags, "opening_hours"),
    email: value(tags, "email", "contact:email"),
    instagram: value(tags, "contact:instagram", "instagram"),
    facebook: value(tags, "contact:facebook", "facebook"),
    raw: el,
  };
}

export interface OverpassResult {
  businesses: Business[];
  totalFound: number;
  timeMs: number;
  /** Number of per-key query groups that no endpoint could serve. */
  failedKeys: number;
  /** Number of per-key query groups successfully served. */
  servedKeys: number;
}

/** One HTTP round-trip against an Overpass endpoint. */
async function runQuery(endpoint: string, query: string, started: number): Promise<OverpassResult | null> {  const res = await fetch(endpoint, {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": getOsmUserAgent(),
    },
    signal: AbortSignal.timeout(45_000),
  });
  if (res.status === 429 || res.status === 504 || res.status === 500 || res.status === 406) {
    throw new Error(`Overpass ${endpoint} HTTP ${res.status}`);
  }
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { elements: any[] };
  const businesses: Business[] = [];
  for (const el of json.elements) {
    const b = fromOverpassElement(el);
    if (b) businesses.push(b);
  }
  return { businesses, totalFound: json.elements.length, timeMs: Date.now() - started, failedKeys: 0, servedKeys: 0 };
}

/**
 * Run a scan. The full multi-key query tends to time out on free mirrors, so we
 * split into one query per top-level key, run them with light concurrency, and
 * dedupe by OSM id. A key that can't be served (rate-limit/timeout) is skipped
 * so partial results still come back.
 */
export async function scanOverpass(params: ScanParams, noWebsiteOnly: boolean): Promise<OverpassResult> {
  const started = Date.now();
  const byId = new Map<string, Business>();
  const endpoints = [OVERPASS_URL, ...FALLBACK_URLS.filter((u) => u !== OVERPASS_URL)];

  // Resolve the user's niche ("gym", "pub, bar"...) to a per-key value regex.
  // If unrecognized/unset, we fall back to scanning every TOP_KEY (broad scan).
  const spec = nicheSpec(params.niche);
  const keys = spec?.keys ?? TOP_KEYS;
  const valueRegex = spec?.valueRegex;
  const keyPatterns = keys.map((k) => `^(${k})$`);
  const CONCURRENCY = 3;

  /** Try every endpoint for one key regex; merge matches into byId. Returns served? */
  async function scanKey(
    keyRegex: string,
    endpoints: string[],
    started: number,
    byId: Map<string, Business>
  ): Promise<boolean> {
    const query = buildQuery(params, noWebsiteOnly, keyRegex, valueRegex);
    for (const endpoint of endpoints) {
      try {
        const result = await runQuery(endpoint, query, started);
        if (!result) continue;
        for (const b of result.businesses) {
          if (!byId.has(b.id)) byId.set(b.id, b);
        }
        return true;
      } catch {
        /* try next endpoint */
      }
    }
    return false;
  }

  let idx = 0;
  let served = 0;
  let failedKeys = 0;
  const worker = async () => {
    while (idx < keyPatterns.length) {
      const i = idx++;
      if (await scanKey(keyPatterns[i], endpoints, started, byId)) served++;
      else failedKeys++;
      if (QUERY_DELAY_MS > 0) await sleep(QUERY_DELAY_MS);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, keyPatterns.length) }, worker));

  const businesses = [...byId.values()];
  return { businesses, totalFound: businesses.length, timeMs: Date.now() - started, failedKeys, servedKeys: served };
}