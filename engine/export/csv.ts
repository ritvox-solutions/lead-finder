import type { Business, Lead, LeadRow } from "../types.js";
import { toLead } from "../features/lead.js";

export function leadsToRows(leads: Lead[]): LeadRow[] {
  return leads.map((l) => ({
    name: l.name,
    category: l.category,
    phone: l.phone ?? "",
    street: l.street ?? "",
    city: l.city ?? "",
    postcode: l.postcode ?? "",
    score: l.score.total,
    reasons: l.score.reasons.join("; "),
    website: l.website ?? "",
    lat: l.lat.toFixed(6),
    lon: l.lon.toFixed(6),
    osmId: l.id,
  }));
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) => headers.map((h) => escape(r[h])).join(","));
  return [headers.join(","), ...lines].join("\n");
}

/** Minimal CSV parser (handles quoted fields with commas/escaped quotes). */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rawRows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rawRows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) pushRow();
  if (rawRows.length === 0) return [];
  const headers = rawRows[0];
  return rawRows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = r[i] ?? ""));
    return obj;
  });
}

export function toLeads(businesses: Business[]): Lead[] {
  return businesses.map(toLead);
}