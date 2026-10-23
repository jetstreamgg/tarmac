import { TxStatus } from '@/modules/ui/lib/txStatus';
import { isStalledStep, toError, type TxMutateVariables } from '@/hooks';
import { getTransactionLink } from '@/utils';
import { refreshHistoryAfterTx } from '@/lib/historyRefresh';
import { queryClient } from '@/lib/queryClient';
import { reportError } from '@/modules/sentry/reportError';
import { TransactionRevertedError } from '@/hooks/shared/useTransactionOutcome';
import { classifyTransactionError } from '@/modules/analytics/lib/classifyTransactionError';
import { isUserRejectedRequestError } from '@/modules/utils/isUserRejectedRequestError';
import type { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import type { TransactionStep } from '@/modules/ui/components/transactionStepsModel';
import { encodeCalls, isTailOf, type EncodedCall } from '@/modules/ui/lib/callIntent';
import type {
  LaunchOptions,
  TransactionAnalytics,
  TransactionFlowProps,
  TxCallbacks
} from './transactionContract';
import type {
  GateControls,
  GatePhase,
  GateStatusCopy,
  GateTrigger,
  PreTransactionGate
} from './preTransactionGate';
import {
  notifyDispatchRefused,
  notifyRequestAbandoned,
  notifyReviewAgainOnChainChange,
  notifySignatureRequestAbandoned,
  notifySuccess
} from './transactionNotices';

type AppAnalytics = ReturnType<typeof useAppAnalytics>;

/** What a session reads from the app at the moment it acts. */
export type SessionEnv = {
  /** wagmi's configured chain. */
  chainId: number;
  /** The wallet's own chain (wagmi's when disconnected): what the chain checks judge. */
  guardChainId: number;
  address: string | undefined;
  isSafeWallet: boolean;
  gate: PreTransactionGate;
  analytics: Pick<
    AppAnalytics,
    | 'trackWidgetReviewViewed'
    | 'trackTransactionStarted'
    | 'trackTransactionCompleted'
    | 'trackTermsSignatureDeclined'
  >;
  startNewFlow: () => void;
  getFlowId: () => string | undefined;
};

export type SessionState = {
  status: TxStatus;
  currentStep: number;
  /**
   * An on-chain step of this session has mined: the engine's paused run is the only
   * memory of it, so a failure must resume, never reopen the inputs (APP-448).
   */
  hasMinedStep: boolean;
  /** The ERROR on screen is a wallet Reject. */
  userRejected: boolean;
  /** Gate-mounted off-chain steps ahead of the flow's own (the terms signature, APP-501). */
  preludeSteps: TransactionStep[] | null;
  /** Gate-owned status copy, while a gate phase drives the modal. */
  gateCopy: GateStatusCopy | null;
};

const INITIAL_STATE: SessionState = {
  status: TxStatus.IDLE,
  currentStep: 0,
  hasMinedStep: false,
  userRejected: false,
  preludeSteps: null,
  gateCopy: null
};

/** The modal's back-to-screen actions, registered while it is mounted. */
type ModalScreens = { returnToFirstScreen: () => void; returnToReview: () => void };

export type TransactionSession = ReturnType<typeof createTransactionSession>;

let sessionCount = 0;

const offSupportedChains = (supportedChainIds: readonly number[], chainId: number) =>
  supportedChainIds.length > 0 && !supportedChainIds.includes(chainId);

/** The props as they apply to the clicked action: the secondary CTA brings its own steps and analytics. */
export function forAction(props: TransactionFlowProps, secondary: boolean) {
  return secondary
    ? {
        steps: props.secondarySteps ?? props.steps,
        analytics: props.secondaryAnalytics ?? props.analytics
      }
    : { steps: props.steps, analytics: props.analytics };
}

/**
 * One launch of a flow. Everything the session tracks lives here, so a session
 * that has closed can only ever reach itself: its engine's late callbacks are
 * no-ops by construction.
 */
export function createTransactionSession({
  options,
  env,
  requestClose
}: {
  options: LaunchOptions;
  env: () => SessionEnv;
  requestClose: () => void;
}) {
  let state = INITIAL_STATE;
  const listeners = new Set<() => void>();
  const setState = (patch: Partial<SessionState>) => {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  };

  const launchEnv = env();
  // flow_id latched so this session's events stay joined if navigation rotates it.
  const flowId = launchEnv.getFlowId();
  // The chain the session's write belongs to: adopted while IDLE (see the provider's chain-change close).
  let chain = launchEnv.guardChainId;
  const launchPathname = window.location.pathname;

  let closed = false;
  // The flow's engine reset, run at the end; `settling` until a write still out at the end has landed.
  let settle: ((settled: () => void) => void) | null = null;
  let settling = false;
  // The secondary CTA was the last one clicked.
  let secondary = false;
  // Which gate phase owns an INITIALIZED status (null: the engine does, via onMutate).
  let gatePhase: GatePhase | null = null;
  // While a verdict is pending further gated calls are ignored: two allows would be two onConfirms.
  let gateInFlight = false;
  let txHash: string | undefined;
  // The calls and account the user confirmed. Undefined when the flow doesn't
  // report its calls; null when they couldn't be encoded, which fails closed.
  let confirmedCalls: EncodedCall[] | null | undefined;
  let confirmedAddress: string | undefined;

  // `view`: the props on screen, frozen by the modal once the status leaves IDLE.
  // `live`: the flow's latest render, for what must act on current state (execute, the dispatch checks).
  let view: TransactionFlowProps | undefined;
  let live: TransactionFlowProps | undefined;
  let screens: ModalScreens | undefined;

  const viewAnalytics = (): TransactionAnalytics | undefined =>
    view ? forAction(view, secondary).analytics : undefined;

  function emitTermsSignatureDeclined(method: 'wallet_rejected' | 'abandoned') {
    const analytics = viewAnalytics();
    env().analytics.trackTermsSignatureDeclined({
      method,
      chainId: env().chainId,
      widgetName: analytics?.widgetName,
      flow: analytics?.flow,
      action: analytics?.action,
      flowId
    });
  }

  /**
   * A close (or relaunch) found the session at INITIALIZED. Only the engine's
   * wallet transaction is a cancelled transaction: the gate phases run before
   * onMutate, so no flow_started has fired for a cancelled completion to pair with.
   */
  function abandon() {
    if (state.status !== TxStatus.INITIALIZED) return;
    if (gatePhase === 'screening') return;
    if (gatePhase === 'signature') {
      emitTermsSignatureDeclined('abandoned');
      env().startNewFlow();
      notifySignatureRequestAbandoned();
      return;
    }
    const analytics = viewAnalytics();
    if (analytics) {
      env().analytics.trackTransactionCompleted({
        widgetName: analytics.widgetName,
        chainId: env().chainId,
        txStatus: 'cancelled',
        action: analytics.action,
        flow: analytics.flow,
        data: analytics.data,
        flowId
      });
      env().startNewFlow();
    }
    notifyRequestAbandoned();
  }

  function close() {
    if (closed) return;
    requestClose();
  }

  function walletOnSupportedChain() {
    return !offSupportedChains(options.supportedChainIds, env().guardChainId);
  }

  function returnToFirstScreen() {
    setState({ status: TxStatus.IDLE, gateCopy: null });
    gatePhase = null;
    // A skipReview flow has no first screen, and a session with a mined step must not
    // reopen its inputs while the paused run would still resume the confirmed calls.
    if (view?.skipReview || state.hasMinedStep) close();
    else screens?.returnToFirstScreen();
  }

  const controls: GateControls = {
    setGateStatus: (status, copy) => {
      if (closed) return;
      const isGatePhase = status === 'screening' || status === 'signature';
      gatePhase = isGatePhase ? status : null;
      setState({
        status: isGatePhase ? TxStatus.INITIALIZED : status === 'error' ? TxStatus.ERROR : TxStatus.IDLE,
        gateCopy: copy ?? null
      });
    },
    setPreludeSteps: steps => {
      if (closed) return;
      setState({ preludeSteps: steps });
    },
    closeModal: () => {
      if (closed) return;
      close();
    },
    returnToFirstScreen: () => {
      if (closed) return;
      returnToFirstScreen();
    },
    reportSignatureRejected: () => {
      if (closed) return;
      emitTermsSignatureDeclined('wallet_rejected');
    },
    isStale: () => closed
  };

  // A wrong-chain refusal lands on the first screen, where the guard's copy and switch CTA render.
  function refuseOffChain() {
    controls.setPreludeSteps(null);
    controls.returnToFirstScreen();
  }

  /**
   * The single gate point between a click and the flow's action (APP-496): confirm,
   * the secondary CTA and Retry all funnel here. A synchronous allow runs the action
   * in the same tick as the click.
   */
  function runGated(trigger: GateTrigger, action: () => void) {
    if (closed || gateInFlight) return;
    if (!walletOnSupportedChain()) {
      refuseOffChain();
      return;
    }
    // A confirm fixes the calls and the account; a retry re-sends what was confirmed.
    if (trigger !== 'retry') {
      const calls = live?.dispatch?.nextCalls;
      confirmedCalls = calls ? encodeCalls(calls) : undefined;
      if (calls && confirmedCalls === null) {
        // Fails closed, so every confirm of this flow is refused: report it, or the loop is invisible.
        reportError(new Error('Confirmed calls could not be encoded'), {
          module: 'transactions',
          flow: viewAnalytics()?.flow ?? 'unknown',
          action: viewAnalytics()?.action ?? 'unknown',
          type: 'call_snapshot_unencodable',
          extra: { calls: calls.map(call => ({ to: call.to, functionName: call.functionName })) }
        });
      }
      confirmedAddress = env().address;
    }
    // Back to the review at IDLE, or closed when there is none to return to (a
    // skipReview flow, or a mined step whose paused run would resume the old calls).
    const refuseDispatch = (): boolean => {
      const closes = !!view?.skipReview || state.hasMinedStep;
      controls.setPreludeSteps(null);
      controls.setGateStatus('idle');
      if (closes) close();
      else screens?.returnToReview();
      return closes;
    };
    const callsStillConfirmed = () => {
      const nextCalls = live?.dispatch?.nextCalls;
      if (!nextCalls) return true;
      const encoded = encodeCalls(nextCalls);
      return !!confirmedCalls && !!encoded && isTailOf(encoded, confirmedCalls, live?.dispatch?.callMatches);
    };
    const dispatch = () => {
      const address = env().address;
      if (address?.toLowerCase() !== confirmedAddress?.toLowerCase()) {
        const refusedClosed = refuseDispatch();
        notifyDispatchRefused(address ? 'account' : 'disconnect', refusedClosed);
        return;
      }
      // Not the form's gating on a retry after a mined step: the run moved the balances it checks.
      const checkFormGating = trigger !== 'retry' || !state.hasMinedStep;
      if (
        !callsStillConfirmed() ||
        live?.dispatch?.blocked ||
        (checkFormGating && live?.dispatch?.disabled)
      ) {
        notifyDispatchRefused('calls', refuseDispatch());
        return;
      }
      action();
    };
    const chainAtClick = env().guardChainId;
    const verdict = env().gate({ trigger, usdValue: view?.usdValue, controls });
    if (verdict instanceof Promise) {
      gateInFlight = true;
      verdict
        .then(
          result => {
            if (closed || !result.allow) return;
            if (!walletOnSupportedChain()) {
              refuseOffChain();
              return;
            }
            // A move between two supported chains is refused too: the first screen
            // re-derives for the new chain, and since the guard has nothing to say, a toast does.
            if (env().guardChainId !== chainAtClick) {
              refuseOffChain();
              notifyReviewAgainOnChainChange();
              return;
            }
            dispatch();
          },
          () => {}
        )
        .finally(() => {
          gateInFlight = false;
        });
      return;
    }
    if (verdict.allow) dispatch();
  }

  const txCallbacks: TxCallbacks = {
    onMutate: (variables?: TxMutateVariables) => {
      if (closed) return;
      // The engine takes over the status and the copy from the gate.
      gatePhase = null;
      const inFlight = state.status === TxStatus.INITIALIZED || state.status === TxStatus.LOADING;
      // A sequential engine dispatches the next call only once the previous
      // receipt landed, so a write arriving over LOADING means a step mined.
      const mined = state.status === TxStatus.LOADING;
      txHash = undefined;
      setState({
        gateCopy: null,
        status: TxStatus.INITIALIZED,
        currentStep: inFlight ? state.currentStep + 1 : state.currentStep,
        hasMinedStep: state.hasMinedStep || mined
      });
      const analytics = viewAnalytics();
      if (analytics) {
        env().analytics.trackTransactionStarted({
          widgetName: analytics.widgetName,
          chainId: env().chainId,
          action: variables?.functionName === 'approve' ? 'approve' : analytics.action,
          flow: analytics.flow,
          data: analytics.data,
          flowId
        });
      }
    },
    onStart: (hash?: string) => {
      if (closed) return;
      if (hash) txHash = hash;
      setState({ status: TxStatus.LOADING });
    },
    onSuccess: (hash?: string, blockNumber?: bigint) => {
      // Ahead of the closed check: a transaction that mined after its modal closed
      // still lands in the history tables. The session's chain, not the wallet's:
      // a batch receipt can land after a network switch.
      void refreshHistoryAfterTx(queryClient, { chainId: chain, blockNumber });
      if (closed) return;
      if (hash) txHash = hash;
      setState({ status: TxStatus.SUCCESS });
      const analytics = viewAnalytics();
      if (analytics) {
        env().analytics.trackTransactionCompleted({
          widgetName: analytics.widgetName,
          chainId: chain,
          txStatus: 'success',
          txHash: hash,
          action: analytics.action,
          flow: analytics.flow,
          data: analytics.data,
          flowId
        });
      }
      // Captured before the consumer callback, which may launch another flow.
      const toastTitle = view ? (view.toast?.success ?? view.title) : undefined;
      live?.onSuccess?.();
      // Rotated after the consumer callback so anything it emits joins this flow.
      if (analytics) env().startNewFlow();
      // A confirmed transaction closes its modal; the outcome moves to a toast (Figma 859:35901).
      if (toastTitle !== undefined) {
        const { address, isSafeWallet } = env();
        notifySuccess(
          toastTitle,
          txHash,
          txHash ? getTransactionLink(chain, address, txHash, isSafeWallet) : undefined
        );
      }
      close();
    },
    onError: (error: Error, hash?: string) => {
      if (closed) return;
      // A refusal before any write (the batch engine's backstops) never started a transaction.
      const preWriteRefusal = !hash && state.status === TxStatus.IDLE;
      if (hash) txHash = hash;
      // A run that stalls after a mined step never hands its next call to the wallet,
      // so no write reports the mined step or moves onto the stalled one; the error does both.
      const stalled = isStalledStep(error);
      setState({
        status: TxStatus.ERROR,
        userRejected: isUserRejectedRequestError(error),
        ...(stalled && { hasMinedStep: true, currentStep: state.currentStep + 1 })
      });

      // Bounded classification props only: the raw message can embed addresses and calldata.
      const analytics = preWriteRefusal ? undefined : viewAnalytics();
      if (analytics) {
        const classification = classifyTransactionError(error, !!hash);
        env().analytics.trackTransactionCompleted({
          widgetName: analytics.widgetName,
          chainId: chain,
          txStatus: classification.is_user_rejection ? 'cancelled' : 'error',
          txHash: hash,
          action: analytics.action,
          flow: analytics.flow,
          data: { ...analytics.data, ...classification },
          flowId
        });
      }

      const normalizedError = toError(error);
      if (!isUserRejectedRequestError(normalizedError)) {
        const flowAnalytics = viewAnalytics();
        const flow = flowAnalytics?.flow ?? 'unknown';
        const action = flowAnalytics?.action ?? 'unknown';
        reportError(normalizedError, {
          module: 'transactions',
          flow,
          action,
          type: preWriteRefusal ? 'transaction_refused' : 'transaction_error',
          // Every revert has the same message: one issue per flow and action.
          fingerprint:
            normalizedError instanceof TransactionRevertedError
              ? ['transaction-reverted', flow, action]
              : undefined,
          extra: {
            chainId: chain,
            txHash: hash,
            isSafeWallet: env().isSafeWallet,
            widget: flowAnalytics?.widgetName ?? 'unknown',
            analyticsData: flowAnalytics?.data ?? null
          }
        });
      }

      live?.onError?.();
      if (analytics) env().startNewFlow();
    }
  };

  return {
    id: ++sessionCount,
    sessionId: options.sessionId ?? null,
    supportedChainIds: options.supportedChainIds,
    chainGuardReason: options.chainGuardReason,
    flow: options.flow,
    launchPathname,
    txCallbacks,
    controls,

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getState: () => state,
    get closed() {
      return closed;
    },
    get settling() {
      return settling;
    },
    onEnd(fn: (settled: () => void) => void) {
      settle = fn;
      return () => {
        if (settle === fn) settle = null;
      };
    },
    get chain() {
      return chain;
    },
    adoptChain(chainId: number) {
      chain = chainId;
    },
    get txHash() {
      return txHash;
    },
    get view() {
      return view;
    },

    /** Called by the modal after every commit. */
    register(next: { view: TransactionFlowProps; live: TransactionFlowProps; screens: ModalScreens }) {
      view = next.view;
      live = next.live;
      screens = next.screens;
    },
    /** Whether the secondary CTA is the one in play (its steps and analytics apply). */
    get secondary() {
      return secondary;
    },

    /** Launch is the review view on review-first and skipReview flows. */
    reviewViewed() {
      const analytics = viewAnalytics();
      if (!analytics) return;
      env().analytics.trackWidgetReviewViewed({
        widgetName: analytics.widgetName,
        chainId: env().chainId,
        flow: analytics.flow,
        action: analytics.action,
        data: analytics.data,
        flowId
      });
    },

    confirm() {
      if (closed || gateInFlight) return;
      secondary = false;
      runGated('confirm', () => live?.onConfirm());
    },
    // The clicked action's steps and analytics apply from the click, the gate's phases included.
    confirmSecondary() {
      if (closed || gateInFlight) return;
      secondary = true;
      runGated('secondaryConfirm', () => live?.onSecondaryConfirm?.());
    },
    retry() {
      const preludeBefore = state.preludeSteps?.length ?? 0;
      // The reset lives inside the gate: a denied retry leaves the failure view in place.
      runGated('retry', () => {
        if (state.hasMinedStep) {
          // The engine resumes at the failed write; shift past any prelude the gate dropped.
          const dropped = preludeBefore - (state.preludeSteps?.length ?? 0);
          if (dropped > 0) setState({ currentStep: state.currentStep - dropped });
        } else {
          setState({ currentStep: 0 });
        }
        (live?.onRetry ?? live?.onConfirm)?.();
      });
    },
    /** Back to an editable first screen, so the status returns to IDLE with it (APP-448). */
    back() {
      setState({ currentStep: 0, status: TxStatus.IDLE });
    },
    close,
    abandon,
    /** Marks the session over: every callback and gate control is a no-op from here. */
    end(onSettled: () => void) {
      if (closed) return;
      closed = true;
      gateInFlight = false;
      if (!settle) return;
      settling = true;
      settle(() => {
        if (!settling) return;
        settling = false;
        onSettled();
      });
    }
  };
}
