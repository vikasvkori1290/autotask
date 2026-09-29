export interface AutotaskUser {
  id: string;
  name: string;
  email: string;
  createdAt: number;
}

const STORAGE_KEY = "autotask_current_user";
const USERS_DB_KEY = "autotask_users_db";

interface StoredAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: number;
}

// Simple fast hash for local storage verification
function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return String(hash);
}

function getStoredAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(USERS_DB_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredAccounts(accounts: StoredAccount[]): void {
  try {
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.error("Failed to save accounts to localStorage", err);
  }
}

export function getCurrentUser(): AutotaskUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function signUp(name: string, email: string, password: string): { ok: boolean; error?: string; user?: AutotaskUser } {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  if (!cleanName) return { ok: false, error: "Please enter your name." };
  if (!cleanEmail || !cleanEmail.includes("@")) return { ok: false, error: "Please enter a valid email address." };
  if (!password || password.length < 4) return { ok: false, error: "Password must be at least 4 characters." };

  const accounts = getStoredAccounts();
  if (accounts.some((a) => a.email === cleanEmail)) {
    return { ok: false, error: "An account with this email already exists on this device." };
  }

  const user: StoredAccount = {
    id: "usr_" + Math.random().toString(36).slice(2, 10),
    name: cleanName,
    email: cleanEmail,
    passwordHash: hashPassword(password),
    createdAt: Date.now(),
  };

  accounts.push(user);
  saveStoredAccounts(accounts);

  const sessionUser: AutotaskUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
  return { ok: true, user: sessionUser };
}

export function signIn(email: string, password: string): { ok: boolean; error?: string; user?: AutotaskUser } {
  const cleanEmail = email.trim().toLowerCase();
  const accounts = getStoredAccounts();
  const account = accounts.find((a) => a.email === cleanEmail);

  if (!account) {
    return { ok: false, error: "Account not found. Please sign up first." };
  }

  if (account.passwordHash !== hashPassword(password)) {
    return { ok: false, error: "Incorrect password." };
  }

  const sessionUser: AutotaskUser = {
    id: account.id,
    name: account.name,
    email: account.email,
    createdAt: account.createdAt,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
  return { ok: true, user: sessionUser };
}

export function signOut(): void {
  localStorage.removeItem(STORAGE_KEY);
}
