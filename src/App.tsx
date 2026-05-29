import { useState } from "react";

const MCP_URL = "https://fedreg-mcp.vercel.app/api/mcp";

const CLAUDE_CONFIG = `{
  "mcpServers": {
    "fedreg": {
      "url": "${MCP_URL}"
    }
  }
}`;

const CLAUDE_CODE_CMD = `claude mcp add --transport http fedreg ${MCP_URL}`;

const CURSOR_CONFIG = `{
  "mcpServers": {
    "fedreg": {
      "url": "${MCP_URL}"
    }
  }
}`;

const TOOLS = [
  {
    name: "search_rules",
    summary: "Search rules by query, agency, stage, date range, and CFR title.",
    example:
      '"Find recent EPA proposed rules on PFAS" → query="PFAS", agencies=["EPA"], stage="proposed"',
  },
  {
    name: "get_rule",
    summary: "Fetch the canonical record for a rule by its document number.",
    example: '"Tell me about rule 2026-10643" → document_number="2026-10643"',
  },
  {
    name: "list_recent",
    summary: "Recent docs from a given agency, sorted newest-first.",
    example: '"What has the FDA published this week?" → agency="FDA", days_back=7',
  },
  {
    name: "get_comments",
    summary: "Public comments submitted to a Regulations.gov docket.",
    example:
      '"Show comments on EPA-HQ-OAR-2024-0001" → docket_id="EPA-HQ-OAR-2024-0001"',
    requiresKey: "REGULATIONS_GOV_API_KEY",
  },
  {
    name: "summarize_rule",
    summary:
      "Executive / legal / technical summary of a rule, with anchored citations.",
    example: '"Summarize 2026-10643 for an executive" → audience="executive"',
    requiresKey: "OPENROUTER_API_KEY or OPENAI_API_KEY",
  },
];

const EXAMPLE_PROMPTS = [
  "What climate-disclosure rules has the SEC published this year?",
  "Show me all FDA proposed rules with open comment periods.",
  "Which Federal Register rules under 40 CFR were finalized in the last 30 days?",
  "Summarize document 2026-10643 for an executive audience.",
  "List rules from the DOT in the last 14 days, only final rules.",
];

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <pre
      onClick={() => {
        void navigator.clipboard.writeText(children);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      style={{
        background: "#0b1220",
        color: "#e2e8f0",
        padding: "16px 18px",
        borderRadius: 10,
        overflow: "auto",
        cursor: "pointer",
        fontSize: 13.5,
        lineHeight: 1.55,
        margin: 0,
        position: "relative",
        border: "1px solid #1e293b",
      }}
      title="Click to copy"
    >
      <span
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          fontSize: 11,
          color: copied ? "#34d399" : "#64748b",
          letterSpacing: 0.5,
        }}
      >
        {copied ? "COPIED" : "CLICK TO COPY"}
      </span>
      {children}
    </pre>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: 999,
        background: `${color}1a`,
        color,
        border: `1px solid ${color}33`,
      }}
    >
      {children}
    </span>
  );
}

