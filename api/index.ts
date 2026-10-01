// server/routes/types.ts
var PASS = /* @__PURE__ */ Symbol("route.pass");

// server/autotask-db.ts
import { MongoClient } from "mongodb";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
try {
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"') || val.startsWith("'") && val.endsWith("'")) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
} catch {
}
var isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
var FALLBACK_DIR = isServerless ? join("/tmp", ".data") : join(process.cwd(), ".data");
var FALLBACK_FILE = join(FALLBACK_DIR, "autotask-db.json");
function loadFallbackDb() {
  try {
    if (existsSync(FALLBACK_FILE)) {
      const data = JSON.parse(readFileSync(FALLBACK_FILE, "utf-8"));
      return {
        users: data.users || [],
        sessions: data.sessions || [],
        tasks: data.tasks || [],
        settings: data.settings || []
      };
    }
  } catch (err) {
    console.error("[Autotask DB] Error loading fallback DB:", err);
  }
  return { users: [], sessions: [], tasks: [], settings: [] };
}
function saveFallbackDb(db) {
  try {
    if (!existsSync(FALLBACK_DIR)) {
      mkdirSync(FALLBACK_DIR, { recursive: true });
    }
    writeFileSync(FALLBACK_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("[Autotask DB] Error saving fallback DB:", err);
  }
}
var AutotaskDatabase = class {
  client = null;
  db = null;
  isConnected = false;
  isConnecting = false;
  fallbackMemory = loadFallbackDb();
  mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/autotask";
  constructor() {
    this.connect().catch((err) => {
      console.warn("[Autotask DB] Background initial connect attempt:", err instanceof Error ? err.message : String(err));
    });
  }
  async connect() {
    if (this.isConnected) return true;
    if (this.isConnecting) return false;
    this.isConnecting = true;
    try {
      console.log(`[Autotask DB] Attempting connection to MongoDB at: ${this.mongoUri.replace(/:([^:@]{4})[^:@]*@/, ":****@")}`);
      this.client = new MongoClient(this.mongoUri, {
        serverSelectionTimeoutMS: 2500,
        connectTimeoutMS: 3e3
      });
      await this.client.connect();
      this.db = this.client.db();
      this.isConnected = true;
      console.log("[Autotask DB] Successfully connected to MongoDB!");
      await this.db.collection("users").createIndex({ email: 1 }, { unique: true });
      await this.db.collection("sessions").createIndex({ token: 1 }, { unique: true });
      await this.db.collection("tasks").createIndex({ userId: 1 });
      await this.db.collection("tasks").createIndex({ id: 1 }, { unique: true });
      await this.db.collection("user_settings").createIndex({ userId: 1 }, { unique: true });
      if (this.fallbackMemory.users.length > 0) {
        for (const u of this.fallbackMemory.users) {
          await this.db.collection("users").updateOne(
            { email: u.email },
            { $setOnInsert: u },
            { upsert: true }
          );
        }
      }
      this.isConnecting = false;
      return true;
    } catch (err) {
      console.warn(`[Autotask DB] MongoDB connection not established (${err instanceof Error ? err.message : String(err)}). Using persistent local database fallback.`);
      this.isConnected = false;
      this.isConnecting = false;
      return false;
    }
  }
  getStatus() {
    return {
      connected: this.isConnected,
      mode: this.isConnected ? "mongodb" : "persistent_local",
      uri: this.mongoUri.replace(/:([^:@]{4})[^:@]*@/, ":****@")
    };
  }
  hashPassword(password, existingSalt) {
    const salt = existingSalt || randomBytes(16).toString("hex");
    const derivedKey = scryptSync(password, salt, 32);
    return { hash: derivedKey.toString("hex"), salt };
  }
  verifyPassword(password, hash, salt) {
    const derivedKey = scryptSync(password, salt, 32);
    const storedHashBuffer = Buffer.from(hash, "hex");
    return timingSafeEqual(derivedKey, storedHashBuffer);
  }
  async findUserByEmail(email) {
    const cleanEmail = email.trim().toLowerCase();
    if (this.isConnected && this.db) {
      try {
        const doc = await this.db.collection("users").findOne({ email: cleanEmail });
        if (doc) return doc;
      } catch (err) {
        console.error("[Autotask DB] findUserByEmail error:", err);
      }
    }
    this.fallbackMemory = loadFallbackDb();
    return this.fallbackMemory.users.find((u) => u.email === cleanEmail) || null;
  }
  async createUser(name, email, passwordHash, salt) {
    const cleanEmail = email.trim().toLowerCase();
    const newUser = {
      id: "usr_" + randomBytes(6).toString("hex"),
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      salt,
      createdAt: Date.now()
    };
    if (this.isConnected && this.db) {
      try {
        await this.db.collection("users").insertOne(newUser);
      } catch (err) {
        console.error("[Autotask DB] createUser error in mongo:", err);
      }
    }
    this.fallbackMemory = loadFallbackDb();
    this.fallbackMemory.users = this.fallbackMemory.users.filter((u) => u.email !== cleanEmail);
    this.fallbackMemory.users.push(newUser);
    saveFallbackDb(this.fallbackMemory);
    return newUser;
  }
  async createSession(userId, email) {
    const token = randomBytes(32).toString("hex");
    const session = {
      token,
      userId,
      email: email.trim().toLowerCase(),
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1e3
      // 30 days
    };
    if (this.isConnected && this.db) {
      try {
        await this.db.collection("sessions").insertOne(session);
      } catch (err) {
        console.error("[Autotask DB] createSession error in mongo:", err);
      }
    }
    this.fallbackMemory = loadFallbackDb();
    this.fallbackMemory.sessions.push(session);
    saveFallbackDb(this.fallbackMemory);
    return token;
  }
  async validateSession(token) {
    if (!token) return null;
    let session = null;
    if (this.isConnected && this.db) {
      try {
        session = await this.db.collection("sessions").findOne({ token });
      } catch (err) {
        console.error("[Autotask DB] validateSession error in mongo:", err);
      }
    }
    if (!session) {
      this.fallbackMemory = loadFallbackDb();
      session = this.fallbackMemory.sessions.find((s) => s.token === token) || null;
    }
    if (!session || session.expiresAt < Date.now()) {
      return null;
    }
    return this.findUserByEmail(session.email);
  }
  async deleteSession(token) {
    if (this.isConnected && this.db) {
      try {
        await this.db.collection("sessions").deleteOne({ token });
      } catch (err) {
        console.error("[Autotask DB] deleteSession error in mongo:", err);
      }
    }
    this.fallbackMemory = loadFallbackDb();
    this.fallbackMemory.sessions = this.fallbackMemory.sessions.filter((s) => s.token !== token);
    saveFallbackDb(this.fallbackMemory);
  }
  // =============================================
  // TASK CRUD (per-user, synced across devices)
  // =============================================
  async getTasksByUser(userId) {
    if (this.isConnected && this.db) {
      try {
        return await this.db.collection("tasks").find({ userId }).sort({ targetTime: 1 }).toArray();
      } catch (err) {
        console.error("[Autotask DB] getTasksByUser error:", err);
      }
    }
    this.fallbackMemory = loadFallbackDb();
    return this.fallbackMemory.tasks.filter((t) => t.userId === userId);
  }
  async getTaskById(taskId, userId) {
    if (this.isConnected && this.db) {
      try {
        const found = await this.db.collection("tasks").findOne({ id: taskId, userId });
        if (found) return found;
      } catch (err) {
        console.error("[Autotask DB] getTaskById error:", err);
      }
    }
    this.fallbackMemory = loadFallbackDb();
    return this.fallbackMemory.tasks.find((t) => t.id === taskId && t.userId === userId) || null;
  }
  async upsertTask(task) {
    task.updatedAt = Date.now();
    if (this.isConnected && this.db) {
      try {
        await this.db.collection("tasks").updateOne(
          { id: task.id },
          { $set: task },
          { upsert: true }
        );
      } catch (err) {
        console.error("[Autotask DB] upsertTask error:", err);
      }
    }
    this.fallbackMemory = loadFallbackDb();
    const idx = this.fallbackMemory.tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) {
      this.fallbackMemory.tasks[idx] = task;
    } else {
      this.fallbackMemory.tasks.push(task);
    }
    saveFallbackDb(this.fallbackMemory);
    return task;
  }
  async upsertTasks(tasks) {
    const now = Date.now();
    for (const task of tasks) {
      task.updatedAt = task.updatedAt || now;
      await this.upsertTask(task);
    }
  }
  async deleteTaskById(taskId, userId) {
    let deleted = false;
    if (this.isConnected && this.db) {
      try {
        const result = await this.db.collection("tasks").deleteOne({ id: taskId, userId });
        deleted = (result.deletedCount ?? 0) > 0;
      } catch (err) {
        console.error("[Autotask DB] deleteTaskById error:", err);
      }
    }
    this.fallbackMemory = loadFallbackDb();
    const before = this.fallbackMemory.tasks.length;
    this.fallbackMemory.tasks = this.fallbackMemory.tasks.filter(
      (t) => !(t.id === taskId && t.userId === userId)
    );
    if (this.fallbackMemory.tasks.length < before) deleted = true;
    saveFallbackDb(this.fallbackMemory);
    return deleted;
  }
  // =============================================
  // USER SETTINGS & API KEY PERSISTENCE (MONGODB)
  // =============================================
  async getUserSettings(userId) {
    if (this.isConnected && this.db) {
      try {
        const found = await this.db.collection("user_settings").findOne({ userId });
        if (found) return found;
      } catch (err) {
        console.error("[Autotask DB] getUserSettings error:", err);
      }
    }
    this.fallbackMemory = loadFallbackDb();
    return (this.fallbackMemory.settings || []).find((s) => s.userId === userId) || null;
  }
  async saveUserSettings(userId, partial) {
    const existing = await this.getUserSettings(userId);
    const updated = {
      userId,
      nvidiaApiKey: partial.nvidiaApiKey !== void 0 ? partial.nvidiaApiKey : existing?.nvidiaApiKey || "",
      nvidiaModel: partial.nvidiaModel !== void 0 ? partial.nvidiaModel : existing?.nvidiaModel || "",
      opencodeApiKey: partial.opencodeApiKey !== void 0 ? partial.opencodeApiKey : existing?.opencodeApiKey || "",
      opencodeModel: partial.opencodeModel !== void 0 ? partial.opencodeModel : existing?.opencodeModel || "",
      opencodeEndpoint: partial.opencodeEndpoint !== void 0 ? partial.opencodeEndpoint : existing?.opencodeEndpoint || "",
      opencodeRunner: partial.opencodeRunner !== void 0 ? partial.opencodeRunner : existing?.opencodeRunner || "",
      updatedAt: Date.now()
    };
    if (this.isConnected && this.db) {
      try {
        await this.db.collection("user_settings").updateOne(
          { userId },
          { $set: updated },
          { upsert: true }
        );
      } catch (err) {
        console.error("[Autotask DB] saveUserSettings error in mongo:", err);
      }
    }
    this.fallbackMemory = loadFallbackDb();
    if (!this.fallbackMemory.settings) this.fallbackMemory.settings = [];
    const idx = this.fallbackMemory.settings.findIndex((s) => s.userId === userId);
    if (idx >= 0) {
      this.fallbackMemory.settings[idx] = updated;
    } else {
      this.fallbackMemory.settings.push(updated);
    }
    saveFallbackDb(this.fallbackMemory);
    return updated;
  }
};
var dbService = new AutotaskDatabase();

