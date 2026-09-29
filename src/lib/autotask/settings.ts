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

const KEY_STORAGE = "autotask_nvidia_key";
const MODEL_STORAGE = "autotask_nvidia_model";
export const DEFAULT_MODEL = "nvidia/llama-3.1-nemotron-70b-instruct";

export function getNvidiaApiKey(): string {
  return (localStorage.getItem(KEY_STORAGE) || "").trim();
}

export function setNvidiaApiKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key.trim());
}

export function getNvidiaModel(): string {
  const stored = localStorage.getItem(MODEL_STORAGE);
  if (!stored) return DEFAULT_MODEL;

  // Automatically migrate deprecated or retired models (e.g. meta/llama-3.3-70b-instruct)
  const validIds = AVAILABLE_NVIDIA_MODELS.map((m) => m.id);
  if (!validIds.includes(stored)) {
    localStorage.setItem(MODEL_STORAGE, DEFAULT_MODEL);
    return DEFAULT_MODEL;
  }
  return stored;
}

export function setNvidiaModel(model: string): void {
  localStorage.setItem(MODEL_STORAGE, model);
}

export async function testNvidiaKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  // First attempt via server proxy
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

  // Fallback: Direct probe to NVIDIA NIM API
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
