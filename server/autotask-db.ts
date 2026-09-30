import { MongoClient, type Db } from "mongodb";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

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

const FALLBACK_DIR = join(process.cwd(), ".data");
const FALLBACK_FILE = join(FALLBACK_DIR, "autotask-db.json");

interface FallbackDb {
  users: DbUser[];
  sessions: DbSession[];
}

function loadFallbackDb(): FallbackDb {
  try {
    if (existsSync(FALLBACK_FILE)) {
      const data = JSON.parse(readFileSync(FALLBACK_FILE, "utf-8"));
      return {
        users: data.users || [],
        sessions: data.sessions || [],
      };
    }
  } catch (err) {
    console.error("[Autotask DB] Error loading fallback DB:", err);
  }
  return { users: [], sessions: [] };
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
}

export const dbService = new AutotaskDatabase();
