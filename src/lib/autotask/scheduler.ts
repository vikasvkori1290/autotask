import {
  getNvidiaApiKey,
  getNvidiaModel,
  setNvidiaModel,
  getOpencodeApiKey,
  getOpencodeModel,
  getOpencodeEndpoint,
  getOpencodeRunner,
  syncSettingsFromServer,
} from "./settings.ts";
import { sendTaskNotification, scheduleDeliveryNotification } from "./notifications.ts";
import { getSessionToken, getCurrentUser } from "./auth.ts";
import { autotaskFetch } from "./api.ts";

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
  retryCount?: number;
  nextRetryAt?: number;
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

    const res = await autotaskFetch("/api/autotask/tasks/sync", {
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
 * Push a single task update to the server (with local cache and authoritative sync return)
 */
async function pushTaskToServer(task: AutoTask): Promise<AutoTask | null> {
  const token = getSessionToken();
  if (!token) return null;

  try {
    const res = await autotaskFetch("/api/autotask/tasks", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ task }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.ok && data.task) {
        return data.task as AutoTask;
      }
    }
  } catch {
    // Server unreachable — local cache is the fallback
  }
  return null;
}

/**
 * Push a task deletion to the server
 */
async function pushDeleteToServer(taskId: string): Promise<void> {
  const token = getSessionToken();
  if (!token) return;

  try {
    await autotaskFetch(`/api/autotask/tasks/${taskId}`, {
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

  // Pre-schedule native alarm notification for delivery time (mobile Android background)
  void scheduleDeliveryNotification(newTask);

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

  // Immediate initial sync with MongoDB
  void syncTasksWithServer().then((synced) => {
    if (synced && synced.length > 0) {
      onUpdate([...synced]);
    }
  });

  const tick = async () => {
    if (!active) return;
    let tasks = getTasks();
    let hasChanges = false;
    const now = Date.now();

    // Fast server sync every ~9 seconds (3 ticks × 3s interval) to keep all devices in instant sync
    syncCounter++;
    if (syncCounter >= 3) {
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

    // 2. Execute queued tasks in the background (single-device claim & conflict-free)
    // IMPORTANT: Research ONLY starts 30 minutes before the scheduled delivery time,
    // OR immediately if the delivery time has already arrived or passed (late internet reconnection).
    const LEAD_TIME_MS = 30 * 60 * 1000; // 30 minutes
    const queuedTask = tasks.find((t) => {
      if (t.status === "queued") {
        if (t.nextRetryAt && t.nextRetryAt > now) {
          return false;
        }
        return now >= (t.targetTime - LEAD_TIME_MS);
      }
      return false;
    });

    // Auto-restart any failed tasks if ready for retry and within the 30-minute window
    if (!queuedTask && !isRunnerExecuting) {
      const failedTask = tasks.find(
        (t) => t.status === "failed" && (!t.nextRetryAt || t.nextRetryAt <= now) && (now >= t.targetTime - LEAD_TIME_MS)
      );
      if (failedTask) {
        failedTask.status = "queued";
        failedTask.nextRetryAt = Date.now() + 1000;
        hasChanges = true;
      }
    }

    if (queuedTask && !isRunnerExecuting) {
      const taskEngine = queuedTask.engine || "nvidia";

      // Mark locally as researching so this client doesn't pick it up again
      isRunnerExecuting = true;
      queuedTask.status = "researching";
      queuedTask.updatedAt = Date.now();
      saveTasks(tasks);
      onUpdate([...tasks]);

      // Claim on server: Check if another device already finished or claimed this task!
      const serverClaim = await pushTaskToServer(queuedTask);
      if (serverClaim && (serverClaim.status === "ready" || serverClaim.status === "delivered") && serverClaim.result) {
        // Another device (mobile or desktop) already completed this task!
        tasks = getTasks();
        const existingIdx = tasks.findIndex((t) => t.id === queuedTask.id);
        if (existingIdx >= 0) {
          tasks[existingIdx] = serverClaim;
          saveTasks(tasks);
          onUpdate([...tasks]);
        }
        isRunnerExecuting = false;
        return;
      }

      if (serverClaim && serverClaim.status === "researching" && serverClaim.updatedAt && Date.now() - serverClaim.updatedAt < 90000 && serverClaim.updatedAt !== queuedTask.updatedAt) {
        // Another device is already actively researching this task right now!
        // Back off and let the other device finish, then sync the result from MongoDB.
        tasks = getTasks();
        const existingIdx = tasks.findIndex((t) => t.id === queuedTask.id);
        if (existingIdx >= 0) {
          tasks[existingIdx] = serverClaim;
          saveTasks(tasks);
          onUpdate([...tasks]);
        }
        isRunnerExecuting = false;
        return;
      }

      // If OpenCode is chosen
      if (taskEngine === "opencode") {
        const opencodeKey = getOpencodeApiKey();
        const opencodeModel = queuedTask.model || getOpencodeModel();
        const opencodeEndpoint = getOpencodeEndpoint();
        let result: TaskResult | null = null;
        let executionError = "";

        try {
          const res = await autotaskFetch("/api/autotask/execute", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              taskId: queuedTask.id,
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
          // If another device already delivered a result while we were running, keep existing ready state
          if ((target.status === "ready" || target.status === "delivered") && target.result) {
            isRunnerExecuting = false;
            return;
          }

          if (result) {
            const isLateOrDue = Date.now() >= target.targetTime;
            target.status = isLateOrDue ? "delivered" : "ready";
            target.readyAt = Date.now();
            if (isLateOrDue) {
              target.deliveredAt = Date.now();
            }
            target.updatedAt = Date.now();
            target.result = result;
            target.error = undefined;
            target.retryCount = 0;
            target.nextRetryAt = undefined;

            if (isLateOrDue) {
              playDeliveryChime();
              if (!target.notifiedDelivered) {
                void sendTaskNotification(target, "delivered");
                target.notifiedDelivered = true;
              }
              if (target.recurrence === "daily") {
                let nextTarget = target.targetTime + 24 * 60 * 60 * 1000;
                while (nextTarget <= Date.now()) {
                  nextTarget += 24 * 60 * 60 * 1000;
                }
                const dailyNext: AutoTask = {
                  id: "task_" + Math.random().toString(36).slice(2, 10),
                  userId: target.userId,
                  title: target.title,
                  prompt: target.prompt,
                  targetTime: nextTarget,
                  recurrence: "daily",
                  engine: target.engine,
                  model: target.model,
                  status: "queued",
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                tasks.push(dailyNext);
                void pushTaskToServer(dailyNext);
                void scheduleDeliveryNotification(dailyNext);
              }
            } else if (!target.notifiedReady) {
              void sendTaskNotification(target, "completed");
              target.notifiedReady = true;
            }
          } else {
            // Auto-restart on failure with backoff (e.g. offline / internet down)
            const retries = (target.retryCount || 0) + 1;
            target.retryCount = retries;
            target.updatedAt = Date.now();
            const backoffMs = Math.min(30000, 3000 * Math.pow(1.5, Math.min(retries - 1, 4)));
            target.nextRetryAt = Date.now() + backoffMs;
            target.error = `${executionError || "Network offline. AutoTask will research once internet is available."} (Auto-retry #${retries})`;
            target.status = "queued"; // Stays queued, will retry autonomously
          }
          hasChanges = true;
          void pushTaskToServer(target);
        }

        isRunnerExecuting = false;
      } else {
        // NVIDIA Execution
        let apiKey = getNvidiaApiKey();
        if (!apiKey) {
          const synced = await syncSettingsFromServer();
          if (synced?.nvidiaApiKey) {
            apiKey = synced.nvidiaApiKey;
          }
        }

        if (apiKey) {
          const model = queuedTask.model || getNvidiaModel();
          let result: TaskResult | null = null;
          let executionError = "";

          try {
            const res = await autotaskFetch("/api/autotask/execute", {
              method: "POST",
              headers: getAuthHeaders(),
              body: JSON.stringify({
                taskId: queuedTask.id,
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
            // If another device already delivered a result while we were running, keep existing ready state
            if ((target.status === "ready" || target.status === "delivered") && target.result) {
              isRunnerExecuting = false;
              return;
            }

            if (result) {
              const isLateOrDue = Date.now() >= target.targetTime;
              target.status = isLateOrDue ? "delivered" : "ready";
              target.readyAt = Date.now();
              if (isLateOrDue) {
                target.deliveredAt = Date.now();
              }
              target.updatedAt = Date.now();
              target.result = result;
              target.error = undefined;
              target.retryCount = 0;
              target.nextRetryAt = undefined;

              if (isLateOrDue) {
                playDeliveryChime();
                if (!target.notifiedDelivered) {
                  void sendTaskNotification(target, "delivered");
                  target.notifiedDelivered = true;
                }
                if (target.recurrence === "daily") {
                  let nextTarget = target.targetTime + 24 * 60 * 60 * 1000;
                  while (nextTarget <= Date.now()) {
                    nextTarget += 24 * 60 * 60 * 1000;
                  }
                  const dailyNext: AutoTask = {
                    id: "task_" + Math.random().toString(36).slice(2, 10),
                    userId: target.userId,
                    title: target.title,
                    prompt: target.prompt,
                    targetTime: nextTarget,
                    recurrence: "daily",
                    engine: target.engine,
                    model: target.model,
                    status: "queued",
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  };
                  tasks.push(dailyNext);
                  void pushTaskToServer(dailyNext);
                  void scheduleDeliveryNotification(dailyNext);
                }
              } else if (!target.notifiedReady) {
                void sendTaskNotification(target, "completed");
                target.notifiedReady = true;
              }
            } else {
              // Auto-restart on failure with backoff (e.g. offline / internet down)
              const retries = (target.retryCount || 0) + 1;
              target.retryCount = retries;
              target.updatedAt = Date.now();
              const backoffMs = Math.min(30000, 3000 * Math.pow(1.5, Math.min(retries - 1, 4)));
              target.nextRetryAt = Date.now() + backoffMs;
              target.error = `${executionError || "Network offline. AutoTask will research once internet is available."} (Auto-retry #${retries})`;
              target.status = "queued"; // Stays queued, will retry autonomously
            }
            hasChanges = true;
            void pushTaskToServer(target);
          }

          isRunnerExecuting = false;
        } else {
          // No API key configured yet
          tasks = getTasks();
          const target = tasks.find((t) => t.id === queuedTask.id);
          if (target) {
            target.status = "queued";
            target.nextRetryAt = Date.now() + 10000;
            target.error = "NVIDIA API key required. Waiting for key configuration...";
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
