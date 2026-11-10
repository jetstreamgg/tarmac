import type { TxMutateVariables } from '@/hooks';
import type { BridgeHashKind } from '@/modules/analytics/contract';
import type { TransactionAnalytics, TxCallbacks } from '@/modules/ui/context/transactionContract';
import type { BridgeNetworkId } from '../model/networks';
import type { BridgeRouteKind } from '../model/types';

/** The properties every transaction event of a bridge carries. */
export type BridgeEventContext = {
  bridge_type: BridgeRouteKind;
  source_chain: BridgeNetworkId;
  destination_chain: BridgeNetworkId;
  // Not `token`: posthog-js overwrites that property with the project key.
  assetSymbol: string;
  amount: number;
  flow: 'ethereum-to-l2' | 'l2-to-ethereum';
};

export const bridgeEventContext = ({
  kind,
  from,
  to,
  token,
  amount
}: {
  kind: BridgeRouteKind;
  from: BridgeNetworkId;
  to: BridgeNetworkId;
  token: string;
  amount: number;
}): BridgeEventContext => ({
  bridge_type: kind,
  source_chain: from,
  destination_chain: to,
  assetSymbol: token,
  amount,
  flow: from === 'ethereum' ? 'ethereum-to-l2' : 'l2-to-ethereum'
});

export type BridgeTxSent = {
  action: string;
  hash_kind: BridgeHashKind;
  tx_hash?: string;
  flow_id?: string;
  bridge_id?: string;
  source_tx_hash?: string;
};

export type BridgeTrackerOptions = {
  /** Reported on a bundle and on every leg that isn't an approve or the swap. */
  mainAction: string;
  swapFunction?: string;
  /** The tokens of a swap or conversion step. */
  swapTokens?: { token_in: string; token_out: string };
  includesSwap?: boolean;
  isSafe: boolean;
  walletName?: string;
  bridgeId?: string;
  sourceTxHash?: string;
  /** The id a wallet bundle was sent under. */
  readBundleId?: () => string | undefined;
  emitTxSent: (sent: BridgeTxSent) => void;
};

export type BridgeTracker = ReturnType<typeof createBridgeTracker>;

/** What one Confirm reports. Outlives its modal, so a late signature is still counted as sent. */
export function createBridgeTracker({
  mainAction,
  swapFunction,
  swapTokens,
  includesSwap = false,
  isSafe,
  walletName,
  bridgeId,
  sourceTxHash,
  readBundleId,
  emitTxSent
}: BridgeTrackerOptions) {
  let bridge = bridgeId;
  let source = sourceTxHash;
  let flowId: string | undefined;
  let lastSent: string | undefined;
  let action = mainAction;
  let isBundled = false;
  const stepActionOf = (functionName: string | undefined) =>
    functionName === 'approve'
      ? 'approve'
      : functionName && functionName === swapFunction
        ? 'swap'
        : mainAction;
  const send = (sent: Pick<BridgeTxSent, 'action' | 'hash_kind' | 'tx_hash'>) =>
    emitTxSent({ ...sent, flow_id: flowId, bridge_id: bridge, source_tx_hash: source });

  return {
    stepOf: (variables: TxMutateVariables | undefined, latchedFlowId: string | undefined) => {
      flowId = latchedFlowId;
      const step = stepActionOf(variables?.functionName);
      return {
        action: step,
        data: {
          // Every sequential leg names its function; only a bundle has none.
          is_bundled: !variables?.functionName,
          includes_swap: includesSwap,
          ...((step === 'swap' || step === 'convert') && swapTokens)
        }
      };
    },
    completedData: () => ({
      is_bundled: isBundled,
      includes_swap: includesSwap,
      bridge_id: bridge,
      source_tx_hash: source,
      wallet_name: walletName
    }),
    /** The bridge's card id and, once it has one, its source transaction. */
    recordBridge: (id: string, txHash?: string) => {
      bridge = id;
      if (txHash) source = txHash;
    },
    /** A sped-up send: reported as sent again by the `onStart` it causes. */
    recordRepriced: (txHash: string) => {
      source = txHash;
    },
    /** The on-chain hash of a Safe transaction or bundle, known after it was first reported. */
    recordExecuted: (txHash: string) => {
      source = txHash;
      send({ action: mainAction, hash_kind: 'tx', tx_hash: txHash });
    },
    wrap: (callbacks: TxCallbacks): TxCallbacks => ({
      ...callbacks,
      onMutate: variables => {
        action = stepActionOf(variables?.functionName);
        isBundled = !variables?.functionName;
        lastSent = undefined;
        callbacks.onMutate(variables);
      },
      onStart: hash => {
        // First: recording the send is what tells this tracker the bridge's id.
        callbacks.onStart(hash);
        const sent = hash || 'bundle';
        if (sent === lastSent) return;
        lastSent = sent;
        send({
          action,
          hash_kind: !hash ? 'bundle' : isSafe ? 'safe' : 'tx',
          tx_hash: hash || readBundleId?.()
        });
      }
    })
  };
}

/** The `analytics` block of a bridge's modal; the steps and outcome come from its latest Confirm. */
export const bridgeTransactionAnalytics = (
  context: BridgeEventContext,
  action: string,
  getTracker: () => BridgeTracker | undefined,
  data?: Record<string, unknown>
): TransactionAnalytics => ({
  widgetName: 'bridge',
  flow: context.flow,
  action,
  data: { ...context, ...data },
  stepOf: (variables, flowId) => getTracker()?.stepOf(variables, flowId),
  completedData: () => getTracker()?.completedData()
});
