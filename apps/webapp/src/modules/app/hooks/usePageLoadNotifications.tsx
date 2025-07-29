import { useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useTokenBalance, TOKENS } from '@jetstreamgg/sky-hooks';
import { parseEther } from 'viem';
import {
  BATCH_TX_ENABLED,
  CHATBOT_ENABLED,
  BATCH_TX_NOTIFICATION_KEY,
  CHAT_NOTIFICATION_KEY,
  GOVERNANCE_MIGRATION_NOTIFICATION_KEY
} from '@/lib/constants';
import { NotificationConfig } from './useNotificationQueue';

/**
 * Hook to manage page load notifications configuration.
 * These notifications appear once per page load based on priority and conditions.
 *
 * Current priority order:
 * 1. EIP7702 Batch Transaction
 * 2. Governance Migration (requires MKR balance)
 * 3. Chat Notification
 */
export const usePageLoadNotifications = (): NotificationConfig[] => {
  const { address, isConnected } = useAccount();
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

  // Define notification configurations with priority order
  const notificationConfigs: NotificationConfig[] = useMemo(
    () => [
      {
        id: 'batch-tx',
        priority: 1,
        checkConditions: () => BATCH_TX_ENABLED,
        hasBeenShown: () => localStorage.getItem(BATCH_TX_NOTIFICATION_KEY) === 'true'
      },
      {
        id: 'governance-migration',
        priority: 2,
        isReady: () => mkrBalanceLoaded, // Wait for MKR balance to load
        checkConditions: () => isConnected && mkrExistsOnChain && hasEnoughMkr,
        hasBeenShown: () => localStorage.getItem(GOVERNANCE_MIGRATION_NOTIFICATION_KEY) === 'true'
      },
      {
        id: 'chat',
        priority: 3,
        checkConditions: () => CHATBOT_ENABLED,
        hasBeenShown: () => localStorage.getItem(CHAT_NOTIFICATION_KEY) === 'true'
      }
    ],
    [isConnected, mkrBalanceLoaded, mkrExistsOnChain, hasEnoughMkr, BATCH_TX_ENABLED, CHATBOT_ENABLED]
  );

  return notificationConfigs;
};
