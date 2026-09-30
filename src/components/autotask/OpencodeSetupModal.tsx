import { useState, useEffect } from "react";
import {
  Code2,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ExternalLink,
  ChevronRight,
  Server,
  Terminal,
  Cpu,
  Zap,
  Play,
} from "lucide-react";
import {
  AVAILABLE_OPENCODE_MODELS,
  getOpencodeApiKey,
  setOpencodeApiKey,
  getOpencodeModel,
  setOpencodeModel,
  getOpencodeEndpoint,
  setOpencodeEndpoint,
  getOpencodeRunner,
  setOpencodeRunner,
  checkOpencodeCliStatus,
  testOpencodeKey,
  DEFAULT_OPENCODE_ENDPOINT,
  type OpencodeRunnerMode,
} from "../../lib/autotask/settings";

interface OpencodeSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function OpencodeSetupModal({
  isOpen,
  onClose,
  onSaved,
}: OpencodeSetupModalProps) {
  const [apiKey, setApiKeyInput] = useState(() => getOpencodeApiKey());
  const [endpoint, setEndpointInput] = useState(() => getOpencodeEndpoint());
  const [selectedModel, setSelectedModel] = useState(() => getOpencodeModel());
  const [runnerMode, setRunnerMode] = useState<OpencodeRunnerMode>(() => getOpencodeRunner());

  // CLI Binary status
  const [cliStatus, setCliStatus] = useState<{
    loading: boolean;
    installed: boolean;
    version?: string;
    path?: string;
    error?: string;
  }>({ loading: true, installed: false });

  // CLI Testing status
  const [isTestingCli, setIsTestingCli] = useState(false);
  const [cliTestResult, setCliTestResult] = useState<{ ok: boolean; message?: string } | null>(null);

  // Overall verification & save status
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    checkOpencodeCliStatus()
      .then((res) => {
        if (!mounted) return;
        setCliStatus({
          loading: false,
          installed: res.installed,
          version: res.version,
          path: res.path,
          error: res.error,
        });
      })
      .catch((err) => {
        if (!mounted) return;
        setCliStatus({
          loading: false,
          installed: false,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestCli = async () => {
    setIsTestingCli(true);
    setCliTestResult(null);

    try {
      const res = await fetch("/api/autotask/opencode/cli-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel.endsWith("-free") ? selectedModel : "opencode/space-bunny-free",
          apiKey: apiKey.trim(),
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data && data.ok) {
        setCliTestResult({
          ok: true,
          message: data.output || "Local CLI binary answered successfully!",
        });
      } else {
        setCliTestResult({
          ok: false,
          message: (data && data.error) || "Local CLI execution returned an error.",
        });
      }
    } catch (err) {
      setCliTestResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsTestingCli(false);
    }
  };

  const handleVerifyAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = apiKey.trim();

    // If using Local CLI or Auto with free model, don't mandate API verification
    if (runnerMode === "cli" || !cleanKey) {
      setOpencodeApiKey(cleanKey);
      setOpencodeModel(selectedModel);
      setOpencodeEndpoint(endpoint || DEFAULT_OPENCODE_ENDPOINT);
      setOpencodeRunner(runnerMode);
      setVerifyStatus("success");
      setTimeout(() => {
        onSaved();
        onClose();
      }, 500);
      return;
    }

    setIsVerifying(true);
    setVerifyStatus("idle");
    setErrorMessage("");

    const result = await testOpencodeKey(cleanKey, endpoint || DEFAULT_OPENCODE_ENDPOINT);
    setIsVerifying(false);

    if (result.ok) {
      setVerifyStatus("success");
      setOpencodeApiKey(cleanKey);
      setOpencodeModel(selectedModel);
      setOpencodeEndpoint(endpoint || DEFAULT_OPENCODE_ENDPOINT);
      setOpencodeRunner(runnerMode);
      setTimeout(() => {
        onSaved();
        onClose();
      }, 700);
    } else {
      setVerifyStatus("error");
      setErrorMessage(result.error || "Verification failed. You can still save if using local system binary or custom bridge.");
    }
  };

  const handleForceSave = () => {
    setOpencodeApiKey(apiKey.trim());
    setOpencodeModel(selectedModel);
    setOpencodeEndpoint(endpoint || DEFAULT_OPENCODE_ENDPOINT);
    setOpencodeRunner(runnerMode);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
              <Code2 className="size-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span>OpenCode Connector</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
                  CLI &amp; API Dual Engine
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Execute calendar tasks using local system OpenCode binary or cloud API
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Local CLI Binary Status Card */}
        <div className="mb-5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-purple-100 text-purple-700 mt-0.5">
                <Terminal className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Local System Binary (CLI)</span>
                  {cliStatus.loading ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 flex items-center gap-1 font-semibold">
                      <Loader2 className="size-2.5 animate-spin" /> Detecting...
                    </span>
                  ) : cliStatus.installed ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Detected v{cliStatus.version}
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                      CLI Not Detected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  {cliStatus.installed
                    ? `Ready to execute autonomous research directly using your local OpenCode CLI (${cliStatus.path || "opencode.exe"}). Zero API cost.`
                    : "Install locally with 'npm i -g opencode-ai' to run tasks through your system binary."}
                </p>
              </div>
            </div>

            {cliStatus.installed && (
              <button
                type="button"
                onClick={handleTestCli}
                disabled={isTestingCli}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {isTestingCli ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <Play className="size-3 fill-current" />
                    <span>Test Binary</span>
                  </>
                )}
              </button>
            )}
          </div>

          {cliTestResult && (
            <div
              className={`mt-3 p-2.5 rounded-xl text-xs flex items-start gap-2 ${
                cliTestResult.ok
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {cliTestResult.ok ? (
                <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
              ) : (
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-600" />
              )}
              <div className="space-y-0.5">
                <span className="font-bold">{cliTestResult.ok ? "Test Passed:" : "Test Failed:"}</span>{" "}
                <span className="text-slate-700 font-mono text-[11px]">{cliTestResult.message}</span>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleVerifyAndSave} className="space-y-5">
          {/* Runner Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <Cpu className="size-3.5 text-purple-600" />
              <span>Execution Engine Mode</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRunnerMode("cli")}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  runnerMode === "cli"
                    ? "bg-purple-50 border-purple-300 text-purple-950 shadow-xs"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Terminal className="size-3.5 text-purple-600" />
                    <span>Local CLI</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Native system binary</p>
                </div>
                <span className="text-[9.5px] mt-2 inline-block px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold w-fit">
                  Recommended
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRunnerMode("auto")}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  runnerMode === "auto"
                    ? "bg-purple-50 border-purple-300 text-purple-950 shadow-xs"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Zap className="size-3.5 text-emerald-600" />
                    <span>Auto Detect</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">CLI with API fallback</p>
                </div>
                <span className="text-[9.5px] mt-2 inline-block px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold w-fit">
                  Flexible
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRunnerMode("api")}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  runnerMode === "api"
                    ? "bg-purple-50 border-purple-300 text-purple-950 shadow-xs"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Server className="size-3.5 text-purple-600" />
                    <span>Cloud API</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">OpenCode / Custom URL</p>
                </div>
                <span className="text-[9.5px] mt-2 inline-block px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold w-fit">
                  Remote
                </span>
              </button>
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select OpenCode Model
            </label>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {AVAILABLE_OPENCODE_MODELS.map((model) => {
                const isSelected = selectedModel === model.id;
                return (
                  <label
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`block p-3 rounded-2xl border cursor-pointer transition ${
                      isSelected
                        ? "bg-purple-50 border-purple-300 text-purple-950 shadow-xs"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="opencode_model"
                          checked={isSelected}
                          onChange={() => setSelectedModel(model.id)}
                          className="accent-purple-600"
                        />
                        <span className="font-bold text-xs text-slate-900">{model.name}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-white border border-slate-200 text-purple-700">
                        {model.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 pl-6 leading-relaxed">
                      {model.description}
                    </p>
                  </label>
                );
              })}
            </div>
          </div>

          {/* API Key Input (Optional if using local binary) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-purple-600" />
                <span>OpenCode API Key {runnerMode === "cli" && "(Optional for CLI)"}</span>
              </label>
              <a
                href="https://opencode.ai"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-purple-700 hover:text-purple-800 font-semibold flex items-center gap-1 transition"
              >
                <span>OpenCode Hub</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Paste OpenCode API Key (optional for local CLI)..."
              className="w-full bg-slate-50/70 border border-slate-200 focus:border-purple-600 focus:bg-white rounded-2xl px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition font-mono"
            />
            <p className="text-[10.5px] text-slate-500 mt-1">
              Local CLI free models (Space Bunny, Nemotron Lightning) execute immediately without any key.
            </p>
          </div>

          {/* Advanced Endpoint toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition font-semibold"
            >
              <Server className="size-3.5 text-slate-400" />
              <span>{showAdvanced ? "Hide Advanced Endpoint" : "Custom OpenCode API Endpoint"}</span>
            </button>
            {showAdvanced && (
              <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Base URL (OpenAI / OpenRouter compatible)
                </label>
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpointInput(e.target.value)}
                  placeholder="https://api.opencode.ai/v1"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-purple-600 font-mono"
                />
              </div>
            )}
          </div>

          {/* Verification Status Feedback */}
          {verifyStatus === "success" && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              <span>OpenCode settings saved successfully!</span>
            </div>
          )}

          {verifyStatus === "error" && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-rose-800 font-bold">
                <AlertCircle className="size-4 shrink-0 text-rose-600" />
                <span>Notice:</span>
              </div>
              <p className="text-slate-700 text-[11px] leading-relaxed">{errorMessage}</p>
              <button
                type="button"
                onClick={handleForceSave}
                className="mt-1 px-3 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold border border-slate-200 shadow-xs"
              >
                Save Anyway
              </button>
            </div>
          )}

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
              disabled={isVerifying}
              className="py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md shadow-slate-900/10 active:scale-[0.99] transition flex items-center gap-2 disabled:opacity-50"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <span>Save OpenCode Settings</span>
                  <ChevronRight className="size-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
