import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RiskScaleMeter } from './RiskMeter';
import { RiskLevel } from '@/hooks';

i18n.load('en', {});
i18n.activate('en');

const renderMeter = (props: React.ComponentProps<typeof RiskScaleMeter> = {}) =>
  render(
    <I18nProvider i18n={i18n}>
      <RiskScaleMeter {...props} />
    </I18nProvider>
  );

afterEach(cleanup);

describe('RiskScaleMeter', () => {
  it('renders the four risk zone labels', () => {
    renderMeter({ level: RiskLevel.LOW });
    for (const zone of ['Low', 'Medium', 'High', 'Liquidation']) {
      expect(screen.getByText(zone)).toBeTruthy();
    }
  });

  it('exposes the labelled state to assistive tech', () => {
    renderMeter({ level: RiskLevel.HIGH, label: 'High risk' });
    // getByRole throws if the labelled img role is absent, so this asserts both.
    expect(screen.getByRole('img', { name: 'High risk' })).toBeTruthy();
  });

  it('is decorative (no role) without a label', () => {
    renderMeter({ level: RiskLevel.LOW });
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('fills a discrete Liquidation level to the threshold tick, not the full bar', () => {
    const { container } = renderMeter({ level: RiskLevel.LIQUIDATION });
    const fill = container.querySelector('span[style*="background-image"]') as HTMLElement | null;
    // Liquidation threshold is 80%, so the fill stops there rather than at 100%.
    expect(fill?.style.width).toBe('80%');
  });
});
