/**
 * Turn a place name (e.g. "Yeshwanthpur, Bangalore") into lat/lon.
 *
 * Primary source: Nominatim public instance (no API key required, works well
 * for Indian localities). Falls back to Google Geocoding when GOOGLE_MAPS_KEY
 * (or GOOGLE_PLACES_KEY) is present and Nominatim comes back empty.
 *
 * A literal "lat,lng" string is also accepted and passed through directly.
 */
export interface GeocodeResult {
  lat: number;
  lon: number;
  displayName: string;
  source: "literal" | "nominatim" | "google";
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "leadfinder/1.0 (local business website lead finder; contact: shettyanikethand@gmail.com)";
const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY ?? process.env.GOOGLE_PLACES_KEY ?? "";

export async function geocodePlace(query: string): Promise<GeocodeResult> {
  const trimmed = (query || "").trim();
  if (!trimmed) throw new Error("No location provided");

  // Literal "lat,lng" shortcut (handy for power users).
  const literal = parseLiteralCoords(trimmed);
  if (literal) return { ...literal, displayName: trimmed, source: "literal" };

  const n = await geocodeNominatim(trimmed);
  if (n) return n;

  if (GOOGLE_KEY) {
    const g = await geocodeGoogle(trimmed, GOOGLE_KEY);
    if (g) return g;
  }

  throw new Error(`Could not geocode "${trimmed}". Try "lat,lng" or a more specific place name.`);
}

function parseLiteralCoords(s: string): { lat: number; lon: number } | null {
  const parts = s.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

async function geocodeNominatim(query: string): Promise<GeocodeResult | null> {
  // Try as-is first, then retry appending ", India" (common in this workflow).
  const attempts = [query, `${query}, India`];
  for (const q of attempts) {
    try {
      const url = new URL(NOMINATIM_URL);
      url.searchParams.set("q", q);
      url.searchParams.set("format", "json");
      url.searchParams.set("addressdetails", "0");
      url.searchParams.set("limit", "1");
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      if (data && data.length > 0) {
        return {
          lat: Number(data[0].lat),
          lon: Number(data[0].lon),
          displayName: data[0].display_name,
          source: "nominatim",
        };
      }
    } catch {
      /* fall through to next attempt */
    }
  }
  return null;
}

async function geocodeGoogle(query: string, apiKey: string): Promise<GeocodeResult | null> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", query);
    url.searchParams.set("key", apiKey);
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: Array<{ geometry: { location: { lat: number; lng: number } }; formatted_address: string }> };
    const r = data.results?.[0];
    if (!r) return null;
    return {
      lat: r.geometry.location.lat,
      lon: r.geometry.location.lng,
      displayName: r.formatted_address,
      source: "google",
    };
  } catch {
    return null;
  }
}
