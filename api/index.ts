import type { IncomingMessage, ServerResponse } from "node:http";
import { createAutotaskRoutes } from "../server/routes/autotask.ts";
import { json, readBody } from "../server/harness/http.ts";
import { dbService } from "../server/autotask-db.ts";

let autotaskHandler: any = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // CORS Headers allowing requests from Netlify, local dev, and Mobile APK
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Bypass-Tunnel-Reminder, ngrok-skip-browser-warning");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const host = req.headers.host || "localhost";
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const url = new URL(req.url || "/", `${protocol}://${host}`);
  const path = url.pathname;

  // Root health-check endpoint so visiting https://autotask-mocha.vercel.app directly renders success
  if (path === "/" || path === "/api" || path === "/api/health") {
    return json(res, 200, {
      ok: true,
      service: "AutoTask Serverless Backend",
      status: "online",
      database: dbService.getStatus(),
      endpoints: [
        "/api/autotask/db-status",
        "/api/autotask/auth/signup",
        "/api/autotask/auth/signin",
        "/api/autotask/auth/session",
        "/api/autotask/tasks",
        "/api/autotask/tasks/sync",
        "/api/autotask/execute",
      ],
    });
  }

  try {
    if (!autotaskHandler) {
      autotaskHandler = createAutotaskRoutes();
    }

    await autotaskHandler({
      req,
      res,
      url,
      path,
      method: req.method || "GET",
      auth: { kind: "none" } as any,
      json,
      readBody,
    });

    if (!res.headersSent && !res.writableEnded) {
      json(res, 404, { ok: false, error: "AutoTask endpoint not found", path });
    }
  } catch (err) {
    console.error("[AutoTask Vercel API Error]", err);
    if (!res.headersSent) {
      json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
}
