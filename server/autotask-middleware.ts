import type { IncomingMessage, ServerResponse } from "node:http";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function performWebSearch(query: string, maxResults = 6): Promise<SearchResult[]> {
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

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(data));
}

export async function handleAutotaskRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url || "").split("?")[0];

  if (req.method === "OPTIONS" && url?.startsWith("/api/autotask/")) {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.end();
    return true;
  }

  if (url === "/api/autotask/validate-key" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }
    const payload = body ? JSON.parse(body) : {};
    const apiKey = String(payload.apiKey || "").trim();

    if (!apiKey) {
      sendJson(res, 400, { ok: false, error: "API key is required" });
      return true;
    }

    try {
      const probe = await fetch("https://integrate.api.nvidia.com/v1/models", {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
        },
      });

      if (!probe.ok) {
        const errText = await probe.text();
        sendJson(res, probe.status, {
          ok: false,
          error: `NVIDIA API key rejected (${probe.status}): ${errText.slice(0, 200)}`,
        });
        return true;
      }

      const probeData = (await probe.json()) as { data?: Array<{ id: string }> };
      const models = Array.isArray(probeData?.data) ? probeData.data.map((m) => m.id) : [];

      sendJson(res, 200, { ok: true, models });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
    }
    return true;
  }

  if (url === "/api/autotask/execute" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }
    const payload = body ? JSON.parse(body) : {};
    const apiKey = String(payload.apiKey || "").trim();
    const model = String(payload.model || "").trim();
    const prompt = String(payload.prompt || "").trim();
    const searchEnabled = payload.searchEnabled !== false;

    if (!apiKey) {
      sendJson(res, 400, { ok: false, error: "NVIDIA API key is required" });
      return true;
    }
    if (!prompt) {
      sendJson(res, 400, { ok: false, error: "Task prompt is required" });
      return true;
    }

    try {
      let searchResults: SearchResult[] = [];
      let searchContext = "";

      if (searchEnabled) {
        const searchQuery = payload.customSearchQuery || prompt;
        searchResults = await performWebSearch(searchQuery, 8);
        if (searchResults.length > 0) {
          searchContext = searchResults
            .map((r, i) => `[${i + 1}] ${r.title} (${r.url})\n${r.snippet}`)
            .join("\n\n");
        }
      }

      const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const systemMessage = `You are AutoTask AI, an elite autonomous research and briefing agent powered by NVIDIA NIM.
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

      // 1. Dynamically query available models for this specific NVIDIA account
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
            console.log(`[Autotask] Available models for account (${accountModels.length}):`, accountModels);
          }
        }
      } catch (probeErr) {
        console.warn("[Autotask] Could not list account models:", probeErr);
      }

      // 2. Build prioritized candidate list:
      // User's chosen model first, then account's available instruct/chat models, then defaults
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
          console.log(`[Autotask] Attempting execution with model: ${currentModel}`);
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
            console.log(`[Autotask] Successfully generated briefing with: ${currentModel}`);
            break;
          } else {
            const errText = await nvResponse.text();
            lastErrorText = `NVIDIA API error (${nvResponse.status}) for ${currentModel}: ${errText.slice(0, 260)}`;
            console.warn(`[Autotask] Model ${currentModel} returned ${nvResponse.status}: ${errText.slice(0, 160)}`);
            // If model is retired (410) or missing/unassigned (404), fall back to next model
            if (nvResponse.status === 410 || nvResponse.status === 404) {
              continue;
            }
            // For auth errors (401/403) or rate limits (429), fail immediately
            break;
          }
        } catch (fetchErr) {
          lastErrorText = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        }
      }

      if (!nvData || !nvData.choices?.[0]?.message?.content) {
        sendJson(res, 500, {
          ok: false,
          error: lastErrorText || "No response received from NVIDIA NIM API.",
        });
        return true;
      }

      const content = nvData.choices[0].message.content;

      sendJson(res, 200, {
        ok: true,
        model: activeModelUsed,
        summary: content,
        sources: searchResults,
        completedAt: Date.now(),
      });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
    }
    return true;
  }

  return false;
}
