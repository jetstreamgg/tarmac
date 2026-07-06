import { resolveSparkVaultRate } from '@/lib/vaults/sparkVaultRate';
import { useVaultMarketData } from '../useVaultMarketData';
import { useSparkVaultRate } from './useSparkVaultRate';

/**
 * The single canonical Spark vault rate, resolved from the two on-app sources.
 *
 * Prefers the Spark Savings API net APY (`marketData.rate.formattedNetRate`,
 * which is a present `"0.00%"` for a dormant rate) and falls back to the
 * on-chain Vault Savings Rate (`vsr`) when the API has no figure. Every Spark
 * rate surface should consume this hook (or {@link resolveSparkVaultRate} for
 * the pure resolution) so the header, stats card, and transaction overview can
 * never disagree.
 *
 * `formattedRate` is `undefined` until at least one source resolves a value;
 * `isLoading` stays true until both settle so we decide once rather than
 * flashing the on-chain value before the preferred API value arrives.
 *
 * @param vaultAddress - The Spark vault contract address (optional; omit to disable)
 */
export function useSparkVaultResolvedRate({ vaultAddress }: { vaultAddress?: `0x${string}` }) {
  const { data: marketData, isLoading: isMarketDataLoading } = useVaultMarketData({
    provider: 'sky',
    vaultAddress
  });

  const { formattedRate: onChainFormattedRate, isLoading: isOnChainLoading } = useSparkVaultRate({
    vaultAddress
  });

  const formattedRate = resolveSparkVaultRate({
    apiFormattedRate: marketData?.rate?.formattedNetRate,
    onChainFormattedRate
  });

  return {
    formattedRate,
    isLoading: isMarketDataLoading || isOnChainLoading
  };
}
