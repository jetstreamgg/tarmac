import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'viem';
import type { Token } from '@/hooks';
import { TokenInput } from './TokenInput';

i18n.load('en', {});
i18n.activate('en');

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChainId: () => 1 };
});

const usds = { symbol: 'USDS', name: 'USDS', decimals: 18 } as unknown as Token;
const usdc = { symbol: 'USDC', name: 'USDC', decimals: 6 } as unknown as Token;

function renderInput(token: Token = usds) {
  const onChange = vi.fn();
  render(
    <I18nProvider i18n={i18n}>
      <TokenInput token={token} tokenList={[token]} onChange={onChange} balance={0n} />
    </I18nProvider>
  );
  return { onChange, input: screen.getByTestId('token-input') as HTMLInputElement };
}

afterEach(cleanup);

describe('TokenInput', () => {
  it('accepts a decimal comma — the only separator iOS offers on most locales', () => {
    const { onChange, input } = renderInput();
    fireEvent.change(input, { target: { value: '1,5' } });
    expect(input.value).toBe('1.5');
    expect(onChange).toHaveBeenLastCalledWith(parseUnits('1.5', 18), expect.anything());
  });

  it('keeps the field text and the emitted amount in step for the dot form too', () => {
    const { onChange, input } = renderInput();
    fireEvent.change(input, { target: { value: '2.25' } });
    expect(input.value).toBe('2.25');
    expect(onChange).toHaveBeenLastCalledWith(parseUnits('2.25', 18), expect.anything());
  });

  it('caps the fraction at the token decimals instead of rejecting the amount', () => {
    const { onChange, input } = renderInput(usdc);
    fireEvent.change(input, { target: { value: '1,9999999' } });
    expect(input.value).toBe('1.999999');
    expect(onChange).toHaveBeenLastCalledWith(parseUnits('1.999999', 6), expect.anything());
  });

  it('masks out anything a numeric field used to reject (letters, sign, exponent)', () => {
    const { onChange, input } = renderInput();
    fireEvent.change(input, { target: { value: '-1e5abc' } });
    expect(input.value).toBe('15');
    expect(onChange).toHaveBeenLastCalledWith(parseUnits('15', 18), expect.anything());
  });

  it('holds an in-progress separator without emitting a broken amount', () => {
    const { onChange, input } = renderInput();
    fireEvent.change(input, { target: { value: '0,' } });
    expect(input.value).toBe('0.');
    expect(onChange).toHaveBeenLastCalledWith(0n, expect.anything());
  });
});
