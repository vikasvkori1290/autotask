import { useState, useEffect } from "react";
import { getCurrentUser, restoreSession, type AutotaskUser } from "../../lib/autotask/auth";
import { getNvidiaApiKey, syncSettingsFromServer } from "../../lib/autotask/settings";
import { AuthGate } from "./AuthGate";
import { NvidiaSetupModal } from "./NvidiaSetupModal";
import { CalendarWorkspace } from "./CalendarWorkspace";
import { Loader2 } from "lucide-react";

export function AutotaskRoot() {
  const [currentUser, setCurrentUser] = useState<AutotaskUser | null>(() => getCurrentUser());
  const [hasNvidiaKey, setHasNvidiaKey] = useState<boolean>(() => Boolean(getNvidiaApiKey()));
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const user = await restoreSession();
        if (!mounted) return;
        setCurrentUser(user);

        if (user) {
          // Sync cloud settings from MongoDB
          await syncSettingsFromServer();
          if (!mounted) return;
          setHasNvidiaKey(Boolean(getNvidiaApiKey()));
        }
      } finally {
        if (mounted) {
          setIsInitializing(false);
        }
      }
    }

    void init();

    return () => {
      mounted = false;
    };
  }, []);

  const handleAuthenticated = async (user: AutotaskUser) => {
    setCurrentUser(user);
    // Sync settings in case another device saved them
    await syncSettingsFromServer();
    setHasNvidiaKey(Boolean(getNvidiaApiKey()));
  };

  // Initial session & settings loading state
  if (isInitializing) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-800 gap-3">
        <Loader2 className="size-8 text-indigo-600 animate-spin" />
        <span className="text-xs font-semibold text-slate-500">Loading your workspace...</span>
      </div>
    );
  }

  // 1. Authentication flow
  if (!currentUser) {
    return <AuthGate onAuthenticated={handleAuthenticated} />;
  }

  // 2. NVIDIA API Key onboarding gate (only shown if no key is saved in MongoDB for this account)
  if (!hasNvidiaKey) {
    return (
      <NvidiaSetupModal
        isOpen={true}
        canClose={false}
        onSaved={() => setHasNvidiaKey(true)}
      />
    );
  }

  // 3. Main Calendar & Connectors Workspace
  return (
    <CalendarWorkspace
      user={currentUser}
      onSignOut={() => {
        setCurrentUser(null);
      }}
    />
  );
}
