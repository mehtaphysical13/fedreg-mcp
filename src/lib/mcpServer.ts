/**
 * Constructs the MCP server with all 5 tools registered. Each tool call is
 * wrapped in a telemetry middleware that logs `{ tool, args_shape, latency_ms, status }`
 * — the Gap Radar feed for picking Tool #2.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { log, shapeOf } from "./logger";
import {
  searchRulesSchema,
  searchRulesDescription,
  searchRulesHandler,
  getRuleSchema,
  getRuleDescription,
  getRuleHandler,
  listRecentSchema,
  listRecentDescription,
  listRecentHandler,
  getCommentsSchema,
  getCommentsDescription,
  getCommentsHandler,
  summarizeRuleSchema,
  summarizeRuleDescription,
  summarizeRuleHandler,
} from "./tools";

type ToolHandler<A> = (args: A) => Promise<unknown>;

function withTelemetry<A extends Record<string, unknown>>(
  name: string,
  handler: ToolHandler<A>
): ToolHandler<A> {
  return async (args: A) => {
    const start = Date.now();
    const correlationId = `${name}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      const result = await handler(args);
      const errored = (result as { isError?: boolean })?.isError === true;
      log.toolCall({
        tool: name,
        argsShape: shapeOf(args),
        status: errored ? "error" : "ok",
        latencyMs: Date.now() - start,
        correlationId,
      });
      return result;
    } catch (err) {
      log.toolCall({
        tool: name,
        argsShape: shapeOf(args),
        status: "error",
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
        correlationId,
      });
      throw err;
    }
  };
}

export function buildMcpServer(): McpServer {
  const server = new McpServer({
    name: "fedreg-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "search_rules",
    {
      title: "Search Federal Register rules",
      description: searchRulesDescription,
      inputSchema: searchRulesSchema,
    },
    withTelemetry("search_rules", searchRulesHandler) as never
  );

  server.registerTool(
    "get_rule",
    {
      title: "Get a single Federal Register rule",
      description: getRuleDescription,
      inputSchema: getRuleSchema,
    },
    withTelemetry("get_rule", getRuleHandler) as never
  );

  server.registerTool(
    "list_recent",
    {
      title: "List recent Federal Register documents",
      description: listRecentDescription,
      inputSchema: listRecentSchema,
    },
    withTelemetry("list_recent", listRecentHandler) as never
  );

  server.registerTool(
    "get_comments",
    {
      title: "Get public comments on a Regulations.gov docket",
      description: getCommentsDescription,
      inputSchema: getCommentsSchema,
    },
    withTelemetry("get_comments", getCommentsHandler) as never
  );

  server.registerTool(
    "summarize_rule",
    {
      title: "Summarize a Federal Register rule (LLM-generated)",
      description: summarizeRuleDescription,
      inputSchema: summarizeRuleSchema,
    },
    withTelemetry("summarize_rule", summarizeRuleHandler) as never
  );

  return server;
}
