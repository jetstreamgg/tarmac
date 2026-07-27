import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IdleSupplyInfo, IdleToken } from '../helpers/idleView';

// Pin the JS breakpoint per test (happy-dom's 1024 viewport = table mode).
const breakpoint = vi.hoisted(() => ({ isMobile: false }));
vi.mock('@/hooks/ui/useBreakpoint', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/ui/useBreakpoint')>();
  return {
    ...actual,
    useBreakpointIndex: () => ({ bpi: breakpoint.isMobile ? actual.BP.sm : actual.BP.desktop })
  };
});

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { IdleStablecoinsTable } from './IdleStablecoinsTable';

i18n.load('en', {});
i18n.activate('en');

const TOKENS: IdleToken[] = [
  {
    symbol: 'USDS',
    name: 'USDS Stablecoin',
    amount: 1000,
    amountUsd: 1000,
    color: '#888',
    hoverColor: '#888',
    share: 0.95
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    amount: 50,
    amountUsd: 50,
    color: '#999',
    hoverColor: '#999',
    share: 0.05
  }
];

const SUPPLY_INFO = new Map<string, IdleSupplyInfo>([
  ['USDS', { bestRate: 0.0475, venueCount: 3 }],
  ['USDC', { bestRate: 0.04, venueCount: 1 }]
]);

const renderIdle = (onSupply = vi.fn()) => {
  render(
    <I18nProvider i18n={i18n}>
      <IdleStablecoinsTable tokens={TOKENS} supplyInfo={SUPPLY_INFO} onSupply={onSupply} />
    </I18nProvider>
  );
  return onSupply;
};

describe('IdleStablecoinsTable — desktop table', () => {
  afterEach(cleanup);

  it('renders the table with a row per token', () => {
    renderIdle();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getAllByTestId('idle-row')).toHaveLength(2);
  });
});

describe('IdleStablecoinsTable — mobile cards (M5)', () => {
  beforeEach(() => {
    breakpoint.isMobile = true;
  });
  afterEach(() => {
    breakpoint.isMobile = false;
    cleanup();
  });

  it('renders a card per token with the balance and a Supply CTA', () => {
    renderIdle();

    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getAllByTestId('idle-row')).toHaveLength(2);
    expect(screen.getByText('USDS Stablecoin')).toBeTruthy();
    expect(screen.getAllByText('Balance')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Supply' })).toHaveLength(2);
  });

  it('routes the card Supply CTA through onSupply with the token symbol', () => {
    const onSupply = renderIdle();

    fireEvent.click(screen.getAllByRole('button', { name: 'Supply' })[1]);
    expect(onSupply).toHaveBeenCalledWith('USDC');
  });
});
