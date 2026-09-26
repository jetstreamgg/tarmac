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

  it('pop: a deleted digit and its comma fade out where they were', () => {
    const { rerender } = render(<RollingDigits value="1,234" transition="pop" />);
    rerender(<RollingDigits value="123" transition="pop" />);
    const leaving = screen.getAllByTestId('rolling-digit-out');
    expect(leaving.map(el => el.textContent)).toEqual([',', '4']);
    expect(leaving.every(el => el.getAttribute('data-transition') === 'pop')).toBe(true);
    expect(leaving.every(el => el.getAttribute('aria-hidden') === 'true')).toBe(true);
    // Out of flow, so the figure reflows underneath them.
    expect(leaving.every(el => el.className.includes('absolute'))).toBe(true);
    expect(screen.queryAllByTestId('rolling-digit-in')).toHaveLength(0);
    leaving.forEach(el => fireEvent.animationEnd(el));
    expect(screen.queryAllByTestId('rolling-digit-out')).toHaveLength(0);
  });

  it('pop: a comma a new group brings pops in; one that only shifts holds', () => {
    const { rerender } = render(<RollingDigits value="123" transition="pop" />);
    rerender(<RollingDigits value="1,234" transition="pop" />);
    const arriving = screen.getAllByTestId('rolling-separator-in');
    expect(arriving.map(el => el.textContent)).toEqual([',']);
    expect(arriving[0].getAttribute('data-transition')).toBe('pop');
    expect(screen.getAllByTestId('rolling-digit-in').map(el => el.textContent)).toEqual(['4']);
    rerender(<RollingDigits value="12,345" transition="pop" />);
    // Same comma, one place further right: it neither leaves nor re-enters.
    expect(screen.queryAllByTestId('rolling-digit-out')).toHaveLength(0);
    expect(screen.getAllByTestId('rolling-separator-in')).toHaveLength(1);
  });

  it('pop: a mid-string delete fades only the removed digits; the rest shift over', () => {
    const { rerender } = render(<RollingDigits value="123,456,789" transition="pop" />);
    rerender(<RollingDigits value="1,236,789" transition="pop" />);
    expect(screen.getAllByTestId('rolling-digit-out').map(el => el.textContent)).toEqual(['4', '5']);
    expect(screen.queryAllByTestId('rolling-digit-in')).toHaveLength(0);
    expect(screen.queryAllByTestId('rolling-separator-in')).toHaveLength(0);
    // Digits keep their identity across edits, so a later insert in the middle pops only itself.
    rerender(<RollingDigits value="12,306,789" transition="pop" />);
    expect(screen.getAllByTestId('rolling-digit-in').map(el => el.textContent)).toEqual(['0']);
  });

  it('pop: the decimal point pops in and fades out like a comma', () => {
    const { rerender } = render(<RollingDigits value="124" transition="pop" />);
    rerender(<RollingDigits value="124.9" transition="pop" />);
    expect(screen.getAllByTestId('rolling-separator-in').map(el => el.textContent)).toEqual(['.']);
    rerender(<RollingDigits value="124" transition="pop" />);
    expect(screen.getAllByTestId('rolling-digit-out').map(el => el.textContent)).toEqual(['.', '9']);
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
