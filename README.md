# fedreg-mcp

MCP server that gives AI agents first-class access to **U.S. Federal Register rules** and **Regulations.gov public comments**.

Built by [Tool Factory](https://github.com/mehtaphysical13) — Tool #1.

🌐 **Live:** https://fedreg-mcp.vercel.app
🔌 **MCP endpoint:** `https://fedreg-mcp.vercel.app/api/mcp` (Streamable HTTP, stateless, no auth)

## What it does

Lets an agent (Claude, Cursor, ChatGPT, Goose, etc.) answer questions like:

- "What climate-disclosure rules has the SEC published this year?"
- "Show me all FDA proposed rules with open comment periods."
- "Which Federal Register rules under 40 CFR were finalized in the last 30 days?"
- "Summarize document 2026-10643 for an executive audience."
- "List rules from the DOT in the last 14 days, only final rules."

## Tools

| Tool | What it does | Notes |
|---|---|---|
| `search_rules` | Query + agency + stage + date + CFR + pagination over Federal Register | Fuzzy agency resolution (EPA, FDA, SEC, etc.) |
| `get_rule` | Full canonical record for a rule by document number | Includes source URLs incl. raw-text |
| `list_recent` | Recent docs from an agency / across the gov't | Same envelope as `search_rules` |
| `get_comments` | Public comments on a Regulations.gov docket | Requires free `REGULATIONS_GOV_API_KEY` |
| `summarize_rule` | Executive / legal / technical summary with citations | Requires `OPENROUTER_API_KEY` or `OPENAI_API_KEY` |

## Install

### Claude Desktop

Add to `claude_desktop_config.json`:

```jsonc
{
  "mcpServers": {
    "fedreg": {
      "url": "https://fedreg-mcp.vercel.app/api/mcp"
    }
  }
}
```

### Claude Code

```bash
claude mcp add --transport http fedreg https://fedreg-mcp.vercel.app/api/mcp
```

### Cursor

Add to `~/.cursor/mcp.json` (or `.cursor/mcp.json` in your project):

```jsonc
{
  "mcpServers": {
    "fedreg": {
      "url": "https://fedreg-mcp.vercel.app/api/mcp"
    }
  }
}
```

## Local dev

```bash
npm install
cp .env.example .env.local   # optional: REGULATIONS_GOV_API_KEY, OPENROUTER_API_KEY
npm run dev                  # landing page on http://localhost:5173
vercel dev                   # full stack incl. /api/* routes
```

Smoke scripts (live, no env vars needed):

```bash
npx tsx scripts/smoke-fedreg.ts
npx tsx scripts/smoke-normalize.ts
```

## Stack

- TypeScript + Vercel serverless functions
- `@modelcontextprotocol/sdk` v1.0.4 over Web-Standard Streamable HTTP
- Vite + React for the landing page
- Zod for tool schemas
- `tiny-lru` for in-memory caching
- OpenRouter (or OpenAI) for the summarization tool

## Data sources

- [federalregister.gov API v1](https://www.federalregister.gov/developers/documentation/api/v1) — no auth
- [regulations.gov API v4](https://open.gsa.gov/api/regulationsgov/) — free key from [api.data.gov](https://api.data.gov/signup/)

## Privacy

We log structured, anonymized tool-call shapes (`{ tool, args_shape, latency_ms, status, correlation_id }`) — never raw query text, never PII. Used to learn what tools to build next.

## License

MIT
