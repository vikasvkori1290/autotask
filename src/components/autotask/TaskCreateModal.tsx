import { useState, type FormEvent } from "react";
import {
  X,
  Sparkles,
  Clock,
  Calendar as CalendarIcon,
  Repeat,
  Globe,
  ArrowRight,
  Cpu,
  Code2,
} from "lucide-react";
import { addTask, type AutoTask } from "../../lib/autotask/scheduler";
import {
  getNvidiaModel,
  getOpencodeModel,
  AVAILABLE_NVIDIA_MODELS,
  AVAILABLE_OPENCODE_MODELS,
} from "../../lib/autotask/settings";

interface TaskCreateModalProps {
  isOpen: boolean;
  initialDate?: Date;
  initialHour?: number;
  onClose: () => void;
  onCreated: (task: AutoTask) => void;
}

const QUICK_PROMPTS = [
  "Go through the internet and give me the summary of what happened in tech today",
  "Summarize key breakthroughs and news in artificial intelligence and robotics today",
  "Give me an executive briefing on global financial markets and economic headlines",
  "Search for trending open-source AI projects and developer tools released today",
];

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
  const [searchEnabled, setSearchEnabled] = useState(true);

  // Engine selection: NVIDIA NIM vs OpenCode
  const [engine, setEngine] = useState<"nvidia" | "opencode">("nvidia");
  const [selectedModel, setSelectedModel] = useState<string>(() => getNvidiaModel());

  if (!isOpen) return null;

  const handleEngineChange = (nextEngine: "nvidia" | "opencode") => {
    setEngine(nextEngine);
    if (nextEngine === "opencode") {
      setSelectedModel(getOpencodeModel());
    } else {
      setSelectedModel(getNvidiaModel());
    }
  };

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
      engine,
      selectedModel
    );
    onCreated(task);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-2xl text-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Prompt field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              What is the task to be done until that time?
            </label>
            <textarea
              required
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Go through the internet and give me the summary about tech happened today..."
              className="w-full bg-slate-50/70 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-2xl p-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition resize-none"
            />
          </div>

          {/* Quick suggestions */}
          <div>
            <div className="text-[11px] font-semibold text-slate-500 mb-1.5">Quick Suggestions:</div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(q)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition text-left"
                >
                  {q.slice(0, 38)}...
                </button>
              ))}
            </div>
          </div>

          {/* AI Execution Engine Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Execute Task Using Engine:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label
                onClick={() => handleEngineChange("nvidia")}
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                  engine === "nvidia"
                    ? "bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <input
                  type="radio"
                  name="engine"
                  checked={engine === "nvidia"}
                  onChange={() => handleEngineChange("nvidia")}
                  className="mt-0.5 accent-emerald-600"
                />
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5 text-emerald-700">
                    <Cpu className="size-3.5" />
                    <span>NVIDIA NIM</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Nemotron 70B &amp; Mistral</div>
                </div>
              </label>

              <label
                onClick={() => handleEngineChange("opencode")}
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                  engine === "opencode"
                    ? "bg-purple-50 border-purple-300 text-purple-950 shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <input
                  type="radio"
                  name="engine"
                  checked={engine === "opencode"}
                  onChange={() => handleEngineChange("opencode")}
                  className="mt-0.5 accent-purple-600"
                />
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5 text-purple-700">
                    <Code2 className="size-3.5" />
                    <span>OpenCode</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Local CLI &amp; Cloud Models</div>
                </div>
              </label>
            </div>

            {/* Model select dropdown */}
            <div className="mt-2">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600 font-medium"
              >
                {engine === "nvidia"
                  ? AVAILABLE_NVIDIA_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.badge})
                      </option>
                    ))
                  : AVAILABLE_OPENCODE_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.badge})
                      </option>
                    ))}
              </select>
            </div>
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

          {/* Web search toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-indigo-600" />
              <div>
                <div className="text-xs font-bold text-slate-900">Live Web Search</div>
                <div className="text-[10.5px] text-slate-500">Searches DuckDuckGo for real-time news &amp; sources</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={searchEnabled}
              onChange={(e) => setSearchEnabled(e.target.checked)}
              className="size-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 active:scale-[0.99] transition flex items-center gap-2"
            >
              <span>Schedule &amp; Start Research</span>
              <ArrowRight className="size-3.5 stroke-[2.5]" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
