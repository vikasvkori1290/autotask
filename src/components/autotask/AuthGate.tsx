import { useState, type FormEvent } from "react";
import { Sparkles, ArrowRight, ShieldCheck, Lock, Mail, User } from "lucide-react";
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
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const res = signUp(name, email, password);
        if (res.ok && res.user) {
          onAuthenticated(res.user);
        } else {
          setError(res.error || "Failed to create account.");
        }
      } else {
        const res = signIn(email, password);
        if (res.ok && res.user) {
          onAuthenticated(res.user);
        } else {
          setError(res.error || "Failed to sign in.");
        }
      }
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
        <div className="flex p-1 bg-neutral-950/70 border border-neutral-800/80 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
              !isSignUp ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
              isSignUp ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-neutral-200"
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
                  placeholder="Alex Mercer"
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
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 font-semibold text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition disabled:opacity-50"
          >
            <span>{isSignUp ? "Create Local Account" : "Sign In to Calendar"}</span>
            <ArrowRight className="size-4 stroke-[2.5]" />
          </button>
        </form>

        {/* Security assurance */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-neutral-500">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          <span>Local-first authentication stored safely on your machine</span>
        </div>
      </div>
    </div>
  );
}
