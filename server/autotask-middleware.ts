import type { IncomingMessage, ServerResponse } from "node:http";
import { createAutotaskRoutes } from "./routes/autotask.ts";
import { json, readBody } from "./harness/http.ts";
import { PASS } from "./routes/table.ts";

const autotaskRouteHandler = createAutotaskRoutes();

export async function handleAutotaskRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const rawUrl = req.url || "/";
  const parsedUrl = new URL(rawUrl, "http://127.0.0.1");
  const path = parsedUrl.pathname;

  if (req.method === "OPTIONS" && path.startsWith("/api/autotask/")) {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, PUT, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.end();
    return true;
  }

  if (!path.startsWith("/api/autotask/")) {
    return false;
  }

  // Set CORS headers for all autotask API responses
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  try {
    const out = await autotaskRouteHandler({
      req,
      res,
      url: parsedUrl,
      path,
      method: (req.method || "GET").toUpperCase(),
      auth: { kind: "loopback" } as any,
      json,
      readBody,
    });

    if (out !== PASS || res.headersSent || res.writableEnded) {
      return true;
    }
  } catch (err) {
    console.error("[Autotask Middleware] Error handling request:", err);
    if (!res.headersSent) {
      json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
    }
    return true;
  }

  return false;
}
