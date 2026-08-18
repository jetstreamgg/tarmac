import { useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useChains, useConnection } from 'wagmi';
import {
  AppEvents,
  safeCapture,
  getViewport,
  type SelectionMethod,
  type TxStatus,
  type DisconnectSource,
  type ConnectReason,
  type ConnectMethod,
  type GatedActionOutcome,
  type NetworkSwitchSource,
  type NetworkSwitchStatus,
  type AutoSwitchTrigger
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

  const trackWidgetSelected = useCallback(
    ({
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
    },
    [posthog, getChainName, getFlowId]
  );

  const trackTransactionStarted = useCallback(
    ({
      widgetName,
      chainId,
      action,
      flow,
      data,
      flowId
    }: {
      widgetName: string;
      chainId: number;
      action?: string;
      flow?: string;
      data?: Record<string, unknown>;
      flowId?: string;
    }) => {
      safeCapture(posthog, AppEvents.TRANSACTION_STARTED, {
        widget_name: widgetName,
        chain_id: chainId,
        chain_name: getChainName(chainId),
        wallet_address: address,
        viewport: getViewport(),
        flow_id: flowId ?? getFlowId(),
        timestamp: new Date().toISOString(),
        ...(action && { action }),
        ...(flow && { flow }),
        ...data
      });
    },
    [posthog, address, getChainName, getFlowId]
  );

  const trackTransactionCompleted = useCallback(
    ({
      widgetName,
      chainId,
      txStatus,
      txHash,
      action,
      flow,
      data,
      flowId
    }: {
      widgetName: string;
      chainId: number;
      txStatus: TxStatus;
      txHash?: string;
      action?: string;
      flow?: string;
      data?: Record<string, unknown>;
      flowId?: string;
    }) => {
      safeCapture(posthog, AppEvents.TRANSACTION_COMPLETED, {
        widget_name: widgetName,
        chain_id: chainId,
        chain_name: getChainName(chainId),
        tx_status: txStatus,
        wallet_address: address,
        ...(txHash && { tx_hash: txHash }),
        ...(action && { action }),
        ...(flow && { flow }),
        ...data,
        viewport: getViewport(),
        flow_id: flowId ?? getFlowId(),
        timestamp: new Date().toISOString()
      });
    },
    [posthog, address, getChainName, getFlowId]
  );

  const trackWidgetReviewViewed = useCallback(
    ({
      widgetName,
      chainId,
      flow,
      flowId
    }: {
      widgetName: string;
      chainId: number;
      flow: string;
      flowId?: string;
    }) => {
      safeCapture(posthog, AppEvents.WIDGET_REVIEW_VIEWED, {
        widget_name: widgetName,
        chain_id: chainId,
        chain_name: getChainName(chainId),
        flow,
        wallet_address: address,
        viewport: getViewport(),
        flow_id: flowId ?? getFlowId(),
        timestamp: new Date().toISOString()
      });
    },
    [posthog, address, getChainName, getFlowId]
  );

  const trackWalletConnected = useCallback(
    ({ walletName }: { walletName: string }) => {
      safeCapture(posthog, AppEvents.WALLET_CONNECTED, {
        wallet_name: walletName,
        viewport: getViewport(),
        flow_id: getFlowId()
      });
    },
    [posthog, getFlowId]
  );

  const trackWalletDisconnected = useCallback(
    ({ walletName, disconnectSource }: { walletName: string; disconnectSource: DisconnectSource }) => {
      safeCapture(posthog, AppEvents.WALLET_DISCONNECTED, {
        wallet_name: walletName,
        disconnect_source: disconnectSource,
        viewport: getViewport(),
        flow_id: getFlowId()
      });
    },
    [posthog, getFlowId]
  );

  const trackConnectModalOpened = useCallback(
    ({ connectReason }: { connectReason: ConnectReason }) => {
      safeCapture(posthog, AppEvents.CONNECT_MODAL_OPENED, {
        connect_reason: connectReason,
        viewport: getViewport(),
        flow_id: getFlowId()
      });
    },
    [posthog, getFlowId]
  );

  const trackWalletConnectAttempted = useCallback(
    ({ connectorName, method }: { connectorName: string; method: ConnectMethod }) => {
      safeCapture(posthog, AppEvents.WALLET_CONNECT_ATTEMPTED, {
        connector_name: connectorName,
        method,
        viewport: getViewport(),
        flow_id: getFlowId()
      });
    },
    [posthog, getFlowId]
  );

  const trackWalletConnectRejected = useCallback(
    ({ connectorName, method }: { connectorName: string; method: ConnectMethod }) => {
      safeCapture(posthog, AppEvents.WALLET_CONNECT_REJECTED, {
        connector_name: connectorName,
        method,
        viewport: getViewport(),
        flow_id: getFlowId()
      });
    },
    [posthog, getFlowId]
  );

  const trackGatedActionResolved = useCallback(
    ({ outcome, connectReason }: { outcome: GatedActionOutcome; connectReason: ConnectReason }) => {
      safeCapture(posthog, AppEvents.GATED_ACTION_RESOLVED, {
        outcome,
        connect_reason: connectReason,
        viewport: getViewport(),
        flow_id: getFlowId()
      });
    },
    [posthog, getFlowId]
  );

  const trackNetworkSwitchRequested = useCallback(
    ({
      source,
      fromChainId,
      toChainId
    }: {
      source: NetworkSwitchSource;
      fromChainId: number;
      toChainId: number;
    }) => {
      safeCapture(posthog, AppEvents.NETWORK_SWITCH_REQUESTED, {
        source,
        from_chain_id: fromChainId,
        to_chain_id: toChainId,
        to_chain_name: getChainName(toChainId),
        viewport: getViewport(),
        flow_id: getFlowId()
      });
    },
    [posthog, getChainName, getFlowId]
  );

  const trackNetworkSwitchCompleted = useCallback(
    ({
      source,
      fromChainId,
      toChainId,
      status
    }: {
      source: NetworkSwitchSource;
      fromChainId: number;
      toChainId: number;
      status: NetworkSwitchStatus;
    }) => {
      safeCapture(posthog, AppEvents.NETWORK_SWITCH_COMPLETED, {
        source,
        from_chain_id: fromChainId,
        to_chain_id: toChainId,
        to_chain_name: getChainName(toChainId),
        status,
        viewport: getViewport(),
        flow_id: getFlowId()
      });
    },
    [posthog, getChainName, getFlowId]
  );

  const trackNetworkAutoSwitched = useCallback(
    ({
      trigger,
      fromChainId,
      toChainId,
      isReconnect
    }: {
      trigger: AutoSwitchTrigger;
      fromChainId: number;
      toChainId: number;
      isReconnect?: boolean;
    }) => {
      safeCapture(posthog, AppEvents.NETWORK_AUTO_SWITCHED, {
        trigger,
        from_chain_id: fromChainId,
        to_chain_id: toChainId,
        to_chain_name: getChainName(toChainId),
        ...(isReconnect !== undefined && { is_reconnect: isReconnect }),
        viewport: getViewport(),
        flow_id: getFlowId()
      });
    },
    [posthog, getChainName, getFlowId]
  );

  const trackUnsupportedNetworkShown = useCallback(
    ({ walletChainId }: { walletChainId?: number }) => {
      safeCapture(posthog, AppEvents.UNSUPPORTED_NETWORK_SHOWN, {
        ...(walletChainId !== undefined && { wallet_chain_id: walletChainId }),
        viewport: getViewport(),
        flow_id: getFlowId()
      });
    },
    [posthog, getFlowId]
  );

  const trackConvertBlocked = useCallback(
    ({ reason, chainId }: { reason: string; chainId: number }) => {
      safeCapture(posthog, AppEvents.CONVERT_BLOCKED, {
        reason,
        chain_id: chainId,
        viewport: getViewport(),
        flow_id: getFlowId()
      });
    },
    [posthog, getFlowId]
  );

  return {
    trackWidgetSelected,
    trackTransactionStarted,
    trackTransactionCompleted,
    trackWidgetReviewViewed,
    trackWalletConnected,
    trackWalletDisconnected,
    trackConnectModalOpened,
    trackWalletConnectAttempted,
    trackWalletConnectRejected,
    trackGatedActionResolved,
    trackNetworkSwitchRequested,
    trackNetworkSwitchCompleted,
    trackNetworkAutoSwitched,
    trackUnsupportedNetworkShown,
    trackConvertBlocked
  };
}
