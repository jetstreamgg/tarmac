import { Trans } from '@lingui/react/macro';
import { useMorphoVaultMarketApiData } from '@/hooks';
import { Skeleton } from '@/components/ui/skeleton';
import { buildVaultStrategy } from '../helpers/vaultStrategy';

/**
 * The "Strategy" section of the vault product page (ProductDetailTemplate
 * `afterDetails` slot): the total allocated capital, a proportional stacked bar
 * of the vault's market allocations, and a per-market legend. Re-skin of the
 * existing Exposure table — same `useMorphoVaultMarketApiData` source, distilled
 * to total + shares via `buildVaultStrategy`.
 */
export function VaultStrategy({ vaultAddress }: { vaultAddress: `0x${string}` }) {
  const { data, isLoading } = useMorphoVaultMarketApiData({ vaultAddress });
  const strategy = data?.market ? buildVaultStrategy(data.market.markets) : undefined;

  return (
    <div data-testid="vault-strategy">
      {isLoading || !strategy ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
      ) : strategy.segments.length === 0 ? (
        <span className="text-textSecondary text-sm">
          <Trans>No allocations found</Trans>
        </span>
      ) : (
        <div className="flex flex-col gap-5">
          <span className="text-text text-3xl font-semibold">{strategy.formattedTotal}</span>

          {/* Proportional stacked bar — segments fill edge-to-edge with rounded ends. */}
          <div className="bg-surface flex h-2.5 w-full overflow-hidden rounded-full">
            {strategy.segments.map(segment => (
              <div
                key={segment.id}
                className="h-full"
                style={{ width: `${segment.share * 100}%`, backgroundColor: segment.color }}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            {strategy.segments.map(segment => (
              <div key={segment.id} className="flex flex-col gap-1">
                <span className="text-textSecondary flex items-center gap-1.5 text-sm">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  />
                  {segment.label}
                </span>
                <span className="text-text text-sm font-medium">
                  {segment.formattedUsd}{' '}
                  <span className="text-textSecondary">({segment.formattedShare})</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
