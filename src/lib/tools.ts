/**
 * Tool definitions for the fedreg-mcp server.
 *
 * Each tool ships with an AEO-engineered description string. Agents pick
 * tools by reading these — verbs, positive examples, anti-examples, and
 * pitfall notes all move tool-selection accuracy. Iterate on descriptions
 * via the Phase 5 selection-accuracy eval, not by feel.
 */

import { z } from "zod";
import OpenAI from "openai";
import {
  searchArticles,
  getDocument,
  FEDREG_TOTAL_CAP,
  type FedRegDocCode,
} from "./fedreg.js";
import {
  getDocket,
  listComments,
  RegulationsGovKeyMissingError,
} from "./regulationsgov.js";
import {
  normalizeDocument,
  dedupeAcrossStages,
} from "./normalize.js";
import { resolveAgencies } from "./agencyHelp.js";
import type { Rule } from "./types.js";
import { describeUpstreamError } from "./http.js";
import { log } from "./logger.js";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO date YYYY-MM-DD");

// ===== Shared error helper =====

function toolError(message: string, hint?: string) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: hint ? `${message}\n\nHint: ${hint}` : message,
      },
    ],
  };
}

function ok(payload: unknown, text?: string) {
  return {
    content: [
      { type: "text" as const, text: text ?? JSON.stringify(payload, null, 2) },
    ],
    structuredContent: payload as Record<string, unknown>,
  };
}

const STAGE_TO_CODE: Record<string, FedRegDocCode> = {
  proposed: "PRORULE",
  final: "RULE",
  notice: "NOTICE",
  presidential: "PRESDOCU",
  correction: "CORRECT",
};

// ===== search_rules =====

export const searchRulesSchema = {
  query: z
    .string()
    .optional()
    .describe(
      "Free-text search across title and full text. Leave empty to filter by agency/stage/date only."
    ),
  agencies: z
    .array(z.string())
    .optional()
    .describe(
      'List of federal agencies. Accepts common names, abbreviations, or slugs (e.g. "EPA", "Environmental Protection Agency", "environmental-protection-agency"). Unresolved entries are returned in `unresolved_agencies` so the agent can correct and retry.'
    ),
  stage: z
    .enum(["proposed", "final", "notice", "presidential", "correction"])
    .optional()
    .describe(
      'Filter by rule stage. "proposed" = Notice of Proposed Rulemaking, "final" = Final Rule, "notice" = misc notice.'
    ),
  from_date: isoDate
    .optional()
    .describe("ISO date (YYYY-MM-DD). Inclusive lower bound on publication date."),
  to_date: isoDate
    .optional()
    .describe("ISO date (YYYY-MM-DD). Inclusive upper bound on publication date."),
  cfr_title: z
    .number()
    .int()
    .optional()
    .describe("Filter to a specific CFR title number (e.g. 40 for environmental)."),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Results per page (1-100, default 20). Keep small to stay under context limits."),
  page: z.number().int().min(1).optional().describe("1-indexed page number."),
  order: z
    .enum(["relevance", "newest", "oldest"])
    .optional()
    .describe('Sort order. Default "relevance" with a query, "newest" without.'),
};

export const searchRulesDescription = `Search U.S. Federal Register rules by free-text query (title + abstract + indexed body), agency, stage (proposed/final/notice), date range, and CFR title. Returns normalized rule records with title, abstract, agencies, CFR refs, comment period status, and citations.

Use this when the user wants to:
- "Find recent EPA proposed rules on PFAS" → query="PFAS", agencies=["EPA"], stage="proposed"
- "What climate-disclosure rules has the SEC published this year?" → query="climate disclosure", agencies=["SEC"], from_date="2026-01-01"
- "Show rules with open comment periods from the FDA" → agencies=["FDA"], stage="proposed", from_date="<60 days ago>"

Don't use this when:
- You already know the document number (use get_rule instead — cheaper and richer)
- You want public comments on a known docket (use get_comments)
- The user wants a summary of a single rule (use summarize_rule)

Pitfalls: leave query empty for pure browse-by-filter; use per_page=10-20 for chat contexts. The 'agencies' arg is fuzzy-resolved; resolved + unresolved slugs are returned in the response so you can correct and retry. The 'total' field is capped at 10000 — check 'total_is_capped' to know if more matched.`;

