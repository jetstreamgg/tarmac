import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StakeTakeoverAmountField } from './StakeTakeoverAmountField';

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

i18n.load('en', {});
i18n.activate('en');
const WAD = 10n ** 18n;

function Harness({ initial = 0n }: { initial?: bigint }) {
  return (
    <I18nProvider i18n={i18n}>
      <Controlled initial={initial} />
    </I18nProvider>
  );
}

import { useState } from 'react';
function Controlled({ initial }: { initial: bigint }) {
  const [amount, setAmount] = useState(initial);
  return (
    <StakeTakeoverAmountField
      tokenSymbol="SKY"
      amount={amount}
      onAmountChange={setAmount}
      onPercentClick={percent => setAmount((1000n * WAD * BigInt(percent)) / 100n)}
      dataTestId="field"
    />
  );
}

const edit = (input: HTMLElement, value: string, caret = value.length) => {
  fireEvent.change(input, { target: { value, selectionStart: caret, selectionEnd: caret } });
};

describe('StakeTakeoverAmountField', () => {
  it('keeps the grouping when digits are deleted or replaced (Design QA 3450:121919)', () => {
    render(<Harness />);
    const input = screen.getByTestId('field') as HTMLInputElement;
    // The figure as shown, without the digits still fading out of it.
    const display = () => {
      const copy = screen.getByTestId('field-display').cloneNode(true) as HTMLElement;
      copy.querySelectorAll('[data-testid="rolling-digit-out"]').forEach(el => el.remove());
      return copy.textContent;
    };
    edit(input, '123456789');
    expect(display()).toBe('123,456,789');
    edit(input, '123,456,78');
    expect(display()).toBe('12,345,678');
    edit(input, '123456789.99');
    expect(display()).toBe('123,456,789.99');
    edit(input, '123,456,789.9');
    expect(display()).toBe('123,456,789.9');
    edit(input, '123,456,789.');
    // The last decimal takes the point with it.
    expect(display()).toBe('123,456,789');
    edit(input, '123,456,789.99');
    // Delete "456" with the caret left after "123,".
    edit(input, '123,,789.99', 4);
    expect(display()).toBe('123,789.99');
    expect(input.selectionStart).toBe(4);
    edit(input, '123,456,789.99');
    edit(input, '3,456,789.99', 0);
    expect(display()).toBe('3,456,789.99');
    expect(input.selectionStart).toBe(0);
    // Deleting the last digit before a comma: the caret stays on its digit.
    edit(input, '12,345,678');
    edit(input, '12,45,678', 3);
    expect(display()).toBe('1,245,678');
    expect(input.selectionStart).toBe(3);
  });

  it('keeps typing mode while the parent delivers the amount a render late', () => {
    // A parent that commits the amount after the field's own text update.
    function Late() {
      const [amount, setAmount] = useState(0n);
      return (
        <I18nProvider i18n={i18n}>
          <StakeTakeoverAmountField
            tokenSymbol="SKY"
            amount={amount}
            onAmountChange={next => setTimeout(() => act(() => setAmount(next)), 0)}
            dataTestId="field"
          />
        </I18nProvider>
      );
    }
    vi.useFakeTimers();
    try {
      render(<Late />);
      const input = screen.getByTestId('field');
      edit(input, '123456789');
      act(() => vi.runAllTimers());
      screen.queryAllByTestId('rolling-digit-in').forEach(el => fireEvent.animationEnd(el));
      edit(input, '123,456,78');
      // Before the parent catches up: the figure is still the typed one and
      // only the deleted digit leaves; nothing re-keys.
      expect(screen.getByTestId('field-display').textContent).toBe('12,345,6789');
      expect(screen.queryAllByTestId('rolling-digit-in')).toHaveLength(0);
      act(() => vi.runAllTimers());
      expect(screen.queryAllByTestId('rolling-digit-in')).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops the decimal point with the last decimal digit, but keeps a freshly typed one', () => {
    render(<Harness />);
    const input = screen.getByTestId('field') as HTMLInputElement;
    edit(input, '124.');
    expect(input.value).toBe('124.');
    edit(input, '124.99');
    edit(input, '124.9');
    expect(input.value).toBe('124.9');
    edit(input, '124.');
    expect(input.value).toBe('124');
    expect(input.selectionStart).toBe(3);
  });

  it('reads a lone typed comma as the decimal point', () => {
    render(<Harness />);
    const input = screen.getByTestId('field');
    edit(input, '1');
    edit(input, '1,');
    expect((input as HTMLInputElement).selectionStart).toBe(2);
    edit(input, '1.5');
    expect(screen.getByTestId('field-display').textContent).toBe('1.5');
  });

  it('pops a typed digit and rolls a chip-driven change (Design QA 3450:121929)', () => {
    render(<Harness />);
    const input = screen.getByTestId('field');
    fireEvent.change(input, { target: { value: '5' } });
    screen.getAllByTestId('rolling-digit-in').forEach(el => fireEvent.animationEnd(el));
    fireEvent.change(input, { target: { value: '51' } });
    const popped = screen.getAllByTestId('rolling-digit-in');
    expect(popped).toHaveLength(1);
    expect(popped[0].textContent).toBe('1');
    expect(popped[0].getAttribute('data-transition')).toBe('pop');
    expect(screen.queryAllByTestId('rolling-digit-out')).toHaveLength(0);

    fireEvent.change(input, { target: { value: '5' } });
    const gone = screen.getAllByTestId('rolling-digit-out');
    expect(gone.map(el => el.textContent)).toEqual(['1']);
    expect(gone[0].getAttribute('data-transition')).toBe('pop');
    fireEvent.animationEnd(gone[0]);

    fireEvent.click(screen.getByTestId('field-percent-50'));
    expect(screen.getByTestId('field-display').textContent).toBe('500');
    const rolled = screen.getAllByTestId('rolling-digit-in');
    expect(rolled.every(el => el.getAttribute('data-transition') === 'roll')).toBe(true);
  });
});
