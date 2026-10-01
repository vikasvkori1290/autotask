import { autotaskFetch } from "./api";
import { applyCloudSettings } from "./settings";

export interface AutotaskUser {
  id: string;
  name: string;
  email: string;
  createdAt: number;
}

const STORAGE_KEY = "autotask_current_user";
const TOKEN_KEY = "autotask_session_token";

export function getCurrentUser(): AutotaskUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getSessionToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export async function restoreSession(): Promise<AutotaskUser | null> {
  const token = getSessionToken();
  if (!token) return null;

  try {
    const res = await autotaskFetch("/api/autotask/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
        if (data.settings) {
          applyCloudSettings(data.settings);
        }
        return data.user;
      }
      // Server explicitly revoked or expired this session token
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
  } catch (err) {
    console.debug("[Autotask] Session check offline fallback:", err);
  }

  // If server is offline or unreachable, retain cached user so user is not logged out
  return getCurrentUser();
}

export async function signUp(
  name: string,
  email: string,
  password: string
): Promise<{ ok: boolean; code?: string; error?: string; user?: AutotaskUser }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  if (!cleanName) return { ok: false, error: "Please enter your name." };
  if (!cleanEmail || !cleanEmail.includes("@")) return { ok: false, error: "Please enter a valid email address." };
  if (!password || password.length < 4) return { ok: false, error: "Password must be at least 4 characters." };

  try {
    const res = await autotaskFetch("/api/autotask/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cleanName, email: cleanEmail, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      if (data.user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
      }
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
      }
      return { ok: true, user: data.user };
    }

    return {
      ok: false,
      code: data.code,
      error: data.error || "Failed to create account.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error during sign up.",
    };
  }
}

export async function signIn(
  email: string,
  password: string
): Promise<{ ok: boolean; code?: string; error?: string; user?: AutotaskUser }> {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes("@")) return { ok: false, error: "Please enter a valid email address." };
  if (!password) return { ok: false, error: "Please enter your password." };

  try {
    const res = await autotaskFetch("/api/autotask/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cleanEmail, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      if (data.user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
      }
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
      }
      if (data.settings) {
        applyCloudSettings(data.settings);
      }
      return { ok: true, user: data.user };
    }

    return {
      ok: false,
      code: data.code,
      error: data.error || "Sign in failed.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error during sign in.",
    };
  }
}

export function signOut(): void {
  const token = getSessionToken();
  if (token) {
    autotaskFetch("/api/autotask/auth/signout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => {});
  }
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TOKEN_KEY);
}
