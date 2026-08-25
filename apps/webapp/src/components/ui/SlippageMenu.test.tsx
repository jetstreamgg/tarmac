import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

import { SlippageMenu } from './SlippageMenu';

const onChange = vi.fn();

const renderMenu = (props: Partial<React.ComponentProps<typeof SlippageMenu>> = {}) =>
  render(
    <I18nProvider i18n={i18n}>
      <SlippageMenu value={0.002} defaultValue={0.002} onChange={onChange} {...props} />
    </I18nProvider>
  );

const openMenu = () => fireEvent.click(screen.getByTestId('slippage-menu-trigger'));

// Radix TabsTrigger selects on mousedown (pointer semantics), not plain click.
const selectTab = (testId: string) => {
  const tab = screen.getByTestId(testId);
  fireEvent.mouseDown(tab, { button: 0 });
  fireEvent.click(tab);
};

describe('SlippageMenu', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders a labelled trigger and keeps the menu closed initially', () => {
    renderMenu();

    expect(screen.getByTestId('slippage-menu-trigger').getAttribute('aria-label')).toBeTruthy();
    expect(screen.queryByTestId('slippage-menu-auto-tab')).toBeNull();
  });

  it('shows the default slippage on the Auto tab when using the default', () => {
    renderMenu();
    openMenu();

    expect(screen.getByTestId('slippage-menu-auto-tab').getAttribute('data-state')).toBe('active');
    expect(screen.getByTestId('slippage-menu-content').textContent).toContain('0.2%');
  });

  it('opens on the Custom tab with the current percent when the value differs from the default', () => {
    renderMenu({ value: 0.005 });
    openMenu();

    expect(screen.getByTestId('slippage-menu-custom-tab').getAttribute('data-state')).toBe('active');
    expect((screen.getByTestId('slippage-menu-input') as HTMLInputElement).value).toBe('0.5');
  });

  it('emits the decimal value when a custom percent is typed', () => {
    renderMenu();
    openMenu();

    selectTab('slippage-menu-custom-tab');
    fireEvent.change(screen.getByTestId('slippage-menu-input'), { target: { value: '0.5' } });

    expect(onChange).toHaveBeenLastCalledWith(0.005);
  });

  it('clamps custom input to the configured maximum', () => {
    renderMenu({ max: 50 });
    openMenu();

    selectTab('slippage-menu-custom-tab');
    fireEvent.change(screen.getByTestId('slippage-menu-input'), { target: { value: '60' } });

    expect((screen.getByTestId('slippage-menu-input') as HTMLInputElement).value).toBe('50');
    expect(onChange).toHaveBeenLastCalledWith(0.5);
  });

  it('never commits zero tolerance when the field is cleared', () => {
    renderMenu({ value: 0.005 });
    openMenu();

    selectTab('slippage-menu-custom-tab');
    fireEvent.change(screen.getByTestId('slippage-menu-input'), { target: { value: '' } });

    // Zero pins the minimum received to the quote, so any price movement
    // reverts the transaction — with nothing on screen to explain it.
    expect(onChange).not.toHaveBeenCalledWith(0);
    expect((screen.getByTestId('slippage-menu-input') as HTMLInputElement).value).toBe('');
  });

  it('floors a typed zero rather than accepting it', () => {
    renderMenu({ value: 0.005 });
    openMenu();

    selectTab('slippage-menu-custom-tab');
    fireEvent.change(screen.getByTestId('slippage-menu-input'), { target: { value: '0' } });

    expect(onChange).not.toHaveBeenCalledWith(0);
  });

  it('lets a sub-1% value be typed digit by digit without keystroke clamping', () => {
    renderMenu({ value: 0.005 });
    openMenu();

    selectTab('slippage-menu-custom-tab');
    const input = screen.getByTestId('slippage-menu-input') as HTMLInputElement;
    // "0.5" arrives one keystroke at a time; a per-keystroke floor rewrote the
    // leading "0" to the minimum, so the user aiming for 0.5% committed 5%.
    fireEvent.change(input, { target: { value: '0' } });
    expect(input.value).toBe('0');
    fireEvent.change(input, { target: { value: '0.' } });
    expect(input.value).toBe('0.');
    fireEvent.change(input, { target: { value: '0.5' } });
    expect(input.value).toBe('0.5');
    expect(onChange).toHaveBeenLastCalledWith(0.005);
    expect(onChange).not.toHaveBeenCalledWith(0.0001);
  });

  it('snaps a settled below-minimum value up to the floor on blur', () => {
    renderMenu({ value: 0.005, min: 0.01 });
    openMenu();

    selectTab('slippage-menu-custom-tab');
    const input = screen.getByTestId('slippage-menu-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0.001' } });
    // Below the floor: nothing commits while typing…
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    // …and leaving the field settles it at the minimum.
    expect(input.value).toBe('0.01');
    expect(onChange).toHaveBeenLastCalledWith(0.0001);
  });

  it('warns once the tolerance is high enough to cost real money', () => {
    renderMenu({ value: 0.005 });
    openMenu();

    selectTab('slippage-menu-custom-tab');
    expect(screen.queryByTestId('slippage-menu-high-warning')).toBeNull();

    fireEvent.change(screen.getByTestId('slippage-menu-input'), { target: { value: '5' } });
    expect(screen.getByTestId('slippage-menu-high-warning')).toBeTruthy();
  });

  it('resets to the default when Auto is selected', () => {
    renderMenu({ value: 0.005 });
    openMenu();

    selectTab('slippage-menu-auto-tab');

    expect(onChange).toHaveBeenLastCalledWith(0.002);
  });
});
