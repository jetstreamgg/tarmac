import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PendleFlow, usePendleSlippage, type PendleSlippageMode } from '@/widgets';
import { SlippageMenu } from '@/components/ui/SlippageMenu';

i18n.load('en', {});
i18n.activate('en');

/**
 * V2 spec — per-flow persisted slippage (E1 AC). Exercises the real
 * usePendleSlippage (localStorage-backed, one key per flow) through the shared
 * SlippageMenu primitive: change → persist → survive remount, flows isolated.
 */

function Harness({ mode }: { mode: PendleSlippageMode }) {
  const { slippage, setSlippage, defaultSlippage } = usePendleSlippage(mode);
  return (
    <I18nProvider i18n={i18n}>
      <span data-testid="current-slippage">{slippage}</span>
      <SlippageMenu value={slippage} defaultValue={defaultSlippage} onChange={setSlippage} />
    </I18nProvider>
  );
}

const currentSlippage = () => screen.getByTestId('current-slippage').textContent;

const setCustomSlippage = (percent: string) => {
  fireEvent.click(screen.getByTestId('slippage-menu-trigger'));
  const customTab = screen.getByTestId('slippage-menu-custom-tab');
  fireEvent.mouseDown(customTab, { button: 0 });
  fireEvent.click(customTab);
  fireEvent.change(screen.getByTestId('slippage-menu-input'), { target: { value: percent } });
};

describe('Pendle per-flow slippage persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(cleanup);

  it('defaults to 0.2% for buy/sell and 0.02% for redeem', () => {
    render(<Harness mode={PendleFlow.BUY} />);
    expect(currentSlippage()).toBe('0.002');
    cleanup();

    render(<Harness mode="redeem" />);
    expect(currentSlippage()).toBe('0.0002');
  });

  it('persists a custom buy slippage and restores it on remount', () => {
    render(<Harness mode={PendleFlow.BUY} />);
    setCustomSlippage('0.5');

    expect(currentSlippage()).toBe('0.005');
    expect(window.localStorage.getItem('pendle-buy-slippage')).toBe('0.005');

    cleanup();
    render(<Harness mode={PendleFlow.BUY} />);
    expect(currentSlippage()).toBe('0.005');
  });

  it('keeps each flow on its own key', () => {
    render(<Harness mode={PendleFlow.BUY} />);
    setCustomSlippage('1');
    cleanup();

    // Sell and redeem are untouched by the buy override.
    render(<Harness mode={PendleFlow.WITHDRAW} />);
    expect(currentSlippage()).toBe('0.002');
    cleanup();

    render(<Harness mode="redeem" />);
    expect(currentSlippage()).toBe('0.0002');

    expect(window.localStorage.getItem('pendle-buy-slippage')).toBe('0.01');
    expect(window.localStorage.getItem('pendle-sell-slippage')).toBeNull();
    expect(window.localStorage.getItem('pendle-redeem-slippage')).toBeNull();
  });

  it('falls back to the default when the stored value is invalid', () => {
    window.localStorage.setItem('pendle-buy-slippage', 'not-a-number');
    render(<Harness mode={PendleFlow.BUY} />);

    expect(currentSlippage()).toBe('0.002');
  });
});
