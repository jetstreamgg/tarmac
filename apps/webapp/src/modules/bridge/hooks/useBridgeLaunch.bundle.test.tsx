/**
 * @vitest-environment happy-dom
 */
import { createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  formatUnits,
  getAddress,
  UserRejectedRequestError,
  type Address,
  type Hex,
  type Log
} from 'viem';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import type { SafeWalletStatus } from '@/hooks/wallet/useIsSafeWallet';
import type { TransactionConfig, TxCallbacks } from '@/modules/ui/context/transactionContract';
import { L1_USDS } from '../adapters/nativeDeposit/contracts';
import {
  ARBITRUM_DEPOSIT_LOGS,
  ARBITRUM_DEPOSIT_TX,
  BASE_DEPOSIT_LOGS,
  BASE_DEPOSIT_TX
} from '../adapters/nativeDeposit/depositFixtures';
import { depositsInLogs } from '../adapters/nativeDeposit/discovery';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { useBridgeForm } from './useBridgeForm';
import { useBridgeLaunch } from './useBridgeLaunch';

const SENDER = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
const ONE = 10n ** 18n;
const HASH: Hex = `0x${'ab'.repeat(32)}`;

type LegsArgs = {
  enabled: boolean;
  to: string;
  batch?: boolean;
  onCallsSent?: (id: string) => void;
  getCallbacks: () => TxCallbacks;
};

type FakeReceipt = {
  status: 'success' | 'reverted';
  transactionHash: Hex;
  blockNumber: bigint;
  logs: readonly Log[];
};

const mocks = vi.hoisted(() => ({
  account: undefined as string | undefined,
  balance: undefined as bigint | undefined,
  // Pins the Safe status; undefined reads the Safe service.
  safeStatus: undefined as SafeWalletStatus | undefined,
  batchSupported: true,
  shouldUseBatch: [] as boolean[],
  l1: undefined as { getTransactionReceipt: (args: { hash: Hex }) => Promise<FakeReceipt> } | undefined,
  launched: [] as TransactionConfig[],
  onError: vi.fn(),
  onSuccess: vi.fn(),
  refetchAllowance: vi.fn(),
  execute: vi.fn(),
  legs: [] as LegsArgs[]
}));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useConnection: () => ({ isConnected: true, address: mocks.account, connector: { id: 'injected' } }),
  useChainId: () => 1,
  useChains: () => [1, 8453, 10, 42161, 130].map(id => ({ id })),
  usePublicClient: () => mocks.l1,
  // The L1 bridges' isOpen.
  useReadContract: () => ({ status: 'success', data: 1n })
}));
vi.mock('@/hooks', async io => {
  const actual = await io<typeof import('@/hooks')>();
  return {
    ...actual,
    useAppChainId: () => 1,
    useNetworkFee: () => ({ data: undefined }),
    useTokenBalance: () => ({
      data: mocks.balance === undefined ? undefined : { value: mocks.balance },
      isLoading: false
    }),
    useSafeWalletStatus: () => {
      const read = actual.useSafeWalletStatus();
      return mocks.safeStatus ?? read;
    }
  };
});
vi.mock('@/modules/ui/hooks/engineLaunch', () => ({
  useShouldUseBatch: (also: boolean) => {
    mocks.shouldUseBatch.push(also);
    return mocks.batchSupported && also;
  }
}));
// The CCTP form gate has its own suite (useBridgeForm.cctp.test.tsx).
vi.mock('./useCctpGate', () => ({ useCctpGate: () => undefined }));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({ canSwitchChain: true, handleSwitchChain: vi.fn() })
}));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: (config: TransactionConfig) => mocks.launched.push(config),
    updateModalContent: vi.fn(),
    isModalOpen: false,
    txCallbacks: { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: mocks.onSuccess, onError: mocks.onError },
    txStatus: TxStatus.IDLE
  })
}));
vi.mock('@/modules/ui/hooks/useMinimizedSessionLock', () => ({
  useMinimizedSessionLock: () => ({ locked: false, restore: vi.fn() })
}));
vi.mock('@/hooks/ui/useAppChainId', () => ({ useAppChainId: () => 1 }));
vi.mock('../adapters/mockAdapter', () => ({ runMockLegs: () => new Promise<string>(() => undefined) }));
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
vi.mock('./useAddressCode', () => ({ useAddressCode: () => ({ code: 'none', isChecking: false }) }));
vi.mock('./useNativeDepositLegs', () => ({
  nativeDepositFunction: (to: string) =>
    to === 'arbitrum' ? 'outboundTransferCustomRefund' : 'bridgeERC20To',
  useNativeDepositLegs: (args: LegsArgs) => {
    mocks.legs.push(args);
    return {
      calls: [{ to: '0xdeposit' }],
      ready: true,
      needsApprove: true,
      maxFee: undefined,
      error: null,
      execute: mocks.execute,
      isBatch: !!args.batch,
      reset: vi.fn(),
      refetchAllowance: mocks.refetchAllowance
    };
  }
}));
vi.mock('../components/BridgeReviewContent', () => ({
  BridgeReviewContent: () => null,
  BridgeTransferHero: () => null
}));

