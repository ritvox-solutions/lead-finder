export type LeadStatus = "new" | "building" | "built" | "deployed" | "approved" | "pitched" | "interested" | "rejected";
export type SiteStatus = "built" | "deployed" | "approved" | "pitched" | "rejected";

export interface Lead {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  website: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  city: string | null;
  postcode: string | null;
  openingHours: string | null;
  instagram: string | null;
  facebook: string | null;
  tags: Record<string, string>;
  raw: unknown;
  score: number;
  reasons: string[];
  likelyWebsiteAbsent: boolean;
  status: LeadStatus;
  siteSlug: string | null;
  siteUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Site {
  slug: string;
  leadId: string | null;
  dir: string;
  status: SiteStatus;
  liveUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Reply {
  id: number;
  leadId: string | null;
  sender: string;
  subject: string;
  snippet: string;
  positive: boolean;
  reasons: string;
  seenAt: string;
}

export interface AgentSettings {
  scanArea: string;
  radiusKm: number;
  minScore: number;
  yourName: string;
  yourBusiness: string;
  ownerEmail: string;
  autoScanEnabled: boolean;
  scanIntervalMinutes: number;
  lastScanAt: string;
  /** Last on-demand scan submitted from the dashboard, for status display. */
  lastManualScan: ManualScanInfo | null;
}

export interface ManualScanInfo {
  location: string;
  niche: string;
  radiusKm: number;
  found: number;
  added: number;
  label: string;
  coords: { lat: number; lon: number } | null;
  source: string;
  at: string;
  ok: boolean;
  error?: string;
}

export type ScanProgressStage =
  | "geocoding"
  | "querying"
  | "filtering"
  | "enriching"
  | "scoring"
  | "writing"
  | "done"
  | "error";

export interface ScanLogLine {
  time: string;
  tag: "SYS" | "NET" | "BOT" | "OUT" | "ERR";
  msg: string;
}

/** Live progress of the on-demand scan, exposed via /state so the dashboard
 * console can render the mission while running. */
export interface ScanProgress {
  active: boolean;
  stage: ScanProgressStage;
  operation: string;
  percent: number;
  location: string;
  niche: string;
  radiusKm: number;
  found: number;
  noWebsite: number;
  enriched: number;
  added: number;
  startedAt: string;
  updatedAt: string;
  logs: ScanLogLine[];
  error?: string;
}

export interface AppState {
  version: number;
  updatedAt: string;
  settings: AgentSettings;
  leads: Record<string, Lead>;
  sites: Record<string, Site>;
  replies: Reply[];
  pendingActions: PendingAction[];
  /** Live progress of an in-flight on-demand scan, for the mission console. */
  scanProgress?: ScanProgress | null;
}

export interface PendingAction {
  id: string;
  action: "approve" | "reject" | "scan";
  slug: string;
  requestedBy: string;
  requestedAt: string;
  /** Only present for `scan` actions: the location to scan around. */
  location?: string;
  /** Niche keyword(s) to filter the scan, e.g. "gym", "pub, bar". */
  niche?: string;
  radiusKm?: number;
  minScore?: number;
}