export async function searchRulesHandler(args: {
  query?: string;
  agencies?: string[];
  stage?: keyof typeof STAGE_TO_CODE;
  from_date?: string;
  to_date?: string;
  cfr_title?: number;
  per_page?: number;
  page?: number;
  order?: "relevance" | "newest" | "oldest";
}) {
  let agencySlugs: string[] | undefined;
  let resolvedAgencies: string[] = [];
  let unresolvedAgencies: string[] = [];
  if (args.agencies && args.agencies.length) {
    const { resolved, unresolved } = await resolveAgencies(args.agencies);
    resolvedAgencies = resolved;
    agencySlugs = resolved.length ? resolved : undefined;
    unresolvedAgencies = unresolved;
    if (!resolved.length && unresolved.length) {
      return toolError(
        `Could not resolve any of these agency names: ${unresolved.join(", ")}.`,
        "Try the full agency name (e.g. 'Environmental Protection Agency') or a standard abbreviation (EPA, FDA, SEC, FCC, ...)."
      );
    }
  }

  const page = args.page ?? 1;
  const perPage = args.per_page ?? 20;

  let res;
  try {
    res = await searchArticles({
      query: args.query,
      agencies: agencySlugs,
      type: args.stage ? [STAGE_TO_CODE[args.stage]] : undefined,
      fromDate: args.from_date,
      toDate: args.to_date,
      cfrTitle: args.cfr_title,
      perPage,
      page,
      order: args.order ?? (args.query ? "relevance" : "newest"),
    });
  } catch (e) {
    return toolError(
      `Search failed: ${describeUpstreamError(e)}.`,
      "Verify date format is YYYY-MM-DD and dates are in the past. CFR title 40 covers environmental; CFR title 21 covers food/drug."
    );
  }

  // Page beyond end of results: surface explicitly instead of silently
  // looping back to page 1.
  if (res.total_pages > 0 && page > res.total_pages) {
    return toolError(
      `Requested page ${page} is past the last page (${res.total_pages}).`,
      `This query has ${res.total_pages} pages of results at per_page=${perPage}. Request a page within range.`
    );
  }

  const rules: Rule[] = res.results.map(normalizeDocument);

  if (rules.length === 0) {
    return toolError(
      "No rules matched those filters.",
      "Try broadening the date range, removing the agency filter, or rephrasing the query. CFR title 40 covers environmental; CFR title 21 covers food/drug."
    );
  }

  const totalIsCapped = res.count >= FEDREG_TOTAL_CAP;
  const payload = {
    total: res.count,
    total_is_capped: totalIsCapped,
    page,
    per_page: perPage,
    total_pages: res.total_pages,
    resolved_agencies: resolvedAgencies.length ? resolvedAgencies : undefined,
    unresolved_agencies: unresolvedAgencies.length ? unresolvedAgencies : undefined,
    rules,
  };
  return ok(payload);
}

// ===== get_rule =====

export const getRuleSchema = {
  document_number: z
    .string()
    .describe(
      'Federal Register document number, e.g. "2026-10643". Returned in the `id` field of search results.'
    ),
};

export const getRuleDescription = `Fetch the canonical metadata for a single Federal Register rule by its document number: title, abstract, agencies, CFR references, comment period, effective date, and citation URLs (including a raw-text URL for the full document body).

Use this when:
- You have a document_number from a prior search_rules call and want the metadata record.
- The user references a specific rule ID (e.g. "tell me about 2026-10643").

Don't use this when:
- You don't have a document number — use search_rules instead.
- You need the body text of the rule — fetch sourceUrls.rawText with a regular HTTP GET.

Pitfalls: document numbers look like "YYYY-NNNNN". They're NOT interchangeable with docket IDs (which have agency prefixes, e.g. "EPA-HQ-OAR-2024-0001"). Use get_comments for docket-level data.`;

export async function getRuleHandler(args: { document_number: string }) {
  try {
    const doc = await getDocument(args.document_number);
    return ok(normalizeDocument(doc));
  } catch (e) {
    return toolError(
      `Could not fetch document ${args.document_number}: ${describeUpstreamError(e)}.`,
      "Verify the document number (format: YYYY-NNNNN). Numbers come from search_rules results."
    );
  }
}

// ===== list_recent =====

export const listRecentSchema = {
  agency: z
    .string()
    .optional()
    .describe(
      'Single federal agency (name, abbreviation, or slug). Omit for cross-agency feed.'
    ),
  stage: z
    .enum(["proposed", "final", "notice", "presidential", "correction"])
    .optional()
    .describe("Filter to one rule stage. Omit for all stages."),
  days_back: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe("How many days back to look (default 7, max 365)."),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Results per page (1-50, default 20)."),
};

export const listRecentDescription = `List recently published Federal Register documents, optionally filtered by agency and/or stage. Sorted newest-first.

Use this for:
- "What did the EPA publish this week?" → agency="EPA", days_back=7
- "Show all final rules from the last 3 days" → stage="final", days_back=3
- "What's new across the federal government today?" → days_back=1

Don't use this when the user has a specific query — use search_rules.`;

