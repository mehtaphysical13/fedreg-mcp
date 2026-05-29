/**
 * Canonical domain types — the shape agents see, decoupled from any single
 * upstream API. Adding a new data source means writing a normalizer to this
 * shape, not changing tool surface.
 */

export type RuleStage =
  | "proposed" // notice of proposed rulemaking
  | "final" // final rule
  | "correction" // correction to a previously published rule
  | "withdrawal" // withdrawal of a previously published rule
  | "notice" // misc notice (incl. ANPRM, request for comment, etc.)
  | "presidential" // executive order, proclamation, etc.
  | "other";

export interface CommentPeriod {
  opensAt?: string; // ISO date
  closesAt?: string; // ISO date
  isOpen: boolean;
  daysRemaining?: number; // null if closed or unknown
}

export interface AgencyRef {
  slug?: string;
  name: string;
  shortName?: string;
  parentSlug?: string | null;
}

export interface CfrReference {
  title: number;
  part?: string; // CFR parts can include subparts/letters (e.g. "260", "260.10", "63 Subpart A")
  citation?: string; // e.g. "40 CFR 52"
}

export interface Rule {
  /** Federal Register document number — stable canonical id. */
  id: string;
  /** Docket id (links rule across stages and to comments). */
  docketId?: string;
  /** All docket ids associated with the document. */
  docketIds: string[];
  title: string;
  abstract?: string;
  stage: RuleStage;
  publishedAt: string; // YYYY-MM-DD
  effectiveAt?: string;
  commentPeriod?: CommentPeriod;
  agencies: AgencyRef[];
  cfrRefs: CfrReference[];
  /** Canonical Federal Register HTML URL — what we cite to. */
  url: string;
  sourceUrls: {
    html: string;
    pdf?: string;
    rawText?: string;
    json?: string;
  };
}

export interface SearchResult {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  rules: Rule[];
}
