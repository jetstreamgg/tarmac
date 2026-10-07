import { isAddress } from 'viem';
import type { BridgeNetwork } from './networks';

const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Whether `value` is a valid receiving address on the destination's address family. */
export const isValidRecipient = (value: string, family: BridgeNetwork['family']): boolean =>
  family === 'solana' ? SOLANA_ADDRESS.test(value) : isAddress(value);

export type SafeConfig = { owners: string[]; threshold: number };

/** A Safe lookup: the config, `null` when no Safe exists there, `undefined` when unknown. */
export type SafeLookup = SafeConfig | null | undefined;

/** Same owners (any order or case) and the same threshold. */
export const isSameSafe = (a: SafeConfig, b: SafeConfig): boolean => {
  if (a.threshold !== b.threshold || a.owners.length !== b.owners.length) return false;
  const owners = new Set(a.owners.map(owner => owner.toLowerCase()));
  return b.owners.every(owner => owners.has(owner.toLowerCase()));
};

/** A recipient other than the sender; the sender's own address (any case) counts as none. */
export const sendsToOther = (recipient: string | undefined, sender: string | undefined): boolean =>
  !!recipient && recipient.toLowerCase() !== sender?.toLowerCase();

export type RecipientRequirement =
  | { required: false }
  | {
      required: true;
      reason: 'other-family' | 'safe-not-on-destination' | 'safe-differs' | 'safe-unverified';
    };

/**
 * Whether the user must enter a recipient. A Safe sending to its own address
 * (no recipient, or its own address typed in) needs the same Safe on the
 * destination, otherwise funds land on an address its owners may not control;
 * unknown lookups fail closed.
 */
export function recipientRequirement({
  destinationFamily,
  sender,
  recipient,
  safe
}: {
  destinationFamily: BridgeNetwork['family'];
  sender?: string;
  recipient: string | undefined;
  /** Set when the sender is a Safe. */
  safe: { source: SafeLookup; destination: SafeLookup } | undefined;
}): RecipientRequirement {
  if (destinationFamily !== 'evm')
    return recipient ? { required: false } : { required: true, reason: 'other-family' };
  if (sendsToOther(recipient, sender)) return { required: false };
  if (!safe) return { required: false };
  if (safe.destination === null) return { required: true, reason: 'safe-not-on-destination' };
  if (!safe.source || !safe.destination) return { required: true, reason: 'safe-unverified' };
  return isSameSafe(safe.source, safe.destination)
    ? { required: false }
    : { required: true, reason: 'safe-differs' };
}
