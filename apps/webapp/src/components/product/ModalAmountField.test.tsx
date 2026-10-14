import { useState } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModalAmountField } from './ModalAmountField';

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));
vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return { ...actual, useBreakpointIndex: () => ({ bpi: actual.BP.desktop }) };
});

i18n.load('en', {});
i18n.activate('en');

function Harness() {
  const [value, setValue] = useState('');
  return (
    <I18nProvider i18n={i18n}>
      <ModalAmountField
        label="Amount"
        tokenSymbol="USDS"
        value={value}
        decimals={18}
        onInput={setValue}
        balance="Balance: 1,000.00"
        onPercent={pct => setValue(String((1000 * pct) / 100))}
        inputTestId="field"
        maxTestId="field-max"
      />
    </I18nProvider>
  );
}

const flush = () => screen.queryAllByTestId('rolling-digit-in').forEach(el => fireEvent.animationEnd(el));

describe('ModalAmountField', () => {
  it('groups the typed figure and pops each digit', () => {
    render(<Harness />);
    const input = screen.getByTestId('field') as HTMLInputElement;
    expect(input.placeholder).toBe('0.00');
    fireEvent.change(input, { target: { value: '1234' } });
    expect(input.value).toBe('1,234');
    expect(screen.getByTestId('field-display').textContent).toBe('1,234');
    flush();
    fireEvent.change(input, { target: { value: '1,2345' } });
    const popped = screen.getAllByTestId('rolling-digit-in');
    expect(popped.map(el => el.textContent)).toEqual(['5']);
    expect(popped[0].getAttribute('data-transition')).toBe('pop');
  });

  it('rolls the figure a percent chip sets', () => {
    render(<Harness />);
    const input = screen.getByTestId('field') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5' } });
    flush();
    fireEvent.click(screen.getByTestId('field-max'));
    expect(input.value).toBe('1,000');
    const rolled = screen.getAllByTestId('rolling-digit-in');
    expect(rolled.length).toBeGreaterThan(0);
    expect(rolled.every(el => el.getAttribute('data-transition') === 'roll')).toBe(true);
    flush();
    fireEvent.click(screen.getByText('25%'));
    expect(input.value).toBe('250');
    expect(
      screen.getAllByTestId('rolling-digit-in').every(el => el.getAttribute('data-transition') === 'roll')
    ).toBe(true);
  });

  it('reads a pasted grouped figure as grouping', () => {
    render(<Harness />);
    const input = screen.getByTestId('field') as HTMLInputElement;
    fireEvent.paste(input, { clipboardData: { getData: () => '100,000.5' } });
    expect(input.value).toBe('100,000.5');
  });
});
