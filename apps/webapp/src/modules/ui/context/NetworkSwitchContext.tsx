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
  /**
   * The chain an in-app control (a product page's network dropdown, the
   * transaction modal's switch) asked the wallet for. The shell's network toast
   * stays quiet when the wallet lands there: the user made that change and
   * needs no telling. It only speaks for a switch the app made on the user's
   * behalf, or one made from inside the wallet (APP-547). Cleared by the toast
   * hook on the next chain change, and by the switch's error path.
   */
  pendingManualSwitchChainId: number | null;
  setPendingManualSwitchChainId: (chainId: number | null) => void;
}

const NetworkSwitchContext = createContext<NetworkSwitchContextValue | undefined>(undefined);

export function NetworkSwitchProvider({ children }: { children: ReactNode }) {
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [isAutoSwitching, setIsAutoSwitching] = useState(false);
  const [autoSwitchIntent, setAutoSwitchIntent] = useState<Intent | null>(null);
  const [pendingManualSwitchChainId, setPendingManualSwitchChainId] = useState<number | null>(null);

  return (
    <NetworkSwitchContext.Provider
      value={{
        isSwitchingNetwork,
        setIsSwitchingNetwork,
        isAutoSwitching,
        setIsAutoSwitching,
        autoSwitchIntent,
        setAutoSwitchIntent,
        pendingManualSwitchChainId,
        setPendingManualSwitchChainId
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
