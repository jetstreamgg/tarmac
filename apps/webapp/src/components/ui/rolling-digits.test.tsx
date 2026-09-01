import { cleanup, render, screen } from '@testing-library/react';
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

  it('rolls every digit a carry touches', () => {
    const { rerender } = render(<RollingDigits value="00099" />);
    rerender(<RollingDigits value="00100" />);
    expect(screen.getAllByTestId('rolling-digit-out')).toHaveLength(3);
  });

  it('keeps a digit in its own window across a carry that widens the figure', () => {
    const { rerender } = render(<RollingDigits value="999" />);
    rerender(<RollingDigits value="1,000" />);
    // The three 9s roll to 0s in place; the new leading "1," arrives fresh.
    expect(screen.getAllByTestId('rolling-digit-out')).toHaveLength(3);
  });

  it('leaves separators out of the clip windows', () => {
    render(<RollingDigits value="1,000" />);
    // Four digit windows; the comma is a bare span.
    expect(screen.getAllByTestId('rolling-digit')).toHaveLength(4);
  });
});
