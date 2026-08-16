import { readFile } from "node:fs/promises";
import type { Business, Category } from "../types.js";
import { parseCsv } from "../export/csv.js";

const CATEGORIES = new Set([
  "restaurant", "retail", "medical", "services", "professional",
  "beauty", "automotive", "home", "food", "education", "other",
]);

/**
 * Load businesses back from a leads CSV written by `leadsToRows`, so that the
 * `pitch` and `enrich` subcommands can operate on an existing scan result.
 */
export async function loadBusinessesFromCsv(path: string): Promise<Business[]> {
  const text = await readFile(path, "utf8");
  const rows = parseCsv(text);
  return rows.map((r) => ({
    id: r["osmId"] ?? r["id"],
    name: r["name"],
    lat: Number(r["lat"] ?? 0),
    lon: Number(r["lon"] ?? 0),
    category: (CATEGORIES.has(r["category"]) ? r["category"] : "other") as Category,
    tags: {},
    website: r["website"] || null,
    phone: r["phone"] || null,
    street: r["street"] || null,
    city: r["city"] || null,
    postcode: r["postcode"] || null,
    openingHours: null,
    email: null,
    instagram: null,
    facebook: null,
    raw: {},
  }));
}