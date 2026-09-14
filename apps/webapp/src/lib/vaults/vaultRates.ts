/**
 * One vault's raw rate input, tagged by provider. The pure router below knows how
 * to turn each provider's native form into a net-rate decimal:
 * - Morpho: `netRate` is already a decimal (e.g. 0.05 = 5%) from the Morpho API.
 */
export type VaultRateSource = { provider: 'morpho'; address: `0x${string}`; netRate: number | undefined };

/**
 * Pure provider-routing core: registry-of-rate-inputs in → rate-by-address out.
 *
 * Returns a `Map<lowercased address, net rate decimal>`. A vault whose rate isn't
 * available yet (`undefined`) is **omitted**, so a present `0` means the vault is
 * genuinely at 0% — distinct from "never fetched" (`map.has` is false). The
 * balances card collapses both to 0% for display, but keeping the distinction in
 * the source is what makes "0% only when truly 0%" assertable.
 */
export function buildVaultRatesByAddress(sources: VaultRateSource[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const source of sources) {
    const key = source.address.toLowerCase();
    if (source.netRate === undefined) continue;
    map.set(key, source.netRate);
  }
  return map;
}
