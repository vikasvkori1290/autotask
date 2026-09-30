import { useState, useEffect, useMemo, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  Cpu,
  Code2,
  Boxes,
  LogOut,
  Repeat,
  CheckCircle2,
  Loader2,
  Calendar as CalendarIcon,
  ListTodo,
  Trash2,
  ArrowRight,
  Smartphone,
  Sliders,
} from "lucide-react";
import type { AutotaskUser } from "../../lib/autotask/auth";
import { signOut } from "../../lib/autotask/auth";
import { getNvidiaModel, getOpencodeModel } from "../../lib/autotask/settings";
import {
  getTasks,
  deleteTask,
  startBackgroundRunner,
  type AutoTask,
} from "../../lib/autotask/scheduler";
import { TaskCreateModal } from "./TaskCreateModal";
import { TaskDetailModal } from "./TaskDetailModal";
import { NvidiaSetupModal } from "./NvidiaSetupModal";
import { OpencodeSetupModal } from "./OpencodeSetupModal";
import { ConnectorsModal } from "./ConnectorsModal";

interface CalendarWorkspaceProps {
  user: AutotaskUser;
  onSignOut: () => void;
}

type ViewMode = "week" | "day" | "agenda";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarWorkspace({ user, onSignOut }: CalendarWorkspaceProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return "day";
    }
    return "week";
  });

  const [tasks, setTasks] = useState<AutoTask[]>([]);
  const [isNvidiaModalOpen, setIsNvidiaModalOpen] = useState(false);
  const [isOpencodeModalOpen, setIsOpencodeModalOpen] = useState(false);
  const [isConnectorsOpen, setIsConnectorsOpen] = useState(false);
  const [isEngineMenuOpen, setIsEngineMenuOpen] = useState(false);

  // Task creation state
  const [createModalDate, setCreateModalDate] = useState<Date | undefined>(undefined);
  const [createModalHour, setCreateModalHour] = useState<number>(18);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Selected task detail
  const [selectedTask, setSelectedTask] = useState<AutoTask | null>(null);

  // Current time indicator position
  const [currentTime, setCurrentTime] = useState(new Date());

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && viewMode === "week") {
        setViewMode("day");
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [viewMode]);

  // Auto-scroll to near current hour on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const currentHour = new Date().getHours();
      scrollContainerRef.current.scrollTop = Math.max(0, (currentHour - 2) * 64);
    }
  }, [viewMode, currentDate]);

  // Update current time line every 30s
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Request browser desktop notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Load tasks and start autonomous background runner
  useEffect(() => {
    setTasks(getTasks());
    const stopRunner = startBackgroundRunner((updated) => {
      setTasks(updated);
    });
    return () => stopRunner();
  }, []);

  // Navigation handlers
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (!isMobile && viewMode === "week") {
      next.setDate(next.getDate() - 7);
    } else {
      next.setDate(next.getDate() - 1);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (!isMobile && viewMode === "week") {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + 1);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Week days calculation for strip & grid
  const currentWeekDays = useMemo(() => {
    const days: Date[] = [];
    const curr = new Date(currentDate);
    const dayOfWeek = curr.getDay(); // 0 is Sunday
    const sunday = new Date(curr);
    sunday.setDate(curr.getDate() - dayOfWeek);

    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  // Effective days displayed in the main grid
  const displayedDays = useMemo(() => {
    if (isMobile || viewMode === "day") {
      return [new Date(currentDate)];
    }
    return currentWeekDays;
  }, [isMobile, viewMode, currentDate, currentWeekDays]);

  const monthYearLabel = useMemo(() => {
    return currentDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }, [currentDate]);

  const fullDateLabel = useMemo(() => {
    return currentDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }, [currentDate]);

  // Check if a given date is today
  const isToday = (d: Date) => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const isSelectedDate = (d: Date) => {
    return (
      d.getDate() === currentDate.getDate() &&
      d.getMonth() === currentDate.getMonth() &&
      d.getFullYear() === currentDate.getFullYear()
    );
  };

  // Tasks mapped by date string "YYYY-MM-DD"
  const tasksByDay = useMemo(() => {
    const map = new Map<string, AutoTask[]>();
    for (const t of tasks) {
      const d = new Date(t.targetTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const list = map.get(key) || [];
      list.push(t);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const hasTasksOnDate = (date: Date) => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const list = tasksByDay.get(key);
    return Boolean(list && list.length > 0);
  };

  // Tasks grouped for Agenda view
  const agendaGrouped = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => a.targetTime - b.targetTime);
    const groups: { dateLabel: string; isToday: boolean; tasks: AutoTask[] }[] = [];

    for (const t of sorted) {
      const d = new Date(t.targetTime);
      const label = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      let grp = groups.find((g) => g.dateLabel === label);
      if (!grp) {
        grp = { dateLabel: label, isToday: isToday(d), tasks: [] };
        groups.push(grp);
      }
      grp.tasks.push(t);
    }
    return groups;
  }, [tasks]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0c10] text-neutral-100 font-sans select-none relative">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(20,184,166,0.12),rgba(168,85,247,0.06),transparent_80%)]" />

      {/* TOP APP BAR */}
      <header className="relative z-30 shrink-0 border-b border-white/[0.08] autotask-glass px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        {/* Left Section: Logo + Date Navigator */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {/* Brand Mark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="size-9 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 p-[1px] shadow-lg shadow-teal-500/20">
              <div className="w-full h-full bg-[#0d1117] rounded-[15px] flex items-center justify-center">
                <Sparkles className="size-4 text-teal-300" />
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                <span>AutoTask</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-teal-500/15 text-teal-300 border border-teal-500/30">
                  AI
                </span>
              </div>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-white/[0.1] hidden sm:block" />

          {/* Date controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={handleToday}
              className="py-1 px-2.5 rounded-lg border border-white/[0.1] hover:border-white/[0.2] bg-white/[0.03] hover:bg-white/[0.08] text-[11px] sm:text-xs font-semibold text-neutral-200 transition active:scale-95"
            >
              Today
            </button>

            <div className="flex items-center bg-white/[0.03] border border-white/[0.08] rounded-lg p-0.5">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1 rounded hover:bg-white/[0.08] text-neutral-400 hover:text-white transition active:scale-95"
                aria-label="Previous"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-1 rounded hover:bg-white/[0.08] text-neutral-400 hover:text-white transition active:scale-95"
                aria-label="Next"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>

            <span className="text-xs sm:text-sm font-semibold text-white tracking-tight truncate ml-1">
              {isMobile ? fullDateLabel : monthYearLabel}
            </span>
          </div>
        </div>

        {/* Center Section: View Mode Switcher (Desktop Only) */}
        {!isMobile && (
          <div className="hidden md:flex p-1 bg-black/40 border border-white/[0.08] rounded-xl shadow-inner">
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={`py-1 px-3 text-xs font-semibold rounded-lg transition ${
                viewMode === "day"
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={`py-1 px-3 text-xs font-semibold rounded-lg transition ${
                viewMode === "week"
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode("agenda")}
              className={`py-1 px-3 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                viewMode === "agenda"
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <ListTodo className="size-3.5" />
              <span>Agenda</span>
            </button>
          </div>
        )}

        {/* Right Section: Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Schedule New Task (Desktop primary) */}
          <button
            type="button"
            onClick={() => {
              setCreateModalDate(currentDate);
              setCreateModalHour(new Date().getHours() + 1);
              setIsCreateOpen(true);
            }}
            className="hidden sm:flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-neutral-950 font-bold text-xs shadow-lg shadow-teal-500/25 active:scale-95 transition"
          >
            <Plus className="size-3.5 stroke-[3]" />
            <span>New Task</span>
          </button>

          {/* Download Mobile APK Button */}
          <a
            href="/autotask.apk"
            download="AutoTask.apk"
            className="flex items-center gap-1.5 py-1 px-2 sm:py-1.5 sm:px-2.5 rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-[11px] sm:text-xs font-medium text-sky-300 transition"
            title="Download Android APK"
          >
            <Smartphone className="size-3.5 text-sky-400" />
            <span className="hidden lg:inline">APK</span>
          </a>

          {/* Desktop Connectors Button */}
          <button
            type="button"
            onClick={() => setIsConnectorsOpen(true)}
            className="hidden md:flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-xs font-medium text-neutral-200 transition"
            title="Connected Apps & Services"
          >
            <Boxes className="size-3.5 text-teal-400" />
            <span className="hidden xl:inline">Connectors</span>
          </button>

          {/* Desktop Engines Dropdown / Buttons */}
          <div className="hidden lg:flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsNvidiaModalOpen(true)}
              className="flex items-center gap-1 py-1.5 px-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-semibold text-emerald-300 transition"
              title="Configure NVIDIA NIM Model"
            >
              <Cpu className="size-3.5 text-emerald-400" />
              <span className="hidden xl:inline">{getNvidiaModel().split("/").pop()}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOpencodeModalOpen(true)}
              className="flex items-center gap-1 py-1.5 px-2 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-xs font-semibold text-purple-300 transition"
              title="Configure OpenCode Engine"
            >
              <Code2 className="size-3.5 text-purple-400" />
              <span className="hidden xl:inline">{getOpencodeModel().split("/").pop()}</span>
            </button>
          </div>

          {/* User Sign Out */}
          <button
            type="button"
            onClick={() => {
              signOut();
              onSignOut();
            }}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition"
            title={`Signed in as ${user.email} (Sign out)`}
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      {/* MOBILE HORIZONTAL DATE CAROUSEL STRIP */}
      {isMobile && viewMode !== "agenda" && (
        <div className="relative z-20 shrink-0 border-b border-white/[0.08] bg-[#0c0f15]/95 backdrop-blur-md px-2 py-2.5">
          <div className="flex items-center justify-between gap-1 max-w-md mx-auto">
            {currentWeekDays.map((date, idx) => {
              const active = isSelectedDate(date);
              const today = isToday(date);
              const hasTask = hasTasksOnDate(date);

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentDate(date)}
                  className={`flex-1 flex flex-col items-center py-2 px-1 rounded-2xl transition relative ${
                    active
                      ? "bg-gradient-to-b from-teal-500/20 to-teal-500/5 border border-teal-500/40 text-white shadow-sm"
                      : "hover:bg-white/[0.04] text-neutral-400 border border-transparent"
                  }`}
                >
                  <span className={`text-[10px] font-semibold tracking-wider uppercase ${active ? "text-teal-300 font-bold" : ""}`}>
                    {DAYS_OF_WEEK[date.getDay()]}
                  </span>
                  <span
                    className={`mt-1 size-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      today
                        ? "bg-teal-400 text-neutral-950 font-black shadow-md shadow-teal-400/30"
                        : active
                        ? "text-white font-extrabold"
                        : "text-neutral-200"
                    }`}
                  >
                    {date.getDate()}
                  </span>

                  {/* Dot indicator for scheduled tasks */}
                  {hasTask && (
                    <span className="size-1.5 rounded-full bg-teal-400 absolute bottom-1 shadow-sm shadow-teal-400/50" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* MAIN VIEW CONTENT AREA */}
      <div className="flex-1 flex flex-col min-h-0 relative pb-16 md:pb-0">
        {viewMode === "agenda" ? (
          /* AGENDA TIMELINE VIEW */
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 autotask-scrollbar max-w-4xl mx-auto w-full">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/[0.08]">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <ListTodo className="size-5 text-teal-400" />
                  <span>Tasks &amp; Research Agenda</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Autonomous background research deliverables grouped by deadline
                </p>
              </div>

              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-neutral-300">
                {tasks.length} total tasks
              </span>
            </div>

            {agendaGrouped.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="size-16 rounded-3xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-neutral-500 mb-4">
                  <CalendarIcon className="size-8 stroke-[1.5]" />
                </div>
                <h4 className="text-base font-semibold text-white">No tasks scheduled yet</h4>
                <p className="text-xs text-neutral-400 max-w-xs mt-1 leading-relaxed">
                  Click any hour slot on the calendar or tap the button below to schedule an autonomous AI research task.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCreateModalDate(currentDate);
                    setCreateModalHour(new Date().getHours() + 1);
                    setIsCreateOpen(true);
                  }}
                  className="mt-5 py-2 px-4 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-semibold transition"
                >
                  + Schedule First Task
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {agendaGrouped.map((group) => (
                  <div key={group.dateLabel} className="space-y-3">
                    <div className="sticky top-0 z-10 flex items-center gap-2 py-1.5 bg-[#0a0c10]/90 backdrop-blur-md">
                      <span className={`text-xs font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-md ${
                        group.isToday
                          ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                          : "text-neutral-400 bg-white/[0.03] border border-white/[0.06]"
                      }`}>
                        {group.dateLabel}
                      </span>
                      <div className="h-[1px] flex-1 bg-white/[0.06]" />
                    </div>

                    <div className="space-y-2.5">
                      {group.tasks.map((task) => {
                        const target = new Date(task.targetTime);
                        const timeStr = target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                        const isOpencode = (task.engine || task.result?.engine) === "opencode";

                        return (
                          <div
                            key={task.id}
                            onClick={() => setSelectedTask(task)}
                            className="group p-4 rounded-2xl autotask-glass hover:border-white/[0.16] transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md hover:shadow-xl"
                          >
                            <div className="flex items-start gap-3.5 min-w-0">
                              <div className="size-11 rounded-2xl bg-black/60 border border-white/[0.08] flex flex-col items-center justify-center shrink-0">
                                <span className="text-[11px] font-bold text-white leading-tight">{timeStr.split(" ")[0]}</span>
                                <span className="text-[9px] text-neutral-400 font-semibold">{timeStr.split(" ")[1]}</span>
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  {/* Status badge */}
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                    task.status === "ready"
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                                      : task.status === "delivered"
                                      ? "bg-purple-500/10 text-purple-400 border-purple-500/25"
                                      : task.status === "researching"
                                      ? "bg-blue-500/10 text-blue-400 border-blue-500/25"
                                      : "bg-amber-500/10 text-amber-400 border-amber-500/25"
                                  }`}>
                                    {task.status === "researching" && <Loader2 className="size-2.5 animate-spin" />}
                                    {task.status === "ready" && <CheckCircle2 className="size-2.5" />}
                                    {task.status === "delivered" && <Sparkles className="size-2.5" />}
                                    <span>{task.status === "ready" ? "Ready" : task.status}</span>
                                  </span>

                                  {/* Engine badge */}
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                    isOpencode
                                      ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                                      : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                  }`}>
                                    {isOpencode ? <Code2 className="size-2.5" /> : <Cpu className="size-2.5" />}
                                    <span>{isOpencode ? "OpenCode" : "NVIDIA NIM"}</span>
                                  </span>

                                  {task.recurrence === "daily" && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.05] text-neutral-300 border border-white/[0.08]">
                                      <Repeat className="size-2.5" />
                                      <span>Daily</span>
                                    </span>
                                  )}
                                </div>

                                <h4 className="text-sm font-semibold text-white leading-snug truncate group-hover:text-teal-300 transition">
                                  {task.prompt}
                                </h4>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteTask(task.id);
                                  setTasks(getTasks());
                                }}
                                className="p-2 rounded-xl text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                title="Delete task"
                              >
                                <Trash2 className="size-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedTask(task)}
                                className="py-1 px-3 rounded-xl bg-white/[0.05] group-hover:bg-teal-500 group-hover:text-neutral-950 text-neutral-300 text-xs font-semibold transition flex items-center gap-1.5"
                              >
                                <span>{task.status === "delivered" || task.status === "ready" ? "View Delivery" : "Details"}</span>
                                <ArrowRight className="size-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* HOURLY CALENDAR GRID (Day or Week) */
          <div className="flex-1 flex flex-col min-h-0 bg-[#0a0c10]">
            {/* Days Header */}
            <div className="flex border-b border-white/[0.08] bg-[#0c0f15]/80 backdrop-blur-md pl-12 sm:pl-16 pr-2 sm:pr-4 shrink-0">
              {displayedDays.map((date, idx) => {
                const today = isToday(date);
                return (
                  <div
                    key={idx}
                    className={`flex-1 py-2 sm:py-3 text-center border-l border-white/[0.06] ${
                      today ? "bg-teal-500/[0.04]" : ""
                    }`}
                  >
                    <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                      {DAYS_OF_WEEK[date.getDay()]}
                    </div>
                    <div
                      className={`inline-flex items-center justify-center size-7 sm:size-8 rounded-full text-xs sm:text-sm font-bold mt-0.5 ${
                        today
                          ? "bg-teal-400 text-neutral-950 shadow-md shadow-teal-400/30"
                          : "text-white"
                      }`}
                    >
                      {date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Scrollable Hourly Timeline */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto relative flex autotask-scrollbar">
              {/* Hour Labels */}
              <div className="w-12 sm:w-16 shrink-0 border-r border-white/[0.08] text-right pr-2 sm:pr-3 select-none bg-[#090b0f]/60">
                {HOURS.map((hour) => (
                  <div key={hour} className="h-16 -mt-2.5 text-[10px] sm:text-[11px] font-medium text-neutral-500">
                    {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                  </div>
                ))}
              </div>

              {/* Day Columns */}
              <div className="flex-1 flex relative">
                {displayedDays.map((date, colIdx) => {
                  const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                  const dayTasks = tasksByDay.get(dayKey) || [];
                  const isCurrentDay = isToday(date);

                  return (
                    <div
                      key={colIdx}
                      className={`flex-1 relative border-l border-white/[0.05] ${
                        isCurrentDay ? "bg-teal-500/[0.02]" : ""
                      }`}
                    >
                      {/* Current Time Indicator Line */}
                      {isCurrentDay && (
                        <div
                          style={{
                            top: `${currentTime.getHours() * 64 + (currentTime.getMinutes() / 60) * 64}px`,
                          }}
                          className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                        >
                          <div className="size-2.5 -ml-1 rounded-full bg-rose-500 shadow-md shadow-rose-500/80 animate-ping absolute" />
                          <div className="size-2.5 -ml-1 rounded-full bg-rose-500 shadow-md shadow-rose-500/80 relative" />
                          <div className="h-[2px] w-full bg-gradient-to-r from-rose-500 via-rose-500/80 to-transparent" />
                        </div>
                      )}

                      {/* Hour Cells */}
                      {HOURS.map((hour) => (
                        <div
                          key={hour}
                          onClick={() => {
                            setCreateModalDate(date);
                            setCreateModalHour(hour);
                            setIsCreateOpen(true);
                          }}
                          className="h-16 border-b border-white/[0.04] hover:bg-teal-500/[0.04] transition cursor-pointer group relative"
                        >
                          <span className="hidden group-hover:inline-block absolute top-1 left-2 text-[10px] text-teal-400 font-medium">
                            + Schedule
                          </span>
                        </div>
                      ))}

                      {/* Render Scheduled Tasks on this day */}
                      {dayTasks.map((task) => {
                        const target = new Date(task.targetTime);
                        const topOffset = target.getHours() * 64 + (target.getMinutes() / 60) * 64;
                        const isOpencode = (task.engine || task.result?.engine) === "opencode";

                        const statusStyle = {
                          queued: "bg-amber-950/70 border-amber-500/40 text-amber-200",
                          researching: "bg-blue-950/70 border-blue-500/40 text-blue-200",
                          ready: "bg-emerald-950/80 border-emerald-400/50 text-emerald-200 autotask-glow-teal",
                          delivered: "bg-purple-950/80 border-purple-400/50 text-purple-200 autotask-glow-purple",
                          failed: "bg-rose-950/70 border-rose-500/40 text-rose-200",
                        }[task.status];

                        return (
                          <div
                            key={task.id}
                            style={{ top: `${topOffset}px` }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTask(task);
                            }}
                            className={`absolute left-1 right-1 min-h-[54px] rounded-2xl p-2.5 border shadow-xl backdrop-blur-md cursor-pointer transition hover:scale-[1.01] hover:z-30 ${statusStyle}`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                {task.status === "researching" && <Loader2 className="size-3 animate-spin text-blue-400" />}
                                {task.status === "ready" && <CheckCircle2 className="size-3 text-emerald-400" />}
                                {task.status === "delivered" && <Sparkles className="size-3 text-purple-400" />}
                                {target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>

                              <div className="flex items-center gap-1">
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-black tracking-wider uppercase ${
                                  isOpencode
                                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                }`}>
                                  {isOpencode ? "OC" : "NV"}
                                </span>
                                {task.recurrence === "daily" && (
                                  <span title="Daily Recurring">
                                    <Repeat className="size-3 text-emerald-300" />
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-xs font-semibold line-clamp-1 leading-snug">{task.prompt}</div>

                            <div className="text-[10px] text-neutral-400 mt-1 flex items-center justify-between">
                              <span className="capitalize">{task.status === "ready" ? "Ready for delivery" : task.status}</span>
                              <span className="underline opacity-80 hover:opacity-100">Review</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 autotask-glass border-t border-white/[0.08] px-4 py-2 flex items-center justify-between max-w-md mx-auto">
          {/* Day View */}
          <button
            type="button"
            onClick={() => setViewMode("day")}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition ${
              viewMode === "day" ? "text-teal-400 font-bold" : "text-neutral-400 hover:text-white"
            }`}
          >
            <CalendarIcon className="size-5" />
            <span className="text-[10px]">Day</span>
          </button>

          {/* Agenda View */}
          <button
            type="button"
            onClick={() => setViewMode("agenda")}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition ${
              viewMode === "agenda" ? "text-teal-400 font-bold" : "text-neutral-400 hover:text-white"
            }`}
          >
            <ListTodo className="size-5" />
            <span className="text-[10px]">Agenda</span>
          </button>

          {/* Center Elevated FAB */}
          <button
            type="button"
            onClick={() => {
              setCreateModalDate(currentDate);
              setCreateModalHour(new Date().getHours() + 1);
              setIsCreateOpen(true);
            }}
            className="-mt-5 size-12 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 text-neutral-950 flex items-center justify-center shadow-xl shadow-teal-500/40 active:scale-95 transition"
            aria-label="New Task"
          >
            <Plus className="size-6 stroke-[3]" />
          </button>

          {/* Connectors Modal */}
          <button
            type="button"
            onClick={() => setIsConnectorsOpen(true)}
            className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-neutral-400 hover:text-white transition"
          >
            <Boxes className="size-5" />
            <span className="text-[10px]">Connectors</span>
          </button>

          {/* Engines Settings */}
          <button
            type="button"
            onClick={() => setIsEngineMenuOpen(true)}
            className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-neutral-400 hover:text-white transition"
          >
            <Sliders className="size-5" />
            <span className="text-[10px]">Engines</span>
          </button>
        </nav>
      )}

      {/* MOBILE ENGINES ACTION SHEET */}
      {isEngineMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
          onClick={() => setIsEngineMenuOpen(false)}
        >
          <div
            className="w-full max-w-sm autotask-glass rounded-t-3xl sm:rounded-3xl p-5 border-t sm:border border-white/[0.1] shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-white/[0.2] rounded-full mx-auto mb-4 sm:hidden" />
            <h3 className="font-bold text-white text-base mb-1">AI Execution Engines</h3>
            <p className="text-xs text-neutral-400 mb-4">Select an engine to manage models and API credentials</p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsEngineMenuOpen(false);
                  setIsNvidiaModalOpen(true);
                }}
                className="w-full p-3.5 rounded-2xl bg-white/[0.04] hover:bg-emerald-500/10 border border-white/[0.08] hover:border-emerald-500/30 flex items-center justify-between transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Cpu className="size-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-white">NVIDIA NIM Cloud</div>
                    <div className="text-[11px] text-neutral-400">{getNvidiaModel().split("/").pop()}</div>
                  </div>
                </div>
                <ChevronRight className="size-4 text-neutral-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsEngineMenuOpen(false);
                  setIsOpencodeModalOpen(true);
                }}
                className="w-full p-3.5 rounded-2xl bg-white/[0.04] hover:bg-purple-500/10 border border-white/[0.08] hover:border-purple-500/30 flex items-center justify-between transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Code2 className="size-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-white">OpenCode Engine</div>
                    <div className="text-[11px] text-neutral-400">{getOpencodeModel().split("/").pop()}</div>
                  </div>
                </div>
                <ChevronRight className="size-4 text-neutral-500" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsEngineMenuOpen(false)}
              className="w-full mt-4 py-2.5 rounded-xl bg-white/[0.05] text-neutral-300 text-xs font-semibold hover:bg-white/[0.1] transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Task Creation Modal */}
      <TaskCreateModal
        isOpen={isCreateOpen}
        initialDate={createModalDate}
        initialHour={createModalHour}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => {
          setTasks(getTasks());
        }}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onDelete={(id) => {
          deleteTask(id);
          setTasks(getTasks());
        }}
      />

      {/* NVIDIA Key & Model Settings Modal */}
      <NvidiaSetupModal
        isOpen={isNvidiaModalOpen}
        canClose={true}
        onClose={() => setIsNvidiaModalOpen(false)}
        onSaved={() => setIsNvidiaModalOpen(false)}
      />

      {/* OpenCode Settings Modal */}
      <OpencodeSetupModal
        isOpen={isOpencodeModalOpen}
        onClose={() => setIsOpencodeModalOpen(false)}
        onSaved={() => setIsOpencodeModalOpen(false)}
      />

      {/* Connectors Panel Modal */}
      <ConnectorsModal
        isOpen={isConnectorsOpen}
        onClose={() => setIsConnectorsOpen(false)}
        onOpenNvidiaModal={() => setIsNvidiaModalOpen(true)}
        onOpenOpencodeModal={() => setIsOpencodeModalOpen(true)}
      />
    </div>
  );
}
