import { useState, useEffect, type FormEvent } from "react";
import { Sparkles, ArrowRight, ShieldCheck, Lock, Mail, User, AlertCircle, Loader2, Globe, Settings, CheckCircle2 } from "lucide-react";
import { signIn, signUp, type AutotaskUser } from "../../lib/autotask/auth";
import { autotaskFetch, getApiBaseUrl, setApiBaseUrl, isMobileApp, DEFAULT_PRODUCTION_BACKEND } from "../../lib/autotask/api";

interface AuthGateProps {
  onAuthenticated: (user: AutotaskUser) => void;
}

export function AuthGate({ onAuthenticated }: AuthGateProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; mode: string } | null>(null);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(getApiBaseUrl() || DEFAULT_PRODUCTION_BACKEND);
  const [testingServer, setTestingServer] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const checkServer = async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await autotaskFetch("/api/autotask/db-status");
      if (res.ok) {
        const data = await res.json();
        setServerOnline(true);
        if (data.ok) {
          setDbStatus({ connected: Boolean(data.connected), mode: data.mode });
        }
        return { ok: true };
      }
      setServerOnline(false);
      return { ok: false, error: `Server returned HTTP ${res.status}` };
    } catch (err) {
      setServerOnline(false);
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  };

  useEffect(() => {
    void checkServer();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const res = await signUp(name, email, password);
        if (res.ok && res.user) {
          onAuthenticated(res.user);
        } else {
          setError(res.error || "Failed to create account.");
          setErrorCode(res.code || null);
        }
      } else {
        const res = await signIn(email, password);
        if (res.ok && res.user) {
          onAuthenticated(res.user);
        } else {
          setError(res.error || "Failed to sign in.");
          setErrorCode(res.code || null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 text-slate-900 p-4 relative overflow-hidden">
      {/* Background subtle professional gradient shapes */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[300px] bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-8 shadow-xl shadow-slate-200/60">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="size-13 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-3.5">
            <Sparkles className="size-6 text-white stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">AutoTask</h1>
          <p className="text-xs text-slate-500 mt-1">
            Autonomous calendar intelligence &amp; research briefings
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-100 border border-slate-200/80 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setError(null);
              setErrorCode(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
              !isSignUp
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setError(null);
              setErrorCode(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
              isSignUp
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex"
                  className="w-full bg-slate-50/70 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full bg-slate-50/70 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50/70 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition"
              />
            </div>
          </div>

          {error && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 leading-snug">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{error}</span>
              </div>

              {errorCode === "USER_NOT_FOUND" && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setError(null);
                    setErrorCode(null);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <span>Click here to Sign Up with {email}</span>
                  <ArrowRight className="size-3.5" />
                </button>
              )}

              {errorCode === "USER_EXISTS" && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setError(null);
                    setErrorCode(null);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <span>Click here to Sign In instead</span>
                  <ArrowRight className="size-3.5" />
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-md shadow-slate-900/10 active:scale-[0.99] transition disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? "Create Account & Get Started" : "Sign In to Calendar"}</span>
                <ArrowRight className="size-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        {/* Database & Security assurance footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              <span>Secure Session</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowServerConfig(!showServerConfig);
                setServerMessage(null);
              }}
              className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 transition"
              title="Configure backend server URL"
            >
              <span className={`inline-block size-2 rounded-full ${serverOnline === true ? "bg-emerald-500" : serverOnline === false ? "bg-rose-500" : "bg-amber-400"}`} />
              <span className="font-medium">
                {serverOnline === true ? (dbStatus?.connected ? "MongoDB Sync" : "Server Online") : "Server Offline"}
              </span>
              <Settings className="size-3" />
            </button>
          </div>

          {/* Collapsible Server Configuration for Mobile APK & Custom Backends */}
          {showServerConfig && (
            <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl text-xs space-y-2">
              <div className="flex items-center justify-between font-semibold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Globe className="size-3.5 text-indigo-600" />
                  Backend Server URL
                </span>
                {isMobileApp() && (
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                    Mobile APK
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Connect your mobile app to your PC or deployed cloud server:
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={customServerUrl}
                  onChange={(e) => setCustomServerUrl(e.target.value)}
                  placeholder="e.g. http://192.168.0.101:5199 or https://..."
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  disabled={testingServer}
                  onClick={async () => {
                    setTestingServer(true);
                    setServerMessage(null);
                    setApiBaseUrl(customServerUrl);
                    const res = await checkServer();
                    setTestingServer(false);
                    if (res.ok) {
                      setServerMessage("Successfully connected to server & MongoDB!");
                    } else {
                      setServerMessage(res.error || "Could not connect to server.");
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-medium text-xs hover:bg-indigo-700 transition disabled:opacity-50 shrink-0"
                >
                  {testingServer ? <Loader2 className="size-3 animate-spin" /> : "Save & Test"}
                </button>
              </div>

              {serverMessage && (
                <p className={`text-[11px] font-medium flex items-center gap-1 ${serverOnline ? "text-emerald-600" : "text-rose-600"}`}>
                  {serverOnline ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
                  {serverMessage}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
