import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EarnRiskProfileId, EarnRiskTier } from '@/hooks';
import { RiskTierDetailsCard, RiskTierDetailsTrigger } from './RiskTierDetails';

// Pin the JS breakpoint per test (happy-dom's 1024 viewport = desktop).
const breakpoint = vi.hoisted(() => ({ isMobile: false }));
vi.mock('@/hooks/ui/useBreakpoint', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/ui/useBreakpoint')>();
  return {
    ...actual,
    useBreakpointIndex: () => ({ bpi: breakpoint.isMobile ? actual.BP.sm : actual.BP.desktop })
  };
});

// TokenIcon reaches for wagmi config (chain badges); the exposure stack only
// needs the wrapper spans, so stub the icon itself.
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

i18n.load('en', {});
i18n.activate('en');

const renderCard = (tier: EarnRiskTier, profile: EarnRiskProfileId) =>
  render(
    <I18nProvider i18n={i18n}>
      <RiskTierDetailsCard tier={tier} profile={profile} />
    </I18nProvider>
  );

describe('RiskTierDetailsCard — tier presentation + per-profile copy (APP-396 risk sheet)', () => {
  afterEach(cleanup);

  it('renders the Core profile with the savings sheet copy and facts', () => {
    renderCard('low', 'savings');

    expect(screen.getByText('Risk profile')).toBeTruthy();
    expect(screen.getByText('Core')).toBeTruthy();
    expect(screen.getByText(/Funds secured by Sky Protocol/)).toBeTruthy();
    expect(screen.getByText('Exposure')).toBeTruthy();
    expect(screen.getByTestId('risk-details-exposure').getAttribute('title')).toBe('USDS');
    expect(screen.getByText('Liquidation risk')).toBeTruthy();
    expect(screen.getByText('None')).toBeTruthy();
    expect(screen.getByText('Withdrawals')).toBeTruthy();
    expect(screen.getByText('Instant')).toBeTruthy();

    const learnMore = screen.getByRole('link', { name: /Learn more about risk/ });
    expect(learnMore.getAttribute('href')).toBe('https://docs.sky.money/user-risks');
    expect(learnMore.getAttribute('target')).toBe('_blank');
  });

  it('lights one risk-low segment on the scale for the low tier', () => {
    renderCard('low', 'savings');

    const segments = screen.getAllByTestId('risk-details-segment');
    expect(segments).toHaveLength(3);
    expect(segments[0].className).toContain('bg-riskLow');
    expect(segments[1].className).toContain('bg-fgQuaternary');
    expect(segments[2].className).toContain('bg-fgQuaternary');
  });

  it('renders the Flagship vault profile with its multi-asset exposure, with two risk-medium segments', () => {
    renderCard('moderate', 'vault-flagship');

    expect(screen.getByText('Medium')).toBeTruthy();
    expect(screen.getByText(/conservative allocation and around 80% of liquidity/)).toBeTruthy();
    expect(screen.getByTestId('risk-details-exposure').getAttribute('title')).toBe(
      'cbBTC, wstETH, WETH, PT-sUSDS'
    );
    expect(screen.getByText('Liquidity based')).toBeTruthy();

    const segments = screen.getAllByTestId('risk-details-segment');
    expect(segments[0].className).toContain('bg-riskMedium');
    expect(segments[1].className).toContain('bg-riskMedium');
    expect(segments[2].className).toContain('bg-fgQuaternary');
  });

  it('renders the Risk Capital vault profile as Advanced — same provider, different assessment', () => {
    renderCard('advanced', 'vault-risk-capital');

    expect(screen.getByText('Advanced')).toBeTruthy();
    expect(screen.getByText(/single exposure to stUSDS collateral/)).toBeTruthy();
    expect(screen.getByTestId('risk-details-exposure').getAttribute('title')).toBe('stUSDS, SKY');
  });

  it('renders Pendle copy for moderate fixed-yield with the market-sell withdrawal fact', () => {
    renderCard('moderate', 'fixed');

    expect(screen.getByText('Medium')).toBeTruthy();
    expect(screen.getByText(/powered by Pendle/)).toBeTruthy();
    expect(screen.queryByText(/Morpho/)).toBeNull();
    expect(screen.getByText('At maturity or via market sell')).toBeTruthy();
  });

  it('names the reward per farm: SPK farm promises SPK tokens, Chronicle promises points', () => {
    renderCard('low', 'rewards-spk');
    expect(screen.getByText(/earn SPK tokens/)).toBeTruthy();
    expect(screen.getByText('Instant')).toBeTruthy();
    cleanup();

    renderCard('low', 'rewards-cle');
    expect(screen.getByText(/earn Chronicle Points/)).toBeTruthy();
    expect(screen.queryByText(/tokens/)).toBeNull();
  });

  it('renders the Advanced stUSDS profile with SKY exposure and three risk-high segments', () => {
    renderCard('advanced', 'stusds');

    expect(screen.getByText('Advanced')).toBeTruthy();
    expect(screen.getByText(/SKY token-collateralized loans/)).toBeTruthy();
    expect(screen.getByTestId('risk-details-exposure').getAttribute('title')).toBe('SKY');
    expect(screen.getByText('Liquidity based')).toBeTruthy();

    const segments = screen.getAllByTestId('risk-details-segment');
    segments.forEach(segment => expect(segment.className).toContain('bg-riskHigh'));
  });
});

