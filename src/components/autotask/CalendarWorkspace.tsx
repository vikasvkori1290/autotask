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

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarWorkspace({ user, onSignOut }: CalendarWorkspaceProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "day">("week");
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
  }, []);

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
    return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [currentDate]);

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

  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans select-none">
      {/* Top Navbar */}
      <header className="h-16 px-6 border-b border-neutral-800/80 bg-neutral-900/60 backdrop-blur-xl flex items-center justify-between shrink-0 z-20">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-neutral-950 font-bold shadow-md shadow-emerald-500/20">
              <Sparkles className="size-5 stroke-[2.2]" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">AutoTask</span>
          </div>

          <div className="h-5 w-px bg-neutral-800" />

          {/* Date controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToday}
              className="py-1.5 px-3 rounded-xl border border-neutral-700/80 hover:bg-neutral-800 text-xs font-semibold text-neutral-200 transition"
            >
              Today
            </button>

            <div className="flex items-center">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <span className="text-sm font-semibold text-white ml-2">{monthYearLabel}</span>
          </div>
        </div>

        {/* Center: View Switcher */}
        <div className="hidden md:flex p-1 bg-neutral-950/80 border border-neutral-800 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={`py-1.5 px-4 text-xs font-semibold rounded-lg transition ${
              viewMode === "week"
                ? "bg-neutral-800 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => setViewMode("day")}
            className={`py-1.5 px-4 text-xs font-semibold rounded-lg transition ${
              viewMode === "day"
                ? "bg-neutral-800 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Day
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* New Task Button */}
          <button
            type="button"
            onClick={() => {
              setCreateModalDate(new Date());
              setCreateModalHour(new Date().getHours() + 1);
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-2 py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-[0.98] transition"
          >
            <Plus className="size-4 stroke-[2.5]" />
            <span>New Task</span>
          </button>

          {/* Connectors button */}
          <button
            type="button"
            onClick={() => setIsConnectorsOpen(true)}
            className="flex items-center gap-2 py-2 px-3 rounded-xl border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800 text-xs font-semibold text-neutral-200 transition"
            title="Connected Apps & Integrations"
          >
            <Boxes className="size-4 text-teal-400" />
            <span className="hidden sm:inline">Connectors</span>
          </button>

          {/* NVIDIA Key Indicator */}
          <button
            type="button"
            onClick={() => setIsNvidiaModalOpen(true)}
            className="flex items-center gap-2 py-2 px-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-semibold text-emerald-300 transition"
            title="Configure NVIDIA NIM Model & Key"
          >
            <Cpu className="size-4 text-emerald-400" />
            <span className="hidden lg:inline">{getNvidiaModel().split("/").pop()}</span>
          </button>

          {/* User & Sign Out */}
          <div className="flex items-center gap-2 pl-2 border-l border-neutral-800">
            <span className="text-xs font-medium text-neutral-400 hidden sm:inline">{user.name}</span>
            <button
              type="button"
              onClick={() => {
                signOut();
                onSignOut();
              }}
              className="p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-neutral-800/80 transition"
              title="Sign Out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Calendar Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-neutral-950">
        {/* Days Header */}
        <div className="flex border-b border-neutral-800/80 bg-neutral-900/40 pl-16 pr-4 shrink-0">
          {weekDays.map((date, idx) => {
            const today = isToday(date);
            return (
              <div
                key={idx}
                className={`flex-1 py-3 text-center border-l border-neutral-800/40 ${
                  today ? "bg-emerald-500/5" : ""
                }`}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  {DAYS_OF_WEEK[date.getDay()]}
                </div>
                <div
                  className={`inline-flex items-center justify-center size-8 rounded-full text-sm font-bold mt-0.5 ${
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
          <div className="w-16 shrink-0 border-r border-neutral-800/80 text-right pr-3 select-none">
            {HOURS.map((hour) => (
              <div key={hour} className="h-16 -mt-2.5 text-[11px] font-medium text-neutral-500">
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
              // Filter tasks that target this date
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
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
            <div className="p-6 overflow-y-auto flex-1">
              <PluginsPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
