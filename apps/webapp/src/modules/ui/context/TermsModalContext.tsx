import React, { useState, useContext } from 'react';
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

  // The open state is adjusted during render (React's "adjusting state when a
  // prop changes"): each block sets state on a transition it can observe, so
  // the render that carries the change also carries the answer.
  const connectedAddress = isConnected && address ? address : undefined;

  // A connection ending drops any open state: a modal latched open during a
  // connection must not greet the next one (found in APP-497 QA — a blocked
  // wallet's disconnect surfaced the terms modal it was never supposed to see).
  const [prevConnectedAddress, setPrevConnectedAddress] = useState(connectedAddress);
  if (connectedAddress !== prevConnectedAddress) {
    setPrevConnectedAddress(connectedAddress);
    if (!connectedAddress) {
      setAutoOpenedForAddress(undefined);
      setIsModalOpen(false);
    }
  }

  // Derived from state rather than the connect event: once `/check` says the
  // terms must be shown, ConnectedContext screens the address first and
  // `isAuthorized` stays false until that resolves — so a blocked wallet gets
  // the blocked screen and never sees the terms. (The latch may already be set
  // from the `/check` wait; WalletChip only mounts the modal while authorized.)
  // That also makes this cover the account switch for free: ConnectedContext
  // drops the terms verdict on every address change, so the switched-in
  // address arrives here in exactly the state a fresh connection would.
  if (
    connectedAddress &&
    autoOpenedForAddress !== connectedAddress &&
    isAuthorized &&
    !isConnectedAndAcceptedTerms &&
    !termsCheckError
  ) {
    setAutoOpenedForAddress(connectedAddress);
    setIsModalOpen(true);
  }

  // Acceptance landing closes the modal. Only the transition closes it: a
  // manual open while already accepted (reading the terms) stays open.
  const [prevAccepted, setPrevAccepted] = useState(isConnectedAndAcceptedTerms);
  if (isConnectedAndAcceptedTerms !== prevAccepted) {
    setPrevAccepted(isConnectedAndAcceptedTerms);
    if (isConnectedAndAcceptedTerms) {
      setIsModalOpen(false);
    }
  }

  // Guarded on the connection: the error flag can land on a disconnected app
  // when the failing /check resolves in the gap between wagmi's disconnect and
  // the address reset that would have discarded it — and an unguarded open
  // here would strand the modal over a disconnected page.
  const errorNeedsModal = termsCheckError && isConnected;
  const [prevErrorNeedsModal, setPrevErrorNeedsModal] = useState(false);
  if (errorNeedsModal !== prevErrorNeedsModal) {
    setPrevErrorNeedsModal(errorNeedsModal);
    if (errorNeedsModal) {
      setIsModalOpen(true);
    }
  }

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
