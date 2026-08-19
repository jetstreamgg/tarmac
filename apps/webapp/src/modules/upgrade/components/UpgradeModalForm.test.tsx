import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;

const h = vi.hoisted(() => ({
  execute: vi.fn(),
  update: vi.fn(),
  isBatch: false,
  isModalOpen: true,
  isMinimized: false,
  // MKR→SKY governance fee read: undefined = unresolved (in flight, or failed
  // when the error is set).
  mkrSkyFee: 0n as bigint | undefined,
  mkrSkyFeeError: null as Error | null
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useChains: () => [{ id: 1, name: 'Ethereum' }],
    useConnection: () => ({ address: TEST_ADDRESS, isConnected: true, isConnecting: false })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    // Identity debounce: the analytics blob reads the debounced amount, and these
    // tests assert synchronously after typing.
    useDebounce: <T,>(value: T) => value,
    useTokenBalance: () => ({ data: { value: 100n * 10n ** 18n }, refetch: vi.fn() }),
    useMkrSkyFee: () => ({ data: h.mkrSkyFee, error: h.mkrSkyFeeError }),
    useNetworkFee: () => ({ data: undefined, isLoading: false, error: null }),
    useIsBatchSupported: () => ({ data: false })
  };
});

// The engine seam — stubbed so the form mounts without real wagmi writes.
vi.mock('../hooks/useUpgradeLaunch', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks/useUpgradeLaunch')>();
  return {
    ...actual,
    useUpgradeLaunch: () => ({
      execute: h.execute,
      steps: ['Upgrade'],
      prepared: true,
      isLoading: false,
      error: null,
      calls: [],
      isBatch: h.isBatch
    })
  };
});

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    updateModalContent: h.update,
    txStatus: 'idle',
    isModalOpen: h.isModalOpen,
    isMinimized: h.isMinimized
  }),
  useEntrySlot: () => null
}));

vi.mock('@/modules/ui/context/ConnectModalContext', () => ({
  useConnectModal: () => ({ openConnectModal: vi.fn() })
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { UpgradeModalForm } from './UpgradeModalForm';
import { stampDestination } from '@/modules/analytics/lib/destination';
import { TOKENS } from '@/hooks';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { UpgradeSourceToken } from '@/hooks';

const formTree = (initialToken?: UpgradeSourceToken) => (
  <I18nProvider i18n={i18n}>
    <TooltipProvider>
      <UpgradeModalForm sessionId="s1" initialToken={initialToken} />
    </TooltipProvider>
  </I18nProvider>
);

const renderForm = (initialToken?: UpgradeSourceToken) => render(formTree(initialToken));

// The last analytics blob live-merged to the modal (what the provider will emit from).
const lastAnalytics = () => {
  const withAnalytics = h.update.mock.calls.filter(([, patch]) => patch?.analytics !== undefined);
  return withAnalytics.at(-1)?.[1].analytics;
};

// The last entry.confirmDisabled pushed to the modal.
const lastDisabled = () => {
  const withEntry = h.update.mock.calls.filter(([, patch]) => patch?.entry?.confirmDisabled !== undefined);
  return withEntry.at(-1)?.[1].entry.confirmDisabled;
};

describe('UpgradeModalForm — MKR→SKY fee read states (APP-491)', () => {
  beforeEach(() => {
    h.isBatch = false;
    h.execute.mockClear();
    h.update.mockClear();
    h.isModalOpen = true;
    h.isMinimized = false;
    h.mkrSkyFee = 0n;
    h.mkrSkyFeeError = null;
  });
  afterEach(() => cleanup());

  it('holds the Penalty and You’ll receive cells behind skeletons while the fee is in flight', () => {
    h.mkrSkyFee = undefined;
    renderForm('MKR');
    fireEvent.change(screen.getByTestId('upgrade-modal-amount-input'), { target: { value: '2' } });

    expect(screen.getAllByTestId('cell-loading').length).toBe(2);
    expect(lastDisabled()).toBe(true);
  });

  it('settles a failed fee read on "Unavailable" cells and keeps the confirm disabled', () => {
    h.mkrSkyFee = undefined;
    h.mkrSkyFeeError = new Error('read failed');
    renderForm('MKR');
    fireEvent.change(screen.getByTestId('upgrade-modal-amount-input'), { target: { value: '2' } });

    expect(screen.queryAllByTestId('cell-loading').length).toBe(0);
    expect(screen.getByTestId('upgrade-modal-row-Penalty').textContent).toContain('Unavailable');
    expect(screen.getByTestId("upgrade-modal-row-You'll receive").textContent).toContain('Unavailable');
    expect(lastDisabled()).toBe(true);
  });

  it('never blocks a DAI upgrade on the MKR fee read', () => {
    h.mkrSkyFee = undefined;
    h.mkrSkyFeeError = new Error('read failed');
    renderForm('DAI');
    fireEvent.change(screen.getByTestId('upgrade-modal-amount-input'), { target: { value: '10' } });

    expect(screen.queryAllByTestId('cell-loading').length).toBe(0);
    expect(lastDisabled()).toBe(false);
  });
});

describe('UpgradeModalForm — analytics parity blob (APP-444 B6)', () => {
  beforeEach(() => {
    h.isBatch = false;
    h.execute.mockClear();
    h.update.mockClear();
    h.isModalOpen = true;
    h.isMinimized = false;
    h.mkrSkyFee = 0n;
    h.mkrSkyFeeError = null;
  });
  afterEach(() => cleanup());

  it('pushes the legacy UpgradeWidget blob under widget_name convert: DAI→USDS', () => {
    renderForm('DAI');
    fireEvent.change(screen.getByTestId('upgrade-modal-amount-input'), { target: { value: '10' } });
    expect(lastAnalytics()).toEqual({
      widgetName: 'convert',
      flow: 'upgrade',
      action: 'upgrade',
      data: {
        module: 'upgrade',
        assetAddress: TOKENS.dai.address[1],
        assetSymbol: 'DAI',
        targetSymbol: 'USDS',
        targetAddress: TOKENS.usds.address[1],
        isBatchTx: false,
        amount: 10
      }
    });
  });

  it('tracks the MKR→SKY pair with its own addresses and a positive amount', () => {
    renderForm('MKR');
    fireEvent.change(screen.getByTestId('upgrade-modal-amount-input'), { target: { value: '2' } });
    const analytics = lastAnalytics();
    expect(analytics.data).toMatchObject({
      assetAddress: TOKENS.mkr.address[1],
      assetSymbol: 'MKR',
      targetSymbol: 'SKY',
      targetAddress: TOKENS.sky.address[1],
      amount: 2
    });
  });

  it('stamps destination upgrade only while the modal is visible (D2: URL-less surface override)', () => {
    const probe = () =>
      stampDestination({ event: 'x', properties: {} } as unknown as Parameters<typeof stampDestination>[0])
        ?.properties?.destination;
    const view = renderForm('DAI');
    expect(probe()).toBe('upgrade');
    // Minimized: this body stays mounted (hidden host) but the stamp must yield.
    h.isMinimized = true;
    view.rerender(formTree('DAI'));
    expect(probe()).not.toBe('upgrade');
    // Restored: the override comes back.
    h.isMinimized = false;
    view.rerender(formTree('DAI'));
    expect(probe()).toBe('upgrade');
    // Settled-while-minimized end state: host still mounted, modal closed.
    h.isModalOpen = false;
    view.rerender(formTree('DAI'));
    expect(probe()).not.toBe('upgrade');
    view.unmount();
    expect(probe()).not.toBe('upgrade');
  });
});
