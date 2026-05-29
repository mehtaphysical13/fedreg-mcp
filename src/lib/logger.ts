/**
 * Structured JSON logger. Vercel captures stdout as log lines, so we just
 * write one JSON object per call. Every outbound third-party call goes
 * through this (per global instruction: log request metadata, status,
 * latency, errors).
 *
 * Factory-template candidate: this module is reusable across every tool
 * we build, with no fedreg-mcp-specific logic.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface OutboundCallLog {
  source: string; // e.g. "federalregister" | "regulationsgov" | "openai"
  endpoint: string; // e.g. "/documents.json"
  method?: string; // default GET
  paramsShape?: Record<string, string>; // shape only — never raw values with PII
  status?: number;
  latencyMs: number;
  error?: string;
  correlationId?: string;
}

export interface ToolCallLog {
  tool: string;
  argsShape: Record<string, string>;
  status: "ok" | "error";
  latencyMs: number;
  error?: string;
  correlationId?: string;
}

function write(level: LogLevel, payload: Record<string, unknown>) {
  const line = {
    level,
    ts: new Date().toISOString(),
    ...payload,
  };
  const out = JSON.stringify(line);
  if (level === "error" || level === "warn") {
    // eslint-disable-next-line no-console
    console.error(out);
  } else {
    // eslint-disable-next-line no-console
    console.log(out);
  }
}

export const log = {
  debug: (msg: string, extra?: Record<string, unknown>) =>
    write("debug", { msg, ...extra }),
  info: (msg: string, extra?: Record<string, unknown>) =>
    write("info", { msg, ...extra }),
  warn: (msg: string, extra?: Record<string, unknown>) =>
    write("warn", { msg, ...extra }),
  error: (msg: string, extra?: Record<string, unknown>) =>
    write("error", { msg, ...extra }),
  outbound: (entry: OutboundCallLog) =>
    write(entry.error ? "warn" : "info", { kind: "outbound", ...entry }),
  toolCall: (entry: ToolCallLog) =>
    write(entry.status === "error" ? "warn" : "info", {
      kind: "tool_call",
      ...entry,
    }),
};

/**
 * Describe a params object by shape only — used for logging without leaking
 * raw user query text. e.g. `{ term: "epa", from: "2026-01-01" }` →
 * `{ term: "string", from: "date" }`.
 */
export function shapeOf(
  params: Record<string, unknown> | undefined
): Record<string, string> {
  if (!params) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      out[k] = `array(${v.length})`;
    } else if (typeof v === "string") {
      out[k] = isIsoDate(v) ? "date" : "string";
    } else {
      out[k] = typeof v;
    }
  }
  return out;
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(s);
}
