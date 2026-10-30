import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useState } from 'react';
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

  it('keeps a leading decimal separator on screen so the next digit is a fraction', () => {
    renderMenu();
    openMenu();

    selectTab('slippage-menu-custom-tab');
    const input = screen.getByTestId('slippage-menu-input');
    // The keypad's decimal key under a European locale — ",5" for 0.5%.
    fireEvent.change(input, { target: { value: ',' } });
    expect((input as HTMLInputElement).value).toBe('.');

    fireEvent.change(input, { target: { value: '.5' } });
    expect((input as HTMLInputElement).value).toBe('.5');
    expect(onChange).toHaveBeenLastCalledWith(0.005);
  });

  it('does not move a decimal point already typed when the key is tapped again', () => {
    renderMenu();
    openMenu();

    selectTab('slippage-menu-custom-tab');
    const input = screen.getByTestId('slippage-menu-input');
    fireEvent.change(input, { target: { value: '0,5' } });
    expect((input as HTMLInputElement).value).toBe('0.5');

    fireEvent.change(input, { target: { value: '0.5,' } });
    expect((input as HTMLInputElement).value).toBe('0.5');
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

  it('never commits 0% when the custom field is cleared', () => {
    renderMenu({ value: 0.005 });
    openMenu();

    const input = screen.getByTestId('slippage-menu-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });

    expect(input.value).toBe('');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('never commits 0% when zero is typed', () => {
    renderMenu({ value: 0.005 });
    openMenu();

    const input = screen.getByTestId('slippage-menu-input');
    for (const value of ['0', '0.', '0.0', '0.00']) {
      fireEvent.change(input, { target: { value } });
    }

    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits a sub-1% tolerance typed digit by digit', () => {
    renderMenu();
    openMenu();

    selectTab('slippage-menu-custom-tab');
    const input = screen.getByTestId('slippage-menu-input') as HTMLInputElement;
    for (const value of ['0', '0.', '0.5']) {
      fireEvent.change(input, { target: { value } });
    }

    expect(input.value).toBe('0.5');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(0.005);
  });

  it('keeps typing through the default value', () => {
    const Controlled = () => {
      const [value, setValue] = useState(0.008);
      return (
        <I18nProvider i18n={i18n}>
          <SlippageMenu value={value} defaultValue={0.002} onChange={setValue} />
          <output data-testid="committed">{value}</output>
        </I18nProvider>
      );
    };
    render(<Controlled />);
    openMenu();

    const input = screen.getByTestId('slippage-menu-input') as HTMLInputElement;
    for (const value of ['0', '0.', '0.2', '0.25']) {
      fireEvent.change(input, { target: { value } });
      expect(input.value).toBe(value);
    }
    expect(screen.getByTestId('committed').textContent).toBe('0.0025');
  });

  it('puts the tolerance in effect back on blur when nothing was committed', () => {
    renderMenu({ value: 0.005 });
    openMenu();

    const input = screen.getByTestId('slippage-menu-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0.' } });
    fireEvent.blur(input);

    expect(input.value).toBe('0.5');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves a committed value alone on blur', () => {
    renderMenu({ value: 0.005 });
    openMenu();

    const input = screen.getByTestId('slippage-menu-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0.8' } });
    fireEvent.blur(input);

    expect(input.value).toBe('0.8');
  });

  it('warns when the custom tolerance is above 1%', () => {
    renderMenu({ value: 0.015 });
    openMenu();

    expect(screen.getByTestId('slippage-menu-high-warning')).toBeTruthy();
  });

  it('does not warn at or below 1%', () => {
    renderMenu({ value: 0.01 });
    openMenu();

    expect(screen.queryByTestId('slippage-menu-high-warning')).toBeNull();
  });

  it('resets to the default when Auto is selected', () => {
    renderMenu({ value: 0.005 });
    openMenu();

    selectTab('slippage-menu-auto-tab');

    expect(onChange).toHaveBeenLastCalledWith(0.002);
  });
});
