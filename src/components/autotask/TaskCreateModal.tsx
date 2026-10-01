import { useState, type FormEvent } from "react";
import {
  X,
  Sparkles,
  Clock,
  Calendar as CalendarIcon,
  Repeat,
  ArrowRight,
} from "lucide-react";
import { addTask, type AutoTask } from "../../lib/autotask/scheduler";
import { getNvidiaModel } from "../../lib/autotask/settings";

interface TaskCreateModalProps {
  isOpen: boolean;
  initialDate?: Date;
  initialHour?: number;
  onClose: () => void;
  onCreated: (task: AutoTask) => void;
}

export function TaskCreateModal({
  isOpen,
  initialDate,
  initialHour = 18,
  onClose,
  onCreated,
}: TaskCreateModalProps) {
  const defaultDate = initialDate || new Date();
  const year = defaultDate.getFullYear();
  const month = String(defaultDate.getMonth() + 1).padStart(2, "0");
  const day = String(defaultDate.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  const defaultTimeStr = `${String(initialHour).padStart(2, "0")}:00`;

  const [prompt, setPrompt] = useState("");
  const [selectedDate, setSelectedDate] = useState(dateStr);
  const [selectedTime, setSelectedTime] = useState(defaultTimeStr);
  const [recurrence, setRecurrence] = useState<"once" | "daily">("once");

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const [hours, minutes] = selectedTime.split(":").map(Number);
    const targetDateObj = new Date(selectedDate);
    targetDateObj.setHours(hours || 0, minutes || 0, 0, 0);

    const task = addTask(
      prompt,
      targetDateObj.getTime(),
      recurrence,
      undefined,
      "nvidia",
      getNvidiaModel()
    );
    onCreated(task);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg max-h-[92vh] sm:max-h-[85vh] flex flex-col bg-white border border-slate-200 rounded-3xl shadow-2xl text-slate-900 overflow-hidden">
        {/* Header */}
        <div className="shrink-0 p-5 sm:p-6 pb-3 sm:pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Schedule Autonomous Task</h2>
              <p className="text-xs text-slate-500">Autonomous research starts immediately in background</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition active:scale-95"
            title="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 autotask-scrollbar">
            {/* Prompt field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                What is the task to be done until that time?
              </label>
              <textarea
                required
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Go through the internet and give me the summary of what happened in tech today..."
                className="w-full bg-slate-50/70 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-2xl p-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition resize-none leading-relaxed"
              />
            </div>

            {/* Date & Time Grid */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <CalendarIcon className="size-3.5 text-indigo-600" />
                  Target Date
                </label>
                <input
                  type="date"
                  required
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none transition font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Clock className="size-3.5 text-indigo-600" />
                  Ready By Time
                </label>
                <input
                  type="time"
                  required
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none transition font-medium"
                />
              </div>
            </div>

            {/* Frequency: Once vs Daily */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Repeat className="size-3.5 text-indigo-600" />
                Recurrence Frequency
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label
                  onClick={() => setRecurrence("once")}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                    recurrence === "once"
                      ? "bg-indigo-50 border-indigo-300 text-indigo-950 shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <input
                    type="radio"
                    name="freq"
                    checked={recurrence === "once"}
                    onChange={() => setRecurrence("once")}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Only for this date</div>
                    <div className="text-[10.5px] text-slate-500 mt-0.5">Executes once for this deadline</div>
                  </div>
                </label>

                <label
                  onClick={() => setRecurrence("daily")}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                    recurrence === "daily"
                      ? "bg-indigo-50 border-indigo-300 text-indigo-950 shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <input
                    type="radio"
                    name="freq"
                    checked={recurrence === "daily"}
                    onChange={() => setRecurrence("daily")}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <div>
                    <div className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                      <span>Do it daily</span>
                      <Repeat className="size-3" />
                    </div>
                    <div className="text-[10.5px] text-slate-500 mt-0.5">Auto-runs daily at this exact time</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Action buttons footer */}
          <div className="shrink-0 p-4 sm:p-5 pt-3 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition flex items-center gap-2"
            >
              <span>Schedule Task</span>
              <ArrowRight className="size-3.5 stroke-[2.5]" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
