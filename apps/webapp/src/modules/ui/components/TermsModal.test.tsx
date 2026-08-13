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
  connected: { isConnectedAndAcceptedTerms: false },
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
    retryTermsCheck: mocks.retryTermsCheck,
    isConnectedAndAcceptedTerms: mocks.connected.isConnectedAndAcceptedTerms,
    latestTermsVersion: '2026-01-15',
    acceptTerms: mocks.acceptTerms
  })
}));

vi.mock('./terms-loader', () => ({
  getTermsContent: () => '# Terms'
}));

// Stub the dialog so we can drive its callbacks directly. This isolates TermsModal's
// handlers (the unit under test) from Radix Dialog internals and intersection observers.
vi.mock('./TermsDialog', () => ({
  TermsDialog: ({
    isOpen,
    onOpenChange,
    onAccept,
    onDecline
  }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onAccept: () => void;
    onDecline: () => void;
  }) =>
    isOpen ? (
      <div>
        <button data-testid="dismiss" onClick={() => onOpenChange(false)}>
          dismiss
        </button>
        <button data-testid="accept" onClick={onAccept}>
          accept
        </button>
        <button data-testid="decline" onClick={onDecline}>
          decline
        </button>
      </div>
    ) : null
}));

describe('TermsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.acceptTerms.mockResolvedValue(true);
    mocks.connected.isConnectedAndAcceptedTerms = false;
    mocks.termsModal.isModalOpen = true;
  });

  it('disconnects the wallet when the modal is dismissed without accepting terms', () => {
    render(<TermsModal />);

    fireEvent.click(screen.getByTestId('dismiss'));

    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    expect(mocks.closeModal).toHaveBeenCalledTimes(1);
  });

  it('does not disconnect when the modal closes after terms have been accepted', () => {
    mocks.connected.isConnectedAndAcceptedTerms = true;
    render(<TermsModal />);

    fireEvent.click(screen.getByTestId('dismiss'));

    expect(mocks.disconnect).not.toHaveBeenCalled();
    expect(mocks.closeModal).toHaveBeenCalledTimes(1);
  });

  it('does not disconnect when the user accepts (accept path bypasses onOpenChange)', () => {
    render(<TermsModal />);

    fireEvent.click(screen.getByTestId('accept'));

    expect(mocks.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects when the user explicitly rejects', () => {
    render(<TermsModal />);

    fireEvent.click(screen.getByTestId('decline'));

    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    expect(mocks.closeModal).toHaveBeenCalledTimes(1);
  });

  // Phase A is checkbox-only: accepting records the acceptance and never asks
  // the wallet to sign, which is what unblocks hardware wallets and multisigs.
  it('records the acceptance and closes on accept', async () => {
    render(<TermsModal />);

    fireEvent.click(screen.getByTestId('accept'));

    await waitFor(() => expect(mocks.closeModal).toHaveBeenCalledTimes(1));
    expect(mocks.acceptTerms).toHaveBeenCalledTimes(1);
  });

  it('keeps the modal open when the acceptance could not be recorded', async () => {
    mocks.acceptTerms.mockResolvedValue(false);
    render(<TermsModal />);

    fireEvent.click(screen.getByTestId('accept'));

    await waitFor(() => expect(mocks.acceptTerms).toHaveBeenCalledTimes(1));
    expect(mocks.closeModal).not.toHaveBeenCalled();
  });
});
