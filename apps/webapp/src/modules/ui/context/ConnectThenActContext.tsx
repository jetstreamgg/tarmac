import { createContext, useCallback, useContext, useEffect, useRef, ReactNode } from 'react';
import { useConnection } from 'wagmi';
import { useConnectedContext } from './ConnectedContext';
import { useConnectModal } from './ConnectModalContext';

interface ConnectThenActContextType {
  runOrConnect: (action: () => void) => void;
}

/**
 * Pause between the connect flow completing (connect modal closing) and the
 * continued action opening its own modal, so one dialog doesn't flash into
 * the next mid-animation.
 */
export const CONTINUATION_DELAY_MS = 500;

const ConnectThenActContext = createContext<ConnectThenActContextType | undefined>(undefined);

export function ConnectThenActProvider({ children }: { children: ReactNode }) {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const { isOpen, openConnectModal } = useConnectModal();
  const { isConnected, isConnecting } = useConnection();

  // Single pending-intent slot: the action the user was blocked on when they
  // triggered the connect flow. Last click wins; consumed exactly once.
  const pendingActionRef = useRef<(() => void) | null>(null);

  const runOrConnect = useCallback(
    (action: () => void) => {
      if (isConnectedAndAcceptedTerms) {
        action();
        return;
      }
      pendingActionRef.current = action;
      openConnectModal();
    },
    [isConnectedAndAcceptedTerms, openConnectModal]
  );

  // An intent only survives while a connect flow is plausibly in progress:
  // the connect modal is open, an attempt is in flight (dialog dismissed but
  // the wallet request may still be approved), or the wallet is connected and
  // awaiting the terms gate. Modal closed + disconnected + idle means the
  // flow was abandoned (dismissal, or terms declined — which disconnects),
  // so drop the intent.
  useEffect(() => {
    if (!isOpen && !isConnected && !isConnecting) {
      pendingActionRef.current = null;
    }
  }, [isOpen, isConnected, isConnecting]);

  useEffect(() => {
    if (isConnectedAndAcceptedTerms && pendingActionRef.current) {
      const timeout = setTimeout(() => {
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        action?.();
      }, CONTINUATION_DELAY_MS);
      // If the ready state is lost mid-pause (e.g. disconnect), cancel the run;
      // the intent stays in the slot and the abandonment effect above decides
      // whether it survives.
      return () => clearTimeout(timeout);
    }
  }, [isConnectedAndAcceptedTerms]);

  return <ConnectThenActContext.Provider value={{ runOrConnect }}>{children}</ConnectThenActContext.Provider>;
}

export function useConnectThenAct(action: () => void) {
  const context = useContext(ConnectThenActContext);
  if (!context) {
    throw new Error('useConnectThenAct must be used within ConnectThenActProvider');
  }
  const { runOrConnect } = context;
  return useCallback(() => runOrConnect(action), [runOrConnect, action]);
}
