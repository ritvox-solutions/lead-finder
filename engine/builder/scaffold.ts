import { cp, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename } from "node:path";
import { writeFileSync, readFileSync } from "node:fs";
import type { Business } from "../types.js";
import { sceneFor, taglineFor, servicesFor } from "./factory.js";
import { paletteFor } from "./palette.js";
import type { Palette } from "./palette.js";

export interface SiteConfig extends Palette {
  name: string;
  slug: string;
  tagline: string;
  category: string;
  description: string;
  phone: string | null;
  email: string | null;
  street: string | null;
  city: string | null;
  postcode: string | null;
  hours: string | null;
  heroScene: string;
  services: string[];
  ownerEmail: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * Copy the template into sites/<slug>/ and personalize lib/content.ts + palette
 * and page metadata. Returns the site dir + config used.
 */
export async function scaffoldSite(biz: Business, ownerEmail: string): Promise<{ dir: string; config: SiteConfig }> {
  const templateDir = join(process.cwd(), "templates", "next-site-baseline");
  const slug = slugify(biz.name);
  const outDir = join(process.cwd(), "sites", slug);

  if (!existsSync(templateDir)) throw new Error(`Template not found at ${templateDir}`);
  if (existsSync(outDir)) throw new Error(`Site already exists at ${outDir}`);

  await mkdir(outDir, { recursive: true });

  // Copy everything except node_modules, .next, .vercel, and the build artifacts.
  for (const entry of await readdir(templateDir)) {
    if (["node_modules", ".next", ".vercel", "package-lock.json"].includes(entry)) continue;
    await cp(join(templateDir, entry), join(outDir, entry), { recursive: true });
  }

  const palette = paletteFor(biz.category);
  const config: SiteConfig = {
    name: biz.name,
    slug,
    tagline: taglineFor(biz.category),
    category: biz.category,
    description: biz.name
      ? `${biz.name} — a local ${biz.category} business serving its community.`
      : `Local ${biz.category} business.`,
    phone: biz.phone,
    email: biz.email ?? null,
    street: biz.street,
    city: biz.city,
    postcode: biz.postcode,
    hours: biz.openingHours,
    heroScene: sceneFor(biz.category),
    services: servicesFor(biz.category),
    ownerEmail,
    ...palette,
  };

  // Write personalized content.ts
  const contentFile = join(outDir, "src", "lib", "content.ts");
  writeContentFile(contentFile, config);

  // Personalize site metadata name so package name is unique (Vercel-friendly).
  const pkg = join(outDir, "package.json");
  const pkgJson = JSON.parse(readFileSync(pkg, "utf8"));
  pkgJson.name = slug;
  writeFileSync(pkg, JSON.stringify(pkgJson, null, 2) + "\n");

  return { dir: outDir, config };
}

function writeContentFile(path: string, c: SiteConfig): void {
  const services = c.services.map((s) => `  ${JSON.stringify(s)}`).join(",\n");
  const file = `import { BusinessContent } from "./site";

// PERSONALIZED FOR THIS BUSINESS BY THE GENERATOR.
export const content: BusinessContent = {
  name: ${JSON.stringify(c.name)},
  tagline: ${JSON.stringify(c.tagline)},
  category: ${JSON.stringify(c.category)},
  description: ${JSON.stringify(c.description)},
  phone: ${JSON.stringify(c.phone)},
  email: ${JSON.stringify(c.email)},
  street: ${JSON.stringify(c.street)},
  city: ${JSON.stringify(c.city)},
  postcode: ${JSON.stringify(c.postcode)},
  hours: ${JSON.stringify(c.hours)},
  websiteContact: true,
  heroScene: ${JSON.stringify(c.heroScene)},
  services: [
${services}
  ],
  featuredImage: null,
  gallery: [],
};
`;
  writeFileSync(path, file);
}