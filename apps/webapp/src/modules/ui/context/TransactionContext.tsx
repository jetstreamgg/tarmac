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
import { TxStatus, InProgress, Cancel } from '@/widgets';
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
import { useChainModalContext } from '@/modules/ui/context/ChainModalContext';
import { TransactionModal } from '@/modules/ui/components/TransactionModal';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import type { NetworkSwitchSource } from '@/modules/analytics/constants';
import { useAnalyticsFlow } from '@/modules/analytics/context/AnalyticsFlowContext';
import { reportError } from '@/modules/sentry/reportError';
import { classifyTransactionError } from '@/modules/analytics/lib/classifyTransactionError';
import { isUserRejectedRequestError } from '@/modules/utils/isUserRejectedRequestError';
import type {
  TransactionConfig,
  TransactionEntry,
  TxCallbacks,
  TransactionContextValue
} from './transactionContract';
import {
  allowAllGate,
  allowAllPreflight,
  type GateControls,
  type GatePhase,
  type GateStatusCopy,
  type GateTrigger,
  type PreflightHook,
  type PreTransactionGate
} from './preTransactionGate';
import type { TransactionStep } from '@/modules/ui/components/transactionStepsModel';

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

function shouldCaptureTransactionError(error: Error): boolean {
  return !isUserRejectedRequestError(error);
}

// Whether the wallet's chain is outside a flow's declared set (APP-528). An
// empty set is a chain-agnostic flow and never trips the guard.
function offSupportedChains(supportedChainIds: readonly number[], chainId: number): boolean {
  return supportedChainIds.length > 0 && !supportedChainIds.includes(chainId);
}

// The transaction-orchestration contract is frozen in ./transactionContract.
// Re-exported here so existing import sites keep working.
export type {
  TransactionAnalytics,
  TransactionConfig,
  TransactionEntry,
  TxCallbacks
} from './transactionContract';

const TransactionContext = createContext<TransactionContextValue | null>(null);

// Internal: the DOM node on the modal's entry screen where an editable flow's
// `backgroundContent` portals its visible inputs. This lets the in-flight hook
// host live OUTSIDE the dialog (so it survives minimize) while its inputs still
// display inside it. Null when no entry screen is mounted (e.g. minimized) — the
// host then renders its inputs inline in the hidden background instead.
const EntrySlotContext = createContext<HTMLElement | null>(null);

/** The dialog entry slot to portal editable inputs into, or null when absent. */
export function useEntrySlot() {
  return useContext(EntrySlotContext);
}

/** The modal's render inputs, retained across its exit animation. */
type TransactionModalView = {
  config: TransactionConfig;
  txStatus: TxStatus;
  currentStep: number;
  /** Gate-mounted off-chain steps rendered ahead of the config's own list (APP-501). */
  preludeSteps: TransactionStep[] | null;
  /** Gate-owned status copy override active when the session ended (APP-501). */
  gateCopy: GateStatusCopy | null;
};

/**
 * How long the modal is kept mounted after being told to close, so its exit
 * animation can play. Matches the dismissal in `components/ui/dialog.tsx`
 * (and the bottom sheet's, which is the same 300ms).
 */
const MODAL_EXIT_MS = 300;

