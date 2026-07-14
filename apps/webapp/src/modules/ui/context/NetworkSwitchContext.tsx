import { createContext, useContext, useState, ReactNode } from 'react';
import type { Intent } from '@/lib/enums';

interface NetworkSwitchContextValue {
  isSwitchingNetwork: boolean;
  setIsSwitchingNetwork: (isSwitching: boolean) => void;
  /** Whether the in-flight switch was triggered automatically by navigating to a mainnet-only module. */
  isAutoSwitching: boolean;
  setIsAutoSwitching: (isAutoSwitching: boolean) => void;
  /**
   * The module an in-flight auto-switch was made for, recorded by the flow
   * that triggered it (an in-place action can switch without navigating, so
   * the route intent alone can't explain the change). Consumed and cleared by
   * the shell's network toast; null when no flow recorded a reason.
   */
  autoSwitchIntent: Intent | null;
  setAutoSwitchIntent: (intent: Intent | null) => void;
}

const NetworkSwitchContext = createContext<NetworkSwitchContextValue | undefined>(undefined);

export function NetworkSwitchProvider({ children }: { children: ReactNode }) {
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [isAutoSwitching, setIsAutoSwitching] = useState(false);
  const [autoSwitchIntent, setAutoSwitchIntent] = useState<Intent | null>(null);

  return (
    <NetworkSwitchContext.Provider
      value={{
        isSwitchingNetwork,
        setIsSwitchingNetwork,
        isAutoSwitching,
        setIsAutoSwitching,
        autoSwitchIntent,
        setAutoSwitchIntent
      }}
    >
      {children}
    </NetworkSwitchContext.Provider>
  );
}

export const useNetworkSwitch = () => {
  const context = useContext(NetworkSwitchContext);
  if (!context) {
    throw new Error('useNetworkSwitch must be used within NetworkSwitchProvider');
  }
  return context;
};
