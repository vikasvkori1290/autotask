import {
  getNvidiaApiKey,
  getNvidiaModel,
  setNvidiaModel,
  getOpencodeApiKey,
  getOpencodeModel,
  getOpencodeEndpoint,
  getOpencodeRunner,
} from "./settings.ts";
import { sendTaskNotification } from "./notifications.ts";
import { getSessionToken, getCurrentUser } from "./auth.ts";

export interface SearchSource {
  title: string;
  url: string;
  snippet: string;
}

export interface TaskResult {
  summary: string;
  sources: SearchSource[];
  completedAt: number;
  model: string;
  engine?: "nvidia" | "opencode";
  runner?: "cli" | "api" | "fallback";
}

export interface AutoTask {
  id: string;
  userId?: string;
  title: string;
  prompt: string;
  targetTime: number; // Unix timestamp in ms
  recurrence: "once" | "daily";
  engine?: "nvidia" | "opencode";
  model?: string;
  status: "queued" | "researching" | "ready" | "delivered" | "failed";
  createdAt: number;
  updatedAt: number;
  readyAt?: number;
  deliveredAt?: number;
  result?: TaskResult;
  error?: string;
  notifiedReady?: boolean;
  notifiedDelivered?: boolean;
}

const TASKS_STORAGE = "autotask_calendar_tasks";
const DELETED_IDS_STORAGE = "autotask_deleted_ids";

// =============================================
// LOCAL STORAGE LAYER (offline cache)
// =============================================

export function getTasks(): AutoTask[] {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: AutoTask[]): void {
  try {
    localStorage.setItem(TASKS_STORAGE, JSON.stringify(tasks));
  } catch (err) {
    console.error("Failed to save tasks", err);
  }
}

function getDeletedIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_IDS_STORAGE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addDeletedId(id: string): void {
  const ids = getDeletedIds();
  if (!ids.includes(id)) {
    ids.push(id);
    localStorage.setItem(DELETED_IDS_STORAGE, JSON.stringify(ids));
  }
}

function clearDeletedIds(): void {
  localStorage.removeItem(DELETED_IDS_STORAGE);
}

// =============================================
// SERVER SYNC LAYER
// =============================================

function getAuthHeaders(): Record<string, string> {
  const token = getSessionToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Sync local tasks with server.
 * - Sends all local tasks + deletedIds to server
 * - Server merges by updatedAt timestamp
 * - Returns authoritative merged list
 * - Updates localStorage with server response
 */
export async function syncTasksWithServer(): Promise<AutoTask[]> {
  const token = getSessionToken();
  if (!token) return getTasks(); // Not logged in, use local only

  try {
    const localTasks = getTasks();
    const deletedIds = getDeletedIds();

    const res = await fetch("/api/autotask/tasks/sync", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ tasks: localTasks, deletedIds }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.tasks)) {
        saveTasks(data.tasks);
        clearDeletedIds();
        return data.tasks;
      }
    }
  } catch (err) {
    console.debug("[Autotask Sync] Server unreachable, using local cache:", err);
  }

  return getTasks();
}

/**
 * Push a single task update to the server (fire-and-forget with local cache)
 */
async function pushTaskToServer(task: AutoTask): Promise<void> {
  const token = getSessionToken();
  if (!token) return;

  try {
    await fetch("/api/autotask/tasks", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ task }),
    });
  } catch {
    // Server unreachable — local cache is the fallback
  }
}

/**
 * Push a task deletion to the server
 */
