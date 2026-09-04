import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { MorphoVaultRateData } from '@/hooks';
import { VaultRateBreakdown } from './VaultRateBreakdown';

i18n.load('en', {});
i18n.activate('en');

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

const baseRate: MorphoVaultRateData = {
  address: '0x1',
  rate: 0.045,
  netRate: 0.045,
  managementFee: 0,
  performanceFee: 0,
  formattedRate: '4.50%',
  formattedNetRate: '4.50%',
  formattedManagementFee: '0%',
  formattedPerformanceFee: '0%',
  rewards: []
};

const boostedRate: MorphoVaultRateData = {
  ...baseRate,
  rate: 0.0074,
  netRate: 0.0482,
  formattedRate: '0.74%',
  formattedNetRate: '4.82%',
  rewards: [{ apy: 0.0409, formattedApy: '+4.09%', symbol: 'USDS', logoUri: null }]
};

const renderRow = (rate?: MorphoVaultRateData) =>
  render(
    <I18nProvider i18n={i18n}>
      <TooltipProvider delayDuration={0}>
        <VaultRateBreakdown rate={rate} value={rate?.formattedNetRate ?? '–'} />
      </TooltipProvider>
    </I18nProvider>
  );

// Radix opens a tooltip on a mouse pointer moving over the trigger, after
// its (zeroed) open delay — a timer, hence the flush.
const hoverTrigger = async () => {
  const trigger = screen.getByTestId('vault-rate-breakdown');
  fireEvent.pointerMove(trigger, { pointerType: 'mouse' });
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
  });
  return trigger;
};

/**
 * The Details-row rate (Design QA on the vault page: hoverable on every
 * vault, mark beside the value — APP-550). The Risk Capital vaults carry no
 * reward incentives, and used to render the mark without the tooltip wrapper,
 * as a second flex child that wrapped under the figure.
 */
describe('VaultRateBreakdown', () => {
  afterEach(cleanup);

  it('keeps the figure and the mark in one inline box and breaks a plain rate down on hover', async () => {
    renderRow(baseRate);
    const trigger = await hoverTrigger();

    expect(trigger.className).toContain('inline-flex');
    expect(trigger.textContent).toBe('4.50%');
    expect(trigger.querySelector('svg')).not.toBeNull();

    // Net over native, and nothing else — no incentive rows to list.
    expect(screen.getAllByText('Net Rate').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Native Rate').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Rewards$/)).toBeNull();
  });

  it('lists each reward incentive under the native rate on a boosted vault', async () => {
    renderRow(boostedRate);
    await hoverTrigger();

    expect(screen.getAllByText('4.82%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0.74%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('USDS Rewards').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+4.09%').length).toBeGreaterThan(0);
  });

  it('shows the bare placeholder — no mark, no tooltip — while the rate is unresolved', () => {
    renderRow(undefined);

    expect(screen.queryByTestId('vault-rate-breakdown')).toBeNull();
    expect(screen.getByText('–').querySelector('svg')).toBeNull();
  });
});
