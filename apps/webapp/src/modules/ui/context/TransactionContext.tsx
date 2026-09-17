import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  ReactNode
} from 'react';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import { InProgress, Cancel } from '@/modules/icons';
import { toError, type TxMutateVariables } from '@/hooks';
import { getTransactionLink } from '@/utils';
import { Trans } from '@lingui/react/macro';
import { toast, toastWithClose } from '@/components/ui/use-toast';
import { MinimizedTransactionToast } from '@/modules/ui/components/MinimizedTransactionToast';
import { TransactionNoticeToast } from '@/modules/ui/components/TransactionNoticeToast';
import { TransactionSuccessToast } from '@/modules/ui/components/TransactionSuccessToast';
import { useIsSafeWallet, useIsBatchSupported } from '@/hooks';
import { useChainId, useConnection, useChains } from 'wagmi';
import { chainSwitchTarget } from '@/lib/chainAvailability';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import type { NetworkSwitchSource } from '@/modules/analytics/constants';
import { useAnalyticsFlow } from '@/modules/analytics/context/AnalyticsFlowContext';
import { reportError } from '@/modules/sentry/reportError';
import { classifyTransactionError } from '@/modules/analytics/lib/classifyTransactionError';
import { isUserRejectedRequestError } from '@/modules/utils/isUserRejectedRequestError';
import { MODAL_EXIT_MS } from '@/modules/ui/animation/constants';
import type { ChainGuard } from '@/modules/ui/components/TransactionModal';
import {
  isFlowLaunch,
  type LaunchInput,
  type LiveFlowProps,
  type TransactionConfig,
  type TransactionEntry,
  type TxCallbacks,
  type TransactionContextValue
} from './transactionContract';
import {
  allowAllGate,
  allowAllPreflight,
  type GateControls,
  type GatePhase,
  type GateStatusCopy,
  type GateTrigger,
  type PreflightHook,
  type PreTransactionGate,
  type TransactionPreflight
} from './preTransactionGate';
import type { TransactionStep } from '@/modules/ui/components/transactionStepsModel';
import { createTransactionSession, type TransactionSession } from './transactionSession';
import {
  TransactionShellContext,
  type FireOverrides,
  type ShellView,
  type TransactionShell
} from './transactionShell';
import { ConfigFlow, ConfigFlowContext } from './ConfigFlow';

// Stable id for the single "transaction running in the background" toast, so repeated
// updates (and StrictMode's double-invoke) replace it rather than stacking.
const MINIMIZED_TOAST_ID = 'transaction-minimized';
// The confirmed-transaction toast the modal hands off to on its way out.
const SUCCESS_TOAST_ID = 'transaction-success';
const ABANDONED_TOAST_ID = 'transaction-abandoned';
const PENDING_BLOCK_TOAST_ID = 'transaction-pending-block';

// The dapp cannot dismiss a wallet's signature prompt — abandoning a session
// only stops the app from listening. Tell the user to finish the job wallet-side.
function notifyRequestAbandoned() {
  toastWithClose(
    () => (
      <TransactionNoticeToast
        icon={<Cancel />}
        title={<Trans>Transaction request discarded</Trans>}
        description={<Trans>If your wallet still shows the request, reject it there.</Trans>}
      />
    ),
    { id: ABANDONED_TOAST_ID, duration: 8000 }
  );
}

// The signature-phase counterpart: what may still be sitting in the wallet is
// the terms sign request, not a transaction — say so, or the copy reads as if
// a transaction was about to move funds.
function notifySignatureRequestAbandoned() {
  toastWithClose(
    () => (
      <TransactionNoticeToast
        icon={<Cancel />}
        title={<Trans>Signature request discarded</Trans>}
        description={<Trans>If your wallet still shows the request, reject it there.</Trans>}
      />
    ),
    { id: ABANDONED_TOAST_ID, duration: 8000 }
  );
}

// The wallet moved to another network after a write was attempted, so the
// session was ended for it (see the chain-change close below).
function notifyClosedOnChainChange() {
  toastWithClose(
    () => (
      <TransactionNoticeToast
        icon={<Cancel />}
        title={<Trans>Transaction closed</Trans>}
        description={
          <Trans>Your wallet switched networks. Start again on the network you want to use.</Trans>
        }
      />
    ),
    { id: ABANDONED_TOAST_ID, duration: 8000 }
  );
}

// A gate verdict (screening, terms signature) resolved after the wallet moved
// to another chain the flow supports, so the click's action was refused and
// the first screen re-derived for the new chain. The chain guard is silent
// there (the chain is fine), so this is the only thing that says why the click
// went nowhere.
function notifyReviewAgainOnChainChange() {
  toastWithClose(
    () => (
      <TransactionNoticeToast
        icon={<Cancel />}
        title={<Trans>Network changed</Trans>}
        description={
          <Trans>Your wallet switched networks while confirming. Review the details and confirm again.</Trans>
        }
      />
    ),
    { id: ABANDONED_TOAST_ID, duration: 8000 }
  );
}

function shouldCaptureTransactionError(error: Error): boolean {
  return !isUserRejectedRequestError(error);
}

// Whether the wallet's chain is outside a flow's declared set (APP-528). An
// empty set is a chain-agnostic flow and never trips the guard.
function offSupportedChains(supportedChainIds: readonly number[], chainId: number): boolean {
  return supportedChainIds.length > 0 && !supportedChainIds.includes(chainId);
}

/** What the provider reads off a config launch until its modal registers. */
function liveFromConfig(config: TransactionConfig): LiveFlowProps {
  return {
    title: config.title,
    usdValue: config.usdValue,
    analytics: config.analytics,
    toast: config.toast,
    onSuccess: config.onSuccess,
    onError: config.onError,
    hasEntry: !!config.entry
  };
}

// The transaction-orchestration contract is frozen in ./transactionContract.
const TransactionContext = createContext<TransactionContextValue | null>(null);

// Internal: the DOM node on the modal's entry screen where a config launch's
// `backgroundContent` portals its visible inputs. Null when no entry screen is
// mounted (e.g. minimized) — the host then renders its inputs inline in the
// hidden background instead.
const EntrySlotContext = createContext<HTMLElement | null>(null);

