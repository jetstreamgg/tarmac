import React, { useState, useContext } from 'react';
import { useConnectionEffect } from 'wagmi';
import { useConnectModal } from '../context/ConnectModalContext';
import { useConnectedContext } from './ConnectedContext';
const TermsModalContext = React.createContext({
  isModalOpen: false,
  openModal: () => {},
  closeModal: () => {}
});

export function TermsModalProvider({ children }: { children: React.ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isConnectedAndAcceptedTerms, termsCheckError } = useConnectedContext();
  const { openConnectModal } = useConnectModal();

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

  useConnectionEffect({
    onConnect: () => {
      if (!isModalOpen && !isConnectedAndAcceptedTerms && !termsCheckError) {
        setIsModalOpen(true);
      }
    }
  });

  // Auto-close when terms become accepted, auto-open on terms-check error.
  // Render-time prev-tracking replaces two useEffects to avoid
  // set-state-in-effect. `undefined` sentinel ensures the body runs on
  // first render too (matching useEffect's mount-fire semantics) — without
  // it, prev === current on mount and the block would be skipped.
  const [prevAccepted, setPrevAccepted] = useState<boolean | undefined>(undefined);
  if (prevAccepted !== isConnectedAndAcceptedTerms) {
    setPrevAccepted(isConnectedAndAcceptedTerms);
    if (isConnectedAndAcceptedTerms) {
      closeModal();
    }
  }

  const [prevTermsCheckError, setPrevTermsCheckError] = useState<boolean | undefined>(undefined);
  if (prevTermsCheckError !== termsCheckError) {
    setPrevTermsCheckError(termsCheckError);
    if (termsCheckError) {
      setIsModalOpen(true);
    }
  }

  return (
    <TermsModalContext.Provider value={{ isModalOpen, openModal, closeModal }}>
      {children}
    </TermsModalContext.Provider>
  );
}

export function useTermsModal() {
  return useContext(TermsModalContext);
}
