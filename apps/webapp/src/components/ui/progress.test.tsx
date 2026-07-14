import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Progress } from './progress';

afterEach(cleanup);

describe('Progress', () => {
  it('translates the fill to reflect the value', () => {
    render(<Progress value={40} />);
    const bar = screen.getByRole('progressbar');
    const indicator = bar.querySelector('[style]');
    // 40% filled → indicator shifted left by the remaining 60%.
    expect((indicator as HTMLElement | null)?.style.transform).toBe('translateX(-60%)');
  });

  it('applies an indicator fill override', () => {
    render(<Progress value={50} indicatorClassName="bg-error" />);
    expect(screen.getByRole('progressbar').querySelector('.bg-error')).toBeTruthy();
  });
});
