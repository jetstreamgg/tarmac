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

  // M6.1: the radial geometry scales with `size` so the DS band stays ~5% of the
  // diameter at every box (Figma 486:20138). Holding the constants absolute made
  // the mobile 160 render a band twice as thick, relative, as the desktop 320.
  describe('radial geometry scales with size', () => {
    it('is unchanged at the 320 base size', () => {
      const { container } = renderChart([], 320);
      // outerRadius 160-4=156, innerRadius 156-18=138, ringRadius 138-10=128.
      expect(ringRadius(container)).toBe(128);
    });

    it('scales the ring proportionally at the mobile 160 box', () => {
      const { container } = renderChart([], 160);
      // scale 0.5: outerRadius 80-2=78, innerRadius 78-9=69, ringRadius 69-5=64.
      expect(ringRadius(container)).toBe(64);
    });

    it('keeps the ring at the same share of the box across sizes', () => {
      const { container: big } = renderChart([], 320);
      const bigShare = ringRadius(big) / 320;
      cleanup();
      const { container: small } = renderChart([], 160);
      expect(ringRadius(small) / 160).toBeCloseTo(bigShare, 5);
    });
  });
});
