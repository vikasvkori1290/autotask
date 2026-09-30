import { MongoClient, type Db } from "mongodb";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

// Load .env from project root into process.env (server-side only)
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
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
} catch {
  // silently ignore .env loading errors
}

export interface DbUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
}

export interface DbSession {
  token: string;
  userId: string;
  email: string;
  createdAt: number;
  expiresAt: number;
}

export interface DbTaskSource {
  title: string;
  url: string;
  snippet: string;
}

export interface DbTaskResult {
  summary: string;
  sources: DbTaskSource[];
  completedAt: number;
  model: string;
  engine?: "nvidia" | "opencode";
  runner?: "cli" | "api" | "fallback";
}

export interface DbTask {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  targetTime: number;
  recurrence: "once" | "daily";
  engine?: "nvidia" | "opencode";
  model?: string;
  status: "queued" | "researching" | "ready" | "delivered" | "failed";
  createdAt: number;
  updatedAt: number;
  readyAt?: number;
  deliveredAt?: number;
  result?: DbTaskResult;
  error?: string;
  notifiedReady?: boolean;
  notifiedDelivered?: boolean;
}

const FALLBACK_DIR = join(process.cwd(), ".data");
const FALLBACK_FILE = join(FALLBACK_DIR, "autotask-db.json");

interface FallbackDb {
  users: DbUser[];
  sessions: DbSession[];
  tasks: DbTask[];
}

function loadFallbackDb(): FallbackDb {
  try {
    if (existsSync(FALLBACK_FILE)) {
      const data = JSON.parse(readFileSync(FALLBACK_FILE, "utf-8"));
      return {
        users: data.users || [],
        sessions: data.sessions || [],
        tasks: data.tasks || [],
      };
    }
  } catch (err) {
    console.error("[Autotask DB] Error loading fallback DB:", err);
  }
  return { users: [], sessions: [], tasks: [] };
}

function saveFallbackDb(db: FallbackDb): void {
  try {
    if (!existsSync(FALLBACK_DIR)) {
      mkdirSync(FALLBACK_DIR, { recursive: true });
    }
    writeFileSync(FALLBACK_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("[Autotask DB] Error saving fallback DB:", err);
  }
}

class AutotaskDatabase {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private isConnected = false;
  private isConnecting = false;
  private fallbackMemory: FallbackDb = loadFallbackDb();
  private mongoUri: string = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/autotask";

  constructor() {
    this.connect();
  }

  public async connect(): Promise<boolean> {
    if (this.isConnected) return true;
    if (this.isConnecting) return false;

    this.isConnecting = true;
    try {
      console.log(`[Autotask DB] Attempting connection to MongoDB at: ${this.mongoUri.replace(/:([^:@]{4})[^:@]*@/, ":****@")}`);
      this.client = new MongoClient(this.mongoUri, {
        serverSelectionTimeoutMS: 2500,
        connectTimeoutMS: 3000,
      });

      await this.client.connect();
      this.db = this.client.db();
      this.isConnected = true;
      console.log("[Autotask DB] Successfully connected to MongoDB!");

      // Ensure indexes
      await this.db.collection("users").createIndex({ email: 1 }, { unique: true });
      await this.db.collection("sessions").createIndex({ token: 1 }, { unique: true });
      await this.db.collection("tasks").createIndex({ userId: 1 });
      await this.db.collection("tasks").createIndex({ id: 1 }, { unique: true });

      // Migrate any fallback users to MongoDB if newly connected
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

  public getStatus() {
    return {
      connected: this.isConnected,
      mode: this.isConnected ? "mongodb" : "persistent_local",
      uri: this.mongoUri.replace(/:([^:@]{4})[^:@]*@/, ":****@"),
    };
  }

  public hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
    const salt = existingSalt || randomBytes(16).toString("hex");
    const derivedKey = scryptSync(password, salt, 32);
    return { hash: derivedKey.toString("hex"), salt };
  }

  public verifyPassword(password: string, hash: string, salt: string): boolean {
    const derivedKey = scryptSync(password, salt, 32);
    const storedHashBuffer = Buffer.from(hash, "hex");
    return timingSafeEqual(derivedKey, storedHashBuffer);
  }

  public async findUserByEmail(email: string): Promise<DbUser | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (this.isConnected && this.db) {
      try {
        const doc = await this.db.collection<DbUser>("users").findOne({ email: cleanEmail });
        if (doc) return doc;
      } catch (err) {
        console.error("[Autotask DB] findUserByEmail error:", err);
      }
    }
    this.fallbackMemory = loadFallbackDb();
    return this.fallbackMemory.users.find((u) => u.email === cleanEmail) || null;
  }

  public async createUser(name: string, email: string, passwordHash: string, salt: string): Promise<DbUser> {
    const cleanEmail = email.trim().toLowerCase();
    const newUser: DbUser = {
      id: "usr_" + randomBytes(6).toString("hex"),
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      salt,
      createdAt: Date.now(),
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

  public async createSession(userId: string, email: string): Promise<string> {
    const token = randomBytes(32).toString("hex");
    const session: DbSession = {
      token,
      userId,
      email: email.trim().toLowerCase(),
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
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

  public async validateSession(token: string): Promise<DbUser | null> {
    if (!token) return null;

    let session: DbSession | null = null;
    if (this.isConnected && this.db) {
      try {
        session = await this.db.collection<DbSession>("sessions").findOne({ token });
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

  public async deleteSession(token: string): Promise<void> {
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

  public async getTasksByUser(userId: string): Promise<DbTask[]> {
    if (this.isConnected && this.db) {
      try {
        return await this.db.collection<DbTask>("tasks").find({ userId }).sort({ targetTime: 1 }).toArray();
      } catch (err) {
        console.error("[Autotask DB] getTasksByUser error:", err);
      }
    }
    this.fallbackMemory = loadFallbackDb();
    return this.fallbackMemory.tasks.filter((t) => t.userId === userId);
  }

  public async upsertTask(task: DbTask): Promise<DbTask> {
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

  public async upsertTasks(tasks: DbTask[]): Promise<void> {
    const now = Date.now();
    for (const task of tasks) {
      task.updatedAt = task.updatedAt || now;
      await this.upsertTask(task);
    }
  }

  public async deleteTaskById(taskId: string, userId: string): Promise<boolean> {
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
}

export const dbService = new AutotaskDatabase();
