import { getNvidiaApiKey, getNvidiaModel } from "./settings.ts";

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
}

export interface AutoTask {
  id: string;
  title: string;
  prompt: string;
  targetTime: number; // Unix timestamp in ms
  recurrence: "once" | "daily";
  status: "queued" | "researching" | "ready" | "delivered" | "failed";
  createdAt: number;
  readyAt?: number;
  deliveredAt?: number;
  result?: TaskResult;
  error?: string;
}

const TASKS_STORAGE = "autotask_calendar_tasks";

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

export function addTask(
  prompt: string,
  targetTime: number,
  recurrence: "once" | "daily" = "once",
  customTitle?: string
): AutoTask {
  const cleanPrompt = prompt.trim();
  const title = customTitle || (cleanPrompt.length > 40 ? cleanPrompt.slice(0, 37) + "..." : cleanPrompt);

  const newTask: AutoTask = {
    id: "task_" + Math.random().toString(36).slice(2, 10),
    title,
    prompt: cleanPrompt,
    targetTime,
    recurrence,
    status: "queued",
    createdAt: Date.now(),
  };

  const current = getTasks();
  current.push(newTask);
  saveTasks(current);
  return newTask;
}

export function deleteTask(id: string): void {
  const current = getTasks().filter((t) => t.id !== id);
  saveTasks(current);
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
 */
export function startBackgroundRunner(onUpdate: (tasks: AutoTask[]) => void): () => void {
  let active = true;

  const tick = async () => {
    if (!active) return;
    let tasks = getTasks();
    let hasChanges = false;
    const now = Date.now();

    // 1. Check for tasks ready to be delivered
    for (const task of tasks) {
      if (task.status === "ready" && now >= task.targetTime) {
        task.status = "delivered";
        task.deliveredAt = now;
        hasChanges = true;
        playDeliveryChime();

        // Browser desktop notification if permitted
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(`AutoTask Delivered: ${task.title}`, {
            body: `Your scheduled task for ${new Date(task.targetTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} is ready to review.`,
            icon: "/favicon.ico",
          });
        }

        // If daily, schedule the next iteration for tomorrow at the same time
        if (task.recurrence === "daily") {
          let nextTarget = task.targetTime + 24 * 60 * 60 * 1000;
          while (nextTarget <= now) {
            nextTarget += 24 * 60 * 60 * 1000;
          }

          const dailyNext: AutoTask = {
            id: "task_" + Math.random().toString(36).slice(2, 10),
            title: task.title,
            prompt: task.prompt,
            targetTime: nextTarget,
            recurrence: "daily",
            status: "queued",
            createdAt: now,
          };
          tasks.push(dailyNext);
        }
      }
    }

    // 2. Execute queued tasks in the background
    const queuedTask = tasks.find((t) => t.status === "queued");
    if (queuedTask && !isRunnerExecuting) {
      const apiKey = getNvidiaApiKey();
      if (apiKey) {
        isRunnerExecuting = true;
        queuedTask.status = "researching";
        saveTasks(tasks);
        onUpdate([...tasks]);

        const model = getNvidiaModel();
        let result: TaskResult | null = null;
        let executionError = "";

        // Execute via backend proxy (which handles DuckDuckGo search + NVIDIA NIM API with no CORS restrictions)
        try {
          const res = await fetch("/api/autotask/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
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
            };
          } else {
            executionError = (data && data.error) || `Execution failed (HTTP ${res.status})`;
          }
        } catch (serverErr) {
          executionError = serverErr instanceof Error ? serverErr.message : String(serverErr);
        }

        // Reload fresh tasks from storage and save final state
        tasks = getTasks();
        const target = tasks.find((t) => t.id === queuedTask.id);

        if (target) {
          if (result) {
            target.status = "ready";
            target.readyAt = Date.now();
            target.result = result;
            target.error = undefined;
          } else {
            target.status = "failed";
            target.error = executionError || "Failed to execute task.";
          }
          hasChanges = true;
        }

        isRunnerExecuting = false;
      }
    }

    if (hasChanges) {
      saveTasks(tasks);
      onUpdate([...tasks]);
    }
  };

  const intervalId = setInterval(tick, 3000);
  void tick();

  return () => {
    active = false;
    clearInterval(intervalId);
  };
}