export async function listRecentHandler(args: {
  agency?: string;
  stage?: keyof typeof STAGE_TO_CODE;
  days_back?: number;
  per_page?: number;
}) {
  const daysBack = args.days_back ?? 7;
  const perPage = args.per_page ?? 20;
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - daysBack);
  const fromDate = from.toISOString().slice(0, 10);

  let agencySlugs: string[] | undefined;
  let resolvedAgencies: string[] = [];
  if (args.agency) {
    const { resolved } = await resolveAgencies([args.agency]);
    if (!resolved.length) {
      return toolError(
        `Could not resolve agency "${args.agency}".`,
        "Try the full agency name or a standard abbreviation (EPA, FDA, SEC, ...)."
      );
    }
    agencySlugs = resolved;
    resolvedAgencies = resolved;
  }

  let res;
  try {
    res = await searchArticles({
      agencies: agencySlugs,
      type: args.stage ? [STAGE_TO_CODE[args.stage]] : undefined,
      fromDate,
      perPage,
      order: "newest",
    });
  } catch (e) {
    return toolError(
      `list_recent failed: ${describeUpstreamError(e)}.`,
      "Retry shortly; if it persists, drop the agency or stage filter."
    );
  }

  const rules = dedupeAcrossStages(res.results.map(normalizeDocument));

  if (rules.length === 0) {
    return toolError(
      `Nothing published in the last ${daysBack} days matching those filters.`,
      "Try increasing days_back, removing the agency filter, or omitting the stage filter."
    );
  }

  // Mirror the search_rules envelope so agents can reuse parsing logic.
  return ok({
    total: res.count,
    total_is_capped: res.count >= FEDREG_TOTAL_CAP,
    page: 1,
    per_page: perPage,
    total_pages: res.total_pages,
    days_back: daysBack,
    resolved_agencies: resolvedAgencies.length ? resolvedAgencies : undefined,
    rules,
  });
}

// ===== get_comments =====

export const getCommentsSchema = {
  docket_id: z
    .string()
    .describe(
      'Regulations.gov docket id, e.g. "EPA-HQ-OAR-2024-0001". Different from the Federal Register document_number.'
    ),
  per_page: z
    .number()
    .int()
    .min(5)
    .max(100)
    .optional()
    .describe("Comments per page (5-100, default 25)."),
  page: z.number().int().min(1).optional().describe("1-indexed page."),
  sort: z
    .enum(["newest", "oldest"])
    .optional()
    .describe('Sort by posted date. Default "newest".'),
};

export const getCommentsDescription = `Fetch public comments submitted to a Regulations.gov docket. Returns commenter org, posted date, title, and the link to the full comment text.

Use this when:
- The user asks about public reaction to a specific rule.
- You have a docket_id from a search_rules or get_rule result.

Don't use this when:
- You only have a Federal Register document_number — those aren't docket IDs. The 'docketId' field on a Rule object is what to pass here.

Pitfalls: requires a free api.data.gov key in REGULATIONS_GOV_API_KEY. If unset, the tool returns a clear setup instruction.`;

