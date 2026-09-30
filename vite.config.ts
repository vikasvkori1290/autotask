import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { handleAutotaskRequest } from "./server/autotask-middleware.ts";

const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf8"),
) as { version: string };

function autotaskPlugin(): Plugin {
  return {
    name: "autotask-middleware",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (url?.startsWith("/api/autotask/")) {
          try {
            const handled = await handleAutotaskRequest(req, res);
            if (handled) return;
          } catch (err) {
            console.error("Autotask middleware error:", err);
          }
        }

        // Gracefully handle legacy background polling endpoints to prevent ECONNREFUSED terminal noise
        if (url === "/api/events") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          });
          res.write("data: {}\n\n");
          return;
        }

        if (url === "/api/routines" || url === "/api/webhooks" || url === "/api/instances") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify([]));
          return;
        }

        if (url === "/api/auth/session") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ kind: "loopback" }));
          return;
        }

        if (url === "/api/brand") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ brand: { name: "AutoTask" }, source: "default", file: "" }));
          return;
        }

        if (url === "/api/bots" || url.startsWith("/api/bots/")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ bots: [], groups: [], sections: [] }));
          return;
        }

        if (url === "/api/config" || url === "/.well-known/openmausbot/environment") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({}));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), autotaskPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.OMB_UI_PORT) || 5199,
    watch: {
      ignored: ["**/release/**", "**/build/**", "**/dist/**", "**/electron/resources/**"],
    },
  },
});
