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
  CheckSquare2,
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
import { initNotifications } from "../../lib/autotask/notifications";
import { TaskCreateModal } from "./TaskCreateModal";
import { TaskResultPageView } from "./TaskResultPageView";
import { NvidiaSetupModal } from "./NvidiaSetupModal";
import { OpencodeSetupModal } from "./OpencodeSetupModal";
import { ConnectorsModal } from "./ConnectorsModal";
import { TodayTasksView } from "./TodayTasksView";

interface CalendarWorkspaceProps {
  user: AutotaskUser;
  onSignOut: () => void;
}

type ViewMode = "week" | "day" | "agenda" | "today-tasks";

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

  // Initialize mobile & web notifications with deep-link handler
  useEffect(() => {
    void initNotifications((taskId) => {
      const all = getTasks();
      const target = all.find((t) => t.id === taskId);
      if (target) {
        setSelectedTask(target);
      }
    });
  }, []);

  // Deep-link handler via URL hash: #task=<id>
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#task=")) {
        const taskId = hash.replace("#task=", "").split("&")[0];
        const all = tasks.length > 0 ? tasks : getTasks();
        const found = all.find((t) => t.id === taskId);
        if (found) {
          setSelectedTask(found);
        }
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [tasks]);

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

  // Helper dates for current week view (Sunday to Saturday)
  const currentWeekDays = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate]);

  // Days to show in calendar grid
  const displayedDays = useMemo(() => {
    if (viewMode === "day" || isMobile) {
      return [currentDate];
    }
    return currentWeekDays;
  }, [viewMode, isMobile, currentDate, currentWeekDays]);

  // Format month and year label for top bar
  const monthYearLabel = useMemo(() => {
    return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [currentDate]);

  const isToday = (d: Date) => {
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const isSelectedDate = (d: Date) => {
    return (
      d.getDate() === currentDate.getDate() &&
      d.getMonth() === currentDate.getMonth() &&
      d.getFullYear() === currentDate.getFullYear()
    );
  };

  const hasTasksOnDate = (d: Date) => {
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return tasks.some((t) => {
      const td = new Date(t.targetTime);
      const k = `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, "0")}-${String(td.getDate()).padStart(2, "0")}`;
      return k === dayKey;
    });
  };

  // Count of tasks scheduled for today
  const todayTasksCount = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = start + 24 * 60 * 60 * 1000 - 1;
    return tasks.filter((t) => t.targetTime >= start && t.targetTime <= end).length;
  }, [tasks]);

  // Group tasks by Day for timeline grid
  const tasksByDay = useMemo(() => {
    const map = new Map<string, AutoTask[]>();
    for (const task of tasks) {
      const d = new Date(task.targetTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const list = map.get(key) || [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  // Group tasks for Agenda View sorted by target time
  const agendaGrouped = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => a.targetTime - b.targetTime);
    const groups: Array<{ dateLabel: string; isToday: boolean; tasks: AutoTask[] }> = [];

    let currentGroup: { dateLabel: string; isToday: boolean; tasks: AutoTask[] } | null = null;

    for (const t of sorted) {
      const d = new Date(t.targetTime);
      const label = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
      });

      if (!currentGroup || currentGroup.dateLabel !== label) {
        currentGroup = {
          dateLabel: label,
          isToday: isToday(d),
          tasks: [],
        };
        groups.push(currentGroup);
      }
      currentGroup.tasks.push(t);
    }

    return groups;
  }, [tasks]);

  // Handle closing detail modal and clearing hash
  const handleCloseDetailModal = () => {
    setSelectedTask(null);
    if (typeof window !== "undefined" && window.location.hash.startsWith("#task=")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  };

  // If a task is selected, render full-page response view (no popup modal)
  if (selectedTask) {
    return (
      <TaskResultPageView
        task={selectedTask}
        onBack={handleCloseDetailModal}
        onDelete={(id) => {
          deleteTask(id);
          setTasks(getTasks());
          setSelectedTask(null);
        }}
      />
    );
  }

  return (
    <div className="h-full min-h-screen w-full flex flex-col bg-slate-50 text-slate-900 select-none relative font-sans overflow-hidden">
      {viewMode === "today-tasks" ? (
        <TodayTasksView
          tasks={tasks}
          onBackToCalendar={() => setViewMode(isMobile ? "day" : "week")}
          onSelectTask={(task) => setSelectedTask(task)}
          onOpenCreate={() => {
            setCreateModalDate(new Date());
            setCreateModalHour(new Date().getHours() + 1);
            setIsCreateOpen(true);
          }}
          onDeleteTask={(id) => {
            deleteTask(id);
            setTasks(getTasks());
          }}
        />
      ) : (
        <>
          {/* Subtle background ambient tint */}
          <div className="absolute top-0 right-1/4 w-[500px] h-[300px] bg-indigo-500/[0.03] blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-[500px] h-[300px] bg-emerald-500/[0.03] blur-[120px] rounded-full pointer-events-none" />

          {/* TOP APP BAR */}
          <header className="relative z-30 shrink-0 border-b border-slate-200/90 autotask-glass px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2 shadow-xs">
            {/* Left Section: Logo + Title / Month */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              {/* Brand Mark */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="size-8 sm:size-9 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-xs text-white">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 flex items-center gap-1.5 leading-tight">
                    <span>AutoTask</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                      AI
                    </span>
                  </div>
                  {/* On mobile: subtle month indicator directly under brand name */}
                  <div className="sm:hidden text-[11px] font-semibold text-slate-500 leading-tight">
                    {monthYearLabel}
                  </div>
                </div>
              </div>

              <div className="h-5 w-[1px] bg-slate-200 hidden sm:block shrink-0" />

              {/* Desktop Date controls */}
              <div className="hidden sm:flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToday}
                  className="py-1 px-2.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition active:scale-95"
                >
                  Today
                </button>

                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition active:scale-95"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition active:scale-95"
                    aria-label="Next"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>

                <span className="text-sm font-bold text-slate-900 tracking-tight ml-1">
                  {monthYearLabel}
                </span>
              </div>
            </div>

            {/* Center Section: View Mode Switcher (Desktop Only) */}
            {!isMobile && (
              <div className="hidden md:flex p-1 bg-slate-100 border border-slate-200/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewMode("day")}
                  className={`py-1 px-3 text-xs font-semibold rounded-lg transition ${
                    viewMode === "day"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Day
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("week")}
                  className={`py-1 px-3 text-xs font-semibold rounded-lg transition ${
                    viewMode === "week"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Week
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("agenda")}
                  className={`py-1 px-3 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                    viewMode === "agenda"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <ListTodo className="size-3.5" />
                  <span>Agenda</span>
                </button>
              </div>
            )}

            {/* Right Section: Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Mobile Quick Navigation Controls */}
              <div className="flex sm:hidden items-center gap-1">
                <button
                  type="button"
                  onClick={handleToday}
                  className="py-1 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 shadow-2xs active:scale-95 transition"
                >
                  Today
                </button>
                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="p-1 rounded hover:bg-slate-100 text-slate-600 active:scale-95 transition"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="p-1 rounded hover:bg-slate-100 text-slate-600 active:scale-95 transition"
                    aria-label="Next"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Today's Tasks Button (Desktop & Tablet) */}
              <button
                type="button"
                onClick={() => setViewMode("today-tasks")}
                className="hidden sm:flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-xs font-bold text-indigo-700 shadow-xs transition active:scale-95"
                title="Open Today's Tasks, History & Upcoming Briefings"
              >
                <CheckSquare2 className="size-3.5 text-indigo-600" />
                <span>Today's Tasks</span>
                {todayTasksCount > 0 && (
                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-indigo-600 text-white">
                    {todayTasksCount}
                  </span>
                )}
              </button>

              {/* Schedule New Task (Desktop primary) */}
              <button
                type="button"
                onClick={() => {
                  setCreateModalDate(currentDate);
                  setCreateModalHour(new Date().getHours() + 1);
                  setIsCreateOpen(true);
                }}
                className="hidden sm:flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm active:scale-95 transition"
              >
                <Plus className="size-3.5 stroke-[2.5]" />
                <span>New Task</span>
              </button>

              {/* Download Mobile APK Button */}
              <a
                href="/autotask.apk"
                download="AutoTask.apk"
                className="flex items-center gap-1.5 p-1.5 sm:py-1.5 sm:px-2.5 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-[11px] sm:text-xs font-semibold text-sky-700 transition"
                title="Download Android APK"
              >
                <Smartphone className="size-3.5 text-sky-600" />
                <span className="hidden lg:inline">APK</span>
              </a>

              {/* Desktop Connectors Button */}
              <button
                type="button"
                onClick={() => setIsConnectorsOpen(true)}
                className="hidden md:flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-xs transition"
                title="Connected Apps & Services"
              >
                <Boxes className="size-3.5 text-indigo-600" />
                <span className="hidden xl:inline">Connectors</span>
              </button>

              {/* Desktop Engines Dropdown / Buttons */}
              <div className="hidden lg:flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsNvidiaModalOpen(true)}
                  className="flex items-center gap-1 py-1.5 px-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 transition"
                  title="Configure NVIDIA NIM Model"
                >
                  <Cpu className="size-3.5 text-emerald-600" />
                  <span className="hidden xl:inline">{getNvidiaModel().split("/").pop()}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpencodeModalOpen(true)}
                  className="flex items-center gap-1 py-1.5 px-2 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-xs font-semibold text-purple-800 transition"
                  title="Configure OpenCode Engine"
                >
                  <Code2 className="size-3.5 text-purple-600" />
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
                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition"
                title={`Signed in as ${user.email} (Sign out)`}
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </header>

      {/* MOBILE HORIZONTAL DATE CAROUSEL STRIP */}
      {isMobile && viewMode !== "agenda" && (
        <div className="relative z-20 shrink-0 border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-2 py-2 shadow-xs">
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
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : today
                      ? "bg-indigo-50 border border-indigo-200 text-indigo-700"
                      : "hover:bg-slate-100 text-slate-600 border border-transparent"
                  }`}
                >
                  <span className={`text-[10px] font-semibold tracking-wider uppercase ${active ? "text-indigo-100 font-bold" : ""}`}>
                    {DAYS_OF_WEEK[date.getDay()]}
                  </span>
                  <span
                    className={`mt-1 size-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      active
                        ? "text-white font-extrabold"
                        : today
                        ? "text-indigo-700 font-bold"
                        : "text-slate-800"
                    }`}
                  >
                    {date.getDate()}
                  </span>

                  {/* Dot indicator for scheduled tasks */}
                  {hasTask && (
                    <span className={`size-1.5 rounded-full absolute bottom-1 ${active ? "bg-white" : "bg-indigo-600"}`} />
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
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                  <ListTodo className="size-5 text-indigo-600" />
                  <span>Tasks &amp; Research Agenda</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Autonomous background research deliverables grouped by deadline
                </p>
              </div>

              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
                {tasks.length} total tasks
              </span>
            </div>

            {agendaGrouped.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="size-16 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-4">
                  <CalendarIcon className="size-8 stroke-[1.5]" />
                </div>
                <h4 className="text-base font-bold text-slate-900">No tasks scheduled yet</h4>
                <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
                  Click any hour slot on the calendar or tap the button below to schedule an autonomous AI research task.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCreateModalDate(currentDate);
                    setCreateModalHour(new Date().getHours() + 1);
                    setIsCreateOpen(true);
                  }}
                  className="mt-5 py-2 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold transition shadow-xs"
                >
                  + Schedule First Task
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {agendaGrouped.map((group) => (
                  <div key={group.dateLabel} className="space-y-3">
                    <div className="sticky top-0 z-10 flex items-center gap-2 py-1.5 bg-slate-50/95 backdrop-blur-md">
                      <span className={`text-xs font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-md ${
                        group.isToday
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          : "text-slate-600 bg-white border border-slate-200 shadow-xs"
                      }`}>
                        {group.dateLabel}
                      </span>
                      <div className="h-[1px] flex-1 bg-slate-200" />
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
                            className="group p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                          >
                            <div className="flex items-start gap-3.5 min-w-0">
                              <div className="size-11 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center shrink-0">
                                <span className="text-[11px] font-bold text-slate-800 leading-tight">{timeStr.split(" ")[0]}</span>
                                <span className="text-[9px] text-slate-500 font-semibold">{timeStr.split(" ")[1]}</span>
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  {/* Status badge */}
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                    task.status === "ready"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : task.status === "delivered"
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : task.status === "researching"
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}>
                                    {task.status === "researching" && <Loader2 className="size-2.5 animate-spin" />}
                                    {task.status === "ready" && <CheckCircle2 className="size-2.5" />}
                                    {task.status === "delivered" && <Sparkles className="size-2.5" />}
                                    <span>{task.status === "ready" ? "Ready" : task.status}</span>
                                  </span>

                                  {/* Engine badge */}
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                    isOpencode
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  }`}>
                                    {isOpencode ? <Code2 className="size-2.5" /> : <Cpu className="size-2.5" />}
                                    <span>{isOpencode ? "OpenCode" : "NVIDIA NIM"}</span>
                                  </span>

                                  {task.recurrence === "daily" && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                      <Repeat className="size-2.5" />
                                      <span>Daily</span>
                                    </span>
                                  )}
                                </div>

                                <h4 className="text-sm font-bold text-slate-900 leading-snug truncate group-hover:text-indigo-600 transition">
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
                                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                title="Delete task"
                              >
                                <Trash2 className="size-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedTask(task)}
                                className="py-1 px-3 rounded-xl bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white text-slate-700 text-xs font-semibold transition flex items-center gap-1.5"
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
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            {/* Days Header (Desktop Week / Day view) */}
            {!isMobile && (
              <div className="flex border-b border-slate-200 bg-slate-50/90 pl-12 sm:pl-16 pr-2 sm:pr-4 shrink-0">
                {displayedDays.map((date, idx) => {
                  const today = isToday(date);
                  return (
                    <div
                      key={idx}
                      className={`flex-1 py-2 sm:py-3 text-center border-l border-slate-200/60 ${
                        today ? "bg-indigo-50/30" : ""
                      }`}
                    >
                      <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {DAYS_OF_WEEK[date.getDay()]}
                      </div>
                      <div
                        className={`inline-flex items-center justify-center size-7 sm:size-8 rounded-full text-xs sm:text-sm font-bold mt-0.5 ${
                          today
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "text-slate-800"
                        }`}
                      >
                        {date.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Scrollable Hourly Timeline */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto relative flex autotask-scrollbar">
              {/* Hour Labels */}
              <div className="w-12 sm:w-16 shrink-0 border-r border-slate-200 text-right pr-2 sm:pr-3 select-none bg-slate-50/50">
                {HOURS.map((hour) => (
                  <div key={hour} className="h-16 -mt-2.5 text-[10px] sm:text-[11px] font-medium text-slate-400 font-mono">
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
                      className={`flex-1 relative border-l border-slate-100 ${
                        isCurrentDay ? "bg-indigo-50/[0.12]" : ""
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
                          <div className="size-2.5 -ml-1 rounded-full bg-rose-500 shadow-sm animate-ping absolute" />
                          <div className="size-2.5 -ml-1 rounded-full bg-rose-500 shadow-sm relative" />
                          <div className="h-[2px] w-full bg-rose-500/80" />
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
                          className="h-16 border-b border-slate-100 hover:bg-indigo-50/20 transition cursor-pointer group relative"
                        >
                          <span className="hidden group-hover:inline-block absolute top-1 left-2 text-[10px] text-indigo-600 font-semibold">
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
                          queued: "bg-amber-50/95 border-amber-200 text-amber-900 shadow-xs",
                          researching: "bg-blue-50/95 border-blue-200 text-blue-900 shadow-xs",
                          ready: "bg-emerald-50/95 border-emerald-300 text-emerald-950 shadow-xs",
                          delivered: "bg-purple-50/95 border-purple-300 text-purple-950 shadow-xs",
                          failed: "bg-rose-50/95 border-rose-200 text-rose-900 shadow-xs",
                        }[task.status];

                        return (
                          <div
                            key={task.id}
                            style={{ top: `${topOffset}px` }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTask(task);
                            }}
                            className={`absolute left-1 right-1 min-h-[54px] rounded-2xl p-2.5 border shadow-sm backdrop-blur-md cursor-pointer transition hover:scale-[1.01] hover:shadow-md hover:z-30 ${statusStyle}`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                {task.status === "researching" && <Loader2 className="size-3 animate-spin text-blue-600" />}
                                {task.status === "ready" && <CheckCircle2 className="size-3 text-emerald-600" />}
                                {task.status === "delivered" && <Sparkles className="size-3 text-purple-600" />}
                                {target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>

                              <div className="flex items-center gap-1">
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-black tracking-wider uppercase ${
                                  isOpencode
                                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                }`}>
                                  {isOpencode ? "OC" : "NV"}
                                </span>
                                {task.recurrence === "daily" && (
                                  <span title="Daily Recurring">
                                    <Repeat className="size-3 text-indigo-600" />
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-xs font-semibold line-clamp-1 leading-snug">{task.prompt}</div>

                            <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                              <span className="capitalize">{task.status === "ready" ? "Ready for delivery" : task.status}</span>
                              <span className="font-semibold underline opacity-80 hover:opacity-100">Review</span>
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
      </>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-3 py-2 flex items-center justify-between max-w-md mx-auto shadow-lg">
          {/* Calendar View */}
          <button
            type="button"
            onClick={() => setViewMode("day")}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition ${
              viewMode === "day" ? "text-indigo-600 font-bold" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <CalendarIcon className="size-5" />
            <span className="text-[10px]">Calendar</span>
          </button>

          {/* Today's Tasks View */}
          <button
            type="button"
            onClick={() => setViewMode("today-tasks")}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition relative ${
              viewMode === "today-tasks" ? "text-indigo-600 font-bold" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <div className="relative">
              <CheckSquare2 className="size-5" />
              {todayTasksCount > 0 && (
                <span className="absolute -top-1 -right-2 size-3.5 bg-indigo-600 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">
                  {todayTasksCount}
                </span>
              )}
            </div>
            <span className="text-[10px]">Today</span>
          </button>

          {/* Center Elevated FAB */}
          <button
            type="button"
            onClick={() => {
              setCreateModalDate(currentDate);
              setCreateModalHour(new Date().getHours() + 1);
              setIsCreateOpen(true);
            }}
            className="-mt-5 size-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 active:scale-95 transition"
            aria-label="New Task"
          >
            <Plus className="size-6 stroke-[2.5]" />
          </button>

          {/* Agenda View */}
          <button
            type="button"
            onClick={() => setViewMode("agenda")}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition ${
              viewMode === "agenda" ? "text-indigo-600 font-bold" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <ListTodo className="size-5" />
            <span className="text-[10px]">Agenda</span>
          </button>

          {/* Engines Settings */}
          <button
            type="button"
            onClick={() => setIsEngineMenuOpen(true)}
            className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-slate-500 hover:text-slate-900 transition"
          >
            <Sliders className="size-5" />
            <span className="text-[10px]">Engines</span>
          </button>
        </nav>
      )}

      {/* MOBILE ENGINES ACTION SHEET */}
      {isEngineMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsEngineMenuOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 border-t sm:border border-slate-200 shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />
            <h3 className="font-bold text-slate-900 text-base mb-1">AI Execution Engines</h3>
            <p className="text-xs text-slate-500 mb-4">Select an engine to manage models and API credentials</p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsEngineMenuOpen(false);
                  setIsNvidiaModalOpen(true);
                }}
                className="w-full p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-200 flex items-center justify-between transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
                    <Cpu className="size-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900">NVIDIA NIM Cloud</div>
                    <div className="text-[11px] text-slate-500">{getNvidiaModel().split("/").pop()}</div>
                  </div>
                </div>
                <ChevronRight className="size-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsEngineMenuOpen(false);
                  setIsOpencodeModalOpen(true);
                }}
                className="w-full p-3.5 rounded-2xl bg-slate-50 hover:bg-purple-50/60 border border-slate-200 hover:border-purple-200 flex items-center justify-between transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700">
                    <Code2 className="size-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900">OpenCode Engine</div>
                    <div className="text-[11px] text-slate-500">{getOpencodeModel().split("/").pop()}</div>
                  </div>
                </div>
                <ChevronRight className="size-4 text-slate-400" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsEngineMenuOpen(false)}
              className="w-full mt-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition"
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
