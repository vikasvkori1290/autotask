import { useState, useMemo } from "react";
import {
  ChevronLeft,
  Clock,
  CheckCircle2,
  Loader2,
  Sparkles,
  AlertCircle,
  Plus,
  Repeat,
  ArrowRight,
  Search,
  Trash2,
  CheckSquare2,
  History,
  CalendarDays,
} from "lucide-react";
import type { AutoTask } from "../../lib/autotask/scheduler";

interface TodayTasksViewProps {
  tasks: AutoTask[];
  onBackToCalendar: () => void;
  onSelectTask: (task: AutoTask) => void;
  onOpenCreate: () => void;
  onDeleteTask: (id: string) => void;
}

type TabType = "previous" | "today" | "upcoming";
type StatusFilter = "all" | "completed" | "ready" | "pending";

export function TodayTasksView({
  tasks,
  onBackToCalendar,
  onSelectTask,
  onOpenCreate,
  onDeleteTask,
}: TodayTasksViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("today");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Selected date offset for "Previous Days" view (default: yesterday = -1)
  const [prevDayOffset, setPrevDayOffset] = useState<number>(-1);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

  // Selected past date
  const selectedPrevDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + prevDayOffset);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [prevDayOffset]);

  // Split tasks into categories: Today, Previous Days, Upcoming
  const { todayTasks, previousTasks, upcomingTasks, pastDaysList } = useMemo(() => {
    const todayList: AutoTask[] = [];
    const prevList: AutoTask[] = [];
    const upcomingList: AutoTask[] = [];

    // Group previous tasks by date string
    const pastDaysMap = new Map<string, { date: Date; count: number }>();

    for (const t of tasks) {
      if (t.targetTime >= todayStart && t.targetTime <= todayEnd) {
        todayList.push(t);
      } else if (t.targetTime < todayStart) {
        prevList.push(t);
        const td = new Date(t.targetTime);
        const key = `${td.getFullYear()}-${td.getMonth()}-${td.getDate()}`;
        if (!pastDaysMap.has(key)) {
          pastDaysMap.set(key, {
            date: new Date(td.getFullYear(), td.getMonth(), td.getDate()),
            count: 1,
          });
        } else {
          pastDaysMap.get(key)!.count++;
        }
      } else {
        upcomingList.push(t);
      }
    }

    // Sort today: chronologically
    todayList.sort((a, b) => a.targetTime - b.targetTime);
    // Sort previous: newest first
    prevList.sort((a, b) => b.targetTime - a.targetTime);
    // Sort upcoming: closest first
    upcomingList.sort((a, b) => a.targetTime - b.targetTime);

    // Build last 7 days list for quick picker
    const pastDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (i + 1));
      d.setHours(0, 0, 0, 0);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      return {
        offset: -(i + 1),
        date: d,
        taskCount: pastDaysMap.get(key)?.count || 0,
      };
    });

    return {
      todayTasks: todayList,
      previousTasks: prevList,
      upcomingTasks: upcomingList,
      pastDaysList: pastDays,
    };
  }, [tasks, todayStart, todayEnd]);

  // Filter tasks based on current tab, status filter, and search
  const currentTabTasks = useMemo(() => {
    let list: AutoTask[] = [];
    if (activeTab === "today") {
      list = todayTasks;
    } else if (activeTab === "previous") {
      // If a specific previous day is selected
      const selStart = selectedPrevDate.getTime();
      const selEnd = selStart + 24 * 60 * 60 * 1000 - 1;
      list = previousTasks.filter((t) => t.targetTime >= selStart && t.targetTime <= selEnd);
    } else {
      list = upcomingTasks;
    }

    if (statusFilter === "completed") {
      list = list.filter((t) => t.status === "delivered");
    } else if (statusFilter === "ready") {
      list = list.filter((t) => t.status === "ready");
    } else if (statusFilter === "pending") {
      list = list.filter((t) => t.status === "queued" || t.status === "researching");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.prompt.toLowerCase().includes(q) ||
          t.result?.summary.toLowerCase().includes(q)
      );
    }

    return list;
  }, [activeTab, todayTasks, previousTasks, upcomingTasks, selectedPrevDate, statusFilter, searchQuery]);

  // Status badge helper
  const getStatusBadge = (task: AutoTask) => {
    switch (task.status) {
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="size-3.5 text-emerald-600" />
            <span>Delivered & Completed</span>
          </span>
        );
      case "ready":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Sparkles className="size-3.5 text-indigo-600" />
            <span>Response Ready</span>
          </span>
        );
      case "researching":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <Loader2 className="size-3.5 animate-spin text-sky-600" />
            <span>Researching...</span>
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="size-3.5 text-rose-600" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="size-3.5 text-amber-600" />
            <span>Queued</span>
          </span>
        );
    }
  };

  return (
    <div className="h-full min-h-screen w-full flex flex-col bg-slate-50 text-slate-900 select-none relative font-sans overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[300px] bg-indigo-500/[0.04] blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[300px] bg-emerald-500/[0.04] blur-[120px] rounded-full pointer-events-none" />

      {/* TOP HEADER */}
      <header className="relative z-30 shrink-0 border-b border-slate-200/90 autotask-glass px-3 sm:px-6 pt-[max(env(safe-area-inset-top,0px),2.5rem)] pb-2.5 sm:py-3 flex items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToCalendar}
            className="flex items-center gap-1 py-1.5 px-2 sm:px-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition active:scale-95 shrink-0"
            title="Return to Calendar"
          >
            <ChevronLeft className="size-4 text-slate-500" />
            <span className="hidden sm:inline">Calendar</span>
          </button>

          <div className="h-5 w-[1px] bg-slate-200 hidden sm:block shrink-0" />

          <div className="flex items-center gap-2 min-w-0">
            <div className="size-7 sm:size-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <CheckSquare2 className="size-3.5 sm:size-4" />
            </div>
            <h1 className="text-xs sm:text-base font-bold text-slate-900 tracking-tight truncate flex items-center gap-1.5">
              <span>Task Briefings</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                {todayTasks.length}
              </span>
            </h1>
          </div>
        </div>

        {/* Right action button */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenCreate}
            className="flex items-center gap-1 py-1.5 px-2.5 sm:px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm active:scale-95 transition shrink-0"
          >
            <Plus className="size-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline">Schedule New Task</span>
            <span className="sm:hidden text-xs">New</span>
          </button>
        </div>
      </header>

      {/* SUB-HEADER: TABS FOR (PREVIOUS DAYS | TODAY'S TASKS | UPCOMING TASKS) */}
      <div className="relative z-20 shrink-0 border-b border-slate-200 bg-white px-3 sm:px-6 py-2 shadow-xs">
        <div className="max-w-5xl mx-auto flex flex-col gap-2">
          {/* Main Segmented Tab Switcher */}
          <div className="flex items-center p-1 bg-slate-100 border border-slate-200/90 rounded-2xl w-full">
            {/* Previous Days Tab */}
            <button
              type="button"
              onClick={() => setActiveTab("previous")}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1.5 sm:px-3.5 rounded-xl text-xs font-semibold transition ${
                activeTab === "previous"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <History className="size-3.5 shrink-0" />
              <span>Past</span>
              {previousTasks.length > 0 && (
                <span className="ml-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                  {previousTasks.length}
                </span>
              )}
            </button>

            {/* Today's Tasks Tab (Highlighted) */}
            <button
              type="button"
              onClick={() => setActiveTab("today")}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 sm:px-4 rounded-xl text-xs font-bold transition ${
                activeTab === "today"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              <CheckSquare2 className="size-3.5 shrink-0" />
              <span>Today</span>
              <span
                className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  activeTab === "today"
                    ? "bg-indigo-500 text-white"
                    : "bg-indigo-100 text-indigo-700"
                }`}
              >
                {todayTasks.length}
              </span>
            </button>

            {/* Upcoming Tasks Tab */}
            <button
              type="button"
              onClick={() => setActiveTab("upcoming")}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1.5 sm:px-3.5 rounded-xl text-xs font-semibold transition ${
                activeTab === "upcoming"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CalendarDays className="size-3.5 shrink-0" />
              <span>Upcoming</span>
              {upcomingTasks.length > 0 && (
                <span className="ml-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                  {upcomingTasks.length}
                </span>
              )}
            </button>
          </div>

          {/* Search & Filter Pills */}
          <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-0.5">
            <div className="relative shrink-0">
              <Search className="size-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter..."
                className="pl-7 pr-2 py-1 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 w-24 sm:w-44 transition"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto">
              {(["all", "completed", "ready", "pending"] as const).map((key) => {
                const label =
                  key === "all"
                    ? "All"
                    : key === "completed"
                    ? "Done"
                    : key === "ready"
                    ? "Ready"
                    : "Queued";
                const active = statusFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusFilter(key)}
                    className={`py-1 px-2 rounded-lg text-[10.5px] font-semibold transition shrink-0 ${
                      active
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* IF PREVIOUS DAYS: SUB-DATE SELECTOR STRIP */}
        {activeTab === "previous" && (
          <div className="max-w-5xl mx-auto mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 overflow-x-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              Past Day:
            </span>
            <div className="flex items-center gap-1.5 flex-1 overflow-x-auto py-0.5">
              {pastDaysList.map((day) => {
                const isSelected = prevDayOffset === day.offset;
                const dateLabel =
                  day.offset === -1
                    ? "Yesterday"
                    : day.date.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
                return (
                  <button
                    key={day.offset}
                    type="button"
                    onClick={() => setPrevDayOffset(day.offset)}
                    className={`py-1 px-2.5 rounded-xl text-[11px] font-semibold transition shrink-0 flex items-center gap-1 border ${
                      isSelected
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span>{dateLabel}</span>
                    {day.taskCount > 0 && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.1 rounded-full ${
                          isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {day.taskCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-6 py-4 pb-36 sm:pb-12 autotask-scrollbar">
        <div className="max-w-5xl mx-auto space-y-4">
          {/* View banner info */}
          <div className="flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-200/60">
            <div className="font-semibold text-slate-700">
              {activeTab === "today" && (
                <span>
                  Showing all tasks scheduled for today,{" "}
                  <strong className="text-slate-900 font-bold">
                    {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </strong>
                </span>
              )}
              {activeTab === "previous" && (
                <span>
                  Viewing history for{" "}
                  <strong className="text-slate-900 font-bold">
                    {selectedPrevDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </strong>
                </span>
              )}
              {activeTab === "upcoming" && (
                <span>
                  Showing all future scheduled tasks & autonomous briefings
                </span>
              )}
            </div>
            <span className="font-medium">{currentTabTasks.length} tasks</span>
          </div>

          {/* TASK LIST CARDS */}
          {currentTabTasks.length > 0 ? (
            <div className="grid grid-cols-1 gap-3.5">
              {currentTabTasks.map((task) => {
                const targetDate = new Date(task.targetTime);
                const timeString = targetDate.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const dateString = targetDate.toLocaleDateString([], {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });

                const isDeliveredOrReady =
                  task.status === "delivered" || task.status === "ready";
                const hasSummary = Boolean(task.result?.summary);

                return (
                  <div
                    key={task.id}
                    className="bg-white border border-slate-200/90 hover:border-indigo-300 rounded-2xl p-4 sm:p-5 shadow-xs transition hover:shadow-md relative group flex flex-col justify-between gap-3.5"
                  >
                    {/* Top Row: Time, Status, Engine, Recurrence */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Target Time Badge */}
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-[11px] font-bold text-slate-800">
                          <Clock className="size-3 text-indigo-600 shrink-0" />
                          <span>
                            {activeTab === "today"
                              ? timeString
                              : `${dateString} ${timeString}`}
                          </span>
                        </div>

                        {/* Status Badge */}
                        {getStatusBadge(task)}

                        {/* Recurrence */}
                        {task.recurrence === "daily" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Repeat className="size-2.5" />
                            Daily
                          </span>
                        )}
                      </div>

                      {/* Engine Badge */}
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 ${
                          (task.engine || task.result?.engine) === "opencode"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {(task.engine || task.result?.engine) === "opencode"
                          ? "OpenCode"
                          : "NVIDIA"}
                      </span>
                    </div>

                    {/* Middle: Title & Prompt */}
                    <div className="space-y-1">
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-snug break-words">
                        {task.title}
                      </h2>
                      {task.title !== task.prompt && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {task.prompt}
                        </p>
                      )}
                    </div>

                    {/* AI Response Preview (If generated) */}
                    {hasSummary && (
                      <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-700">
                        <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                          <span className="flex items-center gap-1 text-indigo-700 text-[11px]">
                            <Sparkles className="size-3" />
                            Briefing Preview
                          </span>
                          {task.result?.sources && task.result.sources.length > 0 && (
                            <span className="text-[10.5px] text-slate-400 font-normal">
                              {task.result.sources.length} sources
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-slate-600 leading-relaxed italic text-[11.5px]">
                          "{task.result?.summary.replace(/[#*`_]/g, "").slice(0, 160)}..."
                        </p>
                      </div>
                    )}

                    {/* Bottom Actions Row */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onDeleteTask(task.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Delete task"
                        >
                          <Trash2 className="size-4" />
                        </button>
                        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                          {task.id}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectTask(task)}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3.5 sm:px-4 rounded-xl font-bold text-xs transition active:scale-95 shadow-xs ${
                          isDeliveredOrReady
                            ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                        }`}
                      >
                        {isDeliveredOrReady ? (
                          <>
                            <Sparkles className="size-3.5 text-indigo-200 shrink-0" />
                            <span>View Full Response</span>
                            <ArrowRight className="size-3.5 ml-0.5 shrink-0" />
                          </>
                        ) : (
                          <>
                            <span>View Details</span>
                            <ArrowRight className="size-3.5 ml-0.5 shrink-0" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-8 sm:p-12 text-center space-y-4 shadow-xs">
              <div className="size-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 mx-auto flex items-center justify-center">
                <CheckSquare2 className="size-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  {activeTab === "today"
                    ? "No tasks scheduled for today"
                    : activeTab === "previous"
                    ? "No tasks found on this date"
                    : "No upcoming tasks scheduled"}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {activeTab === "today"
                    ? "Schedule an autonomous research briefing with NVIDIA NIM or OpenCode for any time today."
                    : activeTab === "previous"
                    ? "Select another day above or check Today's tasks."
                    : "Create a future task or recurring daily briefing."}
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenCreate}
                className="inline-flex items-center gap-2 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition active:scale-95"
              >
                <Plus className="size-4 stroke-[2.5]" />
                <span>Schedule a Task Now</span>
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
