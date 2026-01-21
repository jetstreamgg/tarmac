import React, { useState, useContext, useEffect } from 'react';
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
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const { openConnectModal } = useConnectModal();

  useConnectionEffect({
    onConnect: () => {
      if (!isModalOpen && !isConnectedAndAcceptedTerms) {
        setIsModalOpen(true);
      }
    }
  });

  useEffect(() => {
    if (isConnectedAndAcceptedTerms) {
      closeModal();
    }
  }, [isConnectedAndAcceptedTerms]);

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
