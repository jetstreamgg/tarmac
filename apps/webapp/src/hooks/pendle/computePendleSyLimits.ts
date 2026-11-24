const WAD = 10n ** 18n;
const MAX_UINT256 = 2n ** 256n - 1n;

const min = (a: bigint, b: bigint): bigint => (a < b ? a : b);

/**
 * Raw reads behind {@link computePendleSyLimits}: the SY's rate limiter
 * (PendleRateLimiter) and the SY itself. Share amounts are SY shares, which
 * for an ERC-4626 SY are 1:1 with the wrapped vault token (sUSDS).
 */
export type PendleSyLimitsInput = {
  /** `isRateLimited(sy)`: when false the limiter ignores this SY's burns. */
  isRateLimited: boolean;
  /** `availableBurn(sy)`: SY shares the per-token meter still lets out. */
  availableBurn: bigint;
  /** `availableBurn(address(0))`: 18-decimal USD left on the meter shared by every limited SY. */
  aggregateAvailableBurn: bigint;
  /** The price registry's `tokenPrice(sy)`, 18-decimal USD per share. Zero keeps the SY off the shared meter. */
  syPrice: bigint;
  /** `burnQuota(sy, wallet)`: shares this wallet may burn outside both meters. */
  burnQuota: bigint;
  /** The SY's `supplyCap()`; max uint256 means uncapped. */
  supplyCap: bigint;
  /** The SY's `totalSupply()`. */
  totalSupply: bigint;
  /** The SY's `exchangeRate()`: assets (USDS) per share, 1e18-scaled. */
  exchangeRate: bigint;
};

export type PendleSyLimits = {
  /**
   * Most PT that can be sold or claimed right now, or `undefined` when burns
   * aren't limited. Both flows end by burning SY, and one burn over the limit
   * reverts whole.
   */
  maxWithdrawPt?: bigint;
  /**
   * Room left under the SY's supply cap, as SY shares (the vault token) and as
   * the vault's asset, or `undefined` when the SY is uncapped.
   */
  maxSupply?: { shares: bigint; assets: bigint };
};

/**
 * Pure mapping from the SY's rate-limiter and supply-cap reads to the amounts
 * the Pendle forms may let through.
 *
 * The burn limit is stated in PT by valuing every PT at one asset
 * (`shares × exchangeRate`). That is exact for a matured claim, where a PT
 * redeems for `1 / index` shares and the index is never below the SY's
 * exchange rate. Before maturity a PT sells for less than one asset, so the
 * figure sits below the true limit by the PT's discount: the form never lets
 * through a sell the limiter would refuse.
 */
export function computePendleSyLimits({
  isRateLimited,
  availableBurn,
  aggregateAvailableBurn,
  syPrice,
  burnQuota,
  supplyCap,
  totalSupply,
  exchangeRate
}: PendleSyLimitsInput): PendleSyLimits {
  const limits: PendleSyLimits = {};

  if (isRateLimited) {
    const metered =
      syPrice > 0n ? min(availableBurn, (aggregateAvailableBurn * WAD) / syPrice) : availableBurn;
    limits.maxWithdrawPt = ((burnQuota + metered) * exchangeRate) / WAD;
  }

  if (supplyCap !== MAX_UINT256) {
    const shares = supplyCap > totalSupply ? supplyCap - totalSupply : 0n;
    limits.maxSupply = { shares, assets: (shares * exchangeRate) / WAD };
  }

  return limits;
}

/**
 * The supply cap as an amount of the chosen input token, or `undefined` when
 * the SY is uncapped. The vault token mints shares 1:1; anything else is
 * treated as the vault's asset at par (USDS and DAI are; USDC arrives through
 * an aggregator within a few basis points of it).
 */
export function maxPendleSupplyInput(
  limits: PendleSyLimits | undefined,
  input: { isVaultToken: boolean; decimals: number; assetDecimals: number }
): bigint | undefined {
  if (!limits?.maxSupply) return undefined;
  if (input.isVaultToken) return limits.maxSupply.shares;
  const { assets } = limits.maxSupply;
  return input.decimals >= input.assetDecimals
    ? assets * 10n ** BigInt(input.decimals - input.assetDecimals)
    : assets / 10n ** BigInt(input.assetDecimals - input.decimals);
}
