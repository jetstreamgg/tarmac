import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useChains } from 'wagmi';
import { Intent } from '@/lib/enums';
import { requiresMainnet, isMultichain } from '@/lib/widget-network-map';
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
 * Implements Return-to-Origin pattern:
 *
 * - When forced to mainnet by a mainnet-only widget, saves the origin network
 * - When navigating from mainnet-only to multichain, returns to origin once and clears it
 * - No per-widget network memory
 * - Manual network changes are always respected
 * - Tracks auto-switching state for UI feedback
 */
export function useNetworkAutoSwitch({
  currentChainId,
  currentIntent
}: UseNetworkAutoSwitchProps): UseNetworkAutoSwitchReturn {
  const [, setSearchParams] = useSearchParams();
  const chains = useChains();
  const { setIsSwitchingNetwork, originNetwork, setOriginNetwork, clearOriginNetwork } = useNetworkSwitch();
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

      // Rule 2: Entering a mainnet-only widget
      // If current network is not mainnet, save origin and force switch to mainnet
      const isMainnet = currentChainId === 1; // Ethereum mainnet chain ID
      const isGoingToMainnetOnly = requiresMainnet(targetIntent);
      const isLeavingMainnetOnly = currentIntent && requiresMainnet(currentIntent);
      const isGoingToMultichain = isMultichain(targetIntent);

      if (isGoingToMainnetOnly && currentChainId && !isMainnet && isL2ChainId(currentChainId)) {
        // Save current L2 as origin before forcing to mainnet
        setOriginNetwork(currentChainId);
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
      }
      // Rule 3: Navigating from mainnet-only to multichain widget
      // If origin exists, return to it once and clear it
      else if (isLeavingMainnetOnly && isGoingToMultichain && originNetwork) {
        const originChain = chains.find(c => c.id === originNetwork);

        if (originChain) {
          // Use origin network and clear it immediately
          clearOriginNetwork();
          setIsSwitchingNetwork(true);
          setIsAutoSwitching(true);

          setSearchParams(prevParams => {
            const searchParams = deleteSearchParams(prevParams);
            searchParams.set(QueryParams.Network, normalizeUrlParam(originChain.name));
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
        } else {
          // Origin chain not found, clear origin and stay on current network
          clearOriginNetwork();
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
      }
      // Rule 4: All other navigation (multichain to multichain, mainnet-only to mainnet-only, etc.)
      // Just change widget without network switch
      else {
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
    [
      currentChainId,
      currentIntent,
      chains,
      originNetwork,
      setOriginNetwork,
      clearOriginNetwork,
      setIsSwitchingNetwork,
      setSearchParams,
      selectedRewardContract
    ]
  );

  return {
    handleWidgetNavigation,
    isAutoSwitching,
    previousIntent,
    setPreviousIntent
  };
}