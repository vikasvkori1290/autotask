import { useState, useEffect, useMemo, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  Cpu,
  Boxes,
  LogOut,
  Repeat,
  CheckCircle2,
  Loader2,
  Calendar as CalendarIcon,
  ListTodo,
  Clock,
  Trash2,
  ArrowRight,
  AlertCircle,
  Smartphone,
} from "lucide-react";
import type { AutotaskUser } from "../../lib/autotask/auth";
import { signOut } from "../../lib/autotask/auth";
import { getNvidiaModel } from "../../lib/autotask/settings";
import {
  getTasks,
  deleteTask,
  startBackgroundRunner,
  type AutoTask,
} from "../../lib/autotask/scheduler";
import { TaskCreateModal } from "./TaskCreateModal";
import { TaskDetailModal } from "./TaskDetailModal";
import { NvidiaSetupModal } from "./NvidiaSetupModal";
import { PluginsPanel } from "../PluginsPanel";

interface CalendarWorkspaceProps {
  user: AutotaskUser;
  onSignOut: () => void;
}

type ViewMode = "week" | "day" | "agenda";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarWorkspace({ user, onSignOut }: CalendarWorkspaceProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  // Default to day view on mobile screens (< 768px), week view on desktop
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return "day";
    }
    return "week";
  });
  const [tasks, setTasks] = useState<AutoTask[]>([]);
  const [isNvidiaModalOpen, setIsNvidiaModalOpen] = useState(false);
  const [isConnectorsOpen, setIsConnectorsOpen] = useState(false);

  // Task creation state
  const [createModalDate, setCreateModalDate] = useState<Date | undefined>(undefined);
  const [createModalHour, setCreateModalHour] = useState<number>(18);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Selected task detail
  const [selectedTask, setSelectedTask] = useState<AutoTask | null>(null);

  // Current time indicator position
  const [currentTime, setCurrentTime] = useState(new Date());

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to near current hour on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const currentHour = new Date().getHours();
      scrollContainerRef.current.scrollTop = Math.max(0, (currentHour - 2) * 64);
    }
  }, [viewMode]);

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
    if (viewMode === "week") {
      next.setDate(next.getDate() - 7);
    } else {
      next.setDate(next.getDate() - 1);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === "week") {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + 1);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Week days calculation
  const weekDays = useMemo(() => {
    if (viewMode === "day") {
      return [new Date(currentDate)];
    }
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
  }, [currentDate, viewMode]);

  const monthYearLabel = useMemo(() => {
    if (viewMode === "day") {
      return currentDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }
    return currentDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }, [currentDate, viewMode]);

  const openSlotCreate = (date: Date, hour: number) => {
    setCreateModalDate(date);
    setCreateModalHour(hour);
    setIsCreateOpen(true);
  };

  // Check if a given date is today
  const isToday = (d: Date) => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const currentMinutesOffset = currentTime.getHours() * 64 + (currentTime.getMinutes() / 60) * 64;

  // Sorted tasks for Agenda View
  const agendaGroups = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => a.targetTime - b.targetTime);
    const groups: { [key: string]: AutoTask[] } = {};

    for (const t of sorted) {
      const d = new Date(t.targetTime);
      const dateKey = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(t);
    }
    return groups;
  }, [tasks]);

  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans select-none">
      {/* Top Navbar */}
      <header className="h-16 px-3 sm:px-6 border-b border-neutral-800/80 bg-neutral-900/60 backdrop-blur-xl flex items-center justify-between shrink-0 z-20 gap-2">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="size-8 sm:size-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-neutral-950 font-bold shadow-md shadow-emerald-500/20">
              <Sparkles className="size-4 sm:size-5 stroke-[2.2]" />
            </div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-white hidden xs:inline">AutoTask</span>
          </div>

          <div className="h-4 w-px bg-neutral-800 hidden sm:block shrink-0" />

          {/* Date navigation */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={handleToday}
              className="py-1 px-2.5 sm:py-1.5 sm:px-3 rounded-lg sm:rounded-xl border border-neutral-700/80 hover:bg-neutral-800 text-[11px] sm:text-xs font-semibold text-neutral-200 transition shrink-0"
            >
              Today
            </button>

            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1 sm:p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
                aria-label="Previous"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-1 sm:p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
                aria-label="Next"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <span className="text-xs sm:text-sm font-semibold text-white truncate ml-1">{monthYearLabel}</span>
          </div>
        </div>

        {/* Center: View Switcher (Desktop & Mobile Segmented Control) */}
        <div className="flex p-0.5 sm:p-1 bg-neutral-950/80 border border-neutral-800 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("day")}
            className={`py-1 px-2.5 sm:py-1.5 sm:px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition ${
              viewMode === "day"
                ? "bg-neutral-800 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Day
          </button>
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={`py-1 px-2.5 sm:py-1.5 sm:px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition ${
              viewMode === "week"
                ? "bg-neutral-800 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => setViewMode("agenda")}
            className={`py-1 px-2.5 sm:py-1.5 sm:px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
              viewMode === "agenda"
                ? "bg-neutral-800 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <ListTodo className="size-3 hidden sm:inline" />
            <span>Agenda</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* New Task Button (Desktop) */}
          <button
            type="button"
            onClick={() => {
              setCreateModalDate(new Date());
              setCreateModalHour(new Date().getHours() + 1);
              setIsCreateOpen(true);
            }}
            className="hidden md:flex items-center gap-2 py-2 px-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-[0.98] transition"
          >
            <Plus className="size-4 stroke-[2.5]" />
            <span>New Task</span>
          </button>

          {/* Download Mobile APK Button */}
          <a
            href="/autotask.apk"
            download="AutoTask.apk"
            className="flex items-center gap-1.5 py-1.5 px-2.5 sm:py-2 sm:px-3 rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-xs font-semibold text-sky-300 transition"
            title="Download Android APK for Mobile"
          >
            <Smartphone className="size-4 text-sky-400" />
            <span className="hidden md:inline">Download APK</span>
          </a>

          {/* Connectors button */}
          <button
            type="button"
            onClick={() => setIsConnectorsOpen(true)}
            className="flex items-center gap-1.5 py-1.5 px-2.5 sm:py-2 sm:px-3 rounded-xl border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800 text-xs font-semibold text-neutral-200 transition"
            title="Connected Apps & Integrations"
          >
            <Boxes className="size-4 text-teal-400" />
            <span className="hidden lg:inline">Connectors</span>
          </button>

          {/* NVIDIA Key & Model */}
          <button
            type="button"
            onClick={() => setIsNvidiaModalOpen(true)}
            className="flex items-center gap-1.5 py-1.5 px-2.5 sm:py-2 sm:px-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-semibold text-emerald-300 transition"
            title="Configure NVIDIA NIM Model"
          >
            <Cpu className="size-4 text-emerald-400" />
            <span className="hidden xl:inline">{getNvidiaModel().split("/").pop()}</span>
          </button>

          {/* Sign Out */}
          <button
            type="button"
            onClick={() => {
              signOut();
              onSignOut();
            }}
            className="p-1.5 sm:p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-neutral-800/80 transition"
            title={`Signed in as ${user.name}. Click to Sign Out`}
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {viewMode === "agenda" ? (
        /* Agenda / Timeline Feed View (Optimized for Mobile & Overview) */
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-4xl w-full mx-auto space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800/60">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ListTodo className="size-5 text-emerald-400" />
                <span>Scheduled Briefings &amp; Tasks</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Autonomous background tasks researched ahead of deadline with live web data
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 font-semibold text-neutral-300">
              {tasks.length} total
            </span>
          </div>

          {Object.keys(agendaGroups).length === 0 ? (
            <div className="py-16 text-center border border-dashed border-neutral-800/80 rounded-3xl p-8 bg-neutral-900/20">
              <div className="size-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-4">
                <CalendarIcon className="size-7" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">No scheduled tasks yet</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-5 leading-relaxed">
                Click any time slot on the calendar or tap the button below to schedule an autonomous research briefing.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCreateModalDate(new Date());
                  setCreateModalHour(new Date().getHours() + 1);
                  setIsCreateOpen(true);
                }}
                className="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95"
              >
                <Plus className="size-4 stroke-[2.5]" />
                <span>Schedule First Task</span>
              </button>
            </div>
          ) : (
            Object.entries(agendaGroups).map(([dateLabel, groupTasks]) => (
              <div key={dateLabel} className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 pt-2">
                  <div className="size-2 rounded-full bg-emerald-400" />
                  <span>{dateLabel}</span>
                </div>

                <div className="space-y-2.5">
                  {groupTasks.map((task) => {
                    const target = new Date(task.targetTime);
                    const timeFormatted = target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                    const statusConfig = {
                      queued: {
                        badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
                        label: "Queued",
                        icon: <Clock className="size-3" />,
                      },
                      researching: {
                        badge: "bg-blue-500/10 text-blue-400 border-blue-500/30",
                        label: "Researching...",
                        icon: <Loader2 className="size-3 animate-spin" />,
                      },
                      ready: {
                        badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                        label: "Ready for Delivery",
                        icon: <CheckCircle2 className="size-3" />,
                      },
                      delivered: {
                        badge: "bg-purple-500/10 text-purple-400 border-purple-500/30",
                        label: "Delivered",
                        icon: <Sparkles className="size-3" />,
                      },
                      failed: {
                        badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
                        label: "Failed",
                        icon: <AlertCircle className="size-3" />,
                      },
                    }[task.status];

                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="group p-4 rounded-2xl border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900/80 hover:border-neutral-700 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="size-11 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[11px] font-bold text-white">{timeFormatted.split(" ")[0]}</span>
                            <span className="text-[9px] text-neutral-400 uppercase font-semibold">{timeFormatted.split(" ")[1]}</span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusConfig.badge}`}>
                                {statusConfig.icon}
                                <span>{statusConfig.label}</span>
                              </span>

                              {task.recurrence === "daily" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                  <Repeat className="size-2.5" />
                                  <span>Daily</span>
                                </span>
                              )}
                            </div>

                            <h4 className="text-sm font-semibold text-white leading-snug truncate group-hover:text-emerald-300 transition">
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
                            className="p-2 rounded-xl text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition"
                            title="Delete Task"
                          >
                            <Trash2 className="size-4" />
                          </button>

                          <button
                            type="button"
                            className="py-1.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 transition"
                          >
                            <span>{task.result ? "View Report" : "Details"}</span>
                            <ArrowRight className="size-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Calendar Grid View (Day or Week) */
        <div className="flex-1 flex flex-col min-h-0 bg-neutral-950">
          {/* Days Header */}
          <div className="flex border-b border-neutral-800/80 bg-neutral-900/40 pl-12 sm:pl-16 pr-2 sm:pr-4 shrink-0">
            {weekDays.map((date, idx) => {
              const today = isToday(date);
              return (
                <div
                  key={idx}
                  className={`flex-1 py-2 sm:py-3 text-center border-l border-neutral-800/40 ${
                    today ? "bg-emerald-500/5" : ""
                  }`}
                >
                  <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    {DAYS_OF_WEEK[date.getDay()]}
                  </div>
                  <div
                    className={`inline-flex items-center justify-center size-7 sm:size-8 rounded-full text-xs sm:text-sm font-bold mt-0.5 ${
                      today
                        ? "bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/30"
                        : "text-white"
                    }`}
                  >
                    {date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scrollable Hourly Grid */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto relative flex">
            {/* Hour Labels */}
            <div className="w-12 sm:w-16 shrink-0 border-r border-neutral-800/80 text-right pr-2 sm:pr-3 select-none">
              {HOURS.map((hour) => (
                <div key={hour} className="h-16 -mt-2.5 text-[10px] sm:text-[11px] font-medium text-neutral-500">
                  {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                </div>
              ))}
            </div>

            {/* Grid Columns */}
            <div className="flex-1 flex relative min-h-[1536px]">
              {/* Current Time Horizontal Line */}
              {weekDays.some(isToday) && (
                <div
                  style={{ top: `${currentMinutesOffset}px` }}
                  className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
                >
                  <div className="size-2 rounded-full bg-rose-500 -ml-1 shadow-sm shadow-rose-500" />
                  <div className="h-0.5 flex-1 bg-rose-500/80 shadow-sm" />
                </div>
              )}

              {/* Columns for each day */}
              {weekDays.map((date, dayIdx) => {
                const today = isToday(date);
                const dayTasks = tasks.filter((t) => {
                  const target = new Date(t.targetTime);
                  return (
                    target.getDate() === date.getDate() &&
                    target.getMonth() === date.getMonth() &&
                    target.getFullYear() === date.getFullYear()
                  );
                });

                return (
                  <div
                    key={dayIdx}
                    className={`flex-1 border-l border-neutral-800/40 relative ${
                      today ? "bg-emerald-500/[0.02]" : ""
                    }`}
                  >
                    {/* Clickable Hour Slots */}
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        onClick={() => openSlotCreate(date, hour)}
                        className="h-16 border-b border-neutral-800/30 hover:bg-emerald-500/5 transition cursor-pointer group relative"
                      >
                        <span className="hidden group-hover:inline-block absolute top-1 left-2 text-[10px] text-emerald-400/80 font-medium">
                          + Schedule task
                        </span>
                      </div>
                    ))}

                    {/* Render Tasks on this Day */}
                    {dayTasks.map((task) => {
                      const target = new Date(task.targetTime);
                      const topOffset = target.getHours() * 64 + (target.getMinutes() / 60) * 64;

                      const statusBg = {
                        queued: "bg-amber-950/70 border-amber-600/40 text-amber-200",
                        researching: "bg-blue-950/70 border-blue-500/40 text-blue-200",
                        ready: "bg-emerald-950/80 border-emerald-500/50 text-emerald-200",
                        delivered: "bg-purple-950/80 border-purple-500/50 text-purple-200",
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
                          className={`absolute left-1 right-1 min-h-[52px] rounded-xl p-2.5 border shadow-lg backdrop-blur-md cursor-pointer transition hover:scale-[1.01] hover:z-20 ${statusBg}`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                              {task.status === "researching" && <Loader2 className="size-3 animate-spin text-blue-400" />}
                              {task.status === "ready" && <CheckCircle2 className="size-3 text-emerald-400" />}
                              {task.status === "delivered" && <Sparkles className="size-3 text-purple-400" />}
                              {target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {task.recurrence === "daily" && (
                              <span title="Daily Recurring">
                                <Repeat className="size-3 text-emerald-300" />
                              </span>
                            )}
                          </div>

                          <div className="text-xs font-semibold line-clamp-1 leading-snug">{task.prompt}</div>

                          <div className="text-[10px] text-neutral-400 mt-1 flex items-center justify-between">
                            <span>{task.status === "ready" ? "Ready for delivery" : task.status}</span>
                            <span className="underline opacity-70 hover:opacity-100">View</span>
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

      {/* Floating Action Button (FAB) on Mobile Screens */}
      <button
        type="button"
        onClick={() => {
          setCreateModalDate(new Date());
          setCreateModalHour(new Date().getHours() + 1);
          setIsCreateOpen(true);
        }}
        className="fixed bottom-6 right-6 z-40 md:hidden size-14 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-neutral-950 flex items-center justify-center shadow-2xl shadow-emerald-500/40 active:scale-95 transition"
        aria-label="Schedule New Task"
      >
        <Plus className="size-6 stroke-[2.8]" />
      </button>

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

      {/* Connectors Panel Modal */}
      {isConnectorsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-4xl max-h-[92vh] bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Boxes className="size-5 text-teal-400" />
                <h3 className="font-bold text-white text-base">Connected Apps &amp; Services</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConnectorsOpen(false)}
                className="py-1 px-3 rounded-lg text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition"
              >
                Close
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <PluginsPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