export async function getCommentsHandler(args: {
  docket_id: string;
  per_page?: number;
  page?: number;
  sort?: "newest" | "oldest";
}) {
  try {
    const [docket, comments] = await Promise.all([
      getDocket(args.docket_id),
      listComments({
        docketId: args.docket_id,
        perPage: args.per_page ?? 25,
        page: args.page ?? 1,
        sort: args.sort === "oldest" ? "postedDate" : "-postedDate",
      }),
    ]);
    return ok({
      docket: docket
        ? {
            id: docket.id,
            title: docket.attributes.title,
            agency: docket.attributes.agencyId,
            rin: docket.attributes.rin,
          }
        : null,
      total: comments.meta?.totalElements ?? comments.data.length,
      page: comments.meta?.pageNumber ?? args.page ?? 1,
      page_size: comments.meta?.pageSize ?? args.per_page ?? 25,
      total_pages: comments.meta?.totalPages,
      comments: comments.data.map((c) => ({
        id: c.id,
        title: c.attributes.title,
        organization: c.attributes.organization,
        commenter:
          [c.attributes.firstName, c.attributes.lastName]
            .filter(Boolean)
            .join(" ") || undefined,
        posted_at: c.attributes.postedDate,
        document_type: c.attributes.documentType,
        url: c.links?.self,
      })),
    });
  } catch (e) {
    if (e instanceof RegulationsGovKeyMissingError) {
      return toolError(
        e.message,
        "Add REGULATIONS_GOV_API_KEY to the server's environment, then retry."
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    return toolError(
      `Failed to fetch comments for docket ${args.docket_id}: ${msg}`,
      'Docket IDs look like "EPA-HQ-OAR-2024-0001". Confirm the docket_id from a Rule.docketId field.'
    );
  }
}

// ===== summarize_rule =====

export const summarizeRuleSchema = {
  document_number: z
    .string()
    .describe(
      'Federal Register document number to summarize (e.g. "2026-10643").'
    ),
  audience: z
    .enum(["executive", "legal", "technical"])
    .optional()
    .describe(
      'Tone of the summary. "executive" = ~150 words, plain language; "legal" = focuses on obligations + dates; "technical" = focuses on the rule mechanics. Default "executive".'
    ),
};

export const summarizeRuleDescription = `Generate a short summary of a Federal Register rule (executive / legal / technical tones), with anchored citations back to the source. Uses an LLM under the hood (OpenRouter or OpenAI).

Use this when:
- The user wants a quick read on a specific rule by document number.
- Combined with get_rule: you can fetch the metadata, then summarize the abstract.

Don't use this when:
- The user wants a deep legal analysis (this is a summary, not a brief).
- You don't have a document number — search_rules first.

Pitfalls: requires OPENROUTER_API_KEY or OPENAI_API_KEY on the server. Costs sub-cent per call.`;

/**
 * Resolve LLM credentials. Prefers OpenRouter (works with the existing
 * Tool-Factory shared key) and falls back to OpenAI direct. Returns null
 * when neither is configured.
 */
function resolveLlmClient(): { client: OpenAI; model: string } | null {
  if (process.env.OPENROUTER_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": "https://fedreg-mcp.vercel.app",
          "X-Title": "fedreg-mcp",
        },
      }),
      model: "openai/gpt-4o-mini",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: "gpt-4o-mini",
    };
  }
  return null;
}

export async function summarizeRuleHandler(args: {
  document_number: string;
  audience?: "executive" | "legal" | "technical";
}) {
  const audience = args.audience ?? "executive";
  const llm = resolveLlmClient();
  if (!llm) {
    return toolError(
      "No LLM credentials configured on the server (looking for OPENROUTER_API_KEY or OPENAI_API_KEY).",
      "summarize_rule needs an LLM key. Until then, use get_rule to retrieve the abstract directly."
    );
  }

  let doc;
  try {
    doc = await getDocument(args.document_number);
  } catch (e) {
    return toolError(
      `Could not fetch document ${args.document_number}: ${e instanceof Error ? e.message : String(e)}`,
      "Confirm the document number from a search_rules result."
    );
  }

  const rule = normalizeDocument(doc);
  const audienceSystem: Record<typeof audience, string> = {
    executive:
      "You are a regulatory analyst. Write a concise executive summary (~150 words) in plain language. Lead with the bottom line.",
    legal:
      "You are a regulatory attorney. Write a summary focused on legal obligations, affected parties, effective dates, and comment-period mechanics.",
    technical:
      "You are a technical analyst. Write a summary focused on the rule's substantive mechanics, thresholds, definitions, and methodologies.",
  };
  const userPrompt = `Summarize this Federal Register ${rule.stage} rule.

Title: ${rule.title}
Agencies: ${rule.agencies.map((a) => a.name).join(", ")}
Published: ${rule.publishedAt}
${rule.commentPeriod ? `Comment period closes: ${rule.commentPeriod.closesAt}` : ""}
${rule.cfrRefs.length ? `Affected CFR: ${rule.cfrRefs.map((c) => c.citation).join(", ")}` : ""}

Abstract:
${rule.abstract ?? "(no abstract provided)"}

Source: ${rule.url}

End the summary with a single citation line in the format: "Source: <url>".`;

  try {
    const start = Date.now();
    const completion = await llm.client.chat.completions.create({
      model: llm.model,
      messages: [
        { role: "system", content: audienceSystem[audience] },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 500,
    });
    const summary = completion.choices[0]?.message?.content ?? "";
    log.outbound({
      source: process.env.OPENROUTER_API_KEY ? "openrouter" : "openai",
      endpoint: "/chat/completions",
      method: "POST",
      paramsShape: { model: "string", audience: "string" },
      status: 200,
      latencyMs: Date.now() - start,
    });
    return ok({
      document_number: rule.id,
      audience,
      summary,
      citation: rule.url,
      title: rule.title,
      stage: rule.stage,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error("openai summarize failed", { msg });
    return toolError(
      `LLM summarization failed: ${msg}`,
      "Retry; if it persists, fall back to get_rule and read the abstract directly."
    );
  }
}
