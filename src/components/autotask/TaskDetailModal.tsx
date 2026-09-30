import { useState } from "react";
import { X, Clock, Repeat, CheckCircle2, Loader2, Copy, Check, Trash2, ExternalLink, Sparkles, AlertCircle, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { saveTasks, getTasks, type AutoTask } from "../../lib/autotask/scheduler";

interface TaskDetailModalProps {
  task: AutoTask | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function TaskDetailModal({ task, onClose, onDelete }: TaskDetailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!task) return null;

  const targetDate = new Date(task.targetTime);
  const timeFormatted = targetDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateFormatted = targetDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  const handleCopy = () => {
    if (!task.result?.summary) return;
    navigator.clipboard.writeText(task.result.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = () => {
    const all = getTasks();
    const t = all.find((x) => x.id === task.id);
    if (t) {
      t.status = "queued";
      t.error = undefined;
      saveTasks(all);
      task.status = "queued";
      task.error = undefined;
    }
  };

  const statusConfig = {
    queued: {
      label: "Queued for research",
      color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      icon: <Clock className="size-3.5" />,
    },
    researching: {
      label: "Autonomous research in progress...",
      color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      icon: <Loader2 className="size-3.5 animate-spin" />,
    },
    ready: {
      label: "Ready (Pre-calculated for delivery time)",
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      icon: <CheckCircle2 className="size-3.5" />,
    },
    delivered: {
      label: "Delivered & Completed",
      color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      icon: <Sparkles className="size-3.5" />,
    },
    failed: {
      label: "Execution Failed",
      color: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      icon: <AlertCircle className="size-3.5" />,
    },
  }[task.status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl max-h-[88vh] flex flex-col bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl text-neutral-100 overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-neutral-800/80 bg-neutral-900/50 flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConfig.color}`}>
                {statusConfig.icon}
                {statusConfig.label}
              </span>
              {task.recurrence === "daily" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-neutral-800 text-emerald-300 border border-neutral-700">
                  <Repeat className="size-3" />
                  Daily at {timeFormatted}
                </span>
              )}
            </div>

            <h2 className="text-lg font-bold text-white leading-tight break-words pt-1">{task.prompt}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-neutral-500" />
                <span>Target: {dateFormatted} at {timeFormatted}</span>
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                (task.engine || task.result?.engine) === "opencode"
                  ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                  : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
              }`}>
                {(task.engine || task.result?.engine) === "opencode" ? "OpenCode AI" : "NVIDIA NIM"}
              </span>
              {task.result?.runner && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700">
                  {task.result.runner === "cli" ? "Local CLI" : task.result.runner === "api" ? "Cloud API" : "Fallback"}
                </span>
              )}
              {(task.result?.model || task.model) && (
                <span className="text-neutral-500 font-mono text-[11px]">• {task.result?.model || task.model}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => { onDelete(task.id); onClose(); }}
              className="p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition"
              title="Delete task"
            >
              <Trash2 className="size-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              title="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {task.status === "researching" && (
            <div className="p-8 flex flex-col items-center justify-center text-center space-y-3 bg-neutral-950/40 rounded-2xl border border-neutral-800">
              <Loader2 className="size-8 text-emerald-400 animate-spin" />
              <div className="text-sm font-semibold text-white">Synthesizing live web intelligence...</div>
              <p className="text-xs text-neutral-400 max-w-sm">
                NVIDIA NIM is searching the web for today's developments and composing your briefing. It will be pre-calculated and waiting for you.
              </p>
            </div>
          )}

          {task.status === "failed" && (
            <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-xs space-y-3">
              <div className="font-semibold flex items-center gap-2 text-sm text-rose-200">
                <AlertCircle className="size-4 text-rose-400" />
                Execution could not complete
              </div>
              <p className="leading-relaxed bg-black/20 p-3 rounded-xl font-mono text-[11px] text-rose-300/90">{task.error || "Could not complete task."}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-2 transition shadow-md shadow-emerald-500/20"
              >
                <RotateCcw className="size-3.5" />
                <span>Retry Task Now</span>
              </button>
            </div>
          )}

          {task.result?.summary && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Briefing Report</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 py-1 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 transition"
                >
                  {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  <span>{copied ? "Copied" : "Copy Report"}</span>
                </button>
              </div>

              {/* Markdown Render */}
              <div className="p-5 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 text-sm leading-relaxed text-neutral-200 prose prose-invert max-w-none prose-headings:text-white prose-a:text-emerald-400">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {task.result.summary}
                </ReactMarkdown>
              </div>

              {/* Citations & Sources */}
              {task.result.sources && task.result.sources.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">Sources Referenced</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {task.result.sources.map((src, idx) => (
                      <a
                        key={idx}
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 rounded-xl bg-neutral-950/40 hover:bg-neutral-800/50 border border-neutral-800/60 transition group flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold text-neutral-200 group-hover:text-emerald-400 truncate">
                            {src.title}
                          </span>
                          <ExternalLink className="size-3 text-neutral-500 group-hover:text-emerald-400 shrink-0" />
                        </div>
                        <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">{src.snippet}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-neutral-950/60 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-500">
          <div>Scheduled with AutoTask &amp; NVIDIA NIM</div>
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
