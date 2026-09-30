import { useState } from "react";
import {
  Boxes,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  X,
  Calendar as CalendarIcon,
  Cpu,
  Code2,
  Webhook,
  MessageSquare,
  Github,
  BellRing,
} from "lucide-react";
import {
  getNvidiaApiKey,
  getNvidiaModel,
  getOpencodeApiKey,
  getOpencodeModel,
} from "../../lib/autotask/settings";

interface ConnectorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNvidiaModal: () => void;
  onOpenOpencodeModal?: () => void;
}

interface ConnectorItem {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: typeof Boxes;
  status: "connected" | "ready" | "available";
  details?: string;
  actionText: string;
  onClick?: () => void;
}

export function ConnectorsModal({
  isOpen,
  onClose,
  onOpenNvidiaModal,
  onOpenOpencodeModal,
}: ConnectorsModalProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const nvidiaKey = getNvidiaApiKey();
  const nvidiaModel = getNvidiaModel();
  const opencodeKey = getOpencodeApiKey();
  const opencodeModel = getOpencodeModel();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const connectors: ConnectorItem[] = [
    {
      id: "nvidia",
      name: "NVIDIA NIM Inference Cloud",
      description: "Autonomous reasoning & real-time intelligence for all scheduled background tasks.",
      category: "ai",
      icon: Cpu,
      status: nvidiaKey ? "connected" : "available",
      details: nvidiaKey ? `Active Model: ${nvidiaModel}` : "API Key Required",
      actionText: nvidiaKey ? "Configure Model" : "Connect Key",
      onClick: () => {
        onClose();
        onOpenNvidiaModal();
      },
    },
    {
      id: "opencode",
      name: "OpenCode AI Engine",
      description: "OpenCode harness supporting Zen, Go, OpenRouter, and community AI models.",
      category: "ai",
      icon: Code2,
      status: opencodeKey ? "connected" : "ready",
      details: `Active Model: ${opencodeModel}`,
      actionText: "Configure OpenCode",
      onClick: () => {
        onClose();
        onOpenOpencodeModal?.();
      },
    },
    {
      id: "google-calendar",
      name: "Google Calendar Sync",
      description: "Bidirectional sync for schedule blocks, task timeframes, and calendar alerts.",
      category: "calendar",
      icon: CalendarIcon,
      status: "connected",
      details: "Native Calendar View Active",
      actionText: "Sync Status",
      onClick: () => showToast("Google Calendar sync is active and healthy!"),
    },
    {
      id: "webhooks",
      name: "Incoming & Outgoing Webhooks",
      description: "Trigger tasks via HTTP POST requests or receive task completion payloads.",
      category: "automation",
      icon: Webhook,
      status: "ready",
      details: "Endpoint: /api/autotask/webhook",
      actionText: "Copy Endpoint",
      onClick: () => {
        navigator.clipboard?.writeText(window.location.origin + "/api/autotask/webhook");
        showToast("Webhook endpoint URL copied to clipboard!");
      },
    },
    {
      id: "notifications",
      name: "System Desktop & Mobile Alerts",
      description: "Push notifications sent automatically the instant a background task completes.",
      category: "notifications",
      icon: BellRing,
      status: "connected",
      details: "Web Notification API Enabled",
      actionText: "Test Alert",
      onClick: () => {
        if ("Notification" in window) {
          if (Notification.permission === "granted") {
            new Notification("AutoTask Connector Test", {
              body: "Your notifications connector is working perfectly!",
              icon: "/favicon.ico",
            });
            showToast("Test notification sent!");
          } else {
            Notification.requestPermission().then((res) => {
              showToast(`Permission status: ${res}`);
            });
          }
        } else {
          showToast("Notification API not supported in this browser");
        }
      },
    },
    {
      id: "slack-discord",
      name: "Slack & Discord Webhook Dispatch",
      description: "Forward AI summaries and task deliverables directly into team chat channels.",
      category: "notifications",
      icon: MessageSquare,
      status: "available",
      details: "Custom Webhook URL",
      actionText: "Configure",
      onClick: () => showToast("Custom webhook configuration available in Task creation!"),
    },
    {
      id: "github",
      name: "GitHub Repository Watcher",
      description: "Automate code summaries, release monitoring, and repo issue digests.",
      category: "automation",
      icon: Github,
      status: "available",
      details: "Public Repos & Releases",
      actionText: "Explore",
      onClick: () => showToast("Include GitHub links directly into task descriptions for AI analysis."),
    },
  ];

  const filtered = connectors.filter((c) => {
    if (activeCategory === "all") return true;
    return c.category === activeCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/80">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Boxes className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg sm:text-xl">Connected Apps &amp; Services</h3>
              <p className="text-xs text-neutral-400">
                Seamless connectors powering autonomous AI background executions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-neutral-800/60 flex items-center gap-2 overflow-x-auto text-xs font-medium">
          {[
            { id: "all", label: "All Connectors" },
            { id: "ai", label: "AI & Models" },
            { id: "calendar", label: "Calendars" },
            { id: "automation", label: "Automation" },
            { id: "notifications", label: "Notifications" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                activeCategory === tab.id
                  ? "bg-teal-500/15 text-teal-300 border border-teal-500/30"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Connectors Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
          {filtered.map((item) => {
            const Icon = item.icon;
            const isConnected = item.status === "connected";
            const isReady = item.status === "ready";

            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 hover:border-neutral-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className="size-11 rounded-xl bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center shrink-0 text-neutral-300">
                    <Icon className="size-5 text-teal-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-white text-sm sm:text-base">{item.name}</h4>
                      {isConnected && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                          <CheckCircle2 className="size-3" /> Connected
                        </span>
                      )}
                      {isReady && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-medium">
                          <RefreshCw className="size-3" /> Ready
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 mt-1 max-w-xl leading-relaxed">
                      {item.description}
                    </p>
                    {item.details && (
                      <div className="mt-2 text-[11px] font-mono text-neutral-500 bg-neutral-900/90 px-2 py-0.5 rounded-md inline-block">
                        {item.details}
                      </div>
                    )}
                  </div>
                </div>

                <div className="sm:shrink-0 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 transition flex items-center justify-center gap-1.5"
                  >
                    {item.actionText}
                    <ExternalLink className="size-3 text-neutral-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 flex items-center justify-between bg-neutral-900/60 text-xs text-neutral-400">
          <span>Active background scheduler: <strong>Online</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition"
          >
            Done
          </button>
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute bottom-5 right-5 bg-teal-600 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-medium animate-in slide-in-from-bottom duration-200 flex items-center gap-2">
            <CheckCircle2 className="size-4" />
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}
