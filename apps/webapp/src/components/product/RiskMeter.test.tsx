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
    // High ends where the Liquidation quarter starts.
    expect(screen.getByTestId('risk-scale-fill').style.width).toBe('75%');
  });

  it('fills to the value while tinting by the level when given both', () => {
    renderMeter({ value: 0.5, level: RiskLevel.HIGH });
    const fill = screen.getByTestId('risk-scale-fill');
    // 50% proximity sits a quarter into High's 40–80% zone: 2.25 quarters of
    // the bar, not the HIGH zone end (75%).
    expect(fill.style.width).toBe('56.25%');
    // The tint still comes from the level: the red slider gradient.
    expect(fill.dataset.zone).toBe(RiskLevel.HIGH);
    expect(fill.className).toContain('from-slider-red-start');
  });

  it('centres a faint dot in each equal zone and ticks where Liquidation starts (Figma 3199:81157)', () => {
    renderMeter({ level: RiskLevel.LOW });
    expect(screen.getAllByTestId('risk-scale-dot').map(m => m.style.left)).toEqual([
      '12.5%',
      '37.5%',
      '62.5%',
      '87.5%'
    ]);
    expect(screen.getByTestId('risk-scale-liquidation-tick').style.left).toBe('75%');
    expect(screen.queryByTestId('risk-scale-marker')).toBeNull();
  });

  it('a continuous value lands in the zone its threshold says — 33% is Medium, in the medium colour', () => {
    renderMeter({ value: 0.33 });
    const fill = screen.getByTestId('risk-scale-fill');
    expect(fill.dataset.zone).toBe(RiskLevel.MEDIUM);
    expect(fill.className).toContain('from-slider-yellow-start');
    // Inside the Medium quarter (25–50% of the bar).
    const width = parseFloat(fill.style.width);
    expect(width).toBeGreaterThan(25);
    expect(width).toBeLessThan(50);
  });

  it('maps each threshold onto a quarter boundary', () => {
    for (const [value, width] of [
      [0.25, '25%'],
      [0.4, '50%'],
      [0.8, '75%'],
      [1, '100%']
    ] as const) {
      renderMeter({ value });
      expect(screen.getByTestId('risk-scale-fill').style.width).toBe(width);
      cleanup();
    }
  });

  it('drops the zone labels when showLabels is false', () => {
    renderMeter({ value: 0.1, showLabels: false });
    expect(screen.queryByText('Low')).toBeNull();
    expect(screen.getByTestId('risk-scale-fill')).toBeTruthy();
  });

  it('a discrete level fills to the end of its threshold zone', () => {
    renderMeter({ level: RiskLevel.MEDIUM });
    expect(screen.getByTestId('risk-scale-fill').style.width).toBe('50%');
  });
});
