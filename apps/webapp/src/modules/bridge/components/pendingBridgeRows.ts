/**
 * Pure cell builders for a pending bridge card (Figma 3574:64348):
 * [Source | Destination], [Status | Estimated arrival], [Bridge type | Transaction].
 * Labels and pairing are the Figma contract, asserted in `pendingBridgeRows.test.ts`.
 */

import { plural, t } from '@lingui/core/macro';
import { getAddress, isAddress } from 'viem';
import { arbitrum } from 'viem/chains';
import { NO_VALUE } from '@/lib/constants';
import { formatAddress } from '@/utils';
import { getEtherscanLink } from '@/utils/getEtherscanLink';
import { getSafeTransactionLink } from '@/utils/getSafeTransactionLink';
import { SAFE_TRANSACTION_SERVICE_URL } from '@/hooks/shared/constants';
import { isOpStackNetwork, type OpStackNetworkId } from '../adapters/nativeDeposit/contracts';
import { bridgeChainId, type BridgeNetworkId } from '../model/networks';
import { DAY_MINUTES } from '../model/resolveRoute';
import { isBundleUnseen, REDEEM_URGENT_MINUTES, ticketMinutesLeft } from '../model/pendingTransitions';
import type { PendingBridge, PendingBridgeNextAction, PendingBridgeStatus } from '../model/types';
import { bridgeTypeLabel } from './bridgeModalRows';

// The store keeps accounts lowercased; the Safe app expects a checksummed address.
const checksummed = (account: string) => (isAddress(account) ? getAddress(account) : account);

export type PendingBridgeCell =
  | { kind: 'network'; label: string; network: BridgeNetworkId }
  | { kind: 'status'; label: string; status: PendingBridgeStatus; value: string; tone?: 'info' }
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
    case 'expired':
      return t`Expired`;
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
    case 'redeem':
      return t`Redeem`;
    case 'replay':
      return t`Replay`;
    case 'keepalive':
      return t`Extend`;
    case 'convert':
      return t`Convert to USDS`;
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
    case 'redeem':
    case 'replay':
    case 'keepalive':
    case 'convert':
      return t`Action needed`;
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

/** "15:46 UTC" on the same UTC day as `now`, else the full date; rounded up to the minute. */
const formatArrivalTime = (ms: number, now: number): string => {
  const arrival = new Date(Math.ceil(ms / 60_000) * 60_000);
  const utcDay = (date: Date) => date.toISOString().slice(0, 10);
  if (utcDay(arrival) !== utcDay(new Date(now))) return formatBridgeDate(arrival.getTime());
  return `${arrival.toISOString().slice(11, 16)} UTC`;
};

const arrivalText = (bridge: PendingBridge, now: number): string => {
  if (bridge.status === 'failed' || bridge.status === 'expired') return NO_VALUE;
  // A ready claim, prove or finalize still has a step before the funds land.
  if (
    bridge.status === 'ready' &&
    (bridge.nextAction === 'claim' || bridge.nextAction === 'prove' || bridge.nextAction === 'finalize')
  )
    return t`Ready`;
  // A failed deposit lands only once the user redeems or replays it.
  if (bridge.status === 'ready' && (bridge.nextAction === 'redeem' || bridge.nextAction === 'replay'))
    return NO_VALUE;
  if (bridge.status !== 'pending') return t`Arrived`;
  // A queued Safe transaction or an unmined bundle: the clock starts once it executes.
  if (!bridge.txHash) return NO_VALUE;
  // A clock older than the bridge (list mounted before it started) must not inflate the ETA.
  const elapsedFrom = Math.max(now, bridge.startedAt);
  if (elapsedFrom > bridge.etaAt) return t`Taking longer than expected`;
  return formatArrivalTime(bridge.etaAt, elapsedFrom);
};

/** Explorer link for a tx on `network`, on the chain the app runs that network on. */
export const bridgeTxHref = (network: BridgeNetworkId, txHash: string, familyChainId: number) => {
  const chainId = bridgeChainId(network, familyChainId);
  return chainId === undefined ? undefined : getEtherscanLink(chainId, txHash, 'tx');
};