export default function App() {
  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, #f8fafc 0%, #fff 280px, #fff 100%)",
        minHeight: "100vh",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        color: "#0f172a",
        lineHeight: 1.55,
      }}
    >
      <main
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "56px 24px 96px",
        }}
      >
        {/* Hero */}
        <header style={{ marginBottom: 48 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 18,
              flexWrap: "wrap",
            }}
          >
            <Pill color="#2563eb">MCP server</Pill>
            <Pill color="#059669">Live</Pill>
            <Pill color="#7c3aed">No auth</Pill>
            <Pill color="#ea580c">Public data</Pill>
          </div>
          <h1
            style={{
              fontSize: 52,
              fontWeight: 700,
              margin: "0 0 14px",
              letterSpacing: -1,
              lineHeight: 1.05,
            }}
          >
            fedreg-mcp
          </h1>
          <p
            style={{
              fontSize: 20,
              color: "#475569",
              margin: 0,
              maxWidth: 680,
            }}
          >
            U.S. Federal Register rules and Regulations.gov public comments,
            packaged as MCP tools. Drop into Claude, Cursor, Goose, or any
            MCP-compatible agent and start asking questions about federal
            rulemaking.
          </p>
          <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href="#install"
              style={{
                background: "#0f172a",
                color: "#fff",
                padding: "11px 20px",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              Install →
            </a>
            <a
              href="https://github.com/mehtaphysical13/fedreg-mcp"
              style={{
                background: "#fff",
                color: "#0f172a",
                padding: "11px 20px",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 15,
                border: "1px solid #cbd5e1",
              }}
            >
              View source
            </a>
          </div>
        </header>

        {/* What it does */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={sectionHeading}>What you can ask</h2>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 10,
            }}
          >
            {EXAMPLE_PROMPTS.map((p) => (
              <li
                key={p}
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "14px 18px",
                  fontSize: 15,
                  color: "#1e293b",
                }}
              >
                <span style={{ color: "#94a3b8", marginRight: 8 }}>"</span>
                {p}
                <span style={{ color: "#94a3b8", marginLeft: 4 }}>"</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Install */}
        <section id="install" style={{ marginBottom: 56 }}>
          <h2 style={sectionHeading}>Install</h2>

          <h3 style={subHeading}>Claude Desktop / Claude Code (config file)</h3>
          <p style={para}>
            Add to your <code style={inlineCode}>claude_desktop_config.json</code> (Desktop) or run the CLI command (Code):
          </p>
          <Code>{CLAUDE_CONFIG}</Code>
          <p style={{ ...para, marginTop: 16 }}>
            Or, in Claude Code:
          </p>
          <Code>{CLAUDE_CODE_CMD}</Code>

          <h3 style={subHeading}>Cursor</h3>
          <p style={para}>
            Add to <code style={inlineCode}>~/.cursor/mcp.json</code> (or your project's <code style={inlineCode}>.cursor/mcp.json</code>):
          </p>
          <Code>{CURSOR_CONFIG}</Code>

          <h3 style={subHeading}>Raw endpoint</h3>
          <p style={para}>
            Streamable HTTP transport, stateless. Point any MCP client at:
          </p>
          <Code>{MCP_URL}</Code>
        </section>

        {/* Tools */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={sectionHeading}>Tools</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {TOOLS.map((t) => (
              <div
                key={t.name}
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "18px 20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 10,
                    flexWrap: "wrap",
                    marginBottom: 6,
                  }}
                >
                  <code
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "#0f172a",
                      background: "transparent",
                      padding: 0,
                    }}
                  >
                    {t.name}
                  </code>
                  {t.requiresKey && (
                    <Pill color="#b45309">needs {t.requiresKey}</Pill>
                  )}
                </div>
                <p style={{ ...para, margin: "0 0 8px" }}>{t.summary}</p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13.5,
                    color: "#64748b",
                    fontStyle: "italic",
                  }}
                >
                  {t.example}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Endpoints */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={sectionHeading}>HTTP endpoints</h2>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 8,
              fontSize: 14.5,
            }}
          >
            <li>
              <code style={inlineCode}>POST /api/mcp</code> — MCP Streamable
              HTTP (stateless)
            </li>
            <li>
              <code style={inlineCode}>GET /api/health</code> — health check
            </li>
          </ul>
        </section>

        {/* About */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={sectionHeading}>About</h2>
          <p style={para}>
            Built by <a href="https://github.com/mehtaphysical13">Tool Factory</a>
            {" "}as our first agent-tool ship. Public data, no auth, free to use.
            We log anonymized tool-call shapes (no PII, no raw query text) to learn
            what agents reach for next.
          </p>
          <p style={para}>
            Data sources:{" "}
            <a href="https://www.federalregister.gov/developers/documentation/api/v1">
              federalregister.gov API
            </a>
            ,{" "}
            <a href="https://open.gsa.gov/api/regulationsgov/">
              regulations.gov v4 API
            </a>
            .
          </p>
        </section>

        <footer
          style={{
            marginTop: 64,
            paddingTop: 28,
            borderTop: "1px solid #e2e8f0",
            color: "#94a3b8",
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span>MIT licensed</span>
          <span>
            <a
              href="https://github.com/mehtaphysical13/fedreg-mcp"
              style={{ color: "#64748b", textDecoration: "none" }}
            >
              github.com/mehtaphysical13/fedreg-mcp
            </a>
          </span>
        </footer>
      </main>
    </div>
  );
}

const sectionHeading: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  margin: "0 0 18px",
  letterSpacing: -0.3,
};

const subHeading: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  margin: "26px 0 10px",
  color: "#0f172a",
};

const para: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 15,
  color: "#334155",
};

const inlineCode: React.CSSProperties = {
  fontSize: 13,
  background: "#f1f5f9",
  padding: "2px 6px",
  borderRadius: 4,
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};
