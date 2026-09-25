import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useHideOnScroll } from './useHideOnScroll';

function Probe() {
  const hidden = useHideOnScroll();
  return <div data-testid="probe">{hidden ? 'hidden' : 'visible'}</div>;
}

function scrollTo(y: number) {
  act(() => {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
    window.dispatchEvent(new Event('scroll'));
  });
}

beforeEach(() => {
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});

describe('useHideOnScroll', () => {
  it('starts visible', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('visible');
  });

  it('hides after scrolling down past the top zone', () => {
    render(<Probe />);
    scrollTo(200);
    expect(screen.getByTestId('probe').textContent).toBe('hidden');
  });

  it('shows again on scroll up', () => {
    render(<Probe />);
    scrollTo(200);
    scrollTo(400);
    expect(screen.getByTestId('probe').textContent).toBe('hidden');
    scrollTo(360);
    expect(screen.getByTestId('probe').textContent).toBe('visible');
  });

  it('never hides inside the top zone, regardless of direction', () => {
    render(<Probe />);
    scrollTo(40);
    expect(screen.getByTestId('probe').textContent).toBe('visible');
    scrollTo(200);
    scrollTo(20);
    expect(screen.getByTestId('probe').textContent).toBe('visible');
  });

  it('ignores sub-threshold jitter so slow drags do not flicker', () => {
    render(<Probe />);
    scrollTo(200);
    expect(screen.getByTestId('probe').textContent).toBe('hidden');
    // 2px up-tick (rubber-banding / touch jitter) must not reveal the bar.
    scrollTo(198);
    expect(screen.getByTestId('probe').textContent).toBe('hidden');
  });

  // Reading the offset forces a layout, which during the first commit is the
  // whole page's: it is read a frame later instead.
  it('takes the starting offset a frame after mount, not during it', async () => {
    let reads = 0;
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => (reads++, 500) });
    render(<Probe />);
    expect(reads).toBe(0);
    await act(() => new Promise(resolve => requestAnimationFrame(resolve)));
    expect(reads).toBe(1);
    // Measured from 500, a 2px move is jitter rather than a scroll down.
    scrollTo(502);
    expect(screen.getByTestId('probe').textContent).toBe('visible');
  });
});
