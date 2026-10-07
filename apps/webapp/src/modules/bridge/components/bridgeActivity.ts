import type { BridgeNetworkId } from '../model/networks';
import type { PendingBridge, PendingBridgeNextAction } from '../model/types';

export type BridgeActivityKind = 'bridge' | PendingBridgeNextAction;

export type BridgeActivityEntry = {
  id: string;
  kind: BridgeActivityKind;
  /** Network the transaction ran on: source for the bridge, destination for the actions. */
  network: BridgeNetworkId;
  amount: bigint;
  timestamp: number;
  txHash: string;
};

export const BRIDGE_ACTIVITY_TITLE: Record<BridgeActivityKind, string> = {
  bridge: 'Bridge',
  claim: 'Funds claim',
  prove: 'Withdrawal proof',
  finalize: 'Funds claim'
};

/**
 * One "Bridge" row per bridge with an on-chain source tx, plus a row per
 * destination action the user sent, newest first.
 */
export function buildBridgeActivity(bridges: PendingBridge[]): BridgeActivityEntry[] {
  return bridges
    .flatMap(bridge => [
      ...(bridge.txHash
        ? [
            {
              id: `${bridge.id}-bridge`,
              kind: 'bridge' as const,
              network: bridge.from,
              amount: bridge.amount,
              timestamp: bridge.startedAt,
              txHash: bridge.txHash
            }
          ]
        : []),
      // A sent action's hash can be a Safe tx hash; it shows once confirmed.
      ...bridge.actions
        .filter(action => action.status !== 'sent')
        .map(action => ({
          id: `${bridge.id}-${action.action}-${action.txHash}`,
          kind: action.action,
          network: bridge.to,
          amount: bridge.amount,
          timestamp: action.at,
          txHash: action.txHash
        }))
    ])
    .sort((a, b) => b.timestamp - a.timestamp);
}
