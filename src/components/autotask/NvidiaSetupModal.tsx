import { useState, type FormEvent } from "react";
import { KeyRound, Sparkles, CheckCircle2, ExternalLink, Cpu, AlertCircle, Loader2 } from "lucide-react";
import {
  AVAILABLE_NVIDIA_MODELS,
  getNvidiaApiKey,
  getNvidiaModel,
  setNvidiaApiKey,
  setNvidiaModel,
  testNvidiaKey,
} from "../../lib/autotask/settings";

interface NvidiaSetupModalProps {
  isOpen: boolean;
  onSaved: () => void;
  canClose?: boolean;
  onClose?: () => void;
}

export function NvidiaSetupModal({ isOpen, onSaved, canClose = false, onClose }: NvidiaSetupModalProps) {
  const [apiKey, setKey] = useState(getNvidiaApiKey());
  const [selectedModel, setModel] = useState(getNvidiaModel());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setTestResult({ ok: false, msg: "Please enter your NVIDIA API key first." });
      return;
    }
    setTesting(true);
    setTestResult(null);

    const res = await testNvidiaKey(apiKey);
    setTesting(false);
    if (res.ok) {
      setTestResult({ ok: true, msg: "Connection verified! NVIDIA NIM API key is valid." });
    } else {
      setTestResult({ ok: false, msg: res.error || "Verification failed. Check your key." });
    }
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setTestResult({ ok: false, msg: "An API key is required to power autonomous tasks." });
      return;
    }
    setNvidiaApiKey(apiKey);
    setNvidiaModel(selectedModel);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-900">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="size-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <Cpu className="size-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">NVIDIA NIM Configuration</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Connect your NVIDIA API key to power autonomous research and scheduled task summaries.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Key input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-emerald-600" />
                NVIDIA API Key
              </label>
              <a
                href="https://build.nvidia.com"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 transition"
              >
                <span>Get free key at build.nvidia.com</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
            <input
              type="password"
              required
              value={apiKey}
              onChange={(e) => {
                setKey(e.target.value);
                setTestResult(null);
              }}
              placeholder="nvapi-..."
              className="w-full bg-slate-50/70 border border-slate-200 focus:border-emerald-600 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition font-mono"
            />
          </div>

          {/* Model selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select Execution Engine
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {AVAILABLE_NVIDIA_MODELS.map((model) => (
                <label
                  key={model.id}
                  onClick={() => setModel(model.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    selectedModel === model.id
                      ? "bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    checked={selectedModel === model.id}
                    onChange={() => setModel(model.id)}
                    className="mt-1 accent-emerald-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{model.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                        {model.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{model.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Status feedback */}
          {testResult && (
            <div
              className={`flex items-start gap-2 p-3 rounded-xl text-xs border ${
                testResult.ok
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="size-4 shrink-0 text-rose-600 mt-0.5" />
              )}
              <span className="leading-snug">{testResult.msg}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestKey}
              disabled={testing}
              className="py-2.5 px-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs flex items-center gap-2 transition disabled:opacity-50"
            >
              {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-emerald-600" />}
              <span>Test Connection</span>
            </button>

            <div className="flex-1" />

            {canClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl bg-transparent hover:bg-slate-100 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              className="py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md shadow-slate-900/10 active:scale-[0.99] transition"
            >
              Save &amp; Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
