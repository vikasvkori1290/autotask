import { autotaskFetch } from "./api.ts";

export interface NvidiaModelOption {
  id: string;
  name: string;
  description: string;
  badge: string;
}

export const AVAILABLE_NVIDIA_MODELS: NvidiaModelOption[] = [
  {
    id: "nvidia/llama-3.1-nemotron-70b-instruct",
    name: "NVIDIA Nemotron 70B",
    description: "Flagship 70B model optimized by NVIDIA for accurate reasoning, real-time news synthesis, and instruction following.",
    badge: "Recommended",
  },
  {
    id: "mistralai/mistral-large-2-instruct",
    name: "Mistral Large 2 (123B)",
    description: "Top-tier 123B frontier model with exceptional reasoning, broad context, and high accuracy.",
    badge: "Frontier",
  },
  {
    id: "mistralai/mistral-7b-instruct-v0.3",
    name: "Mistral 7B v0.3",
    description: "Ultra-fast, lightweight model ideal for quick bullet-point briefings.",
    badge: "Fast",
  },
  {
    id: "nvidia/nemotron-4-340b-instruct",
    name: "NVIDIA Nemotron-4 340B",
    description: "Massive 340B titan model designed for complex analysis and deep synthetic reasoning.",
    badge: "Titan 340B",
  },
];

// OpenCode Models (both Local Binary CLI & API)
export interface OpencodeModelOption {
  id: string;
  name: string;
  description: string;
  badge: string;
  isCli?: boolean;
}

export const AVAILABLE_OPENCODE_MODELS: OpencodeModelOption[] = [
  {
    id: "opencode/space-bunny-free",
    name: "Space Bunny Free",
    description: "High-speed free model ready to run immediately through your local OpenCode CLI.",
    badge: "Local CLI · Free",
    isCli: true,
  },
  {
    id: "opencode/nemotron-3.5-lightning-free",
    name: "Nemotron 3.5 Lightning",
    description: "Ultra-fast reasoning model powered by local OpenCode binary harness.",
    badge: "Local CLI · Free",
    isCli: true,
  },
  {
    id: "opencode/ling-3.0-flash-fin-free",
    name: "Ling 3.0 Flash",
    description: "Financial & news synthesis model via local OpenCode CLI.",
    badge: "Local CLI · Free",
    isCli: true,
  },
  {
    id: "opencode/mimo-v2.6-flash-free",
    name: "Mimo v2.6 Flash",
    description: "Lightweight, zero-cost intelligence model on local system binary.",
    badge: "Local CLI · Free",
    isCli: true,
  },
  {
    id: "opencode-go/deepseek-v4-flash",
    name: "DeepSeek v4 Flash",
    description: "Frontier Chinese & global reasoning model routed via OpenCode Go.",
    badge: "OpenCode Go",
  },
  {
    id: "opencode-go/glm-5.3",
    name: "GLM 5.3",
    description: "Deep structured analysis and multi-source research via OpenCode Go.",
    badge: "OpenCode Go",
  },
  {
    id: "opencode/deepseek-r1",
    name: "DeepSeek R1",
    description: "State-of-the-art open reasoning model with transparent chain-of-thought analysis.",
    badge: "Deep Reasoning",
  },
  {
    id: "opencode/claude-3-7-sonnet",
    name: "Claude 3.7 Sonnet (OpenCode)",
    description: "Frontier hybrid reasoning and agentic model via OpenCode provider routing.",
    badge: "Frontier",
  },
  {
    id: "opencode/gpt-4o",
    name: "GPT-4o (OpenCode)",
    description: "High speed multimodal model for concise briefings and synthesis.",
    badge: "Balanced",
  },
];

// NVIDIA Storage Keys
const NVIDIA_KEY_STORAGE = "autotask_nvidia_key";
const NVIDIA_MODEL_STORAGE = "autotask_nvidia_model";
export const DEFAULT_NVIDIA_MODEL = "nvidia/llama-3.1-nemotron-70b-instruct";

// OpenCode Storage Keys
const OPENCODE_KEY_STORAGE = "autotask_opencode_key";
const OPENCODE_MODEL_STORAGE = "autotask_opencode_model";
const OPENCODE_ENDPOINT_STORAGE = "autotask_opencode_endpoint";
const OPENCODE_RUNNER_STORAGE = "autotask_opencode_runner";
export const DEFAULT_OPENCODE_MODEL = "opencode/space-bunny-free";
export const DEFAULT_OPENCODE_ENDPOINT = "https://api.opencode.ai/v1";

// Cloud Settings Sync & Persistence
const AUTH_TOKEN_STORAGE = "autotask_session_token";

export interface UserSettingsPayload {
  nvidiaApiKey?: string;
  nvidiaModel?: string;
  opencodeApiKey?: string;
  opencodeModel?: string;
  opencodeEndpoint?: string;
  opencodeRunner?: string;
}

