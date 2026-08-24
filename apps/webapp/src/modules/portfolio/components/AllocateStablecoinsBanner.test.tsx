import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AllocateStablecoinsBanner } from './AllocateStablecoinsBanner';

i18n.load('en', {});
i18n.activate('en');

const renderBanner = (idleUsd: number | undefined, savingsRate: number | undefined) =>
  render(
    <I18nProvider i18n={i18n}>
      <AllocateStablecoinsBanner idleUsd={idleUsd} savingsRate={savingsRate} onAllocate={() => {}} />
    </I18nProvider>
  );

afterEach(() => {
  cleanup();
});

describe('AllocateStablecoinsBanner', () => {
  it('shows the projected yearly earnings once the figures are in', () => {
    renderBanner(10_000, 0.045);
    // 10k at 4.5% ≈ $450/year (compounded projection lands just above).
    expect(screen.queryByTestId('allocate-banner-skeleton')).toBeNull();
    expect(screen.getByTestId('allocate-stablecoins-banner').textContent).toMatch(/\$4\d\d/);
  });

  it('chips the figure while the projection inputs load', () => {
    renderBanner(undefined, 0.045);
    const skeleton = screen.getByTestId('allocate-banner-skeleton');
    // The stand-in keeps the layout but must not read as a real number —
    // visually transparent AND hidden from assistive tech.
    expect(skeleton.className).toContain('text-transparent');
    expect(skeleton.className).toContain('animate-pulse');
    expect(skeleton.getAttribute('aria-hidden')).toBe('true');
  });

  it('hides the placeholder rate from assistive tech while the rate query loads', () => {
    renderBanner(10_000, undefined);
    const rateSkeleton = screen.getByTestId('allocate-banner-rate-skeleton');
    // The fabricated 4.50% keeps the layout but must never be announced as fact.
    expect(rateSkeleton.className).toContain('text-transparent');
    expect(rateSkeleton.getAttribute('aria-hidden')).toBe('true');
  });

  it('exposes the real figures to assistive tech once resolved', () => {
    renderBanner(10_000, 0.045);
    const banner = screen.getByTestId('allocate-stablecoins-banner');
    expect(banner.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
