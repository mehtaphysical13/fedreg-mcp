/**
 * Wrapper for the regulations.gov v4 public API.
 * Docs: https://open.gsa.gov/api/regulationsgov/
 * Requires a free api.data.gov key in REGULATIONS_GOV_API_KEY.
 */

import { makeHttpClient } from "./http";
import { TtlCache } from "./cache";

const cache = new TtlCache<unknown>(500);

function client() {
  const key = process.env.REGULATIONS_GOV_API_KEY;
  if (!key) {
    throw new RegulationsGovKeyMissingError();
  }
  return makeHttpClient({
    source: "regulationsgov",
    baseUrl: "https://api.regulations.gov/v4",
    defaultHeaders: { "X-Api-Key": key },
    timeoutMs: 10_000,
  });
}

export class RegulationsGovKeyMissingError extends Error {
  constructor() {
    super(
      "REGULATIONS_GOV_API_KEY env var is not set. Get a free key at https://api.data.gov/signup/."
    );
  }
}

// ---- Types (subset of the v4 API) ----

export interface RegGovDocketAttributes {
  agencyId?: string;
  category?: string;
  docketType?: string;
  effectiveDate?: string | null;
  generic?: boolean;
  keywords?: string[] | null;
  modifyDate?: string | null;
  objectId?: string;
  rin?: string | null;
  shortTitle?: string | null;
  title?: string;
}

export interface RegGovDocket {
  id: string;
  type: "dockets";
  attributes: RegGovDocketAttributes;
  links?: { self?: string };
}

export interface RegGovCommentAttributes {
  agencyId?: string;
  commentOn?: string | null;
  commentOnDocumentId?: string | null;
  docketId?: string | null;
  documentType?: string;
  firstName?: string | null;
  lastName?: string | null;
  organization?: string | null;
  postedDate?: string;
  receiveDate?: string;
  title?: string;
  subtype?: string | null;
  withdrawn?: boolean;
}

export interface RegGovComment {
  id: string;
  type: "comments";
  attributes: RegGovCommentAttributes;
  links?: { self?: string };
}

export interface RegGovListResponse<T> {
  data: T[];
  meta?: {
    totalElements?: number;
    pageNumber?: number;
    pageSize?: number;
    totalPages?: number;
  };
}

// ---- Public API ----

export async function getDocket(
  docketId: string,
  correlationId?: string
): Promise<RegGovDocket | null> {
  const key = `docket:${docketId}`;
  return cache.wrap(key, 60 * 60, async () => {
    const res = await client().request<{ data: RegGovDocket }>(
      `dockets/${encodeURIComponent(docketId)}`,
      { correlationId }
    );
    return res.data;
  }) as Promise<RegGovDocket | null>;
}

export interface ListCommentsParams {
  docketId: string;
  perPage?: number; // 5-250, default 25
  page?: number;
  sort?:
    | "postedDate"
    | "-postedDate"
    | "lastModifiedDate"
    | "-lastModifiedDate";
  correlationId?: string;
}

export async function listComments(
  params: ListCommentsParams
): Promise<RegGovListResponse<RegGovComment>> {
  const query: Record<string, string | number | undefined> = {
    "filter[docketId]": params.docketId,
    "page[size]": params.perPage ?? 25,
    "page[number]": params.page ?? 1,
    sort: params.sort ?? "-postedDate",
  };
  return client().request<RegGovListResponse<RegGovComment>>("comments", {
    query,
    correlationId: params.correlationId,
  });
}
