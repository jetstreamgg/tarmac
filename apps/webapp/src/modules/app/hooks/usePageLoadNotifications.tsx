import { useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useTokenBalance, TOKENS } from '@jetstreamgg/sky-hooks';
import { parseEther } from 'viem';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { BATCH_TX_ENABLED, CHATBOT_ENABLED } from '@/lib/constants';
import { NotificationConfig } from './useNotificationQueue';
import { TOAST_STORAGE_KEY } from './useGovernanceMigrationToast';

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
  const { userConfig } = useConfigContext();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  // Get MKR balance to determine if governance notification will actually show
  const { data: mkrBalance, isLoading: mkrBalanceLoading } = useTokenBalance({
    address,
    token: TOKENS.mkr.address[chainId],
    chainId: chainId,
    enabled: isConnected && !!address
  });

  // Check if user is eligible for governance migration notification
  const minimumMkrBalance = parseEther('0.05');
  const mkrBalanceLoaded = isConnected ? mkrBalance !== undefined && !mkrBalanceLoading : true;
  const hasEnoughMkr = !!(mkrBalance && mkrBalance.value >= minimumMkrBalance);

  // Define notification configurations with priority order
  const notificationConfigs: NotificationConfig[] = useMemo(
    () => [
      {
        id: 'batch-tx',
        priority: 1,
        checkConditions: () => BATCH_TX_ENABLED,
        hasBeenShown: () => userConfig.batchTxNotificationShown
      },
      {
        id: 'governance-migration',
        priority: 2,
        isReady: () => mkrBalanceLoaded, // Wait for MKR balance to load
        checkConditions: () => isConnected && hasEnoughMkr,
        hasBeenShown: () => localStorage.getItem(TOAST_STORAGE_KEY) === 'true'
      },
      {
        id: 'chat',
        priority: 3,
        checkConditions: () => CHATBOT_ENABLED,
        hasBeenShown: () => userConfig.chatSuggested
      }
    ],
    [
      isConnected,
      mkrBalanceLoaded,
      hasEnoughMkr,
      userConfig.batchTxNotificationShown,
      userConfig.chatSuggested,
      BATCH_TX_ENABLED,
      CHATBOT_ENABLED
    ]
  );

  return notificationConfigs;
};
