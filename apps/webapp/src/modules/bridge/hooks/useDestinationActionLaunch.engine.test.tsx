/**
 * @vitest-environment happy-dom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { createElement, useState, type ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from '@/modules/ui/context/transactionContract';
import { BASE_BURN_ATTESTED, BASE_BURN_MINT_RECIPIENT } from '../adapters/cctp/cctp.fixtures';
import { opStackDepositMessage, opStackReplay } from '../adapters/nativeDeposit/opStack';
import { BASE_DEPOSIT_LOGS, OPTIMISM_DEPOSIT_LOGS } from '../adapters/nativeDeposit/depositFixtures';
import { applyProgress, createPendingBridge } from '../model/pendingTransitions';
import { nativeWithdrawalRoute, resolveBridgeRoute } from '../model/resolveRoute';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { useDestinationActionLaunch } from './useDestinationActionLaunch';

// The launcher, the replay and ticket legs, their engines and the receipt wait all run for real; only the
// wallet (wagmi) and the node (viem's receipt wait) are faked.

type Request = { functionName: string; args: readonly unknown[] };
type Wait = { resolve: (receipt: object) => void; onReplaced?: (replacement: object) => void };

const mocks = vi.hoisted(() => ({
  address: '',
  walletChainId: 8453,
  launched: [] as TransactionConfig[],
  isModalOpen: true,
  session: {} as TxCallbacks,
  // the wallet: each prompt's request, in order, and the engine that sent it
  prompts: [] as { functionName: string; args: readonly unknown[] }[],
  engines: new WeakMap<
    object,
    {
      mutation: {
        current: {
          onSuccess?: (hash: string, request: object) => void;
          onError?: (error: Error, request: object) => void;
        };
      };
      setWrite: (update: (state: object) => object) => void;
    }
  >(),
  // the node: the receipt wait of each hash
  waits: new Map<string, Wait>(),
  // a claim's pre-send read of its message: nothing to refuse unless a test holds it
  claimRefusal: () => Promise.resolve(undefined) as Promise<Error | undefined>,
  // Ethereum's reader: every hash is in its mempool unless a test loses it, and every read answers unless it fails
  lostOnL1: new Set<string>(),
  onChain: new Map<string, { status: 'success' | 'reverted' }>(),
  l1ReadsFail: false
}));

vi.mock('wagmi', async () => {
  const { useRef, useState: useWriteState } = await import('react');
  const { TransactionNotFoundError, TransactionReceiptNotFoundError } = await import('viem');
  const l1 = {
    getTransactionReceipt: async ({ hash }: { hash: string }) => {
      if (mocks.l1ReadsFail) throw new Error('RPC down');
      throw new TransactionReceiptNotFoundError({ hash: hash as `0x${string}` });
    },
    getTransaction: async ({ hash }: { hash: string }) => {
      if (mocks.l1ReadsFail) throw new Error('RPC down');
      if (mocks.lostOnL1.has(hash)) throw new TransactionNotFoundError({ hash: hash as `0x${string}` });
      return { hash };
    }
  };
  const elsewhere = {
    getTransactionReceipt: async ({ hash }: { hash: string }) => {
      throw new TransactionReceiptNotFoundError({ hash: hash as `0x${string}` });
    },
    getTransaction: async ({ hash }: { hash: string }) => {
      throw new TransactionNotFoundError({ hash: hash as `0x${string}` });
    }
  };
  return {
    useConnection: () => ({ address: mocks.address, chainId: mocks.walletChainId }),
    useChainId: () => mocks.walletChainId,
    useChains: () => [1, 8453, 10, 42161].map(id => ({ id })),
    useConfig: () => ({}),
    // Another chain's reader knows none of Ethereum's hashes.
    usePublicClient: ({ chainId }: { chainId?: number } = {}) => (chainId === 1 ? l1 : elsewhere),
    useReadContract: ({ functionName, query }: { functionName: string; query?: { enabled?: boolean } }) => ({
      data: functionName === 'baseGas' && query?.enabled !== false ? 100_000n : undefined,
      error: null
    }),
    useEstimateGas: ({ query }: { query?: { enabled?: boolean } }) => ({
      data: query?.enabled ? 100_000n : undefined,
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
      mutation: {
        onMutate?: (r: object) => void;
        onSuccess?: (hash: string, request: object) => void;
        onError?: (error: Error, request: object) => void;
      };
    }) => {
      const [state, setState] = useWriteState<{ data?: string; variables?: object; isPending: boolean }>({
        isPending: false
      });
      const mutation = useRef(options.mutation);
      mutation.current = options.mutation;
      return {
        writeContract: (request: Request) => {
          options.mutation.onMutate?.(request);
          mocks.prompts.push(request);
          mocks.engines.set(request, {
            mutation,
            setWrite: setState as unknown as (update: (state: object) => object) => void
          });
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
// The action's chain: a hash has a receipt only once a test puts it on chain.
vi.mock('wagmi/actions', async () => {
  const { TransactionReceiptNotFoundError } = await import('viem');
  return {
    getPublicClient: () => ({
      getTransactionReceipt: async ({ hash }: { hash: `0x${string}` }) => {
        const receipt = mocks.onChain.get(hash);
        if (!receipt) throw new TransactionReceiptNotFoundError({ hash });
        return receipt;
      }
    })
  };
});
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
  // a claim sells its USDC after an approve
  useTokenAllowance: ({ contractAddress }: { contractAddress?: string }) => ({
    data: contractAddress ? 0n : undefined,
    error: null,
    mutate: () => undefined
  }),
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
vi.mock('../adapters/cctp/gate', () => ({ cctpClaimRefusal: () => mocks.claimRefusal() }));
// No wallet bundles: a claim's legs go out one at a time.
vi.mock('@/hooks/shared/useSendBatchTransactionFlow', () => ({
  useSendBatchTransactionFlow: () => ({
    execute: () => undefined,
    reset: () => undefined,
    prepared: false,
    batchUnavailable: true,
    error: null
  })
}));
// The convert's legs stay idle: the replay, Arbitrum ticket, CCTP claim and withdrawal engines run for real.
const { idleLegs } = vi.hoisted(() => ({
  idleLegs: () => ({
    calls: [],
    isBatch: false,
    ready: false,
    error: null,
    execute: () => undefined,
    reset: () => undefined,
    release: () => undefined,
    detached: false,
    dropCheck: () => undefined
  })
}));
vi.mock('./useCctpConvertLegs', () => ({ useCctpConvertLegs: idleLegs }));
// A finalize's call is built from the chain: the fixture withdrawal's, as proven by PROVER.
vi.mock('./adapterContext', () => ({
  wagmiAdapterContext: () => ({ getClient: (network: string) => ({ network }) })
}));
vi.mock('../adapters/nativeWithdrawal/opStackActions', async () => {
  const { opStackFinalizeCall, opStackWithdrawalMessage } =
    await import('../adapters/nativeWithdrawal/opStack');
  const { BASE_WITHDRAWAL_LOGS } = await import('../adapters/nativeWithdrawal/withdrawalFixtures');
  return {
    opStackWithdrawalActionCall: async () =>
      opStackFinalizeCall({
        network: 'base',
        withdrawal: opStackWithdrawalMessage(BASE_WITHDRAWAL_LOGS, 'base')!.withdrawal,
        proofSubmitter: '0x2222222222222222222222222222222222222222'
      })
  };
});

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
  const engine = mocks.engines.get(request)!;
  act(() => {
    engine.mutation.current.onSuccess?.(hash, request);
    engine.setWrite(state =>
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
  const before = { prompts: mocks.prompts.length, launched: mocks.launched.length };
  act(() => page.result.current.launch(stored(DEPOSITS[network].txHash)));
  await waitFor(() => expect(mocks.launched.length).toBeGreaterThan(before.launched));
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

// canLaunchKeepalive reads the wall clock: an hour left is urgent.
const seedTicket = (txHash: string, ticket: string) => {
  const resolved = resolveBridgeRoute({ from: 'ethereum', to: 'arbitrum', amount: 1n, facts: {} });
  if (resolved.status !== 'ok') throw new Error(resolved.reason);
  const bridge = createPendingBridge({
    account: mocks.address,
    amount: 10n ** 18n,
    from: 'ethereum',
    to: 'arbitrum',
    route: resolved.route,
    txHash,
    now: NOW
  });
  const routeData = {
    ticketId: `0x${ticket.repeat(64)}`,
    timeout: String(Math.floor(Date.now() / 1000) + 3600)
  };
  pendingBridgeStore.upsert(
    scope(),
    applyProgress(bridge, { kind: 'ready', nextAction: 'redeem', routeData }, NOW)
  );
};
const launchTicket = async (
  page: ReturnType<typeof mount>,
  txHash: string,
  action: 'redeem' | 'keepalive',
  session: TxCallbacks
) => {
  mocks.walletChainId = 42161;
  mocks.session = session;
  page.rerenderPage();
  await flush();
  const before = { prompts: mocks.prompts.length, launched: mocks.launched.length };
  act(() => page.result.current.launch(stored(txHash), action === 'keepalive' ? 'keepalive' : undefined));
  await waitFor(() => expect(mocks.launched.length).toBeGreaterThan(before.launched));
  confirm(session);
  await waitFor(() => expect(mocks.prompts.length > before.prompts || answered.has(session)).toBe(true));
};

/** A Base to Ethereum CCTP card of the fixture burn, ready to claim; claim-only leaves out the sale. */
const seedClaim = (txHash: string, { claimOnly = false } = {}) => {
  const resolved = resolveBridgeRoute({
    from: 'base',
    to: 'ethereum',
    amount: 1n,
    facts: { cctp: { isOpen: true } }
  });
  if (resolved.status !== 'ok') throw new Error(resolved.reason);
  const bridge = createPendingBridge({
    account: mocks.address,
    amount: 100n * 10n ** 18n,
    from: 'base',
    to: 'ethereum',
    route: resolved.route,
    txHash,
    now: NOW
  });
  const routeData = {
    cctpMessage: BASE_BURN_ATTESTED.message,
    cctpAttestation: BASE_BURN_ATTESTED.attestation,
    ...(claimOnly && { cctpClaimOnly: 'true' })
  };
  pendingBridgeStore.upsert(
    scope(),
    applyProgress(bridge, { kind: 'ready', nextAction: 'claim', routeData }, NOW)
  );
};
/** The card's tracker finds `hash` reverted, or unknown to its chain long after it was sent. */
const dropRead = (bridgeId: string, hash: string) =>
  act(() =>
    pendingBridgeStore.update(scope(), bridgeId, bridge =>
      applyProgress(bridge, { kind: 'action-dropped', txHash: hash }, Date.now())
    )
  );
