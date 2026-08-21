import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RollingValue } from './rolling-value';

afterEach(cleanup);

describe('RollingValue', () => {
  it('renders the figure once and in the accessibility tree', () => {
    render(<RollingValue value="$1,000.00" />);
    const box = screen.getByTestId('rolling-value');
    expect(box.textContent).toBe('$1,000.00');
    expect(screen.queryByTestId('rolling-value-out')).toBeNull();
  });

  it('rolls the old figure out, hidden from assistive tech, when the value changes', () => {
    const { rerender } = render(<RollingValue value="$1,000.00" />);
    rerender(<RollingValue value="$250.00" />);

    const outgoing = screen.getByTestId('rolling-value-out');
    expect(outgoing.textContent).toBe('$1,000.00');
    expect(outgoing.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('rolling-value-in').textContent).toBe('$250.00');
  });

  it('does nothing when re-rendered with the same value', () => {
    const { rerender } = render(<RollingValue value="3.75%" />);
    rerender(<RollingValue value="3.75%" />);
    expect(screen.queryByTestId('rolling-value-out')).toBeNull();
    expect(screen.queryByTestId('rolling-value-in')).toBeNull();
  });
});
