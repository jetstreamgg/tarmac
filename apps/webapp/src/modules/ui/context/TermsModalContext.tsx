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
  // One auto-open per *address*, not per connection (APP-534). Keying it to the
  // connection let an in-wallet account switch through the gate entirely:
  // wagmi keeps `isConnected` true across the switch, so the latch stayed set
  // while the new address had no terms verdict at all — the header fell back to
  // "Connect Wallet" and nothing ever re-prompted. Holding the address the
  // latch was set for still blocks the reopen-against-a-dismissal case the
  // boolean existed for: dismissing disconnects (TermsModal), but wagmi reports
  // that asynchronously, and through those renders the address is unchanged.
  const [autoOpenedForAddress, setAutoOpenedForAddress] = useState<string | undefined>(undefined);
  const { isConnectedAndAcceptedTerms, termsCheckError, isAuthorized } = useConnectedContext();
  const { isConnected, address } = useConnection();
  const { openConnectModal } = useConnectModal();

  // Derived from state rather than the connect event: the flow puts address
  // screening between wallet selection and the T&C gate (APP-497), and
  // `isAuthorized` stays false until screening resolves — so a blocked wallet
  // gets the blocked screen and never sees the terms modal. That also makes
  // this cover the account switch for free: ConnectedContext drops the terms
  // verdict and re-runs screening on every address change, so the switched-in
  // address arrives here in exactly the state a fresh connection would.
  useEffect(() => {
    if (!isConnected || !address) {
      // Also drop any open state: a modal latched open during a connection
      // must not greet the next one (found in APP-497 QA — a blocked wallet's
      // disconnect surfaced the terms modal it was never supposed to see).
      setAutoOpenedForAddress(undefined);
      setIsModalOpen(false);
      return;
    }
    if (
      autoOpenedForAddress !== address &&
      isAuthorized &&
      !isConnectedAndAcceptedTerms &&
      !termsCheckError
    ) {
      setAutoOpenedForAddress(address);
      setIsModalOpen(true);
    }
  }, [
    isConnected,
    address,
    isAuthorized,
    isConnectedAndAcceptedTerms,
    termsCheckError,
    autoOpenedForAddress
  ]);

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
