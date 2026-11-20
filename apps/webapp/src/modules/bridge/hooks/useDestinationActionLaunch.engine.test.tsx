/**
 * @vitest-environment happy-dom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { createElement, useState, type ReactNode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from '@/modules/ui/context/transactionContract';
import { opStackDepositMessage, opStackReplay } from '../adapters/nativeDeposit/opStack';
import { BASE_DEPOSIT_LOGS, OPTIMISM_DEPOSIT_LOGS } from '../adapters/nativeDeposit/depositFixtures';
import { applyProgress, createPendingBridge } from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { useDestinationActionLaunch } from './useDestinationActionLaunch';

// The launcher, the replay legs, their engine and its receipt wait all run for real; only the
// wallet (wagmi) and the node (viem's receipt wait) are faked.

type Request = { functionName: string; args: readonly unknown[] };
type Wait = { resolve: (receipt: object) => void; onReplaced?: (replacement: object) => void };

const mocks = vi.hoisted(() => ({
  address: '',
  walletChainId: 8453,
  launched: [] as TransactionConfig[],
  isModalOpen: true,
  session: {} as TxCallbacks,
  // the wallet: each prompt's request, in order, and the mutation options of the last engine rendered
  prompts: [] as { functionName: string; args: readonly unknown[] }[],
  mutation: undefined as
    | undefined
    | {
        onSuccess?: (hash: string, request: object) => void;
        onError?: (error: Error, request: object) => void;
      },
  setWrite: undefined as undefined | ((update: (state: object) => object) => void),
  // the node: the receipt wait of each hash
  waits: new Map<string, Wait>()
}));

vi.mock('wagmi', async () => {
  const { useState: useWriteState } = await import('react');
  return {
    useConnection: () => ({ address: mocks.address, chainId: mocks.walletChainId }),
    useChainId: () => mocks.walletChainId,
    useChains: () => [1, 8453, 10].map(id => ({ id })),
    useConfig: () => ({}),
    useReadContract: ({ functionName, query }: { functionName: string; query?: { enabled?: boolean } }) => ({
      data: functionName === 'baseGas' && query?.enabled !== false ? 100_000n : undefined,
      error: null
    }),
    useSimulateContract: (params: Request & { query?: { enabled?: boolean } }) => ({
      data: params.query?.enabled
        ? { request: { functionName: params.functionName, args: params.args } }
        : undefined,
      isLoading: false,
      error: null,
      refetch: () => Promise.resolve({})
    }),
    useWriteContract: (options: {
      mutation: NonNullable<typeof mocks.mutation> & { onMutate?: (r: object) => void };
    }) => {
      const [state, setState] = useWriteState<{ data?: string; variables?: object; isPending: boolean }>({
        isPending: false
      });
      mocks.mutation = options.mutation;
      mocks.setWrite = setState as unknown as typeof mocks.setWrite;
      return {
        writeContract: (request: Request) => {
          options.mutation.onMutate?.(request);
          mocks.prompts.push(request);
          setState({ variables: request, isPending: true });
        },
        error: null,
        data: state.data,
        variables: state.variables,
        isPending: state.isPending,
        reset: () => setState({ isPending: false })
      };
    }
  };
});
vi.mock('wagmi/actions', () => ({ getPublicClient: () => ({}) }));
vi.mock('viem/actions', async importOriginal => ({
  ...(await importOriginal<typeof import('viem/actions')>()),
  waitForTransactionReceipt: (
    _client: unknown,
    { hash, onReplaced }: { hash: string } & Pick<Wait, 'onReplaced'>
  ) => new Promise(resolve => mocks.waits.set(hash, { resolve, onReplaced }))
}));
vi.mock('@/hooks/shared/useWaitForSafeTxHash', () => ({
  useWaitForSafeTxHash: () => ({ transactionHash: undefined, isSafeApp: false })
}));
vi.mock('@/hooks/shared/prepareRevertReporter', () => ({ reportPrepareRevert: () => undefined }));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useIsSafeWallet: () => false,
  useSafeWalletStatus: () => 'not-safe'
}));
vi.mock('@/hooks/wallet/useIsSafeApp', () => ({ useIsSafeApp: () => false }));
vi.mock('@/modules/ui/hooks/engineLaunch', () => ({
  useShouldUseBatch: () => false,
  useBatchSupportPending: () => false
}));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: (config: TransactionConfig) => mocks.launched.push(config),
    updateModalContent: () => undefined,
    txCallbacks: mocks.session,
    isModalOpen: mocks.isModalOpen,
    isMinimized: false,
    activeSessionId: undefined,
    restore: vi.fn()
  })
}));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({ canSwitchChain: true, handleSwitchChain: () => undefined })
}));
vi.mock('@/modules/ui/hooks/useResetUnfinishedRunOnClose', () => ({
  useResetUnfinishedRunOnClose: () => undefined
}));
// The other actions' legs stay idle: only the replay engine is under test.
const { idleLegs } = vi.hoisted(() => ({
  idleLegs: () => ({
    calls: [],
    isBatch: false,
    ready: false,
    error: null,
    execute: () => undefined,
    reset: () => undefined,
    release: () => undefined,
    dropCheck: () => undefined
  })
}));
vi.mock('./useCctpClaimLegs', () => ({ CCTP_CLAIM_FUNCTION: 'receiveMessage', useCctpClaimLegs: idleLegs }));
vi.mock('./useCctpConvertLegs', () => ({ useCctpConvertLegs: idleLegs }));
vi.mock('./useArbitrumRedeemLegs', () => ({ useArbitrumRedeemLegs: idleLegs }));
vi.mock('./useNativeWithdrawalActionLegs', () => ({ useNativeWithdrawalActionLegs: idleLegs }));

const NOW = 1_800_000_000_000;
let accountSeq = 0;
const scope = () => pendingScopeKey({ account: mocks.address, familyChainId: 1 });
const stored = (id: string) => pendingBridgeStore.getSnapshot(scope()).find(bridge => bridge.id === id)!;

const DEPOSITS = {
  base: { logs: BASE_DEPOSIT_LOGS, chainId: 8453, txHash: '0xdepositbase' },
  optimism: { logs: OPTIMISM_DEPOSIT_LOGS, chainId: 10, txHash: '0xdepositop' }
} as const;
type Network = keyof typeof DEPOSITS;

const routeDataOf = (network: Network) => {
  const message = opStackDepositMessage(DEPOSITS[network].logs, network)!;
  return { msgHash: message.msgHash, relayCalldata: message.relayCalldata };
};
/** The relayMessage args the replay of `network`'s deposit sends. */
const replayArgs = (network: Network) => opStackReplay(network, routeDataOf(network)).args;

