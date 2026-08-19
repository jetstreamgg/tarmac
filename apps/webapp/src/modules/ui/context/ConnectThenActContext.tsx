import { createContext, useCallback, useContext, useEffect, useRef, ReactNode } from 'react';
import { useConnection } from 'wagmi';
import { useConnectedContext } from './ConnectedContext';
import { useConnectModal } from './ConnectModalContext';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import { useAnalyticsFlow } from '@/modules/analytics/context/AnalyticsFlowContext';
import type { ConnectReason } from '@/modules/analytics/constants';

interface ConnectThenActContextType {
  runOrConnect: (action: () => void, reason?: ConnectReason) => void;
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
  const { trackGatedActionResolved } = useAppAnalytics();
  const { startNewFlow } = useAnalyticsFlow();

  // Single pending-intent slot: the action the user was blocked on when they
  // triggered the connect flow, plus why (for the resolved event). Last click
  // wins; consumed exactly once.
  const pendingActionRef = useRef<{ action: () => void; reason: ConnectReason } | null>(null);

  const runOrConnect = useCallback(
    (action: () => void, reason: ConnectReason = 'connect_button') => {
      if (isConnectedAndAcceptedTerms) {
        action();
        return;
      }
      pendingActionRef.current = { action, reason };
      openConnectModal(reason);
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
    if (!isOpen && !isConnected && !isConnecting && pendingActionRef.current) {
      trackGatedActionResolved({
        outcome: 'abandoned',
        connectReason: pendingActionRef.current.reason
      });
      pendingActionRef.current = null;
    }
  }, [isOpen, isConnected, isConnecting, trackGatedActionResolved]);

  useEffect(() => {
    if (isConnectedAndAcceptedTerms && pendingActionRef.current) {
      const timeout = setTimeout(() => {
        const pending = pendingActionRef.current;
        pendingActionRef.current = null;
        if (!pending) return;
        // The resumed action opens its own funnel — rotate first so the
        // resolved event carries the flow_id it joins (APP-444 C5).
        startNewFlow();
        trackGatedActionResolved({ outcome: 'completed', connectReason: pending.reason });
        pending.action();
      }, CONTINUATION_DELAY_MS);
      // If the ready state is lost mid-pause (e.g. disconnect), cancel the run;
      // the intent stays in the slot and the abandonment effect above decides
      // whether it survives.
      return () => clearTimeout(timeout);
    }
  }, [isConnectedAndAcceptedTerms, startNewFlow, trackGatedActionResolved]);

  return <ConnectThenActContext.Provider value={{ runOrConnect }}>{children}</ConnectThenActContext.Provider>;
}

export function useConnectThenAct(action: () => void, reason?: ConnectReason) {
  const context = useContext(ConnectThenActContext);
  if (!context) {
    throw new Error('useConnectThenAct must be used within ConnectThenActProvider');
  }
  const { runOrConnect } = context;
  return useCallback(() => runOrConnect(action, reason), [runOrConnect, action, reason]);
}
