import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { INTENT_PATHS, retainOnNavigate } from '@/lib/router';
import { Intent } from '@/lib/enums';
import { requiresMainnet } from '@/lib/widget-network-map';
import { isL2ChainId, isTestnetId } from '@/utils';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { QueryParams } from '@/lib/constants';
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
 * - Navigates to the target module path, retaining cross-module search params
 * - Tracks auto-switching state for UI feedback
 */
export function useNetworkAutoSwitch({
  currentChainId,
  currentIntent
}: UseNetworkAutoSwitchProps): UseNetworkAutoSwitchReturn {
  const navigate = useNavigate();
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
      // Store the previous intent before switching
      setPreviousIntent(currentIntent);

      // Rewards keeps the previously selected reward contract as a detail route.
      const navigateToTarget = (networkOverride?: string) => {
        const rewardContract =
          targetIntent === Intent.REWARDS_INTENT ? selectedRewardContract?.contractAddress : undefined;
        const search = (prev: Record<string, string | undefined>) => {
          const retained = retainOnNavigate(prev);
          if (networkOverride) retained[QueryParams.Network] = networkOverride;
          return retained;
        };
        if (rewardContract) {
          void navigate({ to: '/rewards/$rewardContract', params: { rewardContract }, search });
        } else {
          void navigate({ to: INTENT_PATHS[targetIntent], search });
        }
      };

      // IMPORTANT: Skip all auto-switching logic if we're on a testnet
      // Testnets are for testing and we shouldn't disrupt the user's testing environment
      if (currentChainId && isTestnetId(currentChainId)) {
        navigateToTarget();
        return; // Exit early for testnets
      }

      // Check if we need to switch networks (only for non-testnets)
      if (currentChainId && requiresMainnet(targetIntent) && isL2ChainId(currentChainId)) {
        // Auto-switch to mainnet for mainnet-only widgets (they're not available on L2)
        setIsSwitchingNetwork(true);
        setIsAutoSwitching(true);
        navigateToTarget(normalizeUrlParam('Ethereum'));
      } else {
        // Normal widget change without network switch
        navigateToTarget();
      }
    },
    [currentChainId, currentIntent, navigate, setIsSwitchingNetwork, selectedRewardContract]
  );

  return {
    handleWidgetNavigation,
    isAutoSwitching,
    previousIntent,
    setPreviousIntent
  };
}