const seedReadyReplay = (network: Network) => {
  const resolved = resolveBridgeRoute({ from: 'ethereum', to: network, amount: 1n, facts: {} });
  if (resolved.status !== 'ok') throw new Error(resolved.reason);
  const bridge = createPendingBridge({
    account: mocks.address,
    amount: 10n ** 18n,
    from: 'ethereum',
    to: network,
    route: resolved.route,
    txHash: DEPOSITS[network].txHash,
    now: NOW
  });
  pendingBridgeStore.upsert(
    scope(),
    applyProgress(bridge, { kind: 'ready', nextAction: 'replay', routeData: routeDataOf(network) }, NOW)
  );
  return stored(DEPOSITS[network].txHash);
};

const sessionFor = (name: string, log: string[]): TxCallbacks => ({
  onMutate: () => log.push(`${name}.onMutate`),
  onStart: hash => log.push(`${name}.onStart(${hash})`),
  onSuccess: hash => log.push(`${name}.onSuccess(${hash ?? 'chain read'})`),
  onError(error) {
    answered.add(this);
    log.push(`${name}.onError(${error.name})`);
  }
});

const flush = () => act(() => new Promise(resolve => setTimeout(resolve, 0)));

/** The wallet answers the prompt for `request` with `hash`; the engine then waits on its receipt. */
const sign = async (request: object, hash: string) => {
  act(() => {
    mocks.mutation!.onSuccess?.(hash, request);
    mocks.setWrite!(state =>
      (state as { variables?: object }).variables === request
        ? { ...state, data: hash, isPending: false }
        : state
    );
  });
  await waitFor(() => expect(mocks.waits.has(hash)).toBe(true));
};
const mine = async (hash: string) => {
  act(() => mocks.waits.get(hash)!.resolve({ status: 'success', blockNumber: 5n, logs: [] }));
  await flush();
};
/** The card's chain read finds the deposit delivered. */
const readArrived = (network: Network) =>
  act(() =>
    pendingBridgeStore.update(scope(), DEPOSITS[network].txHash, bridge =>
      applyProgress(bridge, { kind: 'arrived' }, Date.now())
    )
  );

