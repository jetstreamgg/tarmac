import React, { createContext, useContext, useCallback } from 'react';
import { useSwitchChain, useConnection, useChains, useChainId } from 'wagmi';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import type { NetworkSwitchSource } from '@/modules/analytics/constants';
import { toastWithClose } from '@/components/ui/use-toast';
import { HStack } from '@/modules/layout/components/HStack';
import { VStack } from '@/modules/layout/components/VStack';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { Failure } from '@/modules/icons';
import { reportError } from '@/modules/sentry/reportError';
import { isUserRejectedRequestError } from '@/modules/utils/isUserRejectedRequestError';
import { useNetworkSwitch } from './NetworkSwitchContext';

/**
 * The one place a chain switch is requested: the wallet call plus its analytics
 * and its failure toasts (unsupported-chain vs generic). Every surface that can
 * switch goes through it — the product-page and transaction-modal
 * `NetworkSelect`s and the transaction modal's chain guard. All of them are the
 * user's own doing, so the switch is recorded as manual and the shell's network
 * toast stays quiet when it lands (APP-547).
 *
 * Named for the ChainModal that used to be its only consumer; that dialog is
 * gone (switching is a dropdown now), but the name is left alone rather than
 * churning every import site out from under the open transaction work.
 */
type ChainModalContextType = {
  handleSwitchChain: ({
    chainId,
    source,
    onSuccess,
    onSettled
  }: {
    chainId: number;
    /** Which surface asked for the switch (APP-444 D-1). */
    source?: NetworkSwitchSource;
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
  const currentChainId = useChainId();
  const { trackNetworkSwitchRequested, trackNetworkSwitchCompleted } = useAppAnalytics();
  const { setPendingManualSwitchChainId } = useNetworkSwitch();
  const duration = 10000;

  const handleSwitchChain = useCallback(
    ({
      chainId,
      source = 'chain_modal',
      onSuccess,
      onSettled
    }: {
      chainId: number;
      source?: NetworkSwitchSource;
      onSuccess?: (data: any, variables: { chainId: number }) => void;
      onSettled?: () => void;
    }) => {
      const fromChainId = currentChainId;
      trackNetworkSwitchRequested({ source, fromChainId, toChainId: chainId });
      setPendingManualSwitchChainId(chainId);
      switchChain(
        { chainId },
        {
          onSuccess: (data, vars) => {
            trackNetworkSwitchCompleted({ source, fromChainId, toChainId: chainId, status: 'success' });
            onSuccess?.(data, vars);
          },
          onSettled,
          onError: error => {
            setPendingManualSwitchChainId(null);
            trackNetworkSwitchCompleted({
              source,
              fromChainId,
              toChainId: chainId,
              status: isUserRejectedRequestError(error) ? 'rejected' : 'error'
            });
            if (isUserRejectedRequestError(error)) {
              return;
            }

            // Get chain name from the chainId
            const targetChain = chains.find(chain => chain.id === chainId);
            const chainName = targetChain?.name || `chain ID ${chainId}`;
            const walletName = connector?.name || 'Your wallet';

            reportError(error, {
              module: 'ui',
              flow: 'switch-chain',
              action: 'submit',
              type: 'chain_switch_error',
              extra: {
                chainId,
                chainName,
                walletName
              }
            });

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
    [
      switchChain,
      connector,
      chains,
      currentChainId,
      trackNetworkSwitchRequested,
      trackNetworkSwitchCompleted,
      setPendingManualSwitchChainId
    ]
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
