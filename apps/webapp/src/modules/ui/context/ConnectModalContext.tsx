import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
  Suspense
} from 'react';
import { ConnectModal } from '../components/ConnectModal';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import type { ConnectReason } from '@/modules/analytics/constants';

interface ConnectModalContextType {
  isOpen: boolean;
  openConnectModal: (reason?: ConnectReason) => void;
  closeConnectModal: () => void;
}

export const ConnectModalContext = createContext<ConnectModalContextType | undefined>(undefined);

/** Matches the dismissal in `components/ui/dialog.tsx`. */
const MODAL_EXIT_MS = 300;

export function ConnectModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const { trackConnectModalOpened } = useAppAnalytics();
  // `isOpen` gates the modal so its lazy chunk stays off the initial load, but
  // that also unmounted it in the same tick it was told to close, cutting the
  // exit animation. Mounting is held for the length of that animation and then
  // released, so the modal still gets a fresh mount on the next open.
  const [mounted, setMounted] = useState(false);
  const unmountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setOpen = useCallback((next: boolean) => {
    setIsOpen(next);
    if (unmountTimer.current) clearTimeout(unmountTimer.current);
    if (next) {
      setMounted(true);
    } else {
      unmountTimer.current = setTimeout(() => setMounted(false), MODAL_EXIT_MS);
    }
  }, []);

  useEffect(() => () => (unmountTimer.current ? clearTimeout(unmountTimer.current) : undefined), []);

  // Funnel top (APP-444 C4): every open names why — gated actions pass their
  // reason through ConnectThenAct; bare opens are the generic connect button.
  // Callers use this as an onClick handler, so the first arg may be an event.
  const openConnectModal = useCallback(
    (reason?: ConnectReason) => {
      trackConnectModalOpened({ connectReason: typeof reason === 'string' ? reason : 'connect_button' });
      setOpen(true);
    },
    [setOpen, trackConnectModalOpened]
  );
  const closeConnectModal = useCallback(() => setOpen(false), [setOpen]);

  return (
    <ConnectModalContext.Provider value={{ isOpen, openConnectModal, closeConnectModal }}>
      {children}
      <Suspense fallback={null}>{mounted && <ConnectModal open={isOpen} onOpenChange={setOpen} />}</Suspense>
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
