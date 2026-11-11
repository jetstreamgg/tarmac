/**
 * Pure cell builders for a pending bridge card (Figma 3574:64348):
 * [Source | Destination], [Status | Estimated arrival], [Bridge type | Transaction].
 * A bridge between two wallets names the other one beside the status (Figma 71, 74, 93), and a
 * third wallet's card names both above it (Figma 75).
 * Labels and pairing are the Figma contract, asserted in `pendingBridgeRows.test.ts`.
 */

import { plural, t } from '@lingui/core/macro';
import { format, isSameDay } from 'date-fns';
import { getAddress, isAddress } from 'viem';
import { arbitrum } from 'viem/chains';
import { NO_VALUE } from '@/lib/constants';
import { formatAddress } from '@/utils';
import { getExplorerLink } from '@/utils/getEtherscanLink';
import { getSafeTransactionLink } from '@/utils/getSafeTransactionLink';
import { SAFE_TRANSACTION_SERVICE_URL } from '@/hooks/shared/constants';
import { isOpStackNetwork, type OpStackNetworkId } from '../adapters/nativeDeposit/contracts';
import { bridgedAmount, formatExactUsds } from '../model/bridgeAmount';
import { bridgeChainId, getBridgeNetwork, type BridgeNetworkId } from '../model/networks';
import { DAY_MINUTES } from '../model/resolveRoute';
import {
  isBundleUnseen,
  isSourceUnseen,
  REDEEM_URGENT_MINUTES,
  ticketMinutesLeft
} from '../model/pendingTransitions';
import { sendsToOther } from '../model/recipient';
import type { PendingBridge, PendingBridgeNextAction, PendingBridgeStatus } from '../model/types';
import { bridgeTypeLabel, bridgeTypeLogo } from './bridgeModalRows';
import type { BridgeTypeLogoKind } from '@/components/product/BridgeTypeLogo';

// The store keeps accounts lowercased; the Safe app expects a checksummed address.
const checksummed = (account: string) => (isAddress(account) ? getAddress(account) : account);

export type PendingBridgeCell =
  | { kind: 'network'; label: string; network: BridgeNetworkId }
  | { kind: 'status'; label: string; status: PendingBridgeStatus; value: string; tone?: 'info' }
  /** `logo`: the protocol's logo drawn before the value (CCTP's Circle logo, Figma 3830:67688). */
  | { kind: 'text'; label: string; value: string; logo?: BridgeTypeLogoKind }
  | { kind: 'link'; label: string; value: string; href?: string }
  | { kind: 'wallet'; label: string; address: string; href?: string };

/** The other wallet of a bridge: its recipient on the sender's card, its sender on the recipient's, both on a third wallet's. */
export type BridgeCounterparty =
  { role: 'sender' | 'destination'; address: string } | { role: 'both'; sender: string; destination: string };

export function bridgeCounterparty(
  bridge: Pick<PendingBridge, 'account' | 'recipient'>,
  account: string | undefined
): BridgeCounterparty | undefined {
  if (!account) return undefined;
  const lower = account.toLowerCase();
  if (bridge.recipient && bridge.account.toLowerCase() !== lower && bridge.recipient.toLowerCase() !== lower)
    return { role: 'both', sender: bridge.account, destination: bridge.recipient };
  if (bridge.account.toLowerCase() !== lower) return { role: 'sender', address: bridge.account };
  return bridge.recipient && sendsToOther(bridge.recipient, bridge.account)
    ? { role: 'destination', address: bridge.recipient }
    : undefined;
}

/**
 * The "Bridge arrived" toast's text (Figma 4232:64133). Whoever claimed a CCTP bridge may have left USDC or
 * USDS, so that one names no token. Activity only lists the viewer's own entries.
 */
export function bridgeArrivedMessage(
  bridge: PendingBridge,
  account: string | undefined,
  inActivity: boolean
): string {
  const network = getBridgeNetwork(bridge.to).name;
  const holder = bridge.recipient ?? bridge.account;
  const yours = account?.toLowerCase() === holder.toLowerCase();
  const wallet = formatAddress(holder, 6, 4);
  const amount = formatExactUsds(bridgedAmount(bridge.amount, bridge.routeKind));
  const landed =
    bridge.routeKind === 'cctp'
      ? yours
        ? t`The funds are now in your wallet on ${network}.`
        : t`The funds are now in ${wallet} on ${network}.`
      : yours
        ? t`${amount} USDS is now in your wallet on ${network}.`
        : t`${amount} USDS is now in ${wallet} on ${network}.`;
  return inActivity ? `${landed} ${t`You can find the details in Activity in your wallet preview.`}` : landed;
}

