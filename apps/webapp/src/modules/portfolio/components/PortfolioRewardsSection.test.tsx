import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClaimableReward } from '@/modules/claim';

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

import { PortfolioRewardsSection } from './PortfolioRewardsSection';

i18n.load('en', {});
i18n.activate('en');

const reward = (id: string, symbol: string, name: string): ClaimableReward => ({
  id,
  source: 'sky-rewards',
  tokenSymbol: symbol,
  tokenName: name,
  icon: null,
  formattedAmount: '18.78',
  amount: 18.78,
  amountUsd: 20.78,
  chainId: 1
});

const SPK = reward('0xa', 'SPK', 'Spark token');
const GROVE = reward('0xb', 'GROVE', 'Grove token');

function renderSection({
  rewards,
  isLoading = false,
  onClaim = vi.fn(),
  onClaimAll = vi.fn()
}: {
  rewards: ClaimableReward[];
  isLoading?: boolean;
  onClaim?: (reward: ClaimableReward) => void;
  onClaimAll?: () => void;
}) {
  render(
    <I18nProvider i18n={i18n}>
      <PortfolioRewardsSection
        title="Ecosystem rewards"
        rewards={rewards}
        isLoading={isLoading}
        onClaim={onClaim}
        onClaimAll={onClaimAll}
        testId="eco"
      />
    </I18nProvider>
  );
  return { onClaim, onClaimAll };
}

describe('PortfolioRewardsSection', () => {
  afterEach(cleanup);

  it('renders the skeleton while the read is in flight', () => {
    renderSection({ rewards: [], isLoading: true });
    expect(screen.getByTestId('eco-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('eco')).toBeNull();
  });

  it('renders nothing once settled with no rewards', () => {
    renderSection({ rewards: [] });
    expect(screen.queryByTestId('eco')).toBeNull();
    expect(screen.queryByTestId('eco-skeleton')).toBeNull();
  });

  it('hides Claim all and promotes the row CTA to primary for a single reward', () => {
    const { onClaim } = renderSection({ rewards: [SPK] });

    expect(screen.queryByTestId('eco-claim-all')).toBeNull();
    const claim = screen.getByTestId('reward-claim-button');
    // The DS primary recipe is a gradient pill; secondary is the glass one.
    expect(claim.className).toContain('from-button-gradient-start');

    fireEvent.click(claim);
    expect(onClaim).toHaveBeenCalledWith(SPK);
  });

  it('shows Claim all and steps the row CTAs down to secondary for several rewards', () => {
    const { onClaimAll } = renderSection({ rewards: [SPK, GROVE] });

    const claimAll = screen.getByTestId('eco-claim-all');
    expect(claimAll.className).toContain('from-button-gradient-start');

    const rows = screen.getAllByTestId('reward-claim-button');
    expect(rows).toHaveLength(2);
    rows.forEach(row => expect(row.className).toContain('to-white/8'));

    fireEvent.click(claimAll);
    expect(onClaimAll).toHaveBeenCalled();
  });

  it('lists the token symbol, name and both amounts per row', () => {
    renderSection({ rewards: [SPK] });

    expect(screen.getByText('SPK')).toBeTruthy();
    expect(screen.getByText('Spark token')).toBeTruthy();
    expect(screen.getByText('18.78')).toBeTruthy();
    expect(screen.getByText('$20.78')).toBeTruthy();
  });

  it('falls back to transaction cards below the md tier', () => {
    breakpoint.isMobile = true;
    renderSection({ rewards: [SPK, GROVE] });

    expect(screen.getAllByTestId('reward-row')).toHaveLength(2);
    expect(screen.getAllByTestId('reward-claim-button')).toHaveLength(2);
    breakpoint.isMobile = false;
  });
});
