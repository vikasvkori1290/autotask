import { useState, useEffect, type FormEvent } from "react";
import { Sparkles, ArrowRight, ShieldCheck, Lock, Mail, User, Database, AlertCircle, Loader2 } from "lucide-react";
import { signIn, signUp, type AutotaskUser } from "../../lib/autotask/auth";

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

  useEffect(() => {
    fetch("/api/autotask/db-status")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setDbStatus({ connected: Boolean(data.connected), mode: data.mode });
        }
      })
      .catch(() => {});
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
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-neutral-100 p-4">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-md bg-neutral-900/80 backdrop-blur-2xl border border-neutral-800 rounded-3xl p-8 shadow-2xl shadow-black/60">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="size-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/25 mb-4">
            <Sparkles className="size-7 text-neutral-950 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">AutoTask</h1>
          <p className="text-sm text-neutral-400 mt-1.5">
            Autonomous calendar intelligence powered by NVIDIA
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-neutral-950/80 border border-neutral-800 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setError(null);
              setErrorCode(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
              !isSignUp
                ? "bg-neutral-800 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
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
                ? "bg-neutral-800 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vikas"
                  className="w-full bg-neutral-950/50 border border-neutral-800 focus:border-emerald-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-neutral-600 outline-none transition"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full bg-neutral-950/50 border border-neutral-800 focus:border-emerald-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-neutral-600 outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-neutral-950/50 border border-neutral-800 focus:border-emerald-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-neutral-600 outline-none transition"
              />
            </div>
          </div>

          {error && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 leading-snug">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>

              {/* Actionable redirection helper buttons */}
              {errorCode === "USER_NOT_FOUND" && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setError(null);
                    setErrorCode(null);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
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
                  className="w-full py-2 px-3 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
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
            className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 font-semibold text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? "Create Account & Connect" : "Sign In to Calendar"}</span>
                <ArrowRight className="size-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        {/* Database & Security assurance footer */}
        <div className="mt-6 pt-4 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            <span>Secure Persistent Session</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Database className="size-3 text-emerald-400" />
            <span>{dbStatus?.connected ? "MongoDB Online" : "MongoDB / Local DB"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
