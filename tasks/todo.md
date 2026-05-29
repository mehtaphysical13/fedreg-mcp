# fedreg-mcp — Build Plan (Tool #1 from the Factory)

## Goal
Ship a production-grade MCP server that gives agents first-class access to U.S. Federal Register rules + Regulations.gov public comments. End-to-end: data → normalize → MCP surface → Vercel deploy → AEO submissions → telemetry. Use this build to discover the right abstractions for the Factory template (Tool #2 will reuse them).

## Strategic frame
- **Wedge:** U.S. federal regulatory data. Underbuilt in MCP land, strong B2B path (gov-affairs, legal, compliance, lobbying).
- **Avoid commoditization:** Don't just wrap the APIs. Value-add is normalization (agency taxonomy, CFR linking, stage classification, dedup) + clean tool ergonomics + reliability.
- **AEO from day one:** Registry presence, description engineering, demo agent, head-to-head benchmark.
- **Telemetry is the strategic asset:** Every call logged (anonymized) feeds the Gap Radar that informs Tool #2.

## Architecture
- **Stack:** TypeScript, Vercel serverless functions, `@modelcontextprotocol/sdk` over Streamable HTTP transport.
- **Repo:** `mehtaphysical13/fedreg-mcp` (per global instructions).
- **Deploy:** Vercel project `fedreg-mcp`, prod URL `fedreg-mcp.vercel.app` (custom domain later).
- **Landing page:** Minimal Vite + React page at `/` with install instructions, demo, link to source. Doubles as AEO surface (Google + LLM-citation traffic).
- **MCP endpoint:** `/api/mcp` (Streamable HTTP). Anonymous v1 (no auth) — public data, no PII risk.
- **Data sources:**
  - `federalregister.gov` JSON API (no key required)
  - `api.regulations.gov` (free `api.data.gov` key)
- **Caching:** In-memory LRU for v1; revisit Vercel KV once we have traffic data.
- **No DB in v1.** Telemetry goes to Vercel Postgres only if call volume justifies it; otherwise stdout → Vercel logs.

## Phase 0 — Project scaffold (~2 hours) ✅
- [x] `git init` at `/Users/nickmehta/Tool Factory/fedreg-mcp`
- [x] `package.json` (type: module) with deps: `@modelcontextprotocol/sdk`, `zod`, `@vercel/node`, `tiny-lru`, `openai`; dev: `typescript`, `@types/node`, `vite`, `@vitejs/plugin-react`, `react`, `react-dom`, `vitest`
- [x] `tsconfig.json`, `vercel.json`, `.gitignore`, `.env.example`, `README.md`
- [x] Create GitHub repo `mehtaphysical13/fedreg-mcp` (public), push initial commit → https://github.com/mehtaphysical13/fedreg-mcp
- [x] Link Vercel project, deploy hello-world, verify build green → https://fedreg-mcp.vercel.app (health: ✅, landing: ✅)
- [ ] Configure `REGULATIONS_GOV_API_KEY` + `OPENAI_API_KEY` env vars (deferred to Phase 1 / Phase 3 when needed)

## Phase 1 — Data layer (~3 hours) ✅
- [x] `src/lib/logger.ts` — structured JSON logging (outbound + tool-call shapes, `shapeOf()` helper to log params without leaking values)
- [x] `src/lib/cache.ts` — TtlCache wrapper around tiny-lru with `wrap()` helper
- [x] `src/lib/http.ts` — factory-reusable HTTP client with logging, timeouts, typed errors
- [x] `src/lib/fedreg.ts` — `searchArticles`, `getDocument`, `listAgencies` — verified live (smoke test green)
- [x] `src/lib/regulationsgov.ts` — `getDocket`, `listComments` (verification pending API key)
- [x] Live smoke script: `scripts/smoke-fedreg.ts` (470 agencies returned, sample search 246 hits, getDocument round-trip 119ms)
- [ ] Vitest unit tests (deferred to Phase 4 verification gate — smoke script is sufficient signal for now)

## Phase 2 — Normalization layer (~3 hours)
- [ ] `src/lib/types.ts` — canonical `Rule` type: `{ id, docketId, title, abstract, agencies[], stage, publishedAt, effectiveAt, commentPeriod, cfrRefs[], url, sourceUrls[] }`
- [ ] `src/lib/normalize.ts`:
  - `normalizeArticle(raw)` → `Rule`
  - `classifyStage(raw)` → `'proposed' | 'final' | 'correction' | 'withdrawal' | 'notice'`
  - `extractCommentPeriod(raw)` → `{ opensAt, closesAt, isOpen } | null`
  - `resolveCfrRefs(raw)` → `[{ title, part, sectionRange }]`
  - `dedupeAcrossStages(rules)` — group by docket, keep latest per stage
- [ ] Agency taxonomy constants (`src/lib/agencies.ts`) — slug, name, parent, abbreviation

## Phase 3 — MCP surface (~3 hours)
- [ ] `api/mcp.ts` — Streamable HTTP MCP server entry point
- [ ] Tool: `search_rules` — full-text + filters (agency, date range, CFR title, stage)
- [ ] Tool: `get_rule` — full document + metadata + citations by document number
- [ ] Tool: `list_recent` — recent rules by agency or topic, with stage filter
- [ ] Tool: `get_comments` — public comments on a docket
- [ ] Tool: `summarize_rule` — LLM-generated exec summary with anchored citations (uses OpenAI; logs the call)
- [ ] For each tool: Zod input schema + **AEO-optimized description string** (verbs, capabilities, 2 positive examples, 1 anti-example, common-pitfall guidance)
- [ ] Errors that teach the next move (e.g., "no results — try broadening date range or removing agency filter"), never opaque 500s
- [ ] All tool calls run through telemetry middleware

## Phase 4 — Deploy & verify (~1 hour)
- [ ] Vercel deploy
- [ ] Smoke test via Claude Desktop (add as MCP server pointing at `https://fedreg-mcp.vercel.app/api/mcp`)
- [ ] Smoke test via Claude Code
- [ ] Health-check at `/api/health`
- [ ] **Subagent test loop** (per global instruction): spawn agent to exercise all 5 tools end-to-end, report bugs/UX issues, fix before moving on

## Phase 5 — AEO (~3 hours)
- [ ] Landing page (`/`): install instructions for Claude Desktop / Claude Code / Cursor, live demo, 3 example queries, link to GitHub
- [ ] Submit to Anthropic MCP registry
- [ ] Submit to Smithery
- [ ] Submit to mcp.so + mcphub.io
- [ ] Description engineering: write 3 candidate descriptions per tool, run synthetic-task eval (agent picks correct tool given a query), keep the winner
- [ ] Benchmark post: head-to-head vs. existing fed-data MCP servers on 20 synthetic queries; publish to repo README

## Phase 6 — Telemetry (~2 hours)
- [ ] Middleware logs every tool call: `{ tool, args_shape, latency_ms, success, downstream_sequence_hint }` — no PII, no raw query text
- [ ] `/api/admin/stats` (Basic Auth) — call volume, top tools, p50/p95 latency, error rate
- [ ] Daily export job (Vercel cron) → JSON snapshot → Gap Radar input for Tool #2

## Phase 7 — Extract Factory template (~3 hours)
- [ ] Identify reusable abstractions: `dataWrapper()` pattern, MCP scaffold, deploy config, telemetry middleware, AEO checklist, description-engineering harness
- [ ] Spin out `tool-factory-template` repo (under `mehtaphysical13`) — generates a new tool project in one command
- [ ] Document the pipeline: idea → shipped in <48hr

## Verification gates (must pass before "done")
- [ ] All 5 tools return correct results on 20-query manual eval
- [ ] p95 tool-call latency under 2s
- [ ] All outbound API calls logged
- [ ] Subagent test loop run, all issues addressed
- [ ] Landing page live, MCP server reachable from Claude Desktop in <60s install
- [ ] At least 2 registry listings live

## Explicitly out of scope for v1
- Monetization (paid tier — comes once we have adoption signal)
- Vercel KV / Postgres caching (in-memory LRU is enough)
- Webhook/email alerts on saved searches (v2)
- OAuth / user accounts (anonymous v1)
- Custom domain (use `*.vercel.app`)
- Stdio adapter (remote MCP only for v1 — easier install, better telemetry)

## Review
_To be filled in after build._
