import { Trans } from '@lingui/react/macro';
import { useMorphoVaultMarketApiData } from '@/hooks';
import { Skeleton } from '@/components/ui/skeleton';
import { TokensComposition } from '@/components/product/TokensComposition';
import { buildVaultStrategy } from '../helpers/vaultStrategy';

/**
 * The "Strategy" section of the vault product page (ProductDetailTemplate
 * `afterDetails` slot): the total allocated capital, a proportional stacked bar
 * of the vault's market allocations, and a per-market legend. Same
 * `useMorphoVaultMarketApiData` source as the Exposure table it replaced,
 * distilled to total + shares via `buildVaultStrategy`, then handed to the DS
 * Tokens Composition component — this used to carry its own wrapping column
 * grid, which is what APP-432 item 13 flagged against the one-row-per-token
 * layout in Figma 5270:15609.
 */
export function VaultStrategy({ vaultAddress }: { vaultAddress: `0x${string}` }) {
  const { data, isLoading } = useMorphoVaultMarketApiData({ vaultAddress });
  const strategy = data?.market
    ? buildVaultStrategy(data.market.markets, data.market.idleLiquidity, data.totalAssetsUsd)
    : undefined;

  return (
    <div data-testid="vault-strategy">
      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
      ) : !strategy || strategy.segments.length === 0 ? (
        <span className="text-fgSecondary text-sm">
          <Trans>No allocations found</Trans>
        </span>
      ) : (
        <TokensComposition
          total={strategy.formattedTotal}
          // Shares already sit on a 0..1 scale against the vault total, so the
          // bar must not renormalize them — a vault whose reported total
          // exceeds its allocations keeps its short tail of empty track.
          valueTotal={1}
          segments={strategy.segments.map(segment => ({
            id: segment.id,
            label: segment.label,
            color: segment.color,
            hoverColor: segment.hoverColor,
            value: segment.share,
            percent: parseFloat(segment.formattedShare),
            formattedValue: segment.formattedUsd
          }))}
        />
      )}
    </div>
  );
}
