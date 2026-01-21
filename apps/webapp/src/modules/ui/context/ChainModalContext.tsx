import React, { createContext, useContext, useCallback } from 'react';
import { useSwitchChain, useConnection, useChains } from 'wagmi';
import { toastWithClose } from '@/components/ui/use-toast';
import { HStack } from '@/modules/layout/components/HStack';
import { VStack } from '@/modules/layout/components/VStack';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { Failure } from '@/modules/icons';

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
  const { connector } = useConnection();
  const chains = useChains();
  const duration = 10000;

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
              toastWithClose(
                () => (
                  <HStack className="items-start gap-2">
                    <Failure className="mt-0.5 shrink-0" width={20} height={20} />
                    <VStack className="gap-2">
                      <Text variant="medium">
                        <Trans>Chain not supported</Trans>
                      </Text>
                      <Text variant="small" className="text-textSecondary">
                        {`${walletName} does not support ${chainName}. Please switch to a supported network or use a different wallet.`}
                      </Text>
                    </VStack>
                  </HStack>
                ),
                {
                  classNames: {
                    content: 'w-full'
                  },
                  duration
                }
              );
            } else {
              toastWithClose(
                () => (
                  <HStack className="items-start gap-2">
                    <Failure className="mt-0.5 shrink-0" width={20} height={20} />
                    <VStack className="gap-2">
                      <Text variant="medium">
                        <Trans>Failed to switch network</Trans>
                      </Text>
                      <Text variant="small" className="text-textSecondary">
                        {`Unable to switch to ${chainName}. Please try again.`}
                      </Text>
                    </VStack>
                  </HStack>
                ),
                {
                  classNames: {
                    content: 'w-full'
                  },
                  duration
                }
              );
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
