/**
 * @vitest-environment happy-dom
 */
import { createElement, type ReactElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress } from 'viem';
import { TransactionReplacedError, TransactionRevertedError } from '@/hooks/shared/useTransactionOutcome';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import type { TransactionConfig, TxCallbacks } from '@/modules/ui/context/transactionContract';
import { cctpL2Contracts, TOKEN_MESSENGER_V2 } from '../adapters/cctp/contracts';
import { BASE_BURN_AMOUNT, BASE_BURN_LOGS, BASE_BURN_TX } from '../adapters/cctp/cctpFixtures';
import { resolveBridgeRoute } from '../model/resolveRoute';
import type { BridgeNetworkId } from '../model/networks';
import { cctpSwapStore, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import type { BridgeFormModel } from './useBridgeForm';
import { useBridgeLaunch } from './useBridgeLaunch';

const SENDER = getAddress(BASE_BURN_TX.from);
const AMOUNT = BASE_BURN_AMOUNT * 10n ** 12n;
const SCOPE = pendingScopeKey({ account: SENDER, familyChainId: 1 });
const { usds, usdc, psm3 } = cctpL2Contracts('base');

const mocks = vi.hoisted(() => ({
  launched: [] as TransactionConfig[],
  modalOpen: false,
  safe: false,
  storageWritable: true,
  updates: [] as Partial<TransactionConfig>[],
  onError: vi.fn(),
  runMockLegs: vi.fn(() => new Promise<string>(() => undefined)),
  depositExecute: vi.fn(),
  clients: [] as (number | undefined)[],
  receipt: undefined as unknown,
  closeReset: undefined as undefined | ((onCleared?: () => void) => void),
  depositReset: vi.fn(),
  burnReset: vi.fn(),
  burn: {
    ready: true,
    busy: false,
    legMined: false,
    error: null as Error | null,
    isBatch: false,
    calls: [] as unknown[],
    execute: vi.fn(),
    args: [] as {
      enabled: boolean;
      from: string;
      chainId: number | undefined;
      ethereumChainId: number | undefined;
      scope: string | undefined;
      resume: UnfinishedCctpSwap | undefined;
      getCallbacks: () => TxCallbacks;
    }[]
  }
}));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useChains: () => [1, 8453, 10, 42161, 130].map(id => ({ id })),
  usePublicClient: ({ chainId }: { chainId?: number }) => {
    mocks.clients.push(chainId);
    return { getTransactionReceipt: async () => mocks.receipt };
  }
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useIsSafeWallet: () => mocks.safe,
  useSafeWalletStatus: () => (mocks.safe ? 'safe' : 'not-safe'),
  useNetworkFee: () => ({ data: undefined }),
  useTokenBalance: () => ({ data: undefined, isLoading: false })
}));
vi.mock('@/hooks/wallet/useIsSafeApp', () => ({ useIsSafeApp: () => false }));
vi.mock('@/modules/ui/hooks/engineLaunch', () => ({ useShouldUseBatch: () => false }));
vi.mock('@/modules/ui/hooks/useResetUnfinishedRunOnClose', () => ({
  useResetUnfinishedRunOnClose: (reset: (onCleared?: () => void) => void) => {
    mocks.closeReset = reset;
  }
}));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: (config: TransactionConfig) => mocks.launched.push(config),
    updateModalContent: (_id: string, content: Partial<TransactionConfig>) => mocks.updates.push(content),
    isModalOpen: mocks.modalOpen,
    txCallbacks: { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: mocks.onError },
    txStatus: TxStatus.IDLE
  })
}));
vi.mock('@/modules/ui/hooks/useMinimizedSessionLock', () => ({
  useMinimizedSessionLock: () => ({ locked: false, restore: vi.fn() })
}));
vi.mock('./usePendingScope', async () => {
  const { pendingScopeKey } = await import('../store/pendingStore');
  const { getAddress } = await import('viem');
  const { BASE_BURN_TX } = await import('../adapters/cctp/cctpFixtures');
  const account = getAddress(BASE_BURN_TX.from);
  return {
    usePendingScope: () => ({
      account,
      familyChainId: 1,
      scope: pendingScopeKey({ account, familyChainId: 1 })
    })
  };
});
vi.mock('../store/storageWritable', () => ({ isStorageWritable: () => mocks.storageWritable }));
vi.mock('../adapters/mockAdapter', () => ({ runMockLegs: mocks.runMockLegs }));
vi.mock('./useNativeDepositLegs', () => {
  const idle = {
    calls: [],
    maxFee: undefined,
    needsApprove: false,
    isBatch: false,
    ready: false,
    error: null,
    execute: mocks.depositExecute,
    reset: mocks.depositReset,
    stop: () => {},
    refetchAllowance: () => {}
  };
  return { nativeDepositFunction: () => 'bridgeERC20To', useNativeDepositLegs: () => idle };
});
vi.mock('./useCctpBurnLegs', () => ({
  CCTP_BURN_FUNCTION: 'depositForBurn',
  useCctpBurnLegs: (args: (typeof mocks.burn.args)[number]) => {
    mocks.burn.args.push(args);
    const { ready, busy, legMined, error, isBatch, calls, execute } = mocks.burn;
    return {
      calls,
      needsApprove: false,
      isBatch,
      ready,
      busy,
      legMined,
      error,
      execute,
      reset: mocks.burnReset,
      stop: vi.fn(),
      refetchAllowance: vi.fn()
    };
  }
}));
vi.mock('../components/BridgeReviewContent', () => ({
  BridgeReviewContent: () => null,
  BridgeTransferHero: () => null
}));

