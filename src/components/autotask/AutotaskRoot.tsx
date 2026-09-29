import { useState, useEffect } from "react";
import { StoreProvider } from "@/state/store";
import { getCurrentUser, type AutotaskUser } from "../../lib/autotask/auth";
import { getNvidiaApiKey } from "../../lib/autotask/settings";
import { AuthGate } from "./AuthGate";
import { NvidiaSetupModal } from "./NvidiaSetupModal";
import { CalendarWorkspace } from "./CalendarWorkspace";

export function AutotaskRoot() {
  const [currentUser, setCurrentUser] = useState<AutotaskUser | null>(() => getCurrentUser());
  const [hasNvidiaKey, setHasNvidiaKey] = useState<boolean>(() => Boolean(getNvidiaApiKey()));

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    setHasNvidiaKey(Boolean(getNvidiaApiKey()));
  }, []);

  // 1. Authentication flow
  if (!currentUser) {
    return <AuthGate onAuthenticated={(user) => setCurrentUser(user)} />;
  }

  // 2. NVIDIA API Key onboarding gate
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
    <StoreProvider>
      <CalendarWorkspace
        user={currentUser}
        onSignOut={() => {
          setCurrentUser(null);
        }}
      />
    </StoreProvider>
  );
}
