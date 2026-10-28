import { useMemo } from 'react';
import { useConnection, useChainId } from 'wagmi';
import { useTokenBalance } from '@/hooks/tokens/useTokenBalance';
import { TOKENS } from '@/hooks/tokens/tokens.constants';
import { parseEther } from 'viem';
import {
  GOVERNANCE_MIGRATION_NOTIFICATION_KEY,
  SPK_STAKING_NOTIFICATION_KEY,
  USDS_SKY_REWARDS_NOTIFICATION_KEY,
  SEAL_ENGINE_NOTIFICATION_KEY
} from '@/lib/constants';
import { NotificationConfig } from './useNotificationQueue';
import { useHasSpkStakingPositions } from './useHasSpkStakingPositions';
import { useHasUsdsSkyRewardsPosition } from './useHasUsdsSkyRewardsPosition';
import { useHasSealEnginePosition } from './useHasSealEnginePosition';

/**
 * Hook to manage page load notifications configuration.
 * These notifications appear once per page load based on priority and conditions.
 *
 * Current priority order:
 * 1. Governance Migration (requires MKR balance)
 * 2. SPK Staking Rewards (requires staking positions with SPK reward)
 * 3. USDS-SKY Rewards (requires position in deprecated USDS-SKY rewards)
 * 4. Seal Engine (requires MKR locked in the deprecated Seal Engine)
 */
export const usePageLoadNotifications = (): NotificationConfig[] => {
  const { address, isConnected } = useConnection();
  const chainId = useChainId();

  // Check if MKR exists on current chain
  const mkrAddress = TOKENS.mkr.address[chainId];
  const mkrExistsOnChain = !!mkrAddress;

  // Get MKR balance to determine if governance notification will actually show
  const { data: mkrBalance, isLoading: mkrBalanceLoading } = useTokenBalance({
    address,
    token: mkrAddress,
    chainId: chainId,
    enabled: isConnected && !!address && mkrExistsOnChain
  });

  // Check if user is eligible for governance migration notification
  const minimumMkrBalance = parseEther('0.05');
  const mkrBalanceLoaded = isConnected
    ? !mkrExistsOnChain || (mkrBalance !== undefined && !mkrBalanceLoading)
    : true;
  const hasEnoughMkr = !!(mkrExistsOnChain && mkrBalance && mkrBalance.value >= minimumMkrBalance);

  // Check if user has SPK staking positions
  const { hasSpkPositions, isReady: spkPositionsReady } = useHasSpkStakingPositions();

  // Check if user has USDS-SKY rewards position
  const { hasPosition: hasUsdsSkyPosition, isReady: usdsSkyPositionReady } = useHasUsdsSkyRewardsPosition();

  // Check if user has MKR locked in the deprecated Seal Engine
  const { hasPosition: hasSealEnginePosition, isReady: sealEnginePositionReady } = useHasSealEnginePosition();

  // Define notification configurations with priority order
  const notificationConfigs: NotificationConfig[] = useMemo(
    () => [
      {
        id: 'governance-migration',
        priority: 1,
        isReady: () => mkrBalanceLoaded, // Wait for MKR balance to load
        checkConditions: () => isConnected && mkrExistsOnChain && hasEnoughMkr,
        hasBeenShown: () => localStorage.getItem(GOVERNANCE_MIGRATION_NOTIFICATION_KEY) === 'true'
      },
      {
        id: 'spk-staking-rewards',
        priority: 2,
        isReady: () => spkPositionsReady, // Wait for stake history to load
        checkConditions: () => isConnected && hasSpkPositions,
        hasBeenShown: () => localStorage.getItem(SPK_STAKING_NOTIFICATION_KEY) === 'true'
      },
      {
        id: 'usds-sky-rewards',
        priority: 3,
        isReady: () => usdsSkyPositionReady, // Wait for rewards balance to load
        checkConditions: () => isConnected && hasUsdsSkyPosition,
        hasBeenShown: () => localStorage.getItem(USDS_SKY_REWARDS_NOTIFICATION_KEY) === 'true'
      },
      {
        id: 'seal-engine-position',
        priority: 4,
        isReady: () => sealEnginePositionReady, // Wait for the subgraph read to load
        checkConditions: () => isConnected && hasSealEnginePosition,
        hasBeenShown: () => localStorage.getItem(SEAL_ENGINE_NOTIFICATION_KEY) === 'true'
      }
    ],
    [
      isConnected,
      mkrBalanceLoaded,
      mkrExistsOnChain,
      hasEnoughMkr,
      spkPositionsReady,
      hasSpkPositions,
      usdsSkyPositionReady,
      hasUsdsSkyPosition,
      sealEnginePositionReady,
      hasSealEnginePosition
    ]
  );

  return notificationConfigs;
};
