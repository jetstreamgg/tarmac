import type { DisconnectSource } from '../constants';

/**
 * Hand-off between disconnect triggers and useWalletAnalytics: the surface that
 * initiates a disconnect records why just before calling wagmi's disconnect(),
 * and the onDisconnect listener consumes it. Anything unclaimed (wallet-side
 * disconnects, extension lock) reads as 'external'.
 */

let pending: DisconnectSource | null = null;

export function setDisconnectSource(source: DisconnectSource): void {
  pending = source;
}

/** Read-and-clear; defaults to 'external' when no surface claimed the disconnect. */
export function consumeDisconnectSource(): DisconnectSource {
  const current = pending;
  pending = null;
  return current ?? 'external';
}
