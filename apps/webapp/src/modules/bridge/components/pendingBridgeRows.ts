/**
 * Pure cell builders for a pending bridge card (Figma 3574:64348):
 * [Source | Destination], [Status | Estimated arrival], [Bridge type | Transaction].
 * Labels and pairing are the Figma contract, asserted in `pendingBridgeRows.test.ts`.
 */

import { t } from '@lingui/core/macro';
import { NO_VALUE } from '@/lib/constants';
import { formatAddress } from '@/utils';
import { getEtherscanLink } from '@/utils/getEtherscanLink';
import { getSafeTransactionLink } from '@/utils/getSafeTransactionLink';
import { SAFE_TRANSACTION_SERVICE_URL } from '@/hooks/shared/constants';
import { getBridgeNetwork, type BridgeNetworkId } from '../model/networks';
import type { PendingBridge, PendingBridgeNextAction, PendingBridgeStatus } from '../model/types';
import { bridgeTypeLabel, formatEta } from './bridgeModalRows';

export type PendingBridgeCell =
  | { kind: 'network'; label: string; network: BridgeNetworkId }
  | { kind: 'status'; label: string; status: PendingBridgeStatus; value: string }
  | { kind: 'text'; label: string; value: string }
  | { kind: 'link'; label: string; value: string; href?: string };

const statusLabel = (status: PendingBridgeStatus): string => {
  switch (status) {
    case 'pending':
      return t`Pending`;
    case 'ready':
      return t`Ready to claim`;
    case 'arrived':
      return t`Arrived`;
    case 'claimed':
      return t`Claimed`;
    case 'failed':
      return t`Failed`;
  }
};

export const nextActionLabel = (action: PendingBridgeNextAction): string => {
  switch (action) {
    case 'claim':
      return t`Claim`;
    case 'prove':
      return t`Prove`;
    case 'finalize':
      return t`Finalize`;
  }
};

const readyLabel = (action: PendingBridgeNextAction): string => {
  switch (action) {
    case 'claim':
      return t`Ready to claim`;
    case 'prove':
      return t`Ready to prove`;
    case 'finalize':
      return t`Ready to finalize`;
  }
};

const statusText = (bridge: PendingBridge): string =>
  bridge.status === 'ready' && bridge.nextAction ? readyLabel(bridge.nextAction) : statusLabel(bridge.status);

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
    return t`Ready`;
  if (bridge.status !== 'pending') return t`Arrived`;
  // A queued Safe transaction: the clock starts once it executes.
  if (!bridge.txHash) return NO_VALUE;
  // A clock older than the bridge (list mounted before it started) must not inflate the ETA.
  const elapsedFrom = Math.max(now, bridge.startedAt);
  if (elapsedFrom > bridge.etaAt) return t`Taking longer than expected`;
  return formatEta(Math.max(1, Math.ceil((bridge.etaAt - elapsedFrom) / 60_000)));
};

export function buildPendingBridgeRows(bridge: PendingBridge, now: number): PendingBridgeCell[][] {
  const sourceChainId = getBridgeNetwork(bridge.from).chainId;
  return [
    [
      { kind: 'network', label: t`Source`, network: bridge.from },
      { kind: 'network', label: t`Destination`, network: bridge.to }
    ],
    [
      { kind: 'status', label: t`Status`, status: bridge.status, value: statusText(bridge) },
      { kind: 'text', label: t`Estimated arrival`, value: arrivalText(bridge, now) }
    ],
    [
      { kind: 'text', label: t`Bridge type`, value: bridgeTypeLabel(bridge.routeKind) },
      bridge.txHash
        ? {
            kind: 'link',
            label: t`Transaction`,
            value: formatAddress(bridge.txHash, 6, 4),
            href:
              sourceChainId === undefined ? undefined : getEtherscanLink(sourceChainId, bridge.txHash, 'tx')
          }
        : bridge.status === 'failed'
          ? { kind: 'text', label: t`Transaction`, value: NO_VALUE }
          : // A Safe transaction queued for its owners to sign; the Safe app serves the chains its service does.
            {
              kind: 'link',
              label: t`Transaction`,
              value: t`Awaiting signatures`,
              href:
                sourceChainId !== undefined &&
                bridge.safeTxHash &&
                SAFE_TRANSACTION_SERVICE_URL[sourceChainId]
                  ? getSafeTransactionLink(sourceChainId, bridge.account, bridge.safeTxHash)
                  : undefined
            }
    ]
  ];
}
