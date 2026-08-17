/**
 * Shared usage-policy helpers for OpenStreetMap services (Overpass + Nominatim).
 *
 * Both services ask clients to identify themselves with a descriptive
 * User-Agent containing a reachable contact address, and both rate-limit
 * polite usage. Keeping these in one place avoids the two callers drifting
 * apart (e.g. Overpass advertising a placeholder email while Nominatim
 * advertises a real one).
 */

/** Contact address advertised to OSM services. Falls back to OWNER_EMAIL. */
export function getOsmContact(): string {
  return process.env.CONTACT_EMAIL ?? process.env.OWNER_EMAIL ?? "you@example.com";
}

/** Descriptive User-Agent for Overpass/Nominatim requests. */
export function getOsmUserAgent(): string {
  return `leadfinder/1.0 (local business website lead finder; contact: ${getOsmContact()})`;
}

/** Polite pause (ms) — used to stay under service rate limits (e.g. Nominatim 1 req/s). */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
