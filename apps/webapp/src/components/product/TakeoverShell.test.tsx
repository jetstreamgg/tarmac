import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TakeoverShell } from './TakeoverShell';

const renderShell = (onClose = vi.fn()) => {
  render(
    <TakeoverShell
      title="Open a position"
      badge={<span>SKY Staking</span>}
      onClose={onClose}
      footer={<button>Confirm</button>}
      dataTestId="stake-takeover"
    >
      <p>card column</p>
    </TakeoverShell>
  );
  return onClose;
};

describe('TakeoverShell', () => {
  afterEach(() => {
    cleanup();
    document.documentElement.style.overflow = '';
  });

  it('renders title, badge, content and footer inside a modal overlay', () => {
    renderShell();

    const overlay = screen.getByTestId('stake-takeover');
    expect(overlay.getAttribute('role')).toBe('dialog');
    expect(overlay.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Open a position')).toBeTruthy();
    expect(screen.getByText('SKY Staking')).toBeTruthy();
    expect(screen.getByText('card column')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
  });

  it('fires onClose from the close button', () => {
    const onClose = renderShell();

    fireEvent.click(screen.getByTestId('stake-takeover-close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fires onClose on Escape', () => {
    const onClose = renderShell();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks document scroll while mounted and restores it on unmount', () => {
    const { unmount } = render(
      <TakeoverShell title="t" onClose={vi.fn()} dataTestId="stake-takeover">
        <div />
      </TakeoverShell>
    );

    expect(document.documentElement.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).toBe('');
  });
});
