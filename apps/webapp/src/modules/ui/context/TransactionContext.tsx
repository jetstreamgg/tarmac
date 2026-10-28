import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode
} from 'react';
import { useChainId, useConnection } from 'wagmi';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import { useIsBatchSupported, useIsSafeWallet } from '@/hooks';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import { useAnalyticsFlow } from '@/modules/analytics/context/AnalyticsFlowContext';
import { MODAL_EXIT_MS } from '@/modules/ui/animation/constants';
import type { LaunchOptions, TransactionContextValue } from './transactionContract';
import {
  allowAllGate,
  allowAllPreflight,
  type PreflightHook,
  type PreTransactionGate,
  type TransactionPreflight
} from './preTransactionGate';
import {
  createTransactionSession,
  type SessionEnv,
  type SessionState,
  type TransactionSession
} from './transactionSession';
import {
  dismissMinimizedToast,
  notifyClosedOnChainChange,
  notifyPendingBlock,
  showMinimizedToast
} from './transactionNotices';

const TransactionContext = createContext<TransactionContextValue | null>(null);

// The injected screening preflight hook, shared with the modal and with flows whose own surface fires the transaction.
const PreflightHookContext = createContext<PreflightHook>(allowAllPreflight);

// `active`: the session is live (open or minimized), not animating away after a close.
type SessionHost = { session: TransactionSession; open: boolean; active: boolean };
const SessionHostContext = createContext<SessionHost | null>(null);

const IDLE_STATE: SessionState = {
  status: TxStatus.IDLE,
  currentStep: 0,
  hasMinedStep: false,
  userRejected: false,
  preludeSteps: null,
  gateCopy: null
};
const noSubscription = () => () => {};
const idleState = () => IDLE_STATE;

function useSessionState(session: TransactionSession | null): SessionState {
  return useSyncExternalStore(session?.subscribe ?? noSubscription, session?.getState ?? idleState);
}

/** The flow's own session, for the flow component the provider mounted. */
export function useSessionHost(): SessionHost {
  const host = useContext(SessionHostContext);
  if (!host) throw new Error('useSessionHost must be used within a transaction flow');
  return host;
}

/** The hosted session with its live state, for the modal. */
export function useHostedSession() {
  const host = useSessionHost();
  return { ...host, state: useSessionState(host.session) };
}

/** What a flow component reads from its session: the engine callbacks and the live status. */
export function useSession() {
  const { session } = useSessionHost();
  const { status } = useSessionState(session);
  return { txCallbacks: session.txCallbacks, status };
}

/**
 * Resets the flow's engine when its session ends, then calls `onCleared`. A write
 * still out at the end settles first, and the flow stays mounted until it has, so
 * its receipt is still tracked and nothing after it is sent.
 */
export function useSettleOnEnd(reset: (onCleared?: () => void) => void, onCleared?: () => void) {
  const { session } = useSessionHost();
  const latest = useRef({ reset, onCleared });
  useLayoutEffect(() => {
    latest.current = { reset, onCleared };
  });
  useLayoutEffect(
    () =>
      session.onEnd(settled =>
        latest.current.reset(() => {
          latest.current.onCleared?.();
          settled();
        })
      ),
    [session]
  );
}

/**
 * The screening preflight for a surface that fires the transaction itself (a
 * skipReview flow's page-side Confirm, the stake takeovers): the modal's first
 * screen normally runs this check and holds its CTA; with no first screen the
 * takeover has to. The gate still enforces the verdict at fire time.
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

/** Internal: the injected preflight hook, for the modal. */
export function usePreflightHook(): PreflightHook {
  return useContext(PreflightHookContext);
}

