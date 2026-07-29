import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PortfolioDonutChart } from './PortfolioDonutChart';

i18n.load('en', {});
i18n.activate('en');

const renderChart = (segments: { id: string; color: string; value: number }[], size = 140) =>
  render(
    <I18nProvider i18n={i18n}>
      <PortfolioDonutChart segments={segments} activeId={null} onActiveChange={() => {}} size={size} />
    </I18nProvider>
  );

/** The inner ring's radius, which every scaled radial constant feeds into. */
const ringRadius = (container: HTMLElement) => Number(container.querySelector('circle')?.getAttribute('r'));

afterEach(cleanup);

describe('PortfolioDonutChart', () => {
  it('renders the "No tokens" empty state when there are no segments', () => {
    renderChart([]);
    expect(screen.getByText('No tokens')).toBeTruthy();
  });

  it('does not render the empty state once a segment is present', () => {
    renderChart([{ id: 'usds', color: '#E9B44C', value: 100 }]);
    expect(screen.queryByText('No tokens')).toBeNull();
  });

  // The radial geometry scales with `size` so the DS band stays ~4.5% of the
  // diameter at every box (Charts / Pie Chart comp 5034:22030: a 178 box with
  // an 8px band). Holding the constants absolute would thicken the band,
  // relatively, on the mobile 160.
  describe('radial geometry scales with size', () => {
    it('is unchanged at the 178 base size', () => {
      const { container } = renderChart([], 178);
      // outerRadius 89-0=89, innerRadius 89-8=81, ringRadius 81-9=72.
      expect(ringRadius(container)).toBe(72);
    });

    it('scales the ring proportionally at the mobile 160 box', () => {
      const { container } = renderChart([], 160);
      // scale 160/178: outerRadius 80, ringRadius 80-(8+9)*(160/178) ≈ 64.72.
      expect(ringRadius(container)).toBeCloseTo(64.72, 2);
    });

    it('keeps the ring at the same share of the box across sizes', () => {
      const { container: big } = renderChart([], 178);
      const bigShare = ringRadius(big) / 178;
      cleanup();
      const { container: small } = renderChart([], 160);
      expect(ringRadius(small) / 160).toBeCloseTo(bigShare, 5);
    });
  });
});
