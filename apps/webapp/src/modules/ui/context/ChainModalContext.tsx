import React, { createContext, useContext, useCallback } from 'react';
import { useSwitchChain } from 'wagmi';

type ChainModalContextType = {
  handleSwitchChain: ({
    chainId,
    onSuccess,
    onSettled
  }: {
    chainId: number;
    onSuccess?: (data: any, variables: { chainId: number }) => void;
    onSettled?: () => void;
  }) => void;
  isPending: boolean;
  variables: { chainId: number } | undefined;
};

const ChainModalContext = createContext<ChainModalContextType>({
  handleSwitchChain: () => {},
  isPending: false,
  variables: undefined
});

export const ChainModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { switchChain, isPending, variables } = useSwitchChain();

  const handleSwitchChain = useCallback(
    ({
      chainId,
      onSuccess,
      onSettled
    }: {
      chainId: number;
      onSuccess?: (data: any, variables: { chainId: number }) => void;
      onSettled?: () => void;
    }) => {
      switchChain(
        { chainId },
        {
          onSuccess,
          onSettled,
          onError: error => {
            console.error('[ChainModalContext] switchChain failed:', error);
          }
        }
      );
    },
    [switchChain]
  );

  return (
    <ChainModalContext.Provider
      value={{
        handleSwitchChain,
        isPending,
        variables
      }}
    >
      {children}
    </ChainModalContext.Provider>
  );
};

export const useChainModalContext = () => useContext(ChainModalContext);
