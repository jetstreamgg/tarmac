import { createContext, useContext, useState, ReactNode } from 'react';

interface NetworkSwitchContextValue {
  isSwitchingNetwork: boolean;
  setIsSwitchingNetwork: (isSwitching: boolean) => void;
  /** Whether the in-flight switch was triggered automatically by navigating to a mainnet-only module. */
  isAutoSwitching: boolean;
  setIsAutoSwitching: (isAutoSwitching: boolean) => void;
}

const NetworkSwitchContext = createContext<NetworkSwitchContextValue | undefined>(undefined);

export function NetworkSwitchProvider({ children }: { children: ReactNode }) {
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [isAutoSwitching, setIsAutoSwitching] = useState(false);

  return (
    <NetworkSwitchContext.Provider
      value={{
        isSwitchingNetwork,
        setIsSwitchingNetwork,
        isAutoSwitching,
        setIsAutoSwitching
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
