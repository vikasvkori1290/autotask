import { useState } from "react";
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
} from "lucide-react";
import {
  AVAILABLE_OPENCODE_MODELS,
  getOpencodeApiKey,
  setOpencodeApiKey,
  getOpencodeModel,
  setOpencodeModel,
  getOpencodeEndpoint,
  setOpencodeEndpoint,
  testOpencodeKey,
  DEFAULT_OPENCODE_ENDPOINT,
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
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!isOpen) return null;

  const handleVerifyAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = apiKey.trim();

    if (!cleanKey) {
      // If left blank, allow saving for built-in/free community model
      setOpencodeApiKey("");
      setOpencodeModel(selectedModel);
      setOpencodeEndpoint(endpoint || DEFAULT_OPENCODE_ENDPOINT);
      onSaved();
      onClose();
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
      setTimeout(() => {
        onSaved();
        onClose();
      }, 700);
    } else {
      // Even if external probe failed due to CORS or local network, allow user to save anyway if they choose
      setVerifyStatus("error");
      setErrorMessage(result.error || "Verification failed. You can still save if using a custom local bridge.");
    }
  };

  const handleForceSave = () => {
    setOpencodeApiKey(apiKey.trim());
    setOpencodeModel(selectedModel);
    setOpencodeEndpoint(endpoint || DEFAULT_OPENCODE_ENDPOINT);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Code2 className="size-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>OpenCode Connector</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  AI Task Engine
                </span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Execute calendar tasks using OpenCode Zen, Go &amp; community models
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

        <form onSubmit={handleVerifyAndSave} className="space-y-5">
          {/* API Key Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-purple-400" />
                OpenCode API Key
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
              placeholder="Paste OpenCode API Key (optional for free tier)..."
              className="w-full bg-neutral-950/70 border border-neutral-800 focus:border-purple-500 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition font-mono"
            />
            <p className="text-[11px] text-neutral-400 mt-1.5">
              Leave blank to use the built-in <strong>Zen · Ox Alpha Free</strong> community tier.
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-2">
              Select OpenCode Model
            </label>
            <div className="space-y-2">
              {AVAILABLE_OPENCODE_MODELS.map((model) => {
                const isSelected = selectedModel === model.id;
                return (
                  <label
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`block p-3.5 rounded-2xl border cursor-pointer transition ${
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
                        <span className="font-semibold text-sm text-white">{model.name}</span>
                      </div>
                      <span className="text-[10.5px] px-2 py-0.5 rounded-full font-medium bg-neutral-800 border border-neutral-700 text-purple-300">
                        {model.badge}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1 pl-6 leading-relaxed">
                      {model.description}
                    </p>
                  </label>
                );
              })}
            </div>
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
              <span>OpenCode connector verified successfully! Saving...</span>
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
