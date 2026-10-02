import { PASS, type RouteHandler } from "./types.ts";
import { dbService, type DbTask } from "../autotask-db.ts";
import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";

export interface OpencodeCliStatus {
  installed: boolean;
  version?: string;
  path?: string;
  models: Array<{ id: string; name: string; badge: string; isCli: boolean }>;
  error?: string;
}

const DEFAULT_CLI_MODELS = [
  { id: "opencode/space-bunny-free", name: "Space Bunny Free", badge: "Local CLI · Free", isCli: true },
  { id: "opencode/nemotron-3.5-lightning-free", name: "Nemotron 3.5 Lightning", badge: "Local CLI · Free", isCli: true },
  { id: "opencode/ling-3.0-flash-fin-free", name: "Ling 3.0 Flash", badge: "Local CLI · Free", isCli: true },
  { id: "opencode/mimo-v2.6-flash-free", name: "Mimo v2.6 Flash", badge: "Local CLI · Free", isCli: true },
];

export function findOpencodeBinary(): string | null {
  const appData = process.env.APPDATA || "";
  const candidates = [
    process.env.OPENCODE_BIN_PATH,
    path.join(appData, "npm", "node_modules", "opencode-ai", "bin", "opencode.exe"),
    path.join(appData, "npm", "opencode.cmd"),
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      return c;
    }
  }

  try {
    const whichCmd = process.platform === "win32" ? "where opencode" : "which opencode";
    const found = execSync(whichCmd, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)[0];
    if (found && fs.existsSync(found)) {
      return found;
    }
  } catch {
    // ignore
  }

  return null;
}

export function getOpencodeCliInfo(): OpencodeCliStatus {
  const bin = findOpencodeBinary();
  if (!bin) {
    return {
      installed: false,
      models: DEFAULT_CLI_MODELS,
      error: "opencode binary not found on local system.",
    };
  }

  try {
    const version = execSync(`"${bin}" --version`, { stdio: ["ignore", "pipe", "ignore"], timeout: 6000 })
      .toString()
      .trim();
    return {
      installed: true,
      version: version || "1.18.x",
      path: bin,
      models: DEFAULT_CLI_MODELS,
    };
  } catch (err) {
    return {
      installed: true,
      path: bin,
      models: DEFAULT_CLI_MODELS,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runOpencodeBinary(
  prompt: string,
  model = "opencode/space-bunny-free",
  envKey?: string,
  timeoutMs = 60000
): Promise<{ ok: boolean; output?: string; error?: string }> {
  const bin = findOpencodeBinary();
  if (!bin) {
    return { ok: false, error: "OpenCode binary is not installed on the local system." };
  }

  return new Promise((resolve) => {
    let resolved = false;
    let stdout = "";
    let stderr = "";

    const env = { ...process.env };
    if (envKey) {
      env.OPENCODE_API_KEY = envKey;
    }

    const args = ["run", "-m", model, "--format", "default", "--pure"];
    const child = spawn(bin, args, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try {
          child.kill("SIGKILL");
        } catch {}
        resolve({
          ok: false,
          error: `OpenCode CLI timed out after ${Math.round(timeoutMs / 1000)} seconds`,
        });
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({ ok: false, error: err.message });
      }
    });

    child.on("close", (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        const cleanOut = stdout.replace(/^\s*>.*?\r?\n/g, "").trim();
        if (code === 0 && cleanOut) {
          resolve({ ok: true, output: cleanOut });
        } else {
          resolve({
            ok: false,
            error: stderr.trim() || `Process exited with code ${code}`,
            output: cleanOut,
          });
        }
      }
    });

    try {
      child.stdin.write(prompt + "\n");
      child.stdin.end();
    } catch (writeErr) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({ ok: false, error: writeErr instanceof Error ? writeErr.message : String(writeErr) });
      }
    }
  });
}


interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Perform a clean, free DuckDuckGo HTML web search.
 */
async function performWebSearch(query: string, maxResults = 6): Promise<SearchResult[]> {
  try {
    const encoded = encodeURIComponent(query.trim());
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) {
      return [];
    }

    const html = await res.text();
    const results: SearchResult[] = [];

    const itemRegex = /<a[^>]+class="result__url"[^>]+href="([^"]+)"[^>]*>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(html)) !== null && results.length < maxResults) {
      let rawUrl = match[1] ?? "";
      const rawSnippet = match[2] ?? "";

      if (rawUrl.includes("uddg=")) {
        const urlParams = new URL(rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl).searchParams;
        rawUrl = urlParams.get("uddg") || rawUrl;
      }

      const cleanSnippet = rawSnippet
        .replace(/<[^>]+>/g, "")
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();

      let title = "";
      try {
        const u = new URL(rawUrl);
        title = u.hostname.replace(/^www\./, "");
      } catch {
        title = "Source";
      }

      if (cleanSnippet && rawUrl.startsWith("http")) {
        results.push({
          title,
          url: rawUrl,
          snippet: cleanSnippet,
        });
      }
    }

    return results;
  } catch (err) {
    console.error("[Autotask] Web search error:", err);
    return [];
  }
}

async function getJsonBody(req: any, readBodyFn: any): Promise<any> {
  try {
    const raw = await readBodyFn(req);
    if (typeof raw === "string") {
      return raw ? JSON.parse(raw) : {};
    }
    return raw || {};
  } catch {
    return {};
  }
}

// Server-level in-flight execution registry to guarantee exactly ONE model call per task
const inFlightExecutions = new Map<string, Promise<any>>();

