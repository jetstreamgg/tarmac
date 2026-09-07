import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { useSwitchChain, useConnection, useChains, useChainId } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import type { Intent } from '@/lib/enums';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import type { NetworkSwitchSource } from '@/modules/analytics/constants';
import { toastWithClose } from '@/components/ui/use-toast';
import { HStack } from '@/modules/layout/components/HStack';
import { VStack } from '@/modules/layout/components/VStack';
import { Text } from '@/modules/layout/components/Typography';
import { Failure } from '@/modules/icons';
import { reportError } from '@/modules/sentry/reportError';
import { isUserRejectedRequestError } from '@/modules/utils/isUserRejectedRequestError';

/**
 * Everything about switching the wallet's chain, in one place: the flags the
 * shell toast reads to explain a change, and the one function every in-app
 * control calls to request one.
 *
 * `handleSwitchChain` is wagmi's `switchChain` plus what every switch needs —
 * the analytics request/completion events, the rejected-vs-failed toasts and the
 * "chain not supported by this wallet" toast. Every surface that can switch goes
 * through it: the product-page and transaction-modal `NetworkSelect`s and the
 * transaction modal's chain guard. A user's own pick is recorded as manual so
 * the shell's network toast stays quiet when it lands (APP-547); the modal's
 * automatic switch on open is not.
 *
 * (This used to be two contexts: the flags here and the action in a
 * `ChainModalContext` named for the dialog that once held the switcher. The
 * dialog is gone — switching is a dropdown now — and the action already read
 * the flags, so they merged.)
 */
type SwitchChainRequest = {
  chainId: number;
  /** Which surface asked for the switch (APP-444 D-1). */
  source?: NetworkSwitchSource;
  onSuccess?: (data: any, variables: { chainId: number }) => void;
  onSettled?: () => void;
};

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
   * hook on the next chain change or a disconnect, and by the switch's error
   * path.
   */
  pendingManualSwitchChainId: number | null;
  setPendingManualSwitchChainId: (chainId: number | null) => void;
  /** Ask the wallet to switch: wagmi's `switchChain` plus analytics and failure toasts. */
  handleSwitchChain: (request: SwitchChainRequest) => void;
  /** wagmi's mutation state for the switch in flight, for a control's "switching" look. */
  isSwitchPending: boolean;
  switchVariables: { chainId: number } | undefined;
}

const NetworkSwitchContext = createContext<NetworkSwitchContextValue | undefined>(undefined);

export function NetworkSwitchProvider({ children }: { children: ReactNode }) {
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [isAutoSwitching, setIsAutoSwitching] = useState(false);
  const [autoSwitchIntent, setAutoSwitchIntent] = useState<Intent | null>(null);
  const [pendingManualSwitchChainId, setPendingManualSwitchChainId] = useState<number | null>(null);

  const { switchChain, isPending: isSwitchPending, variables: switchVariables } = useSwitchChain();
  const { connector } = useConnection();
  const chains = useChains();
  const currentChainId = useChainId();
  const { trackNetworkSwitchRequested, trackNetworkSwitchCompleted } = useAppAnalytics();
  const duration = 10000;

  const handleSwitchChain = useCallback(
    ({ chainId, source = 'chain_modal', onSuccess, onSettled }: SwitchChainRequest) => {
      const fromChainId = currentChainId;
      trackNetworkSwitchRequested({ source, fromChainId, toChainId: chainId });
      // Recorded as the user's own pick so the shell toast stays quiet when it
      // lands — except the modal's automatic switch on open, which the user did
      // not ask for and should hear about like any other app-made change.
      if (source !== 'transaction_modal_auto') setPendingManualSwitchChainId(chainId);
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
    <NetworkSwitchContext.Provider
      value={{
        isSwitchingNetwork,
        setIsSwitchingNetwork,
        isAutoSwitching,
        setIsAutoSwitching,
        autoSwitchIntent,
        setAutoSwitchIntent,
        pendingManualSwitchChainId,
        setPendingManualSwitchChainId,
        handleSwitchChain,
        isSwitchPending,
        switchVariables
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
