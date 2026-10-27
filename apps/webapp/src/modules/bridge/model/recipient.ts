import { isAddress, zeroAddress } from 'viem';
import type { SafeConfig } from '@/hooks/wallet/safeAccount';
import { CCTP_CONTRACTS } from '../adapters/cctp/contracts';
import { NATIVE_DEPOSIT_CONTRACTS } from '../adapters/nativeDeposit/contracts';
import { NATIVE_WITHDRAWAL_CONTRACTS } from '../adapters/nativeWithdrawal/contracts';
import type { BridgeNetwork } from './networks';
import type { PendingBridge } from './types';
import { isSystemAddress } from './systemAddresses';

const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Whether `value` is a valid receiving address on the destination's address family; never the zero address. */
export const isValidRecipient = (value: string, family: BridgeNetwork['family']): boolean =>
  family === 'solana' ? SOLANA_ADDRESS.test(value) : isAddress(value) && value.toLowerCase() !== zeroAddress;

const BRIDGE_CONTRACTS = [...NATIVE_DEPOSIT_CONTRACTS, ...NATIVE_WITHDRAWAL_CONTRACTS, ...CCTP_CONTRACTS];

/** A system address or a contract the bridges use, which can't hold what it's sent. */
export const isBlockedRecipient = (address: string): boolean => isSystemAddress(address, BRIDGE_CONTRACTS);

/** An address's code on one chain: a contract, none, or undefined while unknown. */
export type CodeLookup = 'contract' | 'none' | undefined;

/** An EIP-7702 delegation: the 0xef0100 designator and a 20-byte address. */
const DELEGATION = /^0xef0100[0-9a-f]{40}$/i;

/** No code, or a 7702 delegation, which leaves the account's key in control on every chain. */
export const codeKind = (bytecode: string | null | undefined): 'contract' | 'none' =>
  !bytecode || bytecode === '0x' || DELEGATION.test(bytecode) ? 'none' : 'contract';

export type AddressCode = { source: CodeLookup; destination: CodeLookup };

/**
 * Whether anyone controls an address on the destination: a contract on the
 * source with no code there is nobody's. An EOA is the same key on every
 * chain, so it needs no destination read. Unknown reads fail closed.
 */
export function codeRisk({
  source,
  destination
}: AddressCode): 'ok' | 'contract-not-on-destination' | 'unverified' {
  if (source === 'none') return 'ok';
  if (source === undefined || destination === undefined) return 'unverified';
  return destination === 'none' ? 'contract-not-on-destination' : 'ok';
}

export type RecipientProblem = 'system-contract' | 'contract-not-on-destination' | 'unverified';

/** Why a typed EVM recipient can't receive on the destination; undefined when it can. */
export function recipientProblem(recipient: string, code: AddressCode): RecipientProblem | undefined {
  if (isBlockedRecipient(recipient)) return 'system-contract';
  const risk = codeRisk(code);
  return risk === 'ok' ? undefined : risk;
}

export type { SafeConfig };

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

/** A CCTP claim mints to its recipient and sells from its wallet: only that wallet can send it. */
export const claimsFromDestinationWallet = (
  bridge: Pick<PendingBridge, 'routeKind' | 'nextAction' | 'recipient'>,
  account: string | undefined
): boolean =>
  bridge.routeKind === 'cctp' && bridge.nextAction === 'claim' && sendsToOther(bridge.recipient, account);

export type RecipientRequirement =
  | { required: false }
  | {
      required: true;
      reason:
        | 'other-family'
        | 'safe-not-on-destination'
        | 'safe-differs'
        | 'safe-unverified'
        | 'contract-not-on-destination'
        | 'contract-unverified';
    };

/**
 * Whether the user must enter a recipient. A Safe sending to its own address
 * (no recipient, or its own address typed in) needs the same Safe on the
 * destination, and any other contract wallet needs code there, otherwise
 * funds land on an address its owners may not control; unknown lookups fail
 * closed.
 */
export function recipientRequirement({
  destinationFamily,
  sender,
  recipient,
  safe,
  code
}: {
  destinationFamily: BridgeNetwork['family'];
  sender?: string;
  recipient: string | undefined;
  /** Set when the sender is a Safe. */
  safe: { source: SafeLookup; destination: SafeLookup } | undefined;
  /** The sender's code on the source and destination. */
  code: AddressCode;
}): RecipientRequirement {
  if (destinationFamily !== 'evm')
    return recipient ? { required: false } : { required: true, reason: 'other-family' };
  if (sendsToOther(recipient, sender)) return { required: false };
  if (safe) {
    if (safe.destination === null) return { required: true, reason: 'safe-not-on-destination' };
    if (!safe.source || !safe.destination) return { required: true, reason: 'safe-unverified' };
    if (!isSameSafe(safe.source, safe.destination)) return { required: true, reason: 'safe-differs' };
  }
  const risk = codeRisk(code);
  if (risk === 'ok') return { required: false };
  return {
    required: true,
    reason: risk === 'unverified' ? 'contract-unverified' : 'contract-not-on-destination'
  };
}
