import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';

import { TakeoverShell } from './TakeoverShell';

i18n.load('en', {});
i18n.activate('en');

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

  it('names the dialog from its title via aria-labelledby', () => {
    renderShell();

    const overlay = screen.getByTestId('stake-takeover');
    const labelId = overlay.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId!)?.textContent).toBe('Open a position');
  });

  it('moves focus into the dialog on open and restores it on unmount', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <TakeoverShell title="t" onClose={vi.fn()} dataTestId="stake-takeover">
        <div />
      </TakeoverShell>
    );

    expect(document.activeElement).toBe(screen.getByTestId('stake-takeover'));
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('wraps Tab at the dialog edges instead of escaping the overlay', () => {
    renderShell();

    const overlay = screen.getByTestId('stake-takeover');
    const close = screen.getByTestId('stake-takeover-close');
    const footerButton = screen.getByText('Confirm');

    // Forward from the last focusable wraps to the first.
    footerButton.focus();
    fireEvent.keyDown(overlay, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    // Backward from the first focusable wraps to the last.
    close.focus();
    fireEvent.keyDown(overlay, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(footerButton);
  });

  it('locked: the card column goes inert and the footer offers to reopen the transaction', () => {
    const onOpenTransaction = vi.fn();
    render(
      <I18nProvider i18n={i18n}>
        <TakeoverShell
          title="Open a position"
          onClose={vi.fn()}
          footer={<button>Confirm</button>}
          locked
          onOpenTransaction={onOpenTransaction}
          dataTestId="stake-takeover"
        >
          <button>card control</button>
        </TakeoverShell>
      </I18nProvider>
    );

    expect(screen.getByTestId('stake-takeover-form').hasAttribute('inert')).toBe(true);
    expect(screen.queryByText('Confirm')).toBeNull();

    fireEvent.click(screen.getByTestId('stake-takeover-open-transaction'));
    expect(onOpenTransaction).toHaveBeenCalledTimes(1);
  });
});
