import { useEffect, useEffectEvent, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useRouterState } from '@tanstack/react-router';
import { keepSearch, useAppSearchParams, useRouteEntityParams, useRouteIntent } from '@/lib/navigation';
import { QueryParams } from '@/lib/constants';
import { Intent } from '@/lib/enums';
import { getRouteChainAction } from '@/lib/widget-network-map';
import { pathToIntent, ROUTES } from '@/lib/routes';

import { validateSearchParams } from '@/modules/utils/validateSearchParams';
import { useAppChainId, useAvailableTokenRewardContracts } from '@/hooks';
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
import { useNetworkSwitch, useTargetChainId } from '@/modules/ui/context/NetworkSwitchContext';
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
  // The intent of the route the outlet is actually showing. `searchParams`
  // below reads from the committed match (APP-562), so during a page
  // transition it lags `intent` by a render; the search validation skips the
  // render where the two disagree (see there).
  const committedIntent = useRouteIntent();
  const { rewardContract } = useRouteEntityParams();

  const chainId = useChainId();
  const chains = useChains();
  const { connector, chainId: walletChainId, status } = useConnection();
  const { trackNetworkAutoSwitched } = useAppAnalytics();

  // Modals don't survive app navigation: a transaction modal open when the
  // route changes (a mainnet-only page redirecting home after a wallet chain
  // switch, browser back) is closed unless something is at stake — the
  // provider decides (in-flight, minimized, or launched by the new page).
  // Keyed on the pathname alone; search-param churn (network=) is not a
  // navigation. Skips the mount, which is not a change.
  const { closeOnNavigation, isModalOpen } = useTransaction();
  const lastPathnameRef = useRef(pathname);
  useEffect(() => {
    if (lastPathnameRef.current === pathname) return;
    lastPathnameRef.current = pathname;
    closeOnNavigation(pathname);
  }, [pathname, closeOnNavigation]);

  const { setIsSwitchingNetwork, setIsAutoSwitching, pendingSwitch, setPendingSwitch } = useNetworkSwitch();

  // One auto-switch chance per module visit, reset when the user navigates to
  // a different module. Marked on an attempt, on a rejected wallet switch and
  // on a manual wallet chain change, so route validation falls through to the
  // home redirect instead of re-prompting against the user's choice.
  //
  // A switch still unanswered when the user moves on keeps the app pointed at
  // its target for as long as the next module can run there. The wallet may
  // simply not have answered YET — its prompt open while the user clicks
  // around — and the request is still the wallet's to honour: asking again
  // would only queue a second prompt behind it, which a wallet holding the
  // first refuses as already pending, bouncing the user home a beat before
  // they approve. The same holds for a wallet that never answers (one stuck
  // "connecting" to the chain it is on, APP-591): a second request can't move
  // it either, and judged against the target every page renders, reading the
  // configured chain wagmi keeps pinned while the transaction modal's chain
  // guard holds any write and offers the switch as a button. No timeout: a
  // wallet prompt can sit open for as long as the user reads it.
  //
  // A module that can't run on the target ends the wait, and is judged
  // against the chain the wallet is really on. Only a link's `network=` switch
  // can get here — the route guard's own targets are the mainnet family, which
  // every module runs on — and that switch raises no switching flags, so there
  // are none to lower.
  const autoSwitchAttempted = useRef(false);
  const releaseUnusablePendingSwitch = useEffectEvent(() => {
    if (pendingSwitch === undefined) return;
    if (getRouteChainAction(intent, pendingSwitch.to, { chains }).kind === 'render') return;
    setPendingSwitch(undefined);
  });
  useEffect(() => {
    autoSwitchAttempted.current = false;
    releaseUnusablePendingSwitch();
  }, [intent]);

  const { switchChain, isPending: isSwitchPending } = useSwitchChain();
  // The wallet chain the latest request went out from. A request still in
  // flight while the wallet sits there is outstanding; once the wallet moves
  // it has answered, whatever the promise later does (a request the wallet
  // never answers never settles).
  const switchRequestedFrom = useRef<number | undefined>(undefined);
  // Asks the wallet for a chain and records the wait. The settle callbacks go
  // on the call, not the hook's options: hook-level callbacks are stored on
  // every mutation and fire for each one, so a late answer to a switch the
  // user navigated away from would clear the pending switch a newer request
  // is still waiting on and spend the new visit's chance (APP-591). Per-call
  // callbacks fire for the latest request only.
  const requestSwitch = useEffectEvent((targetChainId: number) => {
    // Only while a wallet is attached. Disconnected, `switchChain` moves the
    // config chain synchronously — there is no in-flight window to cover, and
    // a pending entry keyed on a `from` that never changes would never clear.
    if (walletChainId !== undefined) {
      setPendingSwitch({ from: walletChainId, to: targetChainId });
    }
    switchRequestedFrom.current = walletChainId;
    switchChain(
      { chainId: targetChainId },
      {
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
    );
  });

  // A wallet parked on a chain the app doesn't configure. wagmi refuses to
  // move `config.state.chainId` onto an unconfigured chain, so `useChainId()`
  // keeps naming the last configured one — the app reads and renders perfectly
  // well against it while the wallet is somewhere else entirely.
  // `useConnection().chainId` is the only place that truth surfaces, and the
  // resolver needs it: this is what used to raise the blocking "unsupported
  // network" modal, and is now just rule (b) — switch the wallet back to a
  // chain the module runs on.
  const appChainId = useAppChainId();

  // The chain a switch below has asked the wallet for and is still waiting on
  // (`pendingSwitch`, held on NetworkSwitchContext).
  //
  // This is the whole job the `network=` param used to do besides being a URL.
  // A switch went out by WRITING the param, so from the moment it was requested
  // the param named the target and every render in between validated against
  // where the app was HEADED. Take the param away and the in-flight renders
  // validate against the chain being left, and any unrelated re-render during
  // that window (a query settling, say) bounces the user home a beat before the
  // wallet answers. So the pending target is held instead — one mechanism for
  // both paths, where the off-config path already needed its own because it
  // had no param to write. It lives on the context, not here, because the
  // reward route resolves its contract against the same chain
  // (`useTargetChainId`), and the two must agree.
  const newChainId = useTargetChainId();

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

  // The side effects the route guard fires, as effect events: they read the
  // latest chain ids, pathname, switch setters and tracker without the guard
  // effect having to re-run whenever any of them changes identity.
  const beginAutoSwitch = useEffectEvent((targetChainId: number) => {
    if (targetChainId !== chainId) {
      setIsSwitchingNetwork(true);
      setIsAutoSwitching(true);
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
    requestSwitch(targetChainId);
  });
  const redirectTo = useEffectEvent(
    (
      toPath: typeof ROUTES.PORTFOLIO | typeof ROUTES.EARN,
      reason: Parameters<typeof trackRouteRedirected>[0]['reason']
    ) => {
      trackRouteRedirected({ fromPath: pathname, toPath, reason });
      void navigate({ to: toPath, search: keepSearch, replace: true });
    }
  );

  // Route validation: redirects that depend on chain or user state, replacing
  // the navigation-param stripping the legacy query-param validator did.
  useEffect(() => {
    // Not while the connection is still settling. On a reload wagmi rehydrates
    // a persisted session as `reconnecting`: the wallet's chain is already
    // readable, but the connector is a storage stub that cannot be asked for
    // anything — `switchChain` on it throws. Acting now would spend the visit's
    // one switch chance on that throw and fall through to the home redirect,
    // with nothing left to ask the wallet once it is actually there. The effect
    // re-runs when the status settles, and resolves then.
    if (status === 'connecting' || status === 'reconnecting') return;

    // A request already waiting in the wallet is this visit's switch chance
    // too: a second one would only queue behind it (see the intent reset).
    // Reached only when the next module can't use the waiting request's
    // target, and it falls through to the home redirect.
    const switchRequestOutstanding =
      isSwitchPending && walletChainId !== undefined && switchRequestedFrom.current === walletChainId;
    const action = getRouteChainAction(intent, newChainId, {
      switchAttempted: autoSwitchAttempted.current || switchRequestOutstanding,
      chains
    });

    // The current chain can't host the module. Switch on the user's behalf instead
    // of bouncing home. The auto flags make the shell toast explain the change;
    // they are skipped when the config chain won't move, because only
    // `useNetworkChangeToast` clears them and it watches that chain — raise
    // them with nothing to move and the flag leaks into the user's next manual
    // switch, mislabelling it as automatic.
    if (action.kind === 'switch-network') {
      autoSwitchAttempted.current = true;
      beginAutoSwitch(action.chainId);
      return;
    }

    // Module not available (or coming soon) on the target chain → Portfolio,
    // named explicitly: it is the one surface available on every network.
    // "/" is no longer a synonym — it forwards to the visitor's home
    // (Portfolio or Earn, APP-295), which is the wrong semantic here.
    if (action.kind === 'redirect-home') {
      // Not from under an open transaction modal. A wallet-side switch off the
      // module's chains used to redirect at once, and the navigation closed
      // the modal — so the modal's own chain guard ("Switch to X"), which was
      // active for exactly this case, was unmounted before it could be seen
      // (APP-563 #4). The guard holds the flow and offers the way back; the
      // redirect waits for the modal to close, which re-runs this effect.
      if (isModalOpen) return;
      redirectTo(ROUTES.PORTFOLIO, 'module_unavailable');
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
      redirectTo(ROUTES.EARN, 'unknown_reward');
    }
  }, [
    intent,
    rewardContract,
    newChainId,
    rewardContracts,
    navigate,
    chains,
    chainId,
    walletChainId,
    status,
    isModalOpen,
    isSwitchPending
  ]);

  // Run validation on the remaining query-driven search params whenever they
  // change. `searchParams` is only the trigger here: the functional setter is
  // handed the LIVE location search, so the outgoing page's params are never an
  // input to the write and cannot leak onto the new URL. The guard just skips
  // the redundant pass a transition would otherwise queue — the render where
  // the location (and `intent`) has moved on but the outlet has not — since
  // the commit that swaps the page changes `searchParams` and re-runs this
  // anyway. The write itself is an effect event: the setter is not a trigger.
  const validateParams = useEffectEvent(() => {
    setSearchParams(params => validateSearchParams(params, intent), {
      replace: true
    });
  });
  useEffect(() => {
    if (intent !== committedIntent) return;
    validateParams();
  }, [searchParams, intent, committedIntent, newChainId]);

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
  // A target honoured before any wallet was attached. `switchChain` then only
  // moved the config chain, and the chain the wallet reports on connecting
  // would overrule it — the param spent on nothing, which is the failure the
  // old `onConnect` handler existed for. Kept until the first connection lands
  // so it can be asked for once more, against the wallet this time.
  const honouredParamTargetRef = useRef<number | null>(null);
  const trackUrlParamSwitch = useEffectEvent((target: number) => {
    trackNetworkAutoSwitched({ trigger: 'url_param', fromChainId: chainId, toChainId: target });
  });
  // Read off the LOCATION, not the committed match the page-facing
  // `searchParams` follows: this is a question about the URL the user opened,
  // not state the page displays. A wallet settling mid-transition would
  // otherwise find the outgoing page's `network=` on the committed match and
  // spend it against a URL that no longer carries it — and an intent guard
  // cannot catch that between routes that share an intent (one reward
  // contract to another). The strip below already targets the location.
  const networkParam = useRouterState({
    select: s => (s.location.search as Record<string, string>)[QueryParams.Network] as string | undefined
  });
  useEffect(() => {
    if (networkParamHonoured.current) return;
    if (status === 'connecting' || status === 'reconnecting') return;

    if (!networkParam) return;
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

    const target = chains.find(
      chain => normalizeUrlParam(chain.name) === normalizeUrlParam(networkParam)
    )?.id;
    if (target === undefined || target === chainId) return;
    // Only a chain the module at this route can run on. Otherwise the switch
    // would land and the route guard would switch straight back one render
    // later — two wallet prompts for nothing. The guard's own resolution is the
    // answer in that case, so the param is spent without acting.
    if (getRouteChainAction(intent, target, { chains }).kind !== 'render') return;
    if (status !== 'connected') honouredParamTargetRef.current = target;
    trackUrlParamSwitch(target);
    requestSwitch(target);
  }, [status, networkParam, chains, chainId, walletChainId, intent, setSearchParams]);

  // The wallet arrives after a cold-loaded link was honoured against the
  // config chain alone: ask it once for the link's chain, then forget the link.
  useEffect(() => {
    const target = honouredParamTargetRef.current;
    if (target === null || status !== 'connected' || walletChainId === undefined) return;
    honouredParamTargetRef.current = null;
    if (walletChainId === target) return;
    if (getRouteChainAction(intent, target, { chains }).kind !== 'render') return;
    requestSwitch(target);
  }, [status, walletChainId, intent, chains]);

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
