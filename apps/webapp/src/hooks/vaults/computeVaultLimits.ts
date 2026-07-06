/**
 * Inputs for {@link computeVaultLimits}. All values are in the vault's underlying
 * asset (deposit/withdraw sides) or shares, as read on-chain. Every field is
 * optional so the caller can pass partial data while reads are still resolving.
 */
export type VaultLimitsInput = {
  /** User's wallet balance of the underlying asset (e.g. USDT). */
  assetBalance?: bigint;
  /** On-chain `maxDeposit(user)` — remaining room under the vault's supply cap. */
  maxDeposit?: bigint;
  /** User's current vault position expressed in underlying assets. */
  userAssets?: bigint;
  /** User's vault share balance. */
  userShares?: bigint;
  /** On-chain `maxWithdraw(user)` — assets the user can withdraw right now. */
  maxWithdraw?: bigint;
};

/** Effective input caps derived from on-chain limits + wallet balance. */
export type VaultLimits = {
  /** Max underlying the user may supply now: `min(walletBalance, remaining cap)`. */
  maxDepositInput: bigint;
  /** Max underlying the user may withdraw now: `min(userAssets, maxWithdraw)`. */
  maxWithdrawInput: bigint;
  /** True when the contract reports zero remaining deposit room (cap reached). */
  depositCapReached: boolean;
};

const min = (a: bigint, b: bigint): bigint => (a < b ? a : b);

/**
 * Pure mapping from on-chain ERC-4626 `max*` reads + wallet balance to the
 * effective deposit/withdraw input caps the UI should enforce, so a user can
 * never submit a transaction the contract would revert.
 *
 * Dependency-free and side-effect-free by design — trivially unit-testable.
 *
 * - Deposit is clamped to `min(walletBalance, maxDeposit)`. An unknown
 *   (`undefined`) `maxDeposit` is treated as uncapped (the Morpho default),
 *   so this is behaviour-preserving for vaults with no on-chain cap.
 * - `depositCapReached` is true only when the contract explicitly reports `0n`
 *   remaining room — never inferred from a missing read.
 * - Withdraw is clamped to `min(userAssets, maxWithdraw)`, which gracefully
 *   handles the liquidity-constrained case (`maxWithdraw < userAssets`). A user
 *   holding no shares can withdraw nothing, regardless of a stale position read.
 */
export function computeVaultLimits({
  assetBalance,
  maxDeposit,
  userAssets,
  userShares,
  maxWithdraw
}: VaultLimitsInput): VaultLimits {
  const wallet = assetBalance ?? 0n;
  const position = userAssets ?? 0n;
  const shares = userShares ?? 0n;

  // Deposit side: clamp the wallet balance to the remaining on-chain cap room.
  // Unknown cap ⇒ uncapped ⇒ only the wallet balance bounds the input.
  const remainingCap = maxDeposit ?? wallet;
  const maxDepositInput = min(wallet, remainingCap);
  const depositCapReached = maxDeposit !== undefined && maxDeposit === 0n;

  // Withdraw side: clamp the position to what the contract says is withdrawable.
  // Unknown maxWithdraw ⇒ fall back to the full position.
  const withdrawable = maxWithdraw ?? position;
  const maxWithdrawInput = shares === 0n ? 0n : min(position, withdrawable);

  return { maxDepositInput, maxWithdrawInput, depositCapReached };
}
