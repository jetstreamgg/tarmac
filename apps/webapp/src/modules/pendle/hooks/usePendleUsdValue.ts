import { useCallback } from 'react';
import { mainnet } from 'viem/chains';
import { usePrices, useReadSavingsUsds, sUsdsAddress } from '@/hooks';
import { pendleUsdValue } from '../lib/pendleUsdValue';

const WAD = 10n ** 18n;

/**
 * Returns a `valueUsd(symbol, amount)` function that converts a token amount
 * (decimal) into its USD value for the Fixed Yield analytics `amount` property.
 *
 * Primary source: BaLabs spot via `usePrices()` (covers sUSDS/USDS/USDC).
 * Fallback when the feed hasn't loaded: the on-chain sUSDS→USDS rate
 * (`convertToAssets(1e18)`, USDS assets per 1 sUSDS share) for sUSDS, and $1
 * for the dollar-pegged stablecoins. Returns `undefined` when no value can be
 * computed so callers omit `amount` rather than emit a wrong-unit number.
 *
 * See pendleUsdValue.ts for the analytics-standard rationale.
 */
export function usePendleUsdValue(): (symbol: string, amount: number) => number | undefined {
  const { data: pricesData } = usePrices();

  // sUSDS→USDS rate (chi) as a WAD: USDS assets returned for 1 sUSDS share.
  // Only consumed as the fallback when BaLabs has no sUSDS spot; cheap enough
  // to always read.
  const { data: sUsdsPerShareWad } = useReadSavingsUsds({
    functionName: 'convertToAssets',
    args: [WAD],
    chainId: mainnet.id as keyof typeof sUsdsAddress
  });

  return useCallback(
    (symbol: string, amount: number) =>
      pendleUsdValue(symbol, amount, pricesData, sUsdsPerShareWad as bigint | undefined),
    [pricesData, sUsdsPerShareWad]
  );
}
