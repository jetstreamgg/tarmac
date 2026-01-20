import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { Intent } from '@/lib/enums';
import {
  isModuleBlocked,
  markModuleBlocked as markBlocked,
  getBlockedIntents,
  MODULE_RESTRICTIONS
} from '@/lib/restricted-modules';
import { preloadRestrictedComponents } from '@/lib/restricted-lazy-components';

interface ModuleAvailabilityContextType {
  /** Whether the initial preload check is in progress */
  isLoading: boolean;
  /** Set of intents that are blocked (403 from WAF) */
  blockedModules: Set<Intent>;
  /** Check if a specific module is available (not blocked) */
  isModuleAvailable: (intent: Intent) => boolean;
  /** Manually mark a module as blocked (called by error boundary) */
  markModuleBlocked: (intent: Intent) => void;
  /** Re-run the preload check */
  refreshAvailability: () => Promise<void>;
}

const ModuleAvailabilityContext = createContext<ModuleAvailabilityContextType>({
  isLoading: true,
  blockedModules: new Set(),
  isModuleAvailable: () => true,
  markModuleBlocked: () => {},
  refreshAvailability: async () => {}
});

interface ModuleAvailabilityProviderProps {
  children: React.ReactNode;
  /** Skip preload check (useful for testing) */
  skipPreload?: boolean;
}

export const ModuleAvailabilityProvider: React.FC<ModuleAvailabilityProviderProps> = ({
  children,
  skipPreload = false
}) => {
  const [isLoading, setIsLoading] = useState(!skipPreload);
  const [blockedModulesState, setBlockedModulesState] = useState<Set<Intent>>(new Set());

  const updateBlockedState = useCallback(() => {
    setBlockedModulesState(new Set(getBlockedIntents()));
  }, []);

  const runPreloadCheck = useCallback(async () => {
    if (skipPreload) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Trigger dynamic imports for all restricted modules
      // This will attempt to load each chunk, and if blocked by WAF (403),
      // the error is caught by createRestrictedLazy which marks the module as blocked
      await preloadRestrictedComponents();

      // Update blocked state based on what was detected
      updateBlockedState();
    } catch (error) {
      console.error('Error during module preload check:', error);
    } finally {
      setIsLoading(false);
    }
  }, [skipPreload, updateBlockedState]);

  // Run preload on mount only
  useEffect(() => {
    if (!skipPreload) {
      runPreloadCheck();
    }
    // Intentionally run only on mount - skipPreload and runPreloadCheck are stable
  }, [skipPreload, runPreloadCheck]);

  const isModuleAvailable = useCallback(
    (intent: Intent): boolean => {
      // If module is not in restrictions, it's always available
      if (!(intent in MODULE_RESTRICTIONS)) {
        return true;
      }
      // Check both the context state and the global blocked set
      return !blockedModulesState.has(intent) && !isModuleBlocked(intent);
    },
    [blockedModulesState]
  );

  const markModuleBlockedCallback = useCallback(
    (intent: Intent) => {
      markBlocked(intent);
      updateBlockedState();
    },
    [updateBlockedState]
  );

  const value = useMemo(
    () => ({
      isLoading,
      blockedModules: blockedModulesState,
      isModuleAvailable,
      markModuleBlocked: markModuleBlockedCallback,
      refreshAvailability: runPreloadCheck
    }),
    [isLoading, blockedModulesState, isModuleAvailable, markModuleBlockedCallback, runPreloadCheck]
  );

  return <ModuleAvailabilityContext.Provider value={value}>{children}</ModuleAvailabilityContext.Provider>;
};

/**
 * Hook to access module availability information
 *
 * @example
 * ```tsx
 * const { isModuleAvailable, isLoading } = useModuleAvailability();
 *
 * // Hide tab if module is blocked
 * if (!isModuleAvailable(Intent.SAVINGS_INTENT)) {
 *   return null;
 * }
 * ```
 */
export const useModuleAvailability = () => useContext(ModuleAvailabilityContext);
