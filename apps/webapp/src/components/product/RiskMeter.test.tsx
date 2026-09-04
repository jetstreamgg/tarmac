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

  it('fills a discrete Liquidation level to the end of the bar, past High', () => {
    renderMeter({ level: RiskLevel.LIQUIDATION });
    expect(screen.getByTestId('risk-scale-fill').style.width).toBe('100%');
    cleanup();
    renderMeter({ level: RiskLevel.HIGH });
    // High ends where Liquidation starts (the 80% threshold).
    expect(screen.getByTestId('risk-scale-fill').style.width).toBe('80%');
  });

  it('fills to the value while tinting by the level when given both', () => {
    renderMeter({ value: 0.5, level: RiskLevel.HIGH });
    const fill = screen.getByTestId('risk-scale-fill');
    // Fill length follows the continuous value (50%), not the HIGH zone end (80%).
    expect(fill.style.width).toBe('50%');
    // The tint still comes from the level: the DS risk-high colour.
    expect(fill.dataset.zone).toBe(RiskLevel.HIGH);
    expect(fill.className).toContain('bg-riskHigh');
  });

  it('places the zone markers at the real risk thresholds, not even quarters (APP-545)', () => {
    renderMeter({ level: RiskLevel.LOW });
    expect(screen.getAllByTestId('risk-scale-marker').map(m => m.style.left)).toEqual(['25%', '40%', '80%']);
  });

  it('a continuous value lands in the zone its threshold says — 33% is Medium, in the medium colour', () => {
    renderMeter({ value: 0.33 });
    const fill = screen.getByTestId('risk-scale-fill');
    expect(fill.dataset.zone).toBe(RiskLevel.MEDIUM);
    expect(fill.className).toContain('bg-riskMedium');
    expect(fill.style.width).toBe('33%');
  });

  it('a discrete level fills to the end of its threshold zone', () => {
    renderMeter({ level: RiskLevel.MEDIUM });
    expect(screen.getByTestId('risk-scale-fill').style.width).toBe('40%');
  });
});
