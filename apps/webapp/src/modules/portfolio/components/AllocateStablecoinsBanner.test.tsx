import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AllocateStablecoinsBanner } from './AllocateStablecoinsBanner';

i18n.load('en', {});
i18n.activate('en');

const renderBanner = (idleUsd: number | undefined) =>
  render(
    <I18nProvider i18n={i18n}>
      <AllocateStablecoinsBanner idleUsd={idleUsd} savingsRate={0.045} onAllocate={() => {}} />
    </I18nProvider>
  );

afterEach(() => {
  cleanup();
});

describe('AllocateStablecoinsBanner', () => {
  it('shows the projected yearly earnings once the figures are in', () => {
    renderBanner(10_000);
    // 10k at 4.5% ≈ $450/year (compounded projection lands just above).
    expect(screen.queryByTestId('allocate-banner-skeleton')).toBeNull();
    expect(screen.getByTestId('allocate-stablecoins-banner').textContent).toMatch(/\$4\d\d/);
  });

  it('chips the figure while the projection inputs load', () => {
    renderBanner(undefined);
    const skeleton = screen.getByTestId('allocate-banner-skeleton');
    // The stand-in keeps the layout but must not read as a real number.
    expect(skeleton.className).toContain('text-transparent');
    expect(skeleton.className).toContain('animate-pulse');
  });
});
