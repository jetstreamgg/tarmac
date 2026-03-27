import { useEffect, useRef } from 'react';
import { useConnection } from 'wagmi';
import { useAppAnalytics } from './useAppAnalytics';

/**
 * Fires `app_wallet_connected` and `app_wallet_disconnected` events
 * on actual connection state transitions.
 *
 * Skips the initial state on mount — only tracks transitions that happen
 * while the component is mounted (or auto-reconnect on page load).
 *
 * Call once in a component that's always mounted (e.g. Layout).
 */
export function useWalletAnalytics() {
  const { isConnected, connector } = useConnection();
  const { trackWalletConnected, trackWalletDisconnected } = useAppAnalytics();

  const walletName = connector?.name ?? 'unknown';

  // null = first run (not yet seeded)
  const prevRef = useRef<{ connected: boolean; walletName: string } | null>(null);

  useEffect(() => {
    // First run: seed with current state, don't fire an event
    if (prevRef.current === null) {
      prevRef.current = { connected: isConnected, walletName };
      return;
    }

    const prev = prevRef.current;

    if (isConnected && !prev.connected) {
      trackWalletConnected({ walletName });
    } else if (!isConnected && prev.connected) {
      trackWalletDisconnected({ walletName: prev.walletName });
    }

    prevRef.current = { connected: isConnected, walletName };
  }, [isConnected, walletName, trackWalletConnected, trackWalletDisconnected]);
}
