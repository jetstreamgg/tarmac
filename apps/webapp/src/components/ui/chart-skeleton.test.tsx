import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ChartSkeleton } from './chart-skeleton';

afterEach(cleanup);

describe('ChartSkeleton', () => {
  it('renders at its intrinsic height by default', () => {
    render(<ChartSkeleton />);
    expect(screen.getByTestId('chart-skeleton').getAttribute('height')).toBe('167');
  });

  it('reserves the height it is given so the skeleton→chart swap does not shift layout', () => {
    render(<ChartSkeleton height={220} />);
    expect(screen.getByTestId('chart-skeleton').getAttribute('height')).toBe('220');
  });
});
