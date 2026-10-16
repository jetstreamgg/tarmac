/** Below this sit precompiles, ArbOS system addresses and burn addresses like 0x…dEaD. */
const LOW_ADDRESS_CEILING = 1n << 32n;
/** OP Stack predeploys: 0x4200…0000 to 0x4200…07FF. */
const OP_PREDEPLOY_BASE = 0x4200000000000000000000000000000000000000n;
const OP_PREDEPLOY_SPAN = 0x800n;
/** OP Stack system senders, like the L1 attributes depositor. */
const OP_SYSTEM_PREFIX = '0xdeaddeaddeaddeaddeaddeaddeaddeaddead';

/**
 * Whether `address` is a chain system address on some network or one of
 * `contracts`; a mint or transfer to any of them reverts or traps the funds.
 * A malformed address counts as one.
 */
export function isSystemAddress(address: string, contracts: readonly string[]): boolean {
  let value: bigint;
  try {
    value = BigInt(address);
  } catch {
    return true;
  }
  if (value < LOW_ADDRESS_CEILING) return true;
  if (value >= OP_PREDEPLOY_BASE && value < OP_PREDEPLOY_BASE + OP_PREDEPLOY_SPAN) return true;
  const lower = address.toLowerCase();
  return lower.startsWith(OP_SYSTEM_PREFIX) || contracts.some(contract => contract.toLowerCase() === lower);
}
