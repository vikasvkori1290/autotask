import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { AutoTask } from "./scheduler";

let isInitialized = false;

/**
 * Request notification permissions and register action handlers
 */
export async function initNotifications(onTaskSelected?: (taskId: string) => void): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    if (Capacitor.isNativePlatform()) {
      // 1. Mobile (Android/iOS via Capacitor)
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const requested = await LocalNotifications.requestPermissions();
        if (requested.display !== "granted") {
          console.warn("[Notifications] Native notification permission not granted");
        }
      }

      if (!isInitialized) {
        // Register listener for when user taps the notification on mobile
        LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
          const taskId = action.notification?.extra?.taskId;
          if (taskId) {
            window.location.hash = `task=${taskId}`;
            if (onTaskSelected) onTaskSelected(taskId);
          }
        });
        isInitialized = true;
      }
      return true;
    } else {
      // 2. Desktop Web browser
      if ("Notification" in window) {
        if (Notification.permission === "default") {
          await Notification.requestPermission();
        }
        return Notification.permission === "granted";
      }
    }
  } catch (err) {
    console.error("[Notifications] Init failed:", err);
  }

  return false;
}

/**
 * Dispatches a native or web notification when a task completes research or is delivered
 */
export async function sendTaskNotification(
  task: AutoTask,
  event: "completed" | "delivered"
): Promise<void> {
  const engineLabel = task.engine === "opencode" ? "OpenCode AI" : "NVIDIA NIM";
  const title =
    event === "completed"
      ? `Task Ready [${engineLabel}]: ${task.title}`
      : `AutoTask Delivered: ${task.title}`;

  const targetTimeStr = new Date(task.targetTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const body =
    event === "completed"
      ? `Briefing & research are ready! Scheduled for ${targetTimeStr}. Tap to review full response.`
      : `Your scheduled task for ${targetTimeStr} is ready. Tap to read the full briefing response.`;

  try {
    if (Capacitor.isNativePlatform()) {
      // Native Capacitor Local Notification on Android/iOS
      const notifId = Math.floor(Math.random() * 2147483647);
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title,
            body,
            largeIcon: "res://drawable/ic_launcher",
            smallIcon: "res://drawable/ic_launcher",
            extra: {
              taskId: task.id,
            },
          },
        ],
      });
    } else if ("Notification" in window && Notification.permission === "granted") {
      // Web Desktop Notification
      const notif = new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: `task-${task.id}-${event}`,
      });

      notif.onclick = () => {
        window.focus();
        window.location.hash = `task=${task.id}`;
      };
    }
  } catch (err) {
    console.error("[Notifications] Failed to send notification:", err);
  }
}
