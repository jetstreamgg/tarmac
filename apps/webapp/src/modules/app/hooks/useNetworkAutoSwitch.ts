import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useChains } from 'wagmi';
import { Intent } from '@/lib/enums';
import { requiresMainnet } from '@/lib/widget-network-map';
import { isL2ChainId, isTestnetId } from '@jetstreamgg/sky-utils';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { QueryParams, mapIntentToQueryParam } from '@/lib/constants';
import { deleteSearchParams } from '@/modules/utils/deleteSearchParams';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';

interface UseNetworkAutoSwitchProps {
  currentChainId?: number;
  currentIntent?: Intent;
}

interface UseNetworkAutoSwitchReturn {
  handleWidgetNavigation: (targetIntent: Intent) => void;
  isAutoSwitching: boolean;
  previousIntent: Intent | undefined;
  setPreviousIntent: (intent: Intent | undefined) => void;
}

/**
 * Hook to handle automatic network switching when navigating between widgets
 *
 * Responsibilities:
 * - Auto-switches to mainnet for mainnet-only widgets
 * - Manages search params for network and widget navigation
 * - Tracks auto-switching state for UI feedback
 */
export function useNetworkAutoSwitch({
  currentChainId,
  currentIntent
}: UseNetworkAutoSwitchProps): UseNetworkAutoSwitchReturn {
  const [, setSearchParams] = useSearchParams();
  const chains = useChains();
  const { setIsSwitchingNetwork } = useNetworkSwitch();
  const { selectedRewardContract } = useConfigContext();
  const [isAutoSwitching, setIsAutoSwitching] = useState(false);
  const [previousIntent, setPreviousIntent] = useState<Intent | undefined>(currentIntent);
  const [previousChainId, setPreviousChainId] = useState<number | undefined>(currentChainId);

  // Reset isAutoSwitching after network change completes
  useEffect(() => {
    if (currentChainId && previousChainId && currentChainId !== previousChainId && isAutoSwitching) {
      // Network has changed, reset the auto-switching flag
      setIsAutoSwitching(false);
    }
    setPreviousChainId(currentChainId);
  }, [currentChainId, previousChainId, isAutoSwitching]);

  const handleWidgetNavigation = useCallback(
    (targetIntent: Intent) => {
      const queryParam = mapIntentToQueryParam(targetIntent);

      // Store the previous intent before switching
      setPreviousIntent(currentIntent);

      // IMPORTANT: Skip all auto-switching logic if we're on a testnet
      // Testnets are for testing and we shouldn't disrupt the user's testing environment
      if (currentChainId && isTestnetId(currentChainId)) {
        // Just change the widget without any network switching
        setSearchParams(prevParams => {
          const searchParams = deleteSearchParams(prevParams);
          searchParams.set(QueryParams.Widget, queryParam);

          // Handle rewards-specific params even on testnet
          if (targetIntent === Intent.REWARDS_INTENT) {
            if (selectedRewardContract?.contractAddress) {
              searchParams.set(QueryParams.Reward, selectedRewardContract.contractAddress);
            }
          } else {
            searchParams.delete(QueryParams.Reward);
          }

          return searchParams;
        });
        return; // Exit early for testnets
      }

      // Check if we need to switch networks (only for non-testnets)
      if (currentChainId && requiresMainnet(targetIntent) && isL2ChainId(currentChainId)) {
        // Auto-switch to mainnet for mainnet-only widgets (they're not available on L2)
        setIsSwitchingNetwork(true);
        setIsAutoSwitching(true);

        setSearchParams(prevParams => {
          const searchParams = deleteSearchParams(prevParams);
          // Set network to Ethereum mainnet
          searchParams.set(QueryParams.Network, normalizeUrlParam('Ethereum'));
          searchParams.set(QueryParams.Widget, queryParam);

          // Handle rewards-specific params
          if (targetIntent === Intent.REWARDS_INTENT && selectedRewardContract?.contractAddress) {
            searchParams.set(QueryParams.Reward, selectedRewardContract.contractAddress);
          }

          return searchParams;
        });
      } else {
        // Normal widget change without network switch
        setSearchParams(prevParams => {
          const searchParams = deleteSearchParams(prevParams);
          searchParams.set(QueryParams.Widget, queryParam);

          // Handle rewards-specific params
          if (targetIntent === Intent.REWARDS_INTENT) {
            if (selectedRewardContract?.contractAddress) {
              searchParams.set(QueryParams.Reward, selectedRewardContract.contractAddress);
            }
          } else {
            searchParams.delete(QueryParams.Reward);
          }
          return searchParams;
        });
      }
    },
    [currentChainId, currentIntent, chains, setIsSwitchingNetwork, setSearchParams, selectedRewardContract]
  );

  return {
    handleWidgetNavigation,
    isAutoSwitching,
    previousIntent,
    setPreviousIntent
  };
}