export function TransactionProvider({
  children,
  // The pre-transaction gate (see ./preTransactionGate). Injectable so tests
  // can exercise the deny/async paths; the app mounts the allow-all stub until
  // the signature verdict lands (APP-501).
  gate = allowAllGate,
  // The enhanced-screening preflight (APP-517), a HOOK called unconditionally
  // every render — its identity must be stable for the life of the provider
  // (the app passes a module-level hook; tests pass stable fakes).
  usePreflight = allowAllPreflight
}: {
  children: ReactNode;
  gate?: PreTransactionGate;
  usePreflight?: PreflightHook;
}) {
  // Warm the EIP-5792 capability probe from the provider, which is mounted for the whole
  // session, so it runs on connect rather than the first time a flow needs the answer.
  // A multi-call flow genuinely has to know whether the wallet can bundle before it can
  // pick a route, and paying for that wallet round trip at modal-open time is what makes
  // a Confirm button sit disabled while nothing visible is happening. Result is shared —
  // this is the same react-query key every `useIsBatchSupported` caller reads.
  useIsBatchSupported();

  const [open, setOpen] = useState(false);
  // Minimized = modal hidden but the transaction keeps running. Distinct from
  // closed (which tears the transaction down); see minimize()/restore() below.
  const [minimized, setMinimized] = useState(false);
  // Ref twin of `minimized`, written in the same callbacks that set the state,
  // so closeOnNavigation (called from a route effect) reads the live value.
  const minimizedRef = useRef(false);
  // Where the session was launched (window.location — the provider sits above
  // the router). A route change closes an idle session, but never one the
  // destination page itself just opened: a page that launches on mount does so
  // in a child effect, i.e. AFTER the router committed the new location and
  // BEFORE the shell's route effect asks us to close.
  const launchPathnameRef = useRef<string | null>(null);
  // The entry-screen portal target, registered by the modal (see EntrySlotContext).
  const [entrySlotEl, setEntrySlotEl] = useState<HTMLElement | null>(null);
  // Bumped on every launch and used as the modal + host `key`, so each launch gets a
  // FRESH mount (screen back to entry, inputs cleared). Minimize keeps the session
  // mounted across the hidden window, so this is the only thing that resets it — a
  // changing key, per the React guidance on resetting all state.
  const [launchCount, setLaunchCount] = useState(0);
  const [txStatus, setTxStatus] = useState<TxStatus>(TxStatus.IDLE);
  const [currentStep, setCurrentStep] = useState(0);
  // Off-chain prelude steps the gate mounted for this session (the terms
  // signature step, APP-501). State for rendering, ref for synchronous reads
  // in the close snapshot. Reset on every launch and close — a prelude belongs
  // to the session (and the attempt) that inserted it.
  const [preludeSteps, setPreludeSteps] = useState<TransactionStep[] | null>(null);
  const preludeStepsRef = useRef<TransactionStep[] | null>(null);
  // Gate-owned status copy (see GateStatusCopy): replaces the flow's status
  // message/subtitle while a gate status is driving the modal. Replaced on
  // every setGateStatus call, cleared on launch/close.
  const [gateCopy, setGateCopy] = useState<GateStatusCopy | null>(null);
  const gateCopyRef = useRef<GateStatusCopy | null>(null);
  // Config is state so updateModalContent re-renders the modal; ref mirrors it for callback reads.
  const [activeConfig, setActiveConfig] = useState<TransactionConfig | null>(null);
  const configRef = useRef<TransactionConfig | null>(null);
  // Everything the modal draws arrives as props, so this snapshot of them is
  // enough to keep it on screen, unchanged, while it animates away.
  //
  // It exists because `activeConfig` gates the whole modal subtree and
  // handleClose clears it synchronously: the modal was being unmounted in the
  // same tick it was told to close, so its exit animation never ran and it
  // simply vanished. Holding the last rendered props for the length of that
  // animation lets Radix play the exit. The teardown itself is untouched —
  // this deliberately does not defer any of it.
  const [exitingView, setExitingView] = useState<TransactionModalView | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSessionRef = useRef<string | null>(null);
  // Session generation: advanced by launch() and handleClose(), so engine
  // callbacks are bound to the session that rendered them (state) and can spot
  // that it has since ended (ref). An in-flight write outlives its host — the
  // wallet can accept in the same instant the user dismisses the modal — and
  // without this check the orphaned engine's onStart stamped LOADING onto the
  // torn-down provider (no modal left to restore), bricking every later
  // launch() on the in-progress guard until a reload; after an
  // abandon-then-relaunch it would corrupt the NEW session instead.
  const [sessionGen, setSessionGen] = useState(0);
  const sessionGenRef = useRef(0);
  // The generation of the write currently in flight, latched at onMutate.
  //
  // The closure check above only sheds a stale callback when the engine is
  // still HOLDING an old render's closure — true for flows hosted in
  // `backgroundContent` (savings, stUSDS, rewards, vault, claim, upgrade,
  // pendle supply/withdraw): close unmounts the host and freezes its closures
  // at the pre-bump generation. The review-first flows (convert, pendle
  // redeem, the stake takeovers) keep their engine host mounted on the page,
  // so it re-renders after teardown and react-query hands the LIVE mutation
  // the newest options (MutationObserver.setOptions pushes into a pending
  // Mutation, and useWriteContractFlow's receipt effect closes over the
  // current render) — a late callback from an abandoned write would arrive
  // carrying the CURRENT generation and sail through.
  //
  // onMutate is the one callback that always fires synchronously from the
  // user's confirm, so the generation it records is the session that actually
  // started the write, whatever the host's mount state. The settle callbacks
  // check that instead of trusting their own closure. Null until the first
  // write of the page's life, where it falls back to the closure check alone.
  const writeGenRef = useRef<number | null>(null);
  // Hash of the write this session is tracking, latched at onStart, so a
  // settle carrying a DIFFERENT hash is recognisable as another transaction's.
  const writeHashRef = useRef<string | undefined>(undefined);
  // Mirrors txStatus for reads inside callbacks (avoids setState-inside-updater impurity).
  const txStatusRef = useRef<TxStatus>(TxStatus.IDLE);
  // In-flight gate latch: the generation whose verdict is currently pending,
  // null when idle. While set (for the live session), further gated calls are
  // ignored — nothing else stops a second click from starting a parallel gate
  // run, and two allows would mean two onConfirms. Practically shadowed by the
  // Confirm button unmounting on the first click, but this is legal gating, so
  // the invariant doesn't ride on the UI.
  const gateInFlightRef = useRef<number | null>(null);
  // Which gate phase currently owns an INITIALIZED status (null = the engine
  // does, via onMutate). handleClose and launch read it to tell an abandoned
  // WALLET TRANSACTION (cancelled analytics + the discarded-request toast)
  // from an abandoned gate phase, where no transaction ever started: the
  // screening phase tears down silently, the signature phase emits the
  // terms-signature-declined event and its own toast. Cleared by onMutate
  // (the engine taking over), by the gate driving 'error'/'idle', and on
  // launch/close.
  const gatePhaseRef = useRef<GatePhase | null>(null);
  // Latest on-chain hash, for the minimized toast's shortened-hash subtitle.
  const txHashRef = useRef<string | undefined>(undefined);
  // flow_id latched at launch so this session's review/started/completed events
  // stay joined even if navigation rotates the live flow id mid-transaction.
  const flowIdRef = useRef<string | undefined>(undefined);

  const chainId = useChainId();
  const { address, chainId: connectedChainId } = useConnection();
  const chains = useChains();

  // The chain the guard below judges: the wallet's OWN, not wagmi's.
  //
  // `useChainId()` reads `config.state.chainId`, which wagmi refuses to move
  // onto a chain the app doesn't configure — park a wallet on one and it keeps
  // reporting the last configured chain. The guard would then see a supported
  // chain and stay silent while the wallet is somewhere else entirely, which is
  // exactly the calldata-on-the-wrong-chain case it exists to stop. That hole
  // used to be unreachable because a blocking dialog covered the app; it isn't
  // any more, so the guard has to read the truth. Falls back to the config
  // chain when disconnected, where there is no wallet chain to speak of.
  const guardChainId = connectedChainId ?? chainId;

  // Fire-time read for the gate's chain check (see runGated): a verdict that
  // resolves after a wallet chain switch must see the wallet's CURRENT chain,
  // not the one captured when the click happened.
  const chainIdRef = useRef(guardChainId);
  useEffect(() => {
    chainIdRef.current = guardChainId;
  }, [guardChainId]);
  const { handleSwitchChain, isPending: switchPending, variables: switchVariables } = useChainModalContext();
  const isSafeWallet = useIsSafeWallet();

  // Enhanced screening for $250k+ transactions (APP-517): warmed as soon as
  // the live USD value crosses the threshold WHILE the flow's own gating
  // would let the user proceed, so the verdict is usually in by the time
  // they reach the screen whose Confirm fires the transaction — but a user
  // merely playing with the input (over balance, quote pending, claim set
  // unresolved) never triggers a call. The modal renders the blocked message
  // above the CTAs and gates the transaction-firing buttons on the result;
  // the gate enforces the same verdict at Confirm through the shared query
  // cache. `active` stays true while minimized — the session is alive, just
  // hidden.
  //
  // `actionable` reads the flow's OWN confirm gating from the live config —
  // never the preflight's hold (that lives in the modal's props, not the
  // config), so there is no feedback loop. An entry flow may expose a second
  // CTA; either being enabled means the user can proceed.
  // A wallet outside the flow's supported set (APP-528, below) can't proceed
  // either, so no screening call is spent on a transaction that cannot fire.
  const preflightEntry = activeConfig?.entry;
  const actionable =
    !(activeConfig && offSupportedChains(activeConfig.supportedChainIds, guardChainId)) &&
    (preflightEntry
      ? !preflightEntry.confirmDisabled ||
        (!!activeConfig?.onSecondaryConfirm && !preflightEntry.secondaryConfirmDisabled)
      : !activeConfig?.confirmDisabled);
  const preflight = usePreflight({
    usdValue: activeConfig?.usdValue,
    active: open && !!activeConfig,
    actionable
  });
  const {
    trackWidgetReviewViewed,
    trackTransactionStarted,
    trackTransactionCompleted,
    trackTermsSignatureDeclined
  } = useAppAnalytics();
  const { startNewFlow, getFlowId } = useAnalyticsFlow();

  // One decline event per occurrence, attributed to the gated config (which
  // the gate itself never sees). Both decline paths funnel here: the wallet
  // rejection (via the gate's reportSignatureRejected control) and the
  // abandonment (handleClose / launch below).
  const emitTermsSignatureDeclined = useCallback(
    (method: 'wallet_rejected' | 'abandoned') => {
      const analytics = configRef.current?.analytics;
      trackTermsSignatureDeclined({
        method,
        chainId,
        widgetName: analytics?.widgetName,
        flow: analytics?.flow,
        action: analytics?.action,
        flowId: flowIdRef.current
      });
    },
    [chainId, trackTermsSignatureDeclined]
  );

  // A user-initiated close (or relaunch) found the modal at INITIALIZED. What
  // that abandons depends on who owns the status (see gatePhaseRef): the
  // engine's wallet transaction, the gate's pending sign request, or the
  // gate's screening call — which has nothing in the wallet and nothing in
  // the funnel, so it tears down silently. Only the engine case is a
  // cancelled TRANSACTION: the gate phases run before onMutate, so no
  // app_widget_flow_started has fired and a cancelled completion here would
  // pair with nothing.
  const handleInitializedAbandon = useCallback(() => {
    if (gatePhaseRef.current === 'screening') return;
    if (gatePhaseRef.current === 'signature') {
      emitTermsSignatureDeclined('abandoned');
      startNewFlow();
      notifySignatureRequestAbandoned();
      return;
    }
    const analytics = configRef.current?.analytics;
    if (analytics) {
      trackTransactionCompleted({
        widgetName: analytics.widgetName,
        chainId,
        txStatus: 'cancelled',
        action: analytics.action,
        flow: analytics.flow,
        data: analytics.data,
        flowId: flowIdRef.current
      });
      startNewFlow();
    }
    notifyRequestAbandoned();
  }, [chainId, trackTransactionCompleted, startNewFlow, emitTermsSignatureDeclined]);

  const launch = useCallback(
    (config: TransactionConfig) => {
      // One BROADCAST transaction at a time: it's on-chain and will resolve, so
      // don't start a new session — bring the pending modal back into view and
      // say why. Launching here would remount the host and strand the running tx.
      // The configRef check is self-healing defense: LOADING with no live
      // session has nothing to restore, so fall through to a fresh launch
      // instead of blocking forever.
      if (txStatusRef.current === TxStatus.LOADING && configRef.current) {
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
      // flow abandons it (what exactly it abandons depends on who owns the
      // status; see handleInitializedAbandon) and falls through to a fresh
      // launch, which resets all session state and remounts the hosts.
      if (txStatusRef.current === TxStatus.INITIALIZED) {
        handleInitializedAbandon();
      }

      sessionGenRef.current += 1;
      setSessionGen(sessionGenRef.current);
      // Latch this session's flow id (after any abandon rotation above).
      flowIdRef.current = getFlowId();
      configRef.current = config;
      activeSessionRef.current = config.sessionId ?? null;
      launchPathnameRef.current = window.location.pathname;
      minimizedRef.current = false;
      setActiveConfig(config);
      setTxStatus(TxStatus.IDLE);
      txStatusRef.current = TxStatus.IDLE;
      txHashRef.current = undefined;
      setCurrentStep(0);
      preludeStepsRef.current = null;
      setPreludeSteps(null);
      gateCopyRef.current = null;
      setGateCopy(null);
      gateInFlightRef.current = null;
      gatePhaseRef.current = null;
      setMinimized(false);
      setLaunchCount(c => c + 1);
      setOpen(true);

      // Review-first flows open on the review screen, so launch IS the review
      // view. Entry-first flows open on the editable entry — their review event
      // (if the flow has a review stage at all) fires at the entry→review
      // transition instead (onReviewStage below), and entry-only flows (claims,
      // upgrade) emit none, matching the legacy widgets.
      if (config.analytics && !config.entry) {
        trackWidgetReviewViewed({
          widgetName: config.analytics.widgetName,
          chainId,
          flow: config.analytics.flow,
          action: config.analytics.action,
          data: config.analytics.data,
          flowId: flowIdRef.current
        });
      }
    },
    [chainId, trackWidgetReviewViewed, handleInitializedAbandon, getFlowId]
  );

  // Entry→review transition of a three-screen flow. Read off the config ref:
  // the editable body live-merges its analytics while the user edits, so the
  // ref holds the blob matching what the review is about to show.
  const handleReviewStage = useCallback(() => {
    const analytics = configRef.current?.analytics;
    if (analytics) {
      trackWidgetReviewViewed({
        widgetName: analytics.widgetName,
        chainId,
        flow: analytics.flow,
        action: analytics.action,
        data: analytics.data,
        flowId: flowIdRef.current
      });
    }
  }, [chainId, trackWidgetReviewViewed]);

  const updateModalContent = useCallback<TransactionContextValue['updateModalContent']>(
    (sessionId, partial) => {
      if (sessionId !== activeSessionRef.current) return;
      const prev = configRef.current;
      if (!prev) return;
      const { entry: entryPatch, ...rest } = partial;
      const next = { ...prev, ...rest };
      // Merge the entry partial so an in-modal body can flip confirmDisabled /
      // refresh its rows WITHOUT re-pushing `content` (which would remount it).
      // A patch only ever arrives after launch seeded `entry`, so the merge is
      // a complete TransactionEntry.
      if (entryPatch) {
        next.entry = { ...(prev.entry ?? {}), ...entryPatch } as TransactionEntry;
      }
      // The ref is assigned synchronously (not inside the setState updater): a
      // two-action entry pushes the clicked mode's steps/analytics and executes
      // in the same click, and the engine's onMutate — which also fires
      // synchronously — reads analytics off this ref.
      configRef.current = next;
      setActiveConfig(next);
    },
    []
  );

  const resetTransactionProgress = useCallback(() => {
    setCurrentStep(0);
  }, []);

  const handleClose = useCallback(() => {
    // Closing at INITIALIZED abandons the pending request — whose semantics
    // depend on who owns the status (see handleInitializedAbandon). Read the
    // status from the ref, not the render's closure: a click queued in the
    // same tick as the transition would otherwise see stale state, and the
    // gate hands the status back to IDLE synchronously right before a
    // deny-and-close, which must be visible here.
    if (txStatusRef.current === TxStatus.INITIALIZED) {
      handleInitializedAbandon();
    }

    // Snapshot what is on screen before tearing it down, so the modal can
    // finish leaving (see exitingView). Dropped once the animation is over, or
    // immediately superseded if a new transaction launches inside that window.
    if (configRef.current) {
      setExitingView({
        config: configRef.current,
        txStatus: txStatusRef.current,
        currentStep,
        preludeSteps: preludeStepsRef.current,
        gateCopy: gateCopyRef.current
      });
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      exitTimerRef.current = setTimeout(() => setExitingView(null), MODAL_EXIT_MS);
    }

    // End the session generation FIRST: an engine the wallet already answered
    // may fire callbacks right after this teardown, and they must see
    // themselves as stale (see sessionGen above).
    sessionGenRef.current += 1;
    setSessionGen(sessionGenRef.current);
    setOpen(false);
    setMinimized(false);
    minimizedRef.current = false;
    setTxStatus(TxStatus.IDLE);
    txStatusRef.current = TxStatus.IDLE;
    setCurrentStep(0);
    preludeStepsRef.current = null;
    setPreludeSteps(null);
    gateCopyRef.current = null;
    setGateCopy(null);
    gateInFlightRef.current = null;
    gatePhaseRef.current = null;
    setActiveConfig(null);
    configRef.current = null;
    activeSessionRef.current = null;
  }, [handleInitializedAbandon, currentStep]);

  // The gate calls these from user events, so the ref is always current by then.
  const handleCloseRef = useRef(handleClose);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  });

  // A modal does not survive app navigation (APP-528 follow-up): the provider
  // is mounted above the router, so a route change under an open modal — the
  // mainnet-only page redirecting home after a wallet chain switch, the browser
  // back button — used to leave the modal floating over a page that no longer
  // owns it. The shell calls this on every pathname change. It ends a session
  // only when nothing is at stake: not while a write is in flight (INITIALIZED
  // / LOADING — the wallet prompt or the broadcast must settle), not while
  // minimized (minimize exists precisely so the user can move around the app
  // with the transaction running), and never for a session launched on the
  // destination route itself. Stable: the caller keys its effect on the
  // pathname alone, so this must not change identity as the session does.
  const closeOnNavigation = useCallback((pathname: string) => {
    if (!configRef.current) return;
    if (launchPathnameRef.current === pathname) return;
    if (minimizedRef.current) return;
    const status = txStatusRef.current;
    if (status === TxStatus.INITIALIZED || status === TxStatus.LOADING) return;
    handleCloseRef.current();
  }, []);

  // The modal's back-to-first-screen action, registered while it is mounted
  // (the screen is modal-internal state the provider can't reach otherwise).
  // Driven by the gate's returnToFirstScreen control on an enhanced-screening
  // denial (APP-517).
  const returnToFirstScreenRef = useRef<(() => void) | null>(null);
  const registerReturnToFirstScreen = useCallback((fn: (() => void) | null) => {
    returnToFirstScreenRef.current = fn;
  }, []);

  // The exit hold is the only timer here; a provider unmounting mid-dismissal
  // has nothing left to animate.
  useEffect(() => () => (exitTimerRef.current ? clearTimeout(exitTimerRef.current) : undefined), []);

  // Hide the modal without ending the transaction. Unlike handleClose this keeps
  // activeConfig + txStatus intact (and fires no 'cancelled' analytics), so the
  // engine hook keeps running and restore() re-shows the modal mid-flight.
  const minimize = useCallback(() => {
    minimizedRef.current = true;
    setMinimized(true);
  }, []);
  const restore = useCallback(() => {
    minimizedRef.current = false;
    setMinimized(false);
  }, []);

  // While minimized the modal is hidden, so surface the transaction's progress as a
  // toast (syncing with the toast system — a legitimate external-system effect). A
  // stable id means StrictMode's double-invoke just updates the toast in place;
  // restoring/closing dismisses it. The toast itself re-opens the modal on click.
  useEffect(() => {
    if (!minimized) {
      toast.dismiss(MINIMIZED_TOAST_ID);
      return;
    }
    const config = configRef.current;
    if (!config) return;
    // Amount-aware title when the flow supplied one, else the subtitle sentence, else the title.
    const titleFor = (state: 'loading' | 'error') =>
      config.toast?.[state] ?? config.subtitles?.[state] ?? config.title;

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
          hash={txHashRef.current}
          onView={() => setMinimized(false)}
        />
      ),
      { id: MINIMIZED_TOAST_ID, duration: inFlight ? Infinity : 10000 }
    );

    return () => {
      toast.dismiss(MINIMIZED_TOAST_ID);
    };
  }, [minimized, txStatus]);

  // The single gate point between the user's confirm and the config callback
  // (APP-496): every way a write can start — confirm, the entry's secondary
  // CTA, retry — funnels through here, so the gate cannot be bypassed by any
  // launch site. A synchronous allow (the current stub) runs the action in the
  // same tick, preserving the contract that the engine's `onMutate` fires
  // synchronously from the user's confirm. An async verdict (the C6 signature
  // flow) resolves later, so it re-checks the session generation: the user may
  // have closed or relaunched while it was pending, and a stale allow must not
  // fire into a torn-down or newer session. Note minimize does NOT advance the
  // generation, so a verdict resolving while minimized still applies — the
  // session is alive, just hidden. A rejected verdict counts as a denial.
  // The surface an async gate drives while it holds the floor (APP-501): the
  // signature prelude step, the modal's status (+ optional copy override),
  // and — when the gate replaces the modal with its own surface — teardown.
  // Built PER GATE CALL, bound to that click's session generation: once the
  // session closes or is replaced, every control is a no-op, so a stale
  // continuation (a wallet prompt answered after close, a re-screen resolving
  // late) cannot flip the new session's status, mount a ghost prelude, or
  // leave txStatusRef=INITIALIZED on a closed provider (which would fire the
  // abandoned-request toast on the next launch). `isStale` lets the gate also
  // stop early — before prompting the wallet, the one side effect no-op
  // controls can't absorb.
  const makeGateControls = useCallback(
    (gen: number): GateControls => {
      const live = () => gen === sessionGenRef.current;
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
          // close/dismiss semantics key off the status. Phase and copy clear
          // with it, exactly like setGateStatus('idle').
          setTxStatus(TxStatus.IDLE);
          txStatusRef.current = TxStatus.IDLE;
          gatePhaseRef.current = null;
          gateCopyRef.current = null;
          setGateCopy(null);
          returnToFirstScreenRef.current?.();
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

  // The chain guard's enforcement half (APP-528). The modal disables the CTAs
  // it can see are wrong-chain, but the write can also start from a path the
  // banner doesn't cover — Retry on the failure view, Confirm after Back from
  // it, or a gate verdict (screening, terms signature) resolving after the
  // wallet moved — so the check lives here too, at the single choke point,
  // read at fire time. An empty set is a chain-agnostic flow (see the contract).
  const walletOnSupportedChain = useCallback(() => {
    const config = configRef.current;
    return !config || !offSupportedChains(config.supportedChainIds, chainIdRef.current);
  }, []);

  const runGated = useCallback(
    (trigger: GateTrigger, action: () => void) => {
      // A verdict already pending for this session holds the floor — see gateInFlightRef.
      if (gateInFlightRef.current === sessionGenRef.current) return;
      if (!walletOnSupportedChain()) return;
      const gen = sessionGenRef.current;
      const controls = makeGateControls(gen);
      const verdict = gate({
        trigger,
        // Read at fire time (like the config callbacks): editable flows keep
        // this live via updateModalContent until the engine starts.
        usdValue: configRef.current?.usdValue,
        controls
      });
      if (verdict instanceof Promise) {
        gateInFlightRef.current = gen;
        verdict
          .then(
            v => {
              if (gen !== sessionGenRef.current || !v.allow) return;
              // Re-checked: the wallet may have switched while the verdict
              // (a screening call, a signature prompt) was pending, and the
              // form has since rebuilt its calldata against the new chain.
              // The modal is already on its transaction screen, so hand it
              // back to the first screen — where the chain guard renders —
              // rather than leave it on a status with nothing to wait for.
              if (!walletOnSupportedChain()) {
                controls.setPreludeSteps(null);
                controls.returnToFirstScreen();
                return;
              }
              action();
            },
            () => {}
          )
          .finally(() => {
            // Only release a latch we still own: launch/close reset it, and a
            // NEW session may have latched its own verdict by now.
            if (gateInFlightRef.current === gen) gateInFlightRef.current = null;
          });
        return;
      }
      if (verdict.allow) action();
    },
    [gate, makeGateControls, walletOnSupportedChain]
  );

  // Config callbacks are read through the ref at fire time (not the render's
  // closure): a two-action entry swaps `onConfirm`/`onRetry` via
  // updateModalContent in the same click that executes, and the ref is the
  // synchronously-assigned copy. After close the ref is null and these are
  // no-ops — an exiting modal's snapshot can no longer start anything.
  const gatedConfirm = useCallback(
    () => runGated('confirm', () => configRef.current?.onConfirm()),
    [runGated]
  );
  const gatedSecondaryConfirm = useCallback(
    () => runGated('secondaryConfirm', () => configRef.current?.onSecondaryConfirm?.()),
    [runGated]
  );

  const handleRetry = useCallback(() => {
    // The reset lives inside the gate: a denied retry must leave the failure
    // view in place, not clear it and then do nothing.
    runGated('retry', () => {
      resetTransactionProgress();

      if (configRef.current?.onRetry) {
        configRef.current.onRetry();
        return;
      }

      configRef.current?.onConfirm();
    });
  }, [runGated, resetTransactionProgress]);

  // A settle callback belongs to the running session only if BOTH its closure
  // and the write it reports on were made in the current generation (see
  // writeGenRef). Either mismatch means the caller is an engine from a session
  // that was closed or abandoned, and it must drop itself.
  const isStaleWrite = useCallback(
    (gen: number) =>
      gen !== sessionGenRef.current ||
      (writeGenRef.current !== null && writeGenRef.current !== sessionGenRef.current),
    []
  );

  // A settle for a hash other than the one this session broadcast is another
  // transaction's — an abandoned write landing while a new one is in flight.
  // Skipped for Safe wallets, where the two hashes differ legitimately: the
  // engine reports the safeTxHash at onStart and the real transaction hash at
  // onSuccess. `isSafeWallet` is the broader test of the two (it also covers a
  // Safe address reached through another connector), so this only ever errs
  // towards accepting a settle — never towards dropping a real one.
  const isForeignHash = useCallback(
    (hash?: string) => !isSafeWallet && !!hash && !!writeHashRef.current && hash !== writeHashRef.current,
    [isSafeWallet]
  );

  // Each callback closes over the `sessionGen` of the render that created it
  // and drops itself when the generation has moved on — the caller is an
  // engine from a session that was closed or abandoned.
  const onMutate = useCallback(
    (variables?: TxMutateVariables) => {
      if (sessionGen !== sessionGenRef.current) return;
      // Latch the write to this session; the settle callbacks check it. Fires
      // synchronously from the user's confirm, so it can trust its closure.
      writeGenRef.current = sessionGenRef.current;
      writeHashRef.current = undefined;
      // The engine taking over ends the gate's turn at the copy and the
      // status: from here the flow's own narration applies (otherwise "sign
      // in your wallet" would hang over the whole transaction), and an
      // INITIALIZED abandoned from here on is a real wallet transaction.
      gateCopyRef.current = null;
      setGateCopy(null);
      gatePhaseRef.current = null;
      // Advance the step from a ref, not inside the setTxStatus updater (StrictMode double-invokes it).
      if (txStatusRef.current === TxStatus.INITIALIZED || txStatusRef.current === TxStatus.LOADING) {
        setCurrentStep(s => s + 1);
      }
      setTxStatus(TxStatus.INITIALIZED);
      txStatusRef.current = TxStatus.INITIALIZED;
      txHashRef.current = undefined;

      // Track transaction started; approve legs report action 'approve' (dev parity)
      const analytics = configRef.current?.analytics;
      if (analytics) {
        trackTransactionStarted({
          widgetName: analytics.widgetName,
          chainId,
          action: variables?.functionName === 'approve' ? 'approve' : analytics.action,
          flow: analytics.flow,
          data: analytics.data,
          flowId: flowIdRef.current
        });
      }
    },
    [sessionGen, chainId, trackTransactionStarted]
  );

  const onStart = useCallback(
    (hash?: string) => {
      if (isStaleWrite(sessionGen)) return;
      writeHashRef.current = hash;
      setTxStatus(TxStatus.LOADING);
      txStatusRef.current = TxStatus.LOADING;
      if (hash) {
        txHashRef.current = hash;
      }
    },
    [sessionGen, chainId, address, isSafeWallet, isStaleWrite]
  );

  const onSuccess = useCallback(
    (hash?: string) => {
      if (isStaleWrite(sessionGen) || isForeignHash(hash)) return;
      setTxStatus(TxStatus.SUCCESS);
      txStatusRef.current = TxStatus.SUCCESS;
      if (hash) {
        txHashRef.current = hash;
      }

      // Track transaction completed (success)
      const analytics = configRef.current?.analytics;
      if (analytics) {
        trackTransactionCompleted({
          widgetName: analytics.widgetName,
          chainId,
          txStatus: 'success',
          txHash: hash,
          action: analytics.action,
          flow: analytics.flow,
          data: analytics.data,
          flowId: flowIdRef.current
        });
      }

      // Captured alongside `analytics`, BEFORE the consumer callback: the
      // close below tears the session down (configRef included), and a
      // consumer that relaunched from its own onSuccess would otherwise put
      // the new flow's copy on this transaction's toast.
      const config = configRef.current;

      configRef.current?.onSuccess?.();
      // Rotate AFTER the consumer callback so anything it emits joins this flow
      if (analytics) {
        startNewFlow();
      }

      // A confirmed transaction no longer holds the modal: it closes itself and
      // the outcome moves to a toast (Figma 859:35901). Dismiss any minimized
      // toast first, so the two never sit stacked.
      if (config) {
        toast.dismiss(MINIMIZED_TOAST_ID);
        const successTitle = config.toast?.success ?? config.subtitles?.success ?? config.title;
        const txHash = hash ?? txHashRef.current;
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
      // Via the ref so this callback doesn't churn on every currentStep
      // change (it is handed to every engine hook). The close
      // snapshots the SUCCESS screen for the modal's 300ms exit, so the
      // handoff reads as the modal leaving, not blinking out.
      handleCloseRef.current();
    },
    [
      sessionGen,
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
      if (isStaleWrite(sessionGen) || isForeignHash(hash)) return;
      setTxStatus(TxStatus.ERROR);
      txStatusRef.current = TxStatus.ERROR;
      if (hash) {
        txHashRef.current = hash;
      }

      // Track transaction completed (error). Bounded classification props only —
      // never the raw message, which can embed addresses and calldata. A wallet
      // rejection is the user backing out, not a failure (APP-444 D1).
      const analytics = configRef.current?.analytics;
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
          flowId: flowIdRef.current
        });
      }

      const normalizedError = toError(error);

      if (shouldCaptureTransactionError(normalizedError)) {
        reportError(normalizedError, {
          module: 'transactions',
          flow: analytics?.flow ?? 'unknown',
          action: analytics?.action ?? 'unknown',
          type: 'transaction_error',
          extra: {
            chainId,
            txHash: hash,
            isSafeWallet,
            widget: analytics?.widgetName ?? 'unknown',
            analyticsData: analytics?.data ?? null
          }
        });
      }

      configRef.current?.onError?.();
      // Rotate AFTER the consumer callback so anything it emits joins this flow
      if (analytics) {
        startNewFlow();
      }
    },
    [
      sessionGen,
      chainId,
      address,
      isSafeWallet,
      trackTransactionCompleted,
      startNewFlow,
      isStaleWrite,
      isForeignHash
    ]
  );

  // Stable while its members are (LOW-churn): the provider value below is
  // memoized, and an unmemoized wrapper object here would defeat it.
  const txCallbacks: TxCallbacks = useMemo(
    () => ({ onMutate, onStart, onSuccess, onError }),
    [onMutate, onStart, onSuccess, onError]
  );

  const modalView: TransactionModalView | null = activeConfig
    ? { config: activeConfig, txStatus, currentStep, preludeSteps, gateCopy }
    : exitingView;

  // Chain guard (APP-528): the modal survives a wallet chain switch (the
  // provider is mounted above the router, so a mainnet-only product page can
  // redirect underneath while its modal stays open), and its editable body then
  // rebuilds calldata against the new chain — resolving a product address on a
  // chain it doesn't live on. Sending that succeeds against a codeless (or
  // attacker-occupied) address. So while a flow's supported set is declared and
  // the connected wallet has left it, block every first-screen CTA and offer a
  // switch back. Read off `modalView.config` (not `activeConfig`) so a modal
  // animating away doesn't flash the guard as it leaves. Applies whenever no
  // write is in flight — IDLE, but also ERROR (Retry, or Back to the first
  // screen, would fire against the new chain) and the terminal states — and
  // is off only while INITIALIZED/LOADING, when the calldata is already in the
  // wallet's hands. `runGated` enforces the same check at fire time; this is
  // the user-facing half.
  const guardConfig = modalView?.config;
  const noWriteInFlight = txStatus !== TxStatus.INITIALIZED && txStatus !== TxStatus.LOADING;
  const chainGuardActive =
    !!guardConfig && noWriteInFlight && offSupportedChains(guardConfig.supportedChainIds, guardChainId);
  const guardTargetChainId = chainGuardActive
    ? chainSwitchTarget(
        guardConfig.supportedChainIds,
        chains.map(c => c.id)
      )
    : undefined;
  const guardTargetName = chains.find(c => c.id === guardTargetChainId)?.name;
  // Safe wallets can't switch networks from the dapp (APP-486) — offer no
  // switch button, only the explanatory block; the guard still disables the CTAs.
  const guardCanSwitch = guardTargetChainId !== undefined && !isSafeWallet;
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
  // without a URL to change. Portfolio is where this matters: its in-place
  // actions reach mainnet-only products from a surface that runs anywhere, so
  // without this the user meets a wall in a modal they opened to transact.
  //
  // Latched to the modal session, which is the counterpart of the route guard's
  // one prompt per module visit. The FIRST evaluation of a session is the only
  // one that can fire, whether or not it does anything: that is what keeps the
  // guard turning active LATER — the APP-528 case, where the user switches the
  // wallet with the modal already open — from yanking them back. That change is
  // deliberate and gets the CTA, not a prompt. A decline is covered by the same
  // latch, so the guard block stays put rather than asking twice.
  const autoSwitchedSessionRef = useRef<number | null>(null);
  useEffect(() => {
    if (autoSwitchedSessionRef.current === sessionGen) return;
    autoSwitchedSessionRef.current = sessionGen;
    if (chainGuardActive && guardCanSwitch) switchGuardChain('transaction_modal_auto');
  }, [sessionGen, chainGuardActive, guardCanSwitch, switchGuardChain]);
  const chainGuard = chainGuardActive
    ? {
        // The chain the guard is judging, not the one wagmi has pinned. Reading
        // `chainId` here named the config's fallback — so a wallet parked on an
        // unconfigured network produced "isn't available on Tenderly. Switch to
        // Tenderly", naming the same chain twice. An unconfigured chain has no
        // name to give (the config is the only registry the app carries), and
        // undefined is right: the copy says "this network" instead of guessing.
        currentName: chains.find(c => c.id === guardChainId)?.name,
        targetName: guardTargetName,
        onSwitch: guardCanSwitch ? onGuardSwitchClick : undefined,
        // The guard's CTA shows the DS loading state while the wallet is
        // answering OUR switch request (not some other surface's).
        switching: switchPending && switchVariables?.chainId === guardTargetChainId
      }
    : null;

  // The gate's prelude steps render ahead of the flow's own list. Composed at
  // render (not written into the config) so a retry that no longer needs the
  // prelude — the signature landed on a previous attempt — restarts with the
  // config's steps alone and step 0 meaning the first real step again.
  const modalSteps = modalView
    ? modalView.preludeSteps
      ? [...modalView.preludeSteps, ...(modalView.config.steps ?? [])]
      : modalView.config.steps
    : undefined;

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
      closeOnNavigation,
      txCallbacks,
      txStatus
    }),
    [launch, updateModalContent, open, minimize, restore, minimized, closeOnNavigation, txCallbacks, txStatus]
  );

  return (
    <TransactionContext.Provider value={contextValue}>
      <EntrySlotContext.Provider value={entrySlotEl}>
        {children}
        {/* In-flight hook host: kept mounted (hidden) for the modal's whole lifetime,
            OUTSIDE the Radix dialog, so minimizing (which unmounts the dialog body)
            never tears down a running transaction. It portals its visible inputs into
            the modal's entry slot when present. See `backgroundContent` in the contract. */}
        {/* Held through the exit alongside the modal itself: this is where the
            widget that portals its inputs into the modal's entry slot lives, so
            unmounting it on close emptied the modal's body a beat before the
            modal had finished animating away. */}
        {modalView?.config.backgroundContent && (
          <div hidden key={`bg-${launchCount}`}>
            {modalView.config.backgroundContent}
          </div>
        )}
        {/* Live state while the modal is up; the retained snapshot while it is
            animating away, which is the only time activeConfig is null here. */}
        {modalView && (
          <TransactionModal
            key={launchCount}
            // Already false by the time the snapshot is rendering — that is
            // what tells Radix to play the exit rather than the enter.
            open={open && !minimized && !!activeConfig}
            registerEntrySlot={setEntrySlotEl}
            registerReturnToFirstScreen={registerReturnToFirstScreen}
            onClose={handleClose}
            onMinimize={minimize}
            title={modalView.config.title}
            transactionTitle={modalView.config.transactionTitle}
            reviewTitle={modalView.config.reviewTitle}
            subtitles={modalView.config.subtitles}
            transactionContent={modalView.config.transactionContent}
            transactionScreenContent={modalView.config.transactionScreenContent}
            entry={modalView.config.entry}
            rightHeaderComponent={modalView.config.rightHeaderComponent}
            titleBadge={modalView.config.titleBadge}
            onConfirm={gatedConfirm}
            // Only defined when the config carries the callback — the modal
            // keys the two-CTA footer off its presence.
            onSecondaryConfirm={modalView.config.onSecondaryConfirm ? gatedSecondaryConfirm : undefined}
            onReviewStage={handleReviewStage}
            onRetry={handleRetry}
            onBack={resetTransactionProgress}
            txStatus={modalView.txStatus}
            confirmLabel={modalView.config.confirmLabel}
            confirmDisabled={modalView.config.confirmDisabled}
            errorMessage={modalView.config.errorMessage}
            successLabel={modalView.config.successLabel}
            errorLabel={modalView.config.errorLabel}
            steps={modalSteps}
            currentStep={modalView.currentStep}
            gateCopy={modalView.gateCopy}
            preflight={preflight}
            chainGuard={chainGuard}
          />
        )}
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