const walletCell = (
  bridge: PendingBridge,
  role: 'sender' | 'destination',
  address: string,
  familyChainId: number
): PendingBridgeCell => {
  // Each wallet on the network it acts on.
  const chainId = bridgeChainId(role === 'sender' ? bridge.from : bridge.to, familyChainId);
  return {
    kind: 'wallet',
    label: role === 'sender' ? t`Sender` : t`Destination wallet`,
    address,
    href: chainId === undefined ? undefined : getExplorerLink(chainId, address, 'address')
  };
};

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

/** "25/10/26 15:26", in the user's time zone. */
export const formatBridgeDate = (ms: number): string => format(ms, 'dd/MM/yy HH:mm');

/** "15:46" on the same local day as `now`, else the full date; rounded up to the minute. */
const formatArrivalTime = (ms: number, now: number): string => {
  const arrival = Math.ceil(ms / 60_000) * 60_000;
  return isSameDay(arrival, now) ? format(arrival, 'HH:mm') : formatBridgeDate(arrival);
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
  // A send its chain has no record of isn't on its way.
  if (isSourceUnseen(bridge)) return NO_VALUE;
  // A clock older than the bridge (list mounted before it started) must not inflate the ETA.
  const elapsedFrom = Math.max(now, bridge.startedAt);
  if (elapsedFrom > bridge.etaAt) return t`Taking longer than expected`;
  return formatArrivalTime(bridge.etaAt, elapsedFrom);
};

/** Explorer link for a tx on `network`, on the chain the app runs that network on. */
export const bridgeTxHref = (network: BridgeNetworkId, txHash: string, familyChainId: number) => {
  const chainId = bridgeChainId(network, familyChainId);
  return chainId === undefined ? undefined : getExplorerLink(chainId, txHash, 'tx');
};

export function buildPendingBridgeRows(
  bridge: PendingBridge,
  now: number,
  familyChainId: number,
  /** A claim that kept its USDC, offered for conversion (Figma 93). */
  arrivedAsUsdc = false,
  counterparty?: BridgeCounterparty
): PendingBridgeCell[][] {
  const sourceChainId = bridgeChainId(bridge.from, familyChainId);
  const sourceName = getBridgeNetwork(bridge.from).name;
  const networks: PendingBridgeCell[] = [
    { kind: 'network', label: t`Source`, network: bridge.from },
    { kind: 'network', label: t`Destination`, network: bridge.to }
  ];
  const status: PendingBridgeCell = arrivedAsUsdc
    ? { kind: 'status', label: t`Status`, status: bridge.status, value: t`Arrived as USDC`, tone: 'info' }
    : { kind: 'status', label: t`Status`, status: bridge.status, value: statusText(bridge) };
  const arrival: PendingBridgeCell = {
    kind: 'text',
    label: t`Estimated arrival`,
    value: arrivalText(bridge, now)
  };
  const logo = bridgeTypeLogo(bridge.routeKind);
  const bridgeType: PendingBridgeCell = {
    kind: 'text',
    label: t`Bridge type`,
    value: bridgeTypeLabel(bridge.routeKind),
    ...(logo && { logo })
  };
  const transaction: PendingBridgeCell = bridge.txHash
    ? {
        kind: 'link',
        label: t`Transaction`,
        value: isSourceUnseen(bridge) ? t`Not found on ${sourceName}` : formatAddress(bridge.txHash, 6, 4),
        href: bridgeTxHref(bridge.from, bridge.txHash, familyChainId)
      }
    : bridge.status === 'failed'
      ? { kind: 'text', label: t`Transaction`, value: NO_VALUE }
      : bridge.bundleId
        ? {
            kind: 'text',
            label: t`Transaction`,
            value: isBundleUnseen(bridge, now)
              ? t`Not found on ${sourceName} yet`
              : t`Confirming on ${sourceName}`
          }
        : // A Safe transaction queued for its owners to sign; the Safe app serves the chains its service does.
          {
            kind: 'link',
            label: t`Transaction`,
            value: t`Awaiting signatures`,
            href:
              sourceChainId !== undefined && bridge.safeTxHash && SAFE_TRANSACTION_SERVICE_URL[sourceChainId]
                ? getSafeTransactionLink(sourceChainId, checksummed(bridge.account), bridge.safeTxHash)
                : undefined
          };
  if (counterparty?.role === 'both')
    return [
      networks,
      [
        walletCell(bridge, 'sender', counterparty.sender, familyChainId),
        walletCell(bridge, 'destination', counterparty.destination, familyChainId)
      ],
      [status, arrival],
      [bridgeType, transaction]
    ];
  return counterparty
    ? [
        networks,
        [walletCell(bridge, counterparty.role, counterparty.address, familyChainId), status],
        [arrival, bridgeType],
        [transaction]
      ]
    : [networks, [status, arrival], [bridgeType, transaction]];
}