const BURN_CALLS = [
  { to: usds, functionName: 'approve', args: [psm3, AMOUNT] },
  { to: psm3, functionName: 'swapExactIn' },
  { to: usdc, functionName: 'approve', args: [TOKEN_MESSENGER_V2, BASE_BURN_AMOUNT] },
  { to: TOKEN_MESSENGER_V2, functionName: 'depositForBurn' }
];

const formFor = (from: BridgeNetworkId, to: BridgeNetworkId, extra: Partial<BridgeFormModel> = {}) => {
  const result = resolveBridgeRoute({
    from,
    to,
    amount: AMOUNT,
    facts: { cctp: { isOpen: true }, native: { isOpen: true } }
  });
  if (result.status !== 'ok') throw new Error(result.reason);
  return {
    amount: AMOUNT,
    from,
    to,
    route: result.route,
    recipient: undefined,
    isConnected: true,
    reviewBlocked: false,
    ...extra
  } as unknown as BridgeFormModel;
};

function render(
  from: BridgeNetworkId = 'base',
  to: BridgeNetworkId = 'ethereum',
  resume?: UnfinishedCctpSwap,
  extra?: Partial<BridgeFormModel>
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return renderHook(() => useBridgeLaunch(formFor(from, to, extra), undefined, resume), { wrapper });
}

const SWAP: UnfinishedCctpSwap = {
  swapTxHash: '0x5a',
  network: 'base',
  usdcAmount: BASE_BURN_AMOUNT,
  recipient: SENDER.toLowerCase(),
  at: 1
};

const stepsShown = () => mocks.launched.at(-1)!.steps as { label: string; tokenSymbol?: string }[];

const confirm = (view: ReturnType<typeof render>) => {
  act(() => view.result.current.launch());
  act(() => mocks.launched.at(-1)!.onConfirm!());
  return mocks.burn.args.at(-1)!.getCallbacks();
};

