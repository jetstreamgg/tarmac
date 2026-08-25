import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TermsModal } from './TermsModal';

// Mutable state + spies shared between the mocks and the assertions.
const mocks = vi.hoisted(() => ({
  disconnect: vi.fn(),
  closeModal: vi.fn(),
  openModal: vi.fn(),
  acceptTerms: vi.fn(),
  retryTermsCheck: vi.fn(),
  connected: { isConnectedAndAcceptedTerms: false, termsCheckDenied: false, isCheckingTerms: false },
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
    latestTermsVersion: '2026-01-15',
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
    mocks.termsModal.isModalOpen = true;
  });

  // The card must open exactly once, already at its final size: a modal that
  // opened compact and then grew into the terms read as expanding outward from
  // its centre rather than sliding up like the rest of the app's modals.
  it('covers the screen instead of opening the card while the terms check runs', () => {
    mocks.connected.isCheckingTerms = true;
    const { rerender } = renderModal();

    expect(screen.getByTestId('terms-check-cover')).toBeTruthy();
    expect(screen.queryByTestId('terms-modal')).toBeNull();

    mocks.connected.isCheckingTerms = false;
    rerender(
      <I18nProvider i18n={i18n}>
        <TermsModal />
      </I18nProvider>
    );

    expect(screen.getByTestId('terms-modal')).toBeTruthy();
    expect(agreeButton()).toBeTruthy();
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

  // The terms carry an effective date and no version label (APP-513): the
  // header subtitle must render the date and nothing in the modal may say
  // "version" — the comp's "Version 1.0" is placeholder text.
  it('renders the effective date in the header with no version label', () => {
    renderModal();

    expect(screen.getByText(/Terms of Use effective 2026-01-15/)).toBeTruthy();
    expect(screen.queryByText(/version 2026-01-15/i)).toBeNull();
  });
});
