import { useState } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'viem';
import { ConvertAmountInput } from './ConvertAmountInput';
import { getValidatedPsmExternalAmount } from '../hooks/usePsmConversion.helpers';

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));
vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return { ...actual, useBreakpointIndex: () => ({ bpi: actual.BP.desktop }) };
});

i18n.load('en', {});
i18n.activate('en');
const BALANCE = parseUnits('1000', 6);

/** The From side over the same accept rule useConvertForm applies (USDC origin: six decimals). */
function Harness() {
  const [value, setValue] = useState('');
  return (
    <I18nProvider i18n={i18n}>
      <ConvertAmountInput
        side="from"
        symbol="USDC"
        onTokenChange={() => {}}
        value={value}
        onInput={typed => {
          if (
            typed === '' ||
            typed === '.' ||
            getValidatedPsmExternalAmount(typed, 'USDC_TO_USDS') !== undefined
          ) {
            setValue(typed);
          }
        }}
        balance={BALANCE}
        decimals={6}
        onPercentClick={percent => setValue(String((1000 * percent) / 100))}
        isConnected
      />
    </I18nProvider>
  );
}

const flush = () => screen.queryAllByTestId('rolling-digit-in').forEach(el => fireEvent.animationEnd(el));

describe('ConvertAmountInput', () => {
  it('groups the typed figure and pops each digit', () => {
    render(<Harness />);
    const input = screen.getByTestId('convert-from-amount') as HTMLInputElement;
    expect(input.placeholder).toBe('0.00');
    fireEvent.change(input, { target: { value: '1234' } });
    expect(input.value).toBe('1,234');
    flush();
    fireEvent.change(input, { target: { value: '1,2345' } });
    const popped = screen.getAllByTestId('rolling-digit-in');
    expect(popped.map(el => el.textContent)).toEqual(['5']);
    expect(popped[0].getAttribute('data-transition')).toBe('pop');
  });

  it('rolls the figure a percent button sets', () => {
    render(<Harness />);
    const input = screen.getByTestId('convert-from-amount') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5' } });
    flush();
    fireEvent.click(screen.getByTestId('convert-from-percent-100'));
    expect(input.value).toBe('1,000');
    const rolled = screen.getAllByTestId('rolling-digit-in');
    expect(rolled.length).toBeGreaterThan(0);
    expect(rolled.every(el => el.getAttribute('data-transition') === 'roll')).toBe(true);
  });

  it('keeps the figure still when the PSM validator refuses a seventh decimal', () => {
    render(<Harness />);
    const input = screen.getByTestId('convert-from-amount') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1.123456' } });
    flush();
    fireEvent.change(input, { target: { value: '1.1234567' } });
    expect(input.value).toBe('1.123456');
    expect(screen.queryAllByTestId('rolling-digit-in')).toHaveLength(0);
    expect(screen.queryAllByTestId('rolling-digit-out')).toHaveLength(0);
  });
});
