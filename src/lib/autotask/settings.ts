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

// OpenCode Models
export interface OpencodeModelOption {
  id: string;
  name: string;
  description: string;
  badge: string;
}

export const AVAILABLE_OPENCODE_MODELS: OpencodeModelOption[] = [
  {
    id: "opencode/x-preview-f-free",
    name: "OpenCode Zen · Ox Alpha",
    description: "Built-in OpenCode community model with 1M context window and fast tool reasoning.",
    badge: "Free / Built-in",
  },
  {
    id: "opencode/deepseek-r1",
    name: "DeepSeek R1 (OpenCode)",
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
  {
    id: "opencode/qwen-2.5-coder-32b",
    name: "Qwen 2.5 Coder 32B",
    description: "Specialized model for code digests, git tracking, and technical summaries.",
    badge: "Code & Tech",
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
export const DEFAULT_OPENCODE_MODEL = "opencode/x-preview-f-free";
export const DEFAULT_OPENCODE_ENDPOINT = "https://api.opencode.ai/v1";

// NVIDIA Helpers
export function getNvidiaApiKey(): string {
  return (localStorage.getItem(NVIDIA_KEY_STORAGE) || "").trim();
}

export function setNvidiaApiKey(key: string): void {
  localStorage.setItem(NVIDIA_KEY_STORAGE, key.trim());
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
}

export async function testNvidiaKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/autotask/validate-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // Fall through to direct probe
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
  localStorage.setItem(OPENCODE_KEY_STORAGE, key.trim());
}

export function getOpencodeModel(): string {
  const stored = localStorage.getItem(OPENCODE_MODEL_STORAGE);
  if (!stored) return DEFAULT_OPENCODE_MODEL;
  return stored;
}

export function setOpencodeModel(model: string): void {
  localStorage.setItem(OPENCODE_MODEL_STORAGE, model);
}

export function getOpencodeEndpoint(): string {
  return (localStorage.getItem(OPENCODE_ENDPOINT_STORAGE) || DEFAULT_OPENCODE_ENDPOINT).trim();
}

export function setOpencodeEndpoint(url: string): void {
  localStorage.setItem(OPENCODE_ENDPOINT_STORAGE, url.trim());
}

export async function testOpencodeKey(apiKey: string, endpoint = DEFAULT_OPENCODE_ENDPOINT): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/autotask/opencode/validate-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, endpoint }),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // Fall through to direct probe
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
