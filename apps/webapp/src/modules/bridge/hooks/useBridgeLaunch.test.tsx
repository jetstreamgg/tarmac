/**
 * @vitest-environment happy-dom
 */
import { TransactionRevertedError } from '@/hooks/shared/useTransactionOutcome';
import { createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeroAddress } from 'viem';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import type { TransactionConfig, TxCallbacks } from '@/modules/ui/context/transactionContract';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { useBridgeForm } from './useBridgeForm';
import { cctpWithdrawalRoute, nativeWithdrawalRoute } from '../model/resolveRoute';
import { useBridgeLaunch } from './useBridgeLaunch';

const SENDER = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
const OWNER = '0x2546BcD3c84621e976D8185a91A922aE77ECEc30';
const ONE = 10n ** 18n;

// A Safe service reply per host: an HTTP status, or 'hang' for a request that never returns.
type SafeReply = number | 'hang';

const mocks = vi.hoisted(() => ({
  isConnected: true,
  // The width tier; 0 is a phone.
  bpi: 0,
  fallbackNotices: [] as unknown[],
  routeCards: {
    args: [] as { options: unknown; sources: Record<string, { calls: unknown[] }> }[],
    cards: undefined as unknown
  },
  // The CCTP gate an L2 source reads; undefined blocks it.
  cctp: undefined as unknown,
  balance: undefined as bigint | undefined,
  balanceLoading: false,
  // The Ethereum ETH balance; undefined reads `balance`.
  ethBalance: undefined as bigint | undefined,
  ethLoading: false,
  bridgeOpen: 1n,
  // The L2 bridges' maxWithdraws.
  maxWithdraws: 10n ** 30n,
  refetchAllowance: vi.fn(),
  safe: {} as Record<string, SafeReply>,
  isModalOpen: false,
  launched: [] as TransactionConfig[],
  updates: [] as Partial<TransactionConfig>[],
  onError: vi.fn(),
  onSuccess: vi.fn(),
  appChainId: 1,
  networkFee: [] as { calls: unknown[]; chainId?: number; shouldUseBatch?: boolean; enabled?: boolean }[],
  legs: [] as { names: string[]; getCallbacks: () => TxCallbacks }[],
  deposit: {
    ready: true,
    needsApprove: true,
    maxFee: undefined as bigint | undefined,
    error: null as Error | null,
    calls: [{ to: '0xdeposit' }] as unknown[],
    execute: vi.fn(),
    args: [] as {
      enabled: boolean;
      to: string;
      chainId: number | undefined;
      getCallbacks: () => TxCallbacks;
    }[]
  },
  withdrawal: {
    ready: true,
    needsApprove: true,
    error: null as Error | null,
    execute: vi.fn(),
    args: [] as {
      enabled: boolean;
      from: string;
      chainId: number | undefined;
      recipient: string | undefined;
      amount: bigint;
      getCallbacks: () => TxCallbacks;
    }[]
  }
}));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useConnection: () => ({
    isConnected: mocks.isConnected,
    address: mocks.isConnected ? SENDER : undefined,
    connector: mocks.isConnected ? { id: 'injected' } : undefined
  }),
  useChainId: () => mocks.appChainId,
  useChains: () => [1, 8453, 10, 42161, 130].map(id => ({ id })),
  usePublicClient: () => undefined,
  // The bridges' isOpen, and the L2 bridges' maxWithdraws.
  useReadContract: ({ functionName }: { functionName: string }) => ({
    status: 'success',
    data: functionName === 'maxWithdraws' ? mocks.maxWithdraws : mocks.bridgeOpen
  })
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useAppChainId: () => mocks.appChainId,
  useBreakpointIndex: () => ({ bpi: mocks.bpi }),
  useNetworkFee: (args: (typeof mocks.networkFee)[number]) => {
    mocks.networkFee.push(args);
    return { data: args.enabled ? { formatted: '$0.42' } : undefined };
  },
  useTokenBalance: ({ isNative }: { isNative?: boolean }) => {
    const value = isNative
      ? mocks.ethLoading
        ? undefined
        : (mocks.ethBalance ?? mocks.balance)
      : mocks.balance;
    return {
      data: value === undefined ? undefined : { value },
      isLoading: isNative ? mocks.ethLoading : mocks.balanceLoading
    };
  }
}));
vi.mock('@/modules/ui/hooks/engineLaunch', () => ({
  useShouldUseBatch: () => false,
  useBatchSupportPending: () => false
}));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({ canSwitchChain: true, handleSwitchChain: vi.fn() })
}));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: (config: TransactionConfig) => mocks.launched.push(config),
    updateModalContent: (_id: string, patch: Partial<TransactionConfig>) => mocks.updates.push(patch),
    isModalOpen: mocks.isModalOpen,
    txCallbacks: { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: mocks.onSuccess, onError: mocks.onError },
    txStatus: TxStatus.IDLE
  })
}));
vi.mock('@/modules/ui/hooks/useMinimizedSessionLock', () => ({
  useMinimizedSessionLock: () => ({ locked: false, restore: vi.fn() })
}));
vi.mock('@/hooks/ui/useAppChainId', () => ({
  useAppChainId: () => mocks.appChainId
}));
vi.mock('../adapters/mockAdapter', () => ({
  runMockLegs: (names: string[], getCallbacks: () => TxCallbacks) => {
    mocks.legs.push({ names, getCallbacks });
    return new Promise<string>(() => undefined);
  }
}));
// The CCTP burn engine stays idle on these routes.
vi.mock('./useCctpBurnLegs', () => {
  const idle = {
    calls: [],
    needsApprove: false,
    isBatch: false,
    ready: false,
    error: null,
    execute: () => {},
    reset: () => {},
    stop: () => {},
    refetchAllowance: () => {}
  };
  return { CCTP_BURN_FUNCTION: 'depositForBurn', useCctpBurnLegs: () => idle };
});
vi.mock('./useCctpGate', () => ({ useCctpGate: () => mocks.cctp }));
// Every address is an EOA; the code check has its own tests in useBridgeForm.
vi.mock('./useAddressCode', () => ({ useAddressCode: () => ({ code: 'none', isChecking: false }) }));
vi.mock('./useNativeDepositLegs', () => ({
  nativeDepositFunction: (to: string) =>
    to === 'arbitrum' ? 'outboundTransferCustomRefund' : 'bridgeERC20To',
  useNativeDepositLegs: (args: (typeof mocks.deposit.args)[number]) => {
    mocks.deposit.args.push(args);
    const { ready, needsApprove, maxFee, error, execute, calls } = mocks.deposit;
    return {
      calls,
      ready,
      needsApprove,
      maxFee,
      error,
      execute,
      isBatch: false,
      reset: vi.fn(),
      refetchAllowance: mocks.refetchAllowance
    };
  }
}));
vi.mock('../components/RouteFallbackToast', () => ({
  notifyRouteFallback: (notice: unknown) => mocks.fallbackNotices.push(notice)
}));
// The route picker's cards have their own suite; this one checks what the launch hands them.
vi.mock('./useBridgeRouteCards', () => ({
  useBridgeRouteCards: (args: (typeof mocks.routeCards.args)[number]) => {
    mocks.routeCards.args.push(args);
    return mocks.routeCards.cards;
  }
}));
vi.mock('./useNativeWithdrawalLegs', () => ({
  nativeWithdrawalFunction: (from: string) => (from === 'arbitrum' ? 'outboundTransfer' : 'bridgeERC20To'),
  useNativeWithdrawalLegs: (args: (typeof mocks.withdrawal.args)[number]) => {
    mocks.withdrawal.args.push(args);
    const { ready, needsApprove, error, execute } = mocks.withdrawal;
    return {
      calls: [{ to: '0xwithdrawal' }],
      ready,
      needsApprove,
      error,
      execute,
      isBatch: false,
      busy: false,
      legMined: false,
      reset: vi.fn(),
      stop: vi.fn(),
      refetchAllowance: mocks.refetchAllowance
    };
  }
}));
vi.mock('../components/BridgeReviewContent', () => ({
  BridgeReviewContent: () => null,
  BridgeTransferHero: () => null
}));

