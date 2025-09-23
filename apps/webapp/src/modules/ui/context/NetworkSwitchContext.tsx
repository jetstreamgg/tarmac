import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface NetworkSwitchContextValue {
  isSwitchingNetwork: boolean;
  setIsSwitchingNetwork: (isSwitching: boolean) => void;
  originNetwork: number | undefined;
  setOriginNetwork: (chainId: number | undefined) => void;
  clearOriginNetwork: () => void;
}

const NetworkSwitchContext = createContext<NetworkSwitchContextValue | undefined>(undefined);

export function NetworkSwitchProvider({ children }: { children: ReactNode }) {
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [originNetwork, setOriginNetwork] = useState<number | undefined>(undefined);

  const clearOriginNetwork = useCallback(() => {
    setOriginNetwork(undefined);
  }, []);

  return (
    <NetworkSwitchContext.Provider
      value={{
        isSwitchingNetwork,
        setIsSwitchingNetwork,
        originNetwork,
        setOriginNetwork,
        clearOriginNetwork
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