const mount = () => {
  const queryClient = new QueryClient();
  // the page re-renders the launcher when its session or wallet change
  let rerenderPage: () => void = () => undefined;
  const hook = renderHook(
    () => {
      const [, setTick] = useState(0);
      rerenderPage = () => setTick(tick => tick + 1);
      return useDestinationActionLaunch();
    },
    {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children)
    }
  );
  return { ...hook, rerenderPage: () => act(() => rerenderPage()) };
};

/** Launches `network`'s replay card under `session` and confirms it once the replay is prepared. */
const launchAndConfirm = async (page: ReturnType<typeof mount>, network: Network, session: TxCallbacks) => {
  mocks.walletChainId = DEPOSITS[network].chainId;
  mocks.session = session;
  page.rerenderPage();
  await flush();
  act(() => page.result.current.launch(stored(DEPOSITS[network].txHash)));
  await flush();
  const before = { prompts: mocks.prompts.length, launched: mocks.launched.length };
  await waitFor(() => expect(mocks.launched.length).toBeGreaterThan(before.launched - 1));
  confirm(session);
  await waitFor(() => expect(mocks.prompts.length > before.prompts || answered.has(session)).toBe(true));
};
/** Sessions that heard an error since their Confirm. */
const answered = new WeakSet<TxCallbacks>();
/** Presses Confirm on the latest modal. */
const confirm = (session?: TxCallbacks) => {
  if (session) answered.delete(session);
  act(() => mocks.launched.at(-1)!.onConfirm!());
};

