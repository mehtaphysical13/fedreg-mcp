import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    name: "fedreg-mcp",
    version: "0.1.0",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
