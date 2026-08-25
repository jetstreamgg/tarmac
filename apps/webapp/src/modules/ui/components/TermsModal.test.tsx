import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TermsModal } from './TermsModal';

// Mutable state + spies shared between the mocks and the assertions.
const mocks = vi.hoisted(() => ({
  disconnect: vi.fn(),
  closeModal: vi.fn(),
  openModal: vi.fn(),
  acceptTerms: vi.fn(),
  retryTermsCheck: vi.fn(),
  connected: {
    isConnectedAndAcceptedTerms: false,
    termsCheckDenied: false,
    isCheckingTerms: false,
    // The numeric identity and the date shown beside it, as two values — the
    // header renders both only when both arrived.
    latestTermsVersion: '1.0' as string | undefined,
    termsEffectiveDate: '2026-01-15' as string | undefined
  },
  termsModal: { isModalOpen: true }
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useDisconnect: () => ({ disconnect: mocks.disconnect })
  };
});

vi.mock('../context/TermsModalContext', () => ({
  useTermsModal: () => ({
    closeModal: mocks.closeModal,
    isModalOpen: mocks.termsModal.isModalOpen,
    openModal: mocks.openModal
  })
}));

vi.mock('../context/ConnectedContext', () => ({
  useConnectedContext: () => ({
    isCheckingTerms: mocks.connected.isCheckingTerms,
    termsCheckError: null,
    termsCheckDenied: mocks.connected.termsCheckDenied,
    retryTermsCheck: mocks.retryTermsCheck,
    isConnectedAndAcceptedTerms: mocks.connected.isConnectedAndAcceptedTerms,
    latestTermsVersion: mocks.connected.latestTermsVersion,
    termsEffectiveDate: mocks.connected.termsEffectiveDate,
    acceptTerms: mocks.acceptTerms
  })
}));

i18n.load('en', {});
i18n.activate('en');

const renderModal = () =>
  render(
    <I18nProvider i18n={i18n}>
      <TermsModal />
    </I18nProvider>
  );

const agreeButton = () => screen.getByRole('button', { name: 'Agree and continue' }) as HTMLButtonElement;

