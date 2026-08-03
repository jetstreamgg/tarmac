import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RollingDigits } from './rolling-digits';

afterEach(cleanup);

describe('RollingDigits', () => {
  it('reads as one figure to assistive tech, not a string of digits', () => {
    render(<RollingDigits value="00026" />);
    expect(screen.getByText('00026')).not.toBeNull();
    // Every visible glyph is hidden from the accessibility tree.
    const hidden = screen
      .getAllByTestId('rolling-digit')
      .every(digit => digit.getAttribute('aria-hidden') === 'true');
    expect(hidden).toBe(true);
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
