/**
 * Helpers for resolving agency input the way an agent or human would phrase
 * it (full name, abbreviation, common alias) to the slug form the
 * federalregister.gov API expects.
 *
 * We pull the canonical list at runtime from listAgencies() so we never have
 * to hand-maintain a 470-entry constant. Common aliases are layered on top.
 */

import { listAgencies, type FedRegAgency } from "./fedreg";

let cached: { byInput: Map<string, string>; loadedAt: number } | null = null;
const TTL_MS = 24 * 60 * 60 * 1000;

const COMMON_ALIASES: Record<string, string> = {
  // abbreviation → slug
  epa: "environmental-protection-agency",
  fda: "food-and-drug-administration",
  sec: "securities-and-exchange-commission",
  ftc: "federal-trade-commission",
  fcc: "federal-communications-commission",
  cfpb: "consumer-financial-protection-bureau",
  doj: "justice-department",
  dot: "transportation-department",
  hhs: "health-and-human-services-department",
  irs: "internal-revenue-service",
  ssa: "social-security-administration",
  va: "veterans-affairs-department",
  nasa: "national-aeronautics-and-space-administration",
  nrc: "nuclear-regulatory-commission",
  noaa: "national-oceanic-and-atmospheric-administration",
  faa: "federal-aviation-administration",
  fra: "federal-railroad-administration",
  fmcsa: "federal-motor-carrier-safety-administration",
  uscbp: "u-s-customs-and-border-protection",
  uscis: "u-s-citizenship-and-immigration-services",
  hud: "housing-and-urban-development-department",
  usda: "agriculture-department",
  dod: "defense-department",
  doe: "energy-department",
  dol: "labor-department",
  cms: "centers-for-medicare-medicaid-services",
  cdc: "centers-for-disease-control-and-prevention",
};

function normKey(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ");
}

async function ensureIndex(): Promise<Map<string, string>> {
  if (cached && Date.now() - cached.loadedAt < TTL_MS) return cached.byInput;
  const agencies = await listAgencies();
  const m = new Map<string, string>();
  for (const a of agencies) {
    addEntry(m, a.slug, a.slug);
    if (a.name) addEntry(m, normKey(a.name), a.slug);
    if (a.short_name) addEntry(m, normKey(a.short_name), a.slug);
  }
  for (const [alias, slug] of Object.entries(COMMON_ALIASES)) {
    addEntry(m, alias, slug);
  }
  cached = { byInput: m, loadedAt: Date.now() };
  return m;
}

function addEntry(m: Map<string, string>, key: string, slug: string) {
  if (!key) return;
  if (!m.has(key)) m.set(key, slug);
}

/**
 * Resolve a user-facing agency string ("EPA", "Environmental Protection
 * Agency", "environmental-protection-agency") to the slug the API expects.
 * Returns null when we can't resolve confidently.
 */
export async function resolveAgency(input: string): Promise<string | null> {
  const idx = await ensureIndex();
  const k = normKey(input);
  return idx.get(k) ?? idx.get(input.toLowerCase().trim()) ?? null;
}

export async function resolveAgencies(inputs: string[]): Promise<{
  resolved: string[];
  unresolved: string[];
}> {
  const resolved: string[] = [];
  const unresolved: string[] = [];
  for (const i of inputs) {
    const slug = await resolveAgency(i);
    if (slug) resolved.push(slug);
    else unresolved.push(i);
  }
  return { resolved: Array.from(new Set(resolved)), unresolved };
}

export async function findAgencyBySlug(
  slug: string
): Promise<FedRegAgency | null> {
  const agencies = await listAgencies();
  return agencies.find((a) => a.slug === slug) ?? null;
}
