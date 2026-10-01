// Centralized API configuration and fetch wrapper for AutoTask
// Handles seamless communication whether running on Web (localhost or deployed domain like Netlify)
// or inside Mobile Android APK (Capacitor).

export const DEFAULT_PRODUCTION_BACKEND = "https://autotask-mocha.vercel.app";
const STORAGE_SERVER_KEY = "autotask_server_url";

export function isMobileApp(): boolean {
  if (typeof window === "undefined") return false;
  // Capacitor sets window.Capacitor or window.location.protocol to capacitor:
  const isCapacitor = Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() ||
    window.location.protocol === "capacitor:" ||
    (window.location.hostname === "localhost" && (!window.location.port || window.location.port === "80"))
  );
  return isCapacitor;
}

export function getApiBaseUrl(): string {
  if (typeof window === "undefined") return DEFAULT_PRODUCTION_BACKEND;

  // 1. Explicit user-configured server URL (saved in localStorage)
  const saved = localStorage.getItem(STORAGE_SERVER_KEY);
  if (saved && saved.trim()) {
    return saved.trim().replace(/\/+$/, "");
  }

  // 2. Build-time environment variable (e.g. VITE_AUTOTASK_SERVER_URL)
  const envUrl = (import.meta as unknown as { env?: { VITE_AUTOTASK_SERVER_URL?: string } }).env?.VITE_AUTOTASK_SERVER_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  // 3. Inside Mobile APK (Capacitor): Connect directly to your live Vercel backend
  if (isMobileApp()) {
    return DEFAULT_PRODUCTION_BACKEND;
  }

  // 4. In Web browser:
  // If running on local development (localhost / 127.0.0.1 on dev port), use relative path to hit local Vite proxy/dev server.
  // Otherwise (deployed on Netlify or remote domain), connect directly to your live Vercel backend.
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "";
  }

  return DEFAULT_PRODUCTION_BACKEND;
}

export function setApiBaseUrl(url: string): void {
  if (typeof window === "undefined") return;
  const clean = url.trim().replace(/\/+$/, "");
  if (!clean) {
    localStorage.removeItem(STORAGE_SERVER_KEY);
  } else {
    localStorage.setItem(STORAGE_SERVER_KEY, clean);
  }
}

export async function autotaskFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const fullUrl = base ? `${base}${cleanPath}` : cleanPath;

  const headers = new Headers(init?.headers || {});
  headers.set("Bypass-Tunnel-Reminder", "true");
  headers.set("ngrok-skip-browser-warning", "true");

  try {
    return await fetch(fullUrl, {
      ...init,
      headers,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (base) {
      throw new Error(`Failed to connect to AutoTask server at ${base}. (${errorMsg})`);
    } else {
      throw new Error(`Failed to connect to AutoTask server. (${errorMsg})`);
    }
  }
}
