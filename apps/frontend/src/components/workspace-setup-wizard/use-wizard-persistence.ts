import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "erichpo_workspace_wizard_state";
const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

export type WizardStep = "select-installation" | "connect-slack" | "complete";

interface WizardState {
  currentStep: WizardStep;
  installationId: number | null;
  installationName: string | null;
  pendingOAuth: boolean;
  startedAt: number;
}

const defaultState: WizardState = {
  currentStep: "select-installation",
  installationId: null,
  installationName: null,
  pendingOAuth: false,
  startedAt: Date.now(),
};

export function useWizardPersistence() {
  const [state, setState] = useState<WizardState>(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as WizardState;
        // Check if expired
        if (Date.now() - parsed.startedAt < EXPIRY_MS) {
          setState(parsed);
        } else {
          // Expired, clear it
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      // Invalid stored state, ignore
    }
    setIsLoaded(true);
  }, []);

  // Persist state to localStorage whenever it changes
  const persistState = useCallback((newState: WizardState) => {
    setState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  }, []);

  const setStep = useCallback(
    (step: WizardStep) => {
      persistState({ ...state, currentStep: step });
    },
    [state, persistState],
  );

  const setInstallation = useCallback(
    (id: number, name: string) => {
      persistState({
        ...state,
        installationId: id,
        installationName: name,
      });
    },
    [state, persistState],
  );

  const setPendingOAuth = useCallback(
    (pending: boolean) => {
      persistState({ ...state, pendingOAuth: pending });
    },
    [state, persistState],
  );

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ ...defaultState, startedAt: Date.now() });
  }, []);

  const clearStorage = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    ...state,
    isLoaded,
    setStep,
    setInstallation,
    setPendingOAuth,
    reset,
    clearStorage,
  };
}
