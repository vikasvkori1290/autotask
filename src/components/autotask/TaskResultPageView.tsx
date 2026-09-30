import { useState } from "react";
import {
  ArrowLeft,
  Clock,
  Repeat,
  CheckCircle2,
  Loader2,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Sparkles,
  AlertCircle,
  RotateCcw,
  Share2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { saveTasks, getTasks, type AutoTask } from "../../lib/autotask/scheduler";

interface TaskResultPageViewProps {
  task: AutoTask;
  onBack: () => void;
  onDelete: (id: string) => void;
}

export function TaskResultPageView({ task, onBack, onDelete }: TaskResultPageViewProps) {
  const [copied, setCopied] = useState(false);

  const targetDate = new Date(task.targetTime);
  const timeFormatted = targetDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateFormatted = targetDate.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const handleCopy = () => {
    if (!task.result?.summary) return;
    void navigator.clipboard.writeText(task.result.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.share && task.result?.summary) {
      navigator
        .share({
          title: task.title,
          text: task.result.summary,
        })
        .catch(() => {});
    } else {
      handleCopy();
    }
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
      color: "bg-amber-50 text-amber-800 border-amber-200",
      icon: <Clock className="size-4 text-amber-600" />,
    },
    researching: {
      label: "Autonomous research in progress...",
      color: "bg-blue-50 text-blue-800 border-blue-200",
      icon: <Loader2 className="size-4 animate-spin text-blue-600" />,
    },
    ready: {
      label: "Response Ready (Scheduled for delivery)",
      color: "bg-indigo-50 text-indigo-800 border-indigo-200",
      icon: <Sparkles className="size-4 text-indigo-600" />,
    },
    delivered: {
      label: "Delivered & Completed",
      color: "bg-emerald-50 text-emerald-800 border-emerald-200",
      icon: <CheckCircle2 className="size-4 text-emerald-600" />,
    },
    failed: {
      label: "Execution Failed",
      color: "bg-rose-50 text-rose-800 border-rose-200",
      icon: <AlertCircle className="size-4 text-rose-600" />,
    },
  }[task.status];

  return (
    <div className="h-full min-h-screen w-full flex flex-col bg-slate-50 text-slate-900 font-sans select-text relative overflow-y-auto overscroll-y-contain autotask-scrollbar">
      {/* Ambient background decoration */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[300px] bg-indigo-500/[0.04] blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[300px] bg-emerald-500/[0.04] blur-[120px] rounded-full pointer-events-none" />

      {/* TOP STICKY BAR */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 autotask-glass px-4 sm:px-8 py-3 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition active:scale-95 shrink-0"
          >
            <ArrowLeft className="size-4 text-slate-500" />
            <span>Back</span>
          </button>

          <div className="h-5 w-[1px] bg-slate-200 hidden sm:block shrink-0" />

          <div className="truncate text-xs sm:text-sm font-semibold text-slate-600 hidden sm:block">
            Briefing Result / <span className="text-slate-900 font-bold">{task.title}</span>
          </div>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {task.result?.summary && (
            <>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition active:scale-95"
                title="Copy full markdown report"
              >
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5 text-slate-500" />}
                <span className="hidden sm:inline">{copied ? "Copied" : "Copy Report"}</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition active:scale-95 flex items-center gap-1.5"
                title="Share briefing"
              >
                <Share2 className="size-3.5 text-slate-500" />
                <span className="hidden sm:inline">Share</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-transparent hover:border-rose-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition active:scale-95 flex items-center gap-1.5 text-xs font-medium"
            title="Delete task"
          >
            <Trash2 className="size-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </header>

      {/* PAGE BODY */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3 sm:px-8 py-4 sm:py-8 pb-32 sm:pb-16 space-y-4 sm:space-y-6">
        {/* HERO TITLE & METADATA CARD */}
        <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xs space-y-3 sm:space-y-4">
          {/* Status Badges row */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold border ${statusConfig.color}`}
            >
              {statusConfig.icon}
              {statusConfig.label}
            </span>

            {task.recurrence === "daily" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Repeat className="size-3" />
                Daily at {timeFormatted}
              </span>
            )}

            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[11px] sm:text-xs font-semibold border ${
                (task.engine || task.result?.engine) === "opencode"
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              {(task.engine || task.result?.engine) === "opencode" ? "OpenCode AI" : "NVIDIA NIM"}
            </span>

            {task.result?.runner && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                {task.result.runner === "cli"
                  ? "Local CLI"
                  : task.result.runner === "api"
                  ? "Cloud API"
                  : "Fallback"}
              </span>
            )}

            {(task.result?.model || task.model) && (
              <span className="text-slate-400 font-mono text-[11px] truncate max-w-[200px]">
                • {task.result?.model || task.model}
              </span>
            )}
          </div>

          {/* Prompt Headline */}
          <h1 className="text-base sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug break-words">
            {task.prompt}
          </h1>

          {/* Time & Delivery details */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-slate-400" />
              <span>
                Target: <strong className="text-slate-700">{dateFormatted} at {timeFormatted}</strong>
              </span>
            </div>
            {task.deliveredAt && (
              <div>
                Delivered:{" "}
                <strong className="text-slate-700">
                  {new Date(task.deliveredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </strong>
              </div>
            )}
          </div>
        </div>

        {/* LOADING STATE */}
        {task.status === "researching" && (
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-6 sm:p-10 flex flex-col items-center justify-center text-center space-y-3 sm:space-y-4 shadow-xs">
            <div className="size-12 sm:size-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Loader2 className="size-6 sm:size-7 animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">Synthesizing live web intelligence...</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Researching real-time sources across the web and generating your customized autonomous briefing report.
              </p>
            </div>
          </div>
        )}

        {/* FAILED STATE */}
        {task.status === "failed" && (
          <div className="bg-white border border-rose-200 rounded-2xl sm:rounded-3xl p-4 sm:p-8 space-y-3 sm:space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-rose-900 font-bold text-sm sm:text-base">
              <AlertCircle className="size-4 sm:size-5 text-rose-600" />
              <span>Task execution could not complete</span>
            </div>
            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-rose-50 border border-rose-200 font-mono text-xs text-rose-900 leading-relaxed break-words">
              {task.error || "An unknown error occurred during execution."}
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 transition shadow-sm active:scale-95"
            >
              <RotateCcw className="size-3.5" />
              <span>Retry Task Execution</span>
            </button>
          </div>
        )}

        {/* MAIN BRIEFING REPORT CANVAS */}
        {task.result?.summary && (
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-10 shadow-xs space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                <Sparkles className="size-4" />
                Comprehensive AI Briefing
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {task.result.summary.split(/\s+/).length} words
              </span>
            </div>

            {/* Markdown Body */}
            <div className="prose prose-slate max-w-none text-slate-800 text-xs sm:text-base leading-relaxed prose-headings:font-bold prose-headings:text-slate-900 prose-headings:tracking-tight prose-p:leading-relaxed prose-a:text-indigo-600 prose-a:font-semibold prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-indigo-700 prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-xl">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {task.result.summary}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* CITATIONS & SOURCES REFERENCED */}
        {task.result?.sources && task.result.sources.length > 0 && (
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xs space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Sources Referenced ({task.result.sources.length})
              </h3>
              <span className="text-[10.5px] text-slate-400">Live Web Search</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {task.result.sources.map((src, idx) => (
                <a
                  key={idx}
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 transition group flex flex-col justify-between shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-1.5 mb-1">
                    <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 line-clamp-1">
                      {src.title}
                    </span>
                    <ExternalLink className="size-3 text-slate-400 group-hover:text-indigo-600 shrink-0 mt-0.5" />
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-2 leading-relaxed mb-1.5">
                    {src.snippet}
                  </p>
                  <span className="text-[10px] font-mono text-slate-400 truncate">
                    {new URL(src.url).hostname.replace("www.", "")}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* BOTTOM RETURN NAV */}
        <div className="flex items-center justify-between pt-4 pb-12">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 py-2 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-xs transition active:scale-95"
          >
            <ArrowLeft className="size-4" />
            <span>Return to Tasks</span>
          </button>

          <span className="text-xs text-slate-400 font-medium">AutoTask Autonomous Intelligence</span>
        </div>
      </main>
    </div>
  );
}
