import { useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useChains, useConnection } from 'wagmi';
import { WidgetAnalyticsEventType } from '@jetstreamgg/sky-widgets';
import type { WidgetAnalyticsEvent } from '@jetstreamgg/sky-widgets';
import { AppEvents, safeCapture, getViewport, reportAnalyticsError, type TxStatus } from '../constants';
import { useAnalyticsFlow } from '../context/AnalyticsFlowContext';

const EVENT_NAME_MAP: Record<WidgetAnalyticsEventType, string> = {
  [WidgetAnalyticsEventType.REVIEW_VIEWED]: AppEvents.WIDGET_REVIEW_VIEWED,
  [WidgetAnalyticsEventType.TRANSACTION_STARTED]: AppEvents.TRANSACTION_STARTED,
  [WidgetAnalyticsEventType.TRANSACTION_COMPLETED]: AppEvents.TRANSACTION_COMPLETED,
  [WidgetAnalyticsEventType.TRANSACTION_ERROR]: AppEvents.TRANSACTION_COMPLETED,
  [WidgetAnalyticsEventType.TRANSACTION_CANCELLED]: AppEvents.TRANSACTION_COMPLETED
};

const TX_STATUS_MAP: Partial<Record<WidgetAnalyticsEventType, TxStatus>> = {
  [WidgetAnalyticsEventType.TRANSACTION_COMPLETED]: 'success',
  [WidgetAnalyticsEventType.TRANSACTION_ERROR]: 'error',
  [WidgetAnalyticsEventType.TRANSACTION_CANCELLED]: 'cancelled'
};

/**
 * Returns an `onAnalyticsEvent` callback for a widget that maps
 * WidgetAnalyticsEvent to existing PostHog event names with enrichment.
 *
 * Usage:
 * ```
 * const onAnalyticsEvent = useWidgetAnalytics('vaults', chainId);
 * <MorphoVaultWidget onAnalyticsEvent={onAnalyticsEvent} />
 * ```
 */
export function useWidgetAnalytics(widgetName: string, chainId: number) {
  const posthog = usePostHog();
  const { address } = useConnection();
  const chains = useChains();
  const { getFlowId, startNewFlow } = useAnalyticsFlow();

  const getChainName = useCallback(
    (id: number) => chains.find(c => c.id === id)?.name ?? `unknown_${id}`,
    [chains]
  );

  const onAnalyticsEvent = useCallback(
    (event: WidgetAnalyticsEvent) => {
      try {
        const eventName = EVENT_NAME_MAP[event.event];
        if (!eventName) return;

        const txStatus = TX_STATUS_MAP[event.event];

        // Withdrawals and reverts are represented as negative amounts
        const amount =
          event.amount != null
            ? event.flow === 'withdraw' || event.flow === 'revert'
              ? -Math.abs(event.amount)
              : Math.abs(event.amount)
            : undefined;

        const properties: Record<string, unknown> = {
          widget_name: widgetName,
          chain_id: chainId,
          chain_name: getChainName(chainId),
          wallet_address: address,
          action: event.action,
          flow: event.flow,
          viewport: getViewport(),
          flow_id: getFlowId(),
          timestamp: new Date().toISOString(),
          ...(txStatus && { tx_status: txStatus }),
          ...(event.txHash && { tx_hash: event.txHash }),
          ...(amount != null && { amount }),
          ...event.data
        };

        safeCapture(posthog, eventName, properties);

        // Start a new flow after any terminal transaction event
        if (txStatus) {
          startNewFlow();
        }
      } catch (error) {
        reportAnalyticsError(`useWidgetAnalytics:${widgetName}`, error);
      }
    },
    [widgetName, chainId, posthog, address, getChainName, getFlowId, startNewFlow]
  );

  return onAnalyticsEvent;
}
