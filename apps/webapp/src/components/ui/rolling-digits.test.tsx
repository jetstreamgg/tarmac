import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RollingDigits } from './rolling-digits';

afterEach(cleanup);

describe('RollingDigits', () => {
  it('holds exactly one copy of the figure, so it reads and copies whole', () => {
    render(<RollingDigits value="00026" />);
    expect(screen.getByTestId('rolling-digits').textContent).toBe('00026');
  });

  it('hides the outgoing glyph, so a roll in flight cannot intrude on the figure', () => {
    const { rerender } = render(<RollingDigits value="00026" />);
    rerender(<RollingDigits value="00027" />);

    // The old glyph is in the DOM for the 200ms it takes to leave, but out of
    // the accessibility tree the whole time.
    expect(screen.getByTestId('rolling-digit-out').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('rolling-digit-in').getAttribute('aria-hidden')).toBeNull();
  });

  it('rolls only the digit that changed', () => {
    const { rerender } = render(<RollingDigits value="00026" />);
    expect(screen.queryAllByTestId('rolling-digit-out')).toHaveLength(0);

    rerender(<RollingDigits value="00027" />);
    const outgoing = screen.getAllByTestId('rolling-digit-out');
    expect(outgoing).toHaveLength(1);
    expect(outgoing[0].textContent).toBe('6');
    expect(screen.getAllByTestId('rolling-digit-in')).toHaveLength(1);
  });

  it('pop: a typed digit fades in where it lands and the earlier digits hold', () => {
    const { rerender } = render(<RollingDigits value="5" transition="pop" />);
    rerender(<RollingDigits value="51" transition="pop" />);
    expect(screen.queryAllByTestId('rolling-digit-out')).toHaveLength(0);
    const arriving = screen.getAllByTestId('rolling-digit-in');
    expect(arriving).toHaveLength(1);
    expect(arriving[0].textContent).toBe('1');
    expect(arriving[0].getAttribute('data-transition')).toBe('pop');
  });

  it('pop: a deleted digit fades out after the figure', () => {
    const { rerender } = render(<RollingDigits value="1,234" transition="pop" />);
    rerender(<RollingDigits value="123" transition="pop" />);
    const leaving = screen.getAllByTestId('rolling-digit-out');
    expect(leaving.map(el => el.textContent)).toEqual(['4']);
    expect(leaving[0].getAttribute('data-transition')).toBe('pop');
    expect(leaving[0].getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('rolling-digits').textContent).toBe('1234');
    fireEvent.animationEnd(leaving[0]);
    expect(screen.queryAllByTestId('rolling-digit-out')).toHaveLength(0);
  });

  it('uses tabular figures unless asked for proportional ones', () => {
    const { rerender } = render(<RollingDigits value="7" />);
    expect(screen.getByTestId('rolling-digit').className).toContain('tabular-nums');
    rerender(<RollingDigits value="7" proportional />);
    expect(screen.getByTestId('rolling-digit').className).not.toContain('tabular-nums');
  });

  it('rolls every digit a carry touches', () => {
    const { rerender } = render(<RollingDigits value="00099" />);
    rerender(<RollingDigits value="00100" />);
    expect(screen.getAllByTestId('rolling-digit-out')).toHaveLength(3);
  });

  it('keeps a digit in its own window across a carry that widens the figure', () => {
    const { rerender } = render(<RollingDigits value="999" />);
    rerender(<RollingDigits value="1,000" />);
    // The three 9s roll to 0s in place; the new leading 1 rolls up into a
    // fresh window with nothing to roll out ahead of it.
    expect(screen.getAllByTestId('rolling-digit-out').map(el => el.textContent)).toEqual(['9', '9', '9']);
    expect(screen.getAllByTestId('rolling-digit-in').map(el => el.textContent)).toEqual(['1', '0', '0', '0']);
  });

  it('never rolls a symbol into a digit when the figure widens', () => {
    const { rerender } = render(<RollingDigits value="$9.86" />);
    rerender(<RollingDigits value="$10.85" />);
    // The $ keeps its place; only the digits whose value changed turn over,
    // plus the tens digit that carried in.
    expect(screen.getAllByTestId('rolling-digit-out').map(el => el.textContent)).toEqual(['9', '6']);
    expect(screen.getAllByTestId('rolling-digit-in').map(el => el.textContent)).toEqual(['1', '0', '5']);
  });

  it('keeps fraction digits in place when the integer part widens', () => {
    const { rerender } = render(<RollingDigits value="$990,000.00" />);
    rerender(<RollingDigits value="$1,000,000.00" />);
    expect(screen.getAllByTestId('rolling-digit-out').map(el => el.textContent)).toEqual(['9', '9']);
    expect(screen.getAllByTestId('rolling-digit-in').map(el => el.textContent)).toEqual(['1', '0', '0']);
  });

  it('shows the initial figure without rolling it in', () => {
    render(<RollingDigits value="$100,000.00" />);
    expect(screen.queryAllByTestId('rolling-digit-in')).toHaveLength(0);
  });

  it('leaves separators out of the clip windows', () => {
    render(<RollingDigits value="1,000" />);
    // Four digit windows; the comma is a bare span.
    expect(screen.getAllByTestId('rolling-digit')).toHaveLength(4);
  });
});