describe('TermsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.acceptTerms.mockResolvedValue(true);
    mocks.connected.isConnectedAndAcceptedTerms = false;
    mocks.connected.termsCheckDenied = false;
    mocks.connected.isCheckingTerms = false;
    mocks.connected.latestTermsVersion = '1.0';
    mocks.connected.termsEffectiveDate = '2026-01-15';
    mocks.termsModal.isModalOpen = true;
  });

  // The card must open exactly once, already at its final size. It used to open
  // while the check was still running — as the narrow waiting card — and then
  // swap to the wide terms card; DialogContent transitions `all`, so that swap
  // animated width and height and the modal read as expanding outward from its
  // centre rather than sliding up. WalletChip's ConnectChecksCover holds the
  // screen for the check instead (covered in WalletChip.test).
  it('stays shut while the terms check runs, then opens straight at its full width', () => {
    mocks.connected.isCheckingTerms = true;
    const { rerender } = renderModal();

    expect(screen.queryByTestId('terms-modal')).toBeNull();

    mocks.connected.isCheckingTerms = false;
    rerender(
      <I18nProvider i18n={i18n}>
        <TermsModal />
      </I18nProvider>
    );

    const card = screen.getByTestId('terms-modal');
    expect(agreeButton()).toBeTruthy();
    // The full-size recipe, never the 300px dead-end one.
    expect(card.className).toContain('sm:min-w-152.5');
    expect(card.className).not.toContain('sm:min-w-[300px]');
  });

  // The dead ends keep the narrow card, and must reach it by opening at that
  // size rather than by resizing a card that is already on screen.
  it('opens the denied dead end straight at the narrow width', () => {
    mocks.connected.termsCheckDenied = true;
    renderModal();

    const card = screen.getByTestId('terms-modal');
    expect(card.className).toContain('sm:min-w-[300px]');
    expect(card.className).not.toContain('sm:min-w-152.5');
  });

  // The worker's /check refused the address (403) after client-side screening
  // let it through: the modal must show a dead end with a disconnect way out,
  // not interactive terms whose accept is guaranteed to fail (APP-497 review).
  it('shows the access-restricted dead end instead of the terms when the check was denied', () => {
    mocks.connected.termsCheckDenied = true;
    renderModal();

    expect(screen.getByText('Access restricted')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Agree and continue' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Wallet' }));
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    expect(mocks.closeModal).toHaveBeenCalledTimes(1);
  });

  it('disconnects the wallet when the modal is dismissed without accepting terms', () => {
    renderModal();

    fireEvent.click(screen.getByTestId('terms-modal-close'));

    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    expect(mocks.closeModal).toHaveBeenCalledTimes(1);
  });

  // APP-534: the modal is a gate, and a scrim click disconnects — so a stray
  // click beside the card would have read as the app ejecting the user.
  it('stays open on a click on the scrim', async () => {
    renderModal();

    // Radix registers its outside-pointer listener on a macrotask after mount,
    // and (since 1.1.14) only dismisses once the matching `click` lands on a
    // dismissable surface — the scrim, which is the card's portal sibling. A
    // bare pointerdown on the body dismisses nothing either way, so it would
    // pass whether or not the guard is there.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    const scrim = screen.getByTestId('terms-modal').previousElementSibling as HTMLElement;
    await act(async () => {
      fireEvent.pointerDown(scrim, { button: 0 });
      fireEvent.click(scrim, { button: 0 });
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mocks.disconnect).not.toHaveBeenCalled();
    expect(mocks.closeModal).not.toHaveBeenCalled();
    expect(screen.queryByTestId('terms-modal')).not.toBeNull();
  });

  it('does not disconnect when the modal closes after terms have been accepted', () => {
    mocks.connected.isConnectedAndAcceptedTerms = true;
    renderModal();

    fireEvent.click(screen.getByTestId('terms-modal-close'));

    expect(mocks.disconnect).not.toHaveBeenCalled();
    expect(mocks.closeModal).toHaveBeenCalledTimes(1);
  });

  // The realigned comp (1868:80727) has no Cancel: the X is the only explicit
  // exit, and it disconnects — covered by the dismissal test above.
  it('renders a single CTA with no Cancel button', () => {
    renderModal();

    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(agreeButton()).toBeTruthy();
  });

  it('keeps "Agree and continue" disabled until the box is ticked', () => {
    renderModal();

    expect(agreeButton().disabled).toBe(true);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(agreeButton().disabled).toBe(false);
  });

  // Phase A is checkbox-only: accepting records the acceptance and never asks
  // the wallet to sign, which is what unblocks hardware wallets and multisigs.
  it('records the acceptance via acceptTerms and closes on accept', async () => {
    renderModal();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(agreeButton());

    await waitFor(() => expect(mocks.closeModal).toHaveBeenCalledTimes(1));
    expect(mocks.acceptTerms).toHaveBeenCalledTimes(1);
    expect(mocks.disconnect).not.toHaveBeenCalled();
  });

  it('keeps the modal open when the acceptance could not be recorded', async () => {
    mocks.acceptTerms.mockResolvedValue(false);
    renderModal();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(agreeButton());

    await waitFor(() => expect(mocks.acceptTerms).toHaveBeenCalledTimes(1));
    expect(mocks.closeModal).not.toHaveBeenCalled();
  });

  // While the acceptance POST is in flight there must be no exit: a dismissal
  // would disconnect the wallet while the record still lands server-side.
  it('locks the close button and the checkbox while the acceptance is submitting', () => {
    mocks.acceptTerms.mockReturnValue(new Promise(() => {}));
    renderModal();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(agreeButton());

    expect((screen.getByTestId('terms-modal-close') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('checkbox') as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.disconnect).not.toHaveBeenCalled();
    expect(mocks.closeModal).not.toHaveBeenCalled();
  });

  // The component stays mounted across reconnects, so a failed accept's error
  // banner must not survive a dismissal into the next auto-open.
  it('clears the error state when the modal is dismissed after a failed acceptance', async () => {
    mocks.acceptTerms.mockResolvedValue(false);
    renderModal();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(agreeButton());
    await waitFor(() => expect(screen.getByText(/An error occurred/)).toBeTruthy());

    fireEvent.click(screen.getByTestId('terms-modal-close'));

    expect(screen.queryByText(/An error occurred/)).toBeNull();
  });

  // The terms carry BOTH a numeric version and an effective date (APP-424,
  // reversing APP-513's date-only decision), so the comp's "Version 1.0" is
  // live copy again rather than placeholder text.
  it('renders the version and the effective date in the header', () => {
    renderModal();

    expect(screen.getByText(/Version 1\.0, effective 2026-01-15/)).toBeTruthy();
  });

  // A worker predating the split sends no effectiveDate. "Version 1.0,
  // effective undefined" must not render — but the version must survive, since
  // that is what the acceptance is recorded against.
  it('keeps the version and drops only the date when the effective date is missing', () => {
    mocks.connected.termsEffectiveDate = undefined;

    renderModal();

    expect(screen.getByText(/Version 1\.0\./)).toBeTruthy();
    expect(screen.queryByText(/effective/i)).toBeNull();
    expect(screen.getByText(/Please read the full/)).toBeTruthy();
  });

  // Nothing to name at all: before the check resolves there is no version yet.
  it('renders only the plain sentence before the check resolves', () => {
    mocks.connected.latestTermsVersion = undefined;
    mocks.connected.termsEffectiveDate = undefined;

    renderModal();

    expect(screen.queryByText(/Version/)).toBeNull();
    expect(screen.getByText(/Please read the full/)).toBeTruthy();
  });
});
