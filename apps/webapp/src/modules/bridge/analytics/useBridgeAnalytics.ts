import { useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useChains, useConnection } from 'wagmi';
import { AppEvents, getViewport, safeCapture } from '@/modules/analytics/constants';
import type { BridgeLookupResult } from '@/modules/analytics/contract';
import type { PendingBridge } from '../model/types';
import { createBridgeTracker, type BridgeEventContext, type BridgeTrackerOptions } from './bridgeTracker';

/** The Bridge's own events that aren't part of a transaction. */
export function useBridgeAnalytics() {
  const posthog = usePostHog();

  const trackClaimLinkCopied = useCallback(
    (bridge: PendingBridge) =>
      safeCapture(posthog, AppEvents.BRIDGE_CLAIM_LINK_COPIED, {
        widget_name: 'bridge',
        bridge_type: bridge.routeKind,
        source_chain: bridge.from,
        destination_chain: bridge.to,
        bridge_id: bridge.id,
        source_tx_hash: bridge.txHash,
        viewport: getViewport()
      }),
    [posthog]
  );

  const trackLookupCompleted = useCallback(
    (lookup: {
      entry_source: 'link' | 'manual';
      result: BridgeLookupResult;
      source_chain: string;
      refused_reason?: string;
      bridge_type?: string;
      source_tx_hash?: string;
    }) =>
      safeCapture(posthog, AppEvents.BRIDGE_LOOKUP_COMPLETED, {
        widget_name: 'bridge',
        ...lookup,
        viewport: getViewport()
      }),
    [posthog]
  );

  return { trackClaimLinkCopied, trackLookupCompleted };
}

/** Builds the tracker of a Confirm, which reports its transactions as `app_bridge_tx_sent`. */
export function useBridgeTrackerFactory() {
  const posthog = usePostHog();
  const chains = useChains();
  const { address, connector } = useConnection();
  const walletName = connector?.name;

  return useCallback(
    ({
      context,
      chainId,
      ...options
    }: Omit<BridgeTrackerOptions, 'emitTxSent' | 'walletName'> & {
      context: BridgeEventContext;
      chainId: number;
    }) =>
      createBridgeTracker({
        ...options,
        walletName,
        emitTxSent: sent =>
          safeCapture(posthog, AppEvents.BRIDGE_TX_SENT, {
            widget_name: 'bridge',
            ...context,
            ...sent,
            chain_id: chainId,
            chain_name: chains.find(chain => chain.id === chainId)?.name ?? `unknown_${chainId}`,
            wallet_address: address,
            viewport: getViewport(),
            timestamp: new Date().toISOString()
          })
      }),
    [posthog, chains, address, walletName]
  );
}
