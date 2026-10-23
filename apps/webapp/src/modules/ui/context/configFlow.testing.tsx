import { useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react';
import type { Call } from 'viem';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import { TransactionModal } from '@/modules/ui/components/TransactionModal';
import type { CallMatcher } from '@/modules/ui/lib/callIntent';
import { useSession, useTransaction } from './TransactionContext';
import type {
  LaunchOptions,
  TransactionEntry,
  TransactionFlowProps,
  TxCallbacks
} from './transactionContract';

/**
 * Test-only: a flow described as one config object, the way the provider suites
 * describe them. `launch(config)` mounts a flow that renders `TransactionModal`
 * from the config; `updateModalContent` re-renders it with a patch. The dispatch
 * checks are getters, read when the session dispatches.
 */
export type TransactionConfig = Omit<TransactionFlowProps, 'dispatch' | 'entry' | 'subtitle'> &
  Omit<LaunchOptions, 'flow'> & {
    entry?: Partial<TransactionEntry>;
    subtitles?: { review?: string };
    getNextCalls?: () => readonly Call[];
    callMatches?: CallMatcher;
    getConfirmDisabled?: () => boolean;
    getDispatchBlocked?: () => boolean;
  };

export type LiveModalUpdate = Partial<Omit<TransactionConfig, 'entry'>> & {
  entry?: Partial<TransactionEntry>;
};

const configs = new Map<number, TransactionConfig>();
let launchCount = 0;
let activeToken = 0;
let callbacks: TxCallbacks | undefined;
let status = TxStatus.IDLE;
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version += 1;
  listeners.forEach(listener => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getVersion = () => version;

const noopCallbacks: TxCallbacks = {
  onMutate: () => {},
  onStart: () => {},
  onSuccess: () => {},
  onError: () => {}
};

function toFlowProps(token: number, config: TransactionConfig): TransactionFlowProps {
  const latest = () => configs.get(token) ?? config;
  const reportsDispatch =
    config.getNextCalls || config.callMatches || config.getConfirmDisabled || config.getDispatchBlocked;
  return {
    ...config,
    subtitle: config.subtitles?.review,
    entry: config.entry ? ({ content: null, ...config.entry } as TransactionEntry) : undefined,
    onConfirm: () => latest().onConfirm(),
    onSecondaryConfirm: config.onSecondaryConfirm ? () => latest().onSecondaryConfirm?.() : undefined,
    onRetry: config.onRetry ? () => latest().onRetry?.() : undefined,
    dispatch: reportsDispatch
      ? {
          get nextCalls() {
            return latest().getNextCalls?.();
          },
          get callMatches() {
            return latest().callMatches;
          },
          get disabled() {
            return latest().getConfirmDisabled?.();
          },
          get blocked() {
            return latest().getDispatchBlocked?.();
          }
        }
      : undefined
  };
}

function ConfigFlow({ token }: { token: number }) {
  useSyncExternalStore(subscribe, getVersion);
  const session = useSession();
  useLayoutEffect(() => {
    activeToken = token;
  }, [token]);
  useLayoutEffect(() => {
    if (activeToken !== token) return;
    if (callbacks === session.txCallbacks && status === session.status) return;
    callbacks = session.txCallbacks;
    status = session.status;
    emit();
  });
  const config = configs.get(token);
  return config ? <TransactionModal {...toFlowProps(token, config)} /> : null;
}

export type TestTransaction = ReturnType<typeof useTestTransaction>;

/** `useTransaction()` plus the config-shaped launch, live updates and the active session's callbacks. */
export function useTestTransaction() {
  useSyncExternalStore(subscribe, getVersion);
  const transaction = useTransaction();
  return {
    ...transaction,
    /** `alongside` mounts with the flow, for the session's lifetime (an engine stand-in). */
    launch: (config: TransactionConfig, alongside?: ReactNode) => {
      const token = ++launchCount;
      configs.set(token, config);
      transaction.launch({
        flow: (
          <>
            {alongside}
            <ConfigFlow token={token} />
          </>
        ),
        sessionId: config.sessionId,
        supportedChainIds: config.supportedChainIds,
        chainGuardReason: config.chainGuardReason
      });
    },
    updateModalContent: (sessionId: string, partial: LiveModalUpdate) => {
      const config = configs.get(activeToken);
      if (!config || config.sessionId !== sessionId) return;
      const { entry, ...rest } = partial;
      configs.set(activeToken, {
        ...config,
        ...rest,
        ...(entry ? { entry: { ...config.entry, ...entry } } : {})
      });
      emit();
    },
    txCallbacks: callbacks ?? noopCallbacks,
    txStatus: transaction.isModalOpen ? status : TxStatus.IDLE
  };
}

/** Re-renders the launched flow, so it re-reads module-level mocks (a wallet moved under an open modal). */
export function refreshTestFlow() {
  emit();
}

export function resetTestTransaction() {
  configs.clear();
  activeToken = 0;
  callbacks = undefined;
  status = TxStatus.IDLE;
}
