import { useEffect } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { TakeoverShell } from '@/components/product/TakeoverShell';
import { AccessGate } from './AccessGate';

const h = vi.hoisted(() => ({
  connectedContext: {} as Record<string, unknown>,
  pageMounts: 0
}));

vi.mock('@/modules/ui/context/ConnectedContext', () => ({
  useConnectedContext: () => h.connectedContext
}));

vi.mock('wagmi', async importOriginal => ({
  ...(await importOriginal<typeof import('wagmi')>()),
  useDisconnect: () => ({ disconnect: vi.fn() })
}));

vi.mock('@/modules/analytics/hooks/useVpnAnalytics', () => ({
  useVpnAnalytics: () => ({ trackVpnBlockedPageView: vi.fn() })
}));

vi.mock('@/modules/config/termsLink', () => ({
  getTermsLinkConfig: () => ({
    termsLinks: [{ name: 'Terms of Use', url: 'https://docs.sky.money/legal-terms' }]
  }),
  reportTermsLinkConfigErrorOnce: vi.fn()
}));

i18n.load('en', {});
i18n.activate('en');

const AUTHORIZED = {
  isAuthorized: true,
  authData: { authIsLoading: false },
  vpnData: { vpnIsLoading: false }
};
const CHECKING = { ...AUTHORIZED, isAuthorized: false, authData: { authIsLoading: true } };
const BLOCKED = { ...AUTHORIZED, isAuthorized: false, accessBlockReason: 'wallet-blocked' };

type Kind = 'dialog' | 'sheet';
const TITLE: Record<Kind, string> = { dialog: 'Position details', sheet: 'Manage position' };

// A page with a URL-driven flow: `modalOpen` stands in for the search param.
const Page = ({ kind, modalOpen }: { kind: Kind; modalOpen: boolean }) => {
  useEffect(() => {
    h.pageMounts += 1;
  }, []);
  return kind === 'dialog' ? (
    <Dialog open={modalOpen}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>{TITLE.dialog}</DialogTitle>
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open={modalOpen}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>{TITLE.sheet}</SheetTitle>
      </SheetContent>
    </Sheet>
  );
};

const tree = (modalOpen: boolean, kind: Kind = 'dialog') => (
  <I18nProvider i18n={i18n}>
    <AccessGate>
      <Page kind={kind} modalOpen={modalOpen} />
    </AccessGate>
  </I18nProvider>
);

const gate = () => screen.getByRole('dialog', { name: 'Wallet blocked' });

const expectGateInCharge = () => {
  const el = gate();
  expect(el.closest('[aria-hidden="true"]')).toBeNull();
  expect(el.style.pointerEvents).not.toBe('none');
  expect(el.contains(document.activeElement)).toBe(true);
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
};

afterEach(() => {
  cleanup();
  h.connectedContext = {};
  h.pageMounts = 0;
});

describe('AccessGate', () => {
  it('renders no gate and leaves page modals alone for an authorized wallet', () => {
    h.connectedContext = AUTHORIZED;
    render(tree(true));

    expect(screen.queryByRole('dialog', { name: 'Wallet blocked' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Position details' })).toBeTruthy();
  });

  // Screening runs on a transaction's first screen, so a page modal is often
  // open when the checks start: it must not flicker shut while they run.
  it('keeps page modals open while the checks are still running', () => {
    h.connectedContext = CHECKING;
    render(tree(true));

    expect(screen.getByRole('dialog', { name: 'Position details' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Wallet blocked' })).toBeNull();
  });

  it('takes over from a page modal that was already open when the block landed', () => {
    h.connectedContext = AUTHORIZED;
    const { rerender } = render(tree(true));

    h.connectedContext = BLOCKED;
    rerender(tree(true));

    expectGateInCharge();
    expect(h.pageMounts).toBe(1);
  });

  // Back/Forward into a URL-driven flow opens a page modal after the gate.
  // Radix would put that newer modal in charge of focus and clicks, leaving
  // the gate visible but dead.
  it.each<Kind>(['dialog', 'sheet'])(
    'holds a page %s that opens after the gate, and restores it once the block lifts',
    kind => {
      h.connectedContext = BLOCKED;
      const { rerender } = render(tree(false, kind));

      rerender(tree(true, kind));
      expectGateInCharge();

      h.connectedContext = AUTHORIZED;
      act(() => rerender(tree(true, kind)));

      expect(screen.queryByRole('dialog', { name: 'Wallet blocked' })).toBeNull();
      expect(screen.getByRole('dialog', { name: TITLE[kind] })).toBeTruthy();
      expect(h.pageMounts).toBe(1);
    }
  );

  // Uncontrolled roots open from a trigger the gate covers, so they are left
  // alone rather than flipped between uncontrolled and controlled.
  it('leaves uncontrolled dialogs uncontrolled', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const uncontrolled = () => (
      <I18nProvider i18n={i18n}>
        <AccessGate>
          <Dialog>
            <DialogContent aria-describedby={undefined}>
              <DialogTitle>Risk tiers</DialogTitle>
            </DialogContent>
          </Dialog>
        </AccessGate>
      </I18nProvider>
    );
    h.connectedContext = AUTHORIZED;
    const { rerender } = render(uncontrolled());
    h.connectedContext = BLOCKED;
    rerender(uncontrolled());
    expect(gate()).toBeTruthy();
    h.connectedContext = AUTHORIZED;
    rerender(uncontrolled());

    const calls = [...warn.mock.calls, ...error.mock.calls].flat().join(' ');
    expect(calls).not.toMatch(/uncontrolled|controlled/);
    warn.mockRestore();
    error.mockRestore();
  });

  // Takeovers aren't Radix layers: they stay mounted under the gate but inert.
  it('makes a takeover inert while the gate is up', () => {
    const takeover = () => (
      <I18nProvider i18n={i18n}>
        <AccessGate>
          <TakeoverShell title="Open position" onClose={() => {}}>
            <button>Continue</button>
          </TakeoverShell>
        </AccessGate>
      </I18nProvider>
    );
    h.connectedContext = BLOCKED;
    const { rerender } = render(takeover());

    expect(screen.getByTestId('takeover-shell').hasAttribute('inert')).toBe(true);
    expectGateInCharge();

    h.connectedContext = AUTHORIZED;
    rerender(takeover());
    expect(screen.getByTestId('takeover-shell').hasAttribute('inert')).toBe(false);
  });
});
