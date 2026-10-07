import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Dialog, DialogContent, DialogTitle } from './dialog';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
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

// The stake takeover's shape: the dialog opens from a button inside an outer
// dialog, and that button is disabled (a pending transaction) by the time the
// dialog closes.
const DisabledOpenerHarness = () => {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <div role="dialog" tabIndex={-1} data-testid="outer">
      <button disabled={pending} onClick={() => setOpen(true)}>
        confirm
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Title</DialogTitle>
          <button
            onClick={() => {
              setPending(true);
              setOpen(false);
            }}
          >
            close dialog
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// The More menu's shape: a popover item opens the dialog and closes the
// popover, so the opener and the dialog it sat in are both gone on close. In a
// browser the popover is still animating out when the dialog opens, so the
// item is still focused then; `menuClosesFirst` covers the order jsdom runs.
const MenuOpenerHarness = ({ menuClosesFirst }: { menuClosesFirst: boolean }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger>more</PopoverTrigger>
        <PopoverContent>
          <button
            onClick={() => {
              if (menuClosesFirst) {
                setMenuOpen(false);
                setOpen(true);
              } else {
                setOpen(true);
                setTimeout(() => setMenuOpen(false), 50);
              }
            }}
          >
            upgrade
          </button>
        </PopoverContent>
      </Popover>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Title</DialogTitle>
          <button onClick={() => setOpen(false)}>close dialog</button>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Position details handing off to the manage takeover: the takeover mounts and
// makes the page inert, then the dialog closes with its opener behind it.
const HandOffHarness = () => {
  const [open, setOpen] = useState(false);
  const [takeover, setTakeover] = useState(false);
  return (
    <>
      <div inert={takeover}>
        <button onClick={() => setOpen(true)}>row</button>
      </div>
      {takeover && <div role="dialog" aria-modal="true" tabIndex={-1} data-testid="takeover" />}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Title</DialogTitle>
          <button
            onClick={() => {
              setTakeover(true);
              setOpen(false);
            }}
          >
            borrow
          </button>
        </DialogContent>
      </Dialog>
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

  it('falls back to the dialog around the opener when the opener is disabled', async () => {
    render(<DisabledOpenerHarness />);
    const opener = screen.getByText('confirm');
    opener.focus();
    fireEvent.click(opener);
    await waitFor(() => expect(screen.getByText('close dialog')).toBeTruthy());

    fireEvent.click(screen.getByText('close dialog'));

    await waitFor(() => expect(screen.queryByText('close dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('outer')));
  });

  it.each([true, false])(
    'falls back to the menu trigger when the menu item that opened it is gone (menu closes first: %s)',
    async menuClosesFirst => {
      render(<MenuOpenerHarness menuClosesFirst={menuClosesFirst} />);
      const trigger = screen.getByText('more');
      trigger.focus();
      fireEvent.click(trigger);
      const item = await screen.findByText('upgrade');
      item.focus();
      fireEvent.click(item);
      await waitFor(() => expect(screen.getByText('close dialog')).toBeTruthy());

      fireEvent.click(screen.getByText('close dialog'));

      await waitFor(() => expect(screen.queryByText('close dialog')).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    }
  );

  it('falls back to the open modal on top when the opener is inert behind it', async () => {
    render(<HandOffHarness />);
    const opener = screen.getByText('row');
    opener.focus();
    fireEvent.click(opener);
    await waitFor(() => expect(screen.getByText('borrow')).toBeTruthy());

    fireEvent.click(screen.getByText('borrow'));

    await waitFor(() => expect(screen.queryByText('borrow')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('takeover')));
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