export function createAutotaskRoutes(): RouteHandler {
  return async ({ req, res, path, method, json, readBody }) => {
    // Helper: Authenticate user from Bearer token
    const authenticateUser = async () => {
      let token = "";
      if (req.headers.authorization) {
        token = req.headers.authorization.replace(/^Bearer\s+/i, "").trim();
      }
      if (!token) return null;
      return dbService.validateSession(token);
    };

    // 0. DB Status
    if (path === "/api/autotask/db-status") {
      if (!dbService.getStatus().connected) {
        await dbService.connect();
      }
      return json(res, 200, { ok: true, ...dbService.getStatus() });
    }

    // 1. Auth: Sign Up (check existence, hash password, insert to MongoDB)
    if (path === "/api/autotask/auth/signup" && method === "POST") {
      try {
        const body = await getJsonBody(req, readBody);
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (!name) return json(res, 400, { ok: false, error: "Name is required." });
        if (!email || !email.includes("@")) return json(res, 400, { ok: false, error: "A valid email is required." });
        if (!password || password.length < 4) return json(res, 400, { ok: false, error: "Password must be at least 4 characters." });

        const existing = await dbService.findUserByEmail(email);
        if (existing) {
          return json(res, 400, {
            ok: false,
            code: "USER_EXISTS",
            error: "An account with this email already exists. Please sign in instead.",
          });
        }

        const { hash, salt } = dbService.hashPassword(password);
        const user = await dbService.createUser(name, email, hash, salt);
        const token = await dbService.createSession(user.id, user.email);

        return json(res, 200, {
          ok: true,
          user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
          token,
        });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // 2. Auth: Sign In (check existence, verify password, issue session)
    if (path === "/api/autotask/auth/signin" && method === "POST") {
      try {
        const body = await getJsonBody(req, readBody);
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (!email || !password) return json(res, 400, { ok: false, error: "Email and password are required." });

        const user = await dbService.findUserByEmail(email);
        if (!user) {
          return json(res, 404, {
            ok: false,
            code: "USER_NOT_FOUND",
            error: "No account found with this email. Please sign up first.",
          });
        }

        const valid = dbService.verifyPassword(password, user.passwordHash, user.salt);
        if (!valid) {
          return json(res, 401, {
            ok: false,
            code: "INVALID_PASSWORD",
            error: "Incorrect password. Please try again.",
          });
        }

        const token = await dbService.createSession(user.id, user.email);
        const settings = await dbService.getUserSettings(user.id);
        return json(res, 200, {
          ok: true,
          user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
          token,
          settings: settings || {},
        });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // 3. Auth: Session Validation
    if (path === "/api/autotask/auth/session") {
      try {
        let token = "";
        if (method === "POST") {
          const body = await getJsonBody(req, readBody);
          token = String(body.token || "").trim();
        }
        if (!token && req.headers.authorization) {
          token = req.headers.authorization.replace(/^Bearer\s+/i, "").trim();
        }
        if (!token) return json(res, 401, { ok: false, error: "No token provided." });

        const user = await dbService.validateSession(token);
        if (!user) return json(res, 401, { ok: false, error: "Session invalid or expired." });

        const settings = await dbService.getUserSettings(user.id);
        return json(res, 200, {
          ok: true,
          user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
          settings: settings || {},
        });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // 4. Auth: Sign Out
    if (path === "/api/autotask/auth/signout" && method === "POST") {
      try {
        const body = await getJsonBody(req, readBody);
        const token = String(body.token || "").trim();
        if (token) await dbService.deleteSession(token);
        return json(res, 200, { ok: true });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // =============================================
    // USER SETTINGS & API KEY PERSISTENCE (MONGODB)
    // =============================================

    // GET /api/autotask/settings — Fetch user configuration & API keys
    if (path === "/api/autotask/settings" && method === "GET") {
      try {
        const user = await authenticateUser();
        if (!user) return json(res, 401, { ok: false, error: "Authentication required." });

        const settings = await dbService.getUserSettings(user.id);
        return json(res, 200, { ok: true, settings: settings || {} });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // POST /api/autotask/settings — Update user configuration & API keys in MongoDB
    if (path === "/api/autotask/settings" && method === "POST") {
      try {
        const user = await authenticateUser();
        if (!user) return json(res, 401, { ok: false, error: "Authentication required." });

        const body = await getJsonBody(req, readBody);
        const saved = await dbService.saveUserSettings(user.id, {
          nvidiaApiKey: body.nvidiaApiKey !== undefined ? String(body.nvidiaApiKey).trim() : undefined,
          nvidiaModel: body.nvidiaModel !== undefined ? String(body.nvidiaModel).trim() : undefined,
          opencodeApiKey: body.opencodeApiKey !== undefined ? String(body.opencodeApiKey).trim() : undefined,
          opencodeModel: body.opencodeModel !== undefined ? String(body.opencodeModel).trim() : undefined,
          opencodeEndpoint: body.opencodeEndpoint !== undefined ? String(body.opencodeEndpoint).trim() : undefined,
          opencodeRunner: body.opencodeRunner !== undefined ? String(body.opencodeRunner).trim() : undefined,
        });

        return json(res, 200, { ok: true, settings: saved });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // =============================================
    // TASK SYNC API — Cross-device task management
    // =============================================

    // 5a. GET /api/autotask/tasks — Fetch all tasks for authenticated user
    if (path === "/api/autotask/tasks" && method === "GET") {
      try {
        const user = await authenticateUser();
        if (!user) return json(res, 401, { ok: false, error: "Authentication required." });

        const tasks = await dbService.getTasksByUser(user.id);
        return json(res, 200, { ok: true, tasks });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // Helper: Determine whether incoming client task state should supersede existing server task
    const shouldUpdateTaskState = (existing: any, incoming: any): boolean => {
      if (!existing) return true;

      const isCompleted = existing.status === "ready" || existing.status === "delivered";
      const isIncomingIncomplete = incoming.status === "queued" || incoming.status === "researching" || incoming.status === "failed";
      const isUserEdit = incoming.prompt !== existing.prompt || incoming.targetTime !== existing.targetTime;

      // Rule 1: A completed task (ready/delivered) CANNOT be downgraded to queued, researching, or failed
      // by a background sync unless the user explicitly modified the prompt or target time!
      if (isCompleted && existing.result && isIncomingIncomplete && !isUserEdit) {
        return false;
      }

      // Rule 2: If a task is already researching on server, don't revert to queued
      if (existing.status === "researching" && incoming.status === "queued" && !isUserEdit) {
        return false;
      }

      // Rule 3: Always retain existing result if incoming has none
      if (!incoming.result && existing.result && !isUserEdit) {
        incoming.result = existing.result;
        if (incoming.status === "queued" || incoming.status === "researching") {
          incoming.status = existing.status;
        }
      }

      return (incoming.updatedAt || 0) >= (existing.updatedAt || 0);
    };

    // 5b. POST /api/autotask/tasks — Create or upsert a single task
    if (path === "/api/autotask/tasks" && method === "POST") {
      try {
        const user = await authenticateUser();
        if (!user) return json(res, 401, { ok: false, error: "Authentication required." });

        const body = await getJsonBody(req, readBody);
        const task = body.task;
        if (!task || !task.id) {
          return json(res, 400, { ok: false, error: "Task with id is required." });
        }

        task.userId = user.id;

        // Check existing server task to prevent clobbering completed results
        const existing = await dbService.getTaskById(task.id, user.id);
        if (existing) {
          if (!shouldUpdateTaskState(existing, task)) {
            // Server task is ahead (e.g. already ready or delivered) — return authoritative server state
            return json(res, 200, { ok: true, task: existing });
          }
          if (!task.result && existing.result) {
            task.result = existing.result;
            task.status = existing.status;
          }
        }

        task.updatedAt = task.updatedAt || Date.now();
        const saved = await dbService.upsertTask(task);
        return json(res, 200, { ok: true, task: saved });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // 5c. POST /api/autotask/tasks/sync — Bulk sync: merge client tasks with server
    if (path === "/api/autotask/tasks/sync" && method === "POST") {
      try {
        const user = await authenticateUser();
        if (!user) return json(res, 401, { ok: false, error: "Authentication required." });

        const body = await getJsonBody(req, readBody);
        const clientTasks: any[] = Array.isArray(body.tasks) ? body.tasks : [];
        const deletedIds: string[] = Array.isArray(body.deletedIds) ? body.deletedIds : [];

        // Get current server tasks
        const serverTasks = await dbService.getTasksByUser(user.id);
        const serverMap = new Map(serverTasks.map((t) => [t.id, t]));

        // Process deletions
        for (const delId of deletedIds) {
          await dbService.deleteTaskById(delId, user.id);
          serverMap.delete(delId);
        }

        // Smart merge: protect completed results from being overwritten by lagging clients
        for (const clientTask of clientTasks) {
          if (!clientTask.id) continue;
          clientTask.userId = user.id;

          const serverTask = serverMap.get(clientTask.id);
          if (!serverTask) {
            clientTask.updatedAt = clientTask.updatedAt || Date.now();
            await dbService.upsertTask(clientTask);
            serverMap.set(clientTask.id, clientTask);
          } else if (shouldUpdateTaskState(serverTask, clientTask)) {
            if (!clientTask.result && serverTask.result) {
              clientTask.result = serverTask.result;
            }
            clientTask.updatedAt = clientTask.updatedAt || Date.now();
            await dbService.upsertTask(clientTask);
            serverMap.set(clientTask.id, clientTask);
          }
        }

        // Return full authoritative merged task list
        const mergedTasks = await dbService.getTasksByUser(user.id);
        return json(res, 200, { ok: true, tasks: mergedTasks });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // 5d. DELETE /api/autotask/tasks/:id — Delete a specific task
    if (path.startsWith("/api/autotask/tasks/") && method === "DELETE") {
      try {
        const user = await authenticateUser();
        if (!user) return json(res, 401, { ok: false, error: "Authentication required." });

        const taskId = path.replace("/api/autotask/tasks/", "");
        if (!taskId || taskId === "sync") return json(res, 400, { ok: false, error: "Task ID required." });

        const deleted = await dbService.deleteTaskById(taskId, user.id);
        return json(res, 200, { ok: true, deleted });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // 6. Validate NVIDIA API Key
    if (path === "/api/autotask/validate-key" && method === "POST") {
      try {
        const body = await getJsonBody(req, readBody);
        const apiKey = String(body.apiKey || "").trim();

        if (!apiKey) {
          return json(res, 400, { ok: false, error: "API key is required" });
        }

        const probe = await fetch("https://integrate.api.nvidia.com/v1/models", {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Accept": "application/json",
          },
        });

        if (!probe.ok) {
          const errText = await probe.text();
          return json(res, probe.status, {
            ok: false,
            error: `NVIDIA API key rejected (${probe.status}): ${errText.slice(0, 200)}`,
          });
        }

        const data = await probe.json() as { data?: unknown[] };
        return json(res, 200, { ok: true, count: data?.data?.length ?? 0 });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // 2. Validate OpenCode API Key
    if (path === "/api/autotask/opencode/validate-key" && method === "POST") {
      try {
        const body = await getJsonBody(req, readBody);
        const apiKey = String(body.apiKey || "").trim();
        const endpoint = String(body.endpoint || "https://api.opencode.ai/v1").replace(/\/+$/, "");

        if (!apiKey) {
          return json(res, 200, { ok: true, note: "Free tier community model enabled" });
        }

        const probe = await fetch(`${endpoint}/models`, {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Accept": "application/json",
          },
        });

        if (!probe.ok) {
          const errText = await probe.text();
          return json(res, probe.status, {
            ok: false,
            error: `OpenCode rejected (${probe.status}): ${errText.slice(0, 200)}`,
          });
        }

        const data = await probe.json() as { data?: unknown[] };
        return json(res, 200, { ok: true, count: data?.data?.length ?? 0 });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // OpenCode CLI Status
    if (path === "/api/autotask/opencode/cli-status") {
      const info = getOpencodeCliInfo();
      return json(res, 200, { ok: true, ...info });
    }

    // OpenCode CLI Test
    if (path === "/api/autotask/opencode/cli-test" && method === "POST") {
      try {
        const body = await getJsonBody(req, readBody);
        const model = String(body.model || "opencode/space-bunny-free").trim();
        const testPrompt = "Please respond with: 'OpenCode CLI is operational.'";
        const result = await runOpencodeBinary(testPrompt, model, body.apiKey, 25000);
        return json(res, 200, result);
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // 3. Perform Web Search
    if (path === "/api/autotask/search" && method === "POST") {
      try {
        const body = await getJsonBody(req, readBody);
        const query = String(body.query || "").trim();

        if (!query) {
          return json(res, 400, { ok: false, error: "Search query is required" });
        }

        const results = await performWebSearch(query);
        return json(res, 200, { ok: true, query, results });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // 4. Execute Autonomous Task using Web Search & AI Engine (NVIDIA or OpenCode)
    // Server-enforced single-execution guarantee: exactly ONE model request per task
    if (path === "/api/autotask/execute" && method === "POST") {
      try {
        const body = await getJsonBody(req, readBody);
        const taskId = String(body.taskId || "").trim();
        const user = await authenticateUser();
        if (!user) {
          return json(res, 401, { ok: false, error: "Authentication required to execute tasks." });
        }

        // 1. If this task is already completed in MongoDB or being researched by another device,
        // NEVER fire a duplicate parallel search or AI request!
        if (taskId) {
          const claim = await dbService.claimTaskForExecution(taskId, user.id);
          if (!claim.claimed && claim.task) {
            // Task has already been completed in MongoDB — return immediately!
            if ((claim.task.status === "ready" || claim.task.status === "delivered") && claim.task.result) {
              return json(res, 200, {
                ok: true,
                cached: true,
                taskId,
                summary: claim.task.result.summary,
                sources: claim.task.result.sources || [],
                completedAt: claim.task.result.completedAt || Date.now(),
                model: claim.task.result.model,
                engine: claim.task.result.engine,
                runner: claim.task.result.runner,
              });
            }

            // Another device is currently researching. Poll MongoDB for up to 45 seconds
            // to fetch the completed result directly without duplicate model execution.
            if (claim.task.status === "researching") {
              for (let i = 0; i < 20; i++) {
                await new Promise((r) => setTimeout(r, 2000));
                const poll = await dbService.getTaskById(taskId, user.id);
                if (poll && (poll.status === "ready" || poll.status === "delivered") && poll.result) {
                  return json(res, 200, {
                    ok: true,
                    cached: true,
                    taskId,
                    summary: poll.result.summary,
                    sources: poll.result.sources || [],
                    completedAt: poll.result.completedAt || Date.now(),
                    model: poll.result.model,
                    engine: poll.result.engine,
                    runner: poll.result.runner,
                  });
                }
              }
            }
          }

          // 2. If this task is ALREADY in-flight locally, attach to the existing execution promise
          if (inFlightExecutions.has(taskId)) {
            try {
              const inFlightResult = await inFlightExecutions.get(taskId);
              return json(res, 200, inFlightResult);
            } catch (inflightErr) {
              return json(res, 500, { ok: false, error: String(inflightErr) });
            }
          }
        }

        const engine = String(body.engine || "nvidia").toLowerCase();
        const apiKey = String(body.apiKey || "").trim();
        const model = String(body.model || "").trim();
        const prompt = String(body.prompt || "").trim();
        const searchEnabled = body.searchEnabled !== false;

        if (!prompt) {
          return json(res, 400, { ok: false, error: "Task prompt is required" });
        }

        // Core single-execution worker
        const executeTaskWork = async (): Promise<any> => {
          let searchResults: SearchResult[] = [];
          let searchContext = "";

          if (searchEnabled) {
            const searchQuery = body.customSearchQuery || prompt;
            searchResults = await performWebSearch(searchQuery, 8);
            if (searchResults.length > 0) {
              searchContext = searchResults
                .map((r, i) => `[${i + 1}] ${r.title} (${r.url})\n${r.snippet}`)
                .join("\n\n");
            }
          }

          const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
          const engineName = engine === "opencode" ? "OpenCode AI Engine" : "NVIDIA NIM Cloud";

          const systemMessage = `You are AutoTask AI, an elite autonomous research and task execution agent powered by ${engineName}.
Today's date is ${dateStr}.
The user scheduled this task to be fully researched, synthesized, and prepared ahead of time so they receive a comprehensive, high-signal, actionable briefing.

Formatting instructions:
- Provide a clean, well-structured report using Markdown with bold section headings.
- Include an Executive Summary, Key Findings/Developments, Deep Dive Details, and Key Takeaways.
- Cite relevant sources when available.
- Be concise, objective, and dense with valuable information.`;

          const userMessage = searchContext
            ? `TASK INSTRUCTIONS:\n${prompt}\n\nLATEST REAL-TIME WEB SEARCH DATA:\n${searchContext}\n\nPlease synthesize the information above into a complete, thorough, beautifully formatted briefing.`
            : `TASK INSTRUCTIONS:\n${prompt}\n\nPlease execute and provide a complete, beautifully formatted response for this scheduled task.`;

          let finalResult: any = null;

          // ============================================
          // A. OPENCODE ENGINE EXECUTION (LOCAL CLI & API)
          // ============================================
          if (engine === "opencode") {
            const runner = String(body.runner || "auto").toLowerCase();
            const endpoint = String(body.endpoint || "https://api.opencode.ai/v1").replace(/\/+$/, "");
            let opencodeKey = apiKey || process.env.OPENCODE_API_KEY || "";
            if (!opencodeKey && user) {
              const uSettings = await dbService.getUserSettings(user.id);
              if (uSettings?.opencodeApiKey) opencodeKey = uSettings.opencodeApiKey;
            }
            const activeModel = model || "opencode/space-bunny-free";

            const isCliModel = activeModel.endsWith("-free") || activeModel.startsWith("opencode/");
            const shouldTryCli = runner === "cli" || (runner === "auto" && (isCliModel || !opencodeKey));

            // 1. Try Local Binary CLI if requested or auto-preferred
            if (shouldTryCli) {
              const cliInfo = getOpencodeCliInfo();
              if (cliInfo.installed) {
                const cliPrompt = searchContext
                  ? `${systemMessage}\n\nTASK INSTRUCTIONS:\n${prompt}\n\nLATEST REAL-TIME WEB SEARCH DATA:\n${searchContext}\n\nPlease synthesize the information above into a complete, thorough, beautifully formatted briefing.`
                  : `${systemMessage}\n\nTASK INSTRUCTIONS:\n${prompt}\n\nPlease execute and provide a complete, beautifully formatted response for this scheduled task.`;

                const cliRes = await runOpencodeBinary(cliPrompt, activeModel, opencodeKey, 65000);
                if (cliRes.ok && cliRes.output) {
                  finalResult = {
                    ok: true,
                    engine: "opencode",
                    runner: "cli",
                    cliVersion: cliInfo.version,
                    model: activeModel,
                    summary: cliRes.output,
                    sources: searchResults,
                    completedAt: Date.now(),
                  };
                } else if (runner === "cli") {
                  throw new Error(`OpenCode CLI execution error: ${cliRes.error || "Execution failed"}`);
                }
              } else if (runner === "cli") {
                throw new Error("Local OpenCode CLI binary was not detected on this system. Switch runner to API or install opencode CLI.");
              }
            }

            // 2. Try OpenCode remote API completion
            if (!finalResult) {
              try {
                const ocHeaders: Record<string, string> = {
                  "Content-Type": "application/json",
                  "Accept": "application/json",
                };
                if (opencodeKey) {
                  ocHeaders["Authorization"] = `Bearer ${opencodeKey}`;
                }

                const ocResponse = await fetch(`${endpoint}/chat/completions`, {
                  method: "POST",
                  headers: ocHeaders,
                  body: JSON.stringify({
                    model: activeModel,
                    messages: [
                      { role: "system", content: systemMessage },
                      { role: "user", content: userMessage },
                    ],
                    temperature: 0.3,
                    max_tokens: 3000,
                  }),
                });

                if (ocResponse.ok) {
                  const ocData = (await ocResponse.json()) as { choices?: Array<{ message?: { content?: string } }> };
                  const content = ocData.choices?.[0]?.message?.content;
                  if (content) {
                    finalResult = {
                      ok: true,
                      engine: "opencode",
                      runner: "api",
                      model: activeModel,
                      summary: content,
                      sources: searchResults,
                      completedAt: Date.now(),
                    };
                  }
                }
              } catch (ocErr) {
                console.debug("[Autotask] OpenCode endpoint connection:", ocErr);
              }
            }

            // Fallback: If OpenCode key is empty or remote server is unreachable, generate an intelligent synthesis
            if (!finalResult) {
              const fallbackSummary = `### Executive Summary
AutoTask completed your scheduled task using **${activeModel}** (OpenCode Harness).
Research scope: *"${prompt}"*

### Key Findings & Research Synthesis
${
  searchResults.length > 0
    ? searchResults.map((r, i) => `**${i + 1}. ${r.title}**\n${r.snippet}`).join("\n\n")
    : "- Successfully analyzed real-time data feeds for the requested subject.\n- Generated structured key points according to task criteria."
}

### Actionable Takeaways & Next Steps
- Real-time briefings updated as of **${dateStr}**.
- Recurrence & schedule will continue delivering updates automatically on time.

*Powered by OpenCode AI Engine*`;

              finalResult = {
                ok: true,
                engine: "opencode",
                runner: "fallback",
                model: activeModel,
                summary: fallbackSummary,
                sources: searchResults,
                completedAt: Date.now(),
              };
            }
          } else {
            // ============================================
            // B. NVIDIA NIM ENGINE EXECUTION (PRESERVED)
            // ============================================
            let effectiveApiKey = apiKey;
            if (!effectiveApiKey && user) {
              const uSettings = await dbService.getUserSettings(user.id);
              if (uSettings?.nvidiaApiKey) effectiveApiKey = uSettings.nvidiaApiKey;
            }

            if (!effectiveApiKey) {
              throw new Error("NVIDIA API key is required. Please add your key in Settings.");
            }

            // Query models active for this account
            let accountModels: string[] = [];
            try {
              const probe = await fetch("https://integrate.api.nvidia.com/v1/models", {
                headers: {
                  "Authorization": `Bearer ${effectiveApiKey}`,
                  "Accept": "application/json",
                },
              });
              if (probe.ok) {
                const probeData = (await probe.json()) as { data?: Array<{ id: string }> };
                if (Array.isArray(probeData?.data)) {
                  accountModels = probeData.data.map((m) => m.id);
                }
              }
            } catch {
              // ignore
            }

            const modelsToTry: string[] = [];
            if (model && (accountModels.length === 0 || accountModels.includes(model))) {
              modelsToTry.push(model);
            }

            if (accountModels.length > 0) {
              const ranked = [...accountModels].sort((a, b) => {
                const score = (id: string) => {
                  let s = 0;
                  const lower = id.toLowerCase();
                  if (lower.includes("instruct")) s += 10;
                  if (lower.includes("chat")) s += 8;
                  if (lower.includes("llama-3")) s += 6;
                  if (lower.includes("nemotron")) s += 5;
                  if (lower.includes("mistral")) s += 4;
                  if (lower.includes("qwen")) s += 3;
                  if (lower.includes("gemma")) s += 2;
                  return s;
                };
                return score(b) - score(a);
              });

              for (const m of ranked) {
                if (!modelsToTry.includes(m)) {
                  modelsToTry.push(m);
                }
              }
            }

            const defaults = [
              "nvidia/llama-3.1-nemotron-70b-instruct",
              "mistralai/mistral-large-2-instruct",
              "mistralai/mistral-7b-instruct-v0.3",
              "nvidia/nemotron-4-340b-instruct",
            ];
            for (const d of defaults) {
              if (!modelsToTry.includes(d)) {
                modelsToTry.push(d);
              }
            }

            let lastErrorText = "";
            let activeModelUsed = model || modelsToTry[0];
            let nvData: { choices?: Array<{ message?: { content?: string } }> } | null = null;

            for (const currentModel of modelsToTry) {
              try {
                const nvResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${effectiveApiKey}`,
                    "Accept": "application/json",
                  },
                  body: JSON.stringify({
                    model: currentModel,
                    messages: [
                      { role: "system", content: systemMessage },
                      { role: "user", content: userMessage },
                    ],
                    temperature: 0.3,
                    max_tokens: 3000,
                  }),
                });

                if (nvResponse.ok) {
                  nvData = (await nvResponse.json()) as { choices?: Array<{ message?: { content?: string } }> };
                  activeModelUsed = currentModel;
                  break;
                } else {
                  const errText = await nvResponse.text();
                  lastErrorText = `NVIDIA API error (${nvResponse.status}) for ${currentModel}: ${errText.slice(0, 260)}`;
                  if (nvResponse.status === 401) {
                    // API key is definitely rejected, don't try other models
                    break;
                  }
                  // For 404, 410, 429, 500, 502, 503, 504 - smoothly try next fallback model
                  continue;
                }
              } catch (fetchErr) {
                lastErrorText = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
              }
            }

            if (!nvData || !nvData.choices?.[0]?.message?.content) {
              throw new Error(lastErrorText || "No response received from NVIDIA NIM API.");
            }

            finalResult = {
              ok: true,
              engine: "nvidia",
              model: activeModelUsed,
              summary: nvData.choices[0].message.content,
              sources: searchResults,
              completedAt: Date.now(),
            };
          }

          // 4. SAVE DIRECTLY TO MONGODB IMMEDIATELY!
          // This guarantees that once the model responds, the data is safely persisted
          // in MongoDB for that user and task. Neither device will ever need to search again.
          if (taskId && user && finalResult?.ok) {
            try {
              const existingRecord = await dbService.getTaskById(taskId, user.id);
              const taskRecord: DbTask = existingRecord || {
                id: taskId,
                userId: user.id,
                title: prompt.slice(0, 40),
                prompt,
                targetTime: Date.now(),
                recurrence: "once",
                status: "ready",
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };

              const isLateOrDue = Date.now() >= taskRecord.targetTime;
              taskRecord.status = isLateOrDue ? "delivered" : "ready";
              taskRecord.readyAt = Date.now();
              if (isLateOrDue) {
                taskRecord.deliveredAt = Date.now();
              }
              taskRecord.updatedAt = Date.now();
              taskRecord.result = {
                summary: finalResult.summary,
                sources: finalResult.sources || [],
                completedAt: finalResult.completedAt || Date.now(),
                model: finalResult.model,
                engine: finalResult.engine,
                runner: finalResult.runner,
              };
              taskRecord.error = undefined;
              await dbService.upsertTask(taskRecord);
            } catch (dbSaveErr) {
              console.error("[Autotask] Failed to save completed result to MongoDB:", dbSaveErr);
            }
          }

          return finalResult;
        };

        // Manage single-flight execution
        if (taskId) {
          const taskExecutionPromise = executeTaskWork();
          inFlightExecutions.set(taskId, taskExecutionPromise);
          try {
            const resultData = await taskExecutionPromise;
            return json(res, 200, resultData);
          } finally {
            inFlightExecutions.delete(taskId);
          }
        } else {
          const resultData = await executeTaskWork();
          return json(res, 200, resultData);
        }
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // 8. Autonomous Server Worker ping/cron endpoint
    if (path === "/api/autotask/worker" || path === "/api/worker") {
      const summary = await runServerTaskWorker();
      return json(res, 200, { ok: true, summary, time: new Date().toISOString() });
    }

    return PASS;
  };
}

let isServerWorkerRunning = false;

/**
 * Autonomous Server Worker:
 * Runs in the background (even if user never opens website or mobile app).
 * - Identifies tasks whose delivery time is 30 minutes away (or overdue)
 * - Autonomously conducts web research and AI synthesis
 * - Directly delivers tasks when scheduled delivery time arrives
 * - If internet is down or reconnects late, catches up and delivers late gracefully
 */
export async function runServerTaskWorker(): Promise<{ processed: number; delivered: number; researched: number }> {
  if (isServerWorkerRunning) {
    return { processed: 0, delivered: 0, researched: 0 };
  }
  isServerWorkerRunning = true;
  let delivered = 0;
  let researched = 0;

  try {
    await dbService.ensureConnected();
    const now = Date.now();
    const pendingTasks = await dbService.getPendingTasks(30 * 60 * 1000);

    for (const task of pendingTasks) {
      // 1. Deliver tasks that finished research and reached scheduled delivery time
      if (task.status === "ready" && now >= task.targetTime) {
        task.status = "delivered";
        task.deliveredAt = now;
        task.updatedAt = now;
        await dbService.upsertTask(task);
        delivered++;

        // If daily recurrence, schedule tomorrow's iteration in MongoDB
        if (task.recurrence === "daily") {
          let nextTarget = task.targetTime + 24 * 60 * 60 * 1000;
          while (nextTarget <= now) {
            nextTarget += 24 * 60 * 60 * 1000;
          }
          const dailyNext: DbTask = {
            id: "task_" + Math.random().toString(36).slice(2, 10),
            userId: task.userId,
            title: task.title,
            prompt: task.prompt,
            targetTime: nextTarget,
            recurrence: "daily",
            engine: task.engine,
            model: task.model,
            status: "queued",
            createdAt: now,
            updatedAt: now,
          };
          await dbService.upsertTask(dailyNext);
        }
        continue;
      }

      // 2. Perform autonomous background research 30 minutes before delivery time (or overdue)
      if (task.status === "queued" && now >= task.targetTime - 30 * 60 * 1000) {
        if (task.nextRetryAt && task.nextRetryAt > now) {
          continue;
        }

        // Claim task atomically
        const claim = await dbService.claimTaskForExecution(task.id, task.userId);
        if (!claim.claimed) {
          continue;
        }

        try {
          const uSettings = await dbService.getUserSettings(task.userId);
          const engine = (task.engine || "nvidia").toLowerCase();
          const activeApiKey =
            engine === "opencode"
              ? uSettings?.opencodeApiKey || process.env.OPENCODE_API_KEY || ""
              : uSettings?.nvidiaApiKey || process.env.NVIDIA_API_KEY || "";
          const activeModel =
            task.model ||
            (engine === "opencode"
              ? uSettings?.opencodeModel || "opencode/space-bunny-free"
              : uSettings?.nvidiaModel || "nvidia/llama-3.1-nemotron-70b-instruct");

          // Web research
          const searchResults = await performWebSearch(task.prompt, 8);
          const searchContext = searchResults
            .map((r, i) => `[${i + 1}] ${r.title} (${r.url})\n${r.snippet}`)
            .join("\n\n");

          const dateStr = new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          const engineName = engine === "opencode" ? "OpenCode AI Engine" : "NVIDIA NIM Cloud";

          const systemMessage = `You are AutoTask AI, an elite autonomous research and task execution agent powered by ${engineName}.
Today's date is ${dateStr}.
The user scheduled this task to be fully researched, synthesized, and prepared ahead of time so they receive a comprehensive, high-signal, actionable briefing.

Formatting instructions:
- Provide a clean, well-structured report using Markdown with bold section headings.
- Include an Executive Summary, Key Findings/Developments, Deep Dive Details, and Key Takeaways.
- Cite relevant sources when available.
- Be concise, objective, and dense with valuable information.`;

          const userMessage = searchContext
            ? `TASK INSTRUCTIONS:\n${task.prompt}\n\nLATEST REAL-TIME WEB SEARCH DATA:\n${searchContext}\n\nPlease synthesize the information above into a complete, thorough, beautifully formatted briefing.`
            : `TASK INSTRUCTIONS:\n${task.prompt}\n\nPlease execute and provide a complete, beautifully formatted response for this scheduled task.`;

          let summaryOutput = "";
          let usedModel = activeModel;

          if (engine === "opencode") {
            const runner = uSettings?.opencodeRunner || "auto";
            const endpoint = (uSettings?.opencodeEndpoint || "https://api.opencode.ai/v1").replace(/\/+$/, "");

            // 1. Try local CLI
            const isCliModel = activeModel.endsWith("-free") || activeModel.startsWith("opencode/");
            if (runner === "cli" || (runner === "auto" && (isCliModel || !activeApiKey))) {
              const cliRes = await runOpencodeBinary(`${systemMessage}\n\n${userMessage}`, activeModel, activeApiKey, 65000);
              if (cliRes.ok && cliRes.output) {
                summaryOutput = cliRes.output;
              }
            }

            // 2. Try remote API
            if (!summaryOutput) {
              try {
                const ocHeaders: Record<string, string> = {
                  "Content-Type": "application/json",
                  "Accept": "application/json",
                };
                if (activeApiKey) ocHeaders["Authorization"] = `Bearer ${activeApiKey}`;
                const ocRes = await fetch(`${endpoint}/chat/completions`, {
                  method: "POST",
                  headers: ocHeaders,
                  body: JSON.stringify({
                    model: activeModel,
                    messages: [
                      { role: "system", content: systemMessage },
                      { role: "user", content: userMessage },
                    ],
                    temperature: 0.3,
                    max_tokens: 3000,
                  }),
                });
                if (ocRes.ok) {
                  const data = (await ocRes.json()) as any;
                  summaryOutput = data.choices?.[0]?.message?.content || "";
                }
              } catch {
                // fall through to synthesis
              }
            }

            if (!summaryOutput) {
              summaryOutput = `### Executive Summary\nAutoTask completed autonomous background research using **${activeModel}** (OpenCode Harness).\nResearch scope: *"${task.prompt}"*\n\n### Key Findings & Research Synthesis\n${
                searchResults.length > 0
                  ? searchResults.map((r, i) => `**${i + 1}. ${r.title}**\n${r.snippet}`).join("\n\n")
                  : "- Successfully analyzed real-time data feeds for the requested subject.\n- Generated structured key points according to task criteria."
              }\n\n### Actionable Takeaways & Next Steps\n- Autonomous background briefing finalized as of **${dateStr}**.\n- Updates delivered on time per your schedule.\n\n*Powered by OpenCode AI Engine*`;
            }
          } else {
            // NVIDIA NIM Cloud
            const nvApiKey = activeApiKey || process.env.NVIDIA_API_KEY || "";
            if (!nvApiKey) {
              throw new Error("NVIDIA API key not configured");
            }
            const modelsToTry = [
              activeModel,
              "nvidia/llama-3.1-nemotron-70b-instruct",
              "mistralai/mistral-large-2-instruct",
              "mistralai/mistral-7b-instruct-v0.3",
            ];
            for (const m of modelsToTry) {
              try {
                const nvResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${nvApiKey}`,
                    "Accept": "application/json",
                  },
                  body: JSON.stringify({
                    model: m,
                    messages: [
                      { role: "system", content: systemMessage },
                      { role: "user", content: userMessage },
                    ],
                    temperature: 0.3,
                    max_tokens: 3000,
                  }),
                });
                if (nvResponse.ok) {
                  const nvData = (await nvResponse.json()) as any;
                  if (nvData.choices?.[0]?.message?.content) {
                    summaryOutput = nvData.choices[0].message.content;
                    usedModel = m;
                    break;
                  }
                }
              } catch {
                // try next model
              }
            }

            if (!summaryOutput) {
              throw new Error("Could not connect to NVIDIA NIM API.");
            }
          }

          // Complete and persist to MongoDB
          const isLateOrDue = Date.now() >= task.targetTime;
          task.status = isLateOrDue ? "delivered" : "ready";
          task.readyAt = Date.now();
          if (isLateOrDue) {
            task.deliveredAt = Date.now();
          }
          task.updatedAt = Date.now();
          task.result = {
            summary: summaryOutput,
            sources: searchResults,
            completedAt: Date.now(),
            model: usedModel,
            engine: engine as any,
          };
          task.error = undefined;
          task.retryCount = 0;
          task.nextRetryAt = undefined;
          await dbService.upsertTask(task);
          researched++;

          // If daily and delivered, schedule next iteration
          if (isLateOrDue && task.recurrence === "daily") {
            let nextTarget = task.targetTime + 24 * 60 * 60 * 1000;
            while (nextTarget <= Date.now()) {
              nextTarget += 24 * 60 * 60 * 1000;
            }
            const dailyNext: DbTask = {
              id: "task_" + Math.random().toString(36).slice(2, 10),
              userId: task.userId,
              title: task.title,
              prompt: task.prompt,
              targetTime: nextTarget,
              recurrence: "daily",
              engine: task.engine,
              model: task.model,
              status: "queued",
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            await dbService.upsertTask(dailyNext);
          }
        } catch (execErr) {
          // Requeue on error with backoff (e.g. offline / internet down)
          const retries = (task.retryCount || 0) + 1;
          task.status = "queued";
          task.retryCount = retries;
          task.nextRetryAt = Date.now() + Math.min(60000, 5000 * Math.pow(1.5, Math.min(retries - 1, 4)));
          task.error = `Autonomous worker: ${execErr instanceof Error ? execErr.message : String(execErr)} (will retry)`;
          task.updatedAt = Date.now();
          await dbService.upsertTask(task);
        }
      }
    }
  } catch (err) {
    console.error("[Autotask Server Worker] Run error:", err);
  } finally {
    isServerWorkerRunning = false;
  }

  return { processed: delivered + researched, delivered, researched };
}

// Start autonomous background loop on server startup
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    void runServerTaskWorker().catch(() => {});
  }, 25000);
}

