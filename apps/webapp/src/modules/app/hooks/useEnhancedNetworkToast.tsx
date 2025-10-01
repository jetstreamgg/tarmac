import { useCallback, useRef, useState } from 'react';
import { useChains } from 'wagmi';
import type { Chain } from 'viem';
import { toast, toastWithClose } from '@/components/ui/use-toast';
import { Text } from '@/modules/layout/components/Typography';
import { getChainIcon, isL2ChainId } from '@jetstreamgg/sky-utils';
import { ArrowRightLong } from '@/modules/icons';
import { Intent } from '@/lib/enums';
import { isMultichain, requiresMainnet } from '@/lib/widget-network-map';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useChainModalContext } from '@/modules/ui/context/ChainModalContext';
import { useSearchParams, type SetURLSearchParams } from 'react-router-dom';
import { QueryParams } from '@/lib/constants';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { Loader2 } from 'lucide-react';
import { getSupportedChainIds } from '@/data/wagmi/config/config.default';

interface NetworkToastProps {
  previousChain?: { id: number; name: string };
  currentChain: { id: number; name: string };
  currentIntent?: Intent;
  previousIntent?: Intent;
  isAutoSwitch?: boolean;
}

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
      return 'Expert';
    case Intent.SEAL_INTENT:
      return 'Seal';
    default:
      return 'this widget';
  }
};

const NetworkQuickSwitchButtons = ({
  currentChainId,
  currentIntent,
  chains,
  handleSwitchChain,
  setSearchParams,
  toastId
}: {
  currentChainId: number;
  currentIntent?: Intent;
  chains: readonly Chain[];
  handleSwitchChain: (params: {
    chainId: number;
    onSuccess?: (data: any, variables: { chainId: number }) => void;
    onSettled?: () => void;
  }) => void;
  setSearchParams: SetURLSearchParams;
  toastId?: string | number;
}) => {
  const [switchingTo, setSwitchingTo] = useState<number | null>(null);

  // Get supported chains for current widget
  const supportedChainIds = getSupportedChainIds(currentChainId);
  const availableChains = chains.filter(
    chain => supportedChainIds.includes(chain.id) && chain.id !== currentChainId
  );

  // Don't show quick switch for mainnet-only widgets or if no other chains available
  if (!currentIntent || !isMultichain(currentIntent) || availableChains.length === 0) {
    return null;
  }

  // Don't show for Balances widget (it doesn't track network preferences)
  if (currentIntent === Intent.BALANCES_INTENT) {
    // Could still show buttons but with different behavior if desired
    // For now, following the spec to keep Balances simple
    return null;
  }

  const widgetName = getWidgetName(currentIntent);

  return (
    <div className="mt-3 flex flex-col gap-2">
      <Text className="text-text/60 text-xs">{widgetName} is also supported on:</Text>
      <div className="flex gap-2">
        {availableChains.map(chain => (
          <Button
            key={chain.id}
            size="icon"
            variant="outline"
            className={cn(
              'border-text/20 bg-container/50 hover:bg-container/80 h-8 w-8 p-0',
              switchingTo === chain.id && 'cursor-wait opacity-50'
            )}
            disabled={switchingTo !== null}
            onClick={() => {
              setSwitchingTo(chain.id);

              // Dismiss the toast after a delay
              if (toastId) {
                setTimeout(() => {
                  toast.dismiss(toastId);
                }, 350);
              }

              handleSwitchChain({
                chainId: chain.id,
                onSuccess: (_: any, { chainId: newChainId }: { chainId: number }) => {
                  const newChainName = chains.find(c => c.id === newChainId)?.name;
                  if (newChainName) {
                    setSearchParams((params: URLSearchParams) => {
                      params.set(QueryParams.Network, normalizeUrlParam(newChainName));
                      return params;
                    });
                  }
                }
              });
            }}
            title={`Switch to ${chain.name}`}
          >
            {switchingTo === chain.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              getChainIcon(chain.id, 'h-4 w-4')
            )}
          </Button>
        ))}
      </div>
    </div>
  );
};

export function useEnhancedNetworkToast() {
  const chains = useChains();
  const { handleSwitchChain } = useChainModalContext();
  const [, setSearchParams] = useSearchParams();
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      // Create a function to generate content with toast ID
      const createToastContent = (toastId?: string | number) => (
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
          <NetworkQuickSwitchButtons
            currentChainId={currentChain.id}
            currentIntent={currentIntent}
            chains={chains}
            handleSwitchChain={handleSwitchChain}
            setSearchParams={setSearchParams}
            toastId={toastId}
          />
        </div>
      );

      // Extend duration if we're showing quick switch buttons or have a longer title
      const hasQuickSwitch =
        currentIntent && isMultichain(currentIntent) && currentIntent !== Intent.BALANCES_INTENT;
      const hasLongTitle = title.length > 50;

      // Clear any existing timeout to prevent multiple toasts
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }

      // Set new timeout with proper cleanup reference
      toastTimeoutRef.current = setTimeout(
        () => {
          // Create a unique ID for this toast
          const toastId = `network-toast-${Date.now()}`;

          toastWithClose(
            <div>
              <Text variant="medium">{title}</Text>
              {createToastContent(toastId)}
            </div>,
            {
              id: toastId,
              duration: hasQuickSwitch || hasLongTitle ? 8000 : 5000, // Extended duration for multichain widgets or longer messages
              classNames: {
                toast: 'md:min-w-[400px]'
              }
            }
          );
          // Clear the ref after the toast is shown
          toastTimeoutRef.current = null;
        },
        currentIntent === previousIntent ? 700 : 0
      );
    },
    [chains, handleSwitchChain, setSearchParams]
  );

  return { showNetworkToast };
}