/** The dialog entry slot to portal editable inputs into, or null when absent. */
export function useEntrySlot() {
  return useContext(EntrySlotContext);
}

// The injected enhanced-screening preflight hook (see `usePreflight` on the
// provider), shared with flows whose OWN surface fires the transaction.
const PreflightHookContext = createContext<PreflightHook>(allowAllPreflight);

/**
 * The enhanced-screening preflight (APP-517) for a surface that fires the
 * transaction itself — a `skipReview` flow's page-side Confirm (the stake
 * takeovers). The modal's first screen normally runs this check, warms the
 * verdict and holds its CTA; with no first screen the takeover has to: pass
 * the live USD notional and whether the flow's own gating would let the user
 * proceed, and hold the Confirm the same way the modal does (pending →
 * loading, blocked → disabled with the message shown). The gate still
 * enforces the verdict at fire time through the same query cache; this is
 * the user-facing half.
 */
export function useTransactionPreflight({
  usdValue,
  actionable
}: {
  usdValue: number | undefined;
  actionable: boolean;
}): TransactionPreflight {
  const usePreflight = useContext(PreflightHookContext);
  return usePreflight({ usdValue, active: true, actionable });
}

/** A session host retained after its close, so the modal can play its exit animation. */
type ExitingHost = {
  session: TransactionSession;
  view: ShellView;
  /** A config launch's last config, for the adapter's render. */
  config: TransactionConfig | null;
};