export function applyCloudSettings(settings?: UserSettingsPayload | null): void {
  if (!settings) return;
  if (settings.nvidiaApiKey) {
    localStorage.setItem(NVIDIA_KEY_STORAGE, settings.nvidiaApiKey.trim());
  }
  if (settings.nvidiaModel) {
    localStorage.setItem(NVIDIA_MODEL_STORAGE, settings.nvidiaModel.trim());
  }
  if (settings.opencodeApiKey) {
    localStorage.setItem(OPENCODE_KEY_STORAGE, settings.opencodeApiKey.trim());
  }
  if (settings.opencodeModel) {
    localStorage.setItem(OPENCODE_MODEL_STORAGE, settings.opencodeModel.trim());
  }
  if (settings.opencodeEndpoint) {
    localStorage.setItem(OPENCODE_ENDPOINT_STORAGE, settings.opencodeEndpoint.trim());
  }
  if (settings.opencodeRunner) {
    localStorage.setItem(OPENCODE_RUNNER_STORAGE, settings.opencodeRunner.trim());
  }
}

export async function saveSettingsToServer(partial: UserSettingsPayload): Promise<void> {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE);
  if (!token) return;

  try {
    await autotaskFetch("/api/autotask/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(partial),
    });
  } catch (err) {
    console.debug("[Autotask] Failed to persist settings to server:", err);
  }
}

export async function syncSettingsFromServer(): Promise<UserSettingsPayload | null> {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE);
  if (!token) return null;

  try {
    const res = await autotaskFetch("/api/autotask/settings", {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.settings) {
        applyCloudSettings(data.settings);
        return data.settings;
      }
    }
  } catch (err) {
    console.debug("[Autotask] Failed to fetch settings from server:", err);
  }
  return null;
}

// NVIDIA Helpers
export function getNvidiaApiKey(): string {
  return (localStorage.getItem(NVIDIA_KEY_STORAGE) || "").trim();
}

export function setNvidiaApiKey(key: string): void {
  const cleanKey = key.trim();
  localStorage.setItem(NVIDIA_KEY_STORAGE, cleanKey);
  void saveSettingsToServer({ nvidiaApiKey: cleanKey });
}

export function getNvidiaModel(): string {
  const stored = localStorage.getItem(NVIDIA_MODEL_STORAGE);
  if (!stored) return DEFAULT_NVIDIA_MODEL;

  const validIds = AVAILABLE_NVIDIA_MODELS.map((m) => m.id);
  if (!validIds.includes(stored)) {
    localStorage.setItem(NVIDIA_MODEL_STORAGE, DEFAULT_NVIDIA_MODEL);
    return DEFAULT_NVIDIA_MODEL;
  }
  return stored;
}

export function setNvidiaModel(model: string): void {
  localStorage.setItem(NVIDIA_MODEL_STORAGE, model);
  void saveSettingsToServer({ nvidiaModel: model });
}

export async function testNvidiaKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await autotaskFetch("/api/autotask/validate-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // Fall through
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
      return { ok: false, error: `NVIDIA API key rejected (${probe.status}): ${errText.slice(0, 180)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// OpenCode Helpers
export function getOpencodeApiKey(): string {
  return (localStorage.getItem(OPENCODE_KEY_STORAGE) || "").trim();
}

export function setOpencodeApiKey(key: string): void {
  const cleanKey = key.trim();
  localStorage.setItem(OPENCODE_KEY_STORAGE, cleanKey);
  void saveSettingsToServer({ opencodeApiKey: cleanKey });
}

export function getOpencodeModel(): string {
  const stored = localStorage.getItem(OPENCODE_MODEL_STORAGE);
  if (!stored) return DEFAULT_OPENCODE_MODEL;
  return stored;
}

export function setOpencodeModel(model: string): void {
  localStorage.setItem(OPENCODE_MODEL_STORAGE, model);
  void saveSettingsToServer({ opencodeModel: model });
}

export function getOpencodeEndpoint(): string {
  return (localStorage.getItem(OPENCODE_ENDPOINT_STORAGE) || DEFAULT_OPENCODE_ENDPOINT).trim();
}

export function setOpencodeEndpoint(url: string): void {
  const cleanUrl = url.trim();
  localStorage.setItem(OPENCODE_ENDPOINT_STORAGE, cleanUrl);
  void saveSettingsToServer({ opencodeEndpoint: cleanUrl });
}

export type OpencodeRunnerMode = "auto" | "cli" | "api";

export function getOpencodeRunner(): OpencodeRunnerMode {
  return (localStorage.getItem(OPENCODE_RUNNER_STORAGE) as OpencodeRunnerMode) || "auto";
}

export function setOpencodeRunner(mode: OpencodeRunnerMode): void {
  localStorage.setItem(OPENCODE_RUNNER_STORAGE, mode);
  void saveSettingsToServer({ opencodeRunner: mode });
}

export async function checkOpencodeCliStatus(): Promise<{
  ok: boolean;
  installed: boolean;
  version?: string;
  path?: string;
  models?: string[];
  error?: string;
}> {
  try {
    const res = await autotaskFetch("/api/autotask/opencode/cli-status");
    if (res.ok) {
      return await res.json();
    }
    return { ok: false, installed: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, installed: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function testOpencodeKey(apiKey: string, endpoint = DEFAULT_OPENCODE_ENDPOINT): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await autotaskFetch("/api/autotask/opencode/validate-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, endpoint }),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // Fall through
  }

  try {
    const cleanEndpoint = endpoint.replace(/\/+$/, "");
    const probe = await fetch(`${cleanEndpoint}/models`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });
    if (!probe.ok) {
      const errText = await probe.text();
      return { ok: false, error: `OpenCode rejected (${probe.status}): ${errText.slice(0, 180)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