const launchClaim = async (page: ReturnType<typeof mount>, txHash: string, session: TxCallbacks) => {
  mocks.walletChainId = 1;
  mocks.session = session;
  page.rerenderPage();
  await flush();
  const before = { prompts: mocks.prompts.length, launched: mocks.launched.length };
  act(() => page.result.current.launch(stored(txHash)));
  await waitFor(() => expect(mocks.launched.length).toBeGreaterThan(before.launched));
  confirm(session);
  await waitFor(() => expect(mocks.prompts.length > before.prompts || answered.has(session)).toBe(true));
};

/** A Base to Ethereum native withdrawal, proven and ready to finalize. */
const seedFinalize = (txHash: string) => {
  const bridge = createPendingBridge({
    account: mocks.address,
    amount: 10n ** 18n,
    from: 'base',
    to: 'ethereum',
    route: nativeWithdrawalRoute('base'),
    txHash,
    now: NOW
  });
  pendingBridgeStore.upsert(scope(), applyProgress(bridge, { kind: 'ready', nextAction: 'finalize' }, NOW));
};
const launchFinalize = async (page: ReturnType<typeof mount>, txHash: string, session: TxCallbacks) => {
  mocks.walletChainId = 1;
  mocks.session = session;
  page.rerenderPage();
  await flush();
  const before = { prompts: mocks.prompts.length, launched: mocks.launched.length };
  act(() => page.result.current.launch(stored(txHash)));
  await waitFor(() => expect(mocks.launched.length).toBeGreaterThan(before.launched));
  confirm(session);
  await waitFor(() => expect(mocks.prompts.length > before.prompts || answered.has(session)).toBe(true));
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
    mocks.onChain = new Map();
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
    const engine = mocks.engines.get(mocks.prompts[0])!;
    act(() => {
      engine.mutation.current.onError?.(rejection, mocks.prompts[0]);
      engine.setWrite(() => ({ isPending: false }));
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

  describe("a wallet hash the card's chain read finds dropped", () => {
    /** The tracker finds `hash` unknown to its chain long after it was sent. */
    const readDropped = (bridgeId: string, hash: string) =>
      act(() =>
        pendingBridgeStore.update(scope(), bridgeId, bridge =>
          applyProgress(bridge, { kind: 'action-dropped', txHash: hash }, Date.now())
        )
      );

    it('leaves a revert the card read first to the engine, which reports it as a revert', async () => {
      const log: string[] = [];
      seedReadyReplay('base');
      const page = mount();
      await launchAndConfirm(page, 'base', sessionFor('A', log));
      await sign(mocks.prompts[0], '0xreverts');
      mocks.onChain.set('0xreverts', { status: 'reverted' });

      readDropped(DEPOSITS.base.txHash, '0xreverts');
      await flush();
      await flush();
      expect(log).toEqual(['A.onMutate', 'A.onStart(0xreverts)']);

      act(() => mocks.waits.get('0xreverts')!.resolve({ status: 'reverted', blockNumber: 5n, logs: [] }));
      await waitFor(() => expect(log).toHaveLength(3));
      expect(log[2]).toMatch(/^A\.onError\(/);
      expect(log[2]).not.toBe('A.onError(TransactionRefusedError)');
      expect(page.result.current.canLaunch(stored(DEPOSITS.base.txHash))).toBe(true);
    });

    it('ends its run, and the Retry sends the replay again', async () => {
      const log: string[] = [];
      seedReadyReplay('base');
      const page = mount();
      const session = sessionFor('A', log);
      await launchAndConfirm(page, 'base', session);
      await sign(mocks.prompts[0], '0xlost');
      expect(stored(DEPOSITS.base.txHash).actions.map(({ txHash }) => txHash)).toEqual(['0xlost']);

      readDropped(DEPOSITS.base.txHash, '0xlost');
      await waitFor(() =>
        expect(log).toEqual(['A.onMutate', 'A.onStart(0xlost)', 'A.onError(TransactionRefusedError)'])
      );
      expect(page.result.current.canLaunch(stored(DEPOSITS.base.txHash))).toBe(true);

      confirm(session);
      await waitFor(() => expect(mocks.prompts).toHaveLength(2));
      expect(mocks.prompts[1].args).toEqual(replayArgs('base'));
      await sign(mocks.prompts[1], '0xfound');
      await mine('0xfound');
      await waitFor(() =>
        expect(log.slice(3)).toEqual(['A.onMutate', 'A.onStart(0xfound)', 'A.onSuccess(0xfound)'])
      );
    });

    it("ends its run while another card's modal is open, so that card's Retry sends", async () => {
      const log: string[] = [];
      seedReadyReplay('base');
      seedReadyReplay('optimism');
      const page = mount();
      await launchAndConfirm(page, 'base', sessionFor('A', log));
      await sign(mocks.prompts[0], '0xlost');

      // B's Confirm while A's hash may still mine: refused.
      const sessionB = sessionFor('B', log);
      await launchAndConfirm(page, 'optimism', sessionB);
      await waitFor(() => expect(log).toContain('B.onError(TransactionRefusedError)'));
      expect(mocks.prompts).toHaveLength(1);

      readDropped(DEPOSITS.base.txHash, '0xlost');
      await waitFor(() => expect(page.result.current.canLaunch(stored(DEPOSITS.base.txHash))).toBe(true));
      confirm(sessionB);
      await waitFor(() => expect(mocks.prompts).toHaveLength(2));
      expect(mocks.prompts[1].args).toEqual(replayArgs('optimism'));
      await sign(mocks.prompts[1], '0xb');
      await mine('0xb');
      await waitFor(() => expect(log).toContain('B.onSuccess(0xb)'));
      // A's modal is gone: its late end reaches no session.
      expect(log.filter(entry => entry.startsWith('A.'))).toEqual(['A.onMutate', 'A.onStart(0xlost)']);
    });

    it('a keepalive ends its run too, and the redeem goes out after it', async () => {
      const log: string[] = [];
      seedTicket('0xarbA', 'a');
      const page = mount();
      await launchTicket(page, '0xarbA', 'keepalive', sessionFor('A', log));
      await sign(mocks.prompts[0], '0xkeep');
      readDropped('0xarbA', '0xkeep');
      await waitFor(() => expect(log).toContain('A.onError(TransactionRefusedError)'));
      expect(page.result.current.canLaunch(stored('0xarbA'), 'keepalive')).toBe(true);

      await launchTicket(page, '0xarbA', 'redeem', sessionFor('B', log));
      expect(mocks.prompts.map(({ functionName }) => functionName)).toEqual(['keepalive', 'redeem']);
    });

    it("tells the user to check the wallet, as the chain's silence doesn't prove nothing was sent", async () => {
      const log: string[] = [];
      const messages: string[] = [];
      seedReadyReplay('base');
      const page = mount();
      const session = sessionFor('A', log);
      const onError = session.onError;
      session.onError = function (error, hash) {
        messages.push(error.message);
        onError.call(this, error, hash);
      };
      await launchAndConfirm(page, 'base', session);
      await sign(mocks.prompts[0], '0xlost');
      readDropped(DEPOSITS.base.txHash, '0xlost');
      await waitFor(() => expect(messages).toHaveLength(1));
      expect(messages[0]).toBe(
        "We couldn't find this transaction on the network. Check your wallet before trying again."
      );
    });

    it("lands under another hash while another card's modal is open: that card's Retry sends", async () => {
      const log: string[] = [];
      seedReadyReplay('base');
      seedReadyReplay('optimism');
      const page = mount();
      await launchAndConfirm(page, 'base', sessionFor('A', log));
      await sign(mocks.prompts[0], '0xlost');
      const sessionB = sessionFor('B', log);
      await launchAndConfirm(page, 'optimism', sessionB);
      await waitFor(() => expect(log).toContain('B.onError(TransactionRefusedError)'));

      readArrived('base');
      readDropped(DEPOSITS.base.txHash, '0xlost');
      confirm(sessionB);
      await waitFor(() => expect(mocks.prompts).toHaveLength(2));
      expect(mocks.prompts[1].args).toEqual(replayArgs('optimism'));
      await sign(mocks.prompts[1], '0xb');
      await mine('0xb');
      await waitFor(() => expect(log).toContain('B.onSuccess(0xb)'));
      expect(log.filter(entry => entry.startsWith('A.'))).toEqual(['A.onMutate', 'A.onStart(0xlost)']);
    });

    it('lands under another hash after its modal closed: the next card sends', async () => {
      const log: string[] = [];
      seedReadyReplay('base');
      seedReadyReplay('optimism');
      const page = mount();
      await launchAndConfirm(page, 'base', sessionFor('A', log));
      await sign(mocks.prompts[0], '0xlost');
      mocks.isModalOpen = false;
      page.rerenderPage();
      await flush();

      readArrived('base');
      readDropped(DEPOSITS.base.txHash, '0xlost');
      mocks.isModalOpen = true;
      await launchAndConfirm(page, 'optimism', sessionFor('B', log));
      await waitFor(() => expect(mocks.prompts).toHaveLength(2));
      expect(mocks.prompts[1].args).toEqual(replayArgs('optimism'));
      expect(log.filter(entry => entry.startsWith('A.'))).toEqual(['A.onMutate', 'A.onStart(0xlost)']);
    });

    it('is not mistaken for a drop when the hash confirms', async () => {
      const log: string[] = [];
      seedReadyReplay('base');
      const page = mount();
      await launchAndConfirm(page, 'base', sessionFor('A', log));
      await sign(mocks.prompts[0], '0xa');
      await mine('0xa');
      await waitFor(() => expect(log).toEqual(['A.onMutate', 'A.onStart(0xa)', 'A.onSuccess(0xa)']));
      readDropped(DEPOSITS.base.txHash, '0xa');
      await flush();
      expect(log).toEqual(['A.onMutate', 'A.onStart(0xa)', 'A.onSuccess(0xa)']);
    });
  });

  describe('a CCTP claim, on its own engine', () => {
    beforeEach(() => {
      // The fixture message mints to this account only.
      mocks.address = BASE_BURN_MINT_RECIPIENT;
      mocks.claimRefusal = () => Promise.resolve(undefined);
      mocks.lostOnL1 = new Set();
      mocks.l1ReadsFail = false;
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    /** Claims `txHash`'s card up to its sale, which the wallet signs as `saleHash` and the engine then waits on. */
    const claimToSale = async (
      page: ReturnType<typeof mount>,
      txHash: string,
      session: TxCallbacks,
      saleHash: string
    ) => {
      await launchClaim(page, txHash, session);
      await sign(mocks.prompts.at(-1)!, `${saleHash}r`);
      await mine(`${saleHash}r`);
      await waitFor(() => expect(mocks.prompts.at(-1)!.functionName).toBe('approve'));
      await sign(mocks.prompts.at(-1)!, `${saleHash}a`);
      await mine(`${saleHash}a`);
      await waitFor(() => expect(mocks.prompts.at(-1)!.functionName).toBe('sellGem'));
      await sign(mocks.prompts.at(-1)!, saleHash);
    };
    /** The wall clock moves on by `minutes`, then a tracker read writes `cardId`, which runs the launcher's checks. */
    const later = async (minutes: number, cardId: string) => {
      vi.setSystemTime(Date.now() + minutes * 60_000);
      act(() => pendingBridgeStore.update(scope(), cardId, bridge => ({ ...bridge })));
      await flush();
      await flush();
    };

    it("ends a claim whose sale its chain still doesn't know 35 minutes on, and the next card's claim goes out", async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const log: string[] = [];
      seedClaim('0xburnS1');
      seedClaim('0xburnS2');
      const page = mount();
      await claimToSale(page, '0xburnS1', sessionFor('A', log), '0xsale');
      mocks.lostOnL1.add('0xsale');

      await later(36, '0xburnS2');
      await waitFor(() => expect(log.at(-1)).toBe('A.onError(TransactionRefusedError)'));
      // The card keeps the sale's hash: its convert offer reads it as dropped, as before.
      expect(stored('0xburnS1').actions[0].nextLegTxHash).toBe('0xsale');

      const prompts = mocks.prompts.length;
      await launchClaim(page, '0xburnS2', sessionFor('B', log));
      expect(mocks.prompts).toHaveLength(prompts + 1);
      expect(mocks.prompts.at(-1)!.functionName).toBe('receiveMessage');
    });

    it('ends a claim whose approve before the sale was dropped the same way', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const log: string[] = [];
      seedClaim('0xburnP1');
      seedClaim('0xburnP2');
      const page = mount();
      await launchClaim(page, '0xburnP1', sessionFor('A', log));
      await sign(mocks.prompts.at(-1)!, '0xreceive');
      await mine('0xreceive');
      await waitFor(() => expect(mocks.prompts.at(-1)!.functionName).toBe('approve'));
      await sign(mocks.prompts.at(-1)!, '0xapprove');
      await waitFor(() => expect(stored('0xburnP1').actions[0].nextLegTxHash).toBe('0xapprove'));
      mocks.lostOnL1.add('0xapprove');

      await later(36, '0xburnP2');
      await waitFor(() => expect(log.at(-1)).toBe('A.onError(TransactionRefusedError)'));
      const prompts = mocks.prompts.length;
      await launchClaim(page, '0xburnP2', sessionFor('B', log));
      expect(mocks.prompts).toHaveLength(prompts + 1);
    });

    it("keeps reading a claim's sale on Ethereum after another card's action took the modal", async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const log: string[] = [];
      seedClaim('0xburnE1');
      seedClaim('0xburnE2');
      seedReadyReplay('base');
      const page = mount();
      await claimToSale(page, '0xburnE1', sessionFor('A', log), '0xsale');
      mocks.walletChainId = DEPOSITS.base.chainId;
      page.rerenderPage();
      const launched = mocks.launched.length;
      act(() => page.result.current.launch(stored(DEPOSITS.base.txHash)));
      await waitFor(() => expect(mocks.launched.length).toBeGreaterThan(launched));

      await later(36, '0xburnE2');
      expect(log.filter(entry => entry.startsWith('A.onError'))).toEqual([]);
    });

    it.each([
      ['its chain still has it', { lost: false, fail: false, minutes: 36 }],
      ["its chain can't be read", { lost: true, fail: true, minutes: 36 }],
      ['35 minutes have not passed', { lost: true, fail: false, minutes: 34 }]
    ])('keeps waiting on a sale while %s', async (_, { lost, fail, minutes }) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const log: string[] = [];
      // The fixture's account is shared: each case claims its own cards.
      const [first, second] = [`0xburnK${++accountSeq}`, `0xburnK${++accountSeq}`];
      seedClaim(first);
      seedClaim(second);
      const page = mount();
      await claimToSale(page, first, sessionFor('A', log), '0xsale');
      if (lost) mocks.lostOnL1.add('0xsale');
      mocks.l1ReadsFail = fail;

      await later(minutes, second);
      expect(log.filter(entry => entry.startsWith('A.onError'))).toEqual([]);
      const prompts = mocks.prompts.length;
      await launchClaim(page, second, sessionFor('B', log));
      expect(mocks.prompts).toHaveLength(prompts);
      expect(log.at(-1)).toBe('B.onError(TransactionRefusedError)');
    });

    it('receives the message, then approves and sells the USDC, and ends on the sale', async () => {
      const log: string[] = [];
      seedClaim('0xburnhappy');
      const page = mount();
      await launchClaim(page, '0xburnhappy', sessionFor('A', log));
      expect(mocks.prompts.map(({ functionName }) => functionName)).toEqual(['receiveMessage']);
      await sign(mocks.prompts[0], '0xreceive');
      await mine('0xreceive');
      await waitFor(() => expect(mocks.prompts).toHaveLength(2));
      await sign(mocks.prompts[1], '0xapprove');
      await mine('0xapprove');
      await waitFor(() => expect(mocks.prompts).toHaveLength(3));
      expect(mocks.prompts.map(({ functionName }) => functionName)).toEqual([
        'receiveMessage',
        'approve',
        'sellGem'
      ]);
      await sign(mocks.prompts[2], '0xsell');
      await mine('0xsell');
      await waitFor(() => expect(log).toContain('A.onSuccess(0xsell)'));
    });

    it('ends a claim whose receive the chain dropped, and the Retry receives again', async () => {
      const log: string[] = [];
      seedClaim('0xburnlost', { claimOnly: true });
      const page = mount();
      const session = sessionFor('A', log);
      await launchClaim(page, '0xburnlost', session);
      await sign(mocks.prompts[0], '0xlost');
      dropRead('0xburnlost', '0xlost');
      await waitFor(() =>
        expect(log).toEqual(['A.onMutate', 'A.onStart(0xlost)', 'A.onError(TransactionRefusedError)'])
      );

      confirm(session);
      await waitFor(() => expect(mocks.prompts).toHaveLength(2));
      expect(mocks.prompts[1].functionName).toBe('receiveMessage');
      await sign(mocks.prompts[1], '0xfound');
      await mine('0xfound');
      await waitFor(() =>
        expect(log.slice(3)).toEqual(['A.onMutate', 'A.onStart(0xfound)', 'A.onSuccess(0xfound)'])
      );
    });

    it("an older claim's drop read while the next claim checks its message leaves that claim to send", async () => {
      const log: string[] = [];
      seedClaim('0xburnA', { claimOnly: true });
      seedClaim('0xburnB', { claimOnly: true });
      const page = mount();
      await launchClaim(page, '0xburnA', sessionFor('A', log));
      await sign(mocks.prompts[0], '0xa');
      const sessionB = sessionFor('B', log);
      await launchClaim(page, '0xburnB', sessionB);
      await waitFor(() => expect(log).toContain('B.onError(TransactionRefusedError)'));
      // A reverts: the claim engine reports it to neither modal, so A's run never ends.
      act(() => mocks.waits.get('0xa')!.resolve({ status: 'reverted', blockNumber: 5n, logs: [] }));
      await flush();
      expect(log).toEqual(['A.onMutate', 'A.onStart(0xa)', 'B.onError(TransactionRefusedError)']);

      let checked: ((refusal: undefined) => void) | undefined;
      mocks.claimRefusal = () => new Promise(resolve => (checked = resolve));
      // B retries until its engine has read A's receipt and checks B's message.
      await waitFor(() => {
        if (!checked) confirm(sessionB);
        expect(checked).toBeDefined();
      });
      // A's card reads the revert too, while B's message check is out.
      dropRead('0xburnA', '0xa');
      await flush();
      act(() => checked!(undefined));
      await waitFor(() => expect(mocks.prompts).toHaveLength(2));
      await sign(mocks.prompts[1], '0xb');
      await mine('0xb');
      await waitFor(() => expect(log).toContain('B.onSuccess(0xb)'));
    });
  });

  describe('a native withdrawal finalize, on its own engine', () => {
    it('finalizes, and reports its receipt to its session', async () => {
      const log: string[] = [];
      seedFinalize('0xwithdrawalok');
      const page = mount();
      await launchFinalize(page, '0xwithdrawalok', sessionFor('A', log));
      expect(mocks.prompts.map(({ functionName }) => functionName)).toEqual([
        'finalizeWithdrawalTransactionExternalProof'
      ]);
      await sign(mocks.prompts[0], '0xfinal');
      await mine('0xfinal');
      await waitFor(() => expect(log).toEqual(['A.onMutate', 'A.onStart(0xfinal)', 'A.onSuccess(0xfinal)']));
    });

    it('ends a finalize whose hash the chain dropped, and the Retry finalizes again', async () => {
      const log: string[] = [];
      seedFinalize('0xwithdrawallost');
      const page = mount();
      const session = sessionFor('A', log);
      await launchFinalize(page, '0xwithdrawallost', session);
      await sign(mocks.prompts[0], '0xlost');
      dropRead('0xwithdrawallost', '0xlost');
      await waitFor(() =>
        expect(log).toEqual(['A.onMutate', 'A.onStart(0xlost)', 'A.onError(TransactionRefusedError)'])
      );

      confirm(session);
      await waitFor(() => expect(mocks.prompts).toHaveLength(2));
      expect(mocks.prompts[1]).toEqual(mocks.prompts[0]);
      await sign(mocks.prompts[1], '0xfound');
      await mine('0xfound');
      await waitFor(() =>
        expect(log.slice(3)).toEqual(['A.onMutate', 'A.onStart(0xfound)', 'A.onSuccess(0xfound)'])
      );
    });
  });

  describe('an Arbitrum ticket, on its own engine', () => {
    it("after a redeem's hash that never mines is ended by the chain read, the next card sends its own redeem", async () => {
      const log: string[] = [];
      seedTicket('0xarbA', 'a');
      seedTicket('0xarbB', 'b');
      const page = mount();
      await launchTicket(page, '0xarbA', 'redeem', sessionFor('A', log));
      expect(mocks.prompts.map(({ functionName, args }) => [functionName, args[0]])).toEqual([
        ['redeem', `0x${'a'.repeat(64)}`]
      ]);
      // A's wallet hash never mines while the ticket is redeemed under another.
      await sign(mocks.prompts[0], '0xredeemA');
      act(() =>
        pendingBridgeStore.update(scope(), '0xarbA', bridge =>
          applyProgress(bridge, { kind: 'arrived' }, Date.now())
        )
      );
      await waitFor(() =>
        expect(log).toEqual(['A.onMutate', 'A.onStart(0xredeemA)', 'A.onSuccess(chain read)'])
      );

      await launchTicket(page, '0xarbB', 'redeem', sessionFor('B', log));
      expect(mocks.prompts.map(({ functionName, args }) => [functionName, args[0]])).toEqual([
        ['redeem', `0x${'a'.repeat(64)}`],
        ['redeem', `0x${'b'.repeat(64)}`]
      ]);
      await sign(mocks.prompts[1], '0xredeemB');
      await mine('0xredeemB');
      await waitFor(() =>
        expect(log.slice(3)).toEqual(['B.onMutate', 'B.onStart(0xredeemB)', 'B.onSuccess(0xredeemB)'])
      );
    });
  });
});
