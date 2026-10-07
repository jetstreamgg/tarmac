import { t } from '@lingui/core/macro';
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

export const bridgeActivityTitle = (kind: BridgeActivityKind): string => {
  switch (kind) {
    case 'bridge':
      return t`Bridge`;
    case 'claim':
      return t`Funds claim`;
    case 'prove':
      return t`Withdrawal proof`;
    case 'finalize':
      return t`Withdrawal finalization`;
  }
};

// A sent action's hash can be a Safe tx hash; it shows once confirmed.
const isConfirmed = (action: PendingBridge['actions'][number]) => action.status !== 'sent';

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
      ...bridge.actions.filter(isConfirmed).map(action => ({
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
