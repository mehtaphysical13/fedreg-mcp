/**
 * Tiny HTTP client wrapper that adds structured logging, timeouts, and
 * consistent error shapes. Every outbound third-party call should use this.
 *
 * Factory-template candidate: this is the bedrock primitive for all tools
 * that wrap external APIs.
 */

import { log, shapeOf } from "./logger.js";

export interface HttpClientOptions {
  source: string; // logged as `source` — e.g. "federalregister"
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | string[] | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  correlationId?: string;
}

export class HttpError extends Error {
  readonly status: number;
  readonly source: string;
  readonly endpoint: string;
  readonly bodySnippet?: string;
  constructor(opts: {
    status: number;
    source: string;
    endpoint: string;
    message: string;
    bodySnippet?: string;
  }) {
    super(opts.message);
    this.status = opts.status;
    this.source = opts.source;
    this.endpoint = opts.endpoint;
    this.bodySnippet = opts.bodySnippet;
  }
}

export function makeHttpClient(opts: HttpClientOptions) {
  const timeoutMs = opts.timeoutMs ?? 10_000;

  async function request<T>(
    endpoint: string,
    reqOpts: RequestOptions = {}
  ): Promise<T> {
    const url = buildUrl(opts.baseUrl, endpoint, reqOpts.query);
    const method = reqOpts.method ?? "GET";
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          accept: "application/json",
          ...opts.defaultHeaders,
          ...reqOpts.headers,
          ...(reqOpts.body ? { "content-type": "application/json" } : {}),
        },
        body: reqOpts.body ? JSON.stringify(reqOpts.body) : undefined,
        signal: controller.signal,
      });

      const latencyMs = Date.now() - start;
      log.outbound({
        source: opts.source,
        endpoint,
        method,
        paramsShape: shapeOf(reqOpts.query as Record<string, unknown>),
        status: res.status,
        latencyMs,
        correlationId: reqOpts.correlationId,
      });

      if (!res.ok) {
        const text = await safeText(res);
        throw new HttpError({
          status: res.status,
          source: opts.source,
          endpoint,
          message: `${opts.source} ${endpoint} returned ${res.status}`,
          bodySnippet: text.slice(0, 300),
        });
      }
      return (await res.json()) as T;
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      if (!(err instanceof HttpError)) {
        log.outbound({
          source: opts.source,
          endpoint,
          method,
          paramsShape: shapeOf(reqOpts.query as Record<string, unknown>),
          latencyMs,
          error: message,
          correlationId: reqOpts.correlationId,
        });
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  return { request };
}

function buildUrl(
  base: string,
  endpoint: string,
  query?: RequestOptions["query"]
): string {
  const u = new URL(endpoint.startsWith("/") ? endpoint.slice(1) : endpoint, base.endsWith("/") ? base : `${base}/`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        for (const item of v) u.searchParams.append(k, String(item));
      } else {
        u.searchParams.set(k, String(v));
      }
    }
  }
  return u.toString();
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
