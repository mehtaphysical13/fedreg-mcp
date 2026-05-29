/**
 * MCP Streamable HTTP endpoint, hosted as a Vercel serverless function.
 * Stateless mode (no session ID generator) — each request is independent,
 * which is the right shape for serverless and the simplest install for
 * agents.
 *
 * Why we shim Vercel's (req, res) into a Web Standard Request:
 * the MCP SDK's `WebStandardStreamableHTTPServerTransport` operates on
 * `Request`/`Response`, and that's the future-proof, runtime-portable shape.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Readable } from "node:stream";
import { buildMcpServer } from "../src/lib/mcpServer.js";
import { log } from "../src/lib/logger.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS — agents and registry inspectors may probe cross-origin
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader(
    "access-control-allow-headers",
    "content-type, mcp-session-id, mcp-protocol-version"
  );
  res.setHeader(
    "access-control-allow-methods",
    "POST, GET, DELETE, OPTIONS"
  );
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const webReq = vercelReqToWebRequest(req);

    const transport = new WebStandardStreamableHTTPServerTransport({
      // stateless: no sessionIdGenerator
    });
    const server = buildMcpServer();
    await server.connect(transport);

    const webRes = await transport.handleRequest(webReq);

    // Pipe Web Response → Vercel Response
    res.status(webRes.status);
    webRes.headers.forEach((v, k) => res.setHeader(k, v));
    if (webRes.body) {
      Readable.fromWeb(
        webRes.body as unknown as import("node:stream/web").ReadableStream
      ).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    log.error("mcp handler failed", {
      msg: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    } else {
      res.end();
    }
  }
}

function vercelReqToWebRequest(req: VercelRequest): Request {
  const host = req.headers.host ?? "localhost";
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
  const url = new URL(req.url ?? "/", `${proto}://${host}`);

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      for (const item of v) headers.append(k, item);
    } else {
      headers.set(k, v);
    }
  }

  let body: string | null = null;
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    if (req.body !== undefined) {
      body =
        typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    }
  }

  return new Request(url, {
    method: req.method ?? "GET",
    headers,
    body,
  });
}
