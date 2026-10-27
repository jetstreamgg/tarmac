import { i18n } from '@lingui/core';
import { t } from '@lingui/core/macro';
import { lockstakeEngineRevertMessages } from './contracts/lockstakeEngine';
import { panicRevertMessages } from './contracts/panic';
import { stUsdsRevertMessages } from './contracts/stUsds';
import { tokenInputRevertReasons } from './contracts/tokens';
import type { RevertMessageMap } from './contracts/types';
import { vatInputRevertReasons, vatRevertMessages } from './contracts/vat';
import { decodeRevert, type DecodedRevert } from './decodeRevert';

export { decodeRevert, decodeRevertData, type DecodedRevert } from './decodeRevert';
export type { RevertMessageMap } from './contracts/types';

/**
 * Every contract in `hooks/contracts.ts` (mainnet and L2), with the copy for
 * the reverts users can hit on it — or `null` when there is none yet, in which
 * case its reasons are shown verbatim. revertMessages.test.ts fails when a
 * contract is added there without an entry here (or one stays after it's
 * removed), so each new contract gets a deliberate decision.
 *
 * Key custom errors by name with care: a revert decoded without the contract's
 * ABI (a mined revert's replay, raw data from a wallet) only knows the 4-byte
 * selector, so a name-keyed entry matches before signing but not after.
 * Map the selector too when that matters.
 */
export const contractRevertMessages: Readonly<Record<string, RevertMessageMap | null>> = {
  // Savings / tokens
  mcdPot: null,
  mcdDai: null,
  mkr: null,
  weth: null,
  usdc: null,
  usdt: null,
  cbBtc: null,
  wstEth: null,
  usds: null,
  sky: null,
  spk: null,
  grove: null,
  sUsds: null,
  sUsdsImplementation: null,
  stUsds: stUsdsRevertMessages,
  stUsdsImplementation: null,
  // Maker core
  dsProxy: null,
  proxyActions: null,
  proxyRegistry: null,
  mcdVat: vatRevertMessages,
  mcdSpot: null,
  mcdJug: null,
  clipper: null,
  // Converters
  daiUsds: null,
  mkrSky: null,
  usdsPsmWrapper: null,
  curveStUsdsUsdsPool: null,
  gPv2Settlement: null,
  ethFlow: null,
  // Rewards
  usdsSkyReward: null,
  usdsSpkReward: null,
  usdsGroveReward: null,
  cleReward: null,
  merkleDistributor: null,
  MorphoMerklDistributor: null,
  MorphoMerklDistributorImplementation: null,
  // Staking Engine
  stakeModule: lockstakeEngineRevertMessages,
  lsMkr: null,
  lsMkrUsdsReward: null,
  lsSky: null,
  lsSkyUsdsReward: null,
  lsSkySpkReward: null,
  lsSkySkyReward: null,
  // Morpho vaults
  usdsRiskCapitalVault: null,
  usdcRiskCapitalVault: null,
  usdsFlagshipVault: null,
  usdtRiskCapitalVault: null,
  usdtSavingsVault: null,
  // L2
  usdcL2: null,
  usdsL2: null,
  sUsdsL2: null,
  psm3L2: null,
  ssrAuthOracle: null
};

/**
 * Contracts the app calls that `hooks/contracts.ts` doesn't list (a module's
 * own ABI: Pendle's router, a Morpho vault, …), keyed by a name of their own.
 */
export const moduleRevertMessages: Readonly<Record<string, RevertMessageMap>> = {};

/** Reverts any contract can raise: Solidity's own `Panic` codes. */
export const builtInRevertMessages: RevertMessageMap = panicRevertMessages;

/** Every mapped reason, flattened. Reasons carry their contract's prefix, so they don't collide. */
const revertMessageByReason: RevertMessageMap = Object.assign(
  {},
  ...Object.values(contractRevertMessages).filter((map): map is RevertMessageMap => map !== null),
  ...Object.values(moduleRevertMessages),
  builtInRevertMessages
);

/**
 * Reverts set by what the user typed: an amount over their balance or
 * allowance, a borrow over the limit or under the minimum. Still shown (mapped
 * or verbatim) but never tracked: they come and go with each keystroke and say
 * nothing about the app or the protocol. Everything else is tracked, unknown
 * reasons included, so a new contract's reasons don't need listing here to be
 * seen — only to be silenced.
 */
export const inputRevertReasons: ReadonlySet<string> = new Set([
  ...tokenInputRevertReasons,
  ...vatInputRevertReasons
]);

/** Whether a revert is one the user's own input caused (see `inputRevertReasons`). */
export const isInputRevert = (revert: DecodedRevert): boolean => inputRevertReasons.has(revert.reason);

/**
 * A reason fit for a Sentry tag or fingerprint. Most reasons are constants, but
 * a contract can build one at runtime (OpenZeppelin's "AccessControl: account
 * 0x… is missing role 0x…"), which would put a wallet address in a searchable
 * tag and split one revert into an issue per user. Long hex runs (addresses,
 * hashes — not 4-byte selectors) and long numbers are blanked out.
 */
export function revertReasonForReporting(revert: DecodedRevert): string {
  return revert.reason.replace(/0x[0-9a-fA-F]{9,}/g, '0x…').replace(/\d{6,}/g, '…');
}

/** Whether the registry has copy for a revert (no translation: safe before a locale is active). */
export const hasRevertCopy = (revert: DecodedRevert): boolean =>
  Object.hasOwn(revertMessageByReason, revert.reason);

/** The curated copy for a decoded revert, if the registry has one. */
export function knownRevertMessage(revert: DecodedRevert): string | undefined {
  const descriptor = revertMessageByReason[revert.reason];
  return descriptor ? i18n._(descriptor) : undefined;
}

/** A revert that happened on-chain, as opposed to one caught in simulation. */
const isMinedRevert = (error: unknown): boolean => {
  let e: unknown = error;
  for (let i = 0; i < 12 && e; i++) {
    if ((e as { name?: unknown }).name === 'TransactionRevertedError') return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
};

/**
 * What to tell the user about a failure that is a contract revert: the
 * registry's copy when the reason is mapped, otherwise the raw reason
 * (`The transaction would fail with "LockstakeEngine/urn-unsafe".`). `undefined` when
 * the error carries no revert (a rejection, a network failure, a reasonless
 * revert) — callers keep their own copy for those.
 */
export function revertMessage(error: unknown): string | undefined {
  const revert = decodeRevert(error);
  if (!revert) return undefined;
  const known = knownRevertMessage(revert);
  if (known) return known;
  return isMinedRevert(error)
    ? t`The transaction reverted with "${revert.reason}".`
    : t`The transaction would fail with "${revert.reason}".`;
}
