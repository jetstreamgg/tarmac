import { useRef, useCallback } from 'react';
import { TxStatus as WidgetTxStatus, type WidgetStateChangeParams } from '@jetstreamgg/sky-widgets';
import { useAppAnalytics } from './useAppAnalytics';
import { useOnchainEventTracking, type OnchainTrackingMetadata } from './useOnchainEventTracking';
import { reportAnalyticsError } from '../constants';
import { useAnalyticsFlow } from '../context/AnalyticsFlowContext';

/**
 * Higher-order hook that wraps any widget's onWidgetStateChange handler
 * to track transaction start/complete transitions, review screen views,
 * and onchain events (subgraph / CowSwap API).
 *
 * Usage in each widget pane:
 * ```
 * const { wrapStateChange } = useWidgetFlowTracking('trade', chainId);
 * <Widget onWidgetStateChange={wrapStateChange(onTradeWidgetStateChange)} />
 * ```
 */
export function useWidgetFlowTracking(
  widgetName: string,
  chainId: number,
  metadata?: OnchainTrackingMetadata
) {
  const { trackTransactionStarted, trackTransactionCompleted, trackWidgetReviewViewed } = useAppAnalytics();
  const { startNewFlow, getFlowId } = useAnalyticsFlow();
  const { captureOnchainEvents } = useOnchainEventTracking(chainId);
  const prevTxStatusRef = useRef<WidgetTxStatus | null>(null);
  const prevScreenRef = useRef<string | null>(null);

  const wrapStateChange = useCallback(
    (originalHandler: (params: WidgetStateChangeParams) => void) => {
      return (params: WidgetStateChangeParams) => {
        // Always call the original handler first — analytics must never block functionality
        originalHandler(params);

        try {
          const prev = prevTxStatusRef.current;
          const curr = params.txStatus;
          prevTxStatusRef.current = curr;

          // Transaction started: transition to INITIALIZED
          if (curr === WidgetTxStatus.INITIALIZED && prev !== WidgetTxStatus.INITIALIZED) {
            trackTransactionStarted({ widgetName, chainId });
          }

          // Transaction completed: transition to SUCCESS
          if (curr === WidgetTxStatus.SUCCESS && prev !== WidgetTxStatus.SUCCESS) {
            // Capture flow_id before startNewFlow() regenerates it
            const flowId = getFlowId();
            // Enrich metadata with the current widget flow (e.g., 'open', 'manage', 'claim')
            const enrichedMetadata = { ...metadata, flow: params.widgetState?.flow };

            trackTransactionCompleted({
              widgetName,
              chainId,
              txStatus: 'success',
              txHash: params.hash,
              urnIndex: params.urnIndex
            });
            startNewFlow();

            // Fire-and-forget onchain event capture
            if (params.hash) {
              captureOnchainEvents(params.hash, widgetName, 'success', enrichedMetadata, flowId);
            }
          }

          // Transaction completed: transition to ERROR
          if (curr === WidgetTxStatus.ERROR && prev !== WidgetTxStatus.ERROR) {
            const flowId = getFlowId();
            const enrichedMetadata = { ...metadata, flow: params.widgetState?.flow };

            trackTransactionCompleted({
              widgetName,
              chainId,
              txStatus: 'error',
              txHash: params.hash,
              urnIndex: params.urnIndex
            });

            // Best-effort error event capture
            if (params.hash) {
              captureOnchainEvents(params.hash, widgetName, 'error', enrichedMetadata, flowId);
            }
          }

          // Transaction completed: transition to CANCELLED — not tracked onchain (nothing happened)
          if (curr === WidgetTxStatus.CANCELLED && prev !== WidgetTxStatus.CANCELLED) {
            trackTransactionCompleted({
              widgetName,
              chainId,
              txStatus: 'cancelled',
              txHash: params.hash,
              urnIndex: params.urnIndex
            });
          }
          // Review screen viewed: track when user reaches the review/confirmation screen
          const screen = params.widgetState?.screen;
          if (screen !== prevScreenRef.current) {
            prevScreenRef.current = screen;
            if (screen === 'review') {
              trackWidgetReviewViewed({
                widgetName,
                chainId,
                flow: params.widgetState?.flow
              });
            }
          }
        } catch (error) {
          reportAnalyticsError(`useWidgetFlowTracking:${widgetName}`, error);
        }
      };
    },
    [
      widgetName,
      chainId,
      metadata,
      trackTransactionStarted,
      trackTransactionCompleted,
      trackWidgetReviewViewed,
      captureOnchainEvents
    ]
  );

  return { wrapStateChange };
}
