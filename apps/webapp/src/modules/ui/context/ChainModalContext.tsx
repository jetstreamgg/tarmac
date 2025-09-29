import React, { createContext, useContext, useCallback } from 'react';
import { useSwitchChain, useAccount, useChains } from 'wagmi';
import { toast } from '@/components/ui/use-toast';

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
  const { connector } = useAccount();
  const chains = useChains();

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

            // Get chain name from the chainId
            const targetChain = chains.find(chain => chain.id === chainId);
            const chainName = targetChain?.name || `chain ID ${chainId}`;
            const walletName = connector?.name || 'Your wallet';

            // Check if it's specifically an unsupported chain error
            const errorMessage = error.message || '';
            const isUnsupportedChain =
              errorMessage.includes('does not support the requested chain') ||
              errorMessage.includes('UnsupportedChainIdError') ||
              errorMessage.includes('Unsupported chain');

            if (isUnsupportedChain) {
              toast({
                title: 'Chain not supported',
                description: `${walletName} does not support ${chainName}. Please switch to a supported network or use a different wallet.`,
                variant: 'failure'
              });
            } else {
              toast({
                title: 'Failed to switch network',
                description: `Unable to switch to ${chainName}. Please try again.`,
                variant: 'failure'
              });
            }
          }
        }
      );
    },
    [switchChain, connector, chains]
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
