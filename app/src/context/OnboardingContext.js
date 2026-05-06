import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';

/**
 * Step machine for the first-run guided tour. Steps are linear; user
 * actions advance them. State is persisted per user so a refresh or
 * navigating between launcher and editor doesn't lose place.
 */
export const STEPS = {
  WELCOME: 'welcome',
  CLICK_CREATE: 'click_create',
  FILL_NAME: 'fill_name',
  EDITOR_PROMPT: 'editor_prompt',
  EDITOR_GENERATE: 'editor_generate',
  EDITOR_VOICE: 'editor_voice',
  DONE: 'done',
};

const ORDER = [
  STEPS.WELCOME,
  STEPS.CLICK_CREATE,
  STEPS.FILL_NAME,
  STEPS.EDITOR_PROMPT,
  STEPS.EDITOR_GENERATE,
  STEPS.EDITOR_VOICE,
  STEPS.DONE,
];

const storageKey = (userId) => `cocreate_onboarding_v1_${userId || 'anon'}`;

const OnboardingContext = createContext(null);

export const OnboardingProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id || null;

  const [step, setStepState] = useState(STEPS.DONE);

  // Load state when the user changes.
  useEffect(() => {
    if (!userId) {
      setStepState(STEPS.DONE);
      return;
    }
    // Onboarding is temporarily disabled — default everyone to DONE so the
    // guided tour doesn't show. Code retained for re-enabling later.
    try {
      localStorage.setItem(storageKey(userId), STEPS.DONE);
    } catch {
      /* ignore quota */
    }
    setStepState(STEPS.DONE);
  }, [userId]);

  const persist = useCallback(
    (next) => {
      setStepState(next);
      if (userId) {
        try {
          localStorage.setItem(storageKey(userId), next);
        } catch {
          /* ignore quota */
        }
      }
    },
    [userId],
  );

  const setStep = useCallback(
    (next) => {
      if (!ORDER.includes(next)) return;
      persist(next);
    },
    [persist],
  );

  const advanceFrom = useCallback(
    (current) => {
      // Only advance if we're actually on the expected step. This prevents
      // out-of-order user actions (e.g. clicking generate before the prompt
      // step) from skipping ahead.
      setStepState((prev) => {
        if (prev !== current) return prev;
        const idx = ORDER.indexOf(current);
        const next = ORDER[idx + 1] || STEPS.DONE;
        if (userId) {
          try {
            localStorage.setItem(storageKey(userId), next);
          } catch {
            /* ignore */
          }
        }
        return next;
      });
    },
    [userId],
  );

  const skip = useCallback(() => persist(STEPS.DONE), [persist]);
  const reset = useCallback(() => persist(STEPS.WELCOME), [persist]);

  const value = useMemo(
    () => ({
      step,
      isActive: step !== STEPS.DONE,
      setStep,
      advanceFrom,
      skip,
      reset,
    }),
    [step, setStep, advanceFrom, skip, reset],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    // Outside a provider (shouldn't happen in practice) — return a no-op.
    return {
      step: STEPS.DONE,
      isActive: false,
      setStep: () => {},
      advanceFrom: () => {},
      skip: () => {},
      reset: () => {},
    };
  }
  return ctx;
};
