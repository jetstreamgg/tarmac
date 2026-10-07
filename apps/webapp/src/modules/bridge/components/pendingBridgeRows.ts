/**
 * Pure cell builders for a pending bridge card (Figma 3574:64348):
 * [Source | Destination], [Status | Estimated arrival], [Bridge type | Transaction].
 * Labels and pairing are the Figma contract, asserted in `pendingBridgeRows.test.ts`.
 */

import { NO_VALUE } from '@/lib/constants';
import { formatAddress } from '@/utils';
import { getEtherscanLink } from '@/utils/getEtherscanLink';
import { getBridgeNetwork, type BridgeNetworkId } from '../model/networks';
import type { PendingBridge, PendingBridgeNextAction, PendingBridgeStatus } from '../model/types';
import { BRIDGE_TYPE_LABEL, formatEta } from './bridgeModalRows';

export type PendingBridgeCell =
  | { kind: 'network'; label: string; network: BridgeNetworkId }
  | { kind: 'status'; label: string; status: PendingBridgeStatus; value: string }
  | { kind: 'text'; label: string; value: string }
  | { kind: 'link'; label: string; value: string; href?: string };

export const PENDING_STATUS_LABEL: Record<PendingBridgeStatus, string> = {
  pending: 'Pending',
  ready: 'Ready to claim',
  arrived: 'Arrived',
  claimed: 'Claimed',
  failed: 'Failed'
};

export const NEXT_ACTION_LABEL: Record<PendingBridgeNextAction, string> = {
  claim: 'Claim',
  prove: 'Prove',
  finalize: 'Finalize'
};

const READY_LABEL: Record<PendingBridgeNextAction, string> = {
  claim: 'Ready to claim',
  prove: 'Ready to prove',
  finalize: 'Ready to finalize'
};

const statusText = (bridge: PendingBridge): string =>
  bridge.status === 'ready' && bridge.nextAction
    ? READY_LABEL[bridge.nextAction]
    : PENDING_STATUS_LABEL[bridge.status];

/** "25/10/26 15:26 UTC". */
export const formatBridgeDate = (ms: number): string => {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCFullYear() % 100)} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
};

const arrivalText = (bridge: PendingBridge, now: number): string => {
  if (bridge.status === 'failed') return NO_VALUE;
  // A ready prove or finalize still has a step before the funds land.
  if (bridge.status === 'ready' && (bridge.nextAction === 'prove' || bridge.nextAction === 'finalize'))
    return 'Ready';
  if (bridge.status !== 'pending') return 'Arrived';
  // A queued Safe transaction: the clock starts once it executes.
  if (!bridge.txHash) return NO_VALUE;
  // A clock older than the bridge (list mounted before it started) must not inflate the ETA.
  const elapsedFrom = Math.max(now, bridge.startedAt);
  return formatEta(Math.max(1, Math.ceil((bridge.etaAt - elapsedFrom) / 60_000)));
};

export function buildPendingBridgeRows(bridge: PendingBridge, now: number): PendingBridgeCell[][] {
  const sourceChainId = getBridgeNetwork(bridge.from).chainId;
  return [
    [
      { kind: 'network', label: 'Source', network: bridge.from },
      { kind: 'network', label: 'Destination', network: bridge.to }
    ],
    [
      { kind: 'status', label: 'Status', status: bridge.status, value: statusText(bridge) },
      { kind: 'text', label: 'Estimated arrival', value: arrivalText(bridge, now) }
    ],
    [
      { kind: 'text', label: 'Bridge type', value: BRIDGE_TYPE_LABEL[bridge.routeKind] },
      bridge.txHash
        ? {
            kind: 'link',
            label: 'Transaction',
            value: formatAddress(bridge.txHash, 6, 4),
            href:
              sourceChainId === undefined ? undefined : getEtherscanLink(sourceChainId, bridge.txHash, 'tx')
          }
        : // A Safe transaction queued for its owners to sign.
          {
            kind: 'text',
            label: 'Transaction',
            value: bridge.status === 'failed' ? NO_VALUE : 'Awaiting signatures'
          }
    ]
  ];
}
