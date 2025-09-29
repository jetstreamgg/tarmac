import { createContext, useContext, useState, ReactNode, Suspense } from 'react';
import { ConnectModal } from '../components/ConnectModal';

interface ConnectModalContextType {
  isOpen: boolean;
  openConnectModal: () => void;
  closeConnectModal: () => void;
}

const ConnectModalContext = createContext<ConnectModalContextType | undefined>(undefined);

export function ConnectModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openConnectModal = () => setIsOpen(true);
  const closeConnectModal = () => setIsOpen(false);

  return (
    <ConnectModalContext.Provider value={{ isOpen, openConnectModal, closeConnectModal }}>
      {children}
      <Suspense fallback={null}>{isOpen && <ConnectModal open={isOpen} onOpenChange={setIsOpen} />}</Suspense>
    </ConnectModalContext.Provider>
  );
}

export function useConnectModal() {
  const context = useContext(ConnectModalContext);
  if (!context) {
    throw new Error('useConnectModal must be used within ConnectModalProvider');
  }
  return context;
}
