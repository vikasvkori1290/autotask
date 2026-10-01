import { createAutotaskRoutes } from "../server/routes/autotask.ts";
import { dbService } from "../server/autotask-db.ts";
import { readBody } from "../server/harness/http.ts";

const autotaskHandler = createAutotaskRoutes();

export default async function handler(req: any, res: any) {
  try {
    // CORS Headers allowing requests from Netlify, local dev, and Mobile APK
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Bypass-Tunnel-Reminder, ngrok-skip-browser-warning");

    if (req.method === "OPTIONS") {
      if (typeof res.status === "function") {
        return res.status(204).end();
      }
      res.writeHead(204);
      res.end();
      return;
    }

    const host = req.headers?.host || "localhost";
    const protocol = req.headers?.["x-forwarded-proto"] || "https";
    const url = new URL(req.url || "/", `${protocol}://${host}`);
    const path = url.pathname;

    const sendJson = (status: number, data: any) => {
      if (typeof res.status === "function" && typeof res.json === "function") {
        return res.status(status).json(data);
      }
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };

    // Ensure database connection
    if (!dbService.getStatus().connected) {
      await dbService.connect();
    }

    // Root health-check endpoint
    if (path === "/" || path === "/api" || path === "/api/health") {
      return sendJson(200, {
        ok: true,
        service: "AutoTask Serverless Backend",
        status: "online",
        databaseConnected: dbService.getStatus().connected,
        time: new Date().toISOString(),
      });
    }

    const safeReadBody = async (request: any) => {
      if (request.body !== undefined) {
        return request.body;
      }
      return readBody(request);
    };

    await autotaskHandler({
      req,
      res,
      url,
      path,
      method: (req.method || "GET").toUpperCase(),
      auth: { kind: "none" } as any,
      json: (_res: any, status: number, body: any) => sendJson(status, body),
      readBody: safeReadBody,
    });

    if (!res.headersSent && !res.writableEnded) {
      sendJson(404, { ok: false, error: "AutoTask endpoint not found", path });
    }
  } catch (err) {
    console.error("[AutoTask Serverless Error]", err);
    const errorDetails = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    if (!res.headersSent && !res.writableEnded) {
      if (typeof res.status === "function" && typeof res.json === "function") {
        return res.status(500).json({ ok: false, error: errorDetails });
      }
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: errorDetails }));
    }
  }
}
