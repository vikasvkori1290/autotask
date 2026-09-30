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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Code2 className="size-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>OpenCode Connector</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  CLI &amp; API Dual Engine
                </span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Execute calendar tasks using local system OpenCode binary or cloud API
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Local CLI Binary Status Card */}
        <div className="mb-5 p-4 rounded-2xl bg-neutral-950/60 border border-purple-500/20">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 mt-0.5">
                <Terminal className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Local System Binary (CLI)</span>
                  {cliStatus.loading ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 flex items-center gap-1">
                      <Loader2 className="size-2.5 animate-spin" /> Detecting...
                    </span>
                  ) : cliStatus.installed ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Detected v{cliStatus.version}
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                      CLI Not Detected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                  {cliStatus.installed
                    ? `Ready to execute autonomous research directly using your local OpenCode CLI (${cliStatus.path || "opencode.exe"}). Zero external API costs.`
                    : "Install locally with 'npm i -g opencode-ai' to run tasks through your system binary."}
                </p>
              </div>
            </div>

            {cliStatus.installed && (
              <button
                type="button"
                onClick={handleTestCli}
                disabled={isTestingCli}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-50"
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
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-300 border border-rose-500/20"
              }`}
            >
              {cliTestResult.ok ? (
                <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-400" />
              )}
              <div className="space-y-0.5">
                <span className="font-semibold">{cliTestResult.ok ? "Test Passed:" : "Test Failed:"}</span>{" "}
                <span className="text-neutral-300">{cliTestResult.message}</span>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleVerifyAndSave} className="space-y-5">
          {/* Runner Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-2 flex items-center gap-1.5">
              <Cpu className="size-3.5 text-purple-400" />
              <span>Execution Engine Mode</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRunnerMode("cli")}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  runnerMode === "cli"
                    ? "bg-purple-500/15 border-purple-500/60 shadow-sm"
                    : "bg-neutral-950/40 border-neutral-800 hover:bg-neutral-800/40"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Terminal className="size-3.5 text-purple-400" />
                    <span>Local CLI</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-1">Native system binary</p>
                </div>
                <span className="text-[9.5px] mt-2 inline-block px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold w-fit">
                  Recommended
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRunnerMode("auto")}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  runnerMode === "auto"
                    ? "bg-purple-500/15 border-purple-500/60 shadow-sm"
                    : "bg-neutral-950/40 border-neutral-800 hover:bg-neutral-800/40"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Zap className="size-3.5 text-emerald-400" />
                    <span>Auto Detect</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-1">CLI with API fallback</p>
                </div>
                <span className="text-[9.5px] mt-2 inline-block px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-semibold w-fit">
                  Flexible
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRunnerMode("api")}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  runnerMode === "api"
                    ? "bg-purple-500/15 border-purple-500/60 shadow-sm"
                    : "bg-neutral-950/40 border-neutral-800 hover:bg-neutral-800/40"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Server className="size-3.5 text-purple-400" />
                    <span>Cloud API</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-1">OpenCode / Custom proxy</p>
                </div>
                <span className="text-[9.5px] mt-2 inline-block px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-semibold w-fit">
                  Remote
                </span>
              </button>
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-2">
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
                        ? "bg-purple-500/10 border-purple-500/50 shadow-sm"
                        : "bg-neutral-950/40 border-neutral-800/80 hover:bg-neutral-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="opencode_model"
                          checked={isSelected}
                          onChange={() => setSelectedModel(model.id)}
                          className="accent-purple-500"
                        />
                        <span className="font-semibold text-xs text-white">{model.name}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-neutral-800 border border-neutral-700 text-purple-300">
                        {model.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1 pl-6 leading-relaxed">
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
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-purple-400" />
                <span>OpenCode API Key {runnerMode === "cli" && "(Optional for CLI)"}</span>
              </label>
              <a
                href="https://opencode.ai"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition"
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
              className="w-full bg-neutral-950/70 border border-neutral-800 focus:border-purple-500 rounded-2xl px-4 py-2.5 text-xs text-white placeholder:text-neutral-600 outline-none transition font-mono"
            />
            <p className="text-[10.5px] text-neutral-400 mt-1">
              Local CLI free models (Space Bunny, Nemotron Lightning) execute immediately without any key.
            </p>
          </div>

          {/* Advanced Endpoint toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1.5 transition"
            >
              <Server className="size-3.5 text-neutral-500" />
              <span>{showAdvanced ? "Hide Advanced Endpoint" : "Custom OpenCode API Endpoint"}</span>
            </button>
            {showAdvanced && (
              <div className="mt-2 p-3 bg-neutral-950/60 rounded-xl border border-neutral-800">
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Base URL (OpenAI / OpenRouter compatible)
                </label>
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpointInput(e.target.value)}
                  placeholder="https://api.opencode.ai/v1"
                  className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500 font-mono"
                />
              </div>
            )}
          </div>

          {/* Verification Status Feedback */}
          {verifyStatus === "success" && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2.5 text-emerald-400 text-xs">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>OpenCode settings saved successfully!</span>
            </div>
          )}

          {verifyStatus === "error" && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertCircle className="size-4 shrink-0" />
                <span className="font-semibold">Notice:</span>
              </div>
              <p className="text-neutral-300 text-[11px] leading-relaxed">{errorMessage}</p>
              <button
                type="button"
                onClick={handleForceSave}
                className="mt-1 px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] border border-neutral-700"
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
              className="py-2.5 px-4 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isVerifying}
              className="py-2.5 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/20 active:scale-[0.99] transition flex items-center gap-2 disabled:opacity-50"
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
