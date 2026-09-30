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
      color: "bg-amber-50 text-amber-700 border-amber-200",
      icon: <Clock className="size-3.5 text-amber-600" />,
    },
    researching: {
      label: "Autonomous research in progress...",
      color: "bg-blue-50 text-blue-700 border-blue-200",
      icon: <Loader2 className="size-3.5 animate-spin text-blue-600" />,
    },
    ready: {
      label: "Ready (Pre-calculated for delivery time)",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: <CheckCircle2 className="size-3.5 text-emerald-600" />,
    },
    delivered: {
      label: "Delivered & Completed",
      color: "bg-purple-50 text-purple-700 border-purple-200",
      icon: <Sparkles className="size-3.5 text-purple-600" />,
    },
    failed: {
      label: "Execution Failed",
      color: "bg-rose-50 text-rose-700 border-rose-200",
      icon: <AlertCircle className="size-3.5 text-rose-600" />,
    },
  }[task.status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[88vh] flex flex-col bg-white border border-slate-200 rounded-3xl shadow-2xl text-slate-900 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConfig.color}`}>
                {statusConfig.icon}
                {statusConfig.label}
              </span>
              {task.recurrence === "daily" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Repeat className="size-3" />
                  Daily at {timeFormatted}
                </span>
              )}
            </div>

            <h2 className="text-lg font-bold text-slate-900 leading-tight break-words pt-1">{task.prompt}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-slate-400" />
                <span>Target: {dateFormatted} at {timeFormatted}</span>
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                (task.engine || task.result?.engine) === "opencode"
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}>
                {(task.engine || task.result?.engine) === "opencode" ? "OpenCode AI" : "NVIDIA NIM"}
              </span>
              {task.result?.runner && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  {task.result.runner === "cli" ? "Local CLI" : task.result.runner === "api" ? "Cloud API" : "Fallback"}
                </span>
              )}
              {(task.result?.model || task.model) && (
                <span className="text-slate-400 font-mono text-[11px]">• {task.result?.model || task.model}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => { onDelete(task.id); onClose(); }}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
              title="Delete task"
            >
              <Trash2 className="size-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {task.status === "researching" && (
            <div className="p-8 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
              <Loader2 className="size-8 text-indigo-600 animate-spin" />
              <div className="text-sm font-bold text-slate-900">Synthesizing live web intelligence...</div>
              <p className="text-xs text-slate-500 max-w-sm">
                Researching real-time sources and composing your briefing. It will be pre-calculated and waiting for your scheduled time.
              </p>
            </div>
          )}

          {task.status === "failed" && (
            <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs space-y-3">
              <div className="font-bold flex items-center gap-2 text-sm text-rose-900">
                <AlertCircle className="size-4 text-rose-600" />
                Execution could not complete
              </div>
              <p className="leading-relaxed bg-white/80 p-3 rounded-xl font-mono text-[11px] text-rose-800 border border-rose-200">{task.error || "Could not complete task."}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 transition shadow-sm"
              >
                <RotateCcw className="size-3.5" />
                <span>Retry Task Now</span>
              </button>
            </div>
          )}

          {task.result?.summary && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Briefing Report</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 py-1 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition"
                >
                  {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5 text-slate-500" />}
                  <span>{copied ? "Copied" : "Copy Report"}</span>
                </button>
              </div>

              {/* Markdown Render */}
              <div className="p-5 sm:p-6 rounded-2xl bg-slate-50/70 border border-slate-200 text-sm leading-relaxed text-slate-800 prose prose-slate max-w-none prose-headings:text-slate-900 prose-headings:font-bold prose-a:text-indigo-600">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {task.result.summary}
                </ReactMarkdown>
              </div>

              {/* Citations & Sources */}
              {task.result.sources && task.result.sources.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Sources Referenced</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {task.result.sources.map((src, idx) => (
                      <a
                        key={idx}
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 rounded-xl bg-white hover:bg-indigo-50/40 border border-slate-200 hover:border-indigo-200 transition group flex flex-col justify-between shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 truncate">
                            {src.title}
                          </span>
                          <ExternalLink className="size-3 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{src.snippet}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>Autonomous briefing prepared on time</div>
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
