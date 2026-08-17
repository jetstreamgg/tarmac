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
  connected: { isConnectedAndAcceptedTerms: false, termsCheckDenied: false },
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
    isCheckingTerms: false,
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
    mocks.termsModal.isModalOpen = true;
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

  it('disconnects when the user explicitly cancels', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    expect(mocks.closeModal).toHaveBeenCalledTimes(1);
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
  it('locks Cancel, close and the checkbox while the acceptance is submitting', () => {
    mocks.acceptTerms.mockReturnValue(new Promise(() => {}));
    renderModal();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(agreeButton());

    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('terms-modal-close') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('checkbox') as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.disconnect).not.toHaveBeenCalled();
    expect(mocks.closeModal).not.toHaveBeenCalled();
  });

  // closeModal() is a controlled-prop flip, so onOpenChange's reset never runs
  // on the Cancel path — without its own reset a failed accept's error banner
  // would survive into the next auto-open (the component stays mounted).
  it('clears the error state when the user cancels after a failed acceptance', async () => {
    mocks.acceptTerms.mockResolvedValue(false);
    renderModal();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(agreeButton());
    await waitFor(() => expect(screen.getByText(/An error occurred/)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText(/An error occurred/)).toBeNull();
  });

  // The terms carry an effective date and no version label (APP-513): the
  // footer must render the date and nothing in the modal may say "version"
  // outside the fixed acceptance-record sentence.
  it('renders the effective date in the footer with no version label', () => {
    renderModal();

    expect(screen.getByText(/Terms of Use effective 2026-01-15/)).toBeTruthy();
    expect(screen.queryByText(/version 2026-01-15/i)).toBeNull();
  });
});
