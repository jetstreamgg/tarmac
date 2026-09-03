import { useCallback, useEffect, useRef } from 'react';
import { toastWithClose } from '@/components/ui/use-toast';
import { Text } from '@/modules/layout/components/Typography';
import { getChainIcon, isL2ChainId } from '@/utils';
import { ArrowRightLong } from '@/modules/icons';
import { Intent } from '@/lib/enums';
import { requiresMainnet } from '@/lib/widget-network-map';

interface NetworkToastProps {
  previousChain?: { id: number; name: string };
  currentChain: { id: number; name: string };
  currentIntent?: Intent;
  previousIntent?: Intent;
  isAutoSwitch?: boolean;
}

/**
 * The app-loader cover hides the toast stack off the `data-app-loader-cover`
 * document flag (globals.css), and the connect-time auto-switch fires exactly
 * when the held cover goes up — shown immediately, a toast could burn its
 * whole 5–8s lifetime invisible and never be seen. Hold the show until the
 * flag clears (the cover always ends: settle, hold cap, or watchdog).
 *
 * Returns the observer while the show is pending (null when it ran
 * immediately) so the caller can supersede or cancel it — the deferral must
 * keep the hook's one-toast-at-a-time behavior: a second network change under
 * the cover replaces the queued toast rather than stacking a stale
 * "Switched to X" on top of it at reveal.
 */
const showWhenUncovered = (show: () => void): MutationObserver | null => {
  const root = document.documentElement;
  if (!root.hasAttribute('data-app-loader-cover')) {
    show();
    return null;
  }
  const observer = new MutationObserver(() => {
    if (!root.hasAttribute('data-app-loader-cover')) {
      observer.disconnect();
      show();
    }
  });
  observer.observe(root, { attributes: true, attributeFilter: ['data-app-loader-cover'] });
  return observer;
};

const getWidgetName = (intent: Intent): string => {
  switch (intent) {
    case Intent.TRADE_INTENT:
      return 'Trade';
    case Intent.SAVINGS_INTENT:
      return 'Savings';
    case Intent.BALANCES_INTENT:
      return 'Balances';
    case Intent.UPGRADE_INTENT:
      return 'Upgrade';
    case Intent.REWARDS_INTENT:
      return 'Rewards';
    case Intent.STAKE_INTENT:
      return 'Stake';
    case Intent.EXPERT_INTENT:
      return 'stUSDS';
    case Intent.VAULTS_INTENT:
      return 'Vaults';
    case Intent.FIXED_INTENT:
      return 'Fixed Yield';
    case Intent.CONVERT_INTENT:
      return 'Convert';
    default:
      return 'this widget';
  }
};

export function useEnhancedNetworkToast() {
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The show currently parked behind the app-loader cover, if any.
  const deferredShowRef = useRef<MutationObserver | null>(null);

  // The observer targets the document element, so it outlives this component
  // unless explicitly disconnected on unmount.
  useEffect(
    () => () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      deferredShowRef.current?.disconnect();
    },
    []
  );

  const showNetworkToast = useCallback(
    ({ previousChain, currentChain, currentIntent, previousIntent, isAutoSwitch }: NetworkToastProps) => {
      // Generate context-aware title
      let title = '';

      if (isAutoSwitch) {
        // Check if switching TO mainnet for a mainnet-only widget
        if (currentIntent && requiresMainnet(currentIntent) && !isL2ChainId(currentChain.id)) {
          const widgetName = getWidgetName(currentIntent);
          title = `To access ${widgetName}, you need to be on mainnet. We've switched your network automatically.`;
        }
        // Default auto-switch message
        else {
          title = previousChain ? 'The network has changed' : `Switched to ${currentChain.name}`;
        }
      } else {
        // Manual network switch
        title = previousChain ? 'The network has changed' : `Switched to ${currentChain.name}`;
      }

      // The chain change, previous → current. The "also supported on" quick
      // switches that used to follow are gone (APP-547): switching lives on the
      // product page and in the transaction modal, where a chain decides
      // something.
      const toastContent = (
        <div className="mt-2 w-full">
          <div className="flex items-center gap-5">
            {previousChain && (
              <>
                <div className="flex items-center gap-2">
                  {getChainIcon(previousChain.id, 'h-[22px] w-[22px]')}
                  <Text className="text-small sm:text-medium md:text-large">{previousChain.name}</Text>
                </div>
                <ArrowRightLong width={18} height={18} />
              </>
            )}
            <div className="flex items-center gap-2">
              {getChainIcon(currentChain.id, 'h-[22px] w-[22px]')}
              <Text className="text-small sm:text-medium md:text-large">{currentChain.name}</Text>
            </div>
          </div>
        </div>
      );

      // A longer title (the mainnet-only explanation) gets more time to read.
      const hasLongTitle = title.length > 50;

      // Clear any existing timeout to prevent multiple toasts
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }

      // Set new timeout with proper cleanup reference
      toastTimeoutRef.current = setTimeout(
        () => {
          // A newer change supersedes a show still parked behind the cover —
          // its "Switched to X" is stale by definition.
          deferredShowRef.current?.disconnect();
          deferredShowRef.current = showWhenUncovered(() => {
            deferredShowRef.current = null;
            // Create a unique ID for this toast
            const toastId = `network-toast-${Date.now()}`;

            toastWithClose(
              <div>
                <Text variant="medium">{title}</Text>
                {toastContent}
              </div>,
              {
                id: toastId,
                duration: hasLongTitle ? 8000 : 5000,
                classNames: {
                  toast: 'md:min-w-[400px]'
                }
              }
            );
          });
          // Clear the ref after the toast is shown or handed to the observer
          toastTimeoutRef.current = null;
        },
        currentIntent === previousIntent ? 700 : 0
      );
    },
    []
  );

  return { showNetworkToast };
}