export function buildPendingBridgeRows(
  bridge: PendingBridge,
  now: number,
  familyChainId: number,
  /** A claim that kept its USDC, offered for conversion (Figma 93). */
  arrivedAsUsdc = false
): PendingBridgeCell[][] {
  const sourceChainId = bridgeChainId(bridge.from, familyChainId);
  return [
    [
      { kind: 'network', label: t`Source`, network: bridge.from },
      { kind: 'network', label: t`Destination`, network: bridge.to }
    ],
    [
      arrivedAsUsdc
        ? { kind: 'status', label: t`Status`, status: bridge.status, value: t`Arrived as USDC`, tone: 'info' }
        : { kind: 'status', label: t`Status`, status: bridge.status, value: statusText(bridge) },
      { kind: 'text', label: t`Estimated arrival`, value: arrivalText(bridge, now) }
    ],
    [
      { kind: 'text', label: t`Bridge type`, value: bridgeTypeLabel(bridge.routeKind) },
      bridge.txHash
        ? {
            kind: 'link',
            label: t`Transaction`,
            value: formatAddress(bridge.txHash, 6, 4),
            href: bridgeTxHref(bridge.from, bridge.txHash, familyChainId)
          }
        : bridge.status === 'failed'
          ? { kind: 'text', label: t`Transaction`, value: NO_VALUE }
          : bridge.bundleId
            ? {
                kind: 'text',
                label: t`Transaction`,
                value: isBundleUnseen(bridge, now) ? t`Not found on Ethereum yet` : t`Confirming on Ethereum`
              }
            : // A Safe transaction queued for its owners to sign; the Safe app serves the chains its service does.
              {
                kind: 'link',
                label: t`Transaction`,
                value: t`Awaiting signatures`,
                href:
                  sourceChainId !== undefined &&
                  bridge.safeTxHash &&
                  SAFE_TRANSACTION_SERVICE_URL[sourceChainId]
                    ? getSafeTransactionLink(sourceChainId, checksummed(bridge.account), bridge.safeTxHash)
                    : undefined
              }
    ]
  ];
}

/** Arbitrum's tool to check and redeem a ticket from any wallet. */
const ARBITRUM_RETRYABLES_URL = 'https://portal.arbitrum.io/build/retryables';
export const SKY_DISCORD_URL = 'https://discord.gg/skyecosystem';

/** A note under an Ethereum deposit card that needs a redeem or a replay, or whose Arbitrum ticket expired. */
export type PendingBridgeNote =
  | {
      kind: 'redeem';
      /** Whole minutes until the ticket's timeout, 0 once it passed; undefined when unknown. */
      minutesLeft?: number;
      urgent: boolean;
      retryablesHref?: string;
    }
  | { kind: 'expired'; retryablesHref?: string; supportHref: string }
  | { kind: 'replay'; network: OpStackNetworkId };

// The tool looks the ticket up by the Ethereum tx that created it.
const retryablesHref = (txHash: string | undefined) =>
  txHash && `${ARBITRUM_RETRYABLES_URL}?${new URLSearchParams({ chainId: String(arbitrum.id), tx: txHash })}`;

export function pendingBridgeNote(bridge: PendingBridge, now: number): PendingBridgeNote | undefined {
  if (bridge.routeKind !== 'native' || bridge.from !== 'ethereum') return undefined;
  if (isOpStackNetwork(bridge.to))
    return bridge.status === 'ready' && bridge.nextAction === 'replay'
      ? { kind: 'replay', network: bridge.to }
      : undefined;
  if (bridge.to !== 'arbitrum') return undefined;
  if (bridge.status === 'expired')
    return { kind: 'expired', retryablesHref: retryablesHref(bridge.txHash), supportHref: SKY_DISCORD_URL };
  if (bridge.status !== 'ready' || bridge.nextAction !== 'redeem') return undefined;
  const minutesLeft = ticketMinutesLeft(bridge, now);
  return {
    kind: 'redeem',
    minutesLeft,
    urgent: minutesLeft !== undefined && minutesLeft < REDEEM_URGENT_MINUTES,
    retryablesHref: retryablesHref(bridge.txHash)
  };
}

/** "6 days 4 hours", "5 hours 12 minutes", "3 minutes", floored. */
export const formatTimeLeft = (minutes: number): string => {
  const days = Math.floor(minutes / DAY_MINUTES);
  const hours = Math.floor((minutes % DAY_MINUTES) / 60);
  const rest = minutes % 60;
  const dayWords = plural(days, { one: '# day', other: '# days' });
  const hourWords = plural(hours, { one: '# hour', other: '# hours' });
  const minuteWords = plural(rest, { one: '# minute', other: '# minutes' });
  if (days > 0) return hours > 0 ? t`${dayWords} ${hourWords}` : dayWords;
  if (hours > 0) return rest > 0 ? t`${hourWords} ${minuteWords}` : hourWords;
  return minuteWords;
};
