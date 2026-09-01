import { fireEvent, render, screen } from '@testing-library/react';
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
  address: undefined as string | undefined,
  openConnectModal: vi.fn()
}));

vi.mock('./ConnectedContext', () => ({
  useConnectedContext: () => mocks.connected
}));
vi.mock('wagmi', () => ({
  useConnection: () => ({ isConnected: mocks.isConnected, address: mocks.address })
}));
vi.mock('../context/ConnectModalContext', () => ({
  useConnectModal: () => ({ openConnectModal: mocks.openConnectModal })
}));

const ADDRESS_A = '0x1111111111111111111111111111111111111111';
const ADDRESS_B = '0x2222222222222222222222222222222222222222';

const ModalState = () => {
  const { isModalOpen, closeModal } = useTermsModal();
  return (
    <>
      <div data-testid="modal-open">{String(isModalOpen)}</div>
      <button data-testid="close-modal" onClick={closeModal} />
    </>
  );
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
    mocks.address = ADDRESS_A;
    mocks.connected = { isConnectedAndAcceptedTerms: false, termsCheckError: true, isAuthorized: false };
    renderProvider();
    expect(screen.getByTestId('modal-open').textContent).toBe('true');
  });

  it('auto-opens once when connected, authorized and unaccepted', () => {
    mocks.isConnected = true;
    mocks.address = ADDRESS_A;
    mocks.connected = { isConnectedAndAcceptedTerms: false, termsCheckError: false, isAuthorized: true };
    renderProvider();
    expect(screen.getByTestId('modal-open').textContent).toBe('true');
  });
});

/**
 * APP-534. Switching accounts inside the wallet keeps `isConnected` true, so a
 * latch keyed to the connection never reopens the gate — the switched-in
 * address browsed on with no terms verdict at all.
 */
describe('TermsModalProvider account switching', () => {
  it('re-opens for an address switched in inside the wallet', () => {
    mocks.isConnected = true;
    mocks.address = ADDRESS_A;
    mocks.connected = { isConnectedAndAcceptedTerms: true, termsCheckError: false, isAuthorized: true };
    const { rerender } = renderProvider();
    expect(screen.getByTestId('modal-open').textContent).toBe('false');

    // The switch: same connection, new address, and ConnectedContext has
    // dropped the terms verdict that belonged to the previous one.
    mocks.address = ADDRESS_B;
    mocks.connected = { isConnectedAndAcceptedTerms: false, termsCheckError: false, isAuthorized: true };
    rerender(
      <TermsModalProvider>
        <ModalState />
      </TermsModalProvider>
    );
    expect(screen.getByTestId('modal-open').textContent).toBe('true');
  });

  it('does not re-open for the same address after a dismissal', () => {
    mocks.isConnected = true;
    mocks.address = ADDRESS_A;
    mocks.connected = { isConnectedAndAcceptedTerms: false, termsCheckError: false, isAuthorized: true };
    const { rerender } = renderProvider();
    expect(screen.getByTestId('modal-open').textContent).toBe('true');

    // Dismissing disconnects, but wagmi reports that asynchronously: for these
    // renders the app still reads connected-without-terms at the same address.
    fireEvent.click(screen.getByTestId('close-modal'));
    rerender(
      <TermsModalProvider>
        <ModalState />
      </TermsModalProvider>
    );
    expect(screen.getByTestId('modal-open').textContent).toBe('false');
  });

  it('leaves the gate closed when the switched-in address has already accepted', () => {
    mocks.isConnected = true;
    mocks.address = ADDRESS_A;
    mocks.connected = { isConnectedAndAcceptedTerms: true, termsCheckError: false, isAuthorized: true };
    const { rerender } = renderProvider();

    mocks.address = ADDRESS_B;
    rerender(
      <TermsModalProvider>
        <ModalState />
      </TermsModalProvider>
    );
    expect(screen.getByTestId('modal-open').textContent).toBe('false');
  });
});
