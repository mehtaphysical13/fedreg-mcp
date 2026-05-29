/**
 * Normalize federalregister.gov payloads to our canonical Rule shape.
 * Pure functions, no I/O — easy to unit test.
 */

import type {
  FedRegAgencyRef,
  FedRegCfrReference,
  FedRegDocument,
} from "./fedreg";
import type {
  AgencyRef,
  CfrReference,
  CommentPeriod,
  Rule,
  RuleStage,
} from "./types";

export function normalizeDocument(doc: FedRegDocument): Rule {
  return {
    id: doc.document_number,
    docketId: doc.docket_id ?? doc.docket_ids?.[0],
    docketIds: dedupeStrings([
      ...(doc.docket_id ? [doc.docket_id] : []),
      ...(doc.docket_ids ?? []),
    ]),
    title: doc.title,
    abstract: doc.abstract ?? undefined,
    stage: classifyStage(doc),
    publishedAt: doc.publication_date,
    effectiveAt: doc.effective_on ?? undefined,
    commentPeriod: extractCommentPeriod(doc),
    agencies: (doc.agencies ?? []).map(normalizeAgency),
    cfrRefs: (doc.cfr_references ?? []).map(normalizeCfrRef),
    url: doc.html_url,
    sourceUrls: {
      html: doc.html_url,
      pdf: doc.pdf_url ?? undefined,
      rawText: doc.raw_text_url ?? undefined,
      json: doc.json_url ?? undefined,
    },
  };
}

export function classifyStage(doc: FedRegDocument): RuleStage {
  // The /documents/{id}.json response uses display strings ("Rule",
  // "Proposed Rule", ...); the search-result objects sometimes return codes.
  // Handle both.
  const t = doc.type as string | undefined;
  if (!t) return "other";
  const normalized = t.toLowerCase();
  if (normalized.includes("proposed")) return "proposed";
  if (normalized.includes("correct")) return "correction";
  if (normalized.includes("withdraw")) return "withdrawal";
  if (normalized === "rule" || normalized === "final rule") return "final";
  if (normalized.includes("presidential")) return "presidential";
  if (normalized === "notice" || normalized.includes("notice")) return "notice";
  // Codes
  if (t === "PRORULE") return "proposed";
  if (t === "RULE") return "final";
  if (t === "NOTICE") return "notice";
  if (t === "PRESDOCU") return "presidential";
  if (t === "CORRECT") return "correction";
  return "other";
}

export function extractCommentPeriod(
  doc: FedRegDocument
): CommentPeriod | undefined {
  const closesAt = doc.comments_close_on ?? undefined;
  if (!closesAt) return undefined;
  const today = new Date();
  const closes = new Date(closesAt + "T23:59:59Z");
  const isOpen = closes.getTime() >= today.getTime();
  const daysRemaining = isOpen
    ? Math.ceil((closes.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  return {
    opensAt: doc.publication_date,
    closesAt,
    isOpen,
    daysRemaining: isOpen ? daysRemaining : undefined,
  };
}

function normalizeAgency(a: FedRegAgencyRef): AgencyRef {
  return {
    slug: a.slug,
    name: a.name ?? a.raw_name ?? "Unknown agency",
    parentSlug: a.parent_id != null ? null : null, // parent slug requires a lookup; null for now
  };
}

function normalizeCfrRef(c: FedRegCfrReference): CfrReference {
  return {
    title: c.title,
    part: c.part,
    citation:
      c.citation ??
      (c.part != null ? `${c.title} CFR ${c.part}` : `${c.title} CFR`),
  };
}

function dedupeStrings(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}

/**
 * Group rules by docket and keep the most recent per stage. Useful when a
 * search returns the same rule's proposed + final + correction stages.
 */
export function dedupeAcrossStages(rules: Rule[]): Rule[] {
  const byKey = new Map<string, Rule>();
  for (const r of rules) {
    const key = `${r.docketId ?? r.id}:${r.stage}`;
    const existing = byKey.get(key);
    if (!existing || r.publishedAt > existing.publishedAt) {
      byKey.set(key, r);
    }
  }
  return [...byKey.values()].sort((a, b) =>
    a.publishedAt < b.publishedAt ? 1 : -1
  );
}
