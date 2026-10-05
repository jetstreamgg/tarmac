import type { BridgeNetworkId } from '../model/networks';
import type { PendingBridge } from '../model/types';

export type BridgeActivityKind = 'bridge' | 'claim';

export type BridgeActivityEntry = {
  id: string;
  kind: BridgeActivityKind;
  /** Network the transaction ran on: source for the bridge, destination for the claim. */
  network: BridgeNetworkId;
  amount: bigint;
  timestamp: number;
  txHash: string;
};

export const BRIDGE_ACTIVITY_TITLE: Record<BridgeActivityKind, string> = {
  bridge: 'Bridge',
  claim: 'Funds claim'
};

/** One "Bridge" row per bridge plus a "Funds claim" row once claimed, newest first. */
export function buildBridgeActivity(bridges: PendingBridge[]): BridgeActivityEntry[] {
  return bridges
    .flatMap(bridge => {
      const entries: BridgeActivityEntry[] = [
        {
          id: `${bridge.id}-bridge`,
          kind: 'bridge',
          network: bridge.from,
          amount: bridge.amount,
          timestamp: bridge.startedAt,
          txHash: bridge.txHash
        }
      ];
      if (bridge.claimTxHash && bridge.claimedAt) {
        entries.push({
          id: `${bridge.id}-claim`,
          kind: 'claim',
          network: bridge.to,
          amount: bridge.amount,
          timestamp: bridge.claimedAt,
          txHash: bridge.claimTxHash
        });
      }
      return entries;
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}