const safeConfig = { owners: [OWNER], threshold: 1 };

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = new URL(String(input));
  const reply = mocks.safe[url.host] ?? 404;
  if (reply === 'hang') return new Promise<never>(() => undefined);
  return Promise.resolve({
    status: reply,
    ok: reply >= 200 && reply < 300,
    json: () => Promise.resolve(safeConfig)
  } as Response);
});

const MAINNET = 'safe-transaction-mainnet.safe.global';
const BASE = 'safe-transaction-base.safe.global';

function renderBridge() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const view = renderHook(
    () => {
      const form = useBridgeForm();
      return { form, ...useBridgeLaunch(form) };
    },
    { wrapper }
  );
  return Object.assign(view, { queryClient });
}

// Lets the Safe service replies land and the hooks re-render.
const settle = async () => {
  for (let i = 0; i < 5; i++) await act(() => new Promise(resolve => setTimeout(resolve, 0)));
};

/** Types `amount`, opens Review and returns the modal's Confirm gate. */
const SOLANA_RECIPIENT = 'So11111111111111111111111111111111111111112';

/** Moves the wallet to `chainId` (as the wallet itself would) and lets the hooks catch up. */
async function moveWallet(view: ReturnType<typeof renderBridge>, chainId: number) {
  mocks.appChainId = chainId;
  view.rerender();
  await settle();
}

// The default route, Ethereum to Base, runs the real deposit.
const BRIDGE_CALL = 'bridgeERC20To';
/** Each Confirm that started the source legs, on the real deposit or on the mock. */
const runCount = () => mocks.legs.length + mocks.deposit.execute.mock.calls.length;
const firstRunCallbacks = () => (mocks.legs[0]?.getCallbacks ?? mocks.deposit.args.at(-1)!.getCallbacks)();

async function confirmDisabledFor(amount: string, recipient?: string) {
  const view = renderBridge();
  act(() => view.result.current.form.onInput(amount));
  if (recipient) act(() => view.result.current.form.setRecipient(recipient));
  await settle();
  act(() => view.result.current.launch());
  return mocks.launched.at(-1)?.confirmDisabled;
}

