/**
 * Inputs for {@link computeVaultLimits}. All values are in the vault's underlying
 * asset (deposit/withdraw sides) or shares. Every field is
 * optional so the caller can pass partial data while reads are still resolving.
 */
export type VaultLimitsInput = {
  /** User's wallet balance of the underlying asset (e.g. USDT). */
  assetBalance?: bigint;
  /** User's current vault position expressed in underlying assets. */
  userAssets?: bigint;
  /** User's vault share balance. */
  userShares?: bigint;
  /** Vault-level available liquidity from the provider's market API (Morpho). */
  availableLiquidity?: bigint;
  /**
   * Whether the market-API liquidity read has settled. `false` while it is in
   * flight, so the withdraw cap reports "unknown" instead of a premature zero.
   */
  liquidityKnown?: boolean;
};

/** Effective input caps derived from on-chain limits + wallet balance. */
export type VaultLimits = {
  /** Max underlying the user may supply now: `min(walletBalance, remaining cap)`. */
  maxDepositInput: bigint;
  /**
   * Max underlying the user may withdraw now, or `undefined` while the liquidity
   * source is still loading (so the UI can hold the balance back rather than
   * flash a zero).
   */
  maxWithdrawInput?: bigint;
  /** Shares a Max (no-dust) withdrawal should redeem. */
  redeemShares: bigint;
  /** True when the contract reports zero remaining deposit room (cap reached). */
  depositCapReached: boolean;
  /** True when the position is larger than what can be withdrawn right now. */
  isLiquidityConstrained: boolean;
  /**
   * True when the whole position is withdrawable right now, so a Max
   * withdrawal may redeem the entire share balance.
   */
  isFullPositionWithdrawable: boolean;
  /** True when the provider's liquidity source settled without a figure. */
  isLiquidityDataUnavailable: boolean;
};

const min = (a: bigint, b: bigint): bigint => (a < b ? a : b);

/**
 * Pure mapping from a vault's on-chain ERC-4626 `max*` reads, the provider's
 * market liquidity and the wallet balance to the effective deposit/withdraw
 * input caps the UI should enforce, so a user can never submit a transaction the
 * contract would revert.
 *
 * Dependency-free and side-effect-free by design — trivially unit-testable.
 *
 * **The on-chain `max*` reads are not consulted.** Morpho V2 vaults return `0n`
 * from `maxDeposit`, `maxWithdraw` and `maxRedeem` for every account, even while
 * deposits and withdrawals are wide open — so consulting them would report every
 * vault as cap-reached and every position as unwithdrawable (APP-456 #7). The
 * real withdraw constraint is the vault liquidity the market API publishes; the
 * deposit side is uncapped.
 *
 * - Deposit is bounded by the wallet balance alone.
 * - `depositCapReached` is never inferred (Morpho publishes no cap).
 * - Withdraw is clamped to `min(userAssets, liquidity)`, which gracefully
 *   handles the liquidity-constrained case. A user holding no shares can
 *   withdraw nothing, regardless of a stale position read.
 * - `redeemShares` is the whole share balance, so a Max withdrawal leaves no
 *   dust behind.
 */
export function computeVaultLimits({
  assetBalance,
  userAssets,
  userShares,
  availableLiquidity,
  liquidityKnown = true
}: VaultLimitsInput): VaultLimits {
  const wallet = assetBalance ?? 0n;
  const position = userAssets ?? 0n;
  const shares = userShares ?? 0n;

  // Deposit side: the on-chain cap reads are stubs (see above), so only the
  // wallet balance bounds the input.
  const maxDepositInput = wallet;
  const depositCapReached = false;

  // Withdraw side: clamp the position to the market liquidity. A settled-but-
  // empty liquidity read falls back to the full position — the contract still
  // enforces the truth on submit.
  const withdrawable = liquidityKnown ? (availableLiquidity ?? position) : undefined;
  const maxWithdrawInput =
    shares === 0n ? 0n : withdrawable === undefined ? undefined : min(position, withdrawable);

  const redeemShares = shares;

  const isFullPositionWithdrawable = maxWithdrawInput !== undefined && maxWithdrawInput === position;

  return {
    maxDepositInput,
    maxWithdrawInput,
    redeemShares,
    depositCapReached,
    isLiquidityConstrained: position > 0n && maxWithdrawInput !== undefined && !isFullPositionWithdrawable,
    isFullPositionWithdrawable,
    isLiquidityDataUnavailable: liquidityKnown && availableLiquidity === undefined
  };
}