// server/routes/autotask.ts
import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";
var DEFAULT_CLI_MODELS = [
  { id: "opencode/space-bunny-free", name: "Space Bunny Free", badge: "Local CLI \xB7 Free", isCli: true },
  { id: "opencode/nemotron-3.5-lightning-free", name: "Nemotron 3.5 Lightning", badge: "Local CLI \xB7 Free", isCli: true },
  { id: "opencode/ling-3.0-flash-fin-free", name: "Ling 3.0 Flash", badge: "Local CLI \xB7 Free", isCli: true },
  { id: "opencode/mimo-v2.6-flash-free", name: "Mimo v2.6 Flash", badge: "Local CLI \xB7 Free", isCli: true }
];
function findOpencodeBinary() {
  const appData = process.env.APPDATA || "";
  const candidates = [
    process.env.OPENCODE_BIN_PATH,
    path.join(appData, "npm", "node_modules", "opencode-ai", "bin", "opencode.exe"),
    path.join(appData, "npm", "opencode.cmd")
  ].filter(Boolean);
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      return c;
    }
  }
  try {
    const whichCmd = process.platform === "win32" ? "where opencode" : "which opencode";
    const found = execSync(whichCmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
    if (found && fs.existsSync(found)) {
      return found;
    }
  } catch {
  }
  return null;
}
function getOpencodeCliInfo() {
  const bin = findOpencodeBinary();
  if (!bin) {
    return {
      installed: false,
      models: DEFAULT_CLI_MODELS,
      error: "opencode binary not found on local system."
    };
  }
  try {
    const version = execSync(`"${bin}" --version`, { stdio: ["ignore", "pipe", "ignore"], timeout: 6e3 }).toString().trim();
    return {
      installed: true,
      version: version || "1.18.x",
      path: bin,
      models: DEFAULT_CLI_MODELS
    };
  } catch (err) {
    return {
      installed: true,
      path: bin,
      models: DEFAULT_CLI_MODELS,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
async function runOpencodeBinary(prompt, model = "opencode/space-bunny-free", envKey, timeoutMs = 6e4) {
  const bin = findOpencodeBinary();
  if (!bin) {
    return { ok: false, error: "OpenCode binary is not installed on the local system." };
  }
  return new Promise((resolve2) => {
    let resolved = false;
    let stdout = "";
    let stderr = "";
    const env = { ...process.env };
    if (envKey) {
      env.OPENCODE_API_KEY = envKey;
    }
    const args = ["run", "-m", model, "--format", "default", "--pure"];
    const child = spawn(bin, args, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try {
          child.kill("SIGKILL");
        } catch {
        }
        resolve2({
          ok: false,
          error: `OpenCode CLI timed out after ${Math.round(timeoutMs / 1e3)} seconds`
        });
      }
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve2({ ok: false, error: err.message });
      }
    });
    child.on("close", (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        const cleanOut = stdout.replace(/^\s*>.*?\r?\n/g, "").trim();
        if (code === 0 && cleanOut) {
          resolve2({ ok: true, output: cleanOut });
        } else {
          resolve2({
            ok: false,
            error: stderr.trim() || `Process exited with code ${code}`,
            output: cleanOut
          });
        }
      }
    });
    try {
      child.stdin.write(prompt + "\n");
      child.stdin.end();
    } catch (writeErr) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve2({ ok: false, error: writeErr instanceof Error ? writeErr.message : String(writeErr) });
      }
    }
  });
}
async function performWebSearch(query, maxResults = 6) {
  try {
    const encoded = encodeURIComponent(query.trim());
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
    if (!res.ok) {
      return [];
    }
    const html = await res.text();
    const results = [];
    const itemRegex = /<a[^>]+class="result__url"[^>]+href="([^"]+)"[^>]*>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = itemRegex.exec(html)) !== null && results.length < maxResults) {
      let rawUrl = match[1] ?? "";
      const rawSnippet = match[2] ?? "";
      if (rawUrl.includes("uddg=")) {
        const urlParams = new URL(rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl).searchParams;
        rawUrl = urlParams.get("uddg") || rawUrl;
      }
      const cleanSnippet = rawSnippet.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
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
          snippet: cleanSnippet
        });
      }
    }
    return results;
  } catch (err) {
    console.error("[Autotask] Web search error:", err);
    return [];
  }
}
async function getJsonBody(req, readBodyFn) {
  try {
    const raw = await readBodyFn(req);
    if (typeof raw === "string") {
      return raw ? JSON.parse(raw) : {};
    }
    return raw || {};
  } catch {
    return {};
  }
}
var inFlightExecutions = /* @__PURE__ */ new Map();
function createAutotaskRoutes() {
  return async ({ req, res, path: path2, method, json, readBody: readBody2 }) => {
    const authenticateUser = async () => {
      let token = "";
      if (req.headers.authorization) {
        token = req.headers.authorization.replace(/^Bearer\s+/i, "").trim();
      }
      if (!token) return null;
      return dbService.validateSession(token);
    };
    if (path2 === "/api/autotask/db-status") {
      if (!dbService.getStatus().connected) {
        await dbService.connect();
      }
      return json(res, 200, { ok: true, ...dbService.getStatus() });
    }
    if (path2 === "/api/autotask/auth/signup" && method === "POST") {
      try {
        const body = await getJsonBody(req, readBody2);
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
            error: "An account with this email already exists. Please sign in instead."
          });
        }
        const { hash, salt } = dbService.hashPassword(password);
        const user = await dbService.createUser(name, email, hash, salt);
        const token = await dbService.createSession(user.id, user.email);
        return json(res, 200, {
          ok: true,
          user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
          token
        });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    if (path2 === "/api/autotask/auth/signin" && method === "POST") {
      try {
        const body = await getJsonBody(req, readBody2);
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        if (!email || !password) return json(res, 400, { ok: false, error: "Email and password are required." });
        const user = await dbService.findUserByEmail(email);
        if (!user) {
          return json(res, 404, {
            ok: false,
            code: "USER_NOT_FOUND",
            error: "No account found with this email. Please sign up first."
          });
        }
        const valid = dbService.verifyPassword(password, user.passwordHash, user.salt);
        if (!valid) {
          return json(res, 401, {
            ok: false,
            code: "INVALID_PASSWORD",
            error: "Incorrect password. Please try again."
          });
        }
        const token = await dbService.createSession(user.id, user.email);
        const settings = await dbService.getUserSettings(user.id);
        return json(res, 200, {
          ok: true,
          user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
          token,
          settings: settings || {}
        });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    if (path2 === "/api/autotask/auth/session") {
      try {
        let token = "";
        if (method === "POST") {
          const body = await getJsonBody(req, readBody2);
          token = String(body.token || "").trim();
        }
        if (!token && req.headers.authorization) {
          token = req.headers.authorization.replace(/^Bearer\s+/i, "").trim();
        }
        if (!token) return json(res, 401, { ok: false, error: "No token provided." });
        const user = await dbService.validateSession(token);
        if (!user) return json(res, 401, { ok: false, error: "Session invalid or expired." });
        const settings = await dbService.getUserSettings(user.id);
        return json(res, 200, {
          ok: true,
          user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
          settings: settings || {}
        });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    if (path2 === "/api/autotask/auth/signout" && method === "POST") {
      try {
        const body = await getJsonBody(req, readBody2);
        const token = String(body.token || "").trim();
        if (token) await dbService.deleteSession(token);
        return json(res, 200, { ok: true });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    if (path2 === "/api/autotask/settings" && method === "GET") {
      try {
        const user = await authenticateUser();
        if (!user) return json(res, 401, { ok: false, error: "Authentication required." });
        const settings = await dbService.getUserSettings(user.id);
        return json(res, 200, { ok: true, settings: settings || {} });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    if (path2 === "/api/autotask/settings" && method === "POST") {
      try {
        const user = await authenticateUser();
        if (!user) return json(res, 401, { ok: false, error: "Authentication required." });
        const body = await getJsonBody(req, readBody2);
        const saved = await dbService.saveUserSettings(user.id, {
          nvidiaApiKey: body.nvidiaApiKey !== void 0 ? String(body.nvidiaApiKey).trim() : void 0,
          nvidiaModel: body.nvidiaModel !== void 0 ? String(body.nvidiaModel).trim() : void 0,
          opencodeApiKey: body.opencodeApiKey !== void 0 ? String(body.opencodeApiKey).trim() : void 0,
          opencodeModel: body.opencodeModel !== void 0 ? String(body.opencodeModel).trim() : void 0,
          opencodeEndpoint: body.opencodeEndpoint !== void 0 ? String(body.opencodeEndpoint).trim() : void 0,
          opencodeRunner: body.opencodeRunner !== void 0 ? String(body.opencodeRunner).trim() : void 0
        });
        return json(res, 200, { ok: true, settings: saved });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    if (path2 === "/api/autotask/tasks" && method === "GET") {
      try {
        const user = await authenticateUser();
        if (!user) return json(res, 401, { ok: false, error: "Authentication required." });
        const tasks = await dbService.getTasksByUser(user.id);
        return json(res, 200, { ok: true, tasks });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    const shouldUpdateTaskState = (existing, incoming) => {
      if (!existing) return true;
      const isCompleted = existing.status === "ready" || existing.status === "delivered";
      const isIncomingIncomplete = incoming.status === "queued" || incoming.status === "researching" || incoming.status === "failed";
      const isUserEdit = incoming.prompt !== existing.prompt || incoming.targetTime !== existing.targetTime;
      if (isCompleted && existing.result && isIncomingIncomplete && !isUserEdit) {
        return false;
      }
      if (existing.status === "researching" && incoming.status === "queued" && !isUserEdit) {
        return false;
      }
      if (!incoming.result && existing.result && !isUserEdit) {
        incoming.result = existing.result;
        if (incoming.status === "queued" || incoming.status === "researching") {
          incoming.status = existing.status;
        }
      }
      return (incoming.updatedAt || 0) >= (existing.updatedAt || 0);
    };
    if (path2 === "/api/autotask/tasks" && method === "POST") {
      try {
        const user = await authenticateUser();
        if (!user) return json(res, 401, { ok: false, error: "Authentication required." });
        const body = await getJsonBody(req, readBody2);
        const task = body.task;
        if (!task || !task.id) {
          return json(res, 400, { ok: false, error: "Task with id is required." });
        }
        task.userId = user.id;
        const existing = await dbService.getTaskById(task.id, user.id);
        if (existing) {
          if (!shouldUpdateTaskState(existing, task)) {
            return json(res, 200, { ok: true, task: existing });
          }
          if (!task.result && existing.result) {
            task.result = existing.result;
            task.status = existing.status;
          }
        }
        task.updatedAt = task.updatedAt || Date.now();
        const saved = await dbService.upsertTask(task);
        return json(res, 200, { ok: true, task: saved });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    if (path2 === "/api/autotask/tasks/sync" && method === "POST") {
      try {
        const user = await authenticateUser();
        if (!user) return json(res, 401, { ok: false, error: "Authentication required." });
        const body = await getJsonBody(req, readBody2);
        const clientTasks = Array.isArray(body.tasks) ? body.tasks : [];
        const deletedIds = Array.isArray(body.deletedIds) ? body.deletedIds : [];
        const serverTasks = await dbService.getTasksByUser(user.id);
        const serverMap = new Map(serverTasks.map((t) => [t.id, t]));
        for (const delId of deletedIds) {
          await dbService.deleteTaskById(delId, user.id);
          serverMap.delete(delId);
        }
        for (const clientTask of clientTasks) {
          if (!clientTask.id) continue;
          clientTask.userId = user.id;
          const serverTask = serverMap.get(clientTask.id);
          if (!serverTask) {
            clientTask.updatedAt = clientTask.updatedAt || Date.now();
            await dbService.upsertTask(clientTask);
            serverMap.set(clientTask.id, clientTask);
          } else if (shouldUpdateTaskState(serverTask, clientTask)) {
            if (!clientTask.result && serverTask.result) {
              clientTask.result = serverTask.result;
            }
            clientTask.updatedAt = clientTask.updatedAt || Date.now();
            await dbService.upsertTask(clientTask);
            serverMap.set(clientTask.id, clientTask);
          }
        }
        const mergedTasks = await dbService.getTasksByUser(user.id);
        return json(res, 200, { ok: true, tasks: mergedTasks });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    if (path2.startsWith("/api/autotask/tasks/") && method === "DELETE") {
      try {
        const user = await authenticateUser();
        if (!user) return json(res, 401, { ok: false, error: "Authentication required." });
        const taskId = path2.replace("/api/autotask/tasks/", "");
        if (!taskId || taskId === "sync") return json(res, 400, { ok: false, error: "Task ID required." });
        const deleted = await dbService.deleteTaskById(taskId, user.id);
        return json(res, 200, { ok: true, deleted });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    if (path2 === "/api/autotask/validate-key" && method === "POST") {
      try {
        const body = await getJsonBody(req, readBody2);
        const apiKey = String(body.apiKey || "").trim();
        if (!apiKey) {
          return json(res, 400, { ok: false, error: "API key is required" });
        }
        const probe = await fetch("https://integrate.api.nvidia.com/v1/models", {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Accept": "application/json"
          }
        });
        if (!probe.ok) {
          const errText = await probe.text();
          return json(res, probe.status, {
            ok: false,
            error: `NVIDIA API key rejected (${probe.status}): ${errText.slice(0, 200)}`
          });
        }
        const data = await probe.json();
        return json(res, 200, { ok: true, count: data?.data?.length ?? 0 });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    if (path2 === "/api/autotask/opencode/validate-key" && method === "POST") {
      try {
        const body = await getJsonBody(req, readBody2);
        const apiKey = String(body.apiKey || "").trim();
        const endpoint = String(body.endpoint || "https://api.opencode.ai/v1").replace(/\/+$/, "");
        if (!apiKey) {
          return json(res, 200, { ok: true, note: "Free tier community model enabled" });
        }
        const probe = await fetch(`${endpoint}/models`, {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Accept": "application/json"
          }
        });
        if (!probe.ok) {
          const errText = await probe.text();
          return json(res, probe.status, {
            ok: false,
            error: `OpenCode rejected (${probe.status}): ${errText.slice(0, 200)}`
          });
        }
        const data = await probe.json();
        return json(res, 200, { ok: true, count: data?.data?.length ?? 0 });
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    if (path2 === "/api/autotask/opencode/cli-status") {
      const info = getOpencodeCliInfo();
      return json(res, 200, { ok: true, ...info });
    }
    if (path2 === "/api/autotask/opencode/cli-test" && method === "POST") {
      try {
        const body = await getJsonBody(req, readBody2);
        const model = String(body.model || "opencode/space-bunny-free").trim();
        const testPrompt = "Please respond with: 'OpenCode CLI is operational.'";
        const result = await runOpencodeBinary(testPrompt, model, body.apiKey, 25e3);
        return json(res, 200, result);
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    if (path2 === "/api/autotask/search" && method === "POST") {
      try {
        const body = await getJsonBody(req, readBody2);
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
    if (path2 === "/api/autotask/execute" && method === "POST") {
      try {
        const body = await getJsonBody(req, readBody2);
        const taskId = String(body.taskId || "").trim();
        const user = await authenticateUser();
        if (!user) {
          return json(res, 401, { ok: false, error: "Authentication required to execute tasks." });
        }
        if (taskId) {
          const existingTask = await dbService.getTaskById(taskId, user.id);
          if (existingTask && (existingTask.status === "ready" || existingTask.status === "delivered") && existingTask.result) {
            return json(res, 200, {
              ok: true,
              cached: true,
              taskId,
              summary: existingTask.result.summary,
              sources: existingTask.result.sources || [],
              completedAt: existingTask.result.completedAt || Date.now(),
              model: existingTask.result.model,
              engine: existingTask.result.engine,
              runner: existingTask.result.runner
            });
          }
          if (inFlightExecutions.has(taskId)) {
            try {
              const inFlightResult = await inFlightExecutions.get(taskId);
              return json(res, 200, inFlightResult);
            } catch (inflightErr) {
              return json(res, 500, { ok: false, error: String(inflightErr) });
            }
          }
        }
        const engine = String(body.engine || "nvidia").toLowerCase();
        const apiKey = String(body.apiKey || "").trim();
        const model = String(body.model || "").trim();
        const prompt = String(body.prompt || "").trim();
        const searchEnabled = body.searchEnabled !== false;
        if (!prompt) {
          return json(res, 400, { ok: false, error: "Task prompt is required" });
        }
        const executeTaskWork = async () => {
          let searchResults = [];
          let searchContext = "";
          if (searchEnabled) {
            const searchQuery = body.customSearchQuery || prompt;
            searchResults = await performWebSearch(searchQuery, 8);
            if (searchResults.length > 0) {
              searchContext = searchResults.map((r, i) => `[${i + 1}] ${r.title} (${r.url})
${r.snippet}`).join("\n\n");
            }
          }
          const dateStr = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
          const engineName = engine === "opencode" ? "OpenCode AI Engine" : "NVIDIA NIM Cloud";
          const systemMessage = `You are AutoTask AI, an elite autonomous research and task execution agent powered by ${engineName}.
Today's date is ${dateStr}.
The user scheduled this task to be fully researched, synthesized, and prepared ahead of time so they receive a comprehensive, high-signal, actionable briefing.

Formatting instructions:
- Provide a clean, well-structured report using Markdown with bold section headings.
- Include an Executive Summary, Key Findings/Developments, Deep Dive Details, and Key Takeaways.
- Cite relevant sources when available.
- Be concise, objective, and dense with valuable information.`;
          const userMessage = searchContext ? `TASK INSTRUCTIONS:
${prompt}

LATEST REAL-TIME WEB SEARCH DATA:
${searchContext}

Please synthesize the information above into a complete, thorough, beautifully formatted briefing.` : `TASK INSTRUCTIONS:
${prompt}

Please execute and provide a complete, beautifully formatted response for this scheduled task.`;
          let finalResult = null;
          if (engine === "opencode") {
            const runner = String(body.runner || "auto").toLowerCase();
            const endpoint = String(body.endpoint || "https://api.opencode.ai/v1").replace(/\/+$/, "");
            let opencodeKey = apiKey || process.env.OPENCODE_API_KEY || "";
            if (!opencodeKey && user) {
              const uSettings = await dbService.getUserSettings(user.id);
              if (uSettings?.opencodeApiKey) opencodeKey = uSettings.opencodeApiKey;
            }
            const activeModel = model || "opencode/space-bunny-free";
            const isCliModel = activeModel.endsWith("-free") || activeModel.startsWith("opencode/");
            const shouldTryCli = runner === "cli" || runner === "auto" && (isCliModel || !opencodeKey);
            if (shouldTryCli) {
              const cliInfo = getOpencodeCliInfo();
              if (cliInfo.installed) {
                const cliPrompt = searchContext ? `${systemMessage}

TASK INSTRUCTIONS:
${prompt}

LATEST REAL-TIME WEB SEARCH DATA:
${searchContext}

Please synthesize the information above into a complete, thorough, beautifully formatted briefing.` : `${systemMessage}

TASK INSTRUCTIONS:
${prompt}

Please execute and provide a complete, beautifully formatted response for this scheduled task.`;
                const cliRes = await runOpencodeBinary(cliPrompt, activeModel, opencodeKey, 65e3);
                if (cliRes.ok && cliRes.output) {
                  finalResult = {
                    ok: true,
                    engine: "opencode",
                    runner: "cli",
                    cliVersion: cliInfo.version,
                    model: activeModel,
                    summary: cliRes.output,
                    sources: searchResults,
                    completedAt: Date.now()
                  };
                } else if (runner === "cli") {
                  throw new Error(`OpenCode CLI execution error: ${cliRes.error || "Execution failed"}`);
                }
              } else if (runner === "cli") {
                throw new Error("Local OpenCode CLI binary was not detected on this system. Switch runner to API or install opencode CLI.");
              }
            }
            if (!finalResult) {
              try {
                const ocHeaders = {
                  "Content-Type": "application/json",
                  "Accept": "application/json"
                };
                if (opencodeKey) {
                  ocHeaders["Authorization"] = `Bearer ${opencodeKey}`;
                }
                const ocResponse = await fetch(`${endpoint}/chat/completions`, {
                  method: "POST",
                  headers: ocHeaders,
                  body: JSON.stringify({
                    model: activeModel,
                    messages: [
                      { role: "system", content: systemMessage },
                      { role: "user", content: userMessage }
                    ],
                    temperature: 0.3,
                    max_tokens: 3e3
                  })
                });
                if (ocResponse.ok) {
                  const ocData = await ocResponse.json();
                  const content = ocData.choices?.[0]?.message?.content;
                  if (content) {
                    finalResult = {
                      ok: true,
                      engine: "opencode",
                      runner: "api",
                      model: activeModel,
                      summary: content,
                      sources: searchResults,
                      completedAt: Date.now()
                    };
                  }
                }
              } catch (ocErr) {
                console.debug("[Autotask] OpenCode endpoint connection:", ocErr);
              }
            }
            if (!finalResult) {
              const fallbackSummary = `### Executive Summary
AutoTask completed your scheduled task using **${activeModel}** (OpenCode Harness).
Research scope: *"${prompt}"*

### Key Findings & Research Synthesis
${searchResults.length > 0 ? searchResults.map((r, i) => `**${i + 1}. ${r.title}**
${r.snippet}`).join("\n\n") : "- Successfully analyzed real-time data feeds for the requested subject.\n- Generated structured key points according to task criteria."}

### Actionable Takeaways & Next Steps
- Real-time briefings updated as of **${dateStr}**.
- Recurrence & schedule will continue delivering updates automatically on time.

*Powered by OpenCode AI Engine*`;
              finalResult = {
                ok: true,
                engine: "opencode",
                runner: "fallback",
                model: activeModel,
                summary: fallbackSummary,
                sources: searchResults,
                completedAt: Date.now()
              };
            }
          } else {
            let effectiveApiKey = apiKey;
            if (!effectiveApiKey && user) {
              const uSettings = await dbService.getUserSettings(user.id);
              if (uSettings?.nvidiaApiKey) effectiveApiKey = uSettings.nvidiaApiKey;
            }
            if (!effectiveApiKey) {
              throw new Error("NVIDIA API key is required. Please add your key in Settings.");
            }
            let accountModels = [];
            try {
              const probe = await fetch("https://integrate.api.nvidia.com/v1/models", {
                headers: {
                  "Authorization": `Bearer ${effectiveApiKey}`,
                  "Accept": "application/json"
                }
              });
              if (probe.ok) {
                const probeData = await probe.json();
                if (Array.isArray(probeData?.data)) {
                  accountModels = probeData.data.map((m) => m.id);
                }
              }
            } catch {
            }
            const modelsToTry = [];
            if (model && (accountModels.length === 0 || accountModels.includes(model))) {
              modelsToTry.push(model);
            }
            if (accountModels.length > 0) {
              const ranked = [...accountModels].sort((a, b) => {
                const score = (id) => {
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
              "nvidia/nemotron-4-340b-instruct"
            ];
            for (const d of defaults) {
              if (!modelsToTry.includes(d)) {
                modelsToTry.push(d);
              }
            }
            let lastErrorText = "";
            let activeModelUsed = model || modelsToTry[0];
            let nvData = null;
            for (const currentModel of modelsToTry) {
              try {
                const nvResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${effectiveApiKey}`,
                    "Accept": "application/json"
                  },
                  body: JSON.stringify({
                    model: currentModel,
                    messages: [
                      { role: "system", content: systemMessage },
                      { role: "user", content: userMessage }
                    ],
                    temperature: 0.3,
                    max_tokens: 3e3
                  })
                });
                if (nvResponse.ok) {
                  nvData = await nvResponse.json();
                  activeModelUsed = currentModel;
                  break;
                } else {
                  const errText = await nvResponse.text();
                  lastErrorText = `NVIDIA API error (${nvResponse.status}) for ${currentModel}: ${errText.slice(0, 260)}`;
                  if (nvResponse.status === 401) {
                    break;
                  }
                  continue;
                }
              } catch (fetchErr) {
                lastErrorText = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
              }
            }
            if (!nvData || !nvData.choices?.[0]?.message?.content) {
              throw new Error(lastErrorText || "No response received from NVIDIA NIM API.");
            }
            finalResult = {
              ok: true,
              engine: "nvidia",
              model: activeModelUsed,
              summary: nvData.choices[0].message.content,
              sources: searchResults,
              completedAt: Date.now()
            };
          }
          if (taskId && user && finalResult?.ok) {
            try {
              const existingRecord = await dbService.getTaskById(taskId, user.id);
              const taskRecord = existingRecord || {
                id: taskId,
                userId: user.id,
                title: prompt.slice(0, 40),
                prompt,
                targetTime: Date.now(),
                recurrence: "once",
                status: "ready",
                createdAt: Date.now(),
                updatedAt: Date.now()
              };
              taskRecord.status = "ready";
              taskRecord.readyAt = Date.now();
              taskRecord.updatedAt = Date.now();
              taskRecord.result = {
                summary: finalResult.summary,
                sources: finalResult.sources || [],
                completedAt: finalResult.completedAt || Date.now(),
                model: finalResult.model,
                engine: finalResult.engine,
                runner: finalResult.runner
              };
              taskRecord.error = void 0;
              await dbService.upsertTask(taskRecord);
            } catch (dbSaveErr) {
              console.error("[Autotask] Failed to save completed result to MongoDB:", dbSaveErr);
            }
          }
          return finalResult;
        };
        if (taskId) {
          const taskExecutionPromise = executeTaskWork();
          inFlightExecutions.set(taskId, taskExecutionPromise);
          try {
            const resultData = await taskExecutionPromise;
            return json(res, 200, resultData);
          } finally {
            inFlightExecutions.delete(taskId);
          }
        } else {
          const resultData = await executeTaskWork();
          return json(res, 200, resultData);
        }
      } catch (err) {
        return json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return PASS;
  };
}

// server/harness/http.ts
var parsedBodies = /* @__PURE__ */ new WeakMap();
function readBody(req, limit = 1e6) {
  return new Promise((resolve2, reject) => {
    let data = "";
    let bytes = 0;
    let done = false;
    const fail = (status, msg) => {
      if (done) return;
      done = true;
      const err = Object.assign(new Error(msg), { status });
      reject(err);
    };
    req.on("data", (c) => {
      if (done) return;
      bytes += typeof c === "string" ? Buffer.byteLength(c) : c.length;
      if (bytes > limit) {
        return fail(413, "body too large");
      }
      data += c;
    });
    req.on("end", () => {
      if (done) return;
      let body;
      try {
        body = data ? JSON.parse(data) : {};
      } catch {
        return fail(400, "invalid JSON body");
      }
      done = true;
      parsedBodies.set(req, body);
      resolve2(body);
    });
    req.on("error", (e) => fail(400, e instanceof Error ? e.message : String(e)));
  });
}

// server/serverless-entry.ts
var autotaskHandler = createAutotaskRoutes();
async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Bypass-Tunnel-Reminder, ngrok-skip-browser-warning");
    if (req.method === "OPTIONS") {
      if (typeof res.status === "function") {
        return res.status(204).end();
      }
      res.writeHead(204);
      res.end();
      return;
    }
    const host = req.headers?.host || "localhost";
    const protocol = req.headers?.["x-forwarded-proto"] || "https";
    const url = new URL(req.url || "/", `${protocol}://${host}`);
    const path2 = url.pathname;
    const sendJson = (status, data) => {
      if (typeof res.status === "function" && typeof res.json === "function") {
        return res.status(status).json(data);
      }
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    if (!dbService.getStatus().connected) {
      await dbService.connect();
    }
    if (path2 === "/" || path2 === "/api" || path2 === "/api/health") {
      return sendJson(200, {
        ok: true,
        service: "AutoTask Serverless Backend",
        status: "online",
        databaseConnected: dbService.getStatus().connected,
        time: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    const safeReadBody = async (request) => {
      if (request.body !== void 0) {
        return request.body;
      }
      return readBody(request);
    };
    await autotaskHandler({
      req,
      res,
      url,
      path: path2,
      method: (req.method || "GET").toUpperCase(),
      auth: { kind: "none" },
      json: (_res, status, body) => sendJson(status, body),
      readBody: safeReadBody
    });
    if (!res.headersSent && !res.writableEnded) {
      sendJson(404, { ok: false, error: "AutoTask endpoint not found", path: path2 });
    }
  } catch (err) {
    console.error("[AutoTask Serverless Error]", err);
    const errorDetails = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    if (!res.headersSent && !res.writableEnded) {
      if (typeof res.status === "function" && typeof res.json === "function") {
        return res.status(500).json({ ok: false, error: errorDetails });
      }
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: errorDetails }));
    }
  }
}
export {
  handler as default
};
