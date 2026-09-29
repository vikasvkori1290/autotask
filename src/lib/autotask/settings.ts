export interface NvidiaModelOption {
  id: string;
  name: string;
  description: string;
  badge: string;
}

export const AVAILABLE_NVIDIA_MODELS: NvidiaModelOption[] = [
  {
    id: "meta/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B Instruct",
    description: "Best for comprehensive research, structured briefings, and deep news synthesis.",
    badge: "Recommended",
  },
  {
    id: "deepseek-ai/deepseek-r1",
    name: "DeepSeek R1",
    description: "Exceptional deep analytical reasoning and nuanced synthesis.",
    badge: "Reasoning",
  },
  {
    id: "nvidia/llama-3.1-nemotron-70b-instruct",
    name: "NVIDIA Nemotron 70B",
    description: "NVIDIA's customized high-accuracy instruction-following model.",
    badge: "High Accuracy",
  },
  {
    id: "meta/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B Instruct",
    description: "Ultra-fast lightweight model for rapid bullet summaries.",
    badge: "Fast",
  },
];

const KEY_STORAGE = "autotask_nvidia_key";
const MODEL_STORAGE = "autotask_nvidia_model";

export function getNvidiaApiKey(): string {
  return (localStorage.getItem(KEY_STORAGE) || "").trim();
}

export function setNvidiaApiKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key.trim());
}

export function getNvidiaModel(): string {
  return localStorage.getItem(MODEL_STORAGE) || "meta/llama-3.3-70b-instruct";
}

export function setNvidiaModel(model: string): void {
  localStorage.setItem(MODEL_STORAGE, model);
}

export async function testNvidiaKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/autotask/validate-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