describe('useBridgeLaunch Confirm gate', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    Object.assign(mocks, {
      isConnected: true,
      balance: 10n * ONE,
      balanceLoading: false,
      bridgeOpen: 1n,
      maxWithdraws: 10n ** 30n,
      safe: {},
      bpi: 0,
      isModalOpen: false,
      launched: [],
      updates: [],
      appChainId: 1,
      networkFee: [],
      legs: [],
      cctp: undefined
    });
    Object.assign(mocks.deposit, {
      ready: true,
      needsApprove: true,
      maxFee: undefined,
      error: null,
      calls: [{ to: '0xdeposit' }],
      args: []
    });
    mocks.deposit.execute.mockClear();
    Object.assign(mocks.withdrawal, { ready: true, needsApprove: true, error: null, args: [] });
    mocks.withdrawal.execute.mockClear();
    mocks.onError.mockClear();
    mocks.onSuccess.mockClear();
    mocks.refetchAllowance.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockClear();
  });

  it('allows an EOA with enough USDS', async () => {
    expect(await confirmDisabledFor('1')).toBe(false);
  });

  it('blocks an amount over the balance', async () => {
    mocks.balance = ONE / 2n;
    expect(await confirmDisabledFor('1')).toBe(true);
  });

  it('blocks while the balance is loading', async () => {
    mocks.balance = undefined;
    mocks.balanceLoading = true;
    expect(await confirmDisabledFor('1')).toBe(true);
  });

  it('allows a Safe whose same Safe exists on the destination', async () => {
    mocks.safe = { [MAINNET]: 200, [BASE]: 200 };
    expect(await confirmDisabledFor('1')).toBe(false);
  });

  it('blocks a Safe with no Safe on the destination and no recipient', async () => {
    mocks.safe = { [MAINNET]: 200, [BASE]: 404 };
    expect(await confirmDisabledFor('1')).toBe(true);
  });

  it('blocks a Safe that types its own address as the recipient', async () => {
    mocks.safe = { [MAINNET]: 200, [BASE]: 404 };
    expect(await confirmDisabledFor('1', SENDER.toLowerCase())).toBe(true);
  });

  it('blocks when the Safe check fails', async () => {
    mocks.safe = { [MAINNET]: 503 };
    expect(await confirmDisabledFor('1')).toBe(true);
  });

  it('blocks while the Safe check is in flight', async () => {
    mocks.safe = { [MAINNET]: 'hang' };
    expect(await confirmDisabledFor('1')).toBe(true);
  });

  it('keeps the gate live when Review opened before connecting', async () => {
    mocks.isConnected = false;
    const view = renderBridge();
    act(() => view.result.current.form.onInput('1'));
    act(() => view.result.current.launch());

    mocks.balance = ONE / 2n;
    mocks.isConnected = true;
    mocks.isModalOpen = true;
    view.rerender();
    await settle();

    expect(mocks.updates.at(-1)?.confirmDisabled).toBe(true);
  });

  it('blocks when the balance could not be read', async () => {
    mocks.balance = undefined;
    expect(await confirmDisabledFor('1')).toBe(true);
  });

  it('blocks a source the app cannot switch to, instead of running on the wallet chain', async () => {
    const view = renderBridge();
    act(() => view.result.current.form.onInput('1'));
    act(() => view.result.current.form.selectFrom('avalanche'));
    await settle();
    expect(view.result.current.form.sourceUnavailable).toBe(true);
    expect(view.result.current.form.reviewBlocked).toBe(true);
    act(() => view.result.current.launch());
    expect(mocks.launched.every(config => config.confirmDisabled)).toBe(true);
  });

  it('Confirm fails, not silently, when the source is no longer available', async () => {
    const view = renderBridge();
    act(() => view.result.current.form.onInput('1'));
    await settle();
    act(() => view.result.current.launch());
    act(() => view.result.current.form.selectFrom('avalanche'));
    await settle();
    act(() => mocks.launched.at(-1)!.onConfirm!());
    expect(mocks.onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('Confirm fails, not silently, when the wallet disconnected', async () => {
    const view = renderBridge();
    act(() => view.result.current.form.onInput('1'));
    await settle();
    act(() => view.result.current.launch());
    mocks.isConnected = false;
    view.rerender();
    act(() => mocks.launched.at(-1)!.onConfirm!());
    expect(mocks.onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('blocks a recipient that is not valid for the destination: EVM address kept for Solana', async () => {
    const view = renderBridge();
    act(() => view.result.current.form.onInput('1'));
    act(() => view.result.current.form.selectTo('solana'));
    await moveWallet(view, 8453);
    expect(view.result.current.form).toMatchObject({ from: 'base', to: 'ethereum' });
    act(() => view.result.current.form.setRecipient(OWNER));
    await moveWallet(view, 1);
    const form = view.result.current.form;
    expect(form.to).toBe('solana');
    expect(!!form.recipient && !form.reviewBlocked).toBe(false);
  });

  it('blocks a recipient that is not valid for the destination: Solana address kept for EVM', async () => {
    const view = renderBridge();
    act(() => view.result.current.form.onInput('1'));
    act(() => view.result.current.form.selectTo('solana'));
    act(() => view.result.current.form.setRecipient(SOLANA_RECIPIENT));
    await moveWallet(view, 8453);
    const form = view.result.current.form;
    expect(form.to).toBe('ethereum');
    expect(!!form.recipient && !form.reviewBlocked).toBe(false);
  });

  it('blocks the zero address as recipient', async () => {
    expect(await confirmDisabledFor('1', zeroAddress)).toBe(true);
  });

  it('Confirm runs nothing when the recipient stopped being valid after Review', async () => {
    const view = renderBridge();
    act(() => view.result.current.form.onInput('1'));
    await settle();
    act(() => view.result.current.launch());
    expect(mocks.launched.at(-1)?.confirmDisabled).toBe(false);
    act(() => view.result.current.form.setRecipient(SOLANA_RECIPIENT));
    await settle();
    act(() => mocks.launched.at(-1)!.onConfirm!());
    expect(runCount()).toBe(0);
    expect(mocks.onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('Retry after the send was broadcast runs nothing again and stores one bridge', async () => {
    const view = renderBridge();
    act(() => view.result.current.form.onInput('1'));
    await settle();
    act(() => view.result.current.launch());
    act(() => mocks.launched.at(-1)!.onConfirm!());
    const callbacks = firstRunCallbacks();
    callbacks.onMutate({ functionName: 'approve' });
    callbacks.onStart('0xapprove');
    callbacks.onMutate({ functionName: BRIDGE_CALL });
    callbacks.onStart('0xsend');
    callbacks.onError(new Error('rpc timeout'), '0xsend');

    // TransactionContext.handleRetry calls onConfirm when the flow has no onRetry.
    act(() => mocks.launched.at(-1)!.onConfirm!());
    expect(runCount()).toBe(1);
    expect(mocks.onError).toHaveBeenCalledTimes(2);
    const scope = pendingScopeKey({ account: SENDER, familyChainId: 1 });
    expect(pendingBridgeStore.getSnapshot(scope).filter(bridge => bridge.amount === ONE)).toHaveLength(1);
  });

  it('a send that reverts leaves the stored bridge failed, and Retry can send again', async () => {
    const view = renderBridge();
    act(() => view.result.current.form.onInput('1'));
    await settle();
    act(() => view.result.current.launch());
    act(() => mocks.launched.at(-1)!.onConfirm!());
    const callbacks = firstRunCallbacks();
    callbacks.onMutate({ functionName: 'approve' });
    callbacks.onStart('0xapprove1');
    callbacks.onMutate({ functionName: BRIDGE_CALL });
    callbacks.onStart('0xsend1');
    const scope = pendingScopeKey({ account: SENDER, familyChainId: 1 });
    const stored = () => pendingBridgeStore.getSnapshot(scope).find(bridge => bridge.txHash === '0xsend1');
    expect(stored()?.status).toBe('pending');

    callbacks.onError(new TransactionRevertedError(), '0xsend1');
    expect(stored()?.status).toBe('failed');

    act(() => mocks.launched.at(-1)!.onConfirm!());
    expect(runCount()).toBe(2);
  });

  it('a send sped up in the wallet is tracked under the hash that mines', async () => {
    const view = renderBridge();
    act(() => view.result.current.form.onInput('1'));
    await settle();
    act(() => view.result.current.launch());
    act(() => mocks.launched.at(-1)!.onConfirm!());
    const callbacks = firstRunCallbacks();
    callbacks.onMutate({ functionName: BRIDGE_CALL });
    callbacks.onStart('0xslow');
    callbacks.onStart('0xfast');
    const scope = pendingScopeKey({ account: SENDER, familyChainId: 1 });
    const stored = pendingBridgeStore.getSnapshot(scope).filter(bridge => bridge.id === '0xslow');
    expect(stored).toHaveLength(1);
    expect(stored[0].txHash).toBe('0xfast');
  });

  describe('a new Review after a send with no verdict', () => {
    // The send was broadcast, then the receipt wait failed without a revert.
    async function sendWithUnknownOutcome() {
      const view = renderBridge();
      act(() => view.result.current.form.onInput('1'));
      await settle();
      act(() => view.result.current.launch());
      act(() => mocks.launched.at(-1)!.onConfirm!());
      const callbacks = firstRunCallbacks();
      callbacks.onMutate({ functionName: BRIDGE_CALL });
      callbacks.onStart('0xunknown');
      callbacks.onError(new Error('Timed out while waiting for transaction'), '0xunknown');
      return { view, callbacks, scope: pendingScopeKey({ account: SENDER, familyChainId: 1 }) };
    }

    it('sends nothing while that bridge is still pending', async () => {
      const { view } = await sendWithUnknownOutcome();
      act(() => view.result.current.launch());
      act(() => mocks.launched.at(-1)!.onConfirm!());
      expect(runCount()).toBe(1);
      expect((mocks.onError.mock.calls.at(-1)?.[0] as Error).message).toMatch(/still pending/);
    });

    it('can send again once the card settles', async () => {
      const { view, scope } = await sendWithUnknownOutcome();
      pendingBridgeStore.update(scope, '0xunknown', bridge => ({ ...bridge, status: 'failed' }));
      act(() => view.result.current.launch());
      act(() => mocks.launched.at(-1)!.onConfirm!());
      expect(runCount()).toBe(2);
    });

    it('can send again after a flow that succeeded, while that bridge is still in flight', async () => {
      const view = renderBridge();
      act(() => view.result.current.form.onInput('1'));
      await settle();
      act(() => view.result.current.launch());
      act(() => mocks.launched.at(-1)!.onConfirm!());
      const callbacks = firstRunCallbacks();
      callbacks.onMutate({ functionName: BRIDGE_CALL });
      callbacks.onStart('0xdone');
      callbacks.onSuccess('0xdone', 42n);
      // The block lets the history refresh wait for the indexer.
      expect(mocks.onSuccess).toHaveBeenCalledWith('0xdone', 42n);

      act(() => view.result.current.launch());
      act(() => mocks.launched.at(-1)!.onConfirm!());
      expect(runCount()).toBe(2);
    });

    it('a Safe can queue another bridge while the first waits for its co-signers', async () => {
      mocks.safe = { [MAINNET]: 200, [BASE]: 200 };
      const view = renderBridge();
      act(() => view.result.current.form.onInput('1'));
      await settle();
      act(() => view.result.current.launch());
      act(() => mocks.launched.at(-1)!.onConfirm!());
      const callbacks = firstRunCallbacks();
      callbacks.onMutate({ functionName: BRIDGE_CALL });
      callbacks.onStart('0xsafequeued');

      // The modal closed before the Safe executed: no verdict reached the flow.
      act(() => view.result.current.launch());
      act(() => mocks.launched.at(-1)!.onConfirm!());
      expect(runCount()).toBe(2);
    });
  });

  it('a bridge call rejected after an earlier leg mined stores nothing, and Retry runs the legs again', async () => {
    const view = renderBridge();
    act(() => view.result.current.form.onInput('1'));
    await settle();
    act(() => view.result.current.launch());
    act(() => mocks.launched.at(-1)!.onConfirm!());
    const callbacks = firstRunCallbacks();
    callbacks.onMutate({ functionName: 'swapExactIn' });
    callbacks.onStart('0xswap');
    callbacks.onMutate({ functionName: BRIDGE_CALL });
    callbacks.onError(new Error('User rejected the request.'), '0xswap');
    const scope = pendingScopeKey({ account: SENDER, familyChainId: 1 });
    expect(pendingBridgeStore.getSnapshot(scope).find(bridge => bridge.id === '0xswap')).toBeUndefined();

    act(() => mocks.launched.at(-1)!.onConfirm!());
    expect(runCount()).toBe(2);
  });

  it('Retry after a rejected approve runs the legs again', async () => {
    const view = renderBridge();
    act(() => view.result.current.form.onInput('1'));
    await settle();
    act(() => view.result.current.launch());
    act(() => mocks.launched.at(-1)!.onConfirm!());
    const callbacks = firstRunCallbacks();
    callbacks.onMutate({ functionName: 'approve' });
    callbacks.onError(new Error('User rejected the request.'));

    act(() => mocks.launched.at(-1)!.onConfirm!());
    expect(runCount()).toBe(2);
  });

  it('a dismissed Safe bridge that executes anyway comes back with its on-chain hash', async () => {
    mocks.safe = { [MAINNET]: 200, [BASE]: 200 };
    const view = renderBridge();
    act(() => view.result.current.form.onInput('1'));
    await settle();
    act(() => view.result.current.launch());
    act(() => mocks.launched.at(-1)!.onConfirm!());
    const callbacks = firstRunCallbacks();
    callbacks.onMutate({ functionName: BRIDGE_CALL });
    callbacks.onStart('0xsafequeued');
    const scope = pendingScopeKey({ account: SENDER, familyChainId: 1 });
    const stored = () =>
      pendingBridgeStore.getSnapshot(scope).find(bridge => bridge.safeTxHash === '0xsafequeued');
    expect(stored()).toBeDefined();

    pendingBridgeStore.dismiss(scope, stored()!.id);
    expect(stored()).toBeUndefined();

    callbacks.onSuccess('0xsafeexecuted');
    expect(stored()?.txHash).toBe('0xsafeexecuted');
  });

  describe('an Ethereum to Arbitrum deposit', () => {
    async function reviewDeposit() {
      const view = renderBridge();
      act(() => view.result.current.form.onInput('1'));
      act(() => view.result.current.form.selectTo('arbitrum'));
      await settle();
      expect(view.result.current.form).toMatchObject({ from: 'ethereum', to: 'arbitrum' });
      act(() => view.result.current.launch());
      return view;
    }
    const stepLabels = () =>
      (mocks.launched.at(-1)?.steps ?? []).map(step => (typeof step === 'string' ? step : step.label));

    it('reads the deposit on the pinned Ethereum chain', async () => {
      await reviewDeposit();
      expect(mocks.deposit.args.at(-1)).toMatchObject({ enabled: true, chainId: 1 });
    });

    it('blocks Confirm until the deposit is priced, says why, and sends nothing', async () => {
      Object.assign(mocks.deposit, {
        ready: false,
        error: new Error('The Arbitrum deposit could not be priced')
      });
      await reviewDeposit();
      const config = mocks.launched.at(-1)!;
      expect(config.confirmDisabled).toBe(true);
      expect(config.errorMessage).toBeTruthy();
      act(() => config.onConfirm!());
      expect(mocks.deposit.execute).not.toHaveBeenCalled();
      expect(mocks.legs).toHaveLength(0);
      expect(mocks.onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('Confirm runs the deposit, not the mock, and stores the deposit under its own hash', async () => {
      await reviewDeposit();
      expect(mocks.launched.at(-1)?.confirmDisabled).toBe(false);
      act(() => mocks.launched.at(-1)!.onConfirm!());
      expect(mocks.deposit.execute).toHaveBeenCalledTimes(1);
      expect(mocks.legs).toHaveLength(0);

      const callbacks = mocks.deposit.args.at(-1)!.getCallbacks();
      callbacks.onMutate({ functionName: 'approve' });
      callbacks.onStart('0xarbapprove');
      callbacks.onMutate({ functionName: 'outboundTransferCustomRefund' });
      callbacks.onStart('0xarbdeposit');
      const scope = pendingScopeKey({ account: SENDER, familyChainId: 1 });
      const snapshot = pendingBridgeStore.getSnapshot(scope);
      expect(snapshot.find(bridge => bridge.txHash === '0xarbapprove')).toBeUndefined();
      expect(snapshot.find(bridge => bridge.txHash === '0xarbdeposit')).toMatchObject({
        from: 'ethereum',
        to: 'arbitrum',
        amount: ONE
      });
    });

    it.each([
      ['the balance reloads', () => (mocks.balanceLoading = true)],
      ['the bridge closes', () => (mocks.bridgeOpen = 0n)]
    ])('keeps the started legs running when %s between the approve and the deposit', async (_, change) => {
      const view = await reviewDeposit();
      act(() => mocks.launched.at(-1)!.onConfirm!());
      const callbacks = mocks.deposit.args.at(-1)!.getCallbacks();
      callbacks.onMutate({ functionName: 'approve' });
      callbacks.onStart('0xarbapprove');
      change();
      view.rerender();
      await settle();
      expect(view.result.current.form.reviewBlocked).toBe(true);
      expect(mocks.deposit.args.at(-1)).toMatchObject({ enabled: true, to: 'arbitrum', chainId: 1 });

      // The run is over: the legs follow the form again, on the allowance and balances the deposit left.
      const tokensOn = (chainId: number) => [
        'token-balances',
        '0xowner',
        { [chainId]: [{ symbol: 'USDS' }] }
      ];
      view.queryClient.setQueryData(tokensOn(1), []);
      view.queryClient.setQueryData(tokensOn(42161), []);
      expect(mocks.refetchAllowance).not.toHaveBeenCalled();
      act(() => callbacks.onSuccess('0xarbdeposit'));
      await settle();
      expect(mocks.deposit.args.at(-1)?.enabled).toBe(false);
      expect(mocks.refetchAllowance).toHaveBeenCalled();
      expect(view.queryClient.getQueryState(tokensOn(1))?.isInvalidated).toBe(true);
      // Nothing arrived on Arbitrum yet: the tracker refreshes it on arrival.
      expect(view.queryClient.getQueryState(tokensOn(42161))?.isInvalidated).toBe(false);
    });

    it('drops the Approve step when the allowance covers the amount', async () => {
      await reviewDeposit();
      expect(stepLabels()).toEqual(['Approve', 'Bridge']);
      mocks.deposit.needsApprove = false;
      await reviewDeposit();
      expect(stepLabels()).toEqual(['Bridge']);
    });

    it("shows the ticket's most ETH as the bridge fee", async () => {
      mocks.deposit.maxFee = 4_800_000_000_000n;
      await reviewDeposit();
      const content = mocks.launched.at(-1)?.transactionContent as { props: { bridgeFee?: string } };
      expect(content.props.bridgeFee).toBe('Up to 0.0000048 ETH');
    });

    it("prices the legs' gas, one at a time, on the pinned chain", async () => {
      await reviewDeposit();
      expect(mocks.networkFee.at(-1)).toEqual({
        calls: mocks.deposit.calls,
        chainId: 1,
        shouldUseBatch: false,
        enabled: true
      });
      const content = mocks.launched.at(-1)?.transactionContent as { props: { networkFee?: string } };
      expect(content.props.networkFee).toBe('$0.42');
    });

    it('shows no network fee before the legs are built', async () => {
      mocks.deposit.calls = [];
      await reviewDeposit();
      const content = mocks.launched.at(-1)?.transactionContent as { props: { networkFee?: string } };
      expect(content.props.networkFee).toBe('–');
    });
  });

  it.each([
    ['a Safe to Arbitrum', true, 'arbitrum', undefined, true],
    ['a Safe to Base', true, 'base', undefined, false],
    ['a wallet to Arbitrum', false, 'arbitrum', undefined, false],
    ['a Safe to another recipient on Arbitrum', true, 'arbitrum', OWNER, false]
  ] as const)(
    'Review from %s says whether the unused fee is refunded to an aliased address',
    async (_, safe, to, recipient, shown) => {
      mocks.safe = safe
        ? { [MAINNET]: 200, [BASE]: 200, ['safe-transaction-arbitrum.safe.global']: 200 }
        : {};
      const view = renderBridge();
      act(() => view.result.current.form.onInput('1'));
      act(() => view.result.current.form.selectTo(to));
      if (recipient) act(() => view.result.current.form.setRecipient(recipient));
      await settle();
      act(() => view.result.current.launch());
      const content = mocks.launched.at(-1)?.transactionContent as { props: { aliasedRefund?: boolean } };
      expect(!!content.props.aliasedRefund).toBe(shown);
    }
  );

  describe('an Ethereum to OP Stack deposit', () => {
    async function reviewDeposit(to: 'base' | 'optimism' | 'unichain') {
      const view = renderBridge();
      act(() => view.result.current.form.onInput('1'));
      act(() => view.result.current.form.selectTo(to));
      await settle();
      expect(view.result.current.form).toMatchObject({ from: 'ethereum', to });
      act(() => view.result.current.launch());
      return view;
    }

    it.each(['base', 'optimism', 'unichain'] as const)(
      'to %s reads and runs the deposit on the pinned Ethereum chain',
      async to => {
        await reviewDeposit(to);
        expect(mocks.deposit.args.at(-1)).toMatchObject({ enabled: true, to, chainId: 1 });
        act(() => mocks.launched.at(-1)!.onConfirm!());
        expect(mocks.deposit.execute).toHaveBeenCalledTimes(1);
        expect(mocks.legs).toHaveLength(0);
      }
    );

    it('stores the deposit under the bridgeERC20To hash, not the approve', async () => {
      await reviewDeposit('optimism');
      act(() => mocks.launched.at(-1)!.onConfirm!());
      const callbacks = mocks.deposit.args.at(-1)!.getCallbacks();
      callbacks.onMutate({ functionName: 'approve' });
      callbacks.onStart('0xopapprove');
      callbacks.onMutate({ functionName: 'bridgeERC20To' });
      callbacks.onStart('0xopdeposit');
      const scope = pendingScopeKey({ account: SENDER, familyChainId: 1 });
      const snapshot = pendingBridgeStore.getSnapshot(scope);
      expect(snapshot.find(bridge => bridge.txHash === '0xopapprove')).toBeUndefined();
      expect(snapshot.find(bridge => bridge.txHash === '0xopdeposit')).toMatchObject({
        from: 'ethereum',
        to: 'optimism',
        amount: ONE
      });
    });

    it('shows no bridge fee', async () => {
      await reviewDeposit('base');
      const content = mocks.launched.at(-1)?.transactionContent as { props: { bridgeFee?: string } };
      expect(content.props.bridgeFee).toBeUndefined();
    });
  });

  describe('the toast of a Review that falls back from CCTP', () => {
    async function review(route: ReturnType<typeof nativeWithdrawalRoute>) {
      mocks.appChainId = 8453;
      const form = {
        amount: ONE,
        from: 'base' as const,
        to: 'ethereum' as const,
        route,
        recipient: undefined,
        isConnected: true,
        reviewBlocked: false
      };
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
      const view = renderHook(() => useBridgeLaunch(form), { wrapper });
      await settle();
      act(() => view.result.current.launch());
    }

    beforeEach(() => {
      mocks.fallbackNotices.length = 0;
    });

    it('says CCTP is out and SkyLink was picked, once per Review', async () => {
      await review(nativeWithdrawalRoute('base', 'no-liquidity'));
      expect(mocks.fallbackNotices).toEqual([expect.objectContaining({ title: 'CCTP route unavailable' })]);
    });

    it('says nothing when CCTP could carry the bridge', async () => {
      await review(nativeWithdrawalRoute('base'));
      await review(cctpWithdrawalRoute('base'));
      expect(mocks.fallbackNotices).toEqual([]);
    });
  });

  describe('the route picker of a withdrawal with a choice', () => {
    const CARDS = [{ kind: 'cctp' }, { kind: 'native' }];
    async function reviewWithChoice({
      route,
      cctpUnavailable
    }: {
      route: ReturnType<typeof nativeWithdrawalRoute>;
      cctpUnavailable?: 'no-liquidity';
    }) {
      mocks.appChainId = 8453;
      const pickRoute = vi.fn();
      const form = {
        amount: ONE,
        from: 'base' as const,
        to: 'ethereum' as const,
        route,
        recipient: undefined,
        isConnected: true,
        reviewBlocked: false,
        routeOptions: [
          { route: cctpWithdrawalRoute('base'), ...(cctpUnavailable && { unavailable: cctpUnavailable }) },
          { route: nativeWithdrawalRoute('base') }
        ],
        pickRoute
      };
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
      const view = renderHook(() => useBridgeLaunch(form), { wrapper });
      await settle();
      act(() => view.result.current.launch());
      return { pickRoute };
    }
    const launchedPicker = () =>
      (mocks.launched.at(-1)?.transactionContent as { props: { routePicker?: unknown } }).props.routePicker;

    beforeEach(() => {
      mocks.routeCards.args.length = 0;
      mocks.routeCards.cards = undefined;
    });

    it("hands the Review the cards and the form's pick", async () => {
      mocks.routeCards.cards = CARDS;
      const { pickRoute } = await reviewWithChoice({ route: nativeWithdrawalRoute('base') });
      expect(launchedPicker()).toEqual({ cards: CARDS, onPick: pickRoute });
      const view = mocks.routeCards.args.at(-1)!;
      expect(view.options).toHaveLength(2);
      // The selected native withdrawal's own calls price its card.
      expect(view.sources.native.calls).toEqual([{ to: '0xwithdrawal' }]);
    });

    it('offers no picker without cards', async () => {
      await reviewWithChoice({ route: nativeWithdrawalRoute('base') });
      expect(launchedPicker()).toBeUndefined();
    });

    it('builds the native withdrawal while CCTP is selected, so its card has real figures', async () => {
      await reviewWithChoice({ route: cctpWithdrawalRoute('base') });
      // Read only: Confirm still runs CCTP's legs.
      expect(mocks.withdrawal.args.at(-1)).toMatchObject({ enabled: true, from: 'base', chainId: 8453 });
      expect(mocks.routeCards.args.at(-1)!.sources.native.calls).toEqual([{ to: '0xwithdrawal' }]);
    });

    it("leaves an unavailable route's engine off and its card without calls", async () => {
      await reviewWithChoice({
        route: nativeWithdrawalRoute('base', 'no-liquidity'),
        cctpUnavailable: 'no-liquidity'
      });
      expect(mocks.routeCards.args.at(-1)!.sources.cctp.calls).toEqual([]);
    });
  });

  describe('the route picker beside the review on desktop (Figma 3964:74437)', () => {
    const CARDS = [{ kind: 'cctp' }, { kind: 'native' }];
    async function reviewOn(bpi: number) {
      mocks.bpi = bpi;
      mocks.isModalOpen = true;
      mocks.appChainId = 8453;
      mocks.routeCards.cards = CARDS;
      const pickRoute = vi.fn();
      const form = {
        amount: ONE,
        from: 'base' as const,
        to: 'ethereum' as const,
        route: cctpWithdrawalRoute('base'),
        recipient: undefined,
        isConnected: true,
        reviewBlocked: false,
        routeOptions: [{ route: cctpWithdrawalRoute('base') }, { route: nativeWithdrawalRoute('base') }],
        pickRoute
      };
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
      const view = renderHook(() => useBridgeLaunch(form), { wrapper });
      await settle();
      act(() => view.result.current.launch());
      await settle();
      return { pickRoute };
    }
    type Picker = { beside?: { open: boolean; onOpenChange: (open: boolean) => void } };
    const latest = <K extends keyof TransactionConfig>(key: K) =>
      [mocks.launched.at(-1), ...mocks.updates].filter(c => c && key in c).at(-1)?.[key];
    const picker = () =>
      (latest('transactionContent') as { props: { routePicker?: Picker } }).props.routePicker;
    const aside = () =>
      latest('aside') as
        | { props: { cards: unknown; selected: string; onPick: (kind: string) => void; onBack: () => void } }
        | undefined;

    it('opens the options beside the review and closes them once a route is picked', async () => {
      const { pickRoute } = await reviewOn(3);
      expect(aside()).toBeUndefined();
      act(() => picker()!.beside!.onOpenChange(true));
      expect(aside()?.props).toMatchObject({ cards: CARDS, selected: 'cctp' });
      expect(picker()!.beside!.open).toBe(true);
      act(() => aside()!.props.onPick('native'));
      expect(pickRoute).toHaveBeenCalledWith('native');
      expect(aside()).toBeUndefined();
    });

    it('closes them on back without picking', async () => {
      const { pickRoute } = await reviewOn(3);
      act(() => picker()!.beside!.onOpenChange(true));
      act(() => aside()!.props.onBack());
      expect(aside()).toBeUndefined();
      expect(pickRoute).not.toHaveBeenCalled();
    });

    it('opens a new Review with them closed', async () => {
      await reviewOn(3);
      act(() => picker()!.beside!.onOpenChange(true));
      mocks.launched.length = 0;
      mocks.updates.length = 0;
      await reviewOn(3);
      expect(aside()).toBeUndefined();
      expect(picker()!.beside!.open).toBe(false);
    });

    it('below desktop, leaves the review to swap them in place', async () => {
      await reviewOn(2);
      expect(picker()!.beside).toBeUndefined();
      expect(aside()).toBeUndefined();
    });
  });

  describe('a native withdrawal to Ethereum', () => {
    // The form's route, as the resolver builds it when CCTP can't carry the amount.
    async function reviewWithdrawal(from: 'base' | 'arbitrum') {
      mocks.appChainId = from === 'base' ? 8453 : 42161;
      const form = {
        amount: ONE,
        from,
        to: 'ethereum' as const,
        route: nativeWithdrawalRoute(from, 'closed'),
        recipient: undefined,
        isConnected: true,
        reviewBlocked: false
      };
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
      const view = renderHook(() => useBridgeLaunch(form), { wrapper });
      await settle();
      act(() => view.result.current.launch());
      return view;
    }
    const stepLabels = () =>
      (mocks.launched.at(-1)?.steps ?? []).map(step => (typeof step === 'string' ? step : step.label));

    it.each([
      ['base', 8453],
      ['arbitrum', 42161]
    ] as const)('reads the %s withdrawal on the pinned source chain', async (from, chainId) => {
      await reviewWithdrawal(from);
      expect(mocks.withdrawal.args.at(-1)).toMatchObject({ enabled: true, from, chainId, amount: ONE });
      expect(mocks.deposit.args.at(-1)?.enabled).toBe(false);
    });

    it.each([
      ['base', 'bridgeERC20To'],
      ['arbitrum', 'outboundTransfer']
    ] as const)(
      'Confirm runs the %s withdrawal, not the mock, and stores it under the %s hash',
      async (from, functionName) => {
        await reviewWithdrawal(from);
        expect(mocks.launched.at(-1)?.confirmDisabled).toBe(false);
        act(() => mocks.launched.at(-1)!.onConfirm!());
        expect(mocks.withdrawal.execute).toHaveBeenCalledTimes(1);
        expect(mocks.deposit.execute).not.toHaveBeenCalled();
        expect(mocks.legs).toHaveLength(0);

        const callbacks = mocks.withdrawal.args.at(-1)!.getCallbacks();
        callbacks.onMutate({ functionName: 'approve' });
        callbacks.onStart(`0x${from}approve`);
        callbacks.onMutate({ functionName });
        callbacks.onStart(`0x${from}withdraw`);
        const scope = pendingScopeKey({ account: SENDER, familyChainId: 1 });
        const snapshot = pendingBridgeStore.getSnapshot(scope);
        expect(snapshot.find(bridge => bridge.txHash === `0x${from}approve`)).toBeUndefined();
        expect(snapshot.find(bridge => bridge.txHash === `0x${from}withdraw`)).toMatchObject({
          from,
          to: 'ethereum',
          amount: ONE,
          routeKind: 'native',
          requiresClaim: true
        });
      }
    );

    it('drops the Approve step when the allowance covers the amount', async () => {
      await reviewWithdrawal('base');
      expect(stepLabels()).toEqual(['Approve', 'Bridge']);
      mocks.withdrawal.needsApprove = false;
      await reviewWithdrawal('base');
      expect(stepLabels()).toEqual(['Bridge']);
    });

    it('blocks Confirm until the withdrawal is built, says why, and sends nothing', async () => {
      Object.assign(mocks.withdrawal, {
        ready: false,
        error: new Error('The withdrawal could not be built')
      });
      await reviewWithdrawal('base');
      const config = mocks.launched.at(-1)!;
      expect(config.confirmDisabled).toBe(true);
      expect(config.errorMessage).toBeTruthy();
      act(() => config.onConfirm!());
      expect(mocks.withdrawal.execute).not.toHaveBeenCalled();
      expect(mocks.legs).toHaveLength(0);
    });
  });

  describe('a Base to Ethereum bridge with CCTP closed', () => {
    async function reviewFromBase() {
      // A closed CCTP is the only way the resolver reaches the native withdrawal.
      mocks.cctp = { isOpen: false };
      const view = renderBridge();
      act(() => view.result.current.form.onInput('1'));
      await moveWallet(view, 8453);
      act(() => view.result.current.launch());
      return view;
    }

    it('falls back to the native withdrawal, which Confirm sends on Base', async () => {
      const view = await reviewFromBase();
      expect(view.result.current.form).toMatchObject({ from: 'base', to: 'ethereum', reviewBlocked: false });
      expect(view.result.current.form.route).toMatchObject({ kind: 'native', fallbackReason: 'closed' });
      act(() => mocks.launched.at(-1)!.onConfirm!());
      expect(mocks.withdrawal.args.at(-1)).toMatchObject({ enabled: true, from: 'base', chainId: 8453 });
      expect(mocks.withdrawal.execute).toHaveBeenCalledTimes(1);
      expect(mocks.deposit.execute).not.toHaveBeenCalled();
      expect(mocks.legs).toHaveLength(0);
    });

    it("sends nothing over the L2 bridge's withdrawal limit", async () => {
      mocks.maxWithdraws = 1n;
      const view = await reviewFromBase();
      expect(view.result.current.form).toMatchObject({ route: undefined, reviewBlocked: true });
      mocks.launched.at(-1)?.onConfirm?.();
      expect(mocks.withdrawal.execute).not.toHaveBeenCalled();
      expect(mocks.deposit.execute).not.toHaveBeenCalled();
      expect(mocks.legs).toHaveLength(0);
    });
  });

  describe('the ETH an Arbitrum deposit sends', () => {
    const FEE = 4_800_000_000_000n;
    beforeEach(() => {
      mocks.deposit.maxFee = FEE;
    });
    afterEach(() => {
      Object.assign(mocks, { ethBalance: undefined, ethLoading: false });
    });

    async function reviewTo(to: 'arbitrum' | 'base') {
      const view = renderBridge();
      act(() => view.result.current.form.onInput('1'));
      act(() => view.result.current.form.selectTo(to));
      await settle();
      act(() => view.result.current.launch());
      return mocks.launched.at(-1)!;
    }

    it('blocks Confirm before any approve when the wallet holds less ETH than the fee, and says why', async () => {
      mocks.ethBalance = FEE - 1n;
      const config = await reviewTo('arbitrum');
      expect(config.confirmDisabled).toBe(true);
      expect(config.errorMessage).toBe(
        'You need at least 0.0000048 ETH on Ethereum to pay the Arbitrum bridge fee.'
      );
      act(() => config.onConfirm!());
      expect(mocks.deposit.execute).not.toHaveBeenCalled();
    });

    it('allows Confirm when the wallet holds the fee', async () => {
      mocks.ethBalance = FEE;
      const config = await reviewTo('arbitrum');
      expect(config.confirmDisabled).toBe(false);
      expect(config.errorMessage).toBeFalsy();
    });

    it('blocks Confirm while the ETH balance loads', async () => {
      mocks.ethLoading = true;
      const config = await reviewTo('arbitrum');
      expect(config.confirmDisabled).toBe(true);
    });

    it('never blocks a Base deposit, which sends no ETH', async () => {
      mocks.deposit.maxFee = undefined;
      mocks.ethBalance = 0n;
      const config = await reviewTo('base');
      expect(config.confirmDisabled).toBe(false);
      expect(config.errorMessage).toBeFalsy();
    });
  });
});
