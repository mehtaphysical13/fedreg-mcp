export default function App() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 24px",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        lineHeight: 1.55,
        color: "#0f172a",
      }}
    >
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>fedreg-mcp</h1>
      <p style={{ color: "#475569", marginTop: 0, fontSize: 18 }}>
        Federal Register rules and Regulations.gov comments — as MCP tools for
        AI agents.
      </p>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>Status</h2>
        <p>
          v0.1 scaffold. Tools coming online over the next few days.{" "}
          <a href="https://github.com/mehtaphysical13/fedreg-mcp">
            Source on GitHub
          </a>
          .
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22 }}>Endpoints</h2>
        <ul>
          <li>
            <code>GET /api/health</code> — health check
          </li>
          <li>
            <code>POST /api/mcp</code> — MCP Streamable HTTP endpoint (coming
            soon)
          </li>
        </ul>
      </section>

      <footer style={{ marginTop: 48, color: "#94a3b8", fontSize: 14 }}>
        Built by Tool Factory. MIT licensed.
      </footer>
    </main>
  );
}
