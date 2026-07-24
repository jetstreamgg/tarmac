import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useRouterState } from '@tanstack/react-router';
import { keepSearch, useAppSearchParams, useRouteEntityParams } from '@/lib/navigation';
import { QueryParams } from '@/lib/constants';
import { Intent } from '@/lib/enums';
import { getRouteChainAction } from '@/lib/widget-network-map';
import { pathToIntent } from '@/lib/routes';

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
import { useUpgradeDeepLink } from '@/modules/upgrade/hooks/useUpgradeDeepLink';

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

  // Intent derived from the location pathname rather than the matched route:
  // the location (pathname + searchStr) updates a render before the route
  // matches resolve, and the bookkeeping below needs the intent and the
  // network param to move together. With the matched-route intent, a
  // navigation briefly pairs the new search with the old intent — the switch
  // fires under the old intent, and when the intent catches up the reset
  // below wipes autoSwitchAttempted, granting a second wallet prompt after a
  // failed switch and letting the network toast read the wrong module.
  // pathToIntent agrees with the routes' staticData on every reachable path
  // (the TRADE/UPGRADE alias routes redirect before rendering).
  const pathname = useRouterState({ select: s => s.location.pathname });
  const intent = pathToIntent(pathname) ?? Intent.BALANCES_INTENT;
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

  const { setIsSwitchingNetwork, setIsAutoSwitching } = useNetworkSwitch();

  // One auto-switch chance per module visit, reset when the user navigates to
  // a different module. Marked on an attempt, on a rejected wallet switch and
  // on a manual wallet chain change, so route validation falls through to the
  // home redirect instead of re-prompting against the user's choice.
  const autoSwitchAttempted = useRef(false);
  useEffect(() => {
    autoSwitchAttempted.current = false;
  }, [intent]);

  const { switchChain } = useSwitchChain({
    mutation: {
      onSuccess: () => {
        // Clear switching state when network switch succeeds
        setIsSwitchingNetwork(false);
      },
      onError: () => {
        // Clear switching state when network switch fails
        setIsSwitchingNetwork(false);
        setIsAutoSwitching(false);

        // Whether the user rejected the request or the wallet failed to honor
        // it (e.g. a pending-request error while a popup sits unanswered),
        // sync the network param back to the actual chain so the URL never
        // claims a network the wallet isn't on. Route validation then falls
        // back home for mainnet-only modules — the visit already had its
        // switch chance — instead of stranding a half-switched page.
        autoSwitchAttempted.current = true;
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

  // The `?upgrade=dai|mkr` deep link opens the Upgrade modal on any module
  // route. Registered before the search-param validation effect below so the
  // param is consumed before validation sees it.
  useUpgradeDeepLink();

  // Route validation: redirects that depend on chain or user state, replacing
  // the navigation-param stripping the legacy query-param validator did.
  useEffect(() => {
    const action = getRouteChainAction(intent, newChainId, {
      switchAttempted: autoSwitchAttempted.current,
      chains
    });

    // Mainnet-only module reached with an L2 network (in-app links retain the
    // current network param; deep links can carry anything): switch on the
    // user's behalf instead of bouncing home. Writing the param triggers the
    // wallet switch below; the auto flags make the shell toast explain the
    // change. The flags are skipped when the wallet is already on the target
    // chain (param merely stale) — no switch would run to clear them, and
    // TwoPane holds its switching state while isSwitchingNetwork is set.
    if (action.kind === 'switch-network') {
      autoSwitchAttempted.current = true;
      const targetChainId = chains.find(c => normalizeUrlParam(c.name) === action.network)?.id;
      if (targetChainId !== undefined && targetChainId !== chainId) {
        setIsSwitchingNetwork(true);
        setIsAutoSwitching(true);
      }
      setSearchParams(
        params => {
          params.set(QueryParams.Network, action.network);
          return params;
        },
        { replace: true }
      );
      return;
    }

    // Module not available (or coming soon) on the target chain → Balances.
    if (action.kind === 'redirect-home') {
      void navigate({ to: '/', search: keepSearch, replace: true });
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
  }, [intent, rewardContract, newChainId, rewardContracts, navigate]);

  // Run validation on the remaining query-driven search params whenever they change
  useEffect(() => {
    setSearchParams(params => validateSearchParams(params, intent), {
      replace: true
    });
  }, [searchParams, intent, newChainId]);

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
      // The wallet's chain choice is explicit — never auto-revert it. Marking
      // the visit as attempted makes route validation redirect home when the
      // new chain doesn't offer the current module, instead of prompting the
      // user to switch straight back. (The change event also fires for
      // account-only changes, with no chainId.)
      if (newChainId !== undefined) {
        autoSwitchAttempted.current = true;
      }
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
