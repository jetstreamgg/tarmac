import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  keepSearch,
  useAppSearchParams,
  useRouteIntent,
  useRouteConvertIntent,
  useRouteEntityParams
} from '@/lib/navigation';
import { QueryParams, CHAIN_WIDGET_MAP, COMING_SOON_MAP } from '@/lib/constants';
import { ConvertIntent, Intent } from '@/lib/enums';

import { validateSearchParams } from '@/modules/utils/validateSearchParams';
import { useAvailableTokenRewardContracts } from '@/hooks';
import { useConnection, useConnectionEffect, useChainId, useChains, useSwitchChain } from 'wagmi';
import { useSafeAppNotification } from './useSafeAppNotification';
import { useGovernanceMigrationToast } from './useGovernanceMigrationToast';
import { useSpkStakingRewardsToast } from './useSpkStakingRewardsToast';
import { useUsdsSkyRewardsToast } from './useUsdsSkyRewardsToast';
import { useSealEnginePositionToast } from './useSealEnginePositionToast';
import { useNotificationQueue } from './useNotificationQueue';
import { usePageLoadNotifications } from './usePageLoadNotifications';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { isL2ChainId } from '@/utils';

/**
 * App-level orchestration that must run once for every module route: route
 * validation/gating, ConfigContext selection sync, search-param validation,
 * network defaulting/switching and page-load notifications. Lives in the
 * shell layout route so it stays mounted across module navigations.
 */