async function pushDeleteToServer(taskId: string): Promise<void> {
  const token = getSessionToken();
  if (!token) return;

  try {
    await fetch(`/api/autotask/tasks/${taskId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
  } catch {
    // Track deletion for next sync
    addDeletedId(taskId);
  }
}

// =============================================
// PUBLIC TASK CRUD (synced)
// =============================================

export function addTask(
  prompt: string,
  targetTime: number,
  recurrence: "once" | "daily" = "once",
  customTitle?: string,
  engine: "nvidia" | "opencode" = "nvidia",
  model?: string
): AutoTask {
  const cleanPrompt = prompt.trim();
  const title = customTitle || (cleanPrompt.length > 40 ? cleanPrompt.slice(0, 37) + "..." : cleanPrompt);
  const user = getCurrentUser();

  const newTask: AutoTask = {
    id: "task_" + Math.random().toString(36).slice(2, 10),
    userId: user?.id,
    title,
    prompt: cleanPrompt,
    targetTime,
    recurrence,
    engine,
    model,
    status: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const current = getTasks();
  current.push(newTask);
  saveTasks(current);

  // Async push to server
  void pushTaskToServer(newTask);

  return newTask;
}

export function deleteTask(id: string): void {
  const current = getTasks().filter((t) => t.id !== id);
  saveTasks(current);

  // Async push to server
  void pushDeleteToServer(id);
}

/**
 * Play a pleasant, modern chime using the browser's Web Audio API
 */
function playDeliveryChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 chord arpeggio
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.7);
    });
  } catch (err) {
    console.debug("Chime playback not allowed before user interaction", err);
  }
}

let isRunnerExecuting = false;

/**
 * Autonomous Task Runner
 * - Inspects tasks and executes research in the background immediately
 * - Delivers ready tasks the exact moment their target time is reached
 * - Rolls over daily recurring tasks automatically
 * - Syncs with server periodically for cross-device consistency
 */
export function startBackgroundRunner(onUpdate: (tasks: AutoTask[]) => void): () => void {
  let active = true;
  let syncCounter = 0;

  const tick = async () => {
    if (!active) return;
    let tasks = getTasks();
    let hasChanges = false;
    const now = Date.now();

    // Periodic server sync every ~30 seconds (10 ticks × 3s interval)
    syncCounter++;
    if (syncCounter >= 10) {
      syncCounter = 0;
      try {
        const synced = await syncTasksWithServer();
        if (synced.length > 0 || tasks.length > 0) {
          tasks = synced;
          onUpdate([...tasks]);
        }
      } catch {
        // sync failed, continue with local
      }
    }

    // 1. Check for tasks ready to be delivered
    for (const task of tasks) {
      if (task.status === "ready" && now >= task.targetTime) {
        task.status = "delivered";
        task.deliveredAt = now;
        task.updatedAt = now;
        hasChanges = true;
        playDeliveryChime();

        // Dispatch notification (Capacitor mobile + Web desktop)
        if (!task.notifiedDelivered) {
          void sendTaskNotification(task, "delivered");
          task.notifiedDelivered = true;
        }

        // Push status update to server
        void pushTaskToServer(task);

        // If daily, schedule the next iteration for tomorrow at the same time
        if (task.recurrence === "daily") {
          let nextTarget = task.targetTime + 24 * 60 * 60 * 1000;
          while (nextTarget <= now) {
            nextTarget += 24 * 60 * 60 * 1000;
          }

          const dailyNext: AutoTask = {
            id: "task_" + Math.random().toString(36).slice(2, 10),
            userId: task.userId,
            title: task.title,
            prompt: task.prompt,
            targetTime: nextTarget,
            recurrence: "daily",
            engine: task.engine,
            model: task.model,
            status: "queued",
            createdAt: now,
            updatedAt: now,
          };
          tasks.push(dailyNext);
          void pushTaskToServer(dailyNext);
        }
      }
    }

    // 2. Execute queued tasks in the background
    const queuedTask = tasks.find((t) => t.status === "queued");
    if (queuedTask && !isRunnerExecuting) {
      const taskEngine = queuedTask.engine || "nvidia";

      // If OpenCode is chosen
      if (taskEngine === "opencode") {
        isRunnerExecuting = true;
        queuedTask.status = "researching";
        queuedTask.updatedAt = Date.now();
        saveTasks(tasks);
        onUpdate([...tasks]);
        void pushTaskToServer(queuedTask);

        const opencodeKey = getOpencodeApiKey();
        const opencodeModel = queuedTask.model || getOpencodeModel();
        const opencodeEndpoint = getOpencodeEndpoint();
        let result: TaskResult | null = null;
        let executionError = "";

        try {
          const res = await fetch("/api/autotask/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              engine: "opencode",
              runner: getOpencodeRunner(),
              apiKey: opencodeKey,
              model: opencodeModel,
              endpoint: opencodeEndpoint,
              prompt: queuedTask.prompt,
              searchEnabled: true,
            }),
          });

          const data = await res.json().catch(() => null);

          if (res.ok && data && data.ok) {
            result = {
              summary: data.summary,
              sources: data.sources || [],
              completedAt: data.completedAt || Date.now(),
              model: data.model || opencodeModel,
              engine: "opencode",
              runner: data.runner,
            };
          } else {
            executionError = (data && data.error) || `OpenCode execution failed (HTTP ${res.status})`;
          }
        } catch (serverErr) {
          executionError = serverErr instanceof Error ? serverErr.message : String(serverErr);
        }

        tasks = getTasks();
        const target = tasks.find((t) => t.id === queuedTask.id);
        if (target) {
          if (result) {
            target.status = "ready";
            target.readyAt = Date.now();
            target.updatedAt = Date.now();
            target.result = result;
            target.error = undefined;
            if (!target.notifiedReady) {
              void sendTaskNotification(target, "completed");
              target.notifiedReady = true;
            }
          } else {
            target.status = "failed";
            target.updatedAt = Date.now();
            target.error = executionError || "Failed to execute OpenCode task.";
          }
          hasChanges = true;
          void pushTaskToServer(target);
        }

        isRunnerExecuting = false;
      } else {
        // NVIDIA Execution
        const apiKey = getNvidiaApiKey();
        if (apiKey) {
          isRunnerExecuting = true;
          queuedTask.status = "researching";
          queuedTask.updatedAt = Date.now();
          saveTasks(tasks);
          onUpdate([...tasks]);
          void pushTaskToServer(queuedTask);

          const model = queuedTask.model || getNvidiaModel();
          let result: TaskResult | null = null;
          let executionError = "";

          try {
            const res = await fetch("/api/autotask/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                engine: "nvidia",
                apiKey,
                model,
                prompt: queuedTask.prompt,
                searchEnabled: true,
              }),
            });

            const data = await res.json().catch(() => null);

            if (res.ok && data && data.ok) {
              result = {
                summary: data.summary,
                sources: data.sources || [],
                completedAt: data.completedAt || Date.now(),
                model: data.model || model,
                engine: "nvidia",
              };
              if (data.model && data.model !== model) {
                setNvidiaModel(data.model);
              }
            } else {
              executionError = (data && data.error) || `NVIDIA execution failed (HTTP ${res.status})`;
            }
          } catch (serverErr) {
            executionError = serverErr instanceof Error ? serverErr.message : String(serverErr);
          }

          tasks = getTasks();
          const target = tasks.find((t) => t.id === queuedTask.id);

          if (target) {
            if (result) {
              target.status = "ready";
              target.readyAt = Date.now();
              target.updatedAt = Date.now();
              target.result = result;
              target.error = undefined;
              if (!target.notifiedReady) {
                void sendTaskNotification(target, "completed");
                target.notifiedReady = true;
              }
            } else {
              target.status = "failed";
              target.updatedAt = Date.now();
              target.error = executionError || "Failed to execute task.";
            }
            hasChanges = true;
            void pushTaskToServer(target);
          }

          isRunnerExecuting = false;
        }
      }
    }

    if (hasChanges) {
      saveTasks(tasks);
      onUpdate([...tasks]);
    }
  };

  const intervalId = setInterval(tick, 3000);

  // Do an initial server sync immediately on startup
  void syncTasksWithServer().then((synced) => {
    if (synced.length > 0) {
      onUpdate([...synced]);
    }
    void tick();
  });

  return () => {
    active = false;
    clearInterval(intervalId);
  };
}
