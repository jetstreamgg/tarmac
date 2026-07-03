/// <reference types="vite/client" />

import { act, useEffect, type ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendleMarketConfig } from '@/hooks';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
i18n.load('en', {});
i18n.activate('en');

const MARKET: PendleMarketConfig = {
  name: 'PT-USDG',
  slug: 'pt-usdg',
  marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33',
  ptToken: '0x9db38d74a0d29380899ad354121dfb521adb0548',
  ytToken: '0x4a1294749a70bc32a998b49dd11bf26e9379e3c1',
  syToken: '0xc1799cab1f201946f7cfafbaf1bcc089b2f08927',
  underlyingToken: '0xe343167631d89b6ffc58b88d6b7fb0228795491d',
  underlyingSymbol: 'USDG',
  underlyingDecimals: 6,
  expiry: 1795651200
};

const hoisted = vi.hoisted(() => ({ launchMock: vi.fn() }));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: hoisted.launchMock,
    updateModalContent: () => undefined,
    isModalOpen: false,
    txCallbacks: {
      onMutate: () => undefined,
      onStart: () => undefined,
      onSuccess: () => undefined,
      onError: () => undefined
    },
    txStatus: 'idle'
  })
}));

vi.mock('../../components/PendleModalForm', () => ({
  PendleModalForm: ({ flow }: { flow: string }) => <div data-flow={flow} />
}));

import { usePendleModal } from '../usePendleModal';

function renderComponent(ui: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
  });
  return {
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  };
}

const TestConsumer = ({ flow }: { flow: 'supply' | 'withdraw' }) => {
  const { openSupply, openWithdraw } = usePendleModal();
  useEffect(() => {
    if (flow === 'supply') openSupply(MARKET);
    else openWithdraw(MARKET);
  }, [flow, openSupply, openWithdraw]);
  return null;
};

describe('usePendleModal', () => {
  beforeEach(() => {
    hoisted.launchMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('launches the editable supply modal for the market', () => {
    const { unmount } = renderComponent(<TestConsumer flow="supply" />);

    expect(hoisted.launchMock).toHaveBeenCalledTimes(1);
    const config = hoisted.launchMock.mock.calls[0][0];
    expect(config.title).toContain('PT-USDG');
    expect(config.sessionId).toBeTruthy();
    expect(config.entry.confirmDisabled).toBe(true);
    expect(config.backgroundContent).toBeTruthy();
    unmount();
  });

  it('launches the editable withdraw modal for the market', () => {
    const { unmount } = renderComponent(<TestConsumer flow="withdraw" />);

    const config = hoisted.launchMock.mock.calls[0][0];
    expect(config.title).toContain('PT-USDG');
    expect(config.entry.confirmDisabled).toBe(true);
    expect(config.backgroundContent).toBeTruthy();
    unmount();
  });

  it('uses distinct sessions for supply and withdraw', () => {
    const Both = () => {
      const { openSupply, openWithdraw } = usePendleModal();
      useEffect(() => {
        openSupply(MARKET);
        openWithdraw(MARKET);
      }, [openSupply, openWithdraw]);
      return null;
    };
    const { unmount } = renderComponent(<Both />);

    const [supplyConfig, withdrawConfig] = hoisted.launchMock.mock.calls.map(call => call[0]);
    expect(supplyConfig.sessionId).not.toBe(withdrawConfig.sessionId);
    unmount();
  });

  it('leaves launch analytics unset — flow events fire from the form for legacy parity', () => {
    const { unmount } = renderComponent(<TestConsumer flow="supply" />);

    const config = hoisted.launchMock.mock.calls[0][0];
    expect(config.analytics).toBeUndefined();
    unmount();
  });
});
