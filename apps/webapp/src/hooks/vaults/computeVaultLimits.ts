import type { VaultProvider } from './types';

/**
 * Inputs for {@link computeVaultLimits}. All values are in the vault's underlying
 * asset (deposit/withdraw sides) or shares, as read on-chain. Every field is
 * optional so the caller can pass partial data while reads are still resolving.
 */
export type VaultLimitsInput = {
  /**
   * Which provider operates the vault. Decides whether the on-chain ERC-4626
   * `max*` reads can be trusted — see {@link computeVaultLimits}.
   */
  provider?: VaultProvider;
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
  /** On-chain `maxRedeem(user)` — shares the user can redeem right now. */
  maxRedeem?: bigint;
  /** Vault-level available liquidity from the provider's market API (Morpho). */
  availableLiquidity?: bigint;
  /**
   * Whether the market-API liquidity read has settled. `false` while it is in
   * flight, so the withdraw cap reports "unknown" instead of a premature zero.
   * Irrelevant for providers whose cap comes from the contract.
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
 * **The `max*` reads are provider-specific.** Morpho V2 vaults return `0n` from
 * `maxDeposit`, `maxWithdraw` and `maxRedeem` for every account, even while
 * deposits and withdrawals are wide open — so consulting them there would
 * report every Morpho vault as cap-reached and every position as unwithdrawable
 * (APP-456 #7). Morpho's real withdraw constraint is the vault liquidity its
 * market API publishes; its deposit side is uncapped. Every other provider
 * (Spark/Sky) exposes honest on-chain limits and those stay authoritative.
 *
 * - Deposit is clamped to `min(walletBalance, maxDeposit)`. An unknown
 *   (`undefined`) `maxDeposit` is treated as uncapped.
 * - `depositCapReached` is true only when the contract explicitly reports `0n`
 *   remaining room — never inferred from a missing read, never from Morpho.
 * - Withdraw is clamped to `min(userAssets, withdrawable)`, which gracefully
 *   handles the liquidity-constrained case. A user holding no shares can
 *   withdraw nothing, regardless of a stale position read.
 * - `redeemShares` is the whole share balance (Morpho) or the contract's
 *   `maxRedeem`, so a Max withdrawal leaves no dust behind.
 */
export function computeVaultLimits({
  provider = 'morpho',
  assetBalance,
  maxDeposit,
  userAssets,
  userShares,
  maxWithdraw,
  maxRedeem,
  availableLiquidity,
  liquidityKnown = true
}: VaultLimitsInput): VaultLimits {
  const wallet = assetBalance ?? 0n;
  const position = userAssets ?? 0n;
  const shares = userShares ?? 0n;
  // Morpho's ERC-4626 limit reads are stubs (see above); everyone else's are real.
  const usesMarketLiquidity = provider === 'morpho';

  // Deposit side: clamp the wallet balance to the remaining on-chain cap room.
  // Unknown cap ⇒ uncapped ⇒ only the wallet balance bounds the input.
  const remainingCap = usesMarketLiquidity ? wallet : (maxDeposit ?? wallet);
  const maxDepositInput = min(wallet, remainingCap);
  const depositCapReached = !usesMarketLiquidity && maxDeposit === 0n;

  // Withdraw side: clamp the position to whatever the provider says is
  // withdrawable. A settled-but-empty liquidity read falls back to the full
  // position — the contract still enforces the truth on submit.
  const withdrawable = usesMarketLiquidity
    ? liquidityKnown
      ? (availableLiquidity ?? position)
      : undefined
    : (maxWithdraw ?? position);
  const maxWithdrawInput =
    shares === 0n ? 0n : withdrawable === undefined ? undefined : min(position, withdrawable);

  const redeemShares = usesMarketLiquidity ? shares : min(shares, maxRedeem ?? shares);

  const isFullPositionWithdrawable = maxWithdrawInput !== undefined && maxWithdrawInput === position;

  return {
    maxDepositInput,
    maxWithdrawInput,
    redeemShares,
    depositCapReached,
    isLiquidityConstrained: position > 0n && maxWithdrawInput !== undefined && !isFullPositionWithdrawable,
    isFullPositionWithdrawable,
    isLiquidityDataUnavailable: usesMarketLiquidity && liquidityKnown && availableLiquidity === undefined
  };
}
