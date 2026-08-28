import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useRouterState } from '@tanstack/react-router';
import { keepSearch, useAppSearchParams, useRouteEntityParams } from '@/lib/navigation';
import { QueryParams } from '@/lib/constants';
import { Intent } from '@/lib/enums';
import { getRouteChainAction } from '@/lib/widget-network-map';
import { pathToIntent, ROUTES } from '@/lib/routes';

import { validateSearchParams } from '@/modules/utils/validateSearchParams';
import { useAppChainId, useAvailableTokenRewardContracts, useNetworkFilter } from '@/hooks';
import { useConnection, useChainId, useChains, useSwitchChain } from 'wagmi';
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

  const { connector, chainId: walletChainId, status } = useConnection();
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
        setPendingSwitch(undefined);

        // Whether the user rejected the request or the wallet failed to honor
        // it (e.g. a pending-request error while a popup sits unanswered), the
        // visit has had its switch chance. Route validation then falls back
        // home for mainnet-only modules instead of stranding a half-switched
        // page, or re-prompting against an answer already given.
        autoSwitchAttempted.current = true;
      }
    }
  });

  // A wallet parked on a chain the app doesn't configure. wagmi refuses to
  // move `config.state.chainId` onto an unconfigured chain, so `useChainId()`
  // keeps naming the last configured one — the app reads and renders perfectly
  // well against it while the wallet is somewhere else entirely.
  // `useConnection().chainId` is the only place that truth surfaces, and the
  // resolver needs it: this is what used to raise the blocking "unsupported
  // network" modal, and is now just case (c) — switch the wallet back to a
  // chain the module runs on.
  const appChainId = useAppChainId();

  // The chain a switch below has asked the wallet for and is still waiting on.
  //
  // This is the whole job the `network=` param used to do besides being a URL.
  // A switch went out by WRITING the param, so from the moment it was requested
  // the param named the target and every render in between validated against
  // where the app was HEADED. Take the param away and the in-flight renders
  // validate against the chain being left, and any unrelated re-render during
  // that window (a query settling, say) bounces the user home a beat before the
  // wallet answers. So the pending target is held here instead — one mechanism
  // for both paths, where the off-config path already needed its own because it
  // had no param to write.
  //
  // Held as {from, to} rather than the target alone so the wait can be ended by
  // ANY move, not just the requested one: a user shown a switch prompt can open
  // their wallet and pick a third chain, and that answers the request as surely
  // as honouring it. Waiting for the target specifically would leave the app
  // pointed at a chain the wallet is not on for the rest of the session — every
  // later navigation, and the reward contracts routes resolve, reading a frozen
  // value with no way back.
  const [pendingSwitch, setPendingSwitch] = useState<{ from: number; to: number } | undefined>(undefined);
  useEffect(() => {
    // Moved — wherever to. A disconnect (undefined) ends the wait as well.
    // Cleared on an outright failure by the switch's own onError.
    if (pendingSwitch !== undefined && walletChainId !== pendingSwitch.from) {
      setPendingSwitch(undefined);
    }
  }, [walletChainId, pendingSwitch]);

  // The chain the app is pointed at: a switch we are waiting on wins, then
  // wherever the wallet actually is.
  const newChainId = pendingSwitch?.to ?? appChainId;

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
    // of bouncing home. The auto flags make the shell toast explain the change;
    // they are skipped when the config chain won't move, because only
    // `useNetworkChangeToast` clears them and it watches that chain — raise
    // them with nothing to move and the flag leaks into the user's next manual
    // switch, mislabelling it as automatic.
    if (action.kind === 'switch-network') {
      autoSwitchAttempted.current = true;
      const targetChainId = action.chainId;

      if (targetChainId !== chainId) {
        setIsSwitchingNetwork(true);
        setIsAutoSwitching(true);
      }
      // Only while a wallet is attached. Disconnected, `switchChain` moves the
      // config chain synchronously — there is no in-flight window to cover, and
      // a pending entry keyed on a `from` that never changes would never clear.
      if (walletChainId !== undefined) {
        setPendingSwitch({ from: walletChainId, to: targetChainId });
      }
      trackNetworkAutoSwitched({
        // `appChainId` parts from the config's only for a wallet on a chain the
        // app doesn't configure — a distinct story from a module simply wanting
        // another chain, since it is what used to raise the blocking
        // "unsupported network" dialog.
        trigger: appChainId !== chainId ? 'off_config_chain' : 'route_guard',
        fromChainId: appChainId,
        toChainId: targetChainId
      });
      switchChain({ chainId: targetChainId });
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
      // The marketplace, not `/earn/rewards`: that path lost its overview screen
      // with the flip and is now a redirect-only route that forwards here, so
      // aiming at it would resolve this one navigation through two.
      trackRouteRedirected({ fromPath: pathname, toPath: ROUTES.EARN, reason: 'unknown_reward' });
      void navigate({ to: ROUTES.EARN, search: keepSearch, replace: true });
    }
  }, [intent, rewardContract, newChainId, networkFilter, rewardContracts, navigate]);

  // Run validation on the remaining query-driven search params whenever they change
  useEffect(() => {
    setSearchParams(params => validateSearchParams(params, intent), {
      replace: true
    });
  }, [searchParams, intent, newChainId]);

  // `?network=` is retired as app state. It is still HONOURED once, so the
  // bookmarks, support links and shared URLs minted while it was live keep
  // working, and then stripped — it is a migration affordance now, not a
  // channel. Everything that used to write it calls `switchChain` directly.
  //
  // Waits for the connection to settle rather than firing on mount: wagmi
  // reconnects asynchronously, and a link opened cold would otherwise be
  // honoured against the config chain and then overruled a beat later by the
  // chain the wallet actually reconnects on — the param spent on nothing. This
  // is what the old `onConnect` handler was for.
  const networkParamHonoured = useRef(false);
  useEffect(() => {
    if (networkParamHonoured.current) return;
    if (status === 'connecting' || status === 'reconnecting') return;

    const param = searchParams.get(QueryParams.Network);
    if (!param) return;
    networkParamHonoured.current = true;

    // Spent either way: an unknown or garbage value has had its one chance and
    // should not sit in the URL implying the app is listening to it.
    setSearchParams(
      params => {
        params.delete(QueryParams.Network);
        return params;
      },
      { replace: true }
    );

    const target = chains.find(chain => normalizeUrlParam(chain.name) === normalizeUrlParam(param))?.id;
    if (target === undefined || target === chainId) return;
    trackNetworkAutoSwitched({ trigger: 'url_param', fromChainId: chainId, toChainId: target });
    if (walletChainId !== undefined) setPendingSwitch({ from: walletChainId, to: target });
    switchChain({ chainId: target });
  }, [status, searchParams, chains, chainId, walletChainId, setSearchParams, switchChain]);

  useEffect(() => {
    // The wallet's chain choice is explicit — never auto-revert it. Marking the
    // visit as attempted makes route validation redirect home when the new
    // chain doesn't offer the current module, instead of prompting the user to
    // switch straight back. (The change event also fires for account-only
    // changes, with no chainId.)
    //
    // This holds for a chain the app doesn't configure at all, which is worth
    // saying because the switch-back that replaced the blocking "unsupported
    // network" dialog makes it tempting to fire here. It shouldn't: reaching
    // for the wallet and changing its network is a deliberate act, and
    // answering it with an immediate prompt to undo it is the app arguing with
    // the user. What earns a prompt is the user then asking for something that
    // NEEDS a chain — navigating to a product — and the reset above, keyed on
    // the module, is what grants it. Until then the app just renders: reads run
    // against the configured chain wagmi keeps pinned, and a transaction is
    // stopped by the modal's own guard, which offers the switch as a button
    // rather than taking it.
    //
    // This listener used to mirror the chain into `network=` as well. That is
    // gone with the param; the one line left is the load-bearing half.
    const handleChainChange = ({ chainId: changedTo }: { chainId?: number | undefined }) => {
      if (changedTo !== undefined) {
        autoSwitchAttempted.current = true;
      }
    };

    const emitter = connector?.emitter;
    emitter?.on('change', handleChainChange);

    // Cleanup function to remove the listener
    return () => {
      emitter?.off('change', handleChainChange);
    };
  }, [connector]);

  return { intent };
}
