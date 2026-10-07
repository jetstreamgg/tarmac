/**
 * @vitest-environment happy-dom
 */
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
import { useBridgeLaunch } from './useBridgeLaunch';

const SENDER = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
const OWNER = '0x2546BcD3c84621e976D8185a91A922aE77ECEc30';
const ONE = 10n ** 18n;

// A Safe service reply per host: an HTTP status, or 'hang' for a request that never returns.
type SafeReply = number | 'hang';

const mocks = vi.hoisted(() => ({
  isConnected: true,
  balance: undefined as bigint | undefined,
  balanceLoading: false,
  safe: {} as Record<string, SafeReply>,
  isModalOpen: false,
  launched: [] as TransactionConfig[],
  updates: [] as Partial<TransactionConfig>[],
  onError: vi.fn(),
  appChainId: 1,
  legs: [] as { names: string[]; getCallbacks: () => TxCallbacks }[]
}));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useConnection: () => ({
    isConnected: mocks.isConnected,
    address: mocks.isConnected ? SENDER : undefined,
    connector: mocks.isConnected ? { id: 'injected' } : undefined
  }),
  useChainId: () => mocks.appChainId,
  useChains: () => [1, 8453, 10, 42161, 130].map(id => ({ id }))
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useAppChainId: () => mocks.appChainId,
  useTokenBalance: () => ({
    data: mocks.balance === undefined ? undefined : { value: mocks.balance },
    isLoading: mocks.balanceLoading
  })
}));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({ canSwitchChain: true, handleSwitchChain: vi.fn() })
}));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: (config: TransactionConfig) => mocks.launched.push(config),
    updateModalContent: (_id: string, patch: Partial<TransactionConfig>) => mocks.updates.push(patch),
    isModalOpen: mocks.isModalOpen,
    txCallbacks: { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: mocks.onError },
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
  return renderHook(
    () => {
      const form = useBridgeForm();
      return { form, ...useBridgeLaunch(form) };
    },
    { wrapper }
  );
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
      safe: {},
      isModalOpen: false,
      launched: [],
      updates: [],
      appChainId: 1,
      legs: []
    });
    mocks.onError.mockClear();
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
    expect(mocks.legs).toHaveLength(0);
    expect(mocks.onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('Retry after the send was broadcast runs nothing again and stores one bridge', async () => {
    const view = renderBridge();
    act(() => view.result.current.form.onInput('1'));
    await settle();
    act(() => view.result.current.launch());
    act(() => mocks.launched.at(-1)!.onConfirm!());
    const callbacks = mocks.legs[0].getCallbacks();
    callbacks.onMutate({ functionName: 'approve' });
    callbacks.onStart('0xapprove');
    callbacks.onMutate({ functionName: 'send' });
    callbacks.onStart('0xsend');
    callbacks.onError(new Error('rpc timeout'), '0xsend');

    // TransactionContext.handleRetry calls onConfirm when the flow has no onRetry.
    act(() => mocks.launched.at(-1)!.onConfirm!());
    expect(mocks.legs).toHaveLength(1);
    expect(mocks.onError).toHaveBeenCalledTimes(2);
    const scope = pendingScopeKey({ account: SENDER, familyChainId: 1 });
    expect(pendingBridgeStore.getSnapshot(scope).filter(bridge => bridge.amount === ONE)).toHaveLength(1);
  });

  it('Retry after a rejected approve runs the legs again', async () => {
    const view = renderBridge();
    act(() => view.result.current.form.onInput('1'));
    await settle();
    act(() => view.result.current.launch());
    act(() => mocks.launched.at(-1)!.onConfirm!());
    const callbacks = mocks.legs[0].getCallbacks();
    callbacks.onMutate({ functionName: 'approve' });
    callbacks.onError(new Error('User rejected the request.'));

    act(() => mocks.launched.at(-1)!.onConfirm!());
    expect(mocks.legs).toHaveLength(2);
  });
});