export function TransactionProvider({
  children,
  // The pre-transaction gate (see ./preTransactionGate). Injectable so tests
  // can exercise the deny/async paths; the app mounts the allow-all stub until
  // the signature verdict lands (APP-501).
  gate = allowAllGate,
  // The enhanced-screening preflight (APP-517), a HOOK the modal calls
  // unconditionally every render — its identity must be stable for the life of
  // the provider (the app passes a module-level hook; tests pass stable fakes).
  usePreflight = allowAllPreflight
}: {
  children: ReactNode;
  gate?: PreTransactionGate;
  usePreflight?: PreflightHook;
}) {
  // Warm the EIP-5792 capability probe from the provider, which is mounted for the whole
  // session, so it runs on connect rather than the first time a flow needs the answer.
  useIsBatchSupported();

  const [open, setOpen] = useState(false);
  // Minimized = modal hidden but the transaction keeps running. Distinct from
  // closed (which tears the transaction down); see minimize()/restore() below.
  const [minimized, setMinimized] = useState(false);
  // Ref twin of `minimized`, written in the same callbacks that set the state,
  // so closeOnNavigation (called from a route effect) reads the live value.
  const minimizedRef = useRef(false);
  // The entry-screen portal target, registered by the modal (see EntrySlotContext).
  const [entrySlotEl, setEntrySlotEl] = useState<HTMLElement | null>(null);
  const launchCountRef = useRef(0);
  const [txStatus, setTxStatus] = useState<TxStatus>(TxStatus.IDLE);
  const [currentStep, setCurrentStep] = useState(0);
  // An on-chain step of this session has mined: the engine's paused run is the
  // only memory of it, so a failure must resume, not reopen the inputs — the
  // modal withholds Back (APP-448). Unlike `currentStep`, ignores the gate's
  // off-chain prelude.
  const [hasMinedStep, setHasMinedStep] = useState(false);
  // Written on every ERROR (true/false), so it is always fresh for the failure
  // the modal is showing; never read outside ERROR.
  const [userRejected, setUserRejected] = useState(false);
  // Off-chain prelude steps the gate mounted for this session (the terms
  // signature step, APP-501). State for rendering, ref for synchronous reads
  // in the close snapshot. Reset on every launch and close.
  const [preludeSteps, setPreludeSteps] = useState<TransactionStep[] | null>(null);
  const preludeStepsRef = useRef<TransactionStep[] | null>(null);
  // Gate-owned status copy (see GateStatusCopy): replaces the flow's status
  // message/subtitle while a gate status is driving the modal.
  const [gateCopy, setGateCopy] = useState<GateStatusCopy | null>(null);
  const gateCopyRef = useRef<GateStatusCopy | null>(null);
  // A config launch's config: state so `updateModalContent` re-renders the
  // adapter, ref for synchronous merges. Null for a flow launch.
  const [config, setConfig] = useState<TransactionConfig | null>(null);
  const configRef = useRef<TransactionConfig | null>(null);
  // What the rendered modal registers (see `LiveFlowProps`): the callbacks the
  // provider fires on settle and the copy/attribution its toasts and events
  // carry. Read at fire time, never during render.
  const liveRef = useRef<LiveFlowProps | null>(null);
  // The host of a closed session, held for the length of the modal's exit
  // animation so Radix can play it; the teardown itself is not deferred.
  const [exiting, setExiting] = useState<ExitingHost | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The live session (see ./transactionSession): created by launch(), marked
  // closed by handleClose(). State so the engine callbacks are bound to the
  // session that rendered them; ref for synchronous reads. An in-flight write
  // outlives its host — the wallet can accept in the same instant the user
  // dismisses the modal — and a callback from a closed session must drop
  // itself, or the orphaned engine's onStart would stamp LOADING onto the
  // torn-down provider and brick every later launch() on the in-progress guard.
  const [session, setSession] = useState<TransactionSession | null>(null);
  const sessionRef = useRef<TransactionSession | null>(null);
  // The session whose write is in flight, latched at onMutate. A page-hosted
  // engine (convert, pendle redeem, the stake takeovers) keeps its host mounted
  // after teardown, so react-query hands its LIVE mutation the newest options
  // and a late callback from an abandoned write would arrive bound to the
  // CURRENT session. onMutate always fires synchronously from the user's
  // confirm, so the session it records is the one that started the write; the
  // settle callbacks check that.
  const writeSessionRef = useRef<TransactionSession | null>(null);
  // Mirrors txStatus for reads inside callbacks (avoids setState-inside-updater impurity).
  const txStatusRef = useRef<TxStatus>(TxStatus.IDLE);
  // In-flight gate latch: the session whose verdict is currently pending, null
  // when idle. While set (for the live session), further gated calls are
  // ignored — two allows would mean two onConfirms.
  const gateInFlightRef = useRef<TransactionSession | null>(null);
  // Which gate phase currently owns an INITIALIZED status (null = the engine
  // does, via onMutate). handleClose and launch read it to tell an abandoned
  // WALLET TRANSACTION (cancelled analytics + the discarded-request toast)
  // from an abandoned gate phase, where no transaction ever started.
  const gatePhaseRef = useRef<GatePhase | null>(null);

  const chainId = useChainId();
  const { address, chainId: connectedChainId } = useConnection();
  const chains = useChains();

  // The chain the guard below judges: the wallet's OWN, not wagmi's.
  // `useChainId()` reads `config.state.chainId`, which wagmi refuses to move
  // onto a chain the app doesn't configure — park a wallet on one and it keeps
  // reporting the last configured chain. Falls back to the config chain when
  // disconnected, where there is no wallet chain to speak of.
  const guardChainId = connectedChainId ?? chainId;

  // Fire-time read for the gate's chain check (see runGated): a verdict that
  // resolves after a wallet chain switch must see the wallet's CURRENT chain.
  const chainIdRef = useRef(guardChainId);
  useEffect(() => {
    chainIdRef.current = guardChainId;
  }, [guardChainId]);
  const {
    handleSwitchChain,
    isSwitchPending: switchPending,
    switchVariables,
    canSwitchChain
  } = useNetworkSwitch();
  const isSafeWallet = useIsSafeWallet();

  const {
    trackWidgetReviewViewed,
    trackTransactionStarted,
    trackTransactionCompleted,
    trackTermsSignatureDeclined
  } = useAppAnalytics();
  const { startNewFlow, getFlowId } = useAnalyticsFlow();

  // One decline event per occurrence, attributed to the gated flow (which the
  // gate itself never sees). Both decline paths funnel here: the wallet
  // rejection (via the gate's reportSignatureRejected control) and the
  // abandonment (handleClose / launch below).
  const emitTermsSignatureDeclined = useCallback(
    (method: 'wallet_rejected' | 'abandoned') => {
      const analytics = liveRef.current?.analytics;
      trackTermsSignatureDeclined({
        method,
        chainId,
        widgetName: analytics?.widgetName,
        flow: analytics?.flow,
        action: analytics?.action,
        flowId: sessionRef.current?.flowId
      });
    },
    [chainId, trackTermsSignatureDeclined]
  );

  // A user-initiated close (or relaunch) found the modal at INITIALIZED. What
  // that abandons depends on who owns the status (see gatePhaseRef): the
  // engine's wallet transaction, the gate's pending sign request, or the
  // gate's screening call — which has nothing in the wallet and nothing in
  // the funnel, so it tears down silently. Only the engine case is a
  // cancelled TRANSACTION.
  const handleInitializedAbandon = useCallback(() => {
    if (gatePhaseRef.current === 'screening') return;
    if (gatePhaseRef.current === 'signature') {
      emitTermsSignatureDeclined('abandoned');
      startNewFlow();
      notifySignatureRequestAbandoned();
      return;
    }
    const analytics = liveRef.current?.analytics;
    if (analytics) {
      trackTransactionCompleted({
        widgetName: analytics.widgetName,
        chainId,
        txStatus: 'cancelled',
        action: analytics.action,
        flow: analytics.flow,
        data: analytics.data,
        flowId: sessionRef.current?.flowId
      });
      startNewFlow();
    }
    notifyRequestAbandoned();
  }, [chainId, trackTransactionCompleted, startNewFlow, emitTermsSignatureDeclined]);

  const trackReviewViewed = useCallback(
    (live: LiveFlowProps | null, flowId: string | undefined) => {
      if (!live?.analytics) return;
      trackWidgetReviewViewed({
        widgetName: live.analytics.widgetName,
        chainId,
        flow: live.analytics.flow,
        action: live.analytics.action,
        data: live.analytics.data,
        flowId
      });
    },
    [chainId, trackWidgetReviewViewed]
  );

  const launch = useCallback(
    (input: LaunchInput) => {
      // One BROADCAST transaction at a time: it's on-chain and will resolve, so
      // don't start a new session — bring the pending modal back into view and
      // say why. Launching here would remount the host and strand the running tx.
      if (txStatusRef.current === TxStatus.LOADING && sessionRef.current) {
        setMinimized(false);
        toastWithClose(
          () => (
            <TransactionNoticeToast
              icon={<InProgress />}
              title={<Trans>Transaction in progress</Trans>}
              description={<Trans>It needs to finish before you can start a new one.</Trans>}
            />
          ),
          { id: PENDING_BLOCK_TOAST_ID, duration: 8000 }
        );
        return;
      }

      // A session still at INITIALIZED has nothing on-chain — starting a new
      // flow abandons it (see handleInitializedAbandon) and falls through to a
      // fresh launch, which resets all session state and remounts the hosts.
      if (txStatusRef.current === TxStatus.INITIALIZED) {
        handleInitializedAbandon();
      }

      // Replacing a session ends it FIRST: an engine the wallet already
      // answered may fire callbacks right after, and they must see themselves
      // as stale.
      if (sessionRef.current) sessionRef.current.closed = true;
      const flow = isFlowLaunch(input);
      launchCountRef.current += 1;
      const next = createTransactionSession({
        id: input.sessionId ?? null,
        key: launchCountRef.current,
        launch: {
          supportedChainIds: input.supportedChainIds,
          chainGuardReason: input.chainGuardReason,
          skipReview: !!input.skipReview
        },
        render: flow ? input.render : () => <ConfigFlow />,
        chainId: chainIdRef.current,
        // A route change closes an idle session, but never one the destination
        // page itself just opened: a page that launches on mount does so in a
        // child effect, i.e. AFTER the router committed the new location and
        // BEFORE the shell's route effect asks us to close.
        launchPathname: window.location.pathname,
        // Latched after any abandon rotation above.
        flowId: getFlowId()
      });
      sessionRef.current = next;
      setSession(next);
      configRef.current = flow ? null : input;
      setConfig(flow ? null : input);
      // A config launch is fully known here; a flow launch registers on its
      // first render (see `register` below).
      liveRef.current = flow ? null : liveFromConfig(input);
      minimizedRef.current = false;
      setTxStatus(TxStatus.IDLE);
      txStatusRef.current = TxStatus.IDLE;
      setCurrentStep(0);
      setHasMinedStep(false);
      preludeStepsRef.current = null;
      setPreludeSteps(null);
      gateCopyRef.current = null;
      setGateCopy(null);
      gateInFlightRef.current = null;
      gatePhaseRef.current = null;
      setMinimized(false);
      setOpen(true);

      // Review-first flows open on the review screen, so launch IS the review
      // view — and so is a `skipReview` launch. Entry-first flows fire their
      // review event at the entry→review transition instead (reviewStage
      // below), and entry-only flows (claims, upgrade) emit none.
      if (!flow && !input.entry) trackReviewViewed(liveRef.current, next.flowId);
    },
    [handleInitializedAbandon, getFlowId, trackReviewViewed]
  );

  // The modal registers its live props every render. A flow launch's first
  // registration is also where its review-viewed event fires (a config
  // launch's fired in launch()).
  const registeredRef = useRef<TransactionSession | null>(null);
  const register = useCallback(
    (owner: TransactionSession, live: LiveFlowProps) => {
      if (owner !== sessionRef.current) return;
      liveRef.current = live;
      if (registeredRef.current !== owner) {
        registeredRef.current = owner;
        if (!configRef.current && !live.hasEntry) trackReviewViewed(live, owner.flowId);
      }
    },
    [trackReviewViewed]
  );

  // Entry→review transition of a three-screen flow. Read off the live
  // registration: an editable body keeps its analytics current while the user
  // edits, so this is the blob matching what the review is about to show.
  const handleReviewStage = useCallback(() => {
    trackReviewViewed(liveRef.current, sessionRef.current?.flowId);
  }, [trackReviewViewed]);

  const updateModalContent = useCallback<TransactionContextValue['updateModalContent']>(
    (sessionId, partial) => {
      if (sessionId !== sessionRef.current?.id) return;
      const prev = configRef.current;
      if (!prev) return;
      const { entry: entryPatch, ...rest } = partial;
      const next = { ...prev, ...rest };
      // Merge the entry partial so an in-modal body can flip confirmDisabled /
      // refresh its rows WITHOUT re-pushing `content` (which would remount it).
      if (entryPatch) {
        next.entry = { ...(prev.entry ?? {}), ...entryPatch } as TransactionEntry;
      }
      // Both refs are assigned synchronously (not inside the setState updater):
      // a two-action entry pushes the clicked mode's steps/analytics and executes
      // in the same click, and the engine's onMutate — which also fires
      // synchronously — reads analytics off the live ref.
      configRef.current = next;
      liveRef.current = liveFromConfig(next);
      setConfig(next);
    },
    []
  );

  const resetTransactionProgress = useCallback(() => {
    setCurrentStep(0);
  }, []);

  // Back returns to an editable first screen, so the status returns to IDLE
  // with it — the entry body's pushes freeze at any other status, which left
  // the review showing the rejected values (APP-448).
  const handleBack = useCallback(() => {
    setCurrentStep(0);
    setTxStatus(TxStatus.IDLE);
    txStatusRef.current = TxStatus.IDLE;
  }, []);

  const handleClose = useCallback(() => {
    // Closing at INITIALIZED abandons the pending request — whose semantics
    // depend on who owns the status (see handleInitializedAbandon). Read the
    // status from the ref, not the render's closure.
    if (txStatusRef.current === TxStatus.INITIALIZED) {
      handleInitializedAbandon();
    }

    // Hold the host on screen, frozen, before tearing the session down, so the
    // modal can finish leaving. Dropped once the animation is over, or
    // superseded if a new transaction launches inside that window.
    const live = sessionRef.current;
    if (live) {
      setExiting({
        session: live,
        config: configRef.current,
        view: {
          txStatus: txStatusRef.current,
          currentStep,
          hasMinedStep,
          userRejected,
          preludeSteps: preludeStepsRef.current,
          gateCopy: gateCopyRef.current
        }
      });
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      exitTimerRef.current = setTimeout(() => setExiting(null), MODAL_EXIT_MS);
    }

    // End the session FIRST: an engine the wallet already answered may fire
    // callbacks right after this teardown, and they must see themselves as
    // stale (see `session` above).
    if (live) live.closed = true;
    sessionRef.current = null;
    setSession(null);
    setOpen(false);
    setMinimized(false);
    minimizedRef.current = false;
    setTxStatus(TxStatus.IDLE);
    txStatusRef.current = TxStatus.IDLE;
    setCurrentStep(0);
    setHasMinedStep(false);
    preludeStepsRef.current = null;
    setPreludeSteps(null);
    gateCopyRef.current = null;
    setGateCopy(null);
    gateInFlightRef.current = null;
    gatePhaseRef.current = null;
    setConfig(null);
    configRef.current = null;
    liveRef.current = null;
  }, [handleInitializedAbandon, currentStep, hasMinedStep, userRejected]);

  // The gate calls these from user events, so the ref is always current by then.
  const handleCloseRef = useRef(handleClose);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  });

  // A modal does not survive a wallet chain switch once a write has been
  // attempted: everything the session holds past IDLE was built for the chain
  // the write started on, and nothing re-derives it for another. At IDLE the
  // switch is legitimate (the entry rebuilds, the review is the guard's to
  // hold) so the chain is adopted; in flight (INITIALIZED / LOADING) nothing
  // closes until the prompt or broadcast settles, and this re-runs when it
  // does; otherwise the session ends now, with a toast that says why. Only
  // while a wallet is attached: `guardChainId` falls back to the config chain
  // when the connection drops. `txStatus` is in the deps as the re-run trigger
  // for the in-flight deferral.
  useEffect(() => {
    const live = sessionRef.current;
    if (!open || !live || !address) return;
    if (live.chainId === guardChainId) return;
    const status = txStatusRef.current;
    if (status === TxStatus.IDLE) {
      live.chainId = guardChainId;
      return;
    }
    if (status === TxStatus.INITIALIZED || status === TxStatus.LOADING) return;
    handleCloseRef.current();
    notifyClosedOnChainChange();
  }, [open, address, guardChainId, txStatus]);

  // A modal does not survive app navigation (APP-528 follow-up). The shell
  // calls this on every pathname change. It ends a session only when nothing
  // is at stake: not while a write is in flight, not while minimized, and never
  // for a session launched on the destination route itself. Stable: the caller
  // keys its effect on the pathname alone.
  const closeOnNavigation = useCallback((pathname: string) => {
    const live = sessionRef.current;
    if (!live) return;
    if (live.launchPathname === pathname) return;
    if (minimizedRef.current) return;
    const status = txStatusRef.current;
    if (status === TxStatus.INITIALIZED || status === TxStatus.LOADING) return;
    handleCloseRef.current();
  }, []);

  // The modal's back-to-first-screen action, registered while it is mounted.
  // Driven by the gate's returnToFirstScreen control on an enhanced-screening
  // denial (APP-517).
  const returnToFirstScreenRef = useRef<(() => void) | null>(null);
  const registerReturnToFirstScreen = useCallback((fn: (() => void) | null) => {
    returnToFirstScreenRef.current = fn;
  }, []);

  // The exit hold is the only timer here.
  useEffect(() => () => (exitTimerRef.current ? clearTimeout(exitTimerRef.current) : undefined), []);

  // Hide the modal without ending the transaction. Unlike handleClose this keeps
  // the session + txStatus intact (and fires no 'cancelled' analytics), so the
  // engine hook keeps running and restore() re-shows the modal mid-flight.
  const minimize = useCallback(() => {
    minimizedRef.current = true;
    setMinimized(true);
  }, []);
  const restore = useCallback(() => {
    minimizedRef.current = false;
    setMinimized(false);
  }, []);

  // While minimized the modal is hidden, so surface the transaction's progress
  // as a toast. A stable id means StrictMode's double-invoke just updates the
  // toast in place; restoring/closing dismisses it.
  useEffect(() => {
    if (!minimized) {
      toast.dismiss(MINIMIZED_TOAST_ID);
      return;
    }
    const live = liveRef.current;
    if (!live) return;
    // Amount-aware title when the flow supplied one, else the flow's title.
    const titleFor = (state: 'loading' | 'error') => live.toast?.[state] ?? live.title;

    // SUCCESS never reaches here: it closes the session (see onSuccess), which
    // clears `minimized` in the same commit and posts its own toast.
    const inFlight = txStatus === TxStatus.LOADING || txStatus === TxStatus.INITIALIZED;
    const state = txStatus === TxStatus.ERROR ? 'error' : 'loading';
    if (txStatus !== TxStatus.ERROR && !inFlight) return;

    toastWithClose(
      () => (
        <MinimizedTransactionToast
          status={txStatus}
          title={titleFor(state)}
          hash={sessionRef.current?.hash}
          onView={() => setMinimized(false)}
        />
      ),
      { id: MINIMIZED_TOAST_ID, duration: inFlight ? Infinity : 10000 }
    );

    return () => {
      toast.dismiss(MINIMIZED_TOAST_ID);
    };
  }, [minimized, txStatus]);

  // The surface an async gate drives while it holds the floor (APP-501): the
  // signature prelude step, the modal's status (+ optional copy override),
  // and — when the gate replaces the modal with its own surface — teardown.
  // Built PER GATE CALL, bound to that click's session: once the session
  // closes or is replaced, every control is a no-op, so a stale continuation
  // cannot flip the new session's status, mount a ghost prelude, or leave
  // txStatusRef=INITIALIZED on a closed provider.
  const makeGateControls = useCallback(
    (owner: TransactionSession): GateControls => {
      const live = () => !owner.closed && owner === sessionRef.current;
      return {
        setGateStatus: (status, copy) => {
          if (!live()) return;
          const isGatePhase = status === 'screening' || status === 'signature';
          const mapped = isGatePhase
            ? TxStatus.INITIALIZED
            : status === 'error'
              ? TxStatus.ERROR
              : TxStatus.IDLE;
          setTxStatus(mapped);
          txStatusRef.current = mapped;
          // Both phases render as INITIALIZED; the phase itself decides what a
          // close during it means (see gatePhaseRef / handleInitializedAbandon).
          gatePhaseRef.current = isGatePhase ? status : null;
          gateCopyRef.current = copy ?? null;
          setGateCopy(copy ?? null);
        },
        setPreludeSteps: steps => {
          if (!live()) return;
          preludeStepsRef.current = steps;
          setPreludeSteps(steps);
        },
        closeModal: () => {
          if (!live()) return;
          handleCloseRef.current();
        },
        returnToFirstScreen: () => {
          if (!live()) return;
          // IDLE first, and synchronously: the first screen must be fully live
          // again — the entry body's pushes freeze while txStatus !== IDLE, and
          // close/dismiss semantics key off the status.
          setTxStatus(TxStatus.IDLE);
          txStatusRef.current = TxStatus.IDLE;
          gatePhaseRef.current = null;
          gateCopyRef.current = null;
          setGateCopy(null);
          // A skipReview flow has no first screen: the denial hands the user
          // back to the surface that launched it, which renders the same
          // hold through useTransactionPreflight.
          if (owner.launch.skipReview) handleCloseRef.current();
          else returnToFirstScreenRef.current?.();
        },
        reportSignatureRejected: () => {
          if (!live()) return;
          emitTermsSignatureDeclined('wallet_rejected');
        },
        isStale: () => !live()
      };
    },
    [emitTermsSignatureDeclined]
  );

  // The chain guard's enforcement half (APP-528): the write can start from a
  // path the banner doesn't cover — Retry on the failure view, Confirm after
  // Back from it, or a gate verdict resolving after the wallet moved — so the
  // check lives here too, at the single choke point, read at fire time.
  const walletOnSupportedChain = useCallback(() => {
    const live = sessionRef.current;
    return !live || !offSupportedChains(live.launch.supportedChainIds, chainIdRef.current);
  }, []);

  // A wrong-chain refusal hands the modal back to its first screen, where the
  // guard's copy and switch CTA render. Never a bare no-op.
  const refuseOffChain = useCallback((controls: GateControls) => {
    controls.setPreludeSteps(null);
    controls.returnToFirstScreen();
  }, []);

  // The single gate point between the user's confirm and the flow's action
  // (APP-496): every way a write can start — confirm, the entry's secondary
  // CTA, retry — funnels through here. A synchronous allow runs the action in
  // the same tick, preserving the contract that the engine's `onMutate` fires
  // synchronously from the user's confirm. An async verdict re-checks the
  // session: the user may have closed or relaunched while it was pending.
  // Minimize does NOT end the session, so a verdict resolving while minimized
  // still applies.
  const runGated = useCallback(
    (trigger: GateTrigger, action: () => void, overrides?: FireOverrides) => {
      const owner = sessionRef.current;
      if (!owner || gateInFlightRef.current === owner) return;
      // A two-CTA flow states the clicked mode's attribution ahead of the write
      // it fires in this same tick, so the engine's onMutate sees it.
      if (overrides && liveRef.current) liveRef.current = { ...liveRef.current, ...overrides };
      const controls = makeGateControls(owner);
      if (!walletOnSupportedChain()) {
        refuseOffChain(controls);
        return;
      }
      // The chain the click was made on: a verdict must not fire the action
      // on any other, supported or not (see the chain-change close above).
      const chainAtClick = chainIdRef.current;
      const verdict = gate({
        trigger,
        // Read at fire time: editable flows keep this live until the engine starts.
        usdValue: liveRef.current?.usdValue,
        controls
      });
      if (verdict instanceof Promise) {
        gateInFlightRef.current = owner;
        verdict
          .then(
            v => {
              if (owner.closed || owner !== sessionRef.current || !v.allow) return;
              // Re-checked: the wallet may have switched while the verdict was
              // pending, and the form has since rebuilt its calldata against
              // the new chain. A move between two supported chains is refused
              // the same way, and since the guard has nothing to say there, a
              // toast does.
              if (!walletOnSupportedChain()) {
                refuseOffChain(controls);
                return;
              }
              if (chainIdRef.current !== chainAtClick) {
                refuseOffChain(controls);
                notifyReviewAgainOnChainChange();
                return;
              }
              action();
            },
            () => {}
          )
          .finally(() => {
            // Only release a latch we still own: launch/close reset it, and a
            // NEW session may have latched its own verdict by now.
            if (gateInFlightRef.current === owner) gateInFlightRef.current = null;
          });
        return;
      }
      if (verdict.allow) action();
    },
    [gate, makeGateControls, walletOnSupportedChain, refuseOffChain]
  );

  const shellConfirm = useCallback(
    (action: () => void, overrides?: FireOverrides) => runGated('confirm', action, overrides),
    [runGated]
  );
  const shellSecondaryConfirm = useCallback(
    (action: () => void, overrides?: FireOverrides) => runGated('secondaryConfirm', action, overrides),
    [runGated]
  );
  const shellRetry = useCallback(
    (action: () => void) =>
      // The reset lives inside the gate: a denied retry must leave the failure
      // view in place, not clear it and then do nothing.
      runGated('retry', () => {
        resetTransactionProgress();
        action();
      }),
    [runGated, resetTransactionProgress]
  );

  // A settle callback belongs to the running session only if BOTH its closure
  // and the write it reports on belong to the live session (see
  // writeSessionRef). Either mismatch means the caller is an engine from a
  // session that was closed or abandoned, and it must drop itself.
  const isStaleWrite = useCallback(
    (owner: TransactionSession | null) =>
      !owner ||
      owner.closed ||
      owner !== sessionRef.current ||
      (writeSessionRef.current !== null && writeSessionRef.current !== sessionRef.current),
    []
  );

  // A settle for a hash other than the one this session broadcast is another
  // transaction's — an abandoned write landing while a new one is in flight.
  // Skipped for Safe wallets, where the two hashes differ legitimately (the
  // safeTxHash at onStart, the real transaction hash at onSuccess).
  const isForeignHash = useCallback(
    (hash?: string) => {
      const tracked = sessionRef.current?.writeHash;
      return !isSafeWallet && !!hash && !!tracked && hash !== tracked;
    },
    [isSafeWallet]
  );

  // Each callback closes over the `session` of the render that created it and
  // drops itself when that session has ended.
  const onMutate = useCallback(
    (variables?: TxMutateVariables) => {
      if (!session || session.closed || session !== sessionRef.current) return;
      // Latch the write to this session; the settle callbacks check it. Fires
      // synchronously from the user's confirm, so it can trust its closure.
      // Written through the ref: the check above proved it is this session.
      writeSessionRef.current = session;
      sessionRef.current!.writeHash = undefined;
      // The engine taking over ends the gate's turn at the copy and the
      // status: from here the flow's own narration applies, and an
      // INITIALIZED abandoned from here on is a real wallet transaction.
      gateCopyRef.current = null;
      setGateCopy(null);
      gatePhaseRef.current = null;
      // Advance the step from a ref, not inside the setTxStatus updater (StrictMode double-invokes it).
      if (txStatusRef.current === TxStatus.INITIALIZED || txStatusRef.current === TxStatus.LOADING) {
        setCurrentStep(s => s + 1);
      }
      // A sequential engine dispatches the next call only once the previous
      // receipt landed, so a write arriving over LOADING means a step mined.
      if (txStatusRef.current === TxStatus.LOADING) setHasMinedStep(true);
      setTxStatus(TxStatus.INITIALIZED);
      txStatusRef.current = TxStatus.INITIALIZED;
      sessionRef.current!.hash = undefined;

      // Track transaction started; approve legs report action 'approve' (dev parity)
      const analytics = liveRef.current?.analytics;
      if (analytics) {
        trackTransactionStarted({
          widgetName: analytics.widgetName,
          chainId,
          action: variables?.functionName === 'approve' ? 'approve' : analytics.action,
          flow: analytics.flow,
          data: analytics.data,
          flowId: session.flowId
        });
      }
    },
    [session, chainId, trackTransactionStarted]
  );

  const onStart = useCallback(
    (hash?: string) => {
      if (isStaleWrite(session)) return;
      sessionRef.current!.writeHash = hash;
      setTxStatus(TxStatus.LOADING);
      txStatusRef.current = TxStatus.LOADING;
      if (hash) sessionRef.current!.hash = hash;
    },
    [session, isStaleWrite]
  );

  const onSuccess = useCallback(
    (hash?: string) => {
      if (isStaleWrite(session) || isForeignHash(hash)) return;
      setTxStatus(TxStatus.SUCCESS);
      txStatusRef.current = TxStatus.SUCCESS;
      if (hash) sessionRef.current!.hash = hash;

      const live = liveRef.current;
      const analytics = live?.analytics;
      if (analytics) {
        trackTransactionCompleted({
          widgetName: analytics.widgetName,
          chainId,
          txStatus: 'success',
          txHash: hash,
          action: analytics.action,
          flow: analytics.flow,
          data: analytics.data,
          flowId: session!.flowId
        });
      }

      // `live` was captured BEFORE the consumer callback: the close below tears
      // the session down, and a consumer that relaunched from its own onSuccess
      // would otherwise put the new flow's copy on this transaction's toast.
      live?.onSuccess?.();
      // Rotate AFTER the consumer callback so anything it emits joins this flow
      if (analytics) {
        startNewFlow();
      }

      // A confirmed transaction no longer holds the modal: it closes itself and
      // the outcome moves to a toast (Figma 859:35901). Dismiss any minimized
      // toast first, so the two never sit stacked.
      if (live) {
        toast.dismiss(MINIMIZED_TOAST_ID);
        const successTitle = live.toast?.success ?? live.title;
        const txHash = hash ?? sessionRef.current?.hash;
        toastWithClose(
          () => (
            <TransactionSuccessToast
              title={successTitle}
              hash={txHash}
              href={txHash ? getTransactionLink(chainId, address, txHash, isSafeWallet) : undefined}
            />
          ),
          { id: SUCCESS_TOAST_ID, duration: 10000 }
        );
      }
      // Via the ref so this callback doesn't churn on every currentStep change.
      // The close holds the SUCCESS screen for the modal's 300ms exit.
      handleCloseRef.current();
    },
    [
      session,
      chainId,
      address,
      isSafeWallet,
      trackTransactionCompleted,
      startNewFlow,
      isStaleWrite,
      isForeignHash
    ]
  );

  const onError = useCallback(
    (error: Error, hash?: string) => {
      // A refusal BEFORE any write (the batch engine's cross-chain backstop,
      // APP-528) arrives hashless at IDLE: no onMutate latched the write
      // session, so the stale-write test would drop it on any page that has
      // already sent a transaction, leaving the modal on "Preparing". For a
      // refusal the session alone says whether it is ours.
      const preWriteRefusal = !hash && txStatusRef.current === TxStatus.IDLE;
      if (
        preWriteRefusal
          ? !session || session.closed || session !== sessionRef.current
          : isStaleWrite(session) || isForeignHash(hash)
      ) {
        return;
      }
      setTxStatus(TxStatus.ERROR);
      txStatusRef.current = TxStatus.ERROR;
      setUserRejected(isUserRejectedRequestError(error));
      if (hash) sessionRef.current!.hash = hash;

      // Bounded classification props only — never the raw message, which can
      // embed addresses and calldata. A wallet rejection is the user backing
      // out, not a failure (APP-444 D1). A pre-write refusal never started a
      // transaction, so it completes none.
      const live = liveRef.current;
      const analytics = preWriteRefusal ? undefined : live?.analytics;
      if (analytics) {
        const classification = classifyTransactionError(error, !!hash);
        trackTransactionCompleted({
          widgetName: analytics.widgetName,
          chainId,
          txStatus: classification.is_user_rejection ? 'cancelled' : 'error',
          txHash: hash,
          action: analytics.action,
          flow: analytics.flow,
          data: { ...analytics.data, ...classification },
          flowId: session!.flowId
        });
      }

      const normalizedError = toError(error);

      if (shouldCaptureTransactionError(normalizedError)) {
        const flowAnalytics = live?.analytics;
        reportError(normalizedError, {
          module: 'transactions',
          flow: flowAnalytics?.flow ?? 'unknown',
          action: flowAnalytics?.action ?? 'unknown',
          type: preWriteRefusal ? 'transaction_refused' : 'transaction_error',
          extra: {
            chainId,
            txHash: hash,
            isSafeWallet,
            widget: flowAnalytics?.widgetName ?? 'unknown',
            analyticsData: flowAnalytics?.data ?? null
          }
        });
      }

      live?.onError?.();
      // Rotate AFTER the consumer callback so anything it emits joins this flow
      if (analytics) {
        startNewFlow();
      }
    },
    [session, chainId, isSafeWallet, trackTransactionCompleted, startNewFlow, isStaleWrite, isForeignHash]
  );

  // Stable while its members are (LOW-churn): the provider value below is
  // memoized, and an unmemoized wrapper object here would defeat it.
  const txCallbacks: TxCallbacks = useMemo(
    () => ({ onMutate, onStart, onSuccess, onError }),
    [onMutate, onStart, onSuccess, onError]
  );

  // Chain guard (APP-528): while a flow's supported set is declared and the
  // connected wallet has left it, the modal blocks every first-screen CTA and
  // offers a switch back. Read off the live OR exiting session so a modal
  // animating away doesn't flash the guard as it leaves. Applies whenever no
  // write is in flight; `runGated` enforces the same check at fire time.
  const guardSession = session ?? exiting?.session ?? null;
  const noWriteInFlight = txStatus !== TxStatus.INITIALIZED && txStatus !== TxStatus.LOADING;
  const chainGuardActive =
    !!guardSession &&
    noWriteInFlight &&
    offSupportedChains(guardSession.launch.supportedChainIds, guardChainId);
  const guardTargetChainId = chainGuardActive
    ? chainSwitchTarget(
        guardSession.launch.supportedChainIds,
        chains.map(c => c.id)
      )
    : undefined;
  const guardTargetName = chains.find(c => c.id === guardTargetChainId)?.name;
  // A wallet the dapp must not switch (a Safe) gets no switch button, only the
  // explanatory block; the guard still disables the CTAs (APP-486).
  const guardCanSwitch = guardTargetChainId !== undefined && canSwitchChain;
  const switchGuardChain = useCallback(
    (source: NetworkSwitchSource = 'transaction_modal') => {
      if (guardTargetChainId === undefined) return;
      handleSwitchChain({ chainId: guardTargetChainId, source });
    },
    [guardTargetChainId, handleSwitchChain]
  );
  const onGuardSwitchClick = useCallback(() => switchGuardChain(), [switchGuardChain]);

  // Opening a product's modal is asking for that product, so it resolves its
  // chain the way arriving on its page does — the route guard's rule (c), just
  // without a URL to change. Latched to the session: the FIRST evaluation of
  // a session is the only one that can fire, so the guard turning active LATER
  // (the user switches the wallet with the modal open) gets the CTA, not a
  // prompt, and a decline is not asked twice.
  const autoSwitchedSessionRef = useRef<TransactionSession | null>(null);
  useEffect(() => {
    if (!session || autoSwitchedSessionRef.current === session) return;
    autoSwitchedSessionRef.current = session;
    if (chainGuardActive && guardCanSwitch) switchGuardChain('transaction_modal_auto');
  }, [session, chainGuardActive, guardCanSwitch, switchGuardChain]);
  const chainGuard: ChainGuard | null = chainGuardActive
    ? {
        // The chain the guard is judging, not the one wagmi has pinned. An
        // unconfigured chain has no name to give, and undefined is right: the
        // copy says "this network" instead of guessing.
        currentName: chains.find(c => c.id === guardChainId)?.name,
        targetName: guardTargetName,
        onSwitch: guardCanSwitch ? onGuardSwitchClick : undefined,
        // The guard's CTA shows the DS loading state while the wallet is
        // answering OUR switch request (not some other surface's).
        switching: switchPending && switchVariables?.chainId === guardTargetChainId,
        reason: guardSession.launch.chainGuardReason
      }
    : null;

  // Memoized: TransactionProvider is composed under ConnectedProvider (the
  // gate reads terms/auth state), so without this every terms or auth state
  // change would hand a fresh context value to every useTransaction consumer.
  const contextValue = useMemo<TransactionContextValue>(
    () => ({
      launch,
      updateModalContent,
      isModalOpen: open,
      minimize,
      restore,
      isMinimized: minimized,
      activeSessionId: session?.id ?? null,
      closeOnNavigation,
      txCallbacks,
      txStatus
    }),
    [
      launch,
      updateModalContent,
      open,
      minimize,
      restore,
      minimized,
      session,
      closeOnNavigation,
      txCallbacks,
      txStatus
    ]
  );

  const liveView: ShellView = { txStatus, currentStep, hasMinedStep, userRejected, preludeSteps, gateCopy };

  // The hosts: the live session, and the one held through its exit. Each is
  // mounted hidden, OUTSIDE the dialog (which portals to the document root),
  // so minimizing — which unmounts the dialog body — never tears down a
  // running engine, and each launch's fresh key resets the screen and inputs.
  const noop = () => {};
  const hosts: {
    session: TransactionSession;
    view: ShellView;
    open: boolean;
    active: boolean;
    config: TransactionConfig | null;
  }[] = [];
  if (session) hosts.push({ session, view: liveView, open: open && !minimized, active: true, config });
  if (exiting && exiting.session !== session)
    hosts.push({
      session: exiting.session,
      view: exiting.view,
      open: false,
      active: false,
      config: exiting.config
    });

  return (
    <TransactionContext.Provider value={contextValue}>
      <EntrySlotContext.Provider value={entrySlotEl}>
        {/* Only page surfaces read the preflight hook (see useTransactionPreflight). */}
        <PreflightHookContext.Provider value={usePreflight}>{children}</PreflightHookContext.Provider>
        {hosts.map(host => {
          const owner = host.session;
          const shell: TransactionShell = host.active
            ? {
                open: host.open,
                active: true,
                view: host.view,
                chainGuard,
                skipReview: owner.launch.skipReview,
                usePreflight,
                register: live => register(owner, live),
                confirm: shellConfirm,
                secondaryConfirm: shellSecondaryConfirm,
                retry: shellRetry,
                reviewStage: handleReviewStage,
                back: handleBack,
                close: handleClose,
                minimize,
                registerReturnToFirstScreen,
                registerEntrySlot: setEntrySlotEl
              }
            : {
                // An exiting host draws its last state and can start nothing.
                open: false,
                active: false,
                view: host.view,
                chainGuard,
                skipReview: owner.launch.skipReview,
                usePreflight,
                register: noop,
                confirm: noop,
                secondaryConfirm: noop,
                retry: noop,
                reviewStage: noop,
                back: noop,
                close: noop,
                minimize: noop,
                registerReturnToFirstScreen: noop,
                registerEntrySlot: noop
              };
          return (
            <TransactionShellContext.Provider key={owner.key} value={shell}>
              <ConfigFlowContext.Provider value={host.config}>
                <div hidden>{owner.render()}</div>
              </ConfigFlowContext.Provider>
            </TransactionShellContext.Provider>
          );
        })}
      </EntrySlotContext.Provider>
    </TransactionContext.Provider>
  );
}

export function useTransaction() {
  const ctx = useContext(TransactionContext);
  if (!ctx) {
    throw new Error('useTransaction must be used within a TransactionProvider');
  }
  return ctx;
}
