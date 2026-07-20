import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EarnRiskTier } from '@/hooks';
import { TooltipProvider } from '@/components/ui/tooltip';
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

i18n.load('en', {});
i18n.activate('en');

const renderCard = (tier: EarnRiskTier) =>
  render(
    <I18nProvider i18n={i18n}>
      <RiskTierDetailsCard tier={tier} />
    </I18nProvider>
  );

describe('RiskTierDetailsCard — per-tier content (1036:201215)', () => {
  afterEach(cleanup);

  it('renders the Conservative profile for the low tier', () => {
    renderCard('low');

    expect(screen.getByText('Risk profile')).toBeTruthy();
    expect(screen.getByText('Conservative')).toBeTruthy();
    expect(screen.getByText(/Funds secured directly by Sky Protocol/)).toBeTruthy();
    expect(screen.getByText('Smart contract')).toBeTruthy();
    expect(screen.getByText('Audited')).toBeTruthy();
    expect(screen.getByText('Liquidation risk')).toBeTruthy();
    expect(screen.getByText('None')).toBeTruthy();
    expect(screen.getByText('Withdrawals')).toBeTruthy();
    expect(screen.getByText('Instant')).toBeTruthy();

    const learnMore = screen.getByRole('link', { name: /Learn more about risk/ });
    expect(learnMore.getAttribute('href')).toBe('https://docs.sky.money');
    expect(learnMore.getAttribute('target')).toBe('_blank');
  });

  it('lights one success segment on the scale for the low tier', () => {
    renderCard('low');

    const segments = screen.getAllByTestId('risk-details-segment');
    expect(segments).toHaveLength(3);
    expect(segments[0].className).toContain('bg-statusSuccessSolid');
    expect(segments[1].className).toContain('bg-bgTertiary');
    expect(segments[2].className).toContain('bg-bgTertiary');
  });

  it('renders the Moderate profile with two warning segments', () => {
    renderCard('moderate');

    expect(screen.getByText('Moderate')).toBeTruthy();
    expect(screen.getByText(/Third-party strategies deployed by Morpho/)).toBeTruthy();
    expect(screen.getByText('Active management')).toBeTruthy();

    const segments = screen.getAllByTestId('risk-details-segment');
    expect(segments[0].className).toContain('bg-statusWarning');
    expect(segments[1].className).toContain('bg-statusWarning');
    expect(segments[2].className).toContain('bg-bgTertiary');
  });

  it('renders the Aggressive profile with three error segments and Yes/Yes facts', () => {
    renderCard('advanced');

    expect(screen.getByText('Aggressive')).toBeTruthy();
    expect(screen.getByText(/For advanced users/)).toBeTruthy();
    expect(screen.getAllByText('Yes')).toHaveLength(2);

    const segments = screen.getAllByTestId('risk-details-segment');
    segments.forEach(segment => expect(segment.className).toContain('bg-error'));
  });
});

const renderTrigger = (tier: EarnRiskTier = 'low') =>
  render(
    <I18nProvider i18n={i18n}>
      <TooltipProvider delayDuration={0}>
        <RiskTierDetailsTrigger tier={tier} />
      </TooltipProvider>
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
    renderTrigger('low');

    expect(screen.queryByText('Conservative')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Risk profile' }));
    expect(screen.getByText('Conservative')).toBeTruthy();
    expect(screen.getByText('Withdrawals')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Learn more about risk/ }).getAttribute('href')).toBe(
      'https://docs.sky.money'
    );

    fireEvent.click(screen.getByRole('button', { name: /Close/ }));
    expect(screen.queryByText('Conservative')).toBeNull();
  });
});

describe('RiskTierDetailsTrigger — desktop tooltip (1036:201215)', () => {
  afterEach(cleanup);

  it('renders a focusable pill trigger with the details hidden until opened', () => {
    renderTrigger('moderate');

    const trigger = screen.getByRole('button', { name: 'Risk profile' });
    expect(trigger).toBeTruthy();
    expect(screen.queryByText(/Third-party strategies/)).toBeNull();

    // Radix opens the tooltip on keyboard-visible focus.
    fireEvent.keyDown(document.body, { key: 'Tab' });
    fireEvent.focus(trigger);
    expect(screen.getAllByText(/Third-party strategies/).length).toBeGreaterThan(0);
  });
});
