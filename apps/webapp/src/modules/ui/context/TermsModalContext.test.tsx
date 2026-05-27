/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { WagmiWrapper } from '../../../../test/widgets/WagmiWrapper';
import { ConnectedContext } from './ConnectedContext';
import { TermsModalProvider, useTermsModal } from './TermsModalContext';

/**
 * Characterization tests for TermsModalProvider's two upstream-signal effects:
 *
 *  1. termsCheckError=true → modal opens (setIsModalOpen(true) effect).
 *  2. isConnectedAndAcceptedTerms flipping to true while the modal is open
 *     → modal auto-closes (closeModal effect).
 *
 * Locks in the observable behavior so the refactor from useEffect-based sync
 * to render-time prev-tracking doesn't regress.
 */

type CtxValue = {
  isConnectedAndAcceptedTerms: boolean;
  isAuthorized: boolean;
  setHasAcceptedTerms: () => void;
  isCheckingTerms: boolean;
  termsCheckError: boolean;
  retryTermsCheck: () => void;
  authData: { authIsLoading: boolean };
  vpnData: { vpnIsLoading: boolean };
};

const buildCtx = (overrides: Partial<CtxValue>): CtxValue => ({
  isConnectedAndAcceptedTerms: false,
  isAuthorized: false,
  setHasAcceptedTerms: () => {},
  isCheckingTerms: false,
  termsCheckError: false,
  retryTermsCheck: () => {},
  authData: { authIsLoading: false },
  vpnData: { vpnIsLoading: false },
  ...overrides
});

function ProbeChild() {
  const { isModalOpen } = useTermsModal();
  return <div data-testid="modal-state">{isModalOpen ? 'open' : 'closed'}</div>;
}

function TestSubject({ ctxValue }: { ctxValue: CtxValue }) {
  return (
    <ConnectedContext.Provider value={ctxValue}>
      <TermsModalProvider>
        <ProbeChild />
      </TermsModalProvider>
    </ConnectedContext.Provider>
  );
}

describe('TermsModalContext upstream-signal effects', () => {
  beforeEach(() => {
    //@ts-expect-error ResizeObserver is required in the Window interface
    delete window.ResizeObserver;
    window.ResizeObserver = vi.fn().mockImplementation(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    });
  });

  afterEach(() => {
    window.ResizeObserver = ResizeObserver;
    vi.restoreAllMocks();
  });

  it('opens the modal when termsCheckError is true at mount', async () => {
    // Characterizes the useEffect(setIsModalOpen(true), [termsCheckError]).
    // The effect fires on mount with termsCheckError=true, opening the modal.
    const withError = buildCtx({ termsCheckError: true });
    render(<TestSubject ctxValue={withError} />, { wrapper: WagmiWrapper });

    await waitFor(() => {
      expect(screen.getByTestId('modal-state').textContent).toBe('open');
    });
  });

  it('closes the modal when isConnectedAndAcceptedTerms becomes true', async () => {
    // Mount with the modal already open (via termsCheckError), then flip
    // isConnectedAndAcceptedTerms and assert the closeModal effect runs.
    const errorOpens = buildCtx({ termsCheckError: true, isConnectedAndAcceptedTerms: false });
    const { rerender } = render(<TestSubject ctxValue={errorOpens} />, { wrapper: WagmiWrapper });

    await waitFor(() => {
      expect(screen.getByTestId('modal-state').textContent).toBe('open');
    });

    const accepted = buildCtx({ termsCheckError: true, isConnectedAndAcceptedTerms: true });
    rerender(<TestSubject ctxValue={accepted} />);

    await waitFor(() => {
      expect(screen.getByTestId('modal-state').textContent).toBe('closed');
    });
  });

  it('keeps the modal closed when termsCheckError stays false', () => {
    // Sanity check: no error, no acceptance signal, modal stays closed.
    const quiet = buildCtx({ termsCheckError: false, isConnectedAndAcceptedTerms: false });
    render(<TestSubject ctxValue={quiet} />, { wrapper: WagmiWrapper });
    expect(screen.getByTestId('modal-state').textContent).toBe('closed');
  });
});
