/**
 * Wrapper for the federalregister.gov public JSON API.
 * Docs: https://www.federalregister.gov/developers/documentation/api/v1
 * No auth required.
 */

import { makeHttpClient } from "./http.js";
import { TtlCache } from "./cache.js";

const client = makeHttpClient({
  source: "federalregister",
  baseUrl: "https://www.federalregister.gov/api/v1",
  timeoutMs: 8_000,
});

const cache = new TtlCache<unknown>(500);

// ---- Types reflecting the upstream API (subset we use) ----

/**
 * Codes accepted by `conditions[type][]` on search. Quirk: the response
 * object returns the human-readable form in its `type` field, NOT these
 * codes. See `FedRegDocType`.
 */
export type FedRegDocCode =
  | "RULE"
  | "PRORULE"
  | "NOTICE"
  | "PRESDOCU"
  | "CORRECT";

/**
 * Values returned in the `type` field of document responses. Different
 * from the search filter codes above.
 */
export type FedRegDocType =
  | "Rule"
  | "Proposed Rule"
  | "Notice"
  | "Presidential Document"
  | "Correction"
  | "Uncategorized Document";

export interface FedRegAgencyRef {
  raw_name?: string;
  name?: string;
  id?: number;
  slug?: string;
  parent_id?: number | null;
}

export interface FedRegCfrReference {
  title: number;
  part?: string | number;
  citation?: string;
}

export interface FedRegDocument {
  document_number: string;
  title: string;
  abstract?: string;
  type: FedRegDocType;
  publication_date: string; // YYYY-MM-DD
  effective_on?: string | null;
  comments_close_on?: string | null;
  comment_url?: string | null;
  docket_id?: string;
  docket_ids?: string[];
  agencies?: FedRegAgencyRef[];
  cfr_references?: FedRegCfrReference[];
  html_url: string;
  pdf_url?: string;
  raw_text_url?: string;
  json_url?: string;
  president?: { name?: string } | null;
  regulation_id_number_info?: Record<string, unknown>;
}

export interface FedRegSearchResponse {
  count: number;
  description?: string;
  total_pages: number;
  next_page_url?: string | null;
  previous_page_url?: string | null;
  results: FedRegDocument[];
}

export interface FedRegAgency {
  id: number;
  name: string;
  short_name?: string | null;
  slug: string;
  parent_id?: number | null;
  url?: string;
  description?: string | null;
}

// ---- Public API ----

export interface SearchArticlesParams {
  query?: string;
  agencies?: string[]; // slugs
  type?: FedRegDocCode[]; // search filter codes (RULE/PRORULE/etc.), not response strings
  fromDate?: string; // YYYY-MM-DD
  toDate?: string;
  cfrTitle?: number;
  cfrPart?: number;
  perPage?: number; // max 1000, default 20
  page?: number;
  order?: "relevance" | "newest" | "oldest";
  correlationId?: string;
}

/**
 * Default field set we request on every search so results can be normalized
 * to our canonical `Rule` shape without a follow-up getDocument call per row.
 */
const DEFAULT_SEARCH_FIELDS: string[] = [
  "document_number",
  "title",
  "abstract",
  "type",
  "publication_date",
  "effective_on",
  "comments_close_on",
  "comment_url",
  "docket_id",
  "docket_ids",
  "agencies",
  "cfr_references",
  "html_url",
  "pdf_url",
  "raw_text_url",
  "json_url",
];

/**
 * Federal Register API caps `total` at 10,000 even when more documents match.
 * When we see that ceiling we expose it explicitly so callers don't mistake
 * the cap for an exact count.
 */
export const FEDREG_TOTAL_CAP = 10_000;

export async function searchArticles(
  params: SearchArticlesParams
): Promise<FedRegSearchResponse> {
  const query: Record<string, string | number | string[] | undefined> = {
    per_page: params.perPage ?? 20,
    page: params.page ?? 1,
    order: params.order ?? "relevance",
    "fields[]": DEFAULT_SEARCH_FIELDS,
  };
  if (params.query) query["conditions[term]"] = params.query;
  if (params.agencies && params.agencies.length)
    query["conditions[agencies][]"] = params.agencies;
  if (params.type && params.type.length)
    query["conditions[type][]"] = params.type;
  if (params.fromDate) query["conditions[publication_date][gte]"] = params.fromDate;
  if (params.toDate) query["conditions[publication_date][lte]"] = params.toDate;
  if (params.cfrTitle !== undefined)
    query["conditions[cfr][title]"] = params.cfrTitle;
  if (params.cfrPart !== undefined)
    query["conditions[cfr][part]"] = params.cfrPart;

  const raw = await client.request<Partial<FedRegSearchResponse>>(
    "documents.json",
    {
      query,
      correlationId: params.correlationId,
    }
  );

  // Normalize the upstream shape:
  //  - empty searches omit `results` entirely (not an empty array)
  //  - empty searches omit `count` / `total_pages`
  return {
    count: raw.count ?? 0,
    description: raw.description,
    total_pages: raw.total_pages ?? 0,
    next_page_url: raw.next_page_url ?? null,
    previous_page_url: raw.previous_page_url ?? null,
    results: raw.results ?? [],
  };
}

export async function getDocument(
  documentNumber: string,
  correlationId?: string
): Promise<FedRegDocument> {
  const key = `doc:${documentNumber}`;
  return cache.wrap(key, 6 * 60 * 60, () =>
    client.request<FedRegDocument>(`documents/${encodeURIComponent(documentNumber)}.json`, {
      correlationId,
    })
  );
}

export async function listAgencies(
  correlationId?: string
): Promise<FedRegAgency[]> {
  return cache.wrap("agencies:all", 24 * 60 * 60, () =>
    client.request<FedRegAgency[]>("agencies.json", { correlationId })
  );
}