export function useAppOrchestration(): { intent: Intent } {
  const { isAuthorized } = useConnectedContext();
  const [searchParams, setSearchParams] = useAppSearchParams();
  const navigate = useNavigate();

  const intent = useRouteIntent();
  const convertIntent = useRouteConvertIntent();
  const { rewardContract } = useRouteEntityParams();

  const chainId = useChainId();
  const chains = useChains();

  const { connector } = useConnection();
  useConnectionEffect({
    // Once the user connects their wallet, check if the network param is set and switch chains if necessary
    onConnect() {
      const parsedChainId = chains.find(
        chain => normalizeUrlParam(chain.name) === normalizeUrlParam(network || '')
      )?.id;
      if (parsedChainId) {
        switchChain({ chainId: parsedChainId });
      }
    }
  });

  const { setIsSwitchingNetwork } = useNetworkSwitch();

  const { switchChain } = useSwitchChain({
    mutation: {
      onSuccess: () => {
        // Clear switching state when network switch succeeds
        setIsSwitchingNetwork(false);
      },
      onError: err => {
        // Clear switching state when network switch fails
        setIsSwitchingNetwork(false);

        // If the user rejects the network switch request, update the network query param to the current chain
        if (err.name === 'UserRejectedRequestError') {
          const chainName = chains.find(c => c.id === chainId)?.name;
          if (chainName) {
            const normalizedChainName = normalizeUrlParam(chainName);
            const currentNetwork = searchParams.get(QueryParams.Network);
            // Only update if the network actually changed (compare normalized to avoid case-only diffs)
            if (normalizeUrlParam(currentNetwork || '') !== normalizedChainName) {
              setSearchParams(params => {
                params.set(QueryParams.Network, normalizedChainName);
                return params;
              });
            }
          }
        }
      }
    }
  });

  const network = searchParams.get(QueryParams.Network) || undefined;

  // The chain the URL points at: the network param wins over the connected
  // chain so navigation validates against the target network while a wallet
  // switch is still in flight.
  const newChainId = network
    ? (chains.find(chain => normalizeUrlParam(chain.name) === normalizeUrlParam(network))?.id ?? chainId)
    : chainId;

  const rewardContracts = useAvailableTokenRewardContracts(newChainId);

  // Page Load Notifications - Only one notification shows per page load
  // Get configurations for all page load notifications
  const notificationConfigs = usePageLoadNotifications();

  // Use the notification queue to determine which notification to show
  const { shouldShowNotification } = useNotificationQueue(notificationConfigs);

  // Notification Priority System (only one notification per page load):
  // 1. Governance Migration (for connected wallets with MKR ≥ 0.05)
  // 2. SPK Staking Rewards (for users with staking positions using SPK rewards)
  // 3. USDS-SKY Rewards (for users with position in deprecated USDS-SKY rewards)
  // 4. Seal Engine (for users with MKR locked in the deprecated Seal Engine)

  // Display notifications based on queue priority
  useGovernanceMigrationToast(isAuthorized && shouldShowNotification('governance-migration'));
  useSpkStakingRewardsToast(isAuthorized && shouldShowNotification('spk-staking-rewards'));
  useUsdsSkyRewardsToast(isAuthorized && shouldShowNotification('usds-sky-rewards'));
  useSealEnginePositionToast(isAuthorized && shouldShowNotification('seal-engine-position'));

  // If the user is connected to a Safe Wallet using WalletConnect, notify they can use the Safe App
  useSafeAppNotification();

  // Route validation: redirects that depend on chain or user state, replacing
  // the navigation-param stripping the legacy query-param validator did.
  useEffect(() => {
    const allowedIntents = CHAIN_WIDGET_MAP[newChainId] ?? [];
    const comingSoon = COMING_SOON_MAP[newChainId] ?? [];

    // Module not available (or coming soon) on the target chain → Balances.
    if (!allowedIntents.includes(intent) || comingSoon.includes(intent)) {
      void navigate({ to: '/', search: keepSearch, replace: true });
      return;
    }

    // Upgrade is not available on L2 chains → Convert overview.
    if (convertIntent === ConvertIntent.UPGRADE_INTENT && isL2ChainId(newChainId)) {
      void navigate({ to: '/convert', search: keepSearch, replace: true });
      return;
    }

    // Reward detail routes must point at a reward contract available on the
    // target chain.
    if (
      rewardContract !== undefined &&
      !rewardContracts?.some(c => c.contractAddress?.toLowerCase() === rewardContract.toLowerCase())
    ) {
      void navigate({ to: '/earn/rewards', search: keepSearch, replace: true });
    }
  }, [intent, convertIntent, rewardContract, newChainId, rewardContracts, navigate]);

  // Run validation on the remaining query-driven search params whenever they change
  useEffect(() => {
    setSearchParams(params => validateSearchParams(params, intent, convertIntent, isL2ChainId(newChainId)), {
      replace: true
    });
  }, [searchParams, intent, convertIntent, newChainId]);

  useEffect(() => {
    // If there's no network param, default to the current chain
    if (!network) {
      const chainName = chains.find(c => c.id === chainId)?.name;
      if (chainName) {
        const normalizedChainName = normalizeUrlParam(chainName);
        // Only set if not already present (double-check in case of race condition)
        if (!searchParams.get(QueryParams.Network)) {
          setSearchParams(params => {
            params.set(QueryParams.Network, normalizedChainName);
            return params;
          });
        }
      }
    } else {
      // If the network param doesn't match the current chain, switch chains
      const parsedChainId = chains.find(
        chain => normalizeUrlParam(chain.name) === normalizeUrlParam(network)
      )?.id;
      if (parsedChainId && parsedChainId !== chainId) {
        switchChain({ chainId: parsedChainId });
      }
    }
  }, [network]);

  useEffect(() => {
    // If the user changes the network in their wallet, update the `network` query param
    const handleChainChange = ({ chainId: newChainId }: { chainId?: number | undefined }) => {
      const newChainName = chains.find(c => c.id === newChainId)?.name;
      if (newChainName) {
        const normalizedNewChainName = normalizeUrlParam(newChainName);
        const currentNetwork = searchParams.get(QueryParams.Network);
        // Only update if the network actually changed (compare normalized to avoid case-only diffs)
        if (normalizeUrlParam(currentNetwork || '') !== normalizedNewChainName) {
          setSearchParams(params => {
            params.set(QueryParams.Network, normalizedNewChainName);
            return params;
          });
        }
      }
    };

    const emitter = connector?.emitter;
    emitter?.on('change', handleChainChange);

    // Cleanup function to remove the listener
    return () => {
      emitter?.off('change', handleChainChange);
    };
  }, [chains, connector, setSearchParams]);

  return { intent };
}
