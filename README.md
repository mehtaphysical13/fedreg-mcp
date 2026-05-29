# fedreg-mcp

MCP server that gives AI agents first-class access to **U.S. Federal Register rules** and **Regulations.gov public comments**.

Built by [Tool Factory](https://github.com/mehtaphysical13) — Tool #1.

## Status

🚧 **v0.1 scaffold.** Tools coming online over the next few days.

## What it does

Lets an agent (Claude, Cursor, ChatGPT, Goose, etc.) answer questions like:

- "What new EPA rules dropped this week affecting chemical manufacturers?"
- "Summarize the latest proposed rule from the SEC on climate disclosures, with citations."
- "Show me public comments on FDA docket FDA-2024-N-0001."
- "Track rules from DOT with open comment periods closing in the next 30 days."

## Tools (planned)

| Tool | Description |
|---|---|
| `search_rules` | Full-text + filtered search of Federal Register rules |
| `get_rule` | Fetch a full rule by document number with normalized metadata |
| `list_recent` | List recent rules by agency or topic, filtered by stage |
| `get_comments` | Fetch public comments from a Regulations.gov docket |
| `summarize_rule` | LLM-generated executive summary with anchored citations |

## Install (coming soon)

```jsonc
// Claude Desktop / Claude Code config
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
cp .env.example .env.local   # fill in REGULATIONS_GOV_API_KEY, OPENAI_API_KEY
npm run dev                  # landing page on http://localhost:5173
vercel dev                   # full stack incl. /api/* routes
```

## Stack

- TypeScript + Vercel serverless functions
- `@modelcontextprotocol/sdk` over Streamable HTTP
- Vite + React for the landing page
- Zod for tool schemas
- `tiny-lru` for in-memory caching

## License

MIT
