import { useRef } from 'react';
import { useConnectionEffect } from 'wagmi';
import { useAppAnalytics } from './useAppAnalytics';
import { consumeDisconnectSource } from '../lib/disconnectSource';

/**
 * Fires `app_wallet_connected` and `app_wallet_disconnected` on real connection
 * transitions. Event- not state-based on purpose: wagmi's silent auto-reconnect
 * on every refresh must never read as "the user just connected" (APP-444 C1).
 *
 * Call once in a component that's always mounted (e.g. Layout).
 */
export function useWalletAnalytics() {
  const { trackWalletConnected, trackWalletDisconnected } = useAppAnalytics();

  // onDisconnect carries no connector, so remember the last connected wallet's
  // name (reconnects included — their later disconnect should still be named).
  const lastWalletRef = useRef('unknown');

  useConnectionEffect({
    onConnect: data => {
      lastWalletRef.current = data.connector?.name ?? 'unknown';
      if (!data.isReconnected) {
        trackWalletConnected({ walletName: lastWalletRef.current });
      }
    },
    onDisconnect: () => {
      trackWalletDisconnected({
        walletName: lastWalletRef.current,
        disconnectSource: consumeDisconnectSource()
      });
    }
  });
}
