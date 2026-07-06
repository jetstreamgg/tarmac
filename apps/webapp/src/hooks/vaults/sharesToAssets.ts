/**
 * Convert a user's ERC-4626 vault shares to underlying assets.
 *
 * `assetPerShareE18` is the result of `convertToAssets(10n ** 18n)` — i.e. the asset value
 * of 10^18 shares. So the user's assets are `shares * assetPerShareE18 / 10^18`. The divisor
 * is the queried **10^18** scale, NOT the vault's share decimals: those coincide for
 * 18-decimal vaults (Morpho) but differ for e.g. 6-decimal sUSDT, where dividing by the share
 * decimals overstates the balance by 10^(18 − decimals) (a 6-decimal vault would read ~10^12×
 * too high).
 *
 * Returns assets in the underlying asset's native decimals. Zero shares → 0n.
 */
export function sharesToAssets(shares: bigint, assetPerShareE18: bigint): bigint {
  return shares > 0n ? (shares * assetPerShareE18) / 10n ** 18n : 0n;
}
