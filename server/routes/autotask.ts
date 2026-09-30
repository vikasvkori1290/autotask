import { PASS, type RouteHandler } from "./table.ts";
import { dbService } from "../autotask-db.ts";

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

export function createAutotaskRoutes(): RouteHandler {
  return async ({ req, res, path, method, json, readBody }) => {
    // 0. DB Status
    if (path === "/api/autotask/db-status") {
      return json(res, 200, { ok: true, ...dbService.getStatus() });
    }

    // 1. Auth: Sign Up (check existence, hash password, insert to MongoDB)
    if (path === "/api/autotask/auth/signup" && method === "POST") {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
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
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
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
        return json(res, 200, {
          ok: true,
          user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
          token,
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
          const raw = await readBody(req);
          const body = raw ? JSON.parse(raw) : {};
          token = String(body.token || "").trim();
        }
        if (!token && req.headers.authorization) {
          token = req.headers.authorization.replace(/^Bearer\s+/i, "").trim();
        }
        if (!token) return json(res, 401, { ok: false, error: "No token provided." });

        const user = await dbService.validateSession(token);
        if (!user) return json(res, 401, { ok: false, error: "Session invalid or expired." });

        return json(res, 200, {
          ok: true,
          user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
        });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // 4. Auth: Sign Out
    if (path === "/api/autotask/auth/signout" && method === "POST") {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const token = String(body.token || "").trim();
        if (token) await dbService.deleteSession(token);
        return json(res, 200, { ok: true });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // 5. Validate NVIDIA API Key
    if (path === "/api/autotask/validate-key" && method === "POST") {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
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

    // 2. Perform Web Search
    if (path === "/api/autotask/search" && method === "POST") {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
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

    // 3. Execute Autonomous Task using Web Search & NVIDIA API
    if (path === "/api/autotask/execute" && method === "POST") {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const apiKey = String(body.apiKey || "").trim();
        const model = String(body.model || "").trim();
        const prompt = String(body.prompt || "").trim();
        const searchEnabled = body.searchEnabled !== false;

        if (!apiKey) {
          return json(res, 400, { ok: false, error: "NVIDIA API key is required" });
        }
        if (!prompt) {
          return json(res, 400, { ok: false, error: "Task prompt is required" });
        }

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
        const systemMessage = `You are AutoTask AI, an elite autonomous research and task execution agent powered by NVIDIA NIM.
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

        // 1. Query models active for this account
        let accountModels: string[] = [];
        try {
          const probe = await fetch("https://integrate.api.nvidia.com/v1/models", {
            headers: {
              "Authorization": `Bearer ${apiKey}`,
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
                "Authorization": `Bearer ${apiKey}`,
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
              if (nvResponse.status === 410 || nvResponse.status === 404) {
                continue;
              }
              break;
            }
          } catch (fetchErr) {
            lastErrorText = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
          }
        }

        if (!nvData || !nvData.choices?.[0]?.message?.content) {
          return json(res, 500, {
            ok: false,
            error: lastErrorText || "No response received from NVIDIA NIM API.",
          });
        }

        const content = nvData.choices[0].message.content;

        return json(res, 200, {
          ok: true,
          model: activeModelUsed,
          summary: content,
          sources: searchResults,
          completedAt: Date.now(),
        });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return PASS;
  };
}
