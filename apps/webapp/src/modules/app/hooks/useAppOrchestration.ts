import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useRouterState } from '@tanstack/react-router';
import { keepSearch, useAppSearchParams, useRouteEntityParams } from '@/lib/navigation';
import { QueryParams } from '@/lib/constants';
import { Intent } from '@/lib/enums';
import { getRouteChainAction } from '@/lib/widget-network-map';
import { pathToIntent, ROUTES } from '@/lib/routes';

import { validateSearchParams } from '@/modules/utils/validateSearchParams';
import { useAvailableTokenRewardContracts, useNetworkFilter } from '@/hooks';
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
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { useUpgradeDeepLink } from '@/modules/upgrade/hooks/useUpgradeDeepLink';
import { trackRouteRedirected } from '@/modules/analytics/lib/trackRouteRedirected';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import type { AutoSwitchTrigger } from '@/modules/analytics/constants';

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
  // Rule (a) of the route's chain resolution: a module opens on the filtered
  // network when it runs there. Read here rather than inside the effect so a
  // filter change while sitting on a module route is seen — the effect's
  // `autoSwitchAttempted` guard is what keeps it from re-prompting.
  const { chainId: networkFilter } = useNetworkFilter();

  const { connector, chainId: walletChainId } = useConnection();
  const { trackNetworkAutoSwitched } = useAppAnalytics();

  // Modals don't survive app navigation: a transaction modal open when the
  // route changes (a mainnet-only page redirecting home after a wallet chain
  // switch, browser back) is closed unless something is at stake — the
  // provider decides (in-flight, minimized, or launched by the new page).
  // Keyed on the pathname alone; search-param churn (network=) is not a
  // navigation. Skips the mount, which is not a change.
  const { closeOnNavigation } = useTransaction();
  const lastPathnameRef = useRef(pathname);
  useEffect(() => {
    if (lastPathnameRef.current === pathname) return;
    lastPathnameRef.current = pathname;
    closeOnNavigation(pathname);
  }, [pathname, closeOnNavigation]);

  // Attribution hand-off between the route guard (which writes the network
  // param) and the param-driven switch effect below that acts on it (D-2).
  const autoSwitchTriggerRef = useRef<AutoSwitchTrigger | null>(null);

  useConnectionEffect({
    // Once the user connects their wallet, check if the network param is set and switch chains if necessary
    onConnect(data) {
      const parsedChainId = chains.find(
        chain => normalizeUrlParam(chain.name) === normalizeUrlParam(network || '')
      )?.id;
      if (parsedChainId) {
        if (parsedChainId !== chainId) {
          // Fires on silent auto-reconnects too — is_reconnect keeps those
          // distinguishable from a fresh connect's prompt (APP-444 D-2).
          trackNetworkAutoSwitched({
            trigger: 'connect',
            fromChainId: chainId,
            toChainId: parsedChainId,
            isReconnect: data.isReconnected
          });
        }
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
        // The app stops pointing at a chain the wallet refused to move to.
        setPendingSwitchChainId(undefined);

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

  // A wallet parked on a chain the app doesn't configure. wagmi refuses to
  // move `config.state.chainId` onto an unconfigured chain, so `useChainId()`
  // (and with it the network param, which mirrors it) keeps naming the last
  // configured one — the app reads and renders perfectly well against it while
  // the wallet is somewhere else entirely. `useConnection().chainId` is the
  // only place that truth surfaces, and the resolver needs it: this is what
  // used to raise the blocking "unsupported network" modal, and is now just
  // case (c) — switch the wallet back to a chain the module runs on.
  const offConfigChainId =
    walletChainId !== undefined && !chains.some(chain => chain.id === walletChainId)
      ? walletChainId
      : undefined;

  // The chain an off-config switch below has asked the wallet for and is still
  // waiting on. A normal switch gets this for free: it goes out by writing
  // `network=`, so the param names the target from the moment it is requested
  // and every render in between validates against where the app is HEADED. An
  // off-config switch has no param to write (see below), so without this the
  // in-flight renders validate against the chain being left — and any unrelated
  // re-render during that window (a query settling, say) bounces the user home
  // a beat before the wallet answers.
  const [pendingSwitchChainId, setPendingSwitchChainId] = useState<number | undefined>(undefined);
  useEffect(() => {
    // Landed. Cleared on failure by the switch's own onError.
    if (pendingSwitchChainId !== undefined && walletChainId === pendingSwitchChainId) {
      setPendingSwitchChainId(undefined);
    }
  }, [walletChainId, pendingSwitchChainId]);

  // The chain the app is pointed at: a switch we are waiting on wins, then the
  // network param (so navigation validates against the target network while a
  // wallet switch is in flight), then the off-config wallet chain — which no
  // param can describe — and finally the config's own.
  const newChainId =
    pendingSwitchChainId ??
    offConfigChainId ??
    (network
      ? (chains.find(chain => normalizeUrlParam(chain.name) === normalizeUrlParam(network))?.id ?? chainId)
      : chainId);

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
      filterChainId: networkFilter,
      chains
    });

    // The module belongs on a different chain than the app is pointed at —
    // either the user's network filter names one this module runs on, or the
    // current chain can't host it at all. Switch on the user's behalf instead
    // of bouncing home: in-app links retain the current network param and deep
    // links can carry anything. Writing the param triggers the wallet switch
    // below; the auto flags make the shell toast explain the change. The flags
    // are skipped when the wallet is already on the target chain (param merely
    // stale) — no switch would run to clear them. useNetworkChangeToast owns
    // the user-facing feedback and clears isSwitchingNetwork once the wallet
    // settles.
    if (action.kind === 'switch-network') {
      autoSwitchAttempted.current = true;
      const targetChainId = action.chainId;

      // An off-config wallet can't be moved through the network param: the
      // param already names `chainId`, which wagmi pinned to a configured chain
      // while the wallet went elsewhere, so there is no param change for the
      // switch effect below to react to. Ask the wallet directly.
      if (offConfigChainId !== undefined) {
        setIsSwitchingNetwork(true);
        setIsAutoSwitching(true);
        // Stand in for the `network=` write the configured path gets: from here
        // until the wallet answers, the app is pointed at the target.
        setPendingSwitchChainId(targetChainId);
        trackNetworkAutoSwitched({
          trigger: 'off_config_chain',
          fromChainId: offConfigChainId,
          toChainId: targetChainId
        });
        switchChain({ chainId: targetChainId });
        return;
      }

      if (targetChainId !== chainId) {
        setIsSwitchingNetwork(true);
        setIsAutoSwitching(true);
        autoSwitchTriggerRef.current = 'route_guard';
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

    // Module not available (or coming soon) on the target chain → Portfolio,
    // named explicitly: it is the one surface available on every network.
    // "/" is no longer a synonym — it forwards to the visitor's home
    // (Portfolio or Earn, APP-295), which is the wrong semantic here.
    if (action.kind === 'redirect-home') {
      trackRouteRedirected({ fromPath: pathname, toPath: ROUTES.PORTFOLIO, reason: 'module_unavailable' });
      void navigate({ to: ROUTES.PORTFOLIO, search: keepSearch, replace: true });
      return;
    }

    // Reward detail routes must point at a reward contract available on the
    // target chain. The intent check pins the branch to rewards routes: the
    // matched $rewardContract param lags the location by a render, and acting
    // on the stale param mid-transition re-navigates forever (redirect loop).
    if (
      intent === Intent.REWARDS_INTENT &&
      rewardContract !== undefined &&
      !rewardContracts?.some(c => c.contractAddress?.toLowerCase() === rewardContract.toLowerCase())
    ) {
      trackRouteRedirected({ fromPath: pathname, toPath: '/earn/rewards', reason: 'unknown_reward' });
      void navigate({ to: '/earn/rewards', search: keepSearch, replace: true });
    }
  }, [intent, rewardContract, newChainId, networkFilter, rewardContracts, navigate]);

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
        // Read-and-clear: 'route_guard' when the mainnet-only guard wrote the
        // param this effect is reacting to, else a deep link / stale URL.
        const trigger = autoSwitchTriggerRef.current ?? 'url_param';
        autoSwitchTriggerRef.current = null;
        trackNetworkAutoSwitched({ trigger, fromChainId: chainId, toChainId: parsedChainId });
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
      //
      // Only for a chain the app configures, though. A chain it doesn't hosts
      // no module ANYWHERE, so there is no choice among the app's networks to
      // defer to — honouring it just strands the user. Landing on one instead
      // CLEARS the flag, which hands rule (c) the one switch-back attempt that
      // replaced the blocking "unsupported network" dialog. Clearing rather
      // than merely not setting matters: the flag is scoped to a module visit,
      // and the surfaces a wallet is most likely to be sitting on when the user
      // reaches for their wallet — Portfolio and Earn — are one long visit that
      // spent its chance on the connect event. A decline puts the flag back up
      // (see the switch's onError), so this is one prompt per arrival, not a
      // loop.
      if (newChainId !== undefined) {
        autoSwitchAttempted.current = chains.some(chain => chain.id === newChainId);
      }
      const newChainName = chains.find(c => c.id === newChainId)?.name;
      if (newChainName) {
        const normalizedNewChainName = normalizeUrlParam(newChainName);
        const currentNetwork = searchParams.get(QueryParams.Network);
        // Only update if the network actually changed (compare normalized to avoid case-only diffs)
        if (normalizeUrlParam(currentNetwork || '') !== normalizedNewChainName) {
          // `replace`: a chain switch is not a place in the history. Back from
          // one would restore the previous `network=`, which this app reads as
          // an instruction to switch straight back. This is now the ONLY writer
          // of the param on a switch — the network dropdowns used to write it
          // themselves (with replace) and no longer touch the router at all.
          setSearchParams(
            params => {
              params.set(QueryParams.Network, normalizedNewChainName);
              return params;
            },
            { replace: true }
          );
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