/** Arbitrum's tool to check and redeem a ticket from any wallet. */
const ARBITRUM_RETRYABLES_URL = 'https://portal.arbitrum.io/build/retryables';
export const SKY_DISCORD_URL = 'https://discord.gg/skyecosystem';

/**
 * A note under a card: an Ethereum deposit that needs a redeem or a replay, or
 * whose Arbitrum ticket expired; a withdrawal's wait or step; a send its chain
 * has no record of.
 */
export type PendingBridgeNote =
  | { kind: 'source-not-found'; network: BridgeNetworkId }
  /** A mined CCTP burn Circle has not attested by its ETA. */
  | { kind: 'attestation-slow' }
  | {
      kind: 'redeem';
      /** Whole minutes until the ticket's timeout, 0 once it passed; undefined when unknown. */
      minutesLeft?: number;
      urgent: boolean;
      retryablesHref?: string;
    }
  | { kind: 'expired'; retryablesHref?: string; supportHref: string }
  | { kind: 'replay'; network: OpStackNetworkId }
  /** A native withdrawal to Ethereum: what it waits for, or the step it needs; minutes until it is ready. */
  | { kind: 'withdrawal'; phase: WithdrawalNotePhase; minutesLeft?: number };

export type WithdrawalNotePhase =
  'waiting-prove' | 'waiting-finalize' | 'prove' | 'reprove' | 'finalize' | 'replay' | 'confirming';

const withdrawalNote = (bridge: PendingBridge, now: number): PendingBridgeNote | undefined => {
  const { status, nextAction } = bridge;
  // etaAt is the whole trip's, so only the finalize wait gets a time.
  if (status === 'pending' && nextAction === 'prove') return { kind: 'withdrawal', phase: 'waiting-prove' };
  if (status === 'pending' && nextAction === 'finalize') {
    const minutesLeft = Math.ceil((bridge.etaAt - now) / 60_000);
    return { kind: 'withdrawal', phase: 'waiting-finalize', ...(minutesLeft > 0 && { minutesLeft }) };
  }
  // A mined finalize or replay can have failed its L1 relay: the next read settles it.
  if (
    status === 'pending' &&
    bridge.actions.some(
      action => (action.action === 'finalize' || action.action === 'replay') && action.status === undefined
    )
  )
    return { kind: 'withdrawal', phase: 'confirming' };
  if (status !== 'ready') return undefined;
  if (nextAction === 'prove') {
    const lastProve = bridge.actions.filter(action => action.action === 'prove').at(-1);
    return { kind: 'withdrawal', phase: lastProve?.status === 'invalidated' ? 'reprove' : 'prove' };
  }
  if (nextAction === 'finalize' || nextAction === 'replay') return { kind: 'withdrawal', phase: nextAction };
  return undefined;
};

// The tool looks the ticket up by the Ethereum tx that created it.
const retryablesHref = (txHash: string | undefined) =>
  txHash && `${ARBITRUM_RETRYABLES_URL}?${new URLSearchParams({ chainId: String(arbitrum.id), tx: txHash })}`;

/** A burn read as mined that still waits for Circle past its ETA; a sent claim has no next claim. */
const isAttestationLate = (bridge: PendingBridge, now: number) =>
  bridge.routeKind === 'cctp' &&
  bridge.status === 'pending' &&
  bridge.nextAction === 'claim' &&
  bridge.sourceMinedAt !== undefined &&
  Math.max(now, bridge.startedAt) > bridge.etaAt;

export function pendingBridgeNote(bridge: PendingBridge, now: number): PendingBridgeNote | undefined {
  if (isSourceUnseen(bridge)) return { kind: 'source-not-found', network: bridge.from };
  if (isAttestationLate(bridge, now)) return { kind: 'attestation-slow' };
  if (bridge.routeKind !== 'native') return undefined;
  if (bridge.to === 'ethereum') return withdrawalNote(bridge, now);
  if (bridge.from !== 'ethereum') return undefined;
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
