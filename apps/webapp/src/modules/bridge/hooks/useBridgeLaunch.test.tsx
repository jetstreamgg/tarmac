/**
 * @vitest-environment happy-dom
 */
import { createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import type { TransactionConfig } from '@/modules/ui/context/transactionContract';
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
  updates: [] as Partial<TransactionConfig>[]
}));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useConnection: () => ({
    isConnected: mocks.isConnected,
    address: mocks.isConnected ? SENDER : undefined,
    connector: mocks.isConnected ? { id: 'injected' } : undefined
  }),
  useChainId: () => 1,
  useChains: () => [1, 8453, 10, 42161, 130].map(id => ({ id }))
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useAppChainId: () => 1,
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
    txCallbacks: {},
    txStatus: TxStatus.IDLE
  })
}));
vi.mock('@/modules/ui/hooks/useMinimizedSessionLock', () => ({
  useMinimizedSessionLock: () => ({ locked: false, restore: vi.fn() })
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
      updates: []
    });
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
});