// No account is a Safe.
const fetchMock = vi.fn(() =>
  Promise.resolve({ status: 404, ok: false, json: () => Promise.resolve({}) } as Response)
);

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
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  return Object.assign(view, { queryClient, invalidate });
}
type View = ReturnType<typeof renderBridge>;

const settle = async () => {
  for (let i = 0; i < 5; i++) await act(() => new Promise(resolve => setTimeout(resolve, 0)));
};

const scopeOf = (account: string) => pendingScopeKey({ account, familyChainId: 1 });
const bundleCards = (account: string) =>
  pendingBridgeStore.getSnapshot(scopeOf(account)).filter(bridge => bridge.bundleId);

/** The recovery reads the hook asked for in `account`'s scope. */
const recoveryReads = (invalidate: MockInstance<QueryClient['invalidateQueries']>, account: string) =>
  invalidate.mock.calls.filter(([filters]) => {
    const key = filters?.queryKey;
    return key?.[0] === 'bridge-deposit-recovery' && key[1] === scopeOf(account);
  });

/** Opens Review for `amount` to `to` and confirms it. */
async function confirm(
  view: View,
  { to, amount, recipient }: { to: string; amount: bigint; recipient?: string }
) {
  if (to !== 'base')
    act(() =>
      view.result.current.form.selectTo(to as Parameters<View['result']['current']['form']['selectTo']>[0])
    );
  act(() => view.result.current.form.onInput(formatUnits(amount, 18)));
  if (recipient) act(() => view.result.current.form.setRecipient(recipient));
  await settle();
  act(() => view.result.current.launch());
  act(() => mocks.launched.at(-1)!.onConfirm!());
  return mocks.legs.at(-1)!;
}

/** The wallet accepts the Confirm's calls as one bundle, with no hash yet. */
function acceptBundle(legs: LegsArgs, callsId?: string) {
  const callbacks = legs.getCallbacks();
  act(() => {
    if (callsId) legs.onCallsSent!(callsId);
    callbacks.onMutate();
    callbacks.onStart(undefined);
  });
  return callbacks;
}

const minedReceipt = (logs: readonly Log[], status: FakeReceipt['status'] = 'success'): FakeReceipt => ({
  status,
  transactionHash: HASH,
  blockNumber: 100n,
  logs
});

/** The deposit a fixture's receipt holds, as discovery reads it. */
function depositIn(logs: readonly Log[], sender: Address) {
  const [found] = depositsInLogs(
    logs.map(log => ({ ...log, transactionHash: HASH, blockNumber: 100n, removed: false }) as Log),
    sender
  );
  return found!;
}

// The fixture's gateway deposit moved sUSDS; the same logs with USDS as its token.
const ARBITRUM_USDS_LOGS = ARBITRUM_DEPOSIT_LOGS.map(log => ({
  ...log,
  data: log.data.replace('a3931d71877c0e7a3148cb7eb4463524fec27fbd', L1_USDS.slice(2).toLowerCase()) as Hex
}));

const ROUTES = [
  { to: 'base', logs: BASE_DEPOSIT_LOGS, sender: BASE_DEPOSIT_TX.from },
  { to: 'arbitrum', logs: ARBITRUM_USDS_LOGS, sender: ARBITRUM_DEPOSIT_TX.from }
] as const;

/** A bundle with the approve only: its USDS Approval and no deposit. */
const approveLog = (owner: string) =>
  ({
    address: L1_USDS,
    topics: encodeEventTopics({
      abi: erc20Abi,
      eventName: 'Approval',
      args: { owner: owner as Address, spender: BASE_DEPOSIT_TX.from }
    }),
    data: encodeAbiParameters([{ type: 'uint256' }], [ONE])
  }) as unknown as Log;