const renderTrigger = (profile: EarnRiskProfileId = 'savings') =>
  render(
    <I18nProvider i18n={i18n}>
      <RiskTierDetailsTrigger profile={profile} />
    </I18nProvider>
  );

describe('RiskTierDetailsTrigger — mobile bottom panel (486:21797)', () => {
  beforeEach(() => {
    breakpoint.isMobile = true;
  });
  afterEach(() => {
    breakpoint.isMobile = false;
    cleanup();
  });

  it('opens the details sheet from the pill and dismisses via the close button', () => {
    renderTrigger('savings');

    expect(screen.queryByText('Core')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Risk profile' }));
    expect(screen.getByText('Core')).toBeTruthy();
    expect(screen.getByText('Withdrawals')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Learn more about risk/ }).getAttribute('href')).toBe(
      'https://docs.sky.money/user-risks'
    );

    fireEvent.click(screen.getByRole('button', { name: /Close/ }));
    expect(screen.queryByText('Core')).toBeNull();
  });

  it('reveals the exposure token names on tap — the sheet has no hover for the native title', () => {
    renderTrigger('vault-flagship');

    fireEvent.click(screen.getByRole('button', { name: 'Risk profile' }));
    expect(screen.queryByText('cbBTC, wstETH, WETH, PT-sUSDS')).toBeNull();

    fireEvent.click(screen.getByTestId('risk-details-exposure'));
    expect(screen.getByText('cbBTC, wstETH, WETH, PT-sUSDS')).toBeTruthy();
  });
});

describe('RiskTierDetailsTrigger — desktop tooltip (1036:201215)', () => {
  afterEach(cleanup);

  it('resolves the tier from the profile registry and opens the details on focus', () => {
    renderTrigger('vault-flagship');

    const trigger = screen.getByRole('button', { name: 'Risk profile' });
    expect(trigger).toBeTruthy();
    expect(screen.queryByText(/conservative allocation/)).toBeNull();

    // Radix opens the tooltip on keyboard-visible focus.
    fireEvent.keyDown(document.body, { key: 'Tab' });
    fireEvent.focus(trigger);
    expect(screen.getAllByText(/conservative allocation/).length).toBeGreaterThan(0);
    // 'vault-flagship' is Medium per the sheet — the trigger derived it itself.
    expect(screen.getAllByText('Medium').length).toBeGreaterThan(0);
  });
});
