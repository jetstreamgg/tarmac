import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Dialog, DialogContent, DialogTitle } from './dialog';
import { Sheet, SheetContent, SheetTitle } from './sheet';

afterEach(cleanup);

// Both are opened from controlled state, as every dialog in the app is: no
// Trigger, so Radix has nothing of its own to hand focus back to.
const DialogHarness = ({ onCloseAutoFocus }: { onCloseAutoFocus?: (event: Event) => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>open dialog</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus}>
          <DialogTitle>Title</DialogTitle>
          <button onClick={() => setOpen(false)}>close dialog</button>
        </DialogContent>
      </Dialog>
    </>
  );
};

const SheetHarness = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>open sheet</button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>Title</SheetTitle>
          <button onClick={() => setOpen(false)}>close sheet</button>
        </SheetContent>
      </Sheet>
    </>
  );
};

describe('DialogContent', () => {
  it('caps its height and scrolls internally so tall modals fit the viewport', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    const content = screen.getByRole('dialog');
    expect(content.className).toContain('max-h-[calc(100dvh-2rem)]');
    expect(content.className).toContain('overflow-y-auto');
  });
});

describe('focus on open and close', () => {
  it('moves focus into a dialog on open and returns it to the opener on close', async () => {
    render(<DialogHarness />);
    const opener = screen.getByText('open dialog');
    opener.focus();
    fireEvent.click(opener);

    await waitFor(() => expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true));

    fireEvent.click(screen.getByText('close dialog'));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('returns focus to the opener when a sheet closes', async () => {
    render(<SheetHarness />);
    const opener = screen.getByText('open sheet');
    opener.focus();
    fireEvent.click(opener);

    await waitFor(() => expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true));

    fireEvent.click(screen.getByText('close sheet'));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('leaves focus alone when the caller prevents the close auto-focus', async () => {
    render(<DialogHarness onCloseAutoFocus={event => event.preventDefault()} />);
    const opener = screen.getByText('open dialog');
    opener.focus();
    fireEvent.click(opener);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());

    fireEvent.click(screen.getByText('close dialog'));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(document.activeElement).not.toBe(opener);
  });

  it('still calls the caller handler', async () => {
    const onCloseAutoFocus = vi.fn();
    render(<DialogHarness onCloseAutoFocus={onCloseAutoFocus} />);
    fireEvent.click(screen.getByText('open dialog'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());

    fireEvent.click(screen.getByText('close dialog'));

    await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledTimes(1));
  });
});
