import { type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncOrderConfig, AsyncOrderStatus } from '../transactionContract';

// Render the real TransactionModal: stub only its chain/Safe/batch reads.
vi.mock('wagmi', async io => ({ ...(await io<typeof import('wagmi')>()), useChainId: () => 1 }));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useIsSafeWallet: () => false,
  useIsBatchSupported: () => ({ data: false })
}));
vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({ useBatchToggle: () => [false, () => {}] }));

// Render motion elements synchronously so AnimatePresence step transitions are deterministic.
vi.mock('motion/react', async io => {
  const actual = await io<typeof import('motion/react')>();
  const React = await import('react');
  const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition', 'variants', 'layout']);
  const strip = (props: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(props).filter(([key]) => !MOTION_PROPS.has(key)));
  const tag =
    (element: string) =>
    ({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) =>
      React.createElement(element, strip(rest), children);
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    motion: new Proxy({}, { get: (_t, element) => tag(element as string) })
  };
});

import { AsyncOrderModalHarness } from './asyncOrderModalHarness';

i18n.load('en', {});
i18n.activate('en');

// A poller that walks the given statuses, holding on the last one.
function makeOrder(statuses: AsyncOrderStatus[]) {
  let i = 0;
  return {
    supportedChainIds: [1],
    submitOrder: vi.fn(() => Promise.resolve('0xORDERUID')),
    pollOrderStatus: vi.fn(() => Promise.resolve(statuses[Math.min(i++, statuses.length - 1)]))
  };
}

function renderHarness(config: AsyncOrderConfig) {
  render(
    <I18nProvider i18n={i18n}>
      <AsyncOrderModalHarness config={config} />
    </I18nProvider>
  );
}

const button = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement;

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('AsyncOrderModalHarness (A3 spike)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders the order-pending lifecycle through to fulfilled', async () => {
    const order = makeOrder(['open', 'fulfilled']);
    const onSuccess = vi.fn();
    renderHarness({
      kind: 'async-order',
      title: 'Swap USDC for USDS',
      ...order,
      onSuccess,
      orderExplorerUrl: id => `https://explorer.cow.fi/orders/${id}`,
      pollIntervalMs: 1000
    });

    // Review → confirm signs + posts the order, then polling begins (pending).
    // The CTA is gone on this screen now — the status chip (with its hopping
    // dots) is the only in-flight indicator, so assert on its text instead.
    fireEvent.click(button(/confirm/i));
    await flush();
    expect(screen.getByText(/processing/i)).toBeDefined();

    // Next poll resolves fulfilled → success terminal.
    await flush(1000);
    button(/done/i);
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(order.submitOrder).toHaveBeenCalledOnce();
  });

  it('surfaces cancelled as a terminal state', async () => {
    const order = makeOrder(['open', 'cancelled']);
    renderHarness({ kind: 'async-order', title: 'Swap', ...order, pollIntervalMs: 1000 });

    fireEvent.click(button(/confirm/i));
    await flush();
    await flush(1000);
    button(/done/i); // cancelled shares the Done terminal control
  });

  it('retry re-polls the existing order instead of re-signing', async () => {
    const order = makeOrder(['open', 'expired', 'fulfilled']);
    const onError = vi.fn();
    renderHarness({ kind: 'async-order', title: 'Swap', ...order, onError, pollIntervalMs: 1000 });

    fireEvent.click(button(/confirm/i));
    await flush();
    await flush(1000); // expired → error
    expect(onError).toHaveBeenCalledOnce();

    fireEvent.click(button(/retry/i));
    await flush(); // re-polls the same order → fulfilled
    button(/done/i);
    expect(order.submitOrder).toHaveBeenCalledOnce(); // never re-signed
  });
});