describe('useBridgeLaunch with a CCTP burn to Ethereum', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  beforeEach(() => {
    // Every test starts from an empty store: storage cleared, and the cached lists dropped as another tab's write would.
    localStorage.clear();
    const unsubscribe = pendingBridgeStore.subscribe(() => undefined);
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    unsubscribe();
    Object.assign(mocks, {
      launched: [],
      updates: [],
      modalOpen: false,
      safe: false,
      storageWritable: true,
      clients: [],
      receipt: undefined
    });
    Object.assign(mocks.burn, {
      ready: true,
      busy: false,
      legMined: false,
      error: null,
      isBatch: false,
      calls: BURN_CALLS,
      args: []
    });
    mocks.burn.execute.mockClear();
    mocks.depositExecute.mockClear();
    mocks.runMockLegs.mockClear();
    mocks.onError.mockClear();
    mocks.depositReset.mockClear();
    mocks.burnReset.mockClear();
  });

  // The reads refresh once the burn engine's write still out has landed, not the idle deposit engine's.
  it("refreshes the reads after the burn engine's reset when the modal closes mid-run", () => {
    render();
    const onCleared = vi.fn();
    act(() => mocks.closeReset!(onCleared));
    expect(mocks.burnReset).toHaveBeenCalledWith(onCleared);
    expect(mocks.depositReset).not.toHaveBeenCalledWith(onCleared);
  });

  it('builds the burn on the pinned L2 with Ethereum as the claim chain', () => {
    render();
    expect(mocks.burn.args.at(-1)).toMatchObject({
      enabled: true,
      from: 'base',
      chainId: 8453,
      ethereumChainId: 1,
      // An unfinished swap is remembered under the sender's pending scope.
      scope: SCOPE
    });
  });

  it('runs the burn on Confirm, not the mock or the deposit', () => {
    confirm(render());
    expect(mocks.burn.execute).toHaveBeenCalledOnce();
    expect(mocks.runMockLegs).not.toHaveBeenCalled();
    expect(mocks.depositExecute).not.toHaveBeenCalled();
  });

  it('shows one step per call: both approves, the swap and the burn', () => {
    const view = render();
    act(() => view.result.current.launch());
    expect(stepsShown().map(step => [step.label, step.tokenSymbol])).toEqual([
      ['Approve', 'USDS'],
      ['Swap to USDC', 'USDS'],
      ['Approve', 'USDC'],
      ['Bridge', 'USDC']
    ]);
  });

  it('shows no approve the allowances already cover', () => {
    mocks.burn.calls = BURN_CALLS.filter(call => call.functionName !== 'approve');
    const view = render();
    act(() => view.result.current.launch());
    expect(stepsShown().map(step => step.label)).toEqual(['Swap to USDC', 'Bridge']);
  });

  it('blocks Confirm and says why while the burn cannot be sent', () => {
    Object.assign(mocks.burn, { ready: false, error: new Error('CCTP is paused.') });
    const view = render();
    act(() => view.result.current.launch());
    expect(mocks.launched.at(-1)).toMatchObject({ confirmDisabled: true });
    expect(mocks.launched.at(-1)!.errorMessage).toBeTruthy();
    act(() => mocks.launched.at(-1)!.onConfirm!());
    expect(mocks.burn.execute).not.toHaveBeenCalled();
    expect(mocks.onError).toHaveBeenCalled();
  });

  // A leg of the closed run is still in the wallet: a Confirm now would sign that run's calls.
  it('blocks Confirm and says why while a leg of the last run is still out', () => {
    Object.assign(mocks.burn, { busy: true });
    const view = render();
    act(() => view.result.current.launch());
    expect(mocks.launched.at(-1)).toMatchObject({ confirmDisabled: true });
    expect(mocks.launched.at(-1)!.errorMessage).toMatch(/still open in your wallet or pending/);
  });

  it('stores the card under the burn hash, never the swap or an approve', () => {
    const callbacks = confirm(render());
    act(() => {
      callbacks.onMutate({ functionName: 'approve' } as never);
      callbacks.onStart('0xapprove');
      callbacks.onMutate({ functionName: 'swapExactIn' } as never);
      callbacks.onStart('0xswap');
    });
    expect(pendingBridgeStore.getSnapshot(SCOPE)).toEqual([]);
    act(() => {
      callbacks.onMutate({ functionName: 'depositForBurn' } as never);
      callbacks.onStart(BASE_BURN_TX.hash);
    });
    expect(pendingBridgeStore.getSnapshot(SCOPE)).toMatchObject([
      { txHash: BASE_BURN_TX.hash, from: 'base', to: 'ethereum', amount: AMOUNT }
    ]);
  });

  it("gives a mined bundle's card the burn hash read from the L2 receipt", async () => {
    mocks.receipt = {
      status: 'success',
      transactionHash: BASE_BURN_TX.hash,
      blockNumber: 1n,
      logs: BASE_BURN_LOGS
    };
    const callbacks = confirm(render());
    act(() => {
      callbacks.onMutate(undefined as never);
      callbacks.onStart(undefined);
    });
    const [card] = pendingBridgeStore.getSnapshot(SCOPE);
    expect(card.bundleId).toBeDefined();
    await act(async () => {
      callbacks.onSuccess(BASE_BURN_TX.hash, 1n);
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(pendingBridgeStore.getSnapshot(SCOPE)).toMatchObject([{ txHash: BASE_BURN_TX.hash }]);
    // The receipt came from the burn's chain.
    expect(mocks.clients).toContain(8453);
  });

  it('leaves the burn engine off on a route from Ethereum', () => {
    render('ethereum', 'base');
    expect(mocks.burn.args.at(-1)).toMatchObject({ enabled: false });
  });

  describe('Retry after a leg of the run mined', () => {
    const renderBlockable = () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
      return renderHook(
        ({ reviewBlocked }: { reviewBlocked: boolean }) =>
          useBridgeLaunch(formFor('base', 'ethereum', { reviewBlocked })),
        { wrapper, initialProps: { reviewBlocked: false } }
      );
    };

    // The swap mines, the USDC approve is rejected, and the spent USDS now fails the Review's balance check.
    const stopAfterSwap = (view: ReturnType<typeof renderBlockable>, legMined: boolean) => {
      act(() => view.result.current.launch());
      act(() => mocks.launched.at(-1)!.onConfirm!());
      const callbacks = mocks.burn.args.at(-1)!.getCallbacks();
      callbacks.onMutate({ functionName: 'swapExactIn' });
      callbacks.onStart('0x5a');
      callbacks.onMutate({ functionName: 'approve' });
      act(() => callbacks.onError(new Error('User rejected the request.'), ''));
      mocks.burn.legMined = legMined;
      view.rerender({ reviewBlocked: true });
      return mocks.onError.mock.calls.length;
    };

    it('resumes the legs, though the swap spent the USDS the Review checks', () => {
      const view = renderBlockable();
      const errorsBefore = stopAfterSwap(view, true);

      // TransactionContext.handleRetry calls onConfirm when the flow has no onRetry.
      act(() => mocks.launched.at(-1)!.onConfirm!());

      expect(mocks.onError.mock.calls.slice(errorsBefore)).toEqual([]);
      expect(mocks.burn.execute).toHaveBeenCalledTimes(2);
    });

    it('still refuses a Retry the Review blocks while nothing of the run mined', () => {
      const view = renderBlockable();
      const errorsBefore = stopAfterSwap(view, false);

      act(() => mocks.launched.at(-1)!.onConfirm!());

      expect(mocks.onError.mock.calls.slice(errorsBefore).map(([error]) => (error as Error).message)).toEqual(
        ['The bridge is not ready to send.']
      );
      expect(mocks.burn.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('continuing an unfinished swap', () => {
    it('builds the burn from the swap, and the form builds a fresh one', () => {
      render('base', 'ethereum', SWAP);
      expect(mocks.burn.args.at(-1)).toMatchObject({ enabled: true, from: 'base', resume: SWAP });
      render();
      expect(mocks.burn.args.at(-1)!.resume).toBeUndefined();
    });

    it('titles the review as a continued bridge', () => {
      const view = render('base', 'ethereum', SWAP);
      act(() => view.result.current.launch());
      expect(mocks.launched.at(-1)).toMatchObject({
        title: 'Continue USDS bridge',
        transactionTitle: 'Continue USDS bridge'
      });
    });

    it('stores the card under the burn hash once the burn is sent', () => {
      const callbacks = confirm(render('base', 'ethereum', SWAP));
      expect(mocks.burn.execute).toHaveBeenCalledOnce();
      act(() => {
        callbacks.onMutate({ functionName: 'depositForBurn' } as never);
        callbacks.onStart(BASE_BURN_TX.hash);
      });
      expect(pendingBridgeStore.getSnapshot(SCOPE)).toMatchObject([
        { txHash: BASE_BURN_TX.hash, from: 'base', to: 'ethereum', amount: AMOUNT }
      ]);
    });

    // X abandons the run, but the burn prompt still open in the wallet can be signed after it.
    it('stores the card of a burn signed after the modal was closed with X', () => {
      const callbacks = confirm(render());
      act(() => callbacks.onMutate({ functionName: 'depositForBurn' } as never));
      act(() => mocks.closeReset!());
      act(() => callbacks.onStart(BASE_BURN_TX.hash));
      expect(pendingBridgeStore.getSnapshot(SCOPE)).toMatchObject([
        { txHash: BASE_BURN_TX.hash, from: 'base', to: 'ethereum', amount: AMOUNT }
      ]);
    });

    // A burn signed from another Review is linked to the swap at once, but the chain shows it only once it mines.
    it('refuses to continue a swap whose burn another Review sent since this card opened', () => {
      try {
        const view = render('base', 'ethereum', SWAP);
        act(() => view.result.current.launch());
        cctpSwapStore.record(SCOPE, SWAP);
        cctpSwapStore.markBurn(SCOPE, SWAP.swapTxHash, BASE_BURN_TX.hash);
        act(() => mocks.launched.at(-1)!.onConfirm!());
        expect(mocks.burn.execute).not.toHaveBeenCalled();
        expect(mocks.onError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'This bridge was sent from another window. Close this and check its card.',
            final: true
          })
        );
        // The card of a failed burn still continues: its swap is linked to that same burn.
        const failed = { ...SWAP, burn: BASE_BURN_TX.hash.toLowerCase() };
        confirm(render('base', 'ethereum', failed));
        expect(mocks.burn.execute).toHaveBeenCalledOnce();
      } finally {
        cctpSwapStore.clear(SCOPE, SWAP.swapTxHash);
      }
    });

    // The burn legs link this Review's own burn to the swap; it failing leaves the USDC to continue from here.
    const ANOTHER_WINDOW = 'This bridge was sent from another window. Close this and check its card.';
    const RETRY_BURNS = [
      ['a burn that reverted', () => new TransactionRevertedError(), undefined],
      ['a burn the wallet cancelled', () => new TransactionReplacedError(new Error('cancelled')), undefined],
      ['a burn sped up, then reverted', () => new TransactionRevertedError(), '0xbeef']
    ] as const;
    it.each(RETRY_BURNS)(
      'retries a continued swap after %s, but not after another window burns',
      (_, failure, repriced) => {
        try {
          cctpSwapStore.record(SCOPE, SWAP);
          const callbacks = confirm(render('base', 'ethereum', SWAP));
          act(() => {
            callbacks.onMutate({ functionName: 'depositForBurn' } as never);
            callbacks.onStart(BASE_BURN_TX.hash);
          });
          cctpSwapStore.markBurn(SCOPE, SWAP.swapTxHash, BASE_BURN_TX.hash);
          if (repriced) {
            act(() => callbacks.onStart(repriced));
            cctpSwapStore.markBurn(SCOPE, SWAP.swapTxHash, repriced);
          }
          act(() => callbacks.onError(failure(), repriced ?? BASE_BURN_TX.hash));

          act(() => mocks.launched.at(-1)!.onConfirm!());
          expect(mocks.onError).not.toHaveBeenCalledWith(
            expect.objectContaining({ message: ANOTHER_WINDOW })
          );
          expect(mocks.burn.execute).toHaveBeenCalledTimes(2);

          // Another window's burn since is still not this Review's to follow.
          const again = mocks.burn.args.at(-1)!.getCallbacks();
          act(() => again.onError(new Error('User rejected the request.'), ''));
          cctpSwapStore.markBurn(SCOPE, SWAP.swapTxHash, '0xfeed');
          act(() => mocks.launched.at(-1)!.onConfirm!());
          expect(mocks.onError).toHaveBeenLastCalledWith(
            expect.objectContaining({ message: ANOTHER_WINDOW, final: true })
          );
          expect(mocks.burn.execute).toHaveBeenCalledTimes(2);
        } finally {
          cctpSwapStore.clear(SCOPE, SWAP.swapTxHash);
        }
      }
    );

    it('retries a continued swap after its own bundle failed', () => {
      try {
        cctpSwapStore.record(SCOPE, SWAP);
        const callbacks = confirm(render('base', 'ethereum', SWAP));
        const { onCallsSent } = mocks.burn.args.at(-1) as unknown as { onCallsSent: (id: string) => void };
        act(() => {
          onCallsSent('0xca11');
          callbacks.onMutate(undefined as never);
          callbacks.onStart(undefined);
        });
        cctpSwapStore.markBurn(SCOPE, SWAP.swapTxHash, '0xca11');
        act(() => callbacks.onError(new Error('ERROR: Batch transaction failed'), undefined));

        act(() => mocks.launched.at(-1)!.onConfirm!());
        expect(mocks.onError).not.toHaveBeenCalledWith(expect.objectContaining({ message: ANOTHER_WINDOW }));
        expect(mocks.burn.execute).toHaveBeenCalledTimes(2);
      } finally {
        cctpSwapStore.clear(SCOPE, SWAP.swapTxHash);
      }
    });

    // A burn this window sent in an earlier Review may still be pending: a new Review must not send another.
    it('refuses a new Review of the swap whose burn an earlier Review linked after it opened', () => {
      try {
        cctpSwapStore.record(SCOPE, SWAP);
        const view = render('base', 'ethereum', SWAP);
        act(() => view.result.current.launch());
        act(() => mocks.launched.at(-1)!.onConfirm!());
        const callbacks = mocks.burn.args.at(-1)!.getCallbacks();
        act(() => {
          callbacks.onMutate({ functionName: 'depositForBurn' } as never);
          callbacks.onStart(BASE_BURN_TX.hash);
        });
        cctpSwapStore.markBurn(SCOPE, SWAP.swapTxHash, BASE_BURN_TX.hash);
        act(() => callbacks.onError(new TransactionRevertedError(), BASE_BURN_TX.hash));
        act(() => view.result.current.launch());
        act(() => mocks.launched.at(-1)!.onConfirm!());
        expect(mocks.onError).toHaveBeenLastCalledWith(
          expect.objectContaining({ message: ANOTHER_WINDOW, final: true })
        );
        expect(mocks.burn.execute).toHaveBeenCalledTimes(1);
      } finally {
        cctpSwapStore.clear(SCOPE, SWAP.swapTxHash);
      }
    });

    // A convert of the same USDC may still mine; a burn after it would take USDC the wallet held before.
    it('refuses to continue a swap whose USDC another window sent a convert for', () => {
      try {
        const view = render('base', 'ethereum', SWAP);
        act(() => view.result.current.launch());
        cctpSwapStore.record(SCOPE, SWAP);
        cctpSwapStore.markConvert(SCOPE, SWAP.swapTxHash, '0xc0');
        act(() => mocks.launched.at(-1)!.onConfirm!());
        expect(mocks.burn.execute).not.toHaveBeenCalled();
        expect(mocks.onError).toHaveBeenCalledWith(
          expect.objectContaining({
            message:
              'The USDC of this bridge was converted from another window. Close this and check your balance.',
            final: true
          })
        );
      } finally {
        cctpSwapStore.clear(SCOPE, SWAP.swapTxHash);
      }
    });
  });

  describe('the claim notes in the Review', () => {
    type ReviewProps = {
      recipientWarning?: boolean;
      contractWallet?: { accepted: boolean; onAcceptedChange: (accepted: boolean) => void };
      safeQueue?: boolean;
      storageNote?: boolean;
    };
    const reviewProps = (config: Partial<TransactionConfig>) =>
      (config.transactionContent as ReactElement<ReviewProps>).props;
    const OTHER = '0x00000000000000000000000000000000000b0b01';

    it('warns about a recipient other than the wallet, and not about the wallet in any case', () => {
      const other = render('base', 'ethereum', undefined, { recipient: OTHER });
      act(() => other.result.current.launch());
      expect(reviewProps(mocks.launched.at(-1)!).recipientWarning).toBe(true);
      const own = render('base', 'ethereum', undefined, { recipient: SENDER.toLowerCase() });
      act(() => own.result.current.launch());
      expect(reviewProps(mocks.launched.at(-1)!).recipientWarning).toBe(false);
      const none = render();
      act(() => none.result.current.launch());
      expect(reviewProps(mocks.launched.at(-1)!)).toMatchObject({
        recipientWarning: false,
        contractWallet: undefined
      });
    });

    it.each([
      ['a Safe sending one step at a time', true, false, 'base', true],
      ['a Safe sending one bundle', true, true, 'base', false],
      ['a wallet that is not a Safe', false, false, 'base', false],
      ['a Safe on a route from Ethereum', true, false, 'ethereum', false]
    ] as const)(
      'tells %s whether to finish a stopped bridge from its queue',
      (_, safe, isBatch, from, shown) => {
        mocks.safe = safe;
        mocks.burn.isBatch = isBatch;
        const view = render(from, from === 'ethereum' ? 'base' : 'ethereum');
        act(() => view.result.current.launch());
        expect(!!reviewProps(mocks.launched.at(-1)!).safeQueue).toBe(shown);
      }
    );

    it('asks nothing on a route from Ethereum', () => {
      const view = render('ethereum', 'base', undefined, { recipient: OTHER, senderIsContract: true });
      act(() => view.result.current.launch());
      expect(reviewProps(mocks.launched.at(-1)!)).toMatchObject({
        recipientWarning: false,
        contractWallet: undefined
      });
    });

    it('holds Confirm for a contract wallet until it ticks the box, and refuses to send before', () => {
      const view = render('base', 'ethereum', undefined, { senderIsContract: true });
      act(() => view.result.current.launch());
      const opened = mocks.launched.at(-1)!;
      expect(opened.confirmDisabled).toBe(true);
      expect(reviewProps(opened).contractWallet?.accepted).toBe(false);
      act(() => opened.onConfirm!());
      expect(mocks.burn.execute).not.toHaveBeenCalled();
      expect(mocks.onError).toHaveBeenCalled();

      mocks.modalOpen = true;
      view.rerender();
      // The open modal keeps Confirm held while the box is unticked.
      expect(mocks.updates.at(-1)!.confirmDisabled).toBe(true);
      act(() => reviewProps(opened).contractWallet!.onAcceptedChange(true));
      const update = mocks.updates.at(-1)!;
      expect(update.confirmDisabled).toBe(false);
      expect(reviewProps(update).contractWallet?.accepted).toBe(true);
      act(() => opened.onConfirm!());
      expect(mocks.burn.execute).toHaveBeenCalledOnce();
    });

    it('asks again on the next Review', () => {
      const view = render('base', 'ethereum', undefined, { senderIsContract: true });
      act(() => view.result.current.launch());
      act(() => reviewProps(mocks.launched.at(-1)!).contractWallet!.onAcceptedChange(true));
      act(() => view.result.current.launch());
      expect(mocks.launched.at(-1)!.confirmDisabled).toBe(true);
      act(() => mocks.launched.at(-1)!.onConfirm!());
      expect(mocks.burn.execute).not.toHaveBeenCalled();
    });

    it('says why another recipient is refused when browser storage takes no writes', () => {
      mocks.storageWritable = false;
      Object.assign(mocks.burn, { ready: false, error: new Error('needs browser storage') });
      const other = render('base', 'ethereum', undefined, { recipient: OTHER });
      act(() => other.result.current.launch());
      expect(mocks.launched.at(-1)).toMatchObject({ confirmDisabled: true });
      expect(mocks.launched.at(-1)!.errorMessage).toMatch(/browser storage/i);
      expect(mocks.launched.at(-1)!.errorMessage).toMatch(/your own address/);
      // The wallet's own address needs no storage to be claimed.
      const own = render();
      act(() => own.result.current.launch());
      expect(mocks.launched.at(-1)!.errorMessage ?? '').not.toMatch(/browser storage/i);
    });

    it("tells the wallet's own bridge this browser can't save it, without holding Confirm", () => {
      mocks.storageWritable = false;
      const own = render();
      act(() => own.result.current.launch());
      expect(reviewProps(mocks.launched.at(-1)!).storageNote).toBe(true);
      expect(mocks.launched.at(-1)!.confirmDisabled).toBe(false);
      act(() => mocks.launched.at(-1)!.onConfirm!());
      expect(mocks.burn.execute).toHaveBeenCalledOnce();
      // Another recipient is refused instead, and a route from Ethereum needs no claim link.
      const other = render('base', 'ethereum', undefined, { recipient: OTHER });
      act(() => other.result.current.launch());
      expect(reviewProps(mocks.launched.at(-1)!).storageNote).toBe(false);
      const deposit = render('ethereum', 'base');
      act(() => deposit.result.current.launch());
      expect(reviewProps(mocks.launched.at(-1)!).storageNote).toBe(false);
    });

    it('checks browser storage again on each Review', () => {
      const view = render('base', 'ethereum', undefined, { recipient: OTHER });
      act(() => view.result.current.launch());
      expect(mocks.launched.at(-1)!.errorMessage ?? '').not.toMatch(/browser storage/i);
      mocks.storageWritable = false;
      act(() => view.result.current.launch());
      mocks.modalOpen = true;
      view.rerender();
      expect(mocks.updates.at(-1)!.errorMessage).toMatch(/browser storage/i);

      const own = render();
      act(() => own.result.current.launch());
      mocks.storageWritable = true;
      act(() => own.result.current.launch());
      own.rerender();
      expect(reviewProps(mocks.updates.at(-1)!).storageNote).toBe(false);
    });

    // The legs built while storage took writes; the Review that finds it gone must still send nothing.
    it('holds Confirm and sends nothing to another recipient when storage stops taking writes after the legs built', () => {
      const view = render('base', 'ethereum', undefined, { recipient: OTHER });
      mocks.storageWritable = false;
      act(() => view.result.current.launch());
      mocks.modalOpen = true;
      view.rerender();
      expect(mocks.updates.at(-1)!.confirmDisabled).toBe(true);
      expect(mocks.burn.args.at(-1)).toMatchObject({ storageWritable: false });
      act(() => mocks.launched.at(-1)!.onConfirm!());
      expect(mocks.burn.execute).not.toHaveBeenCalled();
    });

    it('asks a contract wallet nothing when another address claims', () => {
      const view = render('base', 'ethereum', undefined, { senderIsContract: true, recipient: OTHER });
      act(() => view.result.current.launch());
      expect(mocks.launched.at(-1)!.confirmDisabled).toBe(false);
      expect(reviewProps(mocks.launched.at(-1)!)).toMatchObject({
        recipientWarning: true,
        contractWallet: undefined
      });
    });
  });
});
