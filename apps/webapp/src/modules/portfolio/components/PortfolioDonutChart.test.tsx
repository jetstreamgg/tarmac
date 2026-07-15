import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PortfolioDonutChart } from './PortfolioDonutChart';

i18n.load('en', {});
i18n.activate('en');

const renderChart = (segments: { id: string; color: string; value: number }[]) =>
  render(
    <I18nProvider i18n={i18n}>
      <PortfolioDonutChart segments={segments} activeId={null} onActiveChange={() => {}} size={140} />
    </I18nProvider>
  );

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
});