describe('useDestinationActionLaunch with the real replay engine', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  beforeEach(() => {
    mocks.address = `0x${(9000 + ++accountSeq).toString(16).padStart(40, '0')}`;
    mocks.walletChainId = 8453;
    mocks.launched = [];
    mocks.isModalOpen = true;
    mocks.prompts = [];
    mocks.waits = new Map();
  });

  it('sends the replay of the card it was launched for, and reports its receipt to that session', async () => {
    const log: string[] = [];
    seedReadyReplay('base');
    const page = mount();
    await launchAndConfirm(page, 'base', sessionFor('A', log));

    expect(mocks.prompts).toHaveLength(1);
    expect(mocks.prompts[0].args).toEqual(replayArgs('base'));
    await sign(mocks.prompts[0], '0xa');
    await mine('0xa');

    await waitFor(() => expect(log).toEqual(['A.onMutate', 'A.onStart(0xa)', 'A.onSuccess(0xa)']));
  });

  it('after a hash that never mines is ended by the chain read, the next card sends its own replay', async () => {
    const log: string[] = [];
    seedReadyReplay('base');
    seedReadyReplay('optimism');
    const page = mount();

    await launchAndConfirm(page, 'base', sessionFor('A', log));
    await sign(mocks.prompts[0], '0xnevermines');
    readArrived('base');
    await waitFor(() =>
      expect(log).toEqual(['A.onMutate', 'A.onStart(0xnevermines)', 'A.onSuccess(chain read)'])
    );

    await launchAndConfirm(page, 'optimism', sessionFor('B', log));
    expect(mocks.prompts).toHaveLength(2);
    expect(mocks.prompts[1].args).toEqual(replayArgs('optimism'));
    await sign(mocks.prompts[1], '0xb');
    await mine('0xb');

    await waitFor(() => expect(log.slice(3)).toEqual(['B.onMutate', 'B.onStart(0xb)', 'B.onSuccess(0xb)']));
    expect(stored(DEPOSITS.optimism.txHash).actions.map(({ action, txHash }) => [action, txHash])).toEqual([
      ['replay', '0xb']
    ]);
    expect(stored(DEPOSITS.base.txHash).actions.map(({ txHash }) => txHash)).toEqual(['0xnevermines']);
  });

  it("a prompt signed after the next card's Confirm is recorded on its own card, and the next card waits for it", async () => {
    const log: string[] = [];
    seedReadyReplay('base');
    seedReadyReplay('optimism');
    const page = mount();

    await launchAndConfirm(page, 'base', sessionFor('A', log));
    // A's prompt stays open in the wallet while the user moves on to card B
    await launchAndConfirm(page, 'optimism', sessionFor('B', log));
    expect(mocks.prompts).toHaveLength(1);
    expect(log).toEqual(['A.onMutate', 'B.onError(TransactionRefusedError)']);

    await sign(mocks.prompts[0], '0xa');
    await mine('0xa');
    // B owns the modal now: A's answer is recorded on card A, and neither modal hears it
    await waitFor(() =>
      expect(stored(DEPOSITS.base.txHash).actions.map(({ txHash, status }) => [txHash, status])).toEqual([
        ['0xa', undefined]
      ])
    );
    expect(log.slice(2)).toEqual([]);
    expect(stored(DEPOSITS.optimism.txHash).actions).toEqual([]);

    // B's Retry now sends B's own replay
    confirm();
    await waitFor(() => expect(mocks.prompts).toHaveLength(2));
    expect(mocks.prompts[1].args).toEqual(replayArgs('optimism'));
  });

  it('a prompt rejected in the wallet fails the session and leaves the card ready to send again', async () => {
    const log: string[] = [];
    seedReadyReplay('base');
    const page = mount();
    await launchAndConfirm(page, 'base', sessionFor('A', log));

    const rejection = Object.assign(new Error('User rejected the request.'), {
      name: 'UserRejectedRequestError'
    });
    act(() => {
      mocks.mutation!.onError?.(rejection, mocks.prompts[0]);
      mocks.setWrite!(() => ({ isPending: false }));
    });
    await waitFor(() => expect(log).toEqual(['A.onMutate', 'A.onError(UserRejectedRequestError)']));
    expect(stored(DEPOSITS.base.txHash).actions).toEqual([]);
    expect(page.result.current.canLaunch(stored(DEPOSITS.base.txHash))).toBe(true);

    confirm();
    await waitFor(() => expect(mocks.prompts).toHaveLength(2));
    expect(mocks.prompts[1].args).toEqual(replayArgs('base'));
  });

  it('a replay sped up in the wallet reports, records and confirms under its new hash', async () => {
    const log: string[] = [];
    seedReadyReplay('base');
    const page = mount();
    await launchAndConfirm(page, 'base', sessionFor('A', log));
    await sign(mocks.prompts[0], '0xslow');

    act(() =>
      mocks.waits.get('0xslow')!.onReplaced?.({ reason: 'repriced', transaction: { hash: '0xfast' } })
    );
    await mine('0xslow');

    await waitFor(() =>
      expect(log).toEqual(['A.onMutate', 'A.onStart(0xslow)', 'A.onStart(0xfast)', 'A.onSuccess(0xfast)'])
    );
    expect(stored(DEPOSITS.base.txHash).actions.map(({ txHash, status }) => [txHash, status])).toEqual([
      ['0xfast', undefined]
    ]);
  });
});