export function TransactionProvider({
  children,
  // The pre-transaction gate (APP-496/501), injectable so tests can exercise the deny and async paths.
  gate = allowAllGate,
  // The screening preflight, a hook called every render: its identity must be stable.
  usePreflight = allowAllPreflight
}: {
  children: ReactNode;
  gate?: PreTransactionGate;
  usePreflight?: PreflightHook;
}) {
  // Warm the EIP-5792 capability probe on connect rather than the first time a flow needs the answer.
  useIsBatchSupported();

  const [live, setLive] = useState<TransactionSession | null>(null);
  // Kept mounted with its modal closed for the exit animation.
  const [exiting, setExiting] = useState<TransactionSession | null>(null);
  // Ended with a write still out: kept mounted until it lands (see useSettleOnEnd).
  const [settling, setSettling] = useState<TransactionSession[]>([]);
  // Hidden while the transaction keeps running.
  const [minimized, setMinimized] = useState(false);
  const liveState = useSessionState(live);
  const { status } = liveState;

  // Read by the stable callbacks below (launch, closeOnNavigation) at call time.
  const liveRef = useRef(live);
  const minimizedRef = useRef(minimized);
  useLayoutEffect(() => {
    liveRef.current = live;
    minimizedRef.current = minimized;
  });

  const chainId = useChainId();
  const { address, chainId: connectedChainId } = useConnection();
  // The wallet's own chain: wagmi's `useChainId` never moves onto a chain the app
  // doesn't configure, so a guard reading it would stay silent on exactly the
  // wrong-chain case it exists to stop.
  const guardChainId = connectedChainId ?? chainId;
  const isSafeWallet = useIsSafeWallet();
  const analytics = useAppAnalytics();
  const { startNewFlow, getFlowId } = useAnalyticsFlow();

  const env: SessionEnv = {
    chainId,
    guardChainId,
    address,
    isSafeWallet,
    gate,
    analytics,
    startNewFlow,
    getFlowId
  };
  const envRef = useRef(env);
  useLayoutEffect(() => {
    envRef.current = env;
  });
  const getEnv = useCallback(() => envRef.current, []);

  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => (exitTimerRef.current ? clearTimeout(exitTimerRef.current) : undefined), []);

  const endSession = useCallback((session: TransactionSession) => {
    session.end(() => setSettling(list => list.filter(s => s !== session)));
    if (session.settling) setSettling(list => [...list, session]);
  }, []);

  const closeSession = useCallback(
    (session: TransactionSession) => {
      if (session.closed) return;
      // Closing at INITIALIZED abandons the pending request.
      session.abandon();
      endSession(session);
      if (liveRef.current === session) liveRef.current = null;
      setLive(current => (current === session ? null : current));
      setMinimized(false);
      minimizedRef.current = false;
      setExiting(session);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      exitTimerRef.current = setTimeout(
        () => setExiting(current => (current === session ? null : current)),
        MODAL_EXIT_MS
      );
    },
    [endSession]
  );

  const launch = useCallback(
    (options: LaunchOptions) => {
      const current = liveRef.current;
      if (current) {
        // One broadcast transaction at a time: it's on-chain and will resolve, so bring it
        // back into view and say why. A sequence waiting on its next prompt after a mined
        // step is in progress too.
        const { status, hasMinedStep } = current.getState();
        if (status === TxStatus.LOADING || (status === TxStatus.INITIALIZED && hasMinedStep)) {
          setMinimized(false);
          minimizedRef.current = false;
          notifyPendingBlock();
          return;
        }
        // Nothing on-chain: the new flow abandons it.
        current.abandon();
        endSession(current);
      }
      const session = createTransactionSession({
        options,
        env: getEnv,
        requestClose: () => closeSession(session)
      });
      liveRef.current = session;
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      setExiting(null);
      setLive(session);
      setMinimized(false);
      minimizedRef.current = false;
    },
    [getEnv, closeSession, endSession]
  );

  const minimize = useCallback(() => {
    minimizedRef.current = true;
    setMinimized(true);
  }, []);
  const restore = useCallback(() => {
    minimizedRef.current = false;
    setMinimized(false);
  }, []);

  // A session does not survive a wallet chain switch once a write was attempted:
  // everything past IDLE (the prepared calls, Retry, the receipt it waits on) was
  // built for the chain it started on. At IDLE the switch is legitimate and the
  // chain is adopted; in flight nothing closes until the prompt or the broadcast
  // settles (the status dep re-runs this then). Only while a wallet is attached:
  // a dropped connection falls back to the config chain and would read as a switch.
  useEffect(() => {
    if (!live || !address) return;
    if (live.chain === guardChainId) return;
    if (status === TxStatus.IDLE) {
      live.adoptChain(guardChainId);
      return;
    }
    if (status === TxStatus.INITIALIZED || status === TxStatus.LOADING) return;
    live.close();
    notifyClosedOnChainChange();
  }, [live, address, guardChainId, status]);

  // Stable: the shell keys its effect on the pathname alone.
  const closeOnNavigation = useCallback(
    (pathname: string) => {
      const session = liveRef.current;
      if (!session) return;
      if (session.launchPathname === pathname) return;
      if (minimizedRef.current) return;
      const { status } = session.getState();
      if (status === TxStatus.INITIALIZED || status === TxStatus.LOADING) return;
      closeSession(session);
    },
    [closeSession]
  );

  // While minimized the modal is hidden, so its progress shows as a toast.
  useEffect(() => {
    if (!minimized) {
      dismissMinimizedToast();
      return;
    }
    const view = live?.view;
    if (!live || !view) return;
    const inFlight = status === TxStatus.LOADING || status === TxStatus.INITIALIZED;
    if (status !== TxStatus.ERROR && !inFlight) return;
    showMinimizedToast({
      status,
      title: view.toast?.[status === TxStatus.ERROR ? 'error' : 'loading'] ?? view.title,
      hash: live.txHash,
      inFlight,
      onView: restore
    });
    return () => dismissMinimizedToast();
  }, [minimized, live, status, restore]);

  const liveHost = useMemo(
    () => (live ? { session: live, open: !minimized, active: true } : null),
    [live, minimized]
  );
  const closedHosts = useMemo(
    () =>
      [...settling, exiting]
        .filter((session, index, list) => session && session !== live && list.indexOf(session) === index)
        .map(session => ({ session: session!, open: false, active: false })),
    [settling, exiting, live]
  );
  const isSettling = useCallback(
    (sessionId: string) => settling.some(session => session.sessionId === sessionId),
    [settling]
  );

  const contextValue = useMemo<TransactionContextValue>(
    () => ({
      launch,
      isModalOpen: !!live,
      minimize,
      restore,
      isMinimized: minimized,
      activeSessionId: live?.sessionId ?? null,
      isSettling,
      closeOnNavigation
    }),
    [launch, live, minimize, restore, minimized, isSettling, closeOnNavigation]
  );

  return (
    <TransactionContext.Provider value={contextValue}>
      <PreflightHookContext.Provider value={usePreflight}>
        {children}
        {[...closedHosts, liveHost].map(
          host =>
            host && (
              <SessionHostContext.Provider key={host.session.id} value={host}>
                <div hidden>{host.session.flow}</div>
              </SessionHostContext.Provider>
            )
        )}
      </PreflightHookContext.Provider>
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
