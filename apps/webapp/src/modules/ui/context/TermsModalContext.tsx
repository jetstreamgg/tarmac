import React, { useState, useContext, useEffect } from 'react';
import { useConnection } from 'wagmi';
import { useConnectModal } from '../context/ConnectModalContext';
import { useConnectedContext } from './ConnectedContext';
const TermsModalContext = React.createContext({
  isModalOpen: false,
  openModal: () => {},
  closeModal: () => {}
});

export function TermsModalProvider({ children }: { children: React.ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  // One auto-open per connection. Watching `isModalOpen` instead would reopen
  // the modal against a dismissal: dismissing disconnects (TermsModal), but
  // wagmi reports the disconnect asynchronously, so for a few renders the
  // state still reads connected-without-terms.
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const { isConnectedAndAcceptedTerms, termsCheckError, isAuthorized } = useConnectedContext();
  const { isConnected } = useConnection();
  const { openConnectModal } = useConnectModal();

  // Derived from state rather than the connect event: the flow puts address
  // screening between wallet selection and the T&C gate (APP-497), and
  // `isAuthorized` stays false until screening resolves — so a blocked wallet
  // gets the blocked screen and never sees the terms modal.
  useEffect(() => {
    if (!isConnected) {
      // Also drop any open state: a modal latched open during a connection
      // must not greet the next one (found in APP-497 QA — a blocked wallet's
      // disconnect surfaced the terms modal it was never supposed to see).
      setHasAutoOpened(false);
      setIsModalOpen(false);
      return;
    }
    if (!hasAutoOpened && isAuthorized && !isConnectedAndAcceptedTerms && !termsCheckError) {
      setHasAutoOpened(true);
      setIsModalOpen(true);
    }
  }, [isConnected, isAuthorized, isConnectedAndAcceptedTerms, termsCheckError, hasAutoOpened]);

  useEffect(() => {
    if (isConnectedAndAcceptedTerms) {
      closeModal();
    }
  }, [isConnectedAndAcceptedTerms]);

  useEffect(() => {
    // Guarded on the connection: the error flag can land on a disconnected app
    // when the failing /check resolves in the gap between wagmi's disconnect
    // and the address effect that would have discarded it (the ref moves in a
    // passive effect, after paint) — and an unguarded open here would strand
    // the modal over a disconnected page.
    if (termsCheckError && isConnected) {
      setIsModalOpen(true);
    }
  }, [termsCheckError, isConnected]);

  const openModal = () => {
    if (!isConnectedAndAcceptedTerms && openConnectModal) {
      openConnectModal();
    } else {
      setIsModalOpen(!isConnectedAndAcceptedTerms || true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <TermsModalContext.Provider value={{ isModalOpen, openModal, closeModal }}>
      {children}
    </TermsModalContext.Provider>
  );
}

export function useTermsModal() {
  return useContext(TermsModalContext);
}
