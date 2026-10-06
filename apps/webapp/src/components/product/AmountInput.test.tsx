import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AmountInput } from './AmountInput';

/** Controlled like every caller; `accept` stands in for a caller that refuses some edits. */
function Harness({
  initial = '',
  accept = () => true
}: {
  initial?: string;
  accept?: (next: string) => boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <AmountInput
        value={value}
        onChange={next => accept(next) && setValue(next)}
        decimals={18}
        dataTestId="amount"
      />
      <button type="button" data-testid="set-500" onClick={() => setValue('500')} />
      <button type="button" data-testid="set-51" onClick={() => setValue('51')} />
    </>
  );
}

const edit = (input: HTMLElement, value: string, caret = value.length) =>
  fireEvent.change(input, { target: { value, selectionStart: caret, selectionEnd: caret } });
const flush = () => screen.queryAllByTestId('rolling-digit-in').forEach(el => fireEvent.animationEnd(el));
// The figure as shown, without the digits still fading out of it.
const shown = () => {
  const copy = screen.getByTestId('amount-display').cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[data-testid="rolling-digit-out"]').forEach(el => el.remove());
  return copy.textContent;
};

describe('AmountInput', () => {
  it('shows the value grouped and hands back the plain masked text', () => {
    render(<Harness />);
    const input = screen.getByTestId('amount') as HTMLInputElement;
    expect(input.placeholder).toBe('0.00');
    edit(input, '1234567.891');
    expect(input.value).toBe('1,234,567.891');
    expect(shown()).toBe('1,234,567.891');
    // Deleting through a comma and replacing a run keep the grouping and the caret.
    edit(input, '1,234,567.89');
    expect(shown()).toBe('1,234,567.89');
    edit(input, '1,,567.89', 2);
    expect(shown()).toBe('1,567.89');
    expect(input.selectionStart).toBe(2);
  });

  it('drops the point with the last decimal, keeps a typed one, reads a lone comma as the point', () => {
    render(<Harness />);
    const input = screen.getByTestId('amount') as HTMLInputElement;
    edit(input, '124.');
    expect(input.value).toBe('124.');
    edit(input, '124.9');
    edit(input, '124.');
    expect(input.value).toBe('124');
    expect(input.selectionStart).toBe(3);
    edit(input, '124,');
    expect(input.value).toBe('124.');
    expect(input.selectionStart).toBe(4);
  });

  it('masks a pasted figure and refuses one it cannot show', () => {
    render(<Harness />);
    const input = screen.getByTestId('amount') as HTMLInputElement;
    const paste = (text: string) => fireEvent.paste(input, { clipboardData: { getData: () => text } });
    paste('100,000');
    expect(input.value).toBe('100,000');
    edit(input, '');
    paste('1,5');
    expect(input.value).toBe('1.5');
    edit(input, '');
    paste('1e5');
    expect(input.value).toBe('');
  });

  it('pops a typed digit and rolls a value set from outside (Design QA 3450:121929)', () => {
    render(<Harness />);
    const input = screen.getByTestId('amount');
    edit(input, '5');
    flush();
    edit(input, '51');
    const popped = screen.getAllByTestId('rolling-digit-in');
    expect(popped.map(el => el.textContent)).toEqual(['1']);
    expect(popped[0].getAttribute('data-transition')).toBe('pop');
    flush();

    fireEvent.click(screen.getByTestId('set-500'));
    expect(shown()).toBe('500');
    const rolled = screen.getAllByTestId('rolling-digit-in');
    expect(rolled.length).toBeGreaterThan(0);
    expect(rolled.every(el => el.getAttribute('data-transition') === 'roll')).toBe(true);
    flush();

    // Back to typing after a roll: the figure pops again.
    edit(input, '5000');
    const again = screen.getAllByTestId('rolling-digit-in');
    expect(again.some(el => el.textContent === '0')).toBe(true);
    expect(again.every(el => el.getAttribute('data-transition') === 'pop')).toBe(true);
  });

  it('rolls a figure set from outside even when it repeats something once typed', () => {
    render(<Harness />);
    const input = screen.getByTestId('amount');
    edit(input, '51');
    flush();
    fireEvent.click(screen.getByTestId('set-500'));
    flush();
    fireEvent.click(screen.getByTestId('set-51'));
    const rolled = screen.getAllByTestId('rolling-digit-in');
    expect(rolled.length).toBeGreaterThan(0);
    expect(rolled.every(el => el.getAttribute('data-transition') === 'roll')).toBe(true);
  });

  it('leaves the figure still when the caller refuses a keystroke', () => {
    render(<Harness accept={next => next.split('.')[1]?.length !== 3} />);
    const input = screen.getByTestId('amount') as HTMLInputElement;
    edit(input, '1.12');
    flush();
    edit(input, '1.123');
    expect(input.value).toBe('1.12');
    expect(shown()).toBe('1.12');
    expect(screen.queryAllByTestId('rolling-digit-in')).toHaveLength(0);
    expect(screen.queryAllByTestId('rolling-digit-out')).toHaveLength(0);
    expect(input.selectionStart).toBe(4);
  });
});
