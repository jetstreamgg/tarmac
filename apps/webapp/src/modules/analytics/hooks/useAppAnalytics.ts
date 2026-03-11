import { useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useChains, useConnection } from 'wagmi';
import {
  AppEvents,
  safeCapture,
  getViewport,
  type SelectionMethod,
  type TxStatus,
  type ErrorContext
} from '../constants';
import { useAnalyticsFlow } from '../context/AnalyticsFlowContext';

export function useAppAnalytics() {
  const posthog = usePostHog();
  const { address } = useConnection();
  const chains = useChains();
  const { getFlowId } = useAnalyticsFlow();

  const getChainName = useCallback(
    (chainId: number) => chains.find(c => c.id === chainId)?.name ?? `unknown_${chainId}`,
    [chains]
  );

  const trackWidgetSelected = ({
    widgetName,
    previousWidget,
    selectionMethod,
    chainId
  }: {
    widgetName: string;
    previousWidget: string;
    selectionMethod: SelectionMethod;
    chainId: number;
  }) => {
    safeCapture(posthog, AppEvents.WIDGET_SELECTED, {
      widget_name: widgetName,
      previous_widget: previousWidget,
      selection_method: selectionMethod,
      chain_id: chainId,
      chain_name: getChainName(chainId),
      viewport: getViewport(),
      flow_id: getFlowId()
    });
  };

  const trackTransactionStarted = useCallback(
    ({
      widgetName,
      chainId,
      action,
      flow,
      data
    }: {
      widgetName: string;
      chainId: number;
      action?: string;
      flow?: string;
      data?: Record<string, unknown>;
    }) => {
      safeCapture(posthog, AppEvents.TRANSACTION_STARTED, {
        widget_name: widgetName,
        chain_id: chainId,
        chain_name: getChainName(chainId),
        viewport: getViewport(),
        flow_id: getFlowId(),
        ...(action && { action }),
        ...(flow && { flow }),
        ...data
      });
    },
    [posthog, getChainName, getFlowId]
  );

  const trackTransactionCompleted = useCallback(
    ({
      widgetName,
      chainId,
      txStatus,
      txHash,
      errorContext,
      action,
      flow,
      data
    }: {
      widgetName: string;
      chainId: number;
      txStatus: TxStatus;
      txHash?: string;
      errorContext?: ErrorContext;
      action?: string;
      flow?: string;
      data?: Record<string, unknown>;
    }) => {
      safeCapture(posthog, AppEvents.TRANSACTION_COMPLETED, {
        widget_name: widgetName,
        chain_id: chainId,
        chain_name: getChainName(chainId),
        tx_status: txStatus,
        wallet_address: address,
        ...(txHash && { tx_hash: txHash }),
        ...(errorContext && { error_context: errorContext }),
        ...(action && { action }),
        ...(flow && { flow }),
        ...data,
        viewport: getViewport(),
        flow_id: getFlowId()
      });
    },
    [posthog, address, getChainName, getFlowId]
  );

  const trackWidgetReviewViewed = useCallback(
    ({ widgetName, chainId, flow }: { widgetName: string; chainId: number; flow: string }) => {
      safeCapture(posthog, AppEvents.WIDGET_REVIEW_VIEWED, {
        widget_name: widgetName,
        chain_id: chainId,
        chain_name: getChainName(chainId),
        flow,
        wallet_address: address,
        viewport: getViewport(),
        flow_id: getFlowId()
      });
    },
    [posthog, address, getChainName, getFlowId]
  );

  const trackDetailsPaneToggled = ({
    toggleAction,
    activeWidget,
    chatWasOpen
  }: {
    toggleAction: 'open' | 'close';
    activeWidget: string;
    chatWasOpen: boolean;
  }) => {
    safeCapture(posthog, AppEvents.DETAILS_PANE_TOGGLED, {
      toggle_action: toggleAction,
      active_widget: activeWidget,
      chat_was_open: chatWasOpen,
      viewport: getViewport()
    });
  };

  const trackChatPaneToggled = ({
    toggleAction,
    activeWidget,
    detailsWasOpen
  }: {
    toggleAction: 'open' | 'close';
    activeWidget: string;
    detailsWasOpen: boolean;
  }) => {
    safeCapture(posthog, AppEvents.CHAT_PANE_TOGGLED, {
      toggle_action: toggleAction,
      active_widget: activeWidget,
      details_was_open: detailsWasOpen,
      viewport: getViewport()
    });
  };

  const trackWalletConnected = useCallback(
    ({ walletName }: { walletName: string }) => {
      safeCapture(posthog, AppEvents.WALLET_CONNECTED, {
        wallet_name: walletName,
        viewport: getViewport()
      });
    },
    [posthog]
  );

  const trackWalletDisconnected = useCallback(
    ({ walletName }: { walletName: string }) => {
      safeCapture(posthog, AppEvents.WALLET_DISCONNECTED, {
        wallet_name: walletName,
        viewport: getViewport()
      });
    },
    [posthog]
  );

  return {
    trackWidgetSelected,
    trackTransactionStarted,
    trackTransactionCompleted,
    trackWidgetReviewViewed,
    trackDetailsPaneToggled,
    trackChatPaneToggled,
    trackWalletConnected,
    trackWalletDisconnected
  };
}
