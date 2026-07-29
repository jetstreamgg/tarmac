import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nWidgetProvider } from '@/widgets/context/I18nWidgetProvider';
import { BATCH_TX_LEGAL_NOTICE_URL } from '@/lib/constants';
import { BatchTransactionsToggle } from './BatchTransactionsToggle';

const mocks = vi.hoisted(() => ({
  batchEnabled: false,
  setBatchEnabled: vi.fn(),
  isConnected: false,
  batchSupported: true as boolean | undefined
}));

vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({
  useBatchToggle: () => [mocks.batchEnabled, mocks.setBatchEnabled] as const
}));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return { ...actual, useIsBatchSupported: () => ({ data: mocks.batchSupported }) };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useConnection: () => ({ isConnected: mocks.isConnected }) };
});

function renderToggle() {
  render(
    <I18nWidgetProvider locale="en">
      <BatchTransactionsToggle />
    </I18nWidgetProvider>
  );
}

beforeEach(() => {
  mocks.batchEnabled = false;
  mocks.isConnected = false;
  mocks.batchSupported = true;
  mocks.setBatchEnabled.mockClear();
});

describe('BatchTransactionsToggle', () => {
  it('renders the row with the explainer and the Legal Notice link', async () => {
    renderToggle();
    expect(await screen.findByText('Bundle transactions')).toBeTruthy();
    expect(screen.getByText(/Save on gas and skip extra confirmations/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Legal Notice/ }).getAttribute('href')).toBe(
      BATCH_TX_LEGAL_NOTICE_URL
    );
  });

  it('turns bundling on through the switch', async () => {
    renderToggle();
    fireEvent.click(await screen.findByRole('switch'));
    expect(mocks.setBatchEnabled).toHaveBeenCalledWith(true);
  });

  it('reflects an enabled setting on the switch', async () => {
    mocks.batchEnabled = true;
    renderToggle();
    expect((await screen.findByRole('switch')).getAttribute('aria-checked')).toBe('true');
  });

  it('disables the switch and swaps in the unsupported notice for connected wallets without support', async () => {
    mocks.isConnected = true;
    mocks.batchSupported = false;
    renderToggle();
    expect((await screen.findByRole('switch')).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/does not currently support bundled transactions/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /View supporting wallets/ })).toBeTruthy();
    expect(screen.queryByText(/Save on gas/)).toBeNull();
  });
});