describe('useBridgeLaunch with wallet bundles', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    // Every test starts from an empty store: storage cleared, and the cached lists dropped as another tab's write would.
    localStorage.clear();
    const unsubscribe = pendingBridgeStore.subscribe(() => undefined);
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    unsubscribe();
    Object.assign(mocks, {
      account: SENDER,
      balance: 10n * ONE,
      safeStatus: undefined,
      batchSupported: true,
      shouldUseBatch: [],
      l1: undefined,
      launched: [],
      legs: []
    });
    mocks.onError.mockClear();
    mocks.onSuccess.mockClear();
    mocks.refetchAllowance.mockClear();
    mocks.execute.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockClear();
  });

  describe('only a wallet known not to be a Safe batches', () => {
    it.each([
      ['checking', false],
      ['unknown', false],
      ['safe', false],
      ['not-safe', true]
    ] as const)('a %s wallet batches: %s', async (status, batched) => {
      mocks.safeStatus = status;
      const view = renderBridge();
      act(() => view.result.current.form.onInput('1'));
      await settle();

      expect(mocks.shouldUseBatch.length).toBeGreaterThan(0);
      expect(new Set(mocks.shouldUseBatch)).toEqual(new Set([batched]));
      expect(mocks.legs.at(-1)!.batch).toBe(batched);
    });

    it('a wallet the Safe service does not know batches', async () => {
      const view = renderBridge();
      act(() => view.result.current.form.onInput('1'));
      await settle();

      expect(mocks.shouldUseBatch.at(-1)).toBe(true);
      expect(mocks.legs.at(-1)!.batch).toBe(true);
    });
  });

  describe('a bundle the wallet accepted', () => {
    it('gets one card, with the wallet calls id and no hash', async () => {
      const view = renderBridge();
      const legs = await confirm(view, { to: 'base', amount: ONE });
      acceptBundle(legs, '0xcalls');

      const cards = pendingBridgeStore.getSnapshot(scopeOf(SENDER));
      expect(cards).toHaveLength(1);
      const [card] = cards;
      expect(card!.bundleId).toMatch(/^bundle-/);
      expect(card!.callsId).toBe('0xcalls');
      expect(card!.txHash).toBeUndefined();
      expect(card!.status).toBe('pending');
    });

    it('a later bundle without its own calls id does not reuse the previous one', async () => {
      const view = renderBridge();
      const legs = await confirm(view, { to: 'base', amount: ONE });
      const first = acceptBundle(legs, '0xcalls');
      await act(async () => first.onSuccess(HASH));
      await settle();

      act(() => view.result.current.launch());
      act(() => mocks.launched.at(-1)!.onConfirm!());
      acceptBundle(mocks.legs.at(-1)!);

      const cards = bundleCards(SENDER);
      expect(cards).toHaveLength(2);
      expect(new Set(cards.map(card => card.bundleId)).size).toBe(2);
      expect(cards.filter(card => card.callsId === '0xcalls')).toHaveLength(1);
      expect(cards.filter(card => card.callsId === undefined)).toHaveLength(1);
    });
  });

  describe.each(ROUTES)('a mined bundle to $to whose receipt holds the deposit', ({ to, logs, sender }) => {
    it('gives the card the deposit hash and asks recovery for nothing', async () => {
      const account = getAddress(sender);
      const found = depositIn(logs, account);
      mocks.account = account;
      mocks.balance = found.amount + ONE;
      mocks.l1 = { getTransactionReceipt: vi.fn(async () => minedReceipt(logs)) };
      const view = renderBridge();
      const legs = await confirm(view, {
        to,
        amount: found.amount,
        recipient: found.recipient.toLowerCase() === account.toLowerCase() ? undefined : found.recipient
      });
      const callbacks = acceptBundle(legs, '0xcalls');

      await act(async () => callbacks.onSuccess(HASH));
      await settle();

      const cards = bundleCards(account);
      expect(cards).toHaveLength(1);
      expect(cards[0]!.txHash?.toLowerCase()).toBe(found.txHash.toLowerCase());
      expect(recoveryReads(view.invalidate, account)).toHaveLength(0);
    });
  });

  describe('a mined bundle whose card a scan already gave a hash', () => {
    const base = depositIn(BASE_DEPOSIT_LOGS, BASE_DEPOSIT_TX.from);
    const OTHER_HASH = '0x00000000000000000000000000000000000000000000000000000000000000e1' as Hex;

    it.each([
      { name: "another deposit's hash", hash: OTHER_HASH, reads: 1 },
      { name: 'its own deposit hash', hash: base.txHash, reads: 0 }
    ])('with $name asks recovery for its deposit only when the hashes differ', async ({ hash, reads }) => {
      const account = getAddress(BASE_DEPOSIT_TX.from);
      mocks.account = account;
      mocks.balance = base.amount + ONE;
      mocks.l1 = { getTransactionReceipt: vi.fn(async () => minedReceipt(BASE_DEPOSIT_LOGS)) };
      const view = renderBridge();
      const callbacks = acceptBundle(
        await confirm(view, {
          to: 'base',
          amount: base.amount,
          recipient: base.recipient.toLowerCase() === account.toLowerCase() ? undefined : base.recipient
        }),
        '0xcalls'
      );
      const [card] = bundleCards(account);
      act(() => pendingBridgeStore.resolveBundle(scopeOf(account), card!.id, hash));

      await act(async () => callbacks.onSuccess(HASH));
      await settle();

      expect(recoveryReads(view.invalidate, account)).toHaveLength(reads);
    });
  });

  describe('a mined bundle whose deposit the receipt does not show', () => {
    const base = depositIn(BASE_DEPOSIT_LOGS, BASE_DEPOSIT_TX.from);

    it.each([
      {
        name: 'a receipt with the approve only',
        amount: ONE,
        l1: () => ({ getTransactionReceipt: vi.fn(async () => minedReceipt([approveLog(mocks.account!)])) })
      },
      {
        name: 'a reverted receipt',
        amount: base.amount,
        l1: () => ({ getTransactionReceipt: vi.fn(async () => minedReceipt(BASE_DEPOSIT_LOGS, 'reverted')) })
      },
      {
        name: 'a deposit of another amount',
        amount: base.amount + 1n,
        l1: () => ({ getTransactionReceipt: vi.fn(async () => minedReceipt(BASE_DEPOSIT_LOGS)) })
      },
      {
        name: 'a receipt read that fails',
        amount: ONE,
        l1: () => ({
          getTransactionReceipt: vi.fn(async (): Promise<FakeReceipt> => {
            throw new Error('receipt not found');
          })
        })
      },
      { name: 'no Ethereum client', amount: ONE, l1: () => undefined }
    ])('$name leaves the card without a hash and asks recovery to look', async ({ amount, l1 }) => {
      const account = getAddress(BASE_DEPOSIT_TX.from);
      mocks.account = account;
      mocks.balance = amount + ONE;
      mocks.l1 = l1();
      const view = renderBridge();
      const callbacks = acceptBundle(await confirm(view, { to: 'base', amount }), '0xcalls');

      await act(async () => callbacks.onSuccess(HASH));
      await vi.waitFor(() => expect(recoveryReads(view.invalidate, account)).toHaveLength(1));

      const cards = bundleCards(account);
      expect(cards).toHaveLength(1);
      expect(cards[0]!.txHash).toBeUndefined();
      expect(cards[0]!.status).toBe('pending');
    });
  });

  describe('a bundle that did not go through', () => {
    it('fails its card when the bundle failed, and asks recovery to look', async () => {
      const view = renderBridge();
      const callbacks = acceptBundle(await confirm(view, { to: 'base', amount: ONE }), '0xcalls');

      act(() => callbacks.onError(new Error('ERROR: Batch transaction failed')));

      const cards = bundleCards(SENDER);
      expect(cards).toHaveLength(1);
      expect(cards[0]).toMatchObject({ status: 'failed', failureReason: 'source-tx-reverted' });
      expect(recoveryReads(view.invalidate, SENDER)).toHaveLength(1);
    });

    it('keeps its card pending when the wallet rejected', async () => {
      const view = renderBridge();
      const callbacks = acceptBundle(await confirm(view, { to: 'base', amount: ONE }), '0xcalls');

      act(() => callbacks.onError(new UserRejectedRequestError(new Error('User rejected the request.'))));

      const cards = bundleCards(SENDER);
      expect(cards).toHaveLength(1);
      expect(cards[0]!.status).toBe('pending');
      expect(cards[0]!.failureReason).toBeUndefined();
    });
  });
});
