// Centralized API configuration and fetch wrapper for AutoTask
// Handles seamless communication whether running on Web (localhost or deployed domain)
// or inside Mobile Android APK (Capacitor).

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
  if (typeof window === "undefined") return "";

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

  // 3. If running inside Mobile APK (Capacitor), localhost:80 does not exist on the phone,
  // so default to the developer machine's local Wi-Fi IP or configured server.
  if (isMobileApp()) {
    return "http://192.168.0.101:5199";
  }

  // 4. In standard Web browser, relative URL "" automatically hits the current host
  return "";
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

  try {
    return await fetch(fullUrl, init);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (base) {
      throw new Error(`Failed to connect to AutoTask server at ${base}. (${errorMsg})`);
    } else {
      throw new Error(`Failed to connect to AutoTask server. (${errorMsg})`);
    }
  }
}
