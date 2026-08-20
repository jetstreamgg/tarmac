import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TermsModalProvider, useTermsModal } from './TermsModalContext';

/**
 * The auto-open policy lives in TermsModalProvider's effects. The error effect
 * must be connection-guarded: `termsCheckError` can land on a DISCONNECTED app
 * when the failing /check resolves in the gap between wagmi's disconnect and
 * ConnectedContext's address effect (which moves the discard ref only after
 * paint) — an unguarded open would strand the terms modal over a disconnected
 * page, where nothing ever closes it again.
 */

const mocks = vi.hoisted(() => ({
  connected: {
    isConnectedAndAcceptedTerms: false,
    termsCheckError: false,
    isAuthorized: false
  },
  isConnected: false,
  openConnectModal: vi.fn()
}));

vi.mock('./ConnectedContext', () => ({
  useConnectedContext: () => mocks.connected
}));
vi.mock('wagmi', () => ({
  useConnection: () => ({ isConnected: mocks.isConnected })
}));
vi.mock('../context/ConnectModalContext', () => ({
  useConnectModal: () => ({ openConnectModal: mocks.openConnectModal })
}));

const ModalState = () => {
  const { isModalOpen } = useTermsModal();
  return <div data-testid="modal-open">{String(isModalOpen)}</div>;
};

const renderProvider = () =>
  render(
    <TermsModalProvider>
      <ModalState />
    </TermsModalProvider>
  );

describe('TermsModalProvider error-effect gating', () => {
  it('does not open on a terms-check error while disconnected (stranded-modal regression)', () => {
    mocks.isConnected = false;
    mocks.connected = { isConnectedAndAcceptedTerms: false, termsCheckError: false, isAuthorized: false };
    const { rerender } = renderProvider();
    expect(screen.getByTestId('modal-open').textContent).toBe('false');

    // The failing check's continuation lands after the disconnect commit: the
    // error flag flips true with no connection behind it.
    mocks.connected = { ...mocks.connected, termsCheckError: true };
    rerender(
      <TermsModalProvider>
        <ModalState />
      </TermsModalProvider>
    );
    expect(screen.getByTestId('modal-open').textContent).toBe('false');
  });

  it('still opens on a terms-check error while connected (the retryable error state)', () => {
    mocks.isConnected = true;
    mocks.connected = { isConnectedAndAcceptedTerms: false, termsCheckError: true, isAuthorized: false };
    renderProvider();
    expect(screen.getByTestId('modal-open').textContent).toBe('true');
  });

  it('auto-opens once when connected, authorized and unaccepted', () => {
    mocks.isConnected = true;
    mocks.connected = { isConnectedAndAcceptedTerms: false, termsCheckError: false, isAuthorized: true };
    renderProvider();
    expect(screen.getByTestId('modal-open').textContent).toBe('true');
  });
});
